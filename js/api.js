// 資料存取層。App 只呼叫 Api.xxx，不直接碰 Firebase。
//
// 行事曆 event：{ id, title, category, event_date, end_date, start_time, end_time, member_ids, note }
//   category: 'schedule' 行程 | 'exam' 考試 | 'family' 家庭活動 | 'other' 其他
//   日期 'YYYY-MM-DD'，時間 'HH:MM' 或 null（全天）；member_ids 空陣列代表「全家」
//   每週重複的行程只存一筆，另有 repeat、repeat_days、skip_dates（見 cleanEvent）
// 雜記 note：     { id, title, body, pinned, updated_at, updated_by }
// 訊息 message：  { id, text, sender, sent_at, recalled }
// 我有話要說 post：{ id, text, author, to: [UID…], created_at }
//   回覆 reply：  { id, post_id, text, author, created_at }
// 基本資料 profile：{ id: UID, birthday, phone, org, note }
// 上線狀態 presence：{ id: UID, last_seen, online }
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
    const db = F.getFirestore(app);
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

      async sendMessage(text) {
        await F.addDoc(col('messages'), { text, sender: uid(), sent_at: Date.now() });
      },
      // 收回：清空內容並標記。安全規則只允許本人在送出一小時內這樣做。
      async recallMessage(id) {
        await F.updateDoc(F.doc(db, 'messages', id), { text: '', recalled: true });
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

      async beat(online) {
        await F.setDoc(F.doc(db, 'presence', uid()), { last_seen: Date.now(), online: !!online });
      },
      watchPresence: (cb) => watch('上線狀態', col('presence'), (rows) => cb(toMap(rows))),

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
      { id: 'm3', display_name: '姊姊', color: '#E67E00', sort: 3 },
      { id: 'm4', display_name: '弟弟', color: '#1F8A5F', sort: 4 }
    ];
    const day = (offset) => {
      const d = new Date(); d.setDate(d.getDate() + offset);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    const ago = (min) => Date.now() - min * 60000;
    const seed = () => ({
      user: null,
      events: [
        { id: 's1', title: '鋼琴課', category: 'schedule', event_date: day(0), end_date: day(0), start_time: '18:30', end_time: '19:30', member_ids: ['m3'], note: null },
        { id: 's2', title: '數學段考', category: 'exam', event_date: day(5), end_date: day(6), start_time: null, end_time: null, member_ids: ['m3'], note: '範圍：第三、四章' },
        { id: 's3', title: '阿嬤家吃飯', category: 'family', event_date: day(2), end_date: day(2), start_time: '12:00', end_time: null, member_ids: [], note: null },
        { id: 's4', title: '英文單字小考', category: 'exam', event_date: day(3), end_date: day(3), start_time: null, end_time: null, member_ids: ['m4'], note: 'Unit 5' },
        { id: 's5', title: '牙醫回診', category: 'schedule', event_date: day(9), end_date: day(9), start_time: '16:00', end_time: null, member_ids: ['m2', 'm4'], note: null }
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
      profiles: {
        m1: { id: 'm1', birthday: '1980-03-12', phone: '0912-000-111', org: '', note: '' },
        m3: { id: 'm3', birthday: day(4).replace(/^\d+/, '2013'), phone: '', org: '國中二年級', note: '' }
      },
      presence: {
        m2: { id: 'm2', last_seen: ago(0), online: true },
        m3: { id: 'm3', last_seen: ago(25), online: false },
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

    // 模擬即時監聽：資料一變就通知
    const subs = { messages: [], posts: [], replies: [], presence: [] };
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
      async listMembers() { return members; },

      async listEvents(from, to) {
        return load().events.filter((e) => e.event_date <= to && e.end_date >= from).sort(byTime);
      },
      async saveEvent(ev) { return upsert('events', ev.id, cleanEvent(ev), 'e'); },
      async deleteEvent(id) { drop('events', id); },
      watchEvents() { return function () {}; },

      async listNotes() { return load().notes.slice().sort(notesOrder); },
      async saveNote(n) { return upsert('notes', n.id, cleanNote(n, load().user), 'n'); },
      async deleteNote(id) { drop('notes', id); },

      async sendMessage(text) {
        upsert('messages', null, { text, sender: load().user, sent_at: Date.now() }, 'g');
        emit('messages');
      },
      async recallMessage(id) {
        const m = load().messages.find((x) => x.id === id);
        if (!m || m.sender !== load().user || Date.now() - m.sent_at >= 3600000) throw new Error('permission-denied');
        m.text = ''; m.recalled = true; persist(); emit('messages');
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

      async beat(online) {
        const db = load();
        if (!db.user) return;
        db.presence[db.user] = { id: db.user, last_seen: Date.now(), online: !!online };
        persist(); emit('presence');
      },
      watchPresence: watch('presence'),

      pushState() { return 'unsupported'; },
      async enablePush() { return 'denied'; },
      async refreshPush() {},
      async disablePush() {}
    };
  }

  window.Api = isDemo ? demoApi() : firebaseApi();
})();
