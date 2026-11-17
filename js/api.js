// 資料存取層。App 只呼叫 Api.xxx，不直接碰 Firebase。
//
// 行事曆 event：{ id, title, category, event_date, end_date, start_time, end_time, member_ids, note }
//   category: 'schedule' 補習 | 'exam' 考試 | 'family' 家庭活動，或自訂類型的 id（'other' 其他：只有舊資料會有）
// 自訂類型 category：{ id, label, color, created_at }（只有家長能新增、刪除）
//   日期 'YYYY-MM-DD'，時間 'HH:MM' 或 null（全天）；member_ids 空陣列代表「全家」
//   created_by 是新增的人：行程全家都看得到，但只有新增的人可以修改或刪除
//   每週重複的行程只存一筆，另有 repeat、repeat_days、skip_dates（見 cleanEvent）
// 雜記 note：     { id, title, body, pinned, updated_at, updated_by }
// 訊息 message：  { id, text, sender, sent_at, recalled }
// 我有話要說 post：{ id, text, author, to: [UID…], created_at }
//   回覆 reply：  { id, post_id, text, author, created_at }
// 基本資料 profile：{ id: UID, birthday, phone, org, note }
// 上線狀態 presence：{ id: UID, last_seen, online, read_at: 聊天室讀到的時間點 }
// 零用錢 ledger： { id, kid: 小朋友的 UID, type: 'income' 給零用錢 | 'expense' 支出, amount, note, date }
//   members 文件裡 child: true 的成員是小朋友，其他人是家長
// 費用申請 request：{ id, kid, title, amount, need_date, status: 'pending' 還沒給 | 'given' 已給, given_by, given_at, given_amount: 實際給的金額, ledger_id }
// 以下四種用最下面的「通用讀寫」存取（watchList / addDoc / setDoc / updateDoc / deleteDoc / getDoc）：
//   採買 shopping：  { id, text, done, added_by, done_by, created_at }
//   投票 polls：     { id, question, options: [文字…], author, created_at, closed, deadline: 'YYYY-MM-DD' 或 '', deadline_at: 毫秒或 0 }
//        poll_votes：{ id: 投票id_UID, poll_id, uid, choice: 第幾個選項, voted_at }
//   資料卡 cards：   { id, title, member: UID 或 ''（全家）, body, updated_at }
//   成績 scores：    { id, kid: 小朋友的 UID, subject, term: '國一上'…'國三下', title, date, score, full, note }
//   旅程 trips：     { id, title, place, start_date, end_date, note }
//   旅程內容 trip_items：{ id, trip_id, kind: 'plan' 行程 | 'journal' 日誌 | 'pack' 行李 | 'cost' 花費, … }
//   相簿 photos：    { id, month: 'YYYY-MM', date, caption, thumb, image_id, author }
//        photo_comments：{ id, photo_id, month, text, author, created_at }
//   聊天照片 chat_images：{ id, data: 圖片內容, sender, sent_at }；訊息本身只放小縮圖 thumb 和 image_id
// 推播 push_tokens：{ id: 裝置代碼, uid, updated_at }
//   updated_at、sent_at、created_at、last_seen 都是毫秒時間戳（Date.now()）

