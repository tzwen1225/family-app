// 資料存取層。App 只呼叫 Api.xxx，不直接碰 Firebase。
//
// 行事曆 event：{ id, title, category, event_date, end_date, start_time, end_time, member_ids, note }
//   category: 'schedule' 行程 | 'exam' 考試 | 'family' 家庭活動 | 'other' 其他
//   日期 'YYYY-MM-DD'，時間 'HH:MM' 或 null（全天）；member_ids 空陣列代表「全家」
//   每週重複的行程只存一筆，另有 repeat、repeat_days、skip_dates（見 cleanEvent）
// 雜記 note：    { id, title, body, pinned, updated_at, updated_by }
// 通訊錄 contact：{ id, name, group, phone, address, note }
// 訊息 message： { id, text, sender, sent_at }
//   updated_at、sent_at 是毫秒時間戳（Date.now()）

(function () {
  const cfg = window.FAMILY_CONFIG || {};
  const isDemo = !(cfg.firebase && cfg.firebase.apiKey);

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
  const cleanContact = (c) => ({
    name: c.name, group: c.group || '其他', phone: c.phone || '',
    address: c.address || '', note: c.note || ''
  });
  const byTime = (a, b) =>
    (a.event_date + (a.start_time || '')).localeCompare(b.event_date + (b.start_time || ''));
  const notesOrder = (a, b) => (b.pinned - a.pinned) || (b.updated_at - a.updated_at);
  const byName = (a, b) => a.name.localeCompare(b.name, 'zh-Hant');

  // ---------- Firebase（Authentication + Firestore） ----------
  // 集合：members/{UID}、events、notes、contacts、messages
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
      // 家人新增或修改行程時通知畫面重新讀取。回傳停止監聽的函式。
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

      async listContacts() { return (await list('contacts')).sort(byName); },
      saveContact: (c) => save('contacts', c.id, cleanContact(c)),
      deleteContact: (id) => remove('contacts', id),

      async sendMessage(text) {
        await F.addDoc(col('messages'), { text, sender: uid(), sent_at: Date.now() });
      },
      // 每次有新訊息就把最近 200 則整份交給 cb。回傳停止監聽的函式。
      watchMessages(cb) {
        return F.onSnapshot(
          F.query(col('messages'), F.orderBy('sent_at'), F.limitToLast(200)),
          (snap) => cb(snap.docs.map(row)),
          (err) => console.warn('聊天室即時同步中斷', err)
        );
      }
    };
  }

  // ---------- 示範模式（localStorage） ----------
  function demoApi() {
    const KEY = 'family-demo-v1';
    const members = [
      { id: 'm1', display_name: '爸爸', color: '#2F6FDE', sort: 1 },
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
      contacts: [
        { id: 'c1', name: '阿嬤', group: '親戚', phone: '02-2345-6789', address: '', note: '' },
        { id: 'c2', name: '王老師（姊姊導師）', group: '學校', phone: '0912-345-678', address: '', note: '晚上八點前可聯絡' },
        { id: 'c3', name: '陳牙醫診所', group: '醫療', phone: '02-8765-4321', address: '中山路 100 號', note: '週日休診' }
      ],
      messages: [
        { id: 'g1', text: '今天晚餐吃什麼？', sender: 'm3', sent_at: ago(42) },
        { id: 'g2', text: '咖哩飯，六點半開飯', sender: 'm2', sent_at: ago(40) },
        { id: 'g3', text: '我鋼琴課下課會晚一點', sender: 'm3', sent_at: ago(38) }
      ]
    });
    let mem = null;
    const load = () => {
      if (mem) return mem;
      try { mem = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 無法使用儲存空間時只留在記憶體 */ }
      const fresh = seed();
      if (!mem) mem = fresh;
      ['notes', 'contacts', 'messages'].forEach((k) => { if (!mem[k]) mem[k] = fresh[k]; });
      return mem;
    };
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* 同上 */ } };
    const upsert = (key, id, data, prefix) => {
      const db = load();
      const item = { ...data, id: id || prefix + Date.now() };
      const i = db[key].findIndex((x) => x.id === item.id);
      if (i >= 0) db[key][i] = item; else db[key].push(item);
      persist();
      return item;
    };
    const drop = (key, id) => { const db = load(); db[key] = db[key].filter((x) => x.id !== id); persist(); };
    const listeners = [];

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

      async listContacts() { return load().contacts.slice().sort(byName); },
      async saveContact(c) { return upsert('contacts', c.id, cleanContact(c), 'c'); },
      async deleteContact(id) { drop('contacts', id); },

      async sendMessage(text) {
        upsert('messages', null, { text, sender: load().user, sent_at: Date.now() }, 'g');
        listeners.forEach((cb) => cb(load().messages.slice()));
      },
      watchMessages(cb) {
        listeners.push(cb);
        setTimeout(() => cb(load().messages.slice()), 0);
        return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
      }
    };
  }

  window.Api = isDemo ? demoApi() : firebaseApi();
})();
