// 資料存取層。App 只呼叫 Api.xxx，不直接碰 Firebase，
// 之後要加雜記、通訊錄、聊天室時，在這裡照樣增加函式即可。
//
// 事件資料格式：
// { id, title, category, event_date, end_date, start_time, end_time, member_ids, note }
//   category: 'schedule' 行程 | 'exam' 考試 | 'family' 家庭活動 | 'other' 其他
//   日期為 'YYYY-MM-DD'，時間為 'HH:MM' 或 null（全天）
//   member_ids 為空陣列代表「全家」

(function () {
  const cfg = window.FAMILY_CONFIG || {};
  const isDemo = !(cfg.firebase && cfg.firebase.apiKey);

  const clean = (ev) => ({
    title: ev.title,
    category: ev.category,
    event_date: ev.event_date,
    end_date: ev.end_date || ev.event_date,
    start_time: ev.start_time || null,
    end_time: ev.end_time || null,
    member_ids: ev.member_ids || [],
    note: ev.note || null
  });

  // ---------- Firebase（Authentication + Firestore） ----------
  // 資料結構：
  //   members/{使用者 UID}  → { display_name, color, sort }
  //   events/{自動 ID}      → 事件欄位 + created_by, created_at
  function firebaseApi() {
    const F = window.FirebaseSDK;
    const app = F.initializeApp(cfg.firebase);
    const auth = F.getAuth(app);
    const db = F.getFirestore(app);
    const events = F.collection(db, 'events');
    const row = (d) => ({ id: d.id, ...d.data() });
    const byTime = (a, b) =>
      (a.event_date + (a.start_time || '')).localeCompare(b.event_date + (b.start_time || ''));

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
          const snap = await F.getDocs(F.query(F.collection(db, 'members'), F.orderBy('sort')));
          return snap.docs.map(row);
        } catch (e) {
          // 不在成員名單裡的帳號會被安全規則擋下
          if (e && e.code === 'permission-denied') return [];
          throw e;
        }
      },
      // 只用 end_date 一個條件查詢（不需要另外建立索引），開始日期在這裡過濾
      async listEvents(from, to) {
        const snap = await F.getDocs(F.query(events, F.where('end_date', '>=', from), F.orderBy('end_date')));
        return snap.docs.map(row).filter((e) => e.event_date <= to).sort(byTime);
      },
      async saveEvent(ev) {
        const data = clean(ev);
        if (ev.id) {
          await F.updateDoc(F.doc(db, 'events', ev.id), data);
          return { id: ev.id, ...data };
        }
        const ref = await F.addDoc(events, {
          ...data, created_by: auth.currentUser.uid, created_at: F.serverTimestamp()
        });
        return { id: ref.id, ...data };
      },
      async deleteEvent(id) { await F.deleteDoc(F.doc(db, 'events', id)); },
      // 登入後呼叫：家人新增或修改時通知畫面重新讀取。回傳停止監聽的函式。
      watchEvents(cb) {
        const d = new Date(); d.setDate(d.getDate() - 45);
        const since = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        let first = true;
        return F.onSnapshot(
          F.query(events, F.where('end_date', '>=', since)),
          () => { if (first) { first = false; return; } cb(); },
          (err) => console.warn('即時同步中斷', err)
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
    const seed = () => ({
      user: null,
      events: [
        { id: 's1', title: '鋼琴課', category: 'schedule', event_date: day(0), end_date: day(0), start_time: '18:30', end_time: '19:30', member_ids: ['m3'], note: null },
        { id: 's2', title: '數學段考', category: 'exam', event_date: day(5), end_date: day(6), start_time: null, end_time: null, member_ids: ['m3'], note: '範圍：第三、四章' },
        { id: 's3', title: '阿嬤家吃飯', category: 'family', event_date: day(2), end_date: day(2), start_time: '12:00', end_time: null, member_ids: [], note: null },
        { id: 's4', title: '英文單字小考', category: 'exam', event_date: day(3), end_date: day(3), start_time: null, end_time: null, member_ids: ['m4'], note: 'Unit 5' },
        { id: 's5', title: '牙醫回診', category: 'schedule', event_date: day(9), end_date: day(9), start_time: '16:00', end_time: null, member_ids: ['m2', 'm4'], note: null }
      ]
    });
    let mem = null;
    const load = () => {
      if (mem) return mem;
      try { mem = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 無法使用儲存空間時只留在記憶體 */ }
      if (!mem) mem = seed();
      return mem;
    };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* 同上 */ } };

    return {
      isDemo: true,
      async currentUserId() { return load().user; },
      async signIn() { load().user = 'm1'; save(); return 'm1'; },
      async signOut() { load().user = null; save(); },
      async listMembers() { return members; },
      async listEvents(from, to) {
        return load().events
          .filter((e) => e.event_date <= to && e.end_date >= from)
          .sort((a, b) => (a.event_date + (a.start_time || '')).localeCompare(b.event_date + (b.start_time || '')));
      },
      async saveEvent(ev) {
        const db = load();
        const row = { ...clean(ev), id: ev.id || 'e' + Date.now() };
        const i = db.events.findIndex((e) => e.id === row.id);
        if (i >= 0) db.events[i] = row; else db.events.push(row);
        save();
        return row;
      },
      async deleteEvent(id) {
        const db = load();
        db.events = db.events.filter((e) => e.id !== id);
        save();
      },
      watchEvents() { return function () {}; }
    };
  }

  window.Api = isDemo ? demoApi() : firebaseApi();
})();