(function () {
  const cfg = window.FAMILY_CONFIG || {};
  const isDemo = !(cfg.firebase && cfg.firebase.apiKey);
  const TOKEN_KEY = 'family-push-token';

  const cleanEvent = (ev) => ({
    title: ev.title,
    category: ev.category,
    event_date: ev.event_date,
    end_date: ev.end_date || ev.event_date,
    start_time: ev.start_time || null,
    end_time: ev.end_time || null,
    member_ids: ev.member_ids || [],
    note: ev.note || null,
    // 每週重複：event_date 是開始日、end_date 是「重複到」的日期，
    // repeat_days 是星期幾（0=日 … 6=六），skip_dates 是被單獨取消的日期
    repeat: ev.repeat || null,
    repeat_days: ev.repeat ? (ev.repeat_days || []) : [],
    skip_dates: ev.repeat ? (ev.skip_dates || []) : []
  });
  const cleanNote = (n, uid) => ({
    title: n.title || '', body: n.body || '', pinned: !!n.pinned,
    updated_at: Date.now(), updated_by: uid
  });
  const cleanProfile = (p) => ({
    birthday: p.birthday || '', phone: p.phone || '', org: p.org || '', note: p.note || ''
  });
  const cleanLedger = (e) => ({
    kid: e.kid, type: e.type === 'income' ? 'income' : 'expense',
    amount: Math.round(Number(e.amount)), note: e.note || '', date: e.date,
    by_parent: e.type !== 'income' && !!e.by_parent   // 父母支出：只做紀錄，不從零用錢扣
  });
  const cleanRequest = (r) => ({
    kid: r.kid, title: r.title, amount: Math.round(Number(r.amount)), need_date: r.need_date,
    status: r.status === 'given' ? 'given' : 'pending',
    given_by: r.status === 'given' ? (r.given_by || null) : null,
    given_at: r.status === 'given' ? (r.given_at || Date.now()) : null,
    // 實際給的金額（可以和申請的金額不同）
    given_amount: r.status === 'given' ? Math.round(Number(r.given_amount != null ? r.given_amount : r.amount)) : null,
    // 標示已給時，自動記進零用錢帳本的那一筆收入（取消已給時用它找到並刪掉）
    ledger_id: r.status === 'given' ? (r.ledger_id || null) : null
  });
  const ledgerOrder = (a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id));
  const byTime = (a, b) =>
    (a.event_date + (a.start_time || '')).localeCompare(b.event_date + (b.start_time || ''));
  const notesOrder = (a, b) => (b.pinned - a.pinned) || (b.updated_at - a.updated_at);
  const toMap = (rows) => { const m = {}; rows.forEach((r) => { m[r.id] = r; }); return m; };

  // ---------- Firebase（Authentication + Firestore） ----------
  // 集合：members/{UID}、events、notes、messages、posts、replies、profiles/{UID}、presence/{UID}
  function firebaseApi() {
    const F = window.FirebaseSDK;
    const app = F.initializeApp(cfg.firebase);
    const auth = F.getAuth(app);
    // 資料在手機上留一份（離線快取）：打開 App 先顯示上次的內容，再只向伺服器要有變動的部分，
    // 聊天室不用每次重新下載 300 則訊息。手機不支援時退回一般模式。
    let db;
    try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
    catch (e) { console.warn('離線快取沒有啟用', e); db = F.getFirestore(app); }
    const col = (name) => F.collection(db, name);
    const row = (d) => ({ id: d.id, ...d.data() });
    const uid = () => auth.currentUser.uid;

    async function list(name, ...constraints) {
      const snap = await F.getDocs(F.query(col(name), ...constraints));
      return snap.docs.map(row);
    }
    async function save(name, id, data) {
      if (id) {
        await F.updateDoc(F.doc(db, name, id), data);
        return { id, ...data };
      }
      const ref = await F.addDoc(col(name), { ...data, created_by: uid(), created_at: F.serverTimestamp() });
      return { id: ref.id, ...data };
    }
    const remove = (name, id) => F.deleteDoc(F.doc(db, name, id));
    // 即時監聽：每次有變動就把整份清單交給 cb。回傳停止監聽的函式。
    const watch = (label, q, cb) => F.onSnapshot(q,
      (snap) => cb(snap.docs.map(row)),
      (err) => console.warn(label + '即時同步中斷', err));

    return {
      isDemo: false,
      async currentUserId() {
        await auth.authStateReady();
        return auth.currentUser ? auth.currentUser.uid : null;
      },
      async signIn(email, password) {
        const cred = await F.signInWithEmailAndPassword(auth, email, password);
        return cred.user.uid;
      },
      async signOut() { await F.signOut(auth); },
      // 從背景回來：手機常把連線停掉卻沒通知，等它自己發現要好幾秒。直接重連，新訊息馬上進來。
      async reconnect() {
        try { await F.disableNetwork(db); await F.enableNetwork(db); } catch (e) { console.warn(e); }
      },
      async listMembers() {
        try {
          return await list('members', F.orderBy('sort'));
        } catch (e) {
          // 不在成員名單裡的帳號會被安全規則擋下
          if (e && e.code === 'permission-denied') return [];
          throw e;
        }
      },

      // 只用 end_date 一個條件查詢（不需要另外建立索引），開始日期在這裡過濾
      async listEvents(from, to) {
        const rows = await list('events', F.where('end_date', '>=', from), F.orderBy('end_date'));
        return rows.filter((e) => e.event_date <= to).sort(byTime);
      },
      saveEvent: (ev) => save('events', ev.id, cleanEvent(ev)),
      deleteEvent: (id) => remove('events', id),
      watchEvents(cb) {
        const d = new Date(); d.setDate(d.getDate() - 45);
        const since = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        let first = true;
        return F.onSnapshot(
          F.query(col('events'), F.where('end_date', '>=', since)),
          () => { if (first) { first = false; return; } cb(); },
          (err) => console.warn('行事曆即時同步中斷', err)
        );
      },

      async listNotes() { return (await list('notes')).sort(notesOrder); },
      saveNote: (n) => save('notes', n.id, cleanNote(n, uid())),
      deleteNote: (id) => remove('notes', id),

      // extra：傳照片時帶 { thumb, image_id }
      async sendMessage(text, extra) {
        await F.addDoc(col('messages'), { text, ...(extra || {}), sender: uid(), sent_at: Date.now() });
      },
      // 收回：清空內容並標記。安全規則只允許本人在送出一小時內這樣做。
      async recallMessage(id, hasImage) {
        await F.updateDoc(F.doc(db, 'messages', id),
          hasImage ? { text: '', recalled: true, thumb: '', image_id: '' } : { text: '', recalled: true });
      },
      watchMessages: (cb) => watch('聊天室', F.query(col('messages'), F.orderBy('sent_at'), F.limitToLast(300)), cb),

      async addPost(p) {
        await F.addDoc(col('posts'), { text: p.text, to: p.to, author: uid(), created_at: Date.now() });
      },
      deletePost: (id) => remove('posts', id),
      async addReply(postId, text) {
        await F.addDoc(col('replies'), { post_id: postId, text, author: uid(), created_at: Date.now() });
      },
      watchPosts: (cb) => watch('我有話要說', F.query(col('posts'), F.orderBy('created_at'), F.limitToLast(60)), cb),
      watchReplies: (cb) => watch('回覆', F.query(col('replies'), F.orderBy('created_at'), F.limitToLast(500)), cb),

      async listProfiles() { return toMap(await list('profiles')); },
      async saveProfile(memberId, p) { await F.setDoc(F.doc(db, 'profiles', memberId), cleanProfile(p)); },
      // 標記某位成員是不是小朋友（安全規則只允許管理員這樣做）
      async setChild(memberId, isChild) { await F.updateDoc(F.doc(db, 'members', memberId), { child: !!isChild }); },

      // 零用錢：家長讀全部；小朋友只讀得到自己的（安全規則也是這樣限制，所以查詢要帶條件）
      async listLedger(onlyKid) {
        const rows = onlyKid ? await list('ledger', F.where('kid', '==', onlyKid)) : await list('ledger');
        return rows.sort(ledgerOrder);
      },
      saveLedger: (e) => save('ledger', e.id, cleanLedger(e)),
      deleteLedger: (id) => remove('ledger', id),

      // 自訂的行事曆類型
      async addCategory(c) { await F.addDoc(col('categories'), { label: c.label, color: c.color, created_at: Date.now() }); },
      deleteCategory: (id) => remove('categories', id),
      watchCategories: (cb) => watch('行事曆類型', col('categories'), (rows) => cb(rows.sort((a, b) => a.created_at - b.created_at))),

      // 費用申請：小朋友提出「哪一天需要多少錢」，家長給了之後標示已給
      saveRequest: (r) => save('requests', r.id, cleanRequest(r)),
      deleteRequest: (id) => remove('requests', id),
      watchRequests: (cb, onlyKid) => watch('費用申請',
        onlyKid ? F.query(col('requests'), F.where('kid', '==', onlyKid)) : col('requests'), cb),

      // readAt：這個人聊天室讀到哪個時間點（給「已讀」用），跟上線狀態存在同一份文件裡
      async beat(online, readAt) {
        await F.setDoc(F.doc(db, 'presence', uid()), { last_seen: Date.now(), online: !!online, read_at: readAt || 0 });
      },
      watchPresence: (cb) => watch('上線狀態', col('presence'), (rows) => cb(toMap(rows))),

      // ----- 通用讀寫（給採買、投票、資料卡、聊天照片用） -----
      watchList: (name, cb) => watch(name, col(name), cb),
      // 讀一次清單；filter 是 [欄位, 值]，只讀符合的（小朋友讀自己的資料時一定要帶，否則會被安全規則擋下）
      listDocs: (name, filter) => (filter ? list(name, F.where(filter[0], '==', filter[1])) : list(name)),
      async addDoc(name, data) { return (await F.addDoc(col(name), data)).id; },
      setDoc: (name, id, data) => F.setDoc(F.doc(db, name, id), data),
      updateDoc: (name, id, data) => F.updateDoc(F.doc(db, name, id), data),
      deleteDoc: (name, id) => remove(name, id),
      async getDoc(name, id) { const d = await F.getDoc(F.doc(db, name, id)); return d.exists() ? row(d) : null; },

      // ----- 推播通知 -----
      // 每支手機開啟通知後會拿到一組「裝置代碼」，存進 push_tokens/{代碼} = { uid }。
      // 伺服器端的程式（functions/index.js）依這張表決定要通知哪些手機。
      // 回傳：unconfigured 沒設定金鑰｜unsupported 這個環境不支援｜denied 被系統封鎖｜on 已開啟｜off 未開啟
      pushState() {
        if (!cfg.vapidKey) return 'unconfigured';
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
        if (Notification.permission === 'denied') return 'denied';
        return Notification.permission === 'granted' && savedToken() ? 'on' : 'off';
      },
      // 必須在使用者按下按鈕的當下呼叫，iPhone 才會跳出詢問
      async enablePush() {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return permission;
        await registerToken();
        return 'granted';
      },
      // 每次開啟 App 時更新一次代碼（代碼偶爾會換）
      async refreshPush() {
        if (this.pushState() === 'on') await registerToken();
      },
      async disablePush() {
        const token = savedToken();
        saveToken('');
        if (!token) return;
        try { await F.deleteDoc(F.doc(db, 'push_tokens', token)); } catch (e) { console.warn(e); }
        try { await F.deleteToken(F.getMessaging(app)); } catch (e) { console.warn(e); }
      }
    };

    function savedToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
    function saveToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 忽略 */ } }
    async function registerToken() {
      const registration = await navigator.serviceWorker.ready;
      const token = await F.getToken(F.getMessaging(app), { vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration });
      const old = savedToken();
      await F.setDoc(F.doc(db, 'push_tokens', token), { uid: uid(), updated_at: Date.now() });
      if (old && old !== token) { try { await F.deleteDoc(F.doc(db, 'push_tokens', old)); } catch (e) { console.warn(e); } }
      saveToken(token);
    }
  }

  // ---------- 示範模式（localStorage） ----------
  function demoApi() {
    const KEY = 'family-demo-v1';
    const members = [
      { id: 'm1', display_name: '爸爸', color: '#2F6FDE', sort: 1, admin: true },
      { id: 'm2', display_name: '媽媽', color: '#C2478B', sort: 2 },
      { id: 'm3', display_name: '姊姊', color: '#E67E00', sort: 3, child: true },
      { id: 'm4', display_name: '弟弟', color: '#1F8A5F', sort: 4, child: true }
    ];
    const day = (offset) => {
      const d = new Date(); d.setDate(d.getDate() + offset);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    const ago = (min) => Date.now() - min * 60000;
    const seed = () => ({
      user: null,
      events: [
        { id: 's1', title: '數學補習', category: 'schedule', event_date: day(0), end_date: day(0), start_time: '18:30', end_time: '19:30', member_ids: ['m3'], note: null },
        { id: 's2', title: '數學段考', category: 'exam', event_date: day(5), end_date: day(6), start_time: null, end_time: null, member_ids: ['m3'], note: '範圍：第三、四章' },
        { id: 's3', title: '阿嬤家吃飯', category: 'family', event_date: day(2), end_date: day(2), start_time: '12:00', end_time: null, member_ids: [], note: '記得帶水果', created_by: 'm2' },
        { id: 's4', title: '英文單字小考', category: 'exam', event_date: day(3), end_date: day(3), start_time: null, end_time: null, member_ids: ['m4'], note: 'Unit 5' },
        { id: 's5', title: '牙醫回診', category: 'other', event_date: day(9), end_date: day(9), start_time: '16:00', end_time: null, member_ids: ['m2', 'm4'], note: null }
      ],
      notes: [
        { id: 'n1', title: 'Wi-Fi 密碼', body: '客廳：home-5G\n密碼寫在冰箱上的便條', pinned: true, updated_at: ago(60 * 30), updated_by: 'm1' },
        { id: 'n2', title: '週末採買', body: '牛奶、雞蛋、吐司\n洗衣精\n弟弟的美術用品', pinned: false, updated_at: ago(90), updated_by: 'm2' }
      ],
      messages: [
        { id: 'g1', text: '今天晚餐吃什麼？', sender: 'm3', sent_at: ago(42) },
        { id: 'g2', text: '咖哩飯，六點半開飯', sender: 'm2', sent_at: ago(40) },
        { id: 'g3', text: '我鋼琴課下課會晚一點', sender: 'm3', sent_at: ago(38) }
      ],
      posts: [
        { id: 'p1', text: '這學期的成績單發了嗎？拿給我簽名。', author: 'm1', to: ['m3', 'm4'], created_at: ago(60 * 5) },
        { id: 'p2', text: '水費單在鞋櫃上，這週五前要繳。', author: 'm2', to: ['m1'], created_at: ago(50) }
      ],
      replies: [
        { id: 'r1', post_id: 'p1', text: '發了，放在你書桌上。', author: 'm3', created_at: ago(60 * 4) }
      ],
      ledger: [
        { id: 'l1', kid: 'm3', type: 'income', amount: 800, note: '這個月零用錢', date: day(0).slice(0, 8) + '01' },
        { id: 'l2', kid: 'm3', type: 'expense', amount: 65, note: '珍珠奶茶', date: day(-2) },
        { id: 'l3', kid: 'm3', type: 'expense', amount: 180, note: '文具', date: day(-1) },
        { id: 'l6', kid: 'm3', type: 'expense', amount: 450, note: '運動鞋', date: day(-1), by_parent: true },
        { id: 'l4', kid: 'm4', type: 'income', amount: 600, note: '這個月零用錢', date: day(0).slice(0, 8) + '01' },
        { id: 'l5', kid: 'm4', type: 'expense', amount: 120, note: '卡牌', date: day(-1) }
      ],
      categories: [
        { id: 'k1', label: '社團', color: '#0E7C86', created_at: 1 }
      ],
      requests: [
        { id: 'q1', kid: 'm3', title: '學校舞會', amount: 1500, need_date: day(6), status: 'pending', given_by: null, given_at: null },
        { id: 'q2', kid: 'm4', title: '校外教學費', amount: 350, need_date: day(-3), status: 'given', given_by: 'm2', given_at: ago(60 * 80), given_amount: 300 }
      ],
      profiles: {
        m1: { id: 'm1', birthday: '1980-03-12', phone: '0912-000-111', org: '', note: '' },
        m3: { id: 'm3', birthday: day(4).replace(/^\d+/, '2013'), phone: '', org: '國中二年級', note: '' }
      },
      presence: {
        m2: { id: 'm2', last_seen: ago(0), online: true, read_at: ago(0) },
        m3: { id: 'm3', last_seen: ago(25), online: false, read_at: ago(39) },
        m4: { id: 'm4', last_seen: ago(60 * 20), online: false }
      }
    });
    let mem = null;
    const load = () => {
      if (mem) return mem;
      try { mem = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 無法使用儲存空間時只留在記憶體 */ }
      const fresh = seed();
      if (!mem) mem = fresh;
      Object.keys(fresh).forEach((k) => { if (mem[k] === undefined) mem[k] = fresh[k]; });
      return mem;
    };
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* 同上 */ } };
    const upsert = (key, id, data, prefix) => {
      const db = load();
      const item = { ...data, id: id || prefix + Date.now() + Math.floor(Math.random() * 1000) };
      const i = db[key].findIndex((x) => x.id === item.id);
      if (i >= 0) db[key][i] = item; else db[key].push(item);
      persist();
      return item;
    };
    const drop = (key, id) => { const db = load(); db[key] = db[key].filter((x) => x.id !== id); persist(); };

    // 通用讀寫用的示範資料
    const seedDocs = () => ({
      shopping: [
        { id: 'sh1', text: '牛奶', done: false, added_by: 'm2', done_by: null, created_at: ago(120) },
        { id: 'sh2', text: '衛生紙', done: false, added_by: 'm1', done_by: null, created_at: ago(100) },
        { id: 'sh3', text: '雞蛋', done: true, added_by: 'm2', done_by: 'm1', created_at: ago(300) }
      ],
      polls: [
        { id: 'po1', question: '今天誰回家吃晚餐？', options: ['回家吃', '不回家吃', '會晚一點'], author: 'm2', created_at: ago(90), closed: false }
      ],
      poll_votes: [
        { id: 'po1_m2', poll_id: 'po1', uid: 'm2', choice: 0, voted_at: ago(89) },
        { id: 'po1_m3', poll_id: 'po1', uid: 'm3', choice: 2, voted_at: ago(60) }
      ],
      cards: [
        { id: 'ca1', title: '緊急聯絡', member: '', body: '阿嬤家：02-2345-6789\n社區管理室：02-2222-3333', updated_at: ago(600) },
        { id: 'ca2', title: '學校資料', member: 'm3', body: '學號：1130456\n班級：二年三班 12 號\n導師：王老師 0912-345-678', updated_at: ago(500) }
      ],
      subjects: [
        { id: 'su1', label: '國文', created_at: 1 }, { id: 'su2', label: '英文', created_at: 2 }, { id: 'su3', label: '數學', created_at: 3 }
      ],
      scores: [
        { id: 'sc1', kid: 'm3', subject: '數學', term: '國二上', title: '第一次段考', date: day(-40), score: 78, full: 100, note: '' },
        { id: 'sc2', kid: 'm3', subject: '數學', term: '國二上', title: '第二次段考', date: day(-5), score: 86, full: 100, note: '應用題進步了' },
        { id: 'sc3', kid: 'm3', subject: '英文', term: '國二上', title: '第二次段考', date: day(-5), score: 92, full: 100, note: '' },
        { id: 'sc4', kid: 'm3', subject: '國文', title: '第二次段考', date: day(-4), score: 81, full: 100, note: '' },
        { id: 'sc5', kid: 'm4', subject: '數學', title: '平時考', date: day(-3), score: 45, full: 50, note: '' }
      ],
      trips: [
        { id: 't1', title: '寒假花蓮三日遊', place: '花蓮', start_date: day(20), end_date: day(22), note: '住七星潭旁的民宿，訂位代號 HL2026', created_by: 'm1', created_at: ago(3000) },
        { id: 't2', title: '中秋宜蘭兩天一夜', place: '宜蘭', start_date: day(-52), end_date: day(-51), note: '', created_by: 'm2', created_at: ago(90000) }
      ],
      trip_items: [
        { id: 'ti1', trip_id: 't1', kind: 'plan', date: day(20), time: '08:10', title: '搭普悠瑪到花蓮', place: '台北車站', note: '車票在爸爸手機', created_at: 1 },
        { id: 'ti2', trip_id: 't1', kind: 'plan', date: day(20), time: '13:30', title: '七星潭騎腳踏車', place: '七星潭', note: '', created_at: 2 },
        { id: 'ti3', trip_id: 't1', kind: 'plan', date: day(21), time: '09:00', title: '太魯閣砂卡礑步道', place: '太魯閣國家公園', note: '帶水和帽子', created_at: 3 },
        { id: 'ti4', trip_id: 't1', kind: 'pack', text: '健保卡、身分證', done: true, done_by: 'm2', created_at: 4 },
        { id: 'ti5', trip_id: 't1', kind: 'pack', text: '充電器、行動電源', done: false, done_by: null, created_at: 5 },
        { id: 'ti6', trip_id: 't1', kind: 'pack', text: '雨衣', done: false, done_by: null, created_at: 6 },
        { id: 'ti7', trip_id: 't1', kind: 'cost', title: '民宿訂金', amount: 3000, paid_by: 'm1', date: day(-2), created_at: 7 },
        { id: 'ti8', trip_id: 't2', kind: 'journal', date: day(-52), text: '第一次看到龜山島，弟弟說像一隻在游泳的烏龜。晚上吃了蔥油餅和卜肉。', author: 'm3', created_at: 8 },
        { id: 'ti9', trip_id: 't2', kind: 'journal', date: day(-51), text: '早上泡溫泉，下午去傳藝中心。回程塞車塞了三小時。', author: 'm1', created_at: 9 },
        { id: 'ti10', trip_id: 't2', kind: 'cost', title: '住宿', amount: 4200, paid_by: 'm1', date: day(-52), created_at: 10 },
        { id: 'ti11', trip_id: 't2', kind: 'cost', title: '晚餐', amount: 1350, paid_by: 'm2', date: day(-52), created_at: 11 }
      ],
      photos: [], photo_comments: [],
      chat_images: []
    });
    const G = (name) => {
      const db = load();
      db.docs = db.docs || {};
      if (!db.docs[name]) db.docs[name] = seedDocs()[name] || [];
      return db.docs[name];
    };
    const gsubs = {};
    const gemit = (name) => (gsubs[name] || []).forEach((cb) => cb(G(name).slice()));

    // 模擬即時監聽：資料一變就通知
    const subs = { messages: [], posts: [], replies: [], presence: [], requests: [], categories: [] };
    const value = (key) => (key === 'presence' ? { ...load().presence } : load()[key].slice());
    const emit = (key) => subs[key].forEach((cb) => cb(value(key)));
    const watch = (key) => (cb) => {
      subs[key].push(cb);
      setTimeout(() => cb(value(key)), 0);
      return () => { const i = subs[key].indexOf(cb); if (i >= 0) subs[key].splice(i, 1); };
    };

    return {
      isDemo: true,
      async currentUserId() { return load().user; },
      async signIn() { load().user = 'm1'; persist(); return 'm1'; },
      async signOut() { load().user = null; persist(); },
      async reconnect() {},
      async listMembers() { const flags = load().childFlags || {}; return members.map((m) => (m.id in flags ? { ...m, child: flags[m.id] } : m)); },

      async listEvents(from, to) {
        return load().events.filter((e) => e.event_date <= to && e.end_date >= from).sort(byTime);
      },
      async saveEvent(ev) {
        const old = ev.id ? load().events.find((e) => e.id === ev.id) : null;
        const owner = old ? old.created_by : load().user;
        if (old && owner && owner !== load().user) throw new Error('permission-denied');
        return upsert('events', ev.id, { ...cleanEvent(ev), created_by: owner }, 'e');
      },
      async deleteEvent(id) { drop('events', id); },
      watchEvents() { return function () {}; },

      async listNotes() { return load().notes.slice().sort(notesOrder); },
      async saveNote(n) { return upsert('notes', n.id, cleanNote(n, load().user), 'n'); },
      async deleteNote(id) { drop('notes', id); },

      async sendMessage(text, extra) {
        upsert('messages', null, { text, ...(extra || {}), sender: load().user, sent_at: Date.now() }, 'g');
        emit('messages');
      },
      async recallMessage(id) {
        const m = load().messages.find((x) => x.id === id);
        if (!m || m.sender !== load().user || Date.now() - m.sent_at >= 3600000) throw new Error('permission-denied');
        m.text = ''; m.recalled = true; m.thumb = ''; m.image_id = ''; persist(); emit('messages');
      },
      watchMessages: watch('messages'),

      async addPost(p) {
        upsert('posts', null, { text: p.text, to: p.to, author: load().user, created_at: Date.now() }, 'p');
        emit('posts');
      },
      async deletePost(id) { drop('posts', id); emit('posts'); },
      async addReply(postId, text) {
        upsert('replies', null, { post_id: postId, text, author: load().user, created_at: Date.now() }, 'r');
        emit('replies');
      },
      watchPosts: watch('posts'),
      watchReplies: watch('replies'),

      async listProfiles() { return { ...load().profiles }; },
      async saveProfile(memberId, p) { load().profiles[memberId] = { id: memberId, ...cleanProfile(p) }; persist(); },
      async setChild(memberId, isChild) { const db = load(); db.childFlags = db.childFlags || {}; db.childFlags[memberId] = !!isChild; persist(); },

      async listLedger(onlyKid) {
        return load().ledger.filter((e) => !onlyKid || e.kid === onlyKid).sort(ledgerOrder);
      },
      async saveLedger(e) { return upsert('ledger', e.id, cleanLedger(e), 'l'); },
      async deleteLedger(id) { drop('ledger', id); },

      async addCategory(c) { upsert('categories', null, { label: c.label, color: c.color, created_at: Date.now() }, 'k'); emit('categories'); },
      async deleteCategory(id) { drop('categories', id); emit('categories'); },
      watchCategories: watch('categories'),

      async saveRequest(r) { const row = upsert('requests', r.id, cleanRequest(r), 'q'); emit('requests'); return row; },
      async deleteRequest(id) { drop('requests', id); emit('requests'); },
      watchRequests(cb, onlyKid) {
        return watch('requests')((rows) => cb(rows.filter((r) => !onlyKid || r.kid === onlyKid)));
      },

      async beat(online, readAt) {
        const db = load();
        if (!db.user) return;
        db.presence[db.user] = { id: db.user, last_seen: Date.now(), online: !!online, read_at: readAt || 0 };
        persist(); emit('presence');
      },
      watchPresence: watch('presence'),

      watchList(name, cb) {
        (gsubs[name] = gsubs[name] || []).push(cb);
        setTimeout(() => cb(G(name).slice()), 0);
        return () => { gsubs[name] = gsubs[name].filter((x) => x !== cb); };
      },
      async listDocs(name, filter) { return G(name).filter((x) => !filter || x[filter[0]] === filter[1]).slice(); },
      async addDoc(name, data) {
        const id = name.slice(0, 2) + Date.now() + Math.floor(Math.random() * 1000);
        G(name).push({ ...data, id }); persist(); gemit(name); return id;
      },
      async setDoc(name, id, data) {
        const rows = G(name); const i = rows.findIndex((x) => x.id === id);
        if (i >= 0) rows[i] = { ...data, id }; else rows.push({ ...data, id });
        persist(); gemit(name);
      },
      async updateDoc(name, id, data) {
        const item = G(name).find((x) => x.id === id);
        if (item) Object.assign(item, data);
        persist(); gemit(name);
      },
      async deleteDoc(name, id) {
        const db = load(); db.docs[name] = G(name).filter((x) => x.id !== id);
        persist(); gemit(name);
      },
      async getDoc(name, id) { return G(name).find((x) => x.id === id) || null; },

      pushState() { return 'unsupported'; },
      async enablePush() { return 'denied'; },
      async refreshPush() {},
      async disablePush() {}
    };
  }

  window.Api = isDemo ? demoApi() : firebaseApi();
})();
