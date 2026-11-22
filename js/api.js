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
//   日常待辦 shopping：{ id, text, done, who（UID 或 '' 全家）, due（日期或 ''）, added_by, done_by, done_at, created_at }
//   投票 polls：     { id, question, options: [文字…], author, created_at, closed, deadline: 'YYYY-MM-DD' 或 '', deadline_at: 毫秒或 0 }
//        poll_votes：{ id: 投票id_UID, poll_id, uid, choice: 第幾個選項, voted_at }
//   資料卡 cards：   { id, title, member: UID 或 ''（全家）, body, updated_at }
//   成績 scores：    { id, kid: 小朋友的 UID, subject, term: '國一上'…'國三下', title, date, score, full, note }
//   旅程 trips：     { id, title, place, start_date, end_date, note }
//   旅程內容 trip_items：{ id, trip_id, kind: 'plan' 行程 | 'journal' 日誌 | 'pack' 行李 | 'cost' 花費, … }
//   相簿 photos：    { id, month: 'YYYY-MM', date, caption, thumb, image_id, author }
//        photo_comments：{ id, photo_id, month, text, author, created_at }
//   交通常用清單 transit_favs/{UID}：{ bus: [{ area, route, dir, to, uid, name }], tra: [{ id, name }] }
//   視訊 calls：{ id, from, to: [UID], status: live|ended, joined/left/declined: { UID: 時間 }, created_at, answered_at, ended_at }
//        call_signals：{ call_id, from, to, kind: offer|answer|cand, data, created_at }
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
    birthday: p.birthday || '', phone: p.phone || '', org: p.org || '', note: p.note || '', face: p.face || ''
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
      // 交通查詢：由雲端函式代查（TDX 金鑰只在伺服器上）
      // 視訊的中繼伺服器帳密（雲端函式向 Cloudflare 臨時申請）
      async callIce() {
        const fn = F.httpsCallable(F.getFunctions(app, 'asia-east1'), 'callIce');
        return (await fn({})).data;
      },
      // AI 小幫手：由雲端函式代問 Gemini（金鑰只在伺服器上）
      async ai(op, args) {
        const call = F.httpsCallable(F.getFunctions(app, 'asia-east1'), 'ai', { timeout: 170000 });
        return (await call({ op, ...(args || {}) })).data;
      },
      async transit(op, args) {
        const call = F.httpsCallable(F.getFunctions(app, 'asia-east1'), 'transit');
        return (await call({ op, ...(args || {}) })).data;
      },
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
      // id、at：App 先決定好編號和時間（沒網路時先排隊，之後用同一個編號補送，不會變成兩則）
      async sendMessage(text, extra, id, at) {
        const data = { text, ...(extra || {}), sender: uid(), sent_at: at || Date.now() };
        if (id) await F.setDoc(F.doc(db, 'messages', id), data); else await F.addDoc(col('messages'), data);
      },
      // 收回：清空內容並標記。安全規則只允許本人在送出一小時內這樣做。
      async recallMessage(id, hasImage, hasAudio) {
        await F.updateDoc(F.doc(db, 'messages', id),
          hasImage ? { text: '', recalled: true, thumb: '', image_id: '' } : hasAudio ? { text: '', recalled: true, audio_id: '' } : { text: '', recalled: true });
      },
      // 編輯：只改文字（和 @ 到誰）。安全規則只允許本人在送出 15 分鐘內這樣做。
      editMessage: (id, text, mentions) => F.updateDoc(F.doc(db, 'messages', id), { text, mentions: mentions || [], edited_at: Date.now() }),
      // 「正在輸入」：只更新自己上線狀態裡的一個欄位（0 = 沒在打字）
      typing: (on) => F.setDoc(F.doc(db, 'presence', uid()), { typing_at: on ? Date.now() : 0 }, { merge: true }),
      // 實際發一則測試推播，回報每個人登記了幾支手機、成功幾支、失敗原因
      async pushTest(all) {
        const call = F.httpsCallable(F.getFunctions(app, 'asia-east1'), 'pushTest');
        return (await call({ all: !!all })).data;
      },
      // 問雲端這個網址的標題和簡介（聊天室的連結預覽）
      async linkPreview(url) {
        const call = F.httpsCallable(F.getFunctions(app, 'asia-east1'), 'linkPreview');
        return (await call({ url })).data;
      },
      watchMessages: (cb) => watch('聊天室', F.query(col('messages'), F.orderBy('sent_at'), F.limitToLast(300)), cb),

      // 沒有標註任何人（to 是空的）= 全家都看得到，記 public: true
      async addPost(p) {
        await F.addDoc(col('posts'), { text: p.text, to: p.to, public: p.to.length === 0, author: uid(), created_at: Date.now() });
      },
      deletePost: (id) => remove('posts', id),
      editPost: (id, p) => F.updateDoc(F.doc(db, 'posts', id), { text: p.text, to: p.to, public: p.to.length === 0, edited_at: Date.now() }),
      editReply: (id, text) => F.updateDoc(F.doc(db, 'replies', id), { text, edited_at: Date.now() }),
      async addReply(postId, text) {
        await F.addDoc(col('replies'), { post_id: postId, text, author: uid(), created_at: Date.now() });
      },
      // 只讀得到「全家的」「我發的」「有標註我的」三種，分三個查詢再合起來（安全規則只放行這三種）
      watchPosts(cb) {
        const me = uid(), parts = [[], [], []];
        const send = () => {
          const all = new Map();
          parts.forEach((list) => list.forEach((p) => all.set(p.id, p)));
          cb(Array.from(all.values()).sort((a, b) => a.created_at - b.created_at));
        };
        const offs = [F.where('public', '==', true), F.where('author', '==', me), F.where('to', 'array-contains', me)]
          .map((w, i) => F.onSnapshot(F.query(col('posts'), w), (snap) => { parts[i] = snap.docs.map(row); send(); },
            (err) => console.warn('我有話要說即時同步中斷', err)));
        return () => offs.forEach((off) => off());
      },

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
      // 只看某個欄位等於某個值的（例如小朋友只讀自己新增的資料卡；安全規則要求查詢本身就帶這個條件）
      watchWhere: (name, field, value, cb) => watch(name, F.query(col(name), F.where(field, '==', value)), cb),
      // 陣列欄位裡有這個值的（例如影片的「給誰看」）
      watchHas: (name, field, value, cb) => watch(name, F.query(col(name), F.where(field, 'array-contains', value)), cb),
      // 問雲端這個 YouTube 影片的標題、頻道，以及能不能嵌入播放
      async videoInfo(id) {
        const call = F.httpsCallable(F.getFunctions(app, 'asia-east1'), 'videoInfo');
        return (await call({ id })).data;
      },
      // 讀一次清單；filter 是 [欄位, 值]，只讀符合的（小朋友讀自己的資料時一定要帶，否則會被安全規則擋下）
      listDocs: (name, filter) => (filter ? list(name, F.where(filter[0], '==', filter[1])) : list(name)),
      async addDoc(name, data) { return (await F.addDoc(col(name), data)).id; },
      setDoc: (name, id, data) => F.setDoc(F.doc(db, name, id), data),
      updateDoc: (name, id, data) => F.updateDoc(F.doc(db, name, id), data),
      deleteDoc: (name, id) => remove(name, id),
      async getDoc(name, id) { const d = await F.getDoc(F.doc(db, name, id)); return d.exists() ? row(d) : null; },
      // 不會再改的資料（例如照片原圖）：手機快取裡有就直接用，不等網路
      async getDocCached(name, id) {
        try { const c = await F.getDocFromCache(F.doc(db, name, id)); if (c.exists()) return row(c); } catch (e) { /* 快取裡沒有 */ }
        return this.getDoc(name, id);
      },

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
      // 測試用：這個分頁指定以哪個人登入（見 signIn）
      try { const as = sessionStorage.getItem('family-demo-as'); if (as && mem.user) mem.user = as; } catch (e) { /* 沒有 sessionStorage */ }
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
      study_items: [
        { id: 'st1', kid: 'm3', sub: '數學', title: '第三章 例題', note: '課本 p.38–44', date: day(-2), minutes: 40, done: true, spent: 42, exam_id: '', created_by: 'm3', created_at: ago(4000) },
        { id: 'st2', kid: 'm3', sub: '英文', title: 'Unit 5 課文', note: '唸三遍', date: day(-2), minutes: 30, done: true, spent: 30, exam_id: '', created_by: 'm3', created_at: ago(4000) },
        { id: 'st3', kid: 'm3', sub: '國文', title: '第六課 注釋', note: '', date: day(-1), minutes: 30, done: true, spent: 25, exam_id: '', created_by: 'm3', created_at: ago(3000) },
        { id: 'st4', kid: 'm3', sub: '自然', title: '第四章 實驗', note: '整理步驟', date: day(-1), minutes: 30, done: false, spent: 0, exam_id: '', created_by: 'm3', created_at: ago(3000) },
        { id: 'st5', kid: 'm3', sub: '數學', title: '第三章 習題', note: '課本 p.45–52', date: day(0), minutes: 30, done: true, spent: 34, exam_id: '', created_by: 'm3', created_at: ago(900) },
        { id: 'st6', kid: 'm3', sub: '英文', title: 'Unit 5 單字', note: '20 個，唸三遍再默寫', date: day(0), minutes: 20, done: false, spent: 0, exam_id: '', created_by: 'm3', created_at: ago(900) },
        { id: 'st7', kid: 'm3', sub: '自然', title: '第四章 重點筆記', note: '整理成一頁', date: day(0), minutes: 40, done: false, spent: 0, exam_id: '', created_by: 'm2', created_at: ago(800) },
        { id: 'st8', kid: 'm3', sub: '社會', title: '第五課 地圖', note: '', date: day(1), minutes: 30, done: false, spent: 0, exam_id: '', created_by: 'm3', created_at: ago(700) },
        { id: 'st9', kid: 'm4', sub: '數學', title: '分數乘法練習', note: '習作 p.20', date: day(-1), minutes: 30, done: false, spent: 0, exam_id: '', created_by: 'm4', created_at: ago(3000) },
        { id: 'st10', kid: 'm4', sub: '英文', title: '字母拼讀', note: '', date: day(0), minutes: 20, done: false, spent: 0, exam_id: '', created_by: 'm4', created_at: ago(900) }
      ],
      videos: [
        { id: 'v1', yt_id: 'aaaaaaaaaa1', title: '光合作用是怎麼運作的？', channel: '示範科學頻道', duration: 492, cat: '科學', note: '自然第四章的補充，看完跟我說葉綠體在做什麼', to: ['m3', 'm4'], status: 'ok', added_by: 'm2', created_at: ago(200) },
        { id: 'v2', yt_id: 'aaaaaaaaaa2', title: 'Unit 5 單字發音練習', channel: '示範英文頻道', duration: 725, cat: '英文', note: '跟著唸兩遍', to: ['m3'], status: 'ok', added_by: 'm1', created_at: ago(900) },
        { id: 'v3', yt_id: 'aaaaaaaaaa3', title: '火山爆發小實驗', channel: '示範實驗頻道', duration: 920, cat: '科學', note: '', reason: '同學說這個實驗很酷', to: ['m4'], status: 'pending', requested_by: 'm4', added_by: 'm4', created_at: ago(60) }
      ],
      video_views: [
        { id: 'v2_m3_' + day(0), video_id: 'v2', kid: 'm3', date: day(0), seconds: 360, finished: false, title: 'Unit 5 單字發音練習', at: ago(40) }
      ],
      video_limits: [{ id: 'm3', minutes: 60 }, { id: 'm4', minutes: 40 }],
      checkins: [
        { id: 'ci1', kid: 'm3', kind: 'school', text: '我到學校了', note: '', at: ago(300), date: day(0), lat: 24.80395, lng: 120.97148, acc: 18, place: '東區' },
        { id: 'ci2', kid: 'm4', kind: 'bus', text: '我上車了', note: '今天坐 2 號公車', at: ago(55), date: day(0), lat: 24.80158, lng: 120.97166, acc: 25, place: '東區' },
        { id: 'ci3', kid: 'm4', kind: 'school', text: '我到學校了', note: '', at: ago(310), date: day(0) }
      ],
      places: [{ id: 'pl1', name: '學校', lat: 24.8040, lng: 120.9715 }],
      notifications: [
        { id: 'nt1', uid: 'm1', title: '弟弟：我上車了', body: '在「東區」附近・點開看地圖', tag: 'checkin-m4', kind: 'checkin', at: ago(55) },
        { id: 'nt2', uid: 'm1', title: '投票結束：晚上吃什麼', body: '火鍋（3 票）', tag: 'poll-x', kind: 'poll', at: ago(400) },
        { id: 'nt3', uid: 'm3', title: '1 小時後：鋼琴課', body: '16:00 開始', tag: 'event-x', kind: 'cal', at: ago(90) }
      ],
      study_cheers: [
        { id: 'sc1', kid: 'm3', from: 'm2', kind: 'like', text: '數學習題都寫完了，很棒！', date: day(0), created_at: ago(30) }
      ],
      shopping: [
        { id: 'sh1', text: '倒垃圾', note: '垃圾車 19:30 到巷口', repeat: 'daily', done: false, who: 'm4', due: day(0), added_by: 'm2', done_by: null, created_at: ago(120) },
        { id: 'sh2', text: '繳第四台費用', star: true, done: false, who: 'm1', due: day(-1), added_by: 'm2', done_by: null, created_at: ago(100) },
        { id: 'sh3', text: '買衛生紙', done: false, who: '', due: '', added_by: 'm1', done_by: null, created_at: ago(90) },
        { id: 'sh4', text: '準備校外教學的便當袋', done: false, who: 'm3', due: day(3), added_by: 'm2', done_by: null, created_at: ago(80) },
        { id: 'sh5', text: '收衣服', done: true, who: '', due: day(0), added_by: 'm2', done_by: 'm3', done_at: ago(30), created_at: ago(300) }
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
      photos: [], photo_comments: [], photo_likes: [], albums: [], album_months: [],
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
    // 另一個分頁改了資料（示範模式下用兩個分頁測試視訊）：讀回最新的，通知畫面
    const freshDocs = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.docs && mem) mem.docs = d.docs; } catch (e) { /* 讀不到就用手上的 */ } };
    window.addEventListener('storage', (e) => { if (e.key !== KEY || !mem) return; freshDocs(); Object.keys(gsubs).forEach(gemit); });

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
      // 示範模式預設是 m1；測試時可以用 sessionStorage 的 family-demo-as 指定成別人（每個分頁各自一個人）
      async signIn() { const as = (() => { try { return sessionStorage.getItem('family-demo-as'); } catch (e) { return null; } })() || 'm1'; load().user = as; persist(); return as; },
      async callIce() { return { iceServers: [] }; },
      async signOut() { load().user = null; persist(); },
      async reconnect() {},
      // 示範用的假 AI：不會連到任何地方，只回固定格式的內容
      async ai(op, args) {
        await new Promise((r) => setTimeout(r, 300));
        const pad = (n) => String(n).padStart(2, '0');
        const day = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        if (op === 'event') {
          const d = new Date(); d.setDate(d.getDate() + 1);
          const weekly = /每週|每周/.test(args.text);
          const end = new Date(d); if (weekly) end.setMonth(end.getMonth() + 3);
          return {
            title: args.text.replace(/^(明天|後天|每週.|每周.)/, '').slice(0, 30) || args.text, date: day(d), end_date: day(end),
            start_time: /晚上/.test(args.text) ? '19:00' : null, end_time: null, weekly, weekdays: weekly ? [d.getDay()] : [],
            members: (args.members || []).filter((n) => args.text.includes(n)), category: (args.categories || [])[0] || '', note: ''
          };
        }
        if (op === 'trip') {
          const days = [];
          for (let d = new Date(args.start_date + 'T00:00'); day(d) <= args.end_date; d.setDate(d.getDate() + 1)) {
            days.push({ date: day(d), theme: '示範主題', items: [
              { time: '09:30', title: '示範景點', place: (args.place || '') + '老街', note: '出發前請確認', cat: 'sight', minutes: 90, booking: true },
              { time: '12:00', title: '午餐', place: '在地小吃', note: '', transport: '步行約 10 分鐘', shops: ['示範麵店', '示範冰店'], cat: 'food', minutes: 60 },
              { time: '14:30', title: '示範步道', place: '', note: '' }] });
          }
          return { days, tips: ['示範提醒：交通票券先買好', '示範提醒：下雨改去室內景點'] };
        }
        if (op === 'butler') { const c = JSON.parse(args.context); return { answer: '（示範）你問的是「' + args.question + '」。\n' + (c.calendar_未來14天行程 ? '這次送出的紀錄有：行程 ' + c.calendar_未來14天行程.length + ' 筆、待辦 ' + c.todos_還沒做的待辦.length + ' 筆、成績 ' + Object.keys(c.scores_成績).join('、') + '。' : '這一題沒有附上家庭紀錄。') + '\n接上 Gemini 之後，這裡會是真正的回答。', sources: /考|成績/.test(args.question) ? ['scores'] : /零用錢/.test(args.question) ? ['ledger'] : c.calendar_未來14天行程 ? ['calendar', 'todos'] : [], queries: /天氣/.test(args.question) ? ['新竹 天氣'] : [], links: /天氣/.test(args.question) ? [{ url: 'https://www.cwa.gov.tw/', title: 'cwa.gov.tw' }] : [] }; }
        if (op === 'study') {
          const items = [];
          for (let d = new Date(args.start_date + 'T00:00'), i = 0; day(d) < args.exam_date && i < 10; d.setDate(d.getDate() + 1), i++) {
            items.push({ date: day(d), sub: args.subjects[i % 2 ? 2 : 1] || args.subjects[0], title: i % 2 ? '示範：單字複習' : '示範：例題練習', note: '錯的抄到訂正本', minutes: 30 });
            if (i % 3 === 0) items.push({ date: day(d), sub: args.subjects[3] || args.subjects[0], title: '示範：重點整理', note: '', minutes: 20 });
          }
          return { items, tips: ['示範提醒：考前一天早點睡'] };
        }
        if (op === 'caption') return { captions: [(args.events && args.events[0] ? args.events[0] + '的一天' : '平凡又開心的一天') + ' 😊', '（示範）' + (args.people && args.people.length ? args.people.join('、') + '的合照' : '全家的回憶'), '（示範）這天值得記下來'] };
        if (op === 'journal') return { text: '（示範）今天' + (args.place ? '在' + args.place : '') + '玩得很開心！' + args.text.replace(/\n/g, '、') + '，每一件事都想記下來。\n\n接上 Gemini 之後，這裡會是一段完整的日記。' };
        if (op === 'analyze') return { text: '（示範）' + args.name + '的' + (args.kind === 'scores' ? '成績' : '零用錢') + '說明會出現在這裡。\n\n接上 Gemini 之後，這裡會是根據實際紀錄寫出的幾段文字。' };
        throw new Error('op');
      },
      // 示範用的假資料：時間會跟著現在的時刻變
      async transit(op, args) {
        await new Promise((r) => setTimeout(r, 150));
        const eta = (i) => (i % 7 === 6 ? { status: 'last-gone' } : i % 5 === 4 ? { status: 'not-yet', next: '18:40' } : { status: 'coming', seconds: 40 + ((i * 197 + Math.floor(Date.now() / 30000) * 60) % 1500), plate: 'EAL-0' + (10 + i) });
        const names = ['新竹火車站', '東門市場', '新竹高中', '清華大學', '光復中學', '科學園區', '金山街', '關新路口', '竹科實中', '新莊車站'];
        if (op === 'searchRoutes') {
          const all = [
            { area: 'Hsinchu', areaName: '新竹市', name: '藍線', from: '新竹火車站', to: '竹中' },
            { area: 'Hsinchu', areaName: '新竹市', name: '藍線1區', from: '新竹火車站', to: '古奇峰' },
            { area: 'Hsinchu', areaName: '新竹市', name: '1', from: '新竹火車站', to: '竹中' },
            { area: 'HsinchuCounty', areaName: '新竹縣', name: '快捷1號', from: '竹北高中', to: '高鐵新竹站' },
            { area: 'InterCity', areaName: '客運', name: '5608', from: '新竹', to: '下公館' }
          ];
          return { routes: all.filter((r) => r.name.includes(args.q)) };
        }
        if (op === 'route') {
          const mk = (dir, list) => ({ dir, to: list[list.length - 1], stops: list.map((n, i) => ({ uid: 'S' + dir + i, name: n, eta: eta(i + dir) })) });
          return { area: args.area, areaName: { Hsinchu: '新竹市', HsinchuCounty: '新竹縣', InterCity: '客運' }[args.area], name: args.name, dirs: [mk(0, names), mk(1, names.slice().reverse())] };
        }
        if (op === 'etas') return { etas: args.items.map((x, i) => eta(i)) };
        if (op === 'traStations') return { stations: [['1210', '新竹'], ['1190', '北新竹'], ['1180', '竹北'], ['1203', '竹東'], ['1000', '臺北'], ['1250', '竹南']].map(([id, name]) => ({ id, name })) };
        if (op === 'tra') {
          const now = new Date(); const hm = (m) => { const d = new Date(now.getTime() + m * 60000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
          return { trains: [[4, '區間', '1234', '基隆', 0], [11, '自強', '128', '七堵', 6], [19, '區間快', '2012', '后里', 0], [27, '區間', '1187', '竹南', 2], [41, '莒光', '521', '潮州', null], [75, '區間', '1215', '內灣', null]].map(([m, type, no, to, delay], i) => ({ time: hm(m), type, no, to, delay, dir: i % 2 })) };
        }
        throw new Error('op');
      },
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

      async sendMessage(text, extra, id, at) {
        if (window.__demoOffline) throw new Error('unavailable');
        upsert('messages', id || null, { text, ...(extra || {}), sender: load().user, sent_at: at || Date.now() }, 'g');
        emit('messages');
      },
      async recallMessage(id) {
        const m = load().messages.find((x) => x.id === id);
        if (!m || m.sender !== load().user || Date.now() - m.sent_at >= 3600000) throw new Error('permission-denied');
        m.text = ''; m.recalled = true; m.thumb = ''; m.image_id = ''; m.audio_id = ''; persist(); emit('messages');
      },
      async editMessage(id, text, mentions) {
        const m = load().messages.find((x) => x.id === id);
        if (!m || m.sender !== load().user || m.recalled || Date.now() - m.sent_at >= 900000) throw new Error('permission-denied');
        m.text = text; m.mentions = mentions || []; m.edited_at = Date.now(); persist(); emit('messages');
      },
      async typing(on) {
        const db = load();
        if (!db.user) return;
        db.presence[db.user] = { ...(db.presence[db.user] || { id: db.user }), typing_at: on ? Date.now() : 0 };
        persist(); emit('presence');
      },
      async pushTest(all) {
        await new Promise((r) => setTimeout(r, 300));
        const rows = [{ uid: 'm1', name: '爸爸', tokens: 1, ok: 1, errors: [], newest: Date.now() - 3600000 }, { uid: 'm2', name: '媽媽', tokens: 0, ok: 0, errors: [] }, { uid: 'm3', name: '姊姊', tokens: 2, ok: 1, errors: ['messaging/registration-token-not-registered'], newest: Date.now() - 20 * 86400000 }, { uid: 'm4', name: '弟弟', tokens: 1, ok: 0, errors: ['messaging/third-party-auth-error'] }];
        return { results: all ? rows : rows.slice(0, 1), at: Date.now() };
      },
      async linkPreview(url) {
        await new Promise((r) => setTimeout(r, 200));
        const host = url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
        return /fail/.test(url) ? { ok: false } : { ok: true, title: '示範網頁：' + host, desc: '這是示範模式的連結預覽，正式環境會顯示網頁的標題和簡介。', site: host };
      },
      watchMessages: watch('messages'),

      async addPost(p) {
        upsert('posts', null, { text: p.text, to: p.to, public: p.to.length === 0, author: load().user, created_at: Date.now() }, 'p');
        emit('posts');
      },
      async deletePost(id) { drop('posts', id); emit('posts'); },
      async editPost(id, p) { const old = load().posts.find((x) => x.id === id); upsert('posts', id, { ...old, text: p.text, to: p.to, public: p.to.length === 0, edited_at: Date.now() }); emit('posts'); },
      async editReply(id, text) { const old = load().replies.find((x) => x.id === id); upsert('replies', id, { ...old, text, edited_at: Date.now() }); emit('replies'); },
      async addReply(postId, text) {
        upsert('replies', null, { post_id: postId, text, author: load().user, created_at: Date.now() }, 'r');
        emit('replies');
      },
      // 示範模式也照正式版的規則：只看得到全家的、自己發的、有標註自己的
      watchPosts: (cb) => watch('posts')((list) => { const me = load().user; cb(list.filter((p) => p.public || p.to.length === 0 || p.author === me || p.to.includes(me))); }),

      async listProfiles() { return { ...load().profiles }; },
      async saveProfile(memberId, p) { load().profiles[memberId] = { id: memberId, ...cleanProfile(p) }; persist(); },
      async setChild(memberId, isChild) { const db = load(); db.childFlags = db.childFlags || {}; db.childFlags[memberId] = !!isChild; persist(); },

      async listLedger(onlyKid) {
        return load().ledger.filter((e) => !onlyKid || e.kid === onlyKid).sort(ledgerOrder);
      },
      async saveLedger(e) { const old = e.id && load().ledger.find((x) => x.id === e.id); return upsert('ledger', e.id, { ...cleanLedger(e), created_at: old ? old.created_at : Date.now() }, 'l'); },
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
      watchHas(name, field, value, cb) { return this.watchList(name, (list) => cb(list.filter((x) => (x[field] || []).includes(value)))); },
      async videoInfo(id) {
        await new Promise((r) => setTimeout(r, 300));
        if (/^x/.test(id)) return { ok: false, reason: 'no-embed' };
        return { ok: true, title: '示範影片 ' + id.slice(0, 4), channel: '示範頻道' };
      },
      watchWhere(name, field, value, cb) {
        if (subs[name]) return watch(name)((list) => cb(list.filter((x) => x[field] === value)));   // 回覆、訊息這幾種是另外存的
        return this.watchList(name, (list) => cb(list.filter((x) => x[field] === value)));
      },
      async listDocs(name, filter) { return G(name).filter((x) => !filter || x[filter[0]] === filter[1]).slice(); },
      async addDoc(name, data) {
        freshDocs();
        const id = name.slice(0, 2) + Date.now() + Math.floor(Math.random() * 1000);
        G(name).push({ ...data, id }); persist(); gemit(name); return id;
      },
      async setDoc(name, id, data) {
        freshDocs();
        const rows = G(name); const i = rows.findIndex((x) => x.id === id);
        if (i >= 0) rows[i] = { ...data, id }; else rows.push({ ...data, id });
        persist(); gemit(name);
      },
      async updateDoc(name, id, data) {
        freshDocs();
        const item = G(name).find((x) => x.id === id);
        // 跟 Firestore 一樣支援 'joined.m1' 這種只改一個欄位底下某一項的寫法
        if (item) Object.entries(data).forEach(([k, v]) => {
          const path = k.split('.');
          let o = item;
          path.slice(0, -1).forEach((p) => { o[p] = o[p] && typeof o[p] === 'object' ? o[p] : {}; o = o[p]; });
          o[path[path.length - 1]] = v;
        });
        persist(); gemit(name);
      },
      async deleteDoc(name, id) {
        freshDocs();
        const db = load(); db.docs[name] = G(name).filter((x) => x.id !== id);
        persist(); gemit(name);
      },
      async getDoc(name, id) { return G(name).find((x) => x.id === id) || null; },
      getDocCached(name, id) { return this.getDoc(name, id); },

      pushState() { return 'unsupported'; },
      async enablePush() { return 'denied'; },
      async refreshPush() {},
      async disablePush() {}
    };
  }

  window.Api = isDemo ? demoApi() : firebaseApi();
})();
