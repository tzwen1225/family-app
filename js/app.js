(function () {
  'use strict';

  const CATEGORIES = {
    schedule: { label: '補習', color: 'var(--c-schedule)' },
    exam:     { label: '考試', color: 'var(--c-exam)' },
    family:   { label: '家庭活動', color: 'var(--c-family)' },
    other:    { label: '其他', color: 'var(--c-other)' },     // 不能再選；只用來顯示舊行程，和類型被刪掉的行程
    birthday: { label: '生日', color: 'var(--c-birthday)' },  // 由成員基本資料自動產生，不能手動新增
    trip:     { label: '旅遊', color: 'var(--c-trip)' }        // 由鍾家生活裡的家庭旅遊自動產生
  };
  // 版本：每次更新程式時，這裡和 version.txt 要改成同一個值。
  // App 回到前景時會比對 version.txt，不一樣就自動重新載入，不必手動關掉重開。
  const VERSION = '2026-11-17 23:30';
  // 面板顏色：[代號, 名稱, 主色, 副色]。顏色定義在 css/app.css 的「面板顏色」區塊。
  const THEMES = [
    ['', '日曆紅', '#D4282C', '#1F6B52'],
    ['ocean', '海洋藍', '#1E6FD9', '#0E7C86'],
    ['forest', '森林綠', '#2E8B57', '#5B6B2A'],
    ['sakura', '櫻花粉', '#D6457F', '#7A4B8C'],
    ['sunset', '暖陽橘', '#E0701A', '#7A5A1E'],
    ['lavender', '薰衣草紫', '#7A4FD0', '#3F5BB5'],
    ['night', '夜間', '#1B2320', '#3FA57F']
  ];
  const THEME_KEY = 'family-theme';
  const currentTheme = () => document.documentElement.dataset.theme || '';
  function applyTheme(id) {
    if (id) document.documentElement.dataset.theme = id; else delete document.documentElement.dataset.theme;
    try { if (id) localStorage.setItem(THEME_KEY, id); else localStorage.removeItem(THEME_KEY); } catch (e) { /* 忽略 */ }
    syncThemeColor();
  }
  // 讓手機最上方狀態列的底色跟著面板走
  function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    if (meta && paper) meta.setAttribute('content', paper);
  }
  const EVENT_CATS = ['schedule', 'exam', 'family'];   // 內建類型（補習、考試、家庭活動），不能刪除
  // 自訂類型可以選的顏色
  const CAT_COLORS = ['#2F6FDE', '#0E7C86', '#1F8A5F', '#5B6B2A', '#B8860B', '#E67E00', '#D4282C', '#C2478B', '#8A4FD0', '#7A847F'];
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  const READ_KEY = 'family-chat-read';
  const RECALL_MS = 60 * 60 * 1000;     // 訊息送出後多久內可以收回
  const BEAT_MS = 60 * 1000;            // 每隔多久回報一次「我在線上」
  const ONLINE_MS = 150 * 1000;         // 多久沒回報就視為離線

  // ---------- 日期工具（一律用本地日期字串，避免時區問題） ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const today = () => ymd(new Date());
  const shortDate = (s) => { const d = parse(s); return (d.getMonth() + 1) + '/' + d.getDate() + '（' + WEEKDAYS[d.getDay()] + '）'; };
  const clock = (ms) => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const stamp = (ms) => {
    const day = ymd(new Date(ms));
    const n = daysBetween(day, today());
    return (n === 0 ? '今天' : n === 1 ? '昨天' : shortDate(day).replace(/（.*/, '')) + ' ' + clock(ms);
  };
  const byTime = (a, b) => (a.event_date + (a.start_time || '')).localeCompare(b.event_date + (b.start_time || ''));

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const telHref = (phone) => 'tel:' + String(phone).replace(/[^\d+#*]/g, '');

  // ---------- 狀態 ----------
  // 交通頁的狀態（登出時原地清空，不換物件）
  const freshTransit = () => ({
    mode: 'bus', favs: { bus: [], tra: [] }, favsLoaded: false, favEtas: [], q: '', results: null,
    route: null, routeDir: 0, stations: null, station: null, board: null, traQ: '', loading: false, error: '', errorDetail: '', updatedAt: 0
  });
  const state = {
    transit: freshTransit(),
    userId: null,
    members: [],
    profiles: {},            // { UID: { birthday, phone, org, note } }
    presence: {},            // { UID: { last_seen, online } }
    tab: 'cal',              // cal | chat | posts | notes | me
    calView: 'month',        // month | list
    cursor: today().slice(0, 7), // 目前顯示的月份 'YYYY-MM'
    selected: today(),
    monthEvents: [],
    upcoming: [],
    notes: [],
    notesView: 'hub',        // hub（鍾家生活的首頁，預設）| ledger（零用錢）| scores | notes（旅遊）| album | transit | shop | cards // ledger（零用錢，預設）| notes（雜記）| shop（採買）| cards（資料卡）
    shopping: [], cards: [],
    todoFilter: 'all', todoShowDone: false, todoNewWho: '', todoNewDue: '', todoNewRepeat: '',   // 日常待辦（資料沿用 shopping）
    trips: [], tripItems: [],       // 家庭旅遊：旅程，以及每趟旅程底下的行程、日誌、行李、花費
    tripId: null, tripTab: 'plan',  // 正在看哪一趟旅程、哪個分頁（plan 行程 | journal 日誌 | pack 行李 | cost 花費）
    showOldNotes: false,
    chatShown: 60,           // 聊天室目前畫出最新的幾則
    photos: [], photoComments: [], albumMonth: today().slice(0, 7), albumLoaded: null, photoId: null,   // 家庭相簿：只放正在看的那個月
    subjects: [],                   // 家長自訂的考試科目 { id, label }
    scores: [], scoreSubject: '',   // 成績紀錄
    scoreTerm: '',                  // 目前看哪個學期（空的代表全部）；會記在這支手機上；scoreSubject 是目前只看哪一科（空的代表全部）
    postsView: 'posts',      // posts（留言）| polls（投票）
    polls: [], votes: [],
    pollOpen: null,          // 歷史紀錄裡點開看細節的那一則
    pollHistory: false,      // 投票頁正在看「歷史紀錄」（已結束、已截止、已作廢的投票）
    homePollId: null,        // 首頁投票區目前顯示哪一則（多則時用 1、2、3… 切換）
    pollEdit: null,          // 正在投票或改票的那一則投票；其他投票的選項都是鎖住的，避免誤觸
    ledger: [],
    ledgerMonth: today().slice(0, 7),
    ledgerKid: null,         // 家長正在看哪位小朋友的帳本
    ledgerDay: null,         // 在小月曆點了某一天時，明細只顯示那天
    categories: [],          // 家長自訂的行事曆類型 { id, label, color }
    requests: [],            // 費用申請（小朋友提出、家長標示已給）
    messages: [],
    draft: '',
    chatSearch: false,
    chatQuery: '',
    menuMsg: null,           // 正在顯示「收回」按鈕的訊息
    posts: [],
    replies: [],
    postDrafts: {},
    lastRead: 0
  };
  try { state.lastRead = Number(localStorage.getItem(READ_KEY)) || 0; } catch (e) { /* 忽略 */ }
  try { const t = localStorage.getItem('family-score-term'); if (t) state.scoreTerm = t; } catch (e) { /* 忽略 */ }

  const $app = document.getElementById('app');
  const $sheet = document.getElementById('sheet-root');
  const $toast = document.getElementById('toast');

  let toastTimer;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
  }

  const me = () => state.members.find((m) => m.id === state.userId);
  // 管理員：members 文件裡有 admin: true 的人，可以編輯所有人的基本資料；其他人只能改自己的
  const isAdmin = () => { const m = me(); return !!(m && m.admin === true); };
  // 行程：全家都看得到，但只有新增的人可以修改或刪除（很舊、沒有記錄新增者的行程不限制）
  const canEditEvent = (e) => !e.created_by || e.created_by === state.userId;
  // 行程的類型：內建的四種加上家長自訂的。自訂類型被刪掉後，用過它的行程會顯示成「其他」。
  function catOf(id) {
    if (CATEGORIES[id]) return CATEGORIES[id];
    const c = state.categories.find((x) => x.id === id);
    return c ? { label: c.label, color: c.color } : CATEGORIES.other;
  }
  const eventCatIds = () => EVENT_CATS.concat(state.categories.map((c) => c.id));
  const canEditProfile = (id) => id === state.userId || isAdmin();
  // 小朋友：members 文件裡有 child: true 的成員。其他人都算家長。
  const kids = () => state.members.filter((m) => m.child === true);
  const amChild = () => { const m = me(); return !!(m && m.child === true); };
  const money = (n) => '$' + Math.abs(n).toLocaleString('en-US');
  const member = (id) => state.members.find((m) => m.id === id);
  const nameOf = (id) => { const m = member(id); return m ? m.display_name : '已離開的成員'; };
  const colorOf = (id) => { const m = member(id); return m ? m.color : '#7A847F'; };
  const findById = (list, id) => list.find((x) => String(x.id) === id);

  // ---------- 上線狀態 ----------
  function isOnline(id) {
    if (id === state.userId) return true;
    const p = state.presence[id];
    return !!(p && p.online && Date.now() - p.last_seen < ONLINE_MS);
  }
  function statusText(id) {
    if (isOnline(id)) return '上線中';
    const p = state.presence[id];
    if (!p) return '尚未上線';
    const min = Math.floor((Date.now() - p.last_seen) / 60000);
    if (min < 1) return '剛剛離開';
    return min < 60 ? min + ' 分鐘前' : stamp(p.last_seen);
  }
  function avatarHtml(m, cls) {
    return `<span class="avatar ${cls || ''} ${isOnline(m.id) ? 'online' : ''}" style="background:${esc(m.color)}">${esc(m.display_name.slice(0, 1))}</span>`;
  }
  function presenceHtml() {
    return state.members.map((m) => `
      <div class="pres ${isOnline(m.id) ? 'on' : ''}" aria-label="${esc(m.display_name)}：${statusText(m.id)}">
        ${avatarHtml(m, 'sm')}
        <span class="pres-name">${esc(m.display_name)}</span>
      </div>`).join('');
  }
  function refreshPresence() {
    const el = document.getElementById('presence');
    if (el) el.innerHTML = presenceHtml();
    else if (state.tab === 'me' && !$sheet.innerHTML) render();
  }

  // ---------- 每週重複 ----------
  // 重複行程在資料庫只有一筆；這裡把它展開成範圍內每一天各一筆「場次」。
  // 場次的 id 和原始行程相同，並用 series 指回原始那一筆。
  function occurrenceDates(ev, from, to) {
    const out = [];
    const start = ev.event_date > from ? ev.event_date : from;
    const end = ev.end_date < to ? ev.end_date : to;
    const skip = ev.skip_dates || [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (ev.repeat_days.includes(parse(d).getDay()) && !skip.includes(d)) out.push(d);
    }
    return out;
  }

  // ---------- 生日 ----------
  // 從成員基本資料算出範圍內的生日，當成唯讀的全天行程顯示在月曆上。
  function birthdayEvents(from, to) {
    const out = [];
    state.members.forEach((m) => {
      const b = (state.profiles[m.id] || {}).birthday;
      if (!b) return;
      const [by, bm, bd] = b.split('-').map(Number);
      for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
        // 2/29 生日在平年顯示於 2/28
        const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        const d = y + '-' + pad(bm) + '-' + pad(bm === 2 && bd === 29 && !leap ? 28 : bd);
        if (d < from || d > to) continue;
        out.push({
          id: 'bday-' + m.id + '-' + y, readonly: true, category: 'birthday',
          title: m.display_name + '生日', note: y > by ? '滿 ' + (y - by) + ' 歲' : '',
          event_date: d, end_date: d, start_time: null, end_time: null, member_ids: [m.id]
        });
      }
    });
    return out;
  }

  // 家庭旅遊：每趟旅程在月曆上顯示成一筆橫跨出發到回程的行程（點了會跳到那趟旅程）
  function tripEvents(from, to) {
    return state.trips.filter((t) => t.start_date <= to && t.end_date >= from).map((t) => ({
      id: 'trip-' + t.id, trip_id: t.id, readonly: true, category: 'trip',
      title: t.title, note: t.place || '',
      event_date: t.start_date, end_date: t.end_date, start_time: null, end_time: null, member_ids: []
    }));
  }

  function expand(list, from, to) {
    const out = birthdayEvents(from, to).concat(tripEvents(from, to));
    list.forEach((ev) => {
      if (ev.repeat !== 'weekly') { out.push(ev); return; }
      occurrenceDates(ev, from, to).forEach((d) => out.push({ ...ev, event_date: d, end_date: d, series: ev }));
    });
    return out.sort(byTime);
  }

  // ---------- 月曆格子範圍 ----------
  function gridRange(cursor) {
    const first = parse(cursor + '-01');
    const start = new Date(first); start.setDate(1 - first.getDay());
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const end = new Date(last); end.setDate(last.getDate() + (6 - last.getDay()));
    return { from: ymd(start), to: ymd(end) };
  }

  // ---------- 載入資料 ----------
  async function loadEvents() {
    const { from, to } = gridRange(state.cursor);
    try {
      const [month, upcoming] = await Promise.all([
        Api.listEvents(from, to),
        Api.listEvents(today(), addDays(today(), 90))
      ]);
      state.monthEvents = expand(month, from, to);
      state.upcoming = expand(upcoming, today(), addDays(today(), 90));
      if (state.cursor === today().slice(0, 7)) saveCache();
    } catch (e) {
      console.error(e);
      toast('讀取失敗，請確認網路連線');
    }
    if (state.tab === 'cal') render();
  }

  async function loadNotes() {
    try { state.notes = await Api.listNotes(); }
    catch (e) { console.error(e); toast('雜記讀取失敗'); }
    if (state.tab === 'notes') render();
  }

  async function loadLedger() {
    try { state.ledger = await Api.listLedger(amChild() ? state.userId : null); }
    catch (e) { console.error(e); toast('零用錢紀錄讀取失敗'); }
    if (state.tab === 'notes' && state.notesView === 'ledger') render();
  }

  async function loadScores() {
    try { state.scores = await Api.listDocs('scores', amChild() ? ['kid', state.userId] : null); }
    catch (e) { console.error(e); toast('成績讀取失敗'); }
    if (state.tab === 'notes' && state.notesView === 'scores') render();
  }

  async function loadProfiles() {
    try { state.profiles = await Api.listProfiles(); }
    catch (e) { console.error(e); }
  }

  function loadTab() {
    if (state.tab === 'cal') loadEvents();
    else if (state.tab === 'notes') { if (state.notesView === 'ledger') loadLedger(); else if (state.notesView === 'notes') { if (state.showOldNotes) loadNotes(); } else if (state.notesView === 'scores') loadScores(); else if (state.notesView === 'album') loadAlbum(); else if (state.notesView === 'transit') loadTransit(); }
  }

  // ---------- 啟動 ----------
  let stopWatchers = [];
  let beatTimer = null;
  function stopWatching() {
    stopWatchers.forEach((fn) => fn());
    stopWatchers = [];
    clearInterval(beatTimer);
  }
  // 回報上線狀態，順便帶上「聊天室讀到哪裡」。換手機時取兩邊較新的那個，已讀不會倒退。
  function beat(online) {
    const mine = state.presence[state.userId];
    const readAt = Math.max(state.lastRead, (mine && mine.read_at) || 0);
    Api.beat(online, readAt).catch((e) => console.warn('上線狀態更新失敗', e));
  }

  // ---------- 啟動快取 ----------
  // 上次看到的成員、基本資料、月曆存一份在手機上。下次打開時先用它立刻畫出畫面，
  // 同時在背景向伺服器拿最新的資料；不用等連線建立好才看得到東西。
  const CACHE_KEY = 'family-cache-v1';
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch (e) { return null; }
  }
  function saveCache() {
    if (!state.userId || !state.members.length) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        userId: state.userId, members: state.members, profiles: state.profiles,
        cursor: state.cursor, day: today(), monthEvents: state.monthEvents, upcoming: state.upcoming
      }));
    } catch (e) { /* 空間不夠就不存，只是下次開啟會慢一點 */ }
  }
  function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* 忽略 */ } }

  async function boot() {
    try {
      state.userId = await Api.currentUserId();
      if (!state.userId) return renderLogin();
      const c = readCache();
      if (c && c.userId === state.userId && (c.members || []).some((m) => m.id === state.userId)) {
        // 有上次的資料：馬上顯示，最新資料在背景更新
        state.members = c.members;
        state.profiles = c.profiles || {};
        if (c.cursor === state.cursor && c.day === today()) {
          state.monthEvents = c.monthEvents || [];
          state.upcoming = c.upcoming || [];
        }
        render();
        startWatching();
        await enter(true);
      } else {
        await enter(false);
      }
    } catch (e) {
      console.error(e);
      // 已經用快取畫出畫面的話就留著，等網路恢復；否則回到登入畫面
      if (!state.members.length) renderLogin('連線失敗，請確認網路後再試一次');
      else toast('連線不穩，顯示的是上次的資料');
    }
  }

  // warm = true：畫面已經用快取顯示了，這裡只負責把資料換成最新的
  async function enter(warm) {
    const [members, profiles] = await Promise.all([Api.listMembers(), Api.listProfiles().catch(() => null)]);
    state.members = members;
    if (profiles) state.profiles = profiles;
    if (!me()) {
      stopWatching();
      clearCache();
      await Api.signOut();
      state.userId = null;
      renderLogin('這個帳號不在家庭成員名單裡');
      return;
    }
    if (!$sheet.innerHTML) render();
    if (!warm) startWatching();
    await loadEvents();
    saveCache();
  }

  function startWatching() {
    stopWatching();
    stopWatchers = [
      Api.watchEvents(() => { if (state.userId) loadEvents(); }),
      Api.watchMessages(onMessages),
      Api.watchPosts((list) => { state.posts = list; refreshPosts(); }),
      Api.watchReplies((list) => { state.replies = list; refreshPosts(); }),
      Api.watchPresence((map) => {
        state.presence = map; refreshPresence();
        if (state.tab === 'chat') refreshChat(false);     // 有人讀了訊息：更新「已讀」
      }),
      Api.watchList('subjects', (list) => {
        state.subjects = list.sort((a, b) => a.created_at - b.created_at);
        if (state.tab === 'me' && !$sheet.innerHTML) render();
      }),
      Api.watchList('trips', (list) => { state.trips = list; loadEvents(); refreshTravel(); }),
      Api.watchList('calls', onCalls),
      Api.watchList('trip_items', (list) => { state.tripItems = list; refreshTravel(); }),
      Api.watchList('shopping', (list) => { state.shopping = list; refreshShop(); }),
      Api.watchList('cards', (list) => { state.cards = list; if (state.tab === 'notes' && state.notesView === 'cards' && !$sheet.innerHTML) render(); }),
      Api.watchList('polls', (list) => { state.polls = list; refreshPolls(); }),
      Api.watchList('poll_votes', (list) => { state.votes = list; refreshPolls(); }),
      Api.watchCategories((list) => {
        state.categories = list;
        if ((state.tab === 'cal' || state.tab === 'me') && !$sheet.innerHTML) render();
      }),
      Api.watchRequests((list) => {
        state.requests = list;
        refreshTodos();
        if (state.tab === 'notes' && (state.notesView === 'ledger' || state.notesView === 'hub') && !$sheet.innerHTML) render();
      }, amChild() ? state.userId : null)
    ];
    Api.refreshPush().catch((e) => console.warn('通知設定更新失敗', e));
    beat(true);
    beatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') beat(true);
      refreshPresence();
    }, BEAT_MS);
  }

  // ---------- 登入畫面 ----------
  function renderLogin(error) {
    renderedTab = null;
    $app.innerHTML = `
      <div class="scroller">
        <main class="login">
          <div class="login-mark" aria-hidden="true">家</div>
          <h1>鍾家大宅</h1>
          <p class="login-sub">行程、聊天、雜記，都在這裡。</p>
          <form id="login-form" novalidate>
            <label>電子郵件
              <input type="email" name="email" autocomplete="username" inputmode="email" autocapitalize="off" required>
            </label>
            <label>密碼
              <input type="password" name="password" autocomplete="current-password" required>
            </label>
            ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ''}
            <button class="btn primary" type="submit">登入</button>
          </form>
          ${Api.isDemo ? '<p class="demo-note">目前是示範模式：直接按「登入」即可試用，資料只存在這台裝置。</p>' : ''}
        </main>
      </div>`;
  }

  async function onLogin(form) {
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!Api.isDemo && (!email || !password)) return renderLogin('請輸入電子郵件和密碼');
    const btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = '登入中…';
    try {
      state.userId = await Api.signIn(email, password);
      await enter();
    } catch (e) {
      console.error(e);
      renderLogin('登入失敗，請確認電子郵件和密碼');
    }
  }

  // ---------- 主畫面 ----------
  const ICON = {
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7"/><path d="M6 9.500V20h4.500v-5.500h3V20H18V9.500"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/></svg>',
    posts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l7 4.5v-13L7 10zM17.500 9.500a4 4 0 0 1 0 5M7.500 14l1 5h2.500"/></svg>',
    notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2.200"/><rect x="13" y="4" width="7" height="7" rx="2.200"/><rect x="4" y="13" width="7" height="7" rx="2.200"/><rect x="13" y="13" width="7" height="7" rx="2.200"/></svg>',
    me: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h10M18 17h2"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
    photo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.500" y="5" width="17" height="14" rx="2.500"/><circle cx="9" cy="10" r="1.800"/><path d="M4 17l5-4.500 3.500 3 3-2.500 4.500 4"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12.500 6l6 6-6 6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.500 4h3l1.500 4-2 1.500a11 11 0 0 0 5.500 5.500l1.500-2 4 1.500v3a2 2 0 0 1-2 2A15.500 15.500 0 0 1 4.500 6a2 2 0 0 1 2-2z"/></svg>'
  };
  // 底部選單選到的那一格：換成彩色圖示（顏色固定，不跟面板變）
  const ICON_ON = {
    cal: '<svg class="color" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.500 10.400 12 5l6.500 5.400V19a1.500 1.500 0 0 1-1.500 1.500H7A1.500 1.500 0 0 1 5.500 19z" fill="#FFB224"/><path d="M10 20.500v-4.700a2 2 0 0 1 4 0v4.700z" fill="#fff"/><path d="M3.300 11.300 12 3.800l8.700 7.500" fill="none" stroke="#E5484D" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chat: '<svg class="color" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.500 6.500A3 3 0 0 1 6.500 3.500h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6.200L6 21v-4.500a3 3 0 0 1-2.500-3z" fill="#2F8CFF"/><circle cx="8.300" cy="10" r="1.250" fill="#fff"/><circle cx="12" cy="10" r="1.250" fill="#fff"/><circle cx="15.700" cy="10" r="1.250" fill="#fff"/></svg>',
    notes: '<svg class="color" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.500" y="3.500" width="8" height="8" rx="2.500" fill="#FF8A3D"/><rect x="12.500" y="3.500" width="8" height="8" rx="2.500" fill="#34C17B"/><rect x="3.500" y="12.500" width="8" height="8" rx="2.500" fill="#3B9BFF"/><rect x="12.500" y="12.500" width="8" height="8" rx="2.500" fill="#A66BFF"/></svg>',
    posts: '<svg class="color" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.200 13.500l1.100 5.300a1 1 0 0 0 1 .800h1.200a1 1 0 0 0 1-1.200l-.900-4.900z" fill="#D97A00"/><path d="M3.500 9.800a1 1 0 0 1 1-1H7.300l6.200-4a1 1 0 0 1 1.500.850v12.700a1 1 0 0 1-1.500.850l-6.200-4H4.500a1 1 0 0 1-1-1z" fill="#FF9F1C"/><path d="M17.600 9.300a4 4 0 0 1 0 5.400M19.600 7a7.200 7.200 0 0 1 0 10" fill="none" stroke="#F25F4C" stroke-width="1.800" stroke-linecap="round"/></svg>',
    me: '<svg class="color" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="#B4BAC6" stroke-width="2.200" stroke-linecap="round"/><circle cx="15" cy="7" r="2.800" fill="#7C5CFC"/><circle cx="9" cy="12" r="2.800" fill="#FF5A7A"/><circle cx="16" cy="17" r="2.800" fill="#22B8A0"/></svg>'
  };
  const TAB_COLOR = { cal: '#E5484D', chat: '#2F8CFF', notes: '#2FA36B', posts: '#E8850C', me: '#7C5CFC' };
  const TABS = [['cal', '首頁'], ['chat', '聊天'], ['notes', '鍾家生活'], ['posts', '我有話要說'], ['me', '設定']];
  // 右下角的新增鈕在這個畫面要做什麼；沒有東西可新增時不顯示
  function fabLabel() {
    if (state.tab === 'cal') return '新增行程';
    if (state.tab === 'posts') return state.postsView === 'polls' ? '發起投票' : '我有話要說';
    if (state.tab !== 'notes') return '';
    if (state.notesView === 'notes') {
      if (!state.tripId) return '新增旅程';
      return { plan: '新增行程', journal: '寫日誌', cost: '新增花費' }[state.tripTab] || '';   // 行李直接在上方輸入
    }
    if (state.notesView === 'hub') return '';
    if (state.notesView === 'album') return '放照片';
    if (state.notesView === 'transit') return '';
    if (state.notesView === 'shop') return '';                       // 待辦直接在上方輸入
    if (state.notesView === 'cards') return amChild() ? '' : '新增資料卡';
    if (state.notesView === 'scores') return kids().length ? '新增成績' : '';
    return kids().length ? '新增一筆零用錢紀錄' : '';
  }

  const hasUnread = () => state.messages.some((m) => m.sender !== state.userId && m.sent_at > state.lastRead);
  const repliedBy = (post, uid) => state.replies.some((r) => r.post_id === post.id && r.author === uid);
  const waitingForMe = () => state.posts.some((p) => p.to.includes(state.userId) && !repliedBy(p, state.userId));
  // 還開著、而我還沒投的投票
  // 投票結束了嗎：發起人手動結束，或過了截止日期（截止日當天還可以投）
  const pollOver = (p) => !!p.closed || !!p.voided || (!!p.deadline && p.deadline < today());
  const pollsForMe = () => state.polls.filter((p) => !pollOver(p)
    && !state.votes.some((v) => v.poll_id === p.id && v.uid === state.userId));
  // 已給的申請實際給了多少（舊資料沒有記的話，視為和申請金額相同）
  const givenAmount = (r) => (r.given_amount != null ? r.given_amount : r.amount);
  const pendingRequests = () => state.requests.filter((r) => r.status !== 'given')
    .sort((a, b) => a.need_date.localeCompare(b.need_date));
  const badge = (tab) => (tab === 'chat' ? hasUnread()
    : tab === 'posts' ? (waitingForMe() || pollsForMe().length > 0)
    : tab === 'notes' ? (!amChild() && pendingRequests().length > 0)
    : false);

  // ---------- 首頁：我的今天 ----------
  // 首頁最上面一張卡片，放所有「標註到我」、要我處理的東西：
  //   要處理的事：交給我的待辦（不論日期）、全家的待辦裡今天或過期的、在「我有話要說」點名我還沒回覆的、
  //               （家長）小朋友申請還沒給的費用
  //   今天的行程：有標註我的、全家的、生日和旅程
  const dueText = (date) => {
    const n = daysBetween(today(), date);
    return n === 0 ? '今天要用' : n > 0 ? '還有 ' + n + ' 天' : '已經過了 ' + (-n) + ' 天';
  };
  function mineTaskItems() {
    const items = [];
    if (!amChild()) {
      pendingRequests().forEach((r) => {
        const late = r.need_date <= today();
        items.push(`
          <div class="todo">
            <button class="todo-main" data-act="open-ledger" data-kid="${esc(r.kid)}" data-month="${r.need_date.slice(0, 7)}">
              <span class="todo-title">${esc(nameOf(r.kid))}需要 ${money(r.amount)}</span>
              <span class="todo-sub">${esc(r.title)}　${shortDate(r.need_date)}<em class="${late ? 'late' : ''}">${dueText(r.need_date)}</em></span>
            </button>
            <button class="todo-done" data-act="req-given" data-id="${esc(r.id)}">已給</button>
          </div>`);
      });
    }
    homeTodos().forEach((i) => {
      const due = todoDue(i), n = due ? daysBetween(today(), due) : null;
      const from = todoWho(i) ? (i.added_by && i.added_by !== state.userId ? esc(nameOf(i.added_by)) + '交給你' : '你的待辦') : '全家的待辦';
      const when = n === null ? '' : n === 0 ? '今天' : n === 1 ? '明天' : n < 0 ? '過了 ' + (-n) + ' 天' : shortDate(due);
      items.push(`
          <div class="todo">
            <button class="todo-main" data-act="open-todos">
              <span class="todo-title">${i.star ? '<span class="todo-flag">！</span>' : ''}${esc(i.text)}</span>
              <span class="todo-sub">${from}${i.repeat && REPEATS[i.repeat] ? '　' + REPEATS[i.repeat] : ''}${when ? `<em class="${n < 0 ? 'late' : n > 0 ? 'later' : ''}">${when}</em>` : ''}</span>
            </button>
            <button class="todo-done" data-act="shop-toggle" data-id="${esc(i.id)}">完成</button>
          </div>`);
    });
    state.posts.filter((p) => p.to.includes(state.userId) && !repliedBy(p, state.userId))
      .sort((a, b) => a.created_at - b.created_at)
      .forEach((p) => items.push(`
          <div class="todo">
            <button class="todo-main" data-act="tab" data-tab="posts">
              <span class="todo-title">${esc(nameOf(p.author))}有話要對你說</span>
              <span class="todo-sub">${esc(p.text.length > 40 ? p.text.slice(0, 40) + '…' : p.text)}</span>
            </button>
            <button class="todo-done reply" data-act="tab" data-tab="posts">回覆</button>
          </div>`));
    return items;
  }
  function mineHtml() {
    const t = today();
    const mine = (e) => e.readonly || !e.member_ids || !e.member_ids.length || e.member_ids.includes(state.userId);
    const events = eventsOn(state.upcoming, t).filter(mine).sort(byTime);
    const tasks = mineTaskItems();
    const n = events.length + tasks.length;
    return `
      <h2>我的今天<span>${shortDate(t)}</span>${holidayName(t) ? `<em class="holiday-tag">${esc(holidayName(t))}</em>` : ''}${n ? `<b>${n}</b>` : ''}</h2>
      ${tasks.length ? `<h3>要處理的事</h3><div class="mine-tasks">${tasks.join('')}</div>` : ''}
      ${events.length ? `<h3>今天的行程</h3>${events.map((e) => eventRow(e)).join('')}` : ''}
      ${n ? '' : '<p class="none">今天沒有跟你有關的事。</p>'}`;
  }
  function refreshTodos() {
    refreshBadges();
    const el = document.getElementById('mine');
    if (el) el.innerHTML = mineHtml();
  }

  // 標示「已給」：同時在小朋友的零用錢帳本記一筆收入（金額和用途跟申請相同，日期是今天），
  // 並把那一筆的編號記在申請上。之後取消已給，就靠這個編號把那筆收入刪掉。
  async function giveRequest(r, amount) {
    const entry = await Api.saveLedger({ kid: r.kid, type: 'income', amount, note: r.title, date: today() });
    await Api.saveRequest({ ...r, status: 'given', given_by: state.userId, given_at: Date.now(), given_amount: amount, ledger_id: entry.id });
    await loadLedger();
  }

  // 按「已給」：先確認實際給了多少（預設等於申請的金額，可以改），確認後才記帳
  function onRequestGiven(btn) {
    const r = findById(state.requests, btn.dataset.id);
    if (!r) return;
    showSheet('give-form', {
      title: '給' + nameOf(r.kid) + '費用', submit: '確認已給',
      body: `
      <input type="hidden" name="item_id" value="${esc(r.id)}">
      <dl class="give-info">
        <dt>用途</dt><dd>${esc(r.title)}</dd>
        <dt>需要日期</dt><dd>${shortDate(r.need_date)}</dd>
        <dt>需求金額</dt><dd><b>${money(r.amount)}</b></dd>
      </dl>
      <label>實際給的金額（元）<input class="title-input" type="number" name="given_amount" inputmode="numeric" min="1" step="1" value="${esc(r.amount)}"></label>
      <p class="hint">確認後會標示為已給，並在${esc(nameOf(r.kid))}的零用錢記一筆這個金額的收入。</p>`
    });
  }

  function refreshBadges() {
    TABS.forEach(([id]) => {
      const el = document.querySelector('.tab[data-tab="' + id + '"]');
      if (el) el.classList.toggle('unread', badge(id));
    });
  }

  let renderedTab = null;
  const scroller = () => document.getElementById('scroller');

  function render() {
    if (!state.userId) return;
    const active = document.activeElement;
    const focusId = active && /^(INPUT|TEXTAREA)$/.test(active.tagName) && !$sheet.contains(active) ? active.id : '';
    const sameTab = renderedTab === state.tab;
    const keepTop = sameTab && scroller() ? scroller().scrollTop : 0;
    const views = { cal: viewCalendar, chat: viewChat, posts: viewPosts, notes: viewNotes, me: viewMe };

    $app.innerHTML = `
      <div class="scroller" id="scroller"><div class="screen">${views[state.tab]()}</div></div>
      ${state.tab === 'chat' && !state.chatSearch ? `
        <form class="chat-bar" id="chat-form">
          <label class="attach" aria-label="傳照片">
            <input type="file" id="chat-file" accept="image/*" multiple hidden>
            ${ICON.photo}
          </label>
          <input id="chat-input" name="text" type="text" placeholder="輸入訊息" value="${esc(state.draft)}" maxlength="2000" autocomplete="off" enterkeyhint="send" aria-label="訊息">
          <button type="submit" class="send" aria-label="傳送">${ICON.send}</button>
        </form>` : ''}
      ${fabLabel() ? `<div class="addbar"><button class="fab" data-act="new" aria-label="${fabLabel()}"><span class="fab-plus" aria-hidden="true">${ICON.plus}</span>${fabLabel()}</button></div>` : ''}
      <nav class="tabbar" aria-label="主選單">
        ${TABS.map(([id, label]) => `
          <button class="tab ${state.tab === id ? 'on' : ''} ${badge(id) ? 'unread' : ''}" style="--tab-c:${TAB_COLOR[id]}" data-act="tab" data-tab="${id}" ${state.tab === id ? 'aria-current="page"' : ''}>
            ${state.tab === id ? ICON_ON[id] : ICON[id]}<span>${label}</span>
          </button>`).join('')}
      </nav>`;
    renderedTab = state.tab;

    // 重畫後恢復捲動位置與輸入焦點
    if (state.tab === 'chat' && !sameTab) scrollChat(); else scroller().scrollTop = keepTop;
    const el = focusId && document.getElementById(focusId);
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* 某些欄位不支援 */ } }
  }

  // ---------- 月曆 ----------
  // 放假日：人事行政總處辦公日曆表上的國定假日與補假（js/holidays.js）。回傳假日名稱，不是假日就回傳空字串。
  const holidayName = (date) => (window.TW_HOLIDAYS && window.TW_HOLIDAYS[date]) || '';
  // 補班日：星期六、日但要上班（目前政府已取消補班，萬一以後又有，月曆上那天不會標紅）
  const isWorkday = (date) => !!(window.TW_WORKDAYS && window.TW_WORKDAYS[date]);
  // 自動向網路上的辦公日曆表確認這幾年的放假日；有更新就重畫月曆
  function syncHolidays(years) {
    if (!window.refreshHolidays) return;
    window.refreshHolidays(years).then((changed) => { if (changed && state.tab === 'cal' && !$sheet.innerHTML) render(); });
  }
  const eventsOn = (list, date) => list.filter((e) => e.event_date <= date && e.end_date >= date);

  function calSwitch() {
    const b = (v, label) => `<button class="${state.calView === v ? 'on' : ''}" data-act="cal-view" data-view="${v}" ${state.calView === v ? 'aria-pressed="true"' : ''}>${label}</button>`;
    return `<div class="switcher" role="group" aria-label="檢視方式">${b('month', '月曆')}${b('list', '近期')}</div>`;
  }

  function viewCalendar() {
    return `<section class="presence" id="presence" aria-label="家人上線狀態">${presenceHtml()}</section>`
      + `<section class="today-card mine-card" id="mine" aria-label="我的今天">${mineHtml()}</section>`
      + `<section class="home-polls" id="home-polls" aria-label="投票" ${homePollsHtml() ? '' : 'hidden'}>${homePollsHtml()}</section>`
      + calSwitch() + (state.calView === 'month' ? viewMonth() : viewUpcoming());
  }

  function viewMonth() {
    const [y, m] = state.cursor.split('-').map(Number);
    const { from, to } = gridRange(state.cursor);
    const t = today();
    let cells = '';
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const date = parse(d);
      const evs = eventsOn(state.monthEvents, d);
      const cls = [
        'day',
        d.slice(0, 7) !== state.cursor ? 'out' : '',
        ((date.getDay() === 0 || date.getDay() === 6) && !isWorkday(d)) || holidayName(d) ? 'weekend' : '',
        holidayName(d) ? 'holiday' : '',
        d === t ? 'today' : '',
        d === state.selected ? 'sel' : ''
      ].join(' ');
      const dots = evs.slice(0, 3).map((e) => `<i style="background:${esc(catOf(e.category).color)}"></i>`).join('');
      cells += `
        <button class="${cls}" data-act="pick" data-date="${d}" aria-label="${date.getMonth() + 1}月${date.getDate()}日${holidayName(d) ? '，' + holidayName(d) + '放假' : ''}，${evs.length} 件事" ${d === state.selected ? 'aria-pressed="true"' : ''}>
          <span class="num">${date.getDate()}</span>
          <span class="dots">${dots}${evs.length > 3 ? '<b>+</b>' : ''}</span>
        </button>`;
    }
    const sel = parse(state.selected);
    const dayEvents = eventsOn(state.monthEvents, state.selected);
    const diff = daysBetween(t, state.selected);
    const rel = diff === 0 ? '今天' : diff === 1 ? '明天' : diff === -1 ? '昨天' : diff > 0 ? diff + ' 天後' : -diff + ' 天前';

    return `
      <header class="month-head">
        <h1>${y}年${m}月</h1>
        <div class="month-nav">
          ${state.cursor !== t.slice(0, 7) || state.selected !== t ? '<button class="chip-btn" data-act="today">回到今天</button>' : ''}
          <button class="icon-btn" data-act="prev" aria-label="上個月">‹</button>
          <button class="icon-btn" data-act="next" aria-label="下個月">›</button>
        </div>
      </header>
      <div class="weekdays" aria-hidden="true">${WEEKDAYS.map((w, i) => `<span class="${i === 0 || i === 6 ? 'weekend' : ''}">${w}</span>`).join('')}</div>
      <div class="grid">${cells}</div>

      <section class="leaf" aria-label="當天行程">
        <div class="leaf-date">
          <div class="leaf-num">${sel.getDate()}</div>
          <div class="leaf-week">星期${WEEKDAYS[sel.getDay()]}</div>
          <div class="leaf-rel">${rel}</div>
          ${holidayName(state.selected) ? `<div class="leaf-holiday">${esc(holidayName(state.selected))}</div>` : ''}
          ${isWorkday(state.selected) ? '<div class="leaf-workday">補行上班</div>' : ''}
        </div>
        <div class="leaf-list">
          ${dayEvents.length ? dayEvents.map((e) => eventRow(e)).join('') : `
            <div class="empty">
              <p>這天還沒有安排。</p>
            </div>`}
        </div>
      </section>`;
  }

  // 時間欄：第一行是開始，第二行（較淡）是結束
  function timeHtml(e, showDate) {
    const md = (d) => { const x = parse(d); return (x.getMonth() + 1) + '/' + x.getDate(); };
    if (showDate && e.end_date !== e.event_date) return md(e.event_date) + `<small>到 ${md(e.end_date)}</small>`;
    if (!e.start_time) return '全天';
    return e.start_time + (e.end_time ? `<small>${e.end_time}</small>` : '');
  }

  function whoHtml(e) {
    if (!e.member_ids || !e.member_ids.length) return '<span class="who all">全家</span>';
    return e.member_ids.map(member).filter(Boolean)
      .map((m) => `<span class="who" style="--who:${esc(m.color)}">${esc(m.display_name)}</span>`).join('');
  }

  function eventRow(e, showDate) {
    const cat = catOf(e.category);
    const inner = `
        <span class="event-time">${timeHtml(e, showDate)}</span>
        <span class="event-main">
          <span class="event-title">${esc(e.title)}</span>
          <span class="event-meta"><span class="cat">${esc(cat.label)}</span>${e.series ? '<span class="rep">每週</span>' : ''}${e.readonly ? '' : whoHtml(e)}</span>
          ${e.note ? `<span class="event-note">${esc(e.note)}</span>` : ''}
        </span>`;
    // 生日是自動產生的，不能點開編輯
    if (e.trip_id) return `<button class="event" data-act="open-trip" data-id="${esc(e.trip_id)}" style="--cat:${esc(cat.color)}">${inner}</button>`;
    if (e.readonly) return `<div class="event" style="--cat:${esc(cat.color)}">${inner}</div>`;
    return `<button class="event" data-act="edit-event" data-id="${esc(e.id)}" data-date="${e.event_date}" style="--cat:${esc(cat.color)}">${inner}</button>`;
  }

  function viewUpcoming() {
    const t = today();
    const startOf = (e) => (e.event_date < t ? t : e.event_date);
    const list = state.upcoming.slice().sort((a, b) => startOf(a).localeCompare(startOf(b)));
    const exams = list.filter((e) => e.category === 'exam');

    const groups = {};
    list.forEach((e) => { (groups[startOf(e)] = groups[startOf(e)] || []).push(e); });

    const examStrip = exams.length ? `
      <section class="exams" aria-label="考試倒數">
        ${exams.slice(0, 4).map((e) => {
          const n = Math.max(0, daysBetween(t, e.event_date));
          return `
            <button class="exam" data-act="edit-event" data-id="${esc(e.id)}" data-date="${e.event_date}">
              <span class="exam-days">${n === 0 ? '今天' : n + '<small>天後</small>'}</span>
              <span class="exam-title">${esc(e.title)}</span>
              <span class="exam-who">${whoHtml(e)}</span>
            </button>`;
        }).join('')}
      </section>` : '';

    const days = Object.keys(groups).sort().map((d) => {
      const n = daysBetween(t, d);
      const label = n === 0 ? '今天' : n === 1 ? '明天' : shortDate(d);
      return `
        <section class="upcoming-day">
          <h2>${label}${n > 1 ? `<span>${n} 天後</span>` : ''}</h2>
          ${groups[d].map((e) => eventRow(e, true)).join('')}
        </section>`;
    }).join('');

    return `
      <header class="plain-head"><h1>近期</h1><p>接下來 90 天</p></header>
      ${examStrip}
      ${days || `
        <div class="empty big">
          <p>接下來 90 天沒有任何安排。</p>
        </div>`}`;
  }

  // ---------- 聊天 ----------
  // 把符合搜尋字的部分標出來
  function markText(text, q) {
    if (!q) return esc(text);
    const lower = text.toLowerCase(), needle = q.toLowerCase();
    let out = '', i = 0;
    for (;;) {
      const hit = lower.indexOf(needle, i);
      if (hit < 0) break;
      out += esc(text.slice(i, hit)) + '<mark>' + esc(text.slice(hit, hit + q.length)) + '</mark>';
      i = hit + q.length;
    }
    return out + esc(text.slice(i));
  }

  const canRecall = (m) => m.sender === state.userId && !m.recalled && Date.now() - m.sent_at < RECALL_MS;

  function chatListHtml() {
    const q = state.chatSearch ? state.chatQuery.trim() : '';
    if (state.chatSearch && !q) return '<div class="empty big"><p>輸入關鍵字，搜尋最近 300 則訊息。</p></div>';
    const list = q
      ? state.messages.filter((m) => !m.recalled && (m.text || '').toLowerCase().includes(q.toLowerCase()))
      : state.messages;
    if (q && !list.length) return '<div class="empty big"><p>找不到含有「' + esc(q) + '」的訊息。</p></div>';
    if (!list.length) return '<div class="empty big"><p>還沒有訊息。說聲嗨吧。</p></div>';

    // 平常只畫最新的幾十則（畫得快，新訊息一來馬上出現）；要看更早的再往上展開
    const shown = q ? list : list.slice(-state.chatShown);
    let html = q ? `<p class="found">找到 ${list.length} 則</p>`
      : shown.length < list.length ? '<button class="link-btn chat-older" data-act="chat-older">看更早的訊息</button>' : '';
    const pos = readPositions();
    let lastDay = '', lastSender = '';
    shown.forEach((m) => {
      const day = ymd(new Date(m.sent_at));
      if (day !== lastDay) {
        const n = daysBetween(day, today());
        html += `<div class="chat-day">${n === 0 ? '今天' : n === 1 ? '昨天' : shortDate(day)}</div>`;
        lastDay = day; lastSender = '';
      }
      const mine = m.sender === state.userId;
      const showName = !mine && (q || m.sender !== lastSender);
      let bubble;
      const thumb = m.thumb && String(m.thumb).startsWith('data:image/') ? m.thumb : '';
      if (!m.recalled && thumb) bubble = `<button class="bubble photo" data-act="view-image" data-id="${esc(m.id)}" aria-label="照片，點一下放大"><img src="${esc(thumb)}" alt="照片"></button>`;
      else if (m.recalled) bubble = `<div class="bubble recalled">${mine ? '你' : esc(nameOf(m.sender))}收回了訊息</div>`;
      else if (!q && canRecall(m)) bubble = `<button class="bubble" data-act="msg-menu" data-id="${esc(m.id)}" aria-label="${esc(m.text)}，點一下可以收回">${esc(m.text)}</button>`;
      else bubble = `<div class="bubble">${markText(m.text, q)}</div>`;
      html += `
        <div class="msg ${mine ? 'mine' : ''}" style="--who:${esc(colorOf(m.sender))}">
          ${showName ? `<div class="msg-name">${esc(nameOf(m.sender))}</div>` : ''}
          <div class="msg-row">${bubble}<span class="msg-meta"><time>${clock(m.sent_at)}</time>${m.recalled ? '' : readersHtml(m, pos)}</span></div>
          ${state.menuMsg === m.id && canRecall(m) ? `<button class="recall" data-act="recall" data-id="${esc(m.id)}">收回這則訊息</button>` : ''}
        </div>`;
      lastSender = m.sender;
    });
    return html;
  }

  function viewChat() {
    return `
      <header class="plain-head with-action">
        <h1>聊天</h1><p>全家 ${state.members.length} 個人</p>
        <button class="icon-btn call-start-btn" data-act="call-pick" aria-label="視訊通話">${CALL_ICON.video}</button>
        <button class="icon-btn ${state.chatSearch ? 'on' : ''}" data-act="chat-search" aria-label="${state.chatSearch ? '關閉搜尋' : '搜尋訊息'}" aria-pressed="${state.chatSearch}">${ICON.search}</button>
      </header>
      ${state.chatSearch ? `<input id="chat-q" class="search" type="search" placeholder="搜尋訊息" value="${esc(state.chatQuery)}" autocomplete="off" aria-label="搜尋訊息">` : ''}
      <div class="chat" id="chat-list" aria-live="polite">${chatDrawn = chatListHtml()}</div>`;
  }

  // 捲到最新一則。畫面高度可能還在變（鍵盤彈出、新訊息剛畫上去），所以隔一下再補捲兩次。
  function scrollChat() {
    const go = () => { const s = scroller(); if (s && state.tab === 'chat' && !state.chatSearch) s.scrollTop = s.scrollHeight; };
    go(); requestAnimationFrame(go); setTimeout(go, 150); setTimeout(go, 400);
  }

  function refreshChat(toBottom) {
    const el = document.getElementById('chat-list');
    if (!el) return;
    // 內容沒變就不重畫（別人上線、下線也會觸發這裡，重畫會讓畫面頓一下）
    const html = chatListHtml();
    if (html !== chatDrawn || !el.firstChild) { el.innerHTML = html; chatDrawn = html; }
    if (toBottom) scrollChat();
  }
  let chatDrawn = '';

  function markRead() {
    const last = state.messages[state.messages.length - 1];
    if (!last || last.sent_at <= state.lastRead) return;
    state.lastRead = last.sent_at;
    try { localStorage.setItem(READ_KEY, String(state.lastRead)); } catch (e) { /* 忽略 */ }
    beat(true);      // 馬上讓其他人看到「已讀」
  }

  // ---------- 已讀 ----------
  // 每個人「讀到哪個時間點」= 他最後一次打開聊天室時的最新訊息，或他自己傳的最後一則（取較新的）。
  // 我自己正在看，所以全部算已讀。回傳 { UID: 時間點 }。
  function readPositions() {
    const pos = {};
    state.members.forEach((m) => {
      if (m.id === state.userId) { pos[m.id] = Infinity; return; }
      const p = state.presence[m.id];
      let at = (p && p.read_at) || 0;
      state.messages.forEach((x) => { if (x.sender === m.id && x.sent_at > at) at = x.sent_at; });
      pos[m.id] = at;
    });
    return pos;
  }
  // 某一則訊息有誰讀過（不含傳送的人）。每一則訊息的時間下面都會列出來。
  function readersHtml(m, pos) {
    const who = state.members.filter((x) => x.id !== m.sender && pos[x.id] >= m.sent_at);
    if (!who.length) return m.sender === state.userId ? '<span class="readers none">還沒有人讀</span>' : '';
    return `<span class="readers" aria-label="已讀：${esc(who.map((x) => x.display_name).join('、'))}">已讀${who.map((x) => `<span class="avatar xs" style="background:${esc(x.color)}" title="${esc(x.display_name)}">${esc(x.display_name.slice(0, 1))}</span>`).join('')}</span>`;
  }

  function onMessages(list) {
    const grew = list.length !== state.messages.length
      || (list.length && state.messages.length && list[list.length - 1].id !== state.messages[state.messages.length - 1].id);
    state.messages = list;
    if (state.tab === 'chat' && document.visibilityState === 'visible') {
      markRead();
      refreshChat(grew && !state.chatSearch);
    }
    refreshBadges();
  }

  async function onSend(form) {
    const input = form.elements.text;
    const text = input.value.trim();
    if (!text) return;
    input.value = ''; state.draft = '';
    input.focus();
    scrollChat();
    try { await Api.sendMessage(text); scrollChat(); }
    catch (e) {
      console.error(e);
      state.draft = text; input.value = text;
      toast('訊息沒有送出，請再試一次');
    }
  }

  // ---------- 聊天照片 ----------
  // 照片不經過檔案空間，直接壓小後存進資料庫：
  // 訊息裡只放一張很小的縮圖（聊天列表載入才不會慢），原圖另外存在 chat_images，點開才讀取。
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('讀不到這張圖片')); };
      img.src = url;
    });
  }
  function shrink(img, maxSide, quality) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }
  // 選好的照片先放在預覽區，確認後才傳；可以移除其中幾張，或整批取消。
  // 傳送途中也可以按「取消傳送」，還沒傳的就不會再傳。
  const MAX_PHOTOS = 9;
  let pendingPhotos = [];     // [{ img, thumb }]
  let sendingPhotos = false;
  let cancelPhotos = false;
  let sentCount = 0;

  async function onPickImage(input) {
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length || sendingPhotos) return;
    if (files.length > MAX_PHOTOS) toast('一次最多 ' + MAX_PHOTOS + ' 張，只取前 ' + MAX_PHOTOS + ' 張');
    const picked = [];
    for (const file of files.slice(0, MAX_PHOTOS)) {
      try { const img = await loadImage(file); picked.push({ img, thumb: shrink(img, 240, 0.6) }); }
      catch (e) { console.error(e); }
    }
    if (!picked.length) return toast('讀不到選的照片，請再試一次');
    pendingPhotos = picked;
    renderTray();
  }

  function renderTray() {
    const n = pendingPhotos.length;
    $sheet.innerHTML = `
      <div class="backdrop"></div>
      <div class="sheet tray" role="dialog" aria-modal="true" aria-label="要傳送的照片">
        <div class="sheet-head">
          ${sendingPhotos
            ? '<span class="link-btn" aria-hidden="true"></span>'
            : '<button type="button" class="link-btn" data-act="tray-cancel">取消</button>'}
          <strong>${sendingPhotos ? `傳送中 ${Math.min(sentCount + 1, n)} / ${n}` : `選了 ${n} 張照片`}</strong>
          ${sendingPhotos
            ? '<button type="button" class="link-btn danger-text" data-act="tray-stop">取消傳送</button>'
            : `<button type="button" class="link-btn strong" data-act="tray-send">傳送</button>`}
        </div>
        <div class="sheet-body">
          <div class="tray-grid">
            ${pendingPhotos.map((p, i) => `
              <div class="tray-item ${sendingPhotos && i < sentCount ? 'sent' : ''}">
                <img src="${esc(p.thumb)}" alt="第 ${i + 1} 張">
                ${sendingPhotos ? '' : `<button type="button" data-act="tray-remove" data-i="${i}" aria-label="移除第 ${i + 1} 張">×</button>`}
              </div>`).join('')}
          </div>
          ${sendingPhotos ? '' : '<p class="hint">點照片右上角的 × 可以移除單張。按「傳送」才會送出。</p>'}
        </div>
      </div>`;
    document.body.classList.add('sheet-open');
  }

  async function sendPendingPhotos() {
    if (sendingPhotos || !pendingPhotos.length) return;
    sendingPhotos = true; cancelPhotos = false; sentCount = 0;
    let failed = 0;
    for (const p of pendingPhotos.slice()) {
      if (cancelPhotos) break;
      renderTray();
      try {
        // 資料庫單筆上限約 1MB：先用 1280 像素試，太大就再縮
        let full = shrink(p.img, 1280, 0.72);
        for (const [side, q] of [[1024, 0.65], [800, 0.6], [640, 0.55]]) {
          if (full.length <= 900000) break;
          full = shrink(p.img, side, q);
        }
        if (full.length > 900000) throw new Error('too-large');
        const imageId = await Api.addDoc('chat_images', { data: full, sender: state.userId, sent_at: Date.now() });
        await Api.sendMessage('', { thumb: p.thumb, image_id: imageId });
      } catch (e) { console.error(e); failed++; }
      sentCount++;
    }
    const total = pendingPhotos.length;
    const sent = sentCount - failed;
    const stopped = cancelPhotos && sentCount < total;
    sendingPhotos = false; pendingPhotos = [];
    closeSheet();
    toast(stopped ? `已取消，送出了 ${sent} 張` : failed ? `送出 ${sent} 張，${failed} 張失敗` : `已送出 ${sent} 張照片`);
    scrollChat();
  }

  async function openImage(id) {
    const m = findById(state.messages, id);
    if (!m) return;
    $sheet.innerHTML = `
      <div class="viewer" data-act="close">
        <img src="${esc(m.thumb)}" alt="照片" class="loading">
        <div class="viewer-bar">
          <span>${esc(nameOf(m.sender))}　${stamp(m.sent_at)}</span>
          ${canRecall(m) ? `<button class="recall" data-act="recall" data-id="${esc(m.id)}">收回</button>` : ''}
          <button class="link-btn" data-act="close">關閉</button>
        </div>
      </div>`;
    try {
      const doc = await Api.getDoc('chat_images', m.image_id);
      const el = $sheet.querySelector('.viewer img');
      if (el && doc && String(doc.data).startsWith('data:image/')) { el.src = doc.data; el.classList.remove('loading'); }
    } catch (e) { console.error(e); toast('原圖讀取失敗'); }
  }

  async function onRecall(id) {
    state.menuMsg = null;
    const msg = findById(state.messages, id);
    const imageId = msg && msg.image_id;
    if ($sheet.querySelector('.viewer')) closeSheet();
    try {
      await Api.recallMessage(id, !!imageId);
      if (imageId) Api.deleteDoc('chat_images', imageId).catch((e) => console.warn(e));
      toast('已收回');
    }
    catch (e) {
      console.error(e);
      refreshChat(false);
      toast('收回失敗：超過一小時的訊息不能收回');
    }
  }

  // ---------- 我有話要說 ----------
  function postListHtml() {
    if (!state.posts.length) return `
      <div class="empty big">
        <p>還沒有人發話。有事要某個人回答時，從這裡說。</p>
      </div>`;
    return state.posts.slice().sort((a, b) => b.created_at - a.created_at).map((p) => {
      const mine = p.author === state.userId;
      const tagged = p.to.includes(state.userId);
      const needsMe = tagged && !repliedBy(p, state.userId);
      const replies = state.replies.filter((r) => r.post_id === p.id);
      const author = member(p.author);
      return `
        <article class="post ${needsMe ? 'needs' : ''}">
          <header>
            ${author ? avatarHtml(author, 'sm') : ''}
            <b>${esc(nameOf(p.author))}</b>
            <time>${stamp(p.created_at)}</time>
            ${needsMe ? '<span class="flag">等你回覆</span>' : ''}
          </header>
          <p class="post-text">${esc(p.text)}</p>
          <div class="post-to">給
            ${p.to.map((id) => `<span class="who ${repliedBy(p, id) ? 'done' : ''}" style="--who:${esc(colorOf(id))}">${esc(nameOf(id))}${repliedBy(p, id) ? ' ✓' : ''}</span>`).join('')}
          </div>
          ${replies.map((r) => `
            <div class="reply" style="--who:${esc(colorOf(r.author))}">
              <b>${esc(nameOf(r.author))}</b><span>${esc(r.text)}</span><time>${stamp(r.created_at)}</time>
            </div>`).join('')}
          ${tagged ? `
            <form class="reply-form" data-post="${esc(p.id)}">
              <input id="reply-${esc(p.id)}" name="text" type="text" placeholder="回覆${esc(nameOf(p.author))}" value="${esc(state.postDrafts[p.id] || '')}" maxlength="2000" autocomplete="off" enterkeyhint="send" aria-label="回覆">
              <button type="submit" class="send sm" aria-label="送出回覆">${ICON.send}</button>
            </form>` : ''}
          ${mine ? `<button class="link-btn del" data-act="del-post" data-id="${esc(p.id)}">刪除</button>` : ''}
        </article>`;
    }).join('');
  }

  function viewPosts() {
    const b = (v, label, dot) => `<button class="${state.postsView === v ? 'on' : ''} ${dot ? 'dot' : ''}" data-act="posts-view" data-view="${v}" ${state.postsView === v ? 'aria-pressed="true"' : ''}>${label}</button>`;
    const sw = `<div class="switcher" role="group" aria-label="留言或投票">${b('posts', '留言', waitingForMe())}${b('polls', '投票', pollsForMe().length > 0)}</div>`;
    if (state.postsView === 'polls') return sw + `
      <header class="plain-head"><h1>投票</h1><p>全家都看得到誰選了什麼</p></header>
      <div id="poll-list">${pollListHtml()}</div>`;
    return sw + `
      <header class="plain-head"><h1>我有話要說</h1><p>被標註的人才能回覆</p></header>
      <div id="post-list">${postListHtml()}</div>`;
  }

  // ---------- 投票 ----------
  // 一則投票。home = true 時是首頁用的精簡版（沒有結束、刪除按鈕）
  function pollCardHtml(p, home) {
    const over = pollOver(p);
    const votes = state.votes.filter((v) => v.poll_id === p.id && member(v.uid));
    const mine = votes.find((v) => v.uid === state.userId);
    const waiting = state.members.filter((m) => !votes.some((v) => v.uid === m.id));
    const author = member(p.author);
    const top = Math.max(0, ...p.options.map((_, i) => votes.filter((v) => v.choice === i).length));
    const editing = !over && state.pollEdit === p.id;
    // 有發起人以外的人投過票，就不能刪除，只能作廢
    const othersVoted = !!p.others_voted || votes.some((v) => v.uid !== p.author);
    const due = !p.deadline ? '' : over ? `${shortDate(p.deadline)}已截止`
      : p.deadline === today() ? '今天截止' : `${shortDate(p.deadline)}截止`;
    return `
        <article class="post poll ${!over && !mine ? 'needs' : ''} ${over ? 'closed' : ''} ${p.voided ? 'voided' : ''} ${editing ? 'editing' : ''}">
          <header>
            ${author ? avatarHtml(author, 'sm') : ''}
            <b>${esc(nameOf(p.author))}</b>
            <time>${stamp(p.created_at)}</time>
            ${p.voided ? '<span class="flag done">已作廢</span>' : over ? '<span class="flag done">已結束</span>' : !mine ? '<span class="flag">等你投票</span>' : ''}
          </header>
          <p class="post-text">${esc(p.question)}</p>
          ${editing ? '<p class="pick-hint">點一個選項就會送出</p>' : ''}
          <div class="opts">
            ${p.options.map((opt, i) => {
              const who = votes.filter((v) => v.choice === i);
              const pct = Math.round(who.length / Math.max(1, state.members.length) * 100);
              return `
              <button class="opt ${mine && mine.choice === i ? 'mine' : ''} ${over && !p.voided && top > 0 && who.length === top ? 'win' : ''}" data-act="vote" data-id="${esc(p.id)}" data-choice="${i}" ${editing ? '' : 'disabled'} ${mine && mine.choice === i ? 'aria-pressed="true"' : ''}>
                <span class="opt-bar" style="width:${pct}%"></span>
                <span class="opt-text">${esc(opt)}</span>
                <span class="opt-count">${who.length} 票</span>
                <span class="opt-who">${who.map((v) => `<span class="who" style="--who:${esc(colorOf(v.uid))}">${esc(nameOf(v.uid))}</span>`).join('')}</span>
              </button>`;
            }).join('')}
          </div>
          <p class="poll-foot">${due ? `<b>${due}</b>　` : ''}${votes.length} / ${state.members.length} 人已投${waiting.length && !over ? '　還沒投：' + esc(waiting.map((m) => m.display_name).join('、')) : ''}</p>
          ${over ? '' : `<button class="btn ghost small vote-btn" data-act="poll-edit" data-id="${esc(p.id)}">${editing ? '取消' : mine ? '修改我的票' : '我要投票'}</button>`}
          ${!home && p.author === state.userId ? `
            <div class="poll-actions">
              ${over ? '' : `<button class="link-btn del" data-act="close-poll" data-id="${esc(p.id)}">結束投票</button>`}
              ${othersVoted
                ? (p.voided ? '' : `<button class="link-btn del" data-act="void-poll" data-id="${esc(p.id)}">作廢</button>`)
                : `<button class="link-btn del" data-act="del-poll" data-id="${esc(p.id)}">刪除</button>`}
            </div>
            ${othersVoted && !p.voided ? '<p class="hint">已經有其他人投票，所以不能刪除，只能作廢。</p>' : ''}` : ''}
        </article>`;
  }

  const pollOrder = (a, b) => (pollOver(a) - pollOver(b)) || (b.created_at - a.created_at);

  // 歷史紀錄裡的一列：只有標題和結果；作廢的只有標題。
  // 點一下有結果的那一列，可以展開看每個選項是誰投的。
  function pollResultText(p) {
    const votes = state.votes.filter((v) => v.poll_id === p.id && member(v.uid));
    const counts = p.options.map((_, i) => votes.filter((v) => v.choice === i).length);
    const top = Math.max(0, ...counts);
    if (!top) return '沒有人投票';
    const winners = p.options.filter((_, i) => counts[i] === top);
    return winners.length > 1 ? `平手：${winners.join('、')}（各 ${top} 票）` : `${winners[0]}（${top} 票）`;
  }
  function pollHistoryRow(p) {
    const d = new Date(p.created_at);
    const date = `${d.getMonth() + 1}/${d.getDate()}`;
    if (p.voided) return `
      <div class="hist voided">
        <span class="hist-date">${date}</span>
        <span class="hist-title">${esc(p.question)}</span>
        <span class="hist-tag">已作廢</span>
      </div>`;
    const open = state.pollOpen === p.id;
    return `
      <button class="hist ${open ? 'open' : ''}" data-act="poll-open" data-id="${esc(p.id)}" aria-expanded="${open}">
        <span class="hist-date">${date}</span>
        <span class="hist-title">${esc(p.question)}</span>
        <span class="hist-result">${esc(pollResultText(p))}</span>
      </button>
      ${open ? pollCardHtml(p, false) : ''}`;
  }

  // 投票頁分成兩份：進行中的，和歷史紀錄（已結束、過了截止日、已作廢的）
  function pollListHtml() {
    const active = state.polls.filter((p) => !pollOver(p)).sort((a, b) => b.created_at - a.created_at);
    const past = state.polls.filter(pollOver).sort((a, b) => b.created_at - a.created_at);
    const tab = (history, label, n) => `<button class="${state.pollHistory === history ? 'on' : ''}" data-act="poll-history" data-history="${history ? 1 : ''}" ${state.pollHistory === history ? 'aria-pressed="true"' : ''}>${label}<small>${n}</small></button>`;
    const bar = `<div class="subtabs" role="group" aria-label="進行中或歷史紀錄">${tab(false, '進行中', active.length)}${tab(true, '歷史紀錄', past.length)}</div>`;
    const list = state.pollHistory ? past : active;
    if (list.length && state.pollHistory) return bar + `<div class="history">${past.map(pollHistoryRow).join('')}</div>`;
    if (list.length) return bar + list.map((p) => pollCardHtml(p, false)).join('');
    return bar + (state.pollHistory
      ? '<div class="empty big"><p>還沒有歷史紀錄。投票結束、過了截止日或作廢之後，會移到這裡。</p></div>'
      : `<div class="empty big">
          <p>目前沒有進行中的投票。「今天誰回家吃晚餐」「週末去哪裡」這種事，用投票問最快。</p>
        </div>`);
  }

  // 首頁的投票區：進行中的投票，加上今天發起或今天截止的（即使已經結束，也看得到當天的結果）
  function homePollsHtml() {
    const t = today();
    // 依發起時間由舊到新排，這樣 1、2、3… 的編號不會因為有新投票而變動
    // 作廢的投票不放在首頁（在「看全部」的列表裡還看得到）
    const list = state.polls.filter((p) => !p.voided && (!pollOver(p) || ymd(new Date(p.created_at)) === t || p.deadline === t))
      .sort((a, b) => a.created_at - b.created_at);
    if (!list.length) return '';
    // 只用一個固定的位置顯示一則；有多則時，上方出現 1、2、3… 可以切換
    const needsMe = (p) => !pollOver(p) && !state.votes.some((v) => v.poll_id === p.id && v.uid === state.userId);
    // 沒有特別選的時候：先顯示還在等我投的那一則，都投過了就顯示最新的
    const current = list.find((p) => p.id === state.homePollId) || list.find(needsMe) || list[list.length - 1];
    state.homePollId = current.id;
    const pager = list.length > 1 ? `
      <span class="pager" role="group" aria-label="切換投票">
        ${list.map((p, i) => `<button class="${p.id === current.id ? 'on' : ''} ${needsMe(p) ? 'dot' : ''}" data-act="home-poll" data-id="${esc(p.id)}" aria-label="第 ${i + 1} 則投票${needsMe(p) ? '，等你投票' : ''}" ${p.id === current.id ? 'aria-pressed="true"' : ''}>${i + 1}</button>`).join('')}
      </span>` : '';
    return `<h2>投票${pager}<button class="link-btn" data-act="open-polls">看全部</button></h2>${pollCardHtml(current, true)}`;
  }

  function refreshPolls() {
    refreshTodos();
    const home = document.getElementById('home-polls');
    if (home) { home.innerHTML = homePollsHtml(); home.hidden = !home.innerHTML; }
    const el = document.getElementById('poll-list');
    if (el) el.innerHTML = pollListHtml();
    document.querySelectorAll('.switcher [data-act="posts-view"]').forEach((btn) => {
      btn.classList.toggle('dot', btn.dataset.view === 'polls' ? pollsForMe().length > 0 : waitingForMe());
    });
  }

  async function onVote(btn) {
    const p = findById(state.polls, btn.dataset.id);
    if (!p || pollOver(p)) return toast('這個投票已經結束了');
    if (state.pollEdit !== p.id) return;      // 沒有先按「我要投票／修改我的票」，選項是鎖住的
    state.pollEdit = null;
    try {
      await Api.setDoc('poll_votes', p.id + '_' + state.userId,
        { poll_id: p.id, uid: state.userId, choice: Number(btn.dataset.choice), voted_at: Date.now() });
      // 記下「有發起人以外的人投過票」，之後這則投票就不能刪除，只能作廢
      if (p.author !== state.userId && !p.others_voted) Api.updateDoc('polls', p.id, { others_voted: true }).catch((e) => console.warn(e));
      toast('已投票');
      refreshPolls();
    } catch (e) { console.error(e); toast('投票沒有成功，請再試一次'); }
  }

  async function onPollAction(btn, kind) {
    const words = { del: ['再按一次確定刪除', '已刪除'], close: ['再按一次確定結束', '投票已結束'], void: ['再按一次確定作廢', '投票已作廢'] }[kind];
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = words[0]; return; }
    btn.disabled = true;
    try {
      if (kind === 'del') await Api.deleteDoc('polls', btn.dataset.id);
      else if (kind === 'void') await Api.updateDoc('polls', btn.dataset.id, { closed: true, voided: true });
      else await Api.updateDoc('polls', btn.dataset.id, { closed: true });
      toast(words[1]);
    } catch (e) { console.error(e); btn.disabled = false; toast('沒有成功，請再試一次'); }
  }

  function openPollSheet() {
    showSheet('poll-form', {
      title: '發起投票', submit: '送出', focus: true,
      body: `
      <input class="title-input" name="question" placeholder="想問什麼？" maxlength="80" autocomplete="off">
      <label>選項（一行一個，2 到 6 個）<textarea name="options" rows="5" maxlength="300" placeholder="選項一&#10;選項二"></textarea></label>
      <label>截止日期<input type="date" name="deadline" value="${today()}" min="${today()}"></label>
      <p class="hint">到截止日當天結束前都可以投票，過了就自動結束。清空日期的話，要由你手動結束。</p>
      <p class="hint">常用的可以直接套用：</p>
      <div class="presets">
        <button type="button" class="chip-btn" data-act="poll-preset" data-q="今天誰回家吃晚餐？" data-o="回家吃|不回家吃|會晚一點">晚餐調查</button>
        <button type="button" class="chip-btn" data-act="poll-preset" data-q="這個週末想去哪裡？" data-o="待在家|出去走走|去阿嬤家">週末去哪</button>
        <button type="button" class="chip-btn" data-act="poll-preset" data-q="可以嗎？" data-o="可以|不行">可以／不行</button>
      </div>`
    });
  }

  // ---------- 考試成績 ----------
  // 每位小朋友一份。小朋友只看得到、只能改自己的；家長看得到兩位，也可以幫忙登記或修改。
  const canEditScore = (sc) => !amChild() || sc.kid === state.userId;
  const pct = (sc) => Math.round(sc.score / sc.full * 100);
  // 成績依「年級＋學期」分開：國中一到三年級，各有上、下學期
  const TERMS = ['國一上', '國一下', '國二上', '國二下', '國三上', '國三下'];
  const GRADES = ['國一', '國二', '國三'];          // 學期 = 年級 + 上／下，例如「國二上」
  const TERM_KEY = 'family-score-term';
  function setScoreTerm(term) {
    state.scoreTerm = term;
    try { if (term) localStorage.setItem(TERM_KEY, term); else localStorage.removeItem(TERM_KEY); } catch (e) { /* 忽略 */ }
  }
  // 考試科目沒有內建的，全部由家長在「設定」裡新增
  const subjectList = () => state.subjects.map((x) => x.label);

  function viewScores() {
    const list = kids();
    if (!list.length) return `
      <header class="plain-head"><h1>成績</h1></header>
      <div class="empty big"><p>${isAdmin()
        ? '還沒設定誰是小朋友。到「設定」點小朋友的名字，打開「這是小朋友」，這裡就會出現他的成績紀錄。'
        : '還沒設定誰是小朋友，請管理員到「設定」裡設定。'}</p></div>`;

    const kidId = amChild() ? state.userId : (list.some((k) => k.id === state.ledgerKid) ? state.ledgerKid : list[0].id);
    state.ledgerKid = kidId;
    const kid = member(kidId);
    const mineAll = state.scores.filter((x) => x.kid === kidId).sort((a, b) => b.date.localeCompare(a.date));
    if (state.scoreTerm && !TERMS.includes(state.scoreTerm)) state.scoreTerm = '';
    const all = state.scoreTerm ? mineAll.filter((x) => x.term === state.scoreTerm) : mineAll;
    // 學期選擇：三個年級並排，每個年級下面是「上｜下」一組；最左邊是「全部」
    const termBar = `
      <div class="termgrid" role="group" aria-label="選擇年級與學期">
        <button class="term-all ${state.scoreTerm ? '' : 'on'}" data-act="score-term" data-term="" ${state.scoreTerm ? '' : 'aria-pressed="true"'}>全部</button>
        ${GRADES.map((g) => `
          <div class="grade ${state.scoreTerm.startsWith(g) ? 'on' : ''}">
            <span class="grade-name">${g}</span>
            <span class="pair">
              ${['上', '下'].map((h) => {
                const t = g + h;
                return `<button class="${state.scoreTerm === t ? 'on' : ''} ${mineAll.some((x) => x.term === t) ? 'has' : ''}" data-act="score-term" data-term="${t}" aria-label="${g}${h}學期${mineAll.some((x) => x.term === t) ? '，有紀錄' : ''}" ${state.scoreTerm === t ? 'aria-pressed="true"' : ''}>${h}</button>`;
              }).join('')}
            </span>
          </div>`).join('')}
      </div>`;

    const picker = !amChild() && list.length > 1 ? `
      <div class="kid-picker" role="group" aria-label="選擇小朋友">
        ${list.map((k) => `<button class="${k.id === kidId ? 'on' : ''}" style="--who:${esc(k.color)}" data-act="ledger-kid" data-id="${esc(k.id)}" ${k.id === kidId ? 'aria-pressed="true"' : ''}>${esc(k.display_name)}</button>`).join('')}
      </div>` : '';

    if (!all.length) return `
      <header class="plain-head"><h1>成績</h1><p>${amChild() ? '只有你和爸媽看得到' : esc(kid.display_name)}</p></header>
      ${picker}
      ${termBar}
      <div class="empty big"><p>${state.scoreTerm ? state.scoreTerm + '學期還沒有成績紀錄。' : '還沒有成績紀錄。'}</p></div>`;

    // 各科：最近一次、和上一次比、平均
    const subjects = Array.from(new Set(all.map((x) => x.subject)));
    if (state.scoreSubject && !subjects.includes(state.scoreSubject)) state.scoreSubject = '';
    const summary = subjects.map((sub) => {
      const rows = all.filter((x) => x.subject === sub);
      const avg = Math.round(rows.reduce((n, x) => n + pct(x), 0) / rows.length);
      const diff = rows.length > 1 ? pct(rows[0]) - pct(rows[1]) : null;
      const trend = diff === null ? '' : diff > 0 ? `<em class="up">▲ ${diff}</em>` : diff < 0 ? `<em class="down">▼ ${-diff}</em>` : '<em>持平</em>';
      return `
        <button class="subject ${state.scoreSubject === sub ? 'on' : ''}" data-act="score-subject" data-subject="${esc(sub)}" ${state.scoreSubject === sub ? 'aria-pressed="true"' : ''}>
          <span class="subject-name">${esc(sub)}</span>
          <span class="subject-last">${rows[0].score}<small>/${rows[0].full}</small></span>
          <span class="subject-meta">${trend}<span>平均 ${avg}%・${rows.length} 次</span></span>
        </button>`;
    }).join('');

    const shown = state.scoreSubject ? all.filter((x) => x.subject === state.scoreSubject) : all;
    return `
      <header class="plain-head"><h1>成績</h1><p>${amChild() ? '只有你和爸媽看得到' : esc(kid.display_name) + '的紀錄'}</p></header>
      ${picker}
      ${termBar}
      <section class="subjects" style="--who:${esc(kid.color)}" aria-label="各科最近一次成績">${summary}</section>
      <section class="entries">
        <h2>${state.scoreTerm ? state.scoreTerm + '　' : ''}${state.scoreSubject ? esc(state.scoreSubject) + '的紀錄' : '全部紀錄'}${state.scoreSubject ? '<button class="link-btn" data-act="score-subject" data-subject="">看全部</button>' : ''}</h2>
        ${shown.map((x) => {
          const d = parse(x.date);
          const inner = `
            <span class="entry-date">${d.getMonth() + 1}/${d.getDate()}</span>
            <span class="entry-note"><b>${esc(x.subject)}</b>　${esc(x.title)}<small>${x.term && !state.scoreTerm ? esc(x.term) + (x.note ? '　' : '') : ''}${esc(x.note || '')}</small></span>
            <span class="entry-amount">${x.score}<small>/${x.full}</small></span>`;
          return canEditScore(x)
            ? `<button class="entry score" data-act="edit-score" data-id="${esc(x.id)}">${inner}</button>`
            : `<div class="entry score">${inner}</div>`;
        }).join('')}
      </section>`;
  }

  function openScoreSheet(sc) {
    const x = sc || { subject: state.scoreSubject || '', term: state.scoreTerm || '', title: '', date: today(), score: '', full: 100, note: '' };
    const kid = member(sc ? sc.kid : state.ledgerKid);
    // 科目只能從家長設定的清單裡選；編輯舊紀錄時，如果它的科目已經被刪掉，仍然保留這個選項
    const choices = subjectList().concat(x.subject && !subjectList().includes(x.subject) ? [x.subject] : []);
    showSheet('score-form', {
      title: kid.display_name + '的成績', focus: false, footer: sc ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(x.id || '')}">
      <input type="hidden" name="kid" value="${esc(kid.id)}">
      <fieldset class="terms-pick">
        <legend>年級與學期</legend>
        <div class="termgrid in-form">
          ${GRADES.map((g) => `
            <div class="grade">
              <span class="grade-name">${g}</span>
              <span class="pair">
                ${['上', '下'].map((h) => `<label><input type="radio" name="term" value="${g + h}" aria-label="${g}${h}學期" ${x.term === g + h ? 'checked' : ''}><span>${h}</span></label>`).join('')}
              </span>
            </div>`).join('')}
        </div>
      </fieldset>
      <fieldset class="seg">
        <legend>科目</legend>
        ${choices.map((sub) => `
          <label style="--cat:${esc(kid.color)}"><input type="radio" name="subject" value="${esc(sub)}" ${x.subject === sub ? 'checked' : ''}><span>${esc(sub)}</span></label>`).join('')}
        ${choices.length ? '' : `<p class="hint">${amChild() ? '還沒有科目，請爸媽先到「設定」的「考試科目」新增。' : '還沒有科目，請先到「設定」的「考試科目」新增。'}</p>`}
      </fieldset>
      <label>考試名稱<input type="text" name="title" value="${esc(x.title)}" maxlength="40" autocomplete="off" placeholder="例如：第二次段考"></label>
      <div class="row two">
        <label>分數<input class="title-input" type="number" name="score" inputmode="decimal" min="0" step="0.5" value="${esc(x.score)}" placeholder="0"></label>
        <label>滿分<input class="title-input" type="number" name="full" inputmode="decimal" min="1" step="1" value="${esc(x.full)}"></label>
      </div>
      <label>考試日期<input type="date" name="date" value="${esc(x.date)}" max="${today()}"></label>
      <label>備註<textarea name="note" rows="2" maxlength="200" placeholder="錯在哪裡、下次要注意什麼…">${esc(x.note || '')}</textarea></label>`
    });
  }

  // ---------- 家庭旅遊 ----------
  // 鍾家生活 →「旅遊」。每趟旅程底下有四個分頁：行程（每天要去哪）、日誌（文字和照片）、行李（要帶的東西）、花費。
  // 資料：trips = 旅程；trip_items = 旅程底下的每一筆，用 kind 區分 plan / journal / pack / cost。
  const tripOf = (id) => findById(state.trips, id);
  // 整趟旅程和每則日誌：只有建立的人和管理員可以刪除
  const canDeleteTrip = (t) => isAdmin() || t.created_by === state.userId;
  const canDeleteJournal = (j) => isAdmin() || j.author === state.userId;
  const itemsOf = (tripId, kind) => state.tripItems.filter((x) => x.trip_id === tripId && x.kind === kind);
  const tripDays = (t) => daysBetween(t.start_date, t.end_date) + 1;
  function tripStatus(t) {
    const now = today();
    if (now < t.start_date) { const n = daysBetween(now, t.start_date); return { cls: 'soon', text: n === 1 ? '明天出發' : '還有 ' + n + ' 天' }; }
    if (now > t.end_date) return { cls: 'past', text: '已結束' };
    return { cls: 'now', text: '旅行中　第 ' + (daysBetween(t.start_date, now) + 1) + ' 天' };
  }
  const rangeText = (t) => (t.start_date === t.end_date ? shortDate(t.start_date)
    : shortDate(t.start_date) + ' – ' + shortDate(t.end_date) + '　' + tripDays(t) + ' 天');

  function viewTravel() {
    const t = state.tripId && tripOf(state.tripId);
    if (state.tripId && !t) state.tripId = null;
    return t ? viewTrip(t) : viewTripList();
  }

  function viewTripList() {
    const now = today();
    const coming = state.trips.filter((t) => t.end_date >= now).sort((a, b) => a.start_date.localeCompare(b.start_date));
    const past = state.trips.filter((t) => t.end_date < now).sort((a, b) => b.start_date.localeCompare(a.start_date));
    const card = (t) => {
      const st = tripStatus(t);
      const cover = itemsOf(t.id, 'journal').filter((j) => j.thumb).sort((a, b) => a.date.localeCompare(b.date))[0];
      return `
        <button class="trip ${st.cls}" data-act="open-trip" data-id="${esc(t.id)}">
          ${cover ? `<img class="trip-cover" src="${esc(cover.thumb)}" alt="">` : `<span class="trip-cover blank" aria-hidden="true">${esc((t.place || t.title).slice(0, 1))}</span>`}
          <span class="trip-main">
            <span class="trip-title">${esc(t.title)}</span>
            <span class="trip-sub">${t.place ? esc(t.place) + '　' : ''}${rangeText(t)}</span>
            <span class="trip-meta"><em class="${st.cls}">${st.text}</em>行程 ${itemsOf(t.id, 'plan').length}　日誌 ${itemsOf(t.id, 'journal').length}</span>
          </span>
        </button>`;
    };
    return `
      <header class="plain-head"><h1>家庭旅遊</h1><p>${state.trips.length ? state.trips.length + ' 趟旅程' : ''}</p></header>
      ${state.trips.length ? '' : `
        <div class="empty big">
          <p>還沒有旅程。把下一趟想去的地方建起來，全家一起排行程、列行李，回來再寫日誌、放照片。</p>
        </div>`}
      ${coming.length ? `<section class="trips"><h2>即將出發與進行中</h2>${coming.map(card).join('')}</section>` : ''}
      ${past.length ? `<section class="trips"><h2>去過的地方</h2>${past.map(card).join('')}</section>` : ''}
      <section class="old-notes">
        <button class="link-btn" data-act="old-notes" aria-expanded="${state.showOldNotes}">${state.showOldNotes ? '收起雜記' : '雜記'}</button>
        ${state.showOldNotes ? `
          ${state.notes.length ? `<div class="notes">${state.notes.map((n) => `
            <button class="note ${n.pinned ? 'pinned' : ''}" data-act="edit-note" data-id="${esc(n.id)}">
              ${n.pinned ? '<span class="pin">置頂</span>' : ''}
              <span class="note-title">${esc(n.title || '（沒有標題）')}</span>
              ${n.body ? `<span class="note-body">${esc(n.body)}</span>` : ''}
            </button>`).join('')}</div>` : '<p class="hint">沒有雜記。</p>'}
          <button class="link-btn" data-act="new-note">新增一則雜記</button>` : ''}
      </section>`;
  }

  function viewTrip(t) {
    const st = tripStatus(t);
    const tab = (id, label, n) => `<button class="${state.tripTab === id ? 'on' : ''}" data-act="trip-tab" data-tab="${id}" ${state.tripTab === id ? 'aria-pressed="true"' : ''}>${label}<small>${n}</small></button>`;
    const body = { plan: tripPlanHtml, journal: tripJournalHtml, pack: tripPackHtml, cost: tripCostHtml }[state.tripTab](t);
    const left = itemsOf(t.id, 'pack').filter((x) => !x.done).length;
    return `
      <button class="link-btn back" data-act="trip-back">‹ 所有旅程</button>
      <section class="trip-head ${st.cls}">
        <div>
          <h1>${esc(t.title)}</h1>
          <p>${t.place ? esc(t.place) + '　' : ''}${rangeText(t)}</p>
          ${t.note ? `<p class="trip-note">${esc(t.note)}</p>` : ''}
        </div>
        <div class="trip-side">
          <em class="${st.cls}">${st.text}</em>
          <button class="chip-btn" data-act="edit-trip" data-id="${esc(t.id)}">編輯</button>
        </div>
      </section>
      <div class="subtabs four" role="group" aria-label="旅程的內容">
        ${tab('plan', '行程', itemsOf(t.id, 'plan').length)}${tab('journal', '日誌', itemsOf(t.id, 'journal').length)}${tab('pack', '行李', left)}${tab('cost', '花費', itemsOf(t.id, 'cost').length)}
      </div>
      <div id="trip-body">${body}</div>`;
  }

  // 行程：依旅程的每一天分組
  function tripPlanHtml(t) {
    const items = itemsOf(t.id, 'plan');
    let html = '';
    for (let d = t.start_date, i = 1; d <= t.end_date; d = addDays(d, 1), i++) {
      const rows = items.filter((x) => x.date === d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      html += `
        <section class="plan-day ${d === today() ? 'today' : ''}">
          <h2><b>第 ${i} 天</b>${shortDate(d)}<button class="link-btn" data-act="new-plan" data-date="${d}">＋ 加行程</button></h2>
          ${rows.length ? rows.map((x) => `
            <button class="plan" data-act="edit-plan" data-id="${esc(x.id)}">
              <span class="plan-time">${esc(x.time || '')}</span>
              <span class="plan-main">
                <span class="plan-title">${esc(x.title)}</span>
                ${x.place ? `<span class="plan-place">${esc(x.place)}</span>` : ''}
                ${x.note ? `<span class="plan-note">${esc(x.note)}</span>` : ''}
              </span>
            </button>`).join('') : '<p class="none">這天還沒有安排。</p>'}
        </section>`;
    }
    const stray = items.filter((x) => x.date < t.start_date || x.date > t.end_date);
    if (stray.length) html += `
        <section class="plan-day">
          <h2><b>不在旅程日期內</b></h2>
          ${stray.map((x) => `<button class="plan" data-act="edit-plan" data-id="${esc(x.id)}"><span class="plan-time">${shortDate(x.date).replace(/（.*/, '')}</span><span class="plan-main"><span class="plan-title">${esc(x.title)}</span></span></button>`).join('')}
        </section>`;
    return html;
  }

  // 日誌：照日期排，每則有作者、文字、可以附一張照片
  function tripJournalHtml(t) {
    const items = itemsOf(t.id, 'journal').sort((a, b) => a.date.localeCompare(b.date) || a.created_at - b.created_at);
    if (!items.length) return `
      <div class="empty big"><p>還沒有日誌。今天去了哪、吃了什麼、最好笑的事，寫下來，再放一張照片。</p>
</div>`;
    return items.map((j) => {
      const who = member(j.author);
      const mine = j.author === state.userId;
      const inner = `
          <header>${who ? avatarHtml(who, 'sm') : ''}<b>${esc(nameOf(j.author))}</b><time>${shortDate(j.date)}</time></header>
          ${j.text ? `<p class="post-text">${esc(j.text)}</p>` : ''}`;
      return `
        <article class="post journal" style="--who:${esc(colorOf(j.author))}">
          ${mine ? `<button class="journal-main" data-act="edit-journal" data-id="${esc(j.id)}">${inner}</button>` : `<div class="journal-main">${inner}</div>`}
          ${j.thumb ? `<button class="journal-photo" data-act="trip-photo" data-id="${esc(j.id)}" aria-label="照片，點一下放大"><img src="${esc(j.thumb)}" alt="照片"></button>` : ''}
          ${!mine && canDeleteJournal(j) ? `<button class="link-btn danger journal-del" data-act="del-journal" data-id="${esc(j.id)}">刪除這則日誌</button>` : ''}
        </article>`;
    }).join('');
  }

  // 行李：像採買清單一樣，打勾表示帶了
  function tripPackHtml(t) {
    const items = itemsOf(t.id, 'pack').sort((a, b) => (a.done - b.done) || (a.created_at - b.created_at));
    return `
      <form class="shop-add" id="pack-form">
        <input id="pack-input" name="text" type="text" placeholder="要帶什麼？" maxlength="60" autocomplete="off" enterkeyhint="done" aria-label="要帶什麼">
        <button type="submit" class="send" aria-label="加入行李清單">${ICON.plus}</button>
      </form>
      ${items.length ? `
      <div class="shop-items">
        ${items.map((i) => `
          <div class="pack-row">
            <button class="shop-item ${i.done ? 'done' : ''}" data-act="pack-toggle" data-id="${esc(i.id)}" aria-pressed="${!!i.done}">
              <span class="check" aria-hidden="true"></span>
              <span class="shop-text">${esc(i.text)}</span>
              <small>${esc(i.done && i.done_by ? nameOf(i.done_by) + '帶了' : '')}</small>
            </button>
            <button class="pack-del" data-act="pack-del" data-id="${esc(i.id)}" aria-label="刪除「${esc(i.text)}」">×</button>
          </div>`).join('')}
      </div>` : '<div class="empty big"><p>行李清單是空的。證件、充電器、藥品、雨具，想到就加上來。</p></div>'}`;
  }

  // 花費：總額，以及每個人付了多少
  function tripCostHtml(t) {
    const items = itemsOf(t.id, 'cost').sort((a, b) => b.date.localeCompare(a.date) || b.created_at - a.created_at);
    if (!items.length) return `
      <div class="empty big"><p>還沒有花費紀錄。交通、住宿、門票、吃的，記下來，回來就知道這趟花了多少。</p>
</div>`;
    const total = items.reduce((n, x) => n + x.amount, 0);
    const payers = state.members.map((m) => [m, items.filter((x) => x.paid_by === m.id).reduce((n, x) => n + x.amount, 0)]).filter(([, n]) => n > 0);
    return `
      <section class="wallet" style="--who:var(--c-trip)">
        <div class="wallet-name">這趟總共花了</div>
        <div class="wallet-left">${money(total)}</div>
        <div class="wallet-row">
          <span>平均每天 <b>${money(Math.round(total / tripDays(t)))}</b></span>
          ${payers.map(([m, n]) => `<span>${esc(m.display_name)}付 <b>${money(n)}</b></span>`).join('')}
        </div>
      </section>
      <section class="entries">
        <h2>明細</h2>
        ${items.map((x) => {
          const d = parse(x.date);
          return `
          <button class="entry" data-act="edit-cost" data-id="${esc(x.id)}">
            <span class="entry-date">${d.getMonth() + 1}/${d.getDate()}</span>
            <span class="entry-note">${esc(x.title)}${member(x.paid_by) ? `<small class="payer">${esc(nameOf(x.paid_by))}付</small>` : ''}</span>
            <span class="entry-amount">${money(x.amount)}</span>
          </button>`;
        }).join('')}
      </section>`;
  }

  // 有人改了旅遊的資料：正在看旅遊頁就更新。行李輸入框正在打字時，render() 會把焦點和內容留住。
  function refreshTravel() {
    if (state.tab === 'notes' && state.notesView === 'hub' && !$sheet.innerHTML) return render();
    if (state.tab !== 'notes' || state.notesView !== 'notes' || $sheet.innerHTML) return;
    const input = document.getElementById('pack-input');
    const draft = input ? input.value : '';
    render();
    const again = document.getElementById('pack-input');
    if (again && draft) again.value = draft;
  }

  function openTripSheet(trip) {
    const t = trip || { title: '', place: '', start_date: today(), end_date: today(), note: '' };
    showSheet('trip-form', {
      title: trip ? '編輯旅程' : '新增旅程', focus: !trip,
      footer: trip && canDeleteTrip(trip) ? '<button type="button" class="btn danger" data-act="delete">刪除整趟旅程</button>' : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(t.id || '')}">
      <input class="title-input" name="title" placeholder="旅程名稱，例如：寒假花蓮三日遊" value="${esc(t.title)}" maxlength="40" autocomplete="off">
      <label>地點<input type="text" name="place" value="${esc(t.place || '')}" maxlength="40" autocomplete="off" placeholder="例如：花蓮"></label>
      <div class="row two">
        <label>出發<input type="date" name="start_date" value="${esc(t.start_date)}"></label>
        <label>回程<input type="date" name="end_date" value="${esc(t.end_date)}"></label>
      </div>
      <label>備註<textarea name="note" rows="3" maxlength="500" placeholder="住哪裡、訂位代號、集合時間…">${esc(t.note || '')}</textarea></label>
      ${trip ? `<p class="hint">${canDeleteTrip(trip) ? '刪除旅程會連同底下的行程、日誌、行李和花費一起刪掉。' : '這趟旅程是' + esc(nameOf(trip.created_by)) + '建立的，只有建立的人和管理員可以刪除。'}</p>` : '<p class="hint">建立後，這趟旅程會自動出現在首頁的月曆上。</p>'}`
    });
  }

  function openPlanSheet(item, date) {
    const t = tripOf(state.tripId);
    const now = today();
    const x = item || { date: date || (now >= t.start_date && now <= t.end_date ? now : t.start_date), time: '', title: '', place: '', note: '' };
    showSheet('plan-form', {
      title: item ? '編輯行程' : '新增行程', focus: !item, footer: item ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(x.id || '')}">
      <input class="title-input" name="title" placeholder="要做什麼？例如：太魯閣步道" value="${esc(x.title)}" maxlength="60" autocomplete="off">
      <div class="row two">
        <label>哪一天<input type="date" name="date" value="${esc(x.date)}" min="${t.start_date}" max="${t.end_date}"></label>
        <label>時間（可不填）<input type="time" name="time" value="${esc(x.time || '')}"></label>
      </div>
      <label>地點<input type="text" name="place" value="${esc(x.place || '')}" maxlength="60" autocomplete="off"></label>
      <label>備註<textarea name="note" rows="3" maxlength="500" placeholder="門票、訂位、交通方式…">${esc(x.note || '')}</textarea></label>`
    });
  }

  function openJournalSheet(item) {
    const t = tripOf(state.tripId);
    const now = today();
    const x = item || { date: now >= t.start_date && now <= t.end_date ? now : t.end_date < now ? t.end_date : t.start_date, text: '' };
    showSheet('journal-form', {
      title: item ? '編輯日誌' : '寫日誌', focus: !item, footer: item ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(x.id || '')}">
      <label>哪一天<input type="date" name="date" value="${esc(x.date)}"></label>
      <label>內容<textarea class="title-input" name="text" rows="6" maxlength="3000" placeholder="今天去了哪裡？最難忘的是什麼？">${esc(x.text || '')}</textarea></label>
      <label>照片（一張，可不放）<input type="file" name="photo" accept="image/*"></label>
      ${item && item.thumb ? '<p class="hint">這則已經有一張照片；選新的會換掉它。</p>' : ''}`
    });
  }

  function openCostSheet(item) {
    const t = tripOf(state.tripId);
    const now = today();
    const x = item || { title: '', amount: '', paid_by: state.userId, date: now >= t.start_date && now <= t.end_date ? now : t.start_date };
    showSheet('cost-form', {
      title: item ? '編輯花費' : '新增花費', focus: !item, footer: item ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(x.id || '')}">
      <label>金額（元）<input class="title-input" type="number" name="amount" inputmode="numeric" min="1" step="1" value="${esc(x.amount)}" placeholder="0"></label>
      <label>項目<input type="text" name="title" value="${esc(x.title)}" maxlength="60" autocomplete="off" placeholder="例如：民宿、火車票、晚餐"></label>
      <fieldset class="seg">
        <legend>誰付的？</legend>
        ${state.members.map((m) => `
          <label style="--cat:${esc(m.color)}"><input type="radio" name="paid_by" value="${esc(m.id)}" ${x.paid_by === m.id ? 'checked' : ''}><span>${esc(m.display_name)}</span></label>`).join('')}
      </fieldset>
      <label>日期<input type="date" name="date" value="${esc(x.date)}"></label>`
    });
  }

  // 存旅程底下的一筆（行程、日誌、行李、花費共用）
  function saveTripItem(kind, id, data) {
    return id ? Api.updateDoc('trip_items', id, data)
      : Api.addDoc('trip_items', { ...data, trip_id: state.tripId, kind, created_by: state.userId, created_at: Date.now() });
  }

  async function onPackAdd(form) {
    const input = form.elements.text;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try { await saveTripItem('pack', null, { text, done: false, done_by: null }); }
    catch (e) { console.error(e); input.value = text; toast('沒有加進去，請再試一次'); }
    const again = document.getElementById('pack-input');
    if (again) again.focus();
  }

  // 管理員刪別人的日誌（自己的日誌從編輯畫面刪）
  async function onDeleteJournal(btn) {
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = '再按一次確定刪除'; return; }
    btn.disabled = true;
    try { await FORMS['journal-form'].remove(btn.dataset.id); toast('已刪除'); render(); }
    catch (e) { console.error(e); btn.disabled = false; toast('刪除失敗，請再試一次'); }
  }

  async function openTripPhoto(id) {
    const j = findById(state.tripItems, id);
    if (!j || !j.thumb) return;
    $sheet.innerHTML = `
      <div class="viewer" data-act="close">
        <img src="${esc(j.thumb)}" alt="照片" class="loading">
        <div class="viewer-bar"><span>${esc(nameOf(j.author))}　${shortDate(j.date)}</span><button class="link-btn" data-act="close">關閉</button></div>
      </div>`;
    try {
      const doc = await Api.getDoc('chat_images', j.image_id);
      const el = $sheet.querySelector('.viewer img');
      if (el && doc && String(doc.data).startsWith('data:image/')) { el.src = doc.data; el.classList.remove('loading'); }
    } catch (e) { console.error(e); toast('原圖讀取失敗'); }
  }

  // ---------- 家庭相簿 ----------
  // 鍾家生活 →「相簿」。日常的照片，按月份看；每張可以留言。
  // 資料：photos = { month, date, caption, thumb（小圖）, image_id（原圖放在 chat_images）, author, created_by, created_at }
  //       photo_comments = { photo_id, month, text, author, created_by, created_at }
  // 只在打開相簿時讀那一個月的照片，不會拖慢 app 啟動。
  const canDeletePhoto = (p) => isAdmin() || p.author === state.userId;
  const commentsOf = (photoId) => state.photoComments.filter((c) => c.photo_id === photoId).sort((a, b) => a.created_at - b.created_at);

  async function loadAlbum() {
    const month = state.albumMonth;
    try {
      const [photos, comments] = await Promise.all([Api.listDocs('photos', ['month', month]), Api.listDocs('photo_comments', ['month', month])]);
      if (month !== state.albumMonth) return;          // 讀的時候已經換到別的月份了
      state.photos = photos.sort((a, b) => b.date.localeCompare(a.date) || b.created_at - a.created_at);
      state.photoComments = comments;
      state.albumLoaded = month;
    } catch (e) { console.error(e); toast('相簿讀取失敗，請確認網路'); }
    if (state.tab === 'notes' && state.notesView === 'album') {
      if (!$sheet.innerHTML) render();
      else if (state.photoId) refreshPhotoComments();
    }
  }

  function viewAlbum() {
    const [y, m] = state.albumMonth.split('-').map(Number);
    const loaded = state.albumLoaded === state.albumMonth;
    const photos = loaded ? state.photos : [];
    // 同一天的照片排在一起
    const days = [];
    photos.forEach((p) => { const last = days[days.length - 1]; if (last && last.date === p.date) last.items.push(p); else days.push({ date: p.date, items: [p] }); });
    return `
      <header class="month-head">
        <h1>${y}年${m}月</h1>
        <div class="month-nav">
          ${state.albumMonth !== today().slice(0, 7) ? '<button class="chip-btn" data-act="album-now">回到本月</button>' : ''}
          <button class="icon-btn" data-act="album-prev" aria-label="上個月">‹</button>
          <button class="icon-btn" data-act="album-next" aria-label="下個月" ${state.albumMonth >= today().slice(0, 7) ? 'disabled' : ''}>›</button>
        </div>
      </header>
      ${!loaded ? '<p class="hint album-wait">讀取照片中…</p>' : !photos.length ? `
        <div class="empty big">
          <p>這個月還沒有照片。今天的晚餐、放學路上、週末出去玩，拍了就放上來，全家都能看、能留言。</p>
        </div>` : `
        <p class="album-count">${photos.length} 張照片</p>
        ${days.map((d) => `
          <section class="album-day">
            <h2>${shortDate(d.date)}</h2>
            <div class="album-grid">
              ${d.items.map((p) => {
                const n = commentsOf(p.id).length;
                return `<button class="album-cell" data-act="open-photo" data-id="${esc(p.id)}" aria-label="${esc(nameOf(p.author))}的照片${p.caption ? '：' + esc(p.caption) : ''}">
                  <img src="${esc(p.thumb)}" alt="" loading="lazy">
                  ${n ? `<span class="album-n">${n} 則留言</span>` : ''}
                </button>`;
              }).join('')}
            </div>
          </section>`).join('')}`}`;
  }

  function openAlbumSheet() {
    showSheet('photo-form', {
      title: '放照片到相簿', submit: '上傳',
      body: `
      <label>照片（一次最多 10 張）<input type="file" name="photos" accept="image/*" multiple></label>
      <label>說明（可不填）<input type="text" name="caption" maxlength="100" autocomplete="off" placeholder="例如：阿嬤家的年夜飯"></label>
      <label>哪一天拍的<input type="date" name="date" value="${today()}" max="${today()}"></label>
      <p class="hint">一次選很多張時，同一句說明會放在每一張上。</p>`
    });
  }

  const commentsHtml = (photoId) => {
    const list = commentsOf(photoId);
    return list.length ? list.map((c) => `
      <div class="album-comment">
        <b style="color:${esc(colorOf(c.author))}">${esc(nameOf(c.author))}</b>
        <span>${esc(c.text)}</span>
        ${isAdmin() || c.author === state.userId ? `<button class="pack-del" data-act="del-comment" data-id="${esc(c.id)}" aria-label="刪除這則留言">×</button>` : ''}
      </div>`).join('') : '<p class="album-none">還沒有留言。</p>';
  };
  function refreshPhotoComments() {
    const box = document.getElementById('album-comments');
    if (box) { box.innerHTML = commentsHtml(state.photoId); box.scrollTop = box.scrollHeight; }
  }

  // 看一張照片：先顯示小圖，原圖讀到再換上；下面是說明和留言
  async function openPhoto(id) {
    const p = findById(state.photos, id);
    if (!p) return;
    state.photoId = id;
    const i = state.photos.indexOf(p);
    const prev = state.photos[i - 1], next = state.photos[i + 1];
    document.body.classList.add('sheet-open');
    $sheet.innerHTML = `
      <div class="album-view" role="dialog" aria-label="照片">
        <div class="album-top">
          <span>${esc(nameOf(p.author))}　${shortDate(p.date)}</span>
          ${canDeletePhoto(p) ? `<button class="link-btn" data-act="del-photo" data-id="${esc(p.id)}">刪除</button>` : ''}
          <button class="link-btn" data-act="close-photo">關閉</button>
        </div>
        <div class="album-stage">
          <img src="${esc(p.thumb)}" alt="${esc(p.caption || '照片')}" class="loading">
          ${prev ? `<button class="album-step prev" data-act="open-photo" data-id="${esc(prev.id)}" aria-label="上一張">‹</button>` : ''}
          ${next ? `<button class="album-step next" data-act="open-photo" data-id="${esc(next.id)}" aria-label="下一張">›</button>` : ''}
        </div>
        <div class="album-panel">
          ${p.caption ? `<p class="album-caption">${esc(p.caption)}</p>` : ''}
          <div id="album-comments">${commentsHtml(id)}</div>
          <form class="shop-add" id="album-comment-form">
            <input name="text" type="text" placeholder="留言…" maxlength="200" autocomplete="off" enterkeyhint="send" aria-label="留言">
            <button type="submit" class="send" aria-label="送出留言">${ICON.send || ICON.plus}</button>
          </form>
        </div>
      </div>`;
    try {
      const doc = await Api.getDoc('chat_images', p.image_id);
      const el = $sheet.querySelector('.album-stage img');
      if (state.photoId === id && el && doc && String(doc.data).startsWith('data:image/')) { el.src = doc.data; el.classList.remove('loading'); }
    } catch (e) { console.error(e); toast('原圖讀取失敗'); }
  }
  function closePhoto() {
    state.photoId = null;
    $sheet.innerHTML = '';
    document.body.classList.remove('sheet-open');
    render();
  }

  async function onPhotoComment(form) {
    const input = form.elements.text;
    const text = input.value.trim();
    const p = findById(state.photos, state.photoId);
    if (!text || !p) return;
    input.value = '';
    try {
      const data = { photo_id: p.id, month: p.month, text, author: state.userId, created_by: state.userId, created_at: Date.now() };
      const id = await Api.addDoc('photo_comments', data);
      state.photoComments.push({ ...data, id });
      refreshPhotoComments();
    } catch (e) { console.error(e); input.value = text; toast('留言沒有送出，請再試一次'); }
  }

  async function onDeleteComment(btn) {
    try {
      await Api.deleteDoc('photo_comments', btn.dataset.id);
      state.photoComments = state.photoComments.filter((c) => c.id !== btn.dataset.id);
      refreshPhotoComments();
    } catch (e) { console.error(e); toast('刪除失敗，請再試一次'); }
  }

  async function onDeletePhoto(btn) {
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = '再按一次確定刪除'; return; }
    const p = findById(state.photos, btn.dataset.id);
    if (!p || !canDeletePhoto(p)) return;
    btn.disabled = true;
    try {
      await Api.deleteDoc('photos', p.id);
      Api.deleteDoc('chat_images', p.image_id).catch(() => {});
      commentsOf(p.id).forEach((c) => Api.deleteDoc('photo_comments', c.id).catch(() => {}));
      state.photos = state.photos.filter((x) => x.id !== p.id);
      state.photoComments = state.photoComments.filter((c) => c.photo_id !== p.id);
      closePhoto();
      toast('已刪除');
    } catch (e) { console.error(e); btn.disabled = false; toast('刪除失敗，請再試一次'); }
  }

  // ---------- 交通：新竹公車與台鐵的即時資訊 ----------
  // 鍾家生活 →「交通」。資料由雲端函式向交通部 TDX 平臺查詢（金鑰只放在伺服器，手機拿不到）。
  // 每個人自己的常用站牌、常用車站存在 transit_favs/{UID}。
  const tr = state.transit;
  const TRA_DEFAULT = ['新竹', '北新竹', '竹北'];
  const sameFav = (a, b) => a.area === b.area && a.route === b.route && a.dir === b.dir && a.uid === b.uid;
  const isFavStop = (x) => tr.favs.bus.some((f) => sameFav(f, x));

  function etaHtml(eta) {
    if (!eta) return '<span class="eta wait">…</span>';
    if (eta.status === 'coming') {
      const min = Math.round(eta.seconds / 60);
      return eta.seconds <= 60 ? '<span class="eta now">進站中</span>'
        : `<span class="eta ${min <= 3 ? 'soon' : 'ok'}"><b>${min}</b> 分</span>`;
    }
    const text = { 'not-yet': eta.next ? eta.next + ' 發車' : '尚未發車', skip: '不停靠', 'last-gone': '末班已過', 'no-service': '今日未營運', error: '查不到' }[eta.status] || '沒有資料';
    return `<span class="eta off">${text}</span>`;
  }
  function transitError() {
    if (!tr.error) return '';
    const text = tr.error === 'no-key' ? (isAdmin() ? '還沒設定 TDX 金鑰。請到「設定」最下面的「交通查詢」填入金鑰。' : '交通查詢還沒設定好，請爸爸到「設定」裡完成。')
      : tr.error === 'bad-key' ? (isAdmin() ? 'TDX 金鑰不正確，請到「設定」的「交通查詢」重新填一次。' : '交通查詢的設定有問題，請爸爸檢查。')
      : tr.error === 'busy' ? '查詢太頻繁了，請過一分鐘再試。'
      : tr.error === 'no-function' ? (isAdmin() ? '查詢用的雲端函式還沒部署好。請重新下載 ZIP、雙擊 deploy.bat，等它顯示 Done 之後再試。' : '交通查詢還沒設定好，請爸爸到電腦上完成部署。')
      : tr.error === 'denied' ? '這個帳號沒有查詢的權限，請重新登入後再試。'
      : tr.error === 'tdx' ? '交通部 TDX 平臺現在沒有回應這筆資料，請稍後再試。'
      : '現在查不到即時資料，請確認網路後再試一次。';
    return `<p class="transit-error" role="alert">${text}${isAdmin() && tr.errorDetail ? `<small>（${esc(tr.errorDetail)}）</small>` : ''}</p>`;
  }
  const updatedHtml = () => (tr.updatedAt ? `<span class="transit-time">${clock(tr.updatedAt)} 更新</span>` : '');

  async function transitCall(op, args) {
    try { const data = await Api.transit(op, args || {}); tr.error = ''; return data; }
    catch (e) {
      console.error(e);
      const msg = String((e && e.message) || ''), code = String((e && e.code) || '');
      tr.error = ['no-key', 'bad-key', 'busy'].find((k) => msg.includes(k))
        || (/not-found|internal/.test(code) ? 'no-function' : /unauthenticated|permission-denied/.test(code) ? 'denied' : /^tdx-/.test(msg) ? 'tdx' : 'failed');
      tr.errorDetail = (code + ' ' + msg).trim().slice(0, 80);
      return null;
    }
  }
  const onTransit = () => state.tab === 'notes' && state.notesView === 'transit';
  // 查詢結果回來時重畫交通頁；但正在搜尋框打字時先不重畫（會打斷中文輸入法），等離開搜尋框再畫
  let transitDrawLater = false;
  function drawTransit() {
    if (!onTransit() || $sheet.innerHTML) return;
    const a = document.activeElement;
    if (a && (a.id === 'tra-q' || a.id === 'transit-q')) { transitDrawLater = true; return; }
    transitDrawLater = false;
    render();
  }
  document.addEventListener('focusout', (ev) => {
    if (transitDrawLater && (ev.target.id === 'tra-q' || ev.target.id === 'transit-q')) setTimeout(drawTransit, 0);
  });

  async function loadTransit(quiet) {
    if (!tr.favsLoaded) {
      try {
        const doc = await Api.getDoc('transit_favs', state.userId);
        tr.favs = { bus: (doc && doc.bus) || [], tra: (doc && doc.tra) || [] };
      } catch (e) { console.error(e); }
      tr.favsLoaded = true;
    }
    if (tr.mode === 'tra') return loadTra(quiet);
    if (tr.route) return loadRoute(tr.route.area, tr.route.name, quiet);
    if (!tr.favs.bus.length) return drawTransit();
    if (!quiet) { tr.loading = true; drawTransit(); }
    const data = await transitCall('etas', { items: tr.favs.bus });
    tr.loading = false;
    if (data) { tr.favEtas = data.etas; tr.updatedAt = Date.now(); }
    drawTransit();
  }
  async function loadRoute(area, name, quiet) {
    if (!quiet) { tr.loading = true; drawTransit(); }
    const data = await transitCall('route', { area, name });
    tr.loading = false;
    if (data) { tr.route = data; tr.updatedAt = Date.now(); if (!data.dirs.some((d) => d.dir === tr.routeDir)) tr.routeDir = data.dirs.length ? data.dirs[0].dir : 0; }
    drawTransit();
  }
  async function loadTra(quiet) {
    if (!tr.stations) {
      tr.loading = true; drawTransit();
      const data = await transitCall('traStations');
      tr.loading = false;
      if (!data) return drawTransit();
      tr.stations = data.stations;
    }
    if (!tr.station) {
      const first = tr.favs.tra[0] || tr.stations.find((s) => s.name === TRA_DEFAULT[0]) || tr.stations[0];
      if (!first) return drawTransit();
      tr.station = first;
    }
    if (!quiet) { tr.loading = true; drawTransit(); }
    const id = tr.station.id;
    const data = await transitCall('tra', { station: id });
    tr.loading = false;
    if (data && tr.station && tr.station.id === id) { tr.board = data.trains; tr.updatedAt = Date.now(); }
    drawTransit();
  }
  async function onTransitSearch(form) {
    const q = form.elements.q.value.trim();
    tr.q = q;
    if (!q) { tr.results = null; return render(); }
    tr.loading = true; tr.results = null; render();
    const data = await transitCall('searchRoutes', { q });
    tr.loading = false;
    tr.results = data ? data.routes : null;
    const box = document.getElementById('transit-q');
    if (box) box.blur();                  // 搜尋送出了：收起鍵盤，直接顯示結果
    transitDrawLater = false;
    if (onTransit() && !$sheet.innerHTML) render();
  }
  async function saveFavs() {
    try { await Api.setDoc('transit_favs', state.userId, { bus: tr.favs.bus, tra: tr.favs.tra, updated_at: Date.now() }); }
    catch (e) { console.error(e); toast('常用清單沒有存到，請再試一次'); }
  }
  function toggleFavStop(el) {
    const d = tr.route.dirs.find((x) => x.dir === tr.routeDir);
    const s = d && d.stops.find((x) => x.uid === el.dataset.uid);
    if (!s) return;
    const fav = { area: tr.route.area, areaName: tr.route.areaName, route: tr.route.name, dir: d.dir, to: d.to, uid: s.uid, name: s.name };
    if (isFavStop(fav)) tr.favs.bus = tr.favs.bus.filter((f) => !sameFav(f, fav));
    else if (tr.favs.bus.length >= 20) return toast('常用站牌最多 20 個');
    else { tr.favs.bus.push(fav); toast('已加入常用站牌'); }
    tr.favEtas = [];
    saveFavs(); render();
  }
  function toggleFavStation() {
    const s = tr.station;
    if (!s) return;
    if (tr.favs.tra.some((x) => x.id === s.id)) tr.favs.tra = tr.favs.tra.filter((x) => x.id !== s.id);
    else if (tr.favs.tra.length >= 10) return toast('常用車站最多 10 個');
    else { tr.favs.tra.push({ id: s.id, name: s.name }); toast('已加入常用車站'); }
    saveFavs(); render();
  }

  function viewTransit() {
    const b = (m, label) => `<button class="${tr.mode === m ? 'on' : ''}" data-act="transit-mode" data-mode="${m}" ${tr.mode === m ? 'aria-pressed="true"' : ''}>${label}</button>`;
    return `
      <header class="plain-head"><h1>交通</h1><p>新竹公車、台鐵即時資訊</p></header>
      <div class="switcher" role="group" aria-label="交通工具">${b('bus', '公車')}${b('tra', '火車')}</div>
      ${transitError()}
      ${tr.mode === 'tra' ? transitTraHtml() : tr.route ? transitRouteHtml() : transitBusHtml()}
      <p class="transit-credit">資料來源：交通部 TDX 運輸資料流通服務。到站時間是預估值，請提早到站牌等車。</p>`;
  }

  function transitBusHtml() {
    const search = `
      <form class="shop-add" id="transit-search-form">
        <input id="transit-q" name="q" type="search" placeholder="輸入公車路線，例如：藍線、5608、1" value="${esc(tr.q)}" maxlength="12" autocomplete="off" enterkeyhint="search" aria-label="搜尋公車路線">
        <button type="submit" class="send" aria-label="搜尋">${ICON.search}</button>
      </form>`;
    if (tr.results) return search + `
      <section class="entries transit-list">
        <h2>找到 ${tr.results.length} 條路線<button class="link-btn" data-act="transit-clear">清除</button></h2>
        ${tr.results.length ? tr.results.map((r) => `
          <button class="transit-row" data-act="transit-route" data-area="${esc(r.area)}" data-name="${esc(r.name)}">
            <span class="route-no">${esc(r.name)}</span>
            <span class="transit-main">${esc(r.from)}${r.from && r.to ? ' ↔ ' : ''}${esc(r.to)}<small>${esc(r.areaName)}</small></span>
            <span class="chev" aria-hidden="true">›</span>
          </button>`).join('') : '<p class="none">找不到這條路線。試試只輸入號碼，或路線名稱的前幾個字。</p>'}
      </section>`;
    return search + (tr.loading && !tr.favEtas.length && !tr.favs.bus.length ? '<p class="hint album-wait">查詢中…</p>' : '') + (tr.favs.bus.length ? `
      <section class="entries transit-list">
        <h2>常用站牌${updatedHtml()}<button class="link-btn" data-act="transit-refresh">${tr.loading ? '更新中…' : '更新'}</button></h2>
        ${tr.favs.bus.map((f, i) => `
          <button class="transit-row fav" data-act="transit-route" data-area="${esc(f.area)}" data-name="${esc(f.route)}" data-dir="${f.dir}">
            <span class="route-no">${esc(f.route)}</span>
            <span class="transit-main">${esc(f.name)}<small>往 ${esc(f.to)}</small></span>
            ${etaHtml(tr.favEtas[i])}
          </button>`).join('')}
      </section>` : tr.favsLoaded && !tr.loading ? `
      <div class="empty big"><p>還沒有常用站牌。在上面輸入公車路線，點進去之後，在每天等車的那一站按 ☆，下次打開就直接看到還有幾分鐘到。</p></div>` : '');
  }

  function transitRouteHtml() {
    const r = tr.route;
    const d = r.dirs.find((x) => x.dir === tr.routeDir) || r.dirs[0];
    return `
      <button class="link-btn back" data-act="transit-back">‹ 返回</button>
      <header class="transit-head">
        <span class="route-no big">${esc(r.name)}</span>
        <span>${esc(r.areaName)}公車${updatedHtml()}</span>
        <button class="chip-btn" data-act="transit-refresh">${tr.loading ? '更新中…' : '更新'}</button>
      </header>
      ${r.dirs.length > 1 ? `
      <div class="kid-picker" role="group" aria-label="方向">
        ${r.dirs.map((x) => `<button class="${x.dir === d.dir ? 'on' : ''}" style="--who:var(--c-schedule)" data-act="transit-dir" data-dir="${x.dir}" ${x.dir === d.dir ? 'aria-pressed="true"' : ''}>往 ${esc(x.to)}</button>`).join('')}
      </div>` : ''}
      ${d ? `
      <section class="entries transit-list stops">
        ${d.stops.map((s, i) => {
          const fav = isFavStop({ area: r.area, route: r.name, dir: d.dir, uid: s.uid });
          return `
          <div class="transit-row stop">
            <span class="stop-no">${i + 1}</span>
            <span class="transit-main">${esc(s.name)}</span>
            ${etaHtml(s.eta)}
            <button class="star ${fav ? 'on' : ''}" data-act="transit-fav" data-uid="${esc(s.uid)}" aria-pressed="${fav}" aria-label="${fav ? '從常用站牌移除' : '加入常用站牌'}：${esc(s.name)}">${fav ? '★' : '☆'}</button>
          </div>`;
        }).join('')}
      </section>` : `<p class="hint album-wait">${tr.loading ? '查詢中…' : '查不到這條路線的站牌資料。'}</p>`}`;
  }

  // 車站搜尋結果：只更新這一小塊，不重畫整頁（重畫會打斷注音、倉頡這類輸入法的選字）
  function foundStationsHtml() {
    const q = tr.traQ.trim().replace(/台/g, '臺');
    if (!q || !tr.stations) return '';
    const found = tr.stations.filter((s) => s.name.replace(/台/g, '臺').includes(q)).slice(0, 12);
    return found.length ? found.map((x) => `<button class="chip-btn" data-act="tra-station" data-id="${esc(x.id)}">${esc(x.name)}</button>`).join('') : '<span class="hint">找不到這個車站。</span>';
  }
  function refreshFoundStations() {
    const el = document.getElementById('tra-found');
    if (!el) return;
    el.innerHTML = foundStationsHtml();
    el.hidden = !tr.traQ.trim();
  }
  function transitTraHtml() {
    if (!tr.stations) return tr.loading ? '<p class="hint album-wait">查詢中…</p>' : '';
    // 常用車站排前面，後面補上新竹附近的幾個站
    const quick = tr.favs.tra.concat(TRA_DEFAULT.map((n) => tr.stations.find((s) => s.name === n)).filter((x) => x && !tr.favs.tra.some((f) => f.id === x.id)));
    const q = tr.traQ.trim();
    const s = tr.station;
    const isFav = s && tr.favs.tra.some((x) => x.id === s.id);
    const now = clock(Date.now());
    // 看板只留還沒開走的車（含誤點）
    const trains = (tr.board || []).filter((t) => addMinutes(t.time, t.delay) >= now || t.time < '03:00' && now > '21:00');
    return `
      <div class="station-chips" role="group" aria-label="${tr.favs.tra.length ? '常用車站' : '附近的車站'}">
        ${quick.map((x) => `<button class="chip-btn ${s && s.id === x.id ? 'on' : ''}" data-act="tra-station" data-id="${esc(x.id)}" ${s && s.id === x.id ? 'aria-pressed="true"' : ''}>${esc(x.name)}</button>`).join('')}
      </div>
      <input id="tra-q" class="search" type="search" placeholder="找其他車站，例如：竹東、台北" value="${esc(tr.traQ)}" maxlength="10" autocomplete="off" aria-label="搜尋車站">
      <div class="station-chips found-stations" id="tra-found" ${q ? '' : 'hidden'}>${foundStationsHtml()}</div>
      ${s ? `
      <header class="transit-head">
        <span class="route-no big tra">${esc(s.name)}</span>
        <span>台鐵即時看板${updatedHtml()}</span>
        <button class="star ${isFav ? 'on' : ''}" data-act="tra-fav" aria-pressed="${isFav}" aria-label="${isFav ? '從常用車站移除' : '加入常用車站'}">${isFav ? '★' : '☆'}</button>
        <button class="chip-btn" data-act="transit-refresh">${tr.loading ? '更新中…' : '更新'}</button>
      </header>
      <section class="entries transit-list">
        ${!tr.board ? '<p class="none">查詢中…</p>' : trains.length ? trains.map((t) => `
          <div class="transit-row train">
            <span class="train-time">${esc(t.time)}</span>
            <span class="transit-main">往 ${esc(t.to)}<small>${esc(t.type)}　${esc(t.no)} 次</small></span>
            <span class="eta ${t.delay > 0 ? 'late' : 'ok'}">${t.delay > 0 ? '晚 ' + t.delay + ' 分' : '準點'}</span>
          </div>`).join('') : '<p class="none">接下來一段時間沒有列車進站。</p>'}
      </section>` : ''}`;
  }
  // 'HH:MM' 加上幾分鐘（比對誤點後的實際時間用）
  function addMinutes(hm, min) {
    const [h, m] = hm.split(':').map(Number);
    const t = Math.min(h * 60 + m + (min || 0), 23 * 60 + 59);
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }

  // TDX 金鑰：只有管理員能新增、查看、更換（安全規則也只放行管理員）
  async function openTdxSheet() {
    if (!isAdmin()) return;
    let cur = null;
    try { cur = await Api.getDoc('secrets', 'tdx'); }
    catch (e) { console.error(e); return toast('讀不到目前的金鑰，請確認已經執行過 deploy.bat'); }
    const has = !!(cur && cur.client_id);
    showSheet('tdx-form', {
      title: '交通查詢的 TDX 金鑰', focus: !has,
      body: `
      <p class="hint">${has ? '目前已經設定金鑰' + (cur.updated_at ? '（' + stamp(cur.updated_at) + ' 儲存）' : '') + '。要更換就直接改掉再儲存。' : '還沒有設定金鑰。'}</p>
      <label>Client Id<input type="text" name="client_id" value="${esc((cur && cur.client_id) || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="100"></label>
      <label>Client Secret<input type="text" name="client_secret" value="${esc((cur && cur.client_secret) || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="100"></label>
      <p class="hint">到 tdx.transportdata.tw 登入 →「會員中心」→「資料服務」→「API 金鑰」，把那一組的 Client Id 和 Client Secret 複製貼上。</p>
      <p class="hint">只有管理員看得到、改得了這組金鑰；其他家人的手機讀不到。</p>`
    });
  }

  // 停在交通頁時，每 30 秒自動更新一次
  setInterval(() => {
    if (state.userId && onTransit() && document.visibilityState === 'visible' && !$sheet.innerHTML && !tr.loading && !tr.results
      && document.activeElement && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) loadTransit(true);
  }, 30000);

  // ---------- 日常待辦 ----------
  // 鍾家生活 →「待辦」。全家共用的待辦清單：可以交給某個人、設日期、設成每天／每週／每月重複。
  // 沿用原本採買清單的 shopping 資料，舊的採買項目會變成沒有日期、沒有指定人的待辦。
  // 每一筆：{ text, note, done, who（成員 UID，'' 代表全家）, due（'YYYY-MM-DD' 或 ''）, repeat（'' | daily | weekly | monthly）,
  //          star（重要）, added_by, done_by, done_at, created_at,
  //          重複的待辦完成後不會打勾，而是把日期往後推：last_done_by, last_done_at, prev_due（復原用） }
  const REPEATS = { daily: '每天', weekly: '每週', monthly: '每月' };
  const todoWho = (i) => i.who || '';
  const todoDue = (i) => i.due || '';
  const mineTodo = (i) => !todoWho(i) || todoWho(i) === state.userId;
  // 小朋友只能修改、刪除自己新增的；別人交代的只能打勾完成
  const canEditTodo = (i) => !amChild() || i.added_by === state.userId;
  const todoOrder = (a, b) => (!!b.star - !!a.star) || todoDue(a).localeCompare(todoDue(b)) || a.created_at - b.created_at;
  // 今天或過期、交給我或全家的（鍾家生活清單上的「今天有幾件」用）
  const urgentTodos = () => state.shopping.filter((i) => !i.done && todoDue(i) && todoDue(i) <= today() && mineTodo(i)).sort(todoOrder);
  // 首頁「我的今天」：交給我的（不論日期），加上全家的裡今天或過期的；有日期的照日期排，沒日期的放後面
  const homeTodos = () => state.shopping.filter((i) => !i.done && (todoWho(i) === state.userId || (!todoWho(i) && todoDue(i) && todoDue(i) <= today())))
    .sort((a, b) => (!!b.star - !!a.star) || (todoDue(a) || '9999').localeCompare(todoDue(b) || '9999') || a.created_at - b.created_at);
  // 重複的待辦：完成之後下一次是哪一天（一定排在今天之後）
  function nextDue(item) {
    let d = todoDue(item) || today();
    do {
      if (item.repeat === 'monthly') { const x = parse(d); x.setMonth(x.getMonth() + 1); d = ymd(x); }
      else d = addDays(d, item.repeat === 'weekly' ? 7 : 1);
    } while (d <= today());
    return d;
  }
  const doneToday = (i) => i.last_done_at && ymd(new Date(i.last_done_at)) === today();
  function todoDueHtml(due, done) {
    if (!due) return '';
    const n = daysBetween(today(), due);
    const text = n === 0 ? '今天' : n === 1 ? '明天' : n < 0 ? '過了 ' + (-n) + ' 天' : shortDate(due);
    return `<span class="todo-due ${!done && n < 0 ? 'late' : !done && n === 0 ? 'today' : ''}">${text}</span>`;
  }
  function todoRowHtml(i) {
    const who = todoWho(i) && member(todoWho(i));
    return `
      <div class="todo-row ${i.done ? 'done' : ''} ${i.star && !i.done ? 'flagged' : ''}">
        <button class="todo-check" data-act="shop-toggle" data-id="${esc(i.id)}" aria-pressed="${!!i.done}" aria-label="${i.done ? '改回還沒做' : '完成'}：${esc(i.text)}"><span class="check" aria-hidden="true"></span></button>
        <button class="todo-body" data-act="edit-todo" data-id="${esc(i.id)}">
          <span class="shop-text">${i.star && !i.done ? '<span class="todo-flag" aria-label="重要">！</span>' : ''}${esc(i.text)}</span>
          ${i.note ? `<span class="todo-note">${esc(i.note)}</span>` : ''}
          <span class="todo-meta">
            ${who ? `<span class="todo-who" style="--who:${esc(who.color)}">${esc(who.display_name)}</span>` : ''}
            ${todoDueHtml(todoDue(i), i.done)}
            ${i.repeat && REPEATS[i.repeat] ? `<span class="todo-repeat">↻ ${REPEATS[i.repeat]}</span>` : ''}
            ${i.done && i.done_by ? `<span>${esc(nameOf(i.done_by))}完成</span>` : ''}
            ${!i.done && doneToday(i) ? `<span>${esc(nameOf(i.last_done_by))}今天做完了</span>` : ''}
          </span>
        </button>
        ${!i.done && doneToday(i) && i.prev_due !== undefined ? `<button class="link-btn todo-undo" data-act="todo-undo" data-id="${esc(i.id)}">復原</button>` : ''}
      </div>`;
  }
  function shopListHtml() {
    const list = state.shopping.filter((i) => state.todoFilter !== 'mine' || mineTodo(i));
    if (!list.length) return `<div class="empty big"><p>${state.todoFilter === 'mine' && state.shopping.length ? '沒有交給你的待辦。' : '沒有待辦事項。倒垃圾、繳費、帶便當袋，想到就在上面打字加進來。'}</p></div>`;
    const open = list.filter((i) => !i.done);
    const groups = [
      ['今天和過期的', open.filter((i) => todoDue(i) && todoDue(i) <= today())],
      ['之後', open.filter((i) => todoDue(i) > today())],
      ['沒有日期', open.filter((i) => !todoDue(i))]
    ].filter(([, items]) => items.length);
    const done = list.filter((i) => i.done).sort((a, b) => (b.done_at || 0) - (a.done_at || 0));
    return groups.map(([title, items]) => `
      <section class="todo-group"><h2>${title}<span>${items.length}</span></h2>
        <div class="shop-items">${items.sort(todoOrder).map(todoRowHtml).join('')}</div>
      </section>`).join('')
      + (open.some((i) => todoDue(i) && todoDue(i) <= today()) || !open.length ? '' : '<p class="hint todo-clear">今天的都做完了！</p>')
      + (open.length ? '' : '<p class="hint todo-clear">都做完了！</p>')
      + (done.length ? `
      <section class="todo-group"><h2>已完成<span>${done.length}</span>
        <button class="link-btn" data-act="todo-show-done">${state.todoShowDone ? '收起' : '顯示'}</button></h2>
        ${state.todoShowDone ? `<div class="shop-items">${done.map(todoRowHtml).join('')}</div>` : ''}
        ${amChild() ? '' : `<button class="btn ghost small" data-act="shop-clear">清除已完成的（${done.length}）</button>`}
      </section>` : '');
  }
  const todoCountText = () => {
    const n = state.shopping.filter((i) => !i.done).length, u = state.shopping.filter((i) => !i.done && todoDue(i) && todoDue(i) <= today()).length;
    return n ? (u ? '今天 ' + u + ' 件，' : '') + '共 ' + n + ' 件還沒做' : '都做完了';
  };
  function viewShop() {
    const cur = { who: state.todoNewWho, due: state.todoNewDue, repeat: state.todoNewRepeat };
    const chip = (kind, value, label, color) => {
      const on = cur[kind] === value;
      return `<button type="button" class="todo-chip ${on ? 'on' : ''}" ${color ? `style="--who:${esc(color)}"` : ''} data-act="todo-pick" data-kind="${kind}" data-value="${value}" aria-pressed="${on}">${label}</button>`;
    };
    const custom = /^\d{4}-/.test(state.todoNewDue);
    const f = (v, label) => `<button class="${state.todoFilter === v ? 'on' : ''}" data-act="todo-filter" data-filter="${v}" ${state.todoFilter === v ? 'aria-pressed="true"' : ''}>${label}</button>`;
    return `
      <header class="plain-head"><h1>日常待辦</h1><p id="shop-count">${todoCountText()}</p></header>
      <form class="shop-add" id="shop-form">
        <input id="shop-input" name="text" type="text" placeholder="要做什麼？例如：倒垃圾" maxlength="60" autocomplete="off" enterkeyhint="done" aria-label="新增待辦">
        <button type="submit" class="send" aria-label="加入待辦">${ICON.plus}</button>
      </form>
      <div class="todo-picks" role="group" aria-label="新增時交給誰">
        <span class="todo-pick-label">交給</span>${chip('who', '', '全家')}${state.members.map((m) => chip('who', m.id, esc(m.display_name), m.color)).join('')}
      </div>
      <div class="todo-picks" role="group" aria-label="新增時的日期">
        <span class="todo-pick-label">日期</span>${chip('due', '', '不限')}${chip('due', 'today', '今天')}${chip('due', 'tomorrow', '明天')}
        <label class="todo-chip todo-date ${custom ? 'on' : ''}">${custom ? shortDate(state.todoNewDue).replace(/（.*/, '') : '選日期'}<input id="todo-date" type="date" value="${custom ? esc(state.todoNewDue) : ''}" min="${today()}" aria-label="選日期"></label>
      </div>
      <div class="todo-picks" role="group" aria-label="新增時要不要重複">
        <span class="todo-pick-label">重複</span>${chip('repeat', '', '不重複')}${chip('repeat', 'daily', '每天')}${chip('repeat', 'weekly', '每週')}${chip('repeat', 'monthly', '每月')}
      </div>
      <div class="switcher todo-filter" role="group" aria-label="顯示哪些">${f('all', '全部')}${f('mine', '我的')}</div>
      <div id="shop-list">${shopListHtml()}</div>`;
  }
  function refreshShop() {
    refreshTodos();
    if (state.tab === 'notes' && state.notesView === 'hub' && !$sheet.innerHTML) return render();
    const el = document.getElementById('shop-list');
    if (!el) return;
    el.innerHTML = shopListHtml();
    document.getElementById('shop-count').textContent = todoCountText();
  }
  async function onShopAdd(form) {
    const input = form.elements.text;
    const text = input.value.trim();
    if (!text) return;
    input.value = ''; input.focus();
    const repeat = state.todoNewRepeat;
    let due = state.todoNewDue === 'today' ? today() : state.todoNewDue === 'tomorrow' ? addDays(today(), 1) : state.todoNewDue;
    if (repeat && !due) due = today();          // 重複的一定要有日期，沒選就從今天開始
    try {
      await Api.addDoc('shopping', { text, note: '', done: false, who: state.todoNewWho, due, repeat, star: false, added_by: state.userId, done_by: null, done_at: null, created_at: Date.now() });
    } catch (e) { console.error(e); input.value = text; toast('沒有加進去，請再試一次'); }
  }
  async function onShopToggle(id) {
    const item = findById(state.shopping, id);
    if (!item) return;
    try {
      if (item.repeat && !item.done) {
        // 重複的待辦：不打勾，把日期推到下一次，並記下這次是誰做的
        const next = nextDue(item);
        await Api.updateDoc('shopping', id, { due: next, prev_due: todoDue(item), last_done_by: state.userId, last_done_at: Date.now() });
        toast('完成！下次是 ' + shortDate(next));
      } else await Api.updateDoc('shopping', id, { done: !item.done, done_by: item.done ? null : state.userId, done_at: item.done ? null : Date.now() });
    } catch (e) { console.error(e); toast('沒有成功，請再試一次'); }
  }
  // 重複的待辦按錯了：把日期改回完成前的那一天
  async function onTodoUndo(id) {
    const item = findById(state.shopping, id);
    if (!item || item.prev_due === undefined) return;
    try { await Api.updateDoc('shopping', id, { due: item.prev_due, last_done_by: null, last_done_at: null }); toast('已復原'); }
    catch (e) { console.error(e); toast('沒有成功，請再試一次'); }
  }
  async function onShopClear(btn) {
    if (amChild()) return;
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = '再按一次確定清除'; return; }
    btn.disabled = true;
    try { await Promise.all(state.shopping.filter((i) => i.done).map((i) => Api.deleteDoc('shopping', i.id))); toast('已清除'); }
    catch (e) { console.error(e); toast('清除失敗，請再試一次'); }
  }
  function openTodoSheet(item) {
    const can = canEditTodo(item);
    showSheet('todo-form', {
      title: can ? '編輯待辦' : '待辦內容', footer: can ? DELETE_BTN : '', readonly: !can,
      body: `
      <input type="hidden" name="item_id" value="${esc(item.id)}">
      <label>要做什麼<input class="title-input" type="text" name="text" value="${esc(item.text)}" maxlength="60" autocomplete="off"></label>
      <label>備註（可不填）<textarea name="note" rows="2" maxlength="300" placeholder="例如：垃圾車 19:30 到巷口">${esc(item.note || '')}</textarea></label>
      <fieldset class="seg">
        <legend>交給誰</legend>
        <label style="--cat:var(--green)"><input type="radio" name="who" value="" ${todoWho(item) ? '' : 'checked'}><span>全家</span></label>
        ${state.members.map((m) => `
          <label style="--cat:${esc(m.color)}"><input type="radio" name="who" value="${esc(m.id)}" ${todoWho(item) === m.id ? 'checked' : ''}><span>${esc(m.display_name)}</span></label>`).join('')}
      </fieldset>
      <label>日期<input type="date" name="due" value="${esc(todoDue(item))}"></label>
      <fieldset class="seg">
        <legend>重複</legend>
        <label style="--cat:var(--ink)"><input type="radio" name="repeat" value="" ${item.repeat ? '' : 'checked'}><span>不重複</span></label>
        ${Object.keys(REPEATS).map((k) => `
          <label style="--cat:var(--c-schedule)"><input type="radio" name="repeat" value="${k}" ${item.repeat === k ? 'checked' : ''}><span>${REPEATS[k]}</span></label>`).join('')}
      </fieldset>
      <label class="switch">
        <span>重要（排在最前面）</span>
        <input type="checkbox" name="star" ${item.star ? 'checked' : ''}>
      </label>
      <p class="hint">${esc(nameOf(item.added_by))}在 ${stamp(item.created_at)} 新增${item.done && item.done_by ? '；' + esc(nameOf(item.done_by)) + '已完成' : ''}${item.last_done_by ? '；上次是' + esc(nameOf(item.last_done_by)) + '在 ' + stamp(item.last_done_at) + ' 做的' : ''}。${can ? '' : '這件事是別人交代的，你可以打勾完成，但不能修改。'}</p>
      <p class="hint">重複的待辦完成後不會消失，會自動排到下一次。</p>`
    });
    if (!can) $sheet.querySelectorAll('input, textarea').forEach((el) => { el.disabled = true; });
  }

  // ---------- 資料卡 ----------
  // 健保卡號、學號、過敏、緊急聯絡人這類要用時馬上找得到的資料。全家都能看，只有家長能改。
  function viewCards() {
    if (!state.cards.length) return `
      <header class="plain-head"><h1>資料卡</h1></header>
      <div class="empty big">
        <p>還沒有資料卡。健保卡號、學號、過敏與用藥、緊急聯絡人，都可以放在這裡。</p>
      </div>`;
    const groups = [['', '全家']].concat(state.members.map((m) => [m.id, m.display_name]));
    return `
      <header class="plain-head"><h1>資料卡</h1><p>${amChild() ? '由家長維護' : '只有家長可以修改'}</p></header>
      ${groups.map(([id, label]) => {
        const cards = state.cards.filter((c) => (member(c.member) ? c.member : '') === id)
          .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
        if (!cards.length) return '';
        return `
          <section class="card-group" style="--who:${id ? esc(colorOf(id)) : 'var(--green)'}">
            <h2>${esc(label)}</h2>
            ${cards.map((c) => `
              <${amChild() ? 'div' : `button data-act="edit-card" data-id="${esc(c.id)}"`} class="info-card">
                <span class="info-title">${esc(c.title)}</span>
                <span class="info-body">${esc(c.body)}</span>
              </${amChild() ? 'div' : 'button'}>`).join('')}
          </section>`;
      }).join('')}`;
  }
  function openCardSheet(card) {
    const c = card || { title: '', member: '', body: '' };
    showSheet('card-form', {
      title: card ? '編輯資料卡' : '新增資料卡', focus: !card, footer: card ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(c.id || '')}">
      <input class="title-input" name="title" placeholder="標題，例如：健保與醫療" value="${esc(c.title)}" maxlength="40" autocomplete="off">
      <fieldset class="seg">
        <legend>這是誰的資料？</legend>
        <label style="--cat:var(--green)"><input type="radio" name="member" value="" ${!member(c.member) ? 'checked' : ''}><span>全家</span></label>
        ${state.members.map((m) => `
          <label style="--cat:${esc(m.color)}"><input type="radio" name="member" value="${esc(m.id)}" ${c.member === m.id ? 'checked' : ''}><span>${esc(m.display_name)}</span></label>`).join('')}
      </fieldset>
      <label>內容<textarea name="body" rows="8" maxlength="2000" placeholder="健保卡號：&#10;血型：&#10;過敏：&#10;固定用藥：&#10;緊急聯絡人：">${esc(c.body)}</textarea></label>`
    });
  }

  function refreshPosts() {
    refreshTodos();
    const el = document.getElementById('post-list');
    if (!el) return;
    const active = document.activeElement;
    const focusId = active && el.contains(active) ? active.id : '';
    el.innerHTML = postListHtml();
    const again = focusId && document.getElementById(focusId);
    if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  }

  async function onReply(form) {
    const postId = form.dataset.post;
    const input = form.elements.text;
    const text = input.value.trim();
    if (!text) return;
    input.value = ''; delete state.postDrafts[postId];
    input.focus();
    try { await Api.addReply(postId, text); }
    catch (e) {
      console.error(e);
      state.postDrafts[postId] = text; input.value = text;
      toast('回覆沒有送出，請再試一次');
    }
  }

  async function onDeletePost(btn) {
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = '再按一次確定刪除'; return; }
    btn.disabled = true;
    try { await Api.deletePost(btn.dataset.id); toast('已刪除'); }
    catch (e) { console.error(e); btn.disabled = false; toast('刪除失敗，請再試一次'); }
  }

  // ---------- 雜記 ----------
  // 鍾家生活：先看到所有功能的清單，點進去才是各個功能；每個功能左上角可以回到清單
  const HUB = [
    ['ledger', '零用錢', '#34A853', '<path d="M4 8.500A2.500 2.500 0 0 1 6.500 6H17a2 2 0 0 1 2 2v1"/><rect x="4" y="9" width="16" height="10" rx="2.500"/><circle cx="15.500" cy="14" r="1.300" fill="#fff" stroke="none"/>'],
    ['scores', '成績', '#F29D0B', '<path d="M5 19V11M10 19V5M15 19v-6M20 19V8"/>'],
    ['notes', '旅遊', '#0E9AA7', '<path d="M3.500 12.500l17-7.500-6 15-3-6z"/><path d="M11.500 14l3-3"/>'],
    ['album', '相簿', '#E5557A', '<rect x="3.500" y="5" width="17" height="14" rx="2.500"/><circle cx="9" cy="10" r="1.700"/><path d="M4.500 17l4.500-4 3.500 3 3-2.500 4 3.500"/>'],
    ['transit', '交通', '#3B7BF6', '<rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M8 20l1-3M16 20l-1-3"/><circle cx="8.500" cy="14" r=".900" fill="#fff" stroke="none"/><circle cx="15.500" cy="14" r=".900" fill="#fff" stroke="none"/>'],
    ['shop', '待辦', '#8E5CF7', '<path d="M4 7l1.600 1.600L8.500 5.500M4 13.500l1.600 1.600 2.900-3.100"/><path d="M11.500 7.200h8.500M11.500 13.700h8.500M11.500 19h8.500"/>'],
    ['cards', '資料卡', '#6B7A90', '<rect x="3.500" y="5.500" width="17" height="13" rx="2.500"/><circle cx="9" cy="11" r="2"/><path d="M6.500 16c.500-1.500 4.500-1.500 5 0M14.500 10h3.500M14.500 13.500h3.500"/>']
  ];
  function hubNote(id) {
    if (id === 'ledger') {
      const n = state.requests.filter((r) => r.status !== 'given').length;
      return n ? `<em>${n} 筆費用${amChild() ? '等爸媽給' : '還沒給'}</em>` : amChild() ? '記支出、跟爸媽申請費用' : '小朋友的記帳本';
    }
    if (id === 'scores') return amChild() ? '只有你和爸媽看得到' : '考試成績紀錄';
    if (id === 'notes') {
      const next = state.trips.filter((t) => t.end_date >= today()).sort((x, y) => x.start_date.localeCompare(y.start_date))[0];
      return next ? `${esc(next.title)}　<em>${tripStatus(next).text}</em>` : state.trips.length ? state.trips.length + ' 趟旅程' : '行程、日誌、行李、花費';
    }
    if (id === 'album') return '日常照片，按月份看';
    if (id === 'transit') return '新竹公車、台鐵即時資訊';
    if (id === 'shop') {
      const n = state.shopping.filter((x) => !x.done).length, u = urgentTodos().length;
      return u ? `<em>今天有 ${u} 件要做</em>` : n ? `還有 ${n} 件沒做` : '沒有待辦事項';
    }
    return state.cards.length ? state.cards.length + ' 張' : '健保卡號、學號、緊急聯絡人';
  }
  function viewHub() {
    return `
      <header class="plain-head"><h1>鍾家生活</h1></header>
      <nav class="hub" aria-label="鍾家生活的功能">
        ${HUB.map(([id, label, color, icon]) => `
          <button class="hub-row" data-act="notes-view" data-view="${id}">
            <span class="hub-icon" style="background:${color}" aria-hidden="true"><svg viewBox="0 0 24 24">${icon}</svg></span>
            <span class="hub-main"><b>${label}</b><small>${hubNote(id)}</small></span>
            <span class="chev" aria-hidden="true">›</span>
          </button>`).join('')}
      </nav>`;
  }
  function viewNotes() {
    const views = { ledger: viewLedger, scores: viewScores, notes: viewTravel, album: viewAlbum, transit: viewTransit, shop: viewShop, cards: viewCards };
    const view = views[state.notesView];
    if (!view) return viewHub();
    // 旅程裡面、公車路線裡面已經有自己的「返回」，就不再多放一個
    const inner = (state.notesView === 'notes' && state.tripId && tripOf(state.tripId)) || (state.notesView === 'transit' && state.transit.mode === 'bus' && state.transit.route);
    return (inner ? '' : '<button class="link-btn back hub-back" data-act="notes-view" data-view="hub">‹ 鍾家生活</button>') + view();
  }

  // ---------- 零用錢記帳本 ----------
  // 每位小朋友一本。家長可以記「給零用錢」和支出，也能修改任何一筆；
  // 小朋友只看得到自己的帳本，只能新增、修改、刪除自己的支出。
  const canEditLedger = (e) => !amChild() || (e.kid === state.userId && e.type === 'expense' && !e.by_parent);

  function viewLedger() {
    const list = kids();
    if (!list.length) return `
      <header class="plain-head"><h1>零用錢</h1></header>
      <div class="empty big"><p>${isAdmin()
        ? '還沒設定誰是小朋友。到「設定」點小朋友的名字，打開「這是小朋友」，這裡就會出現他的記帳本。'
        : '還沒設定誰是小朋友，請管理員到「設定」裡設定。'}</p></div>`;

    const kidId = amChild() ? state.userId : (list.some((k) => k.id === state.ledgerKid) ? state.ledgerKid : list[0].id);
    state.ledgerKid = kidId;
    const kid = member(kidId);
    const all = state.ledger.filter((e) => e.kid === kidId);
    const rows = all.filter((e) => e.date.slice(0, 7) === state.ledgerMonth);
    // 父母幫忙付的支出（by_parent）只做紀錄，不從零用錢扣
    const sum = (items, type, byParent) => items.filter((e) => e.type === type && !!e.by_parent === !!byParent).reduce((n, e) => n + e.amount, 0);
    const income = sum(rows, 'income'), spent = sum(rows, 'expense'), parentPaid = sum(rows, 'expense', true);
    const left = income - spent;
    const total = sum(all, 'income') - sum(all, 'expense');
    const [y, m] = state.ledgerMonth.split('-').map(Number);

    const picker = !amChild() && list.length > 1 ? `
      <div class="kid-picker" role="group" aria-label="選擇小朋友">
        ${list.map((k) => `<button class="${k.id === kidId ? 'on' : ''}" style="--who:${esc(k.color)}" data-act="ledger-kid" data-id="${esc(k.id)}" ${k.id === kidId ? 'aria-pressed="true"' : ''}>${esc(k.display_name)}</button>`).join('')}
      </div>` : '';

    // 費用申請：還沒給的全部列出；已給的只列出「需要日期」在這個月的
    const reqs = state.requests.filter((r) => r.kid === kidId
      && (r.status !== 'given' || r.need_date.slice(0, 7) === state.ledgerMonth))
      .sort((a, b) => (a.status === 'given') - (b.status === 'given') || a.need_date.localeCompare(b.need_date));
    const requestsHtml = reqs.length ? `
      <section class="requests" aria-label="需要的費用">
        <h2>需要的費用</h2>
        ${reqs.map((r) => {
          const given = r.status === 'given';
          const editable = !amChild() || !given;
          return `
          <div class="request ${given ? 'given' : ''}">
            <${editable ? `button data-act="edit-request" data-id="${esc(r.id)}"` : 'div'} class="request-main">
              <span class="request-title">${esc(r.title)}</span>
              <span class="request-sub">${shortDate(r.need_date)}${given ? '' : `<em class="${r.need_date <= today() ? 'late' : ''}">${dueText(r.need_date)}</em>`}</span>
              ${given ? `<span class="request-detail">需求 <b>${money(r.amount)}</b>　實際給 <b>${money(givenAmount(r))}</b>${
                givenAmount(r) < r.amount ? `<em class="less">少給 ${money(r.amount - givenAmount(r))}</em>`
                : givenAmount(r) > r.amount ? `<em class="more">多給 ${money(givenAmount(r) - r.amount)}</em>` : ''}</span>` : ''}
            </${editable ? 'button' : 'div'}>
            ${given ? '<span></span>' : `<span class="request-amount">${money(r.amount)}</span>`}
            ${given ? `<span class="given-mark">已給 ✓${r.given_by && member(r.given_by) ? '<small>' + esc(nameOf(r.given_by)) + '</small>' : ''}</span>`
              : amChild() ? '<span class="wait-mark">等家長給</span>'
              : `<button class="todo-done" data-act="req-given" data-id="${esc(r.id)}">已給</button>`}
          </div>`;
        }).join('')}
      </section>` : '';

    // 小月曆：哪幾天領了零用錢（綠點）、有支出（深色點）、有費用要用（橘點）。點某一天只看那天的明細。
    const range = gridRange(state.ledgerMonth);
    let cells = '';
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
      if (d.slice(0, 7) !== state.ledgerMonth) { cells += '<span class="mini-day blank"></span>'; continue; }
      const dayRows = rows.filter((e) => e.date === d);
      const marks = (dayRows.some((e) => e.type === 'income') ? '<i class="in"></i>' : '')
        + (dayRows.some((e) => e.type === 'expense' && !e.by_parent) ? '<i class="out"></i>' : '')
        + (dayRows.some((e) => e.by_parent) ? '<i class="par"></i>' : '')
        + (reqs.some((r) => r.need_date === d) ? '<i class="req"></i>' : '');
      const dayNum = parse(d).getDate();
      cells += `<button class="mini-day ${d === today() ? 'today' : ''} ${d === state.ledgerDay ? 'sel' : ''}" data-act="ledger-day" data-date="${d}" aria-label="${m}月${dayNum}日" ${d === state.ledgerDay ? 'aria-pressed="true"' : ''}><span>${dayNum}</span><span class="marks">${marks}</span></button>`;
    }
    const miniCal = `
      <section class="mini-cal" aria-label="這個月的收支日期">
        <div class="mini-week" aria-hidden="true">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="mini-grid">${cells}</div>
        <div class="mini-legend"><span><i class="in"></i>領零用錢</span><span><i class="out"></i>支出</span><span><i class="par"></i>父母支出</span><span><i class="req"></i>需要費用</span></div>
      </section>`;

    const shown = state.ledgerDay ? rows.filter((e) => e.date === state.ledgerDay) : rows;
    const listHead = state.ledgerDay
      ? `<h2>${shortDate(state.ledgerDay)}的明細<button class="link-btn" data-act="ledger-day" data-date="">看整個月</button></h2>`
      : '<h2>這個月的明細</h2>';

    const entries = shown.length ? shown.map((e) => {
      const d = parse(e.date);
      const kind = e.by_parent ? 'parent' : e.type;
      const inner = `
          <span class="entry-badge ${kind}" aria-hidden="true">${e.by_parent ? '父母' : e.type === 'income' ? '＋' : '−'}</span>
          <span class="entry-note">${esc(e.note || (e.type === 'income' ? '零用錢' : '支出'))}<small>${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）${e.by_parent ? '　父母支出，不扣零用錢' : e.type === 'income' ? '　零用錢' : ''}</small></span>
          <span class="entry-amount ${kind}">${e.by_parent ? '' : e.type === 'income' ? '+' : '−'}${money(e.amount)}</span>`;
      return canEditLedger(e)
        ? `<button class="entry" data-act="edit-ledger" data-id="${esc(e.id)}">${inner}</button>`
        : `<div class="entry">${inner}</div>`;
    }).join('') : `<div class="empty"><p>${state.ledgerDay ? '這天沒有紀錄。' : '這個月還沒有紀錄。'}</p></div>`;

    return `
      <header class="month-head">
        <h1>${y}年${m}月</h1>
        <div class="month-nav">
          ${state.ledgerMonth !== today().slice(0, 7) ? '<button class="chip-btn" data-act="ledger-now">回到本月</button>' : ''}
          <button class="icon-btn" data-act="ledger-prev" aria-label="上個月">‹</button>
          <button class="icon-btn" data-act="ledger-next" aria-label="下個月">›</button>
        </div>
      </header>
      ${picker}
      <section class="wallet ledger" style="--who:${esc(kid.color)}" aria-label="${esc(kid.display_name)}這個月的零用錢">
        <div class="wallet-top">
          <div>
            <div class="wallet-name">${esc(kid.display_name)}這個月還剩</div>
            <div class="wallet-left ${left < 0 ? 'neg' : ''}">${left < 0 ? '−' : ''}${money(left)}</div>
          </div>
          <div class="wallet-total">累計結餘<b class="${total < 0 ? 'neg' : ''}">${total < 0 ? '−' : ''}${money(total)}</b></div>
        </div>
        ${income > 0 ? `
        <div class="wallet-bar ${spent > income ? 'over' : ''}" role="img" aria-label="零用錢已經花了 ${Math.round(spent / income * 100)}%"><i style="width:${Math.min(100, Math.round(spent / income * 100))}%"></i></div>
        <div class="wallet-pct">${spent > income ? '已經超支 ' + money(spent - income) : '已花 ' + Math.round(spent / income * 100) + '%'}</div>` : ''}
        <div class="wallet-stats">
          <div><span><i class="in"></i>零用錢</span><b>${money(income)}</b></div>
          <div><span><i class="out"></i>已花</span><b>${money(spent)}</b></div>
          <div><span><i class="par"></i>父母支出</span><b>${money(parentPaid)}</b></div>
        </div>
      </section>
      ${requestsHtml}
      ${miniCal}
      <section class="entries ledger-list">${listHead}${entries}</section>`;
  }

  function viewNoteList() {
    const cards = state.notes.map((n) => `
        <button class="note ${n.pinned ? 'pinned' : ''}" data-act="edit-note" data-id="${esc(n.id)}">
          ${n.pinned ? '<span class="pin">置頂</span>' : ''}
          <span class="note-title">${esc(n.title || '（沒有標題）')}</span>
          ${n.body ? `<span class="note-body">${esc(n.body)}</span>` : ''}
          <span class="note-meta">${member(n.updated_by) ? esc(nameOf(n.updated_by)) + '　' : ''}${stamp(n.updated_at)}</span>
        </button>`).join('');
    return `
      <header class="plain-head"><h1>雜記</h1><p>全家都看得到</p></header>
      ${cards ? `<div class="notes">${cards}</div>` : `
        <div class="empty big">
          <p>還沒有雜記。密碼、要記得的事都可以放這裡。</p>
        </div>`}`;
  }

  // ---------- 設定 ----------
  function birthdayText(b) {
    if (!b) return '';
    const [, m, d] = b.split('-').map(Number);
    return m + '月' + d + '日';
  }

  function pushSectionHtml() {
    if (Api.isDemo) return '';
    const st = Api.pushState();
    const body = {
      on: '<p>這支手機會收到新訊息和被點名的通知。</p><button class="btn ghost" data-act="push-off">關閉這支手機的通知</button>',
      off: '<p>開啟後，有人在聊天室傳訊息、在「我有話要說」點名你或回覆你，這支手機會跳出通知。</p><button class="btn primary" data-act="push-on">開啟這支手機的通知</button>',
      denied: '<p>通知被系統封鎖了。請到 iPhone 的「設定 → 通知 → 鍾家大宅」打開「允許通知」，再回來這裡。</p>',
      unsupported: '<p>這裡沒辦法開啟通知。iPhone 需要 iOS 16.4 以上，而且要從主畫面的「鍾家大宅」圖示開啟，不能在 Safari 裡直接開。</p>',
      unconfigured: '<p>通知功能還沒設定完成（缺少推播金鑰）。</p>'
    }[st];
    return `<section class="card-list push"><h2>通知</h2>${body}</section>`;
  }

  async function onPushOn(btn) {
    btn.disabled = true; btn.textContent = '設定中…';
    try {
      const result = await Api.enablePush();
      toast(result === 'granted' ? '已開啟通知' : '沒有開啟：需要在詢問時按「允許」');
    } catch (e) {
      console.error(e);
      toast('開啟通知失敗，請稍後再試');
    }
    render();
  }

  function viewMe() {
    return `
      <header class="plain-head"><h1>設定</h1><p>${esc(me().display_name)}已登入</p></header>
      <section class="card-list">
        <h2>家庭成員<small>${isAdmin() ? '點名字可以編輯基本資料' : '點自己的名字可以編輯基本資料'}</small></h2>
        ${state.members.map((m) => {
          const p = state.profiles[m.id] || {};
          const facts = [p.birthday ? '生日 ' + birthdayText(p.birthday) : '', p.phone, p.org].filter(Boolean);
          return `
            <div class="member">
              <${canEditProfile(m.id) ? `button data-act="edit-profile" data-id="${esc(m.id)}"` : 'div'} class="member-main">
                ${avatarHtml(m)}
                <span class="member-text">
                  <span class="member-name">${esc(m.display_name)}${m.id === state.userId ? '<em>這是你</em>' : ''}${m.admin === true ? '<em>管理員</em>' : ''}</span>
                  <span class="member-sub">${facts.length ? esc(facts.join('　')) : '還沒填基本資料'}</span>
                  <span class="member-status ${isOnline(m.id) ? 'on' : ''}">${statusText(m.id)}</span>
                </span>
              </${canEditProfile(m.id) ? 'button' : 'div'}>
              ${p.phone ? `<a class="call" href="${esc(telHref(p.phone))}" aria-label="撥打給${esc(m.display_name)}">${ICON.phone}</a>` : ''}
            </div>`;
        }).join('')}
      </section>
      <section class="card-list">
        <h2>行事曆類型<small>${amChild() ? '由家長管理' : '家長可以新增或刪除'}</small></h2>
        <div class="cats">
          ${EVENT_CATS.map((k) => `<span class="cat-chip" style="--cat:${CATEGORIES[k].color}">${CATEGORIES[k].label}</span>`).join('')}
          ${state.categories.map((c) => `
            <span class="cat-chip" style="--cat:${esc(c.color)}">${esc(c.label)}${amChild() ? '' : `<button data-act="del-category" data-id="${esc(c.id)}" aria-label="刪除類型「${esc(c.label)}」">×</button>`}</span>`).join('')}
        </div>
        ${amChild() ? '' : '<button class="btn ghost small" data-act="new-category">新增類型</button>'}
      </section>
      <section class="card-list">
        <h2>考試科目<small>${amChild() ? '由家長管理' : '家長可以新增或刪除'}</small></h2>
        <div class="cats">
          ${state.subjects.length ? '' : `<p class="hint">${amChild() ? '還沒有科目，請爸媽新增。' : '還沒有科目。新增之後，登記成績時才有科目可以選。'}</p>`}
          ${state.subjects.map((x) => `
            <span class="cat-chip" style="--cat:var(--green)">${esc(x.label)}${amChild() ? '' : `<button data-act="del-subject" data-id="${esc(x.id)}" aria-label="刪除科目「${esc(x.label)}」">×</button>`}</span>`).join('')}
        </div>
        ${amChild() ? '' : '<button class="btn ghost small" data-act="new-subject">新增科目</button>'}
      </section>
      ${isAdmin() ? `
      <section class="card-list">
        <h2>交通查詢<small>公車、台鐵即時資訊的資料來源</small></h2>
        <p class="hint">即時資料來自交通部 TDX 平臺，需要一組免費的 API 金鑰。只有管理員可以新增和查看。</p>
        <button class="btn ghost small" data-act="tdx-key">查看或更換 TDX 金鑰</button>
      </section>
      <section class="card-list">
        <h2>視訊通話<small>行動網路的中繼伺服器</small></h2>
        <p class="hint">用 4G／5G 視訊時，影像可能要經過 Cloudflare 的中繼伺服器才連得上。每月 1,000 GB 內免費。只有管理員可以新增和查看。</p>
        <button class="btn ghost small" data-act="turn-key">查看或更換中繼伺服器設定</button>
      </section>` : ''}
      <section class="card-list">
        <h2>面板顏色<small>只會改這支手機</small></h2>
        <div class="themes" role="group" aria-label="面板顏色">
          ${THEMES.map(([id, name, a, b]) => `
            <button class="theme ${currentTheme() === id ? 'on' : ''}" data-act="theme" data-theme-id="${id}" style="--a:${a};--b:${b}" ${currentTheme() === id ? 'aria-pressed="true"' : ''}>
              <span class="swatch"></span>${name}
            </button>`).join('')}
        </div>
      </section>
      ${pushSectionHtml()}
      ${Api.isDemo ? '<p class="demo-note">示範模式：資料只存在這台裝置。設定 Firebase 後，全家才會看到同一份資料。</p>' : ''}
      <button class="btn ghost" data-act="logout">登出</button>
      <p class="version">鍾家大宅把拔製作<small>版本 ${VERSION}</small></p>`;
  }

  // ---------- 表單面板（共用外框） ----------
  // opts: { title, submit, body, footer }；footer 是放在最下面的按鈕（例如刪除）
  function showSheet(formId, opts) {
    $sheet.innerHTML = `
      <div class="backdrop" data-act="close"></div>
      <form class="sheet" id="${formId}" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}" novalidate>
        <div class="sheet-head">
          <button type="button" class="link-btn" data-act="close">${opts.readonly ? '關閉' : '取消'}</button>
          <strong>${esc(opts.title)}</strong>
          ${opts.readonly ? '<span class="link-btn" aria-hidden="true"></span>' : `<button type="submit" class="link-btn strong">${opts.submit || '儲存'}</button>`}
        </div>
        <div class="sheet-body">
          ${opts.body}
          <p class="form-error" id="form-error" role="alert" hidden></p>
          ${opts.footer || ''}
        </div>
      </form>`;
    document.body.classList.add('sheet-open');
    if (opts.focus) setTimeout(() => { const i = $sheet.querySelector('.title-input'); if (i) i.focus(); }, 60);
  }

  function closeSheet() {
    if (sendingPhotos) { cancelPhotos = true; return; }   // 照片傳送中：改成取消剩下的，傳完這張才關
    pendingPhotos = [];
    $sheet.innerHTML = '';
    document.body.classList.remove('sheet-open');
  }

  const DELETE_BTN = '<button type="button" class="btn danger" data-act="delete">刪除</button>';
  let sheetOccurrence = null;   // 從哪一天的場次打開重複行程（用來「只取消這一次」）

  // 別人新增的行程：只能看，不能改
  function openEventView(ev, occDate) {
    const cat = catOf(ev.category);
    const weekly = ev.repeat === 'weekly';
    const when = weekly
      ? `每週${ev.repeat_days.map((d) => WEEKDAYS[d]).join('、')}，${shortDate(ev.event_date)} 到 ${shortDate(ev.end_date)}`
      : ev.end_date !== ev.event_date ? `${shortDate(ev.event_date)} 到 ${shortDate(ev.end_date)}` : shortDate(ev.event_date);
    const time = ev.start_time ? ev.start_time + (ev.end_time ? '–' + ev.end_time : '') : '全天';
    showSheet('event-view', {
      title: '行程', readonly: true,
      body: `
      <div class="view" style="--cat:${esc(cat.color)}">
        <h3>${esc(ev.title)}</h3>
        <p class="event-meta"><span class="cat">${esc(cat.label)}</span>${whoHtml(ev)}</p>
        <dl>
          <dt>日期</dt><dd>${when}${weekly && occDate ? `<br><small>這一次是 ${shortDate(occDate)}</small>` : ''}</dd>
          <dt>時間</dt><dd>${time}</dd>
          ${ev.note ? `<dt>備註</dt><dd>${esc(ev.note)}</dd>` : ''}
        </dl>
        <p class="hint">這是${esc(nameOf(ev.created_by))}新增的行程，只有${esc(nameOf(ev.created_by))}可以修改或刪除。</p>
      </div>`
    });
  }

  function openEventSheet(ev, occDate) {
    if (ev && !canEditEvent(ev)) return openEventView(ev, occDate);
    sheetOccurrence = ev && ev.repeat ? occDate : null;
    const weekly = !!(ev && ev.repeat === 'weekly');
    const e = ev || {
      title: '', category: 'schedule', event_date: state.calView === 'month' ? state.selected : today(),
      end_date: null, start_time: null, end_time: null, member_ids: [], note: ''
    };
    const allDay = !e.start_time;
    if (!eventCatIds().includes(e.category)) e.category = 'other';
    // 舊行程如果是「其他」，編輯時保留這個選項，不強迫改類型
    const catChoices = eventCatIds().concat(ev && e.category === 'other' ? ['other'] : []);
    showSheet('event-form', {
      title: ev ? '編輯' : '新增', focus: !ev,
      body: `
      <input type="hidden" name="item_id" value="${esc(e.id || '')}">
      <input class="title-input" name="title" placeholder="要做什麼？" value="${esc(e.title)}" maxlength="80" autocomplete="off">

      <fieldset class="seg">
        <legend>類型</legend>
        ${catChoices.map((k) => `
          <label style="--cat:${esc(catOf(k).color)}">
            <input type="radio" name="category" value="${k}" ${e.category === k ? 'checked' : ''}>
            <span>${esc(catOf(k).label)}</span>
          </label>`).join('')}
      </fieldset>

      <div class="row two">
        <label>開始日期<input type="date" name="event_date" value="${esc(e.event_date)}"></label>
        <label><span id="end-label">${weekly ? '重複到' : '結束日期'}</span><input type="date" name="end_date" value="${esc(e.end_date || e.event_date)}"></label>
      </div>

      <label class="switch">
        <span>每週重複</span>
        <input type="checkbox" name="weekly" ${weekly ? 'checked' : ''}>
      </label>
      <fieldset class="people days" id="days-row" ${weekly ? '' : 'hidden'}>
        <legend>星期幾？<small>從開始日期到「重複到」之間，每週的這幾天</small></legend>
        ${WEEKDAYS.map((w, i) => `
          <label style="--who:var(--green)">
            <input type="checkbox" name="weekday" value="${i}" ${weekly && e.repeat_days.includes(i) ? 'checked' : ''}>
            <span>${w}</span>
          </label>`).join('')}
      </fieldset>

      <label class="switch">
        <span>全天</span>
        <input type="checkbox" name="all_day" ${allDay ? 'checked' : ''}>
      </label>
      <div class="row two" id="time-row" ${allDay ? 'hidden' : ''}>
        <label>開始時間<input type="time" name="start_time" value="${esc(e.start_time || '')}"></label>
        <label>結束時間<input type="time" name="end_time" value="${esc(e.end_time || '')}"></label>
      </div>

      <fieldset class="people">
        <legend>誰的事？<small>都不選代表全家</small></legend>
        ${state.members.map((m) => `
          <label style="--who:${esc(m.color)}">
            <input type="checkbox" name="member" value="${esc(m.id)}" ${e.member_ids.includes(m.id) ? 'checked' : ''}>
            <span>${esc(m.display_name)}</span>
          </label>`).join('')}
      </fieldset>

      <label>備註<textarea name="note" rows="3" maxlength="500" placeholder="範圍、地點、要帶的東西…">${esc(e.note || '')}</textarea></label>`,
      footer: !ev ? '' : weekly ? `
        ${occDate ? `<button type="button" class="btn ghost skip" data-act="skip-day">只取消 ${shortDate(occDate)} 這一次</button>` : ''}
        <button type="button" class="btn danger" data-act="delete">刪除全部重複行程</button>` : DELETE_BTN
    });
    $sheet.querySelector('form').dataset.skips = JSON.stringify((ev && ev.skip_dates) || []);
  }

  function openNoteSheet(note) {
    const n = note || { title: '', body: '', pinned: false };
    showSheet('note-form', {
      title: note ? '編輯' : '新增', focus: !note, footer: note ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(n.id || '')}">
      <input class="title-input" name="title" placeholder="標題" value="${esc(n.title)}" maxlength="100" autocomplete="off">
      <label>內容<textarea name="body" rows="9" maxlength="20000" placeholder="想記下來的事…">${esc(n.body)}</textarea></label>
      <label class="switch">
        <span>置頂</span>
        <input type="checkbox" name="pinned" ${n.pinned ? 'checked' : ''}>
      </label>`
    });
  }

  function openPostSheet() {
    const others = state.members.filter((m) => m.id !== state.userId);
    showSheet('post-form', {
      title: '我有話要說', submit: '送出', focus: true,
      body: `
      <textarea class="title-input" name="text" rows="4" maxlength="2000" placeholder="想說什麼？"></textarea>
      <fieldset class="people">
        <legend>要給誰？<small>只有被選到的人可以回覆</small></legend>
        ${others.map((m) => `
          <label style="--who:${esc(m.color)}">
            <input type="checkbox" name="to" value="${esc(m.id)}">
            <span>${esc(m.display_name)}</span>
          </label>`).join('')}
      </fieldset>`
    });
  }

  function openSubjectSheet() {
    showSheet('subject-form', {
      title: '新增考試科目', submit: '新增', focus: true,
      body: `
      <input class="title-input" name="label" placeholder="科目名稱，例如：理化" maxlength="12" autocomplete="off">
      <p class="hint">新增後，登記成績時就可以直接點選這個科目。</p>`
    });
  }

  async function onDeleteSubject(btn) {
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = '確定刪除？'; btn.classList.add('armed'); return; }
    btn.disabled = true;
    try { await Api.deleteDoc('subjects', btn.dataset.id); toast('已刪除科目'); }
    catch (e) { console.error(e); btn.disabled = false; toast('刪除失敗，請再試一次'); }
  }

  function openCategorySheet() {
    showSheet('category-form', {
      title: '新增行事曆類型', submit: '新增', focus: true,
      body: `
      <input class="title-input" name="label" placeholder="類型名稱，例如：社團" maxlength="12" autocomplete="off">
      <fieldset class="colors">
        <legend>顏色</legend>
        ${CAT_COLORS.map((c, i) => `
          <label style="--c:${c}">
            <input type="radio" name="color" value="${c}" ${i === 1 ? 'checked' : ''}>
            <span aria-label="顏色 ${i + 1}"></span>
          </label>`).join('')}
      </fieldset>`
    });
  }

  async function onDeleteCategory(btn) {
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = '確定刪除？'; btn.classList.add('armed'); return; }
    btn.disabled = true;
    try { await Api.deleteCategory(btn.dataset.id); toast('已刪除類型'); }
    catch (e) { console.error(e); btn.disabled = false; toast('刪除失敗，請再試一次'); }
  }

  function openProfileSheet(id) {
    const m = member(id);
    const p = state.profiles[id] || {};
    showSheet('profile-form', {
      title: m.display_name + '的基本資料',
      body: `
      <input type="hidden" name="item_id" value="${esc(id)}">
      <label>生日<input type="date" name="birthday" value="${esc(p.birthday || '')}" max="${today()}"></label>
      <label>電話<input type="tel" name="phone" value="${esc(p.phone || '')}" maxlength="30" autocomplete="off" inputmode="tel"></label>
      <label>學校或公司<input type="text" name="org" value="${esc(p.org || '')}" maxlength="60" autocomplete="off"></label>
      <label>備註<textarea name="note" rows="3" maxlength="500" placeholder="血型、過敏、班級座號…">${esc(p.note || '')}</textarea></label>
      <p class="hint">填了生日，月曆上每年會自動出現。填了電話，設定頁可以直接撥打。</p>
      ${isAdmin() ? `
      <label class="switch">
        <span>這是小朋友（有零用錢記帳本）</span>
        <input type="checkbox" name="child" ${m.child === true ? 'checked' : ''}>
      </label>` : ''}`
    });
  }

  function openLedgerSheet(entry) {
    const parent = !amChild();
    const e = entry || { type: 'expense', amount: '', note: '', date: today() <= state.ledgerMonth + '-31' && today().slice(0, 7) === state.ledgerMonth ? today() : state.ledgerMonth + '-01' };
    const kid = member(entry ? entry.kid : state.ledgerKid);
    showSheet('ledger-form', {
      title: kid.display_name + '的零用錢', focus: !entry, footer: entry ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(e.id || '')}">
      <input type="hidden" name="kid" value="${esc(kid.id)}">
      ${entry ? `<input type="hidden" name="type" value="${e.type}">${parent && e.type === 'expense' ? `
      <label class="switch">
        <span>父母支出（不從零用錢扣）</span>
        <input type="checkbox" name="by_parent" ${e.by_parent ? 'checked' : ''}>
      </label>` : ''}` : `
      <fieldset class="seg">
        <legend>要記什麼？</legend>
        <label style="--cat:${parent ? 'var(--c-birthday)' : 'var(--ink)'}"><input type="radio" name="type" value="expense" checked><span>${parent ? '父母支出' : '支出'}</span></label>
        ${parent ? '<label style="--cat:var(--green)"><input type="radio" name="type" value="income"><span>給零用錢</span></label>' : ''}
        <label style="--cat:var(--c-exam)"><input type="radio" name="type" value="request"><span>${parent ? '需要費用' : '跟爸媽申請費用'}</span></label>
      </fieldset>`}
      <label>金額（元）<input class="title-input" type="number" name="amount" inputmode="numeric" min="1" step="1" value="${esc(e.amount)}" placeholder="0"></label>
      <label><span id="note-label">項目</span><input type="text" name="note" value="${esc(e.note)}" maxlength="100" autocomplete="off" placeholder="${parent ? '買了什麼，或是哪個月的零用錢' : '買了什麼？'}"></label>
      <label><span id="date-label">日期</span><input type="date" name="date" value="${esc(e.date)}"></label>
      ${parent && !entry ? `<p class="hint" id="parent-hint">父母支出只做紀錄，不會從${esc(kid.display_name)}的零用錢扣。</p>` : ''}`
    });
  }

  function openRequestSheet(r) {
    showSheet('request-form', {
      title: nameOf(r.kid) + '需要的費用', footer: DELETE_BTN,
      body: `
      <input type="hidden" name="item_id" value="${esc(r.id)}">
      <label>用途<input type="text" name="title" value="${esc(r.title)}" maxlength="100" autocomplete="off"></label>
      <label>金額（元）<input class="title-input" type="number" name="amount" inputmode="numeric" min="1" step="1" value="${esc(r.amount)}"></label>
      <label>哪一天需要<input type="date" name="need_date" value="${esc(r.need_date)}"></label>
      ${amChild() ? '' : `
      <label class="switch">
        <span>已經給了</span>
        <input type="checkbox" name="given" ${r.status === 'given' ? 'checked' : ''}>
      </label>
      <label id="given-amount-row" ${r.status === 'given' ? '' : 'hidden'}>實際給的金額（元）<input type="number" name="given_amount" inputmode="numeric" min="1" step="1" value="${esc(r.status === 'given' ? givenAmount(r) : r.amount)}"></label>
      <p class="hint">打開「已經給了」，會自動在${esc(nameOf(r.kid))}的零用錢記一筆「實際給的金額」的收入；關掉會把那一筆移除。</p>`}`
    });
  }

  const checkedValues = (form, name) =>
    Array.from(form.querySelectorAll('input[name="' + name + '"]:checked')).map((i) => i.value);

  // 每種表單：怎麼讀欄位、怎麼驗證、存到哪、存完做什麼
  const FORMS = {
    'event-form': {
      read(f, form) {
        const allDay = f.all_day.checked;
        const ev = {
          id: f.item_id.value || null,
          title: f.title.value.trim(),
          category: f.category.value,
          event_date: f.event_date.value,
          end_date: f.end_date.value || f.event_date.value,
          start_time: allDay ? null : (f.start_time.value || null),
          end_time: allDay ? null : (f.end_time.value || null),
          member_ids: checkedValues(form, 'member'),
          note: f.note.value.trim()
        };
        if (!ev.start_time) ev.end_time = null;
        if (f.weekly.checked) {
          ev.repeat = 'weekly';
          ev.repeat_days = checkedValues(form, 'weekday').map(Number);
          ev.skip_dates = JSON.parse(form.dataset.skips || '[]');
        }
        return ev;
      },
      check(ev, f) {
        if (!ev.title) return '請輸入標題';
        if (!ev.event_date) return '請選擇日期';
        if (ev.end_date < ev.event_date) return (ev.repeat ? '「重複到」' : '結束日期') + '不能早於開始日期';
        if (ev.repeat) {
          if (!ev.repeat_days.length) return '請選擇每週的星期幾';
          if (daysBetween(ev.event_date, ev.end_date) > 731) return '重複期間最長兩年';
          if (!occurrenceDates(ev, ev.event_date, ev.end_date).length) return '這段期間裡沒有符合的日子，請檢查日期和星期';
        }
        if (!f.all_day.checked && !ev.start_time) return '請選擇開始時間，或打開「全天」';
        if (ev.start_time && ev.end_time && (ev.repeat || ev.end_date === ev.event_date) && ev.end_time < ev.start_time) return '結束時間不能早於開始時間';
        return null;
      },
      save: (x) => Api.saveEvent(x),
      remove: (id) => Api.deleteEvent(id),
      after(ev) {
        // 存檔後跳到那一天；重複行程則跳到今天之後最近的一次
        if (ev) {
          let day = ev.event_date;
          if (ev.repeat) {
            const all = occurrenceDates(ev, ev.event_date, ev.end_date);
            day = all.find((d) => d >= today()) || all[all.length - 1] || day;
          }
          state.selected = day; state.cursor = day.slice(0, 7);
        }
        return loadEvents();
      }
    },
    'note-form': {
      read: (f) => ({ id: f.item_id.value || null, title: f.title.value.trim(), body: f.body.value.trim(), pinned: f.pinned.checked }),
      check: (n) => (!n.title && !n.body ? '請寫點內容再儲存' : null),
      save: (x) => Api.saveNote(x),
      remove: (id) => Api.deleteNote(id),
      after: () => loadNotes()
    },
    'ledger-form': {
      read: (f) => ({
        id: f.item_id.value || null, kid: f.kid.value, type: f.type.value,
        amount: Number(f.amount.value), note: f.note.value.trim(), date: f.date.value,
        // 家長新增的支出一律算父母支出；編輯時看開關。小朋友自己記的才從零用錢扣
        by_parent: f.type.value === 'expense' && !amChild() && (f.by_parent ? f.by_parent.checked : true)
      }),
      check(e) {
        if (!Number.isInteger(e.amount) || e.amount < 1) return '請輸入金額（整數，至少 1 元）';
        if (e.amount > 1000000) return '金額太大了，請再確認一次';
        if (!e.date) return '請選擇日期';
        if (e.type === 'request') return e.note ? null : '請寫下這筆費用是做什麼的';
        if (e.date > today()) return '日期不能是未來';
        if (e.type === 'expense' && !e.note) return '請寫下買了什麼';
        return null;
      },
      save(e) {
        if (e.type === 'request') return Api.saveRequest({ kid: e.kid, title: e.note, amount: e.amount, need_date: e.date, status: 'pending' });
        return Api.saveLedger({ ...e, note: e.note || '零用錢' });
      },
      remove: (id) => Api.deleteLedger(id),
      after(e) { if (e) { state.ledgerMonth = e.date.slice(0, 7); state.ledgerDay = null; } return loadLedger(); }
    },
    'give-form': {
      done: '已給，並記入零用錢',
      read: (f) => ({ id: f.item_id.value, amount: Number(f.given_amount.value) }),
      check: (x) => (!Number.isInteger(x.amount) || x.amount < 1 ? '請輸入實際給的金額（整數，至少 1 元）'
        : x.amount > 1000000 ? '金額太大了，請再確認一次' : null),
      save(x) { const r = findById(state.requests, x.id); return giveRequest(r, x.amount); },
      after() { refreshTodos(); if (state.tab === 'notes') render(); }
    },
    'request-form': {
      read: (f) => ({
        id: f.item_id.value, title: f.title.value.trim(), amount: Number(f.amount.value), need_date: f.need_date.value,
        given: f.given ? f.given.checked : null,     // 只有家長的表單才有這個開關
        given_amount: f.given_amount ? Number(f.given_amount.value) : null
      }),
      check(r) {
        if (!r.title) return '請寫下這筆費用是做什麼的';
        if (!Number.isInteger(r.amount) || r.amount < 1) return '請輸入金額（整數，至少 1 元）';
        if (r.amount > 1000000) return '金額太大了，請再確認一次';
        if (!r.need_date) return '請選擇哪一天需要';
        if (r.given && (!Number.isInteger(r.given_amount) || r.given_amount < 1 || r.given_amount > 1000000)) return '請輸入實際給的金額（整數，至少 1 元）';
        return null;
      },
      async save(r) {
        const old = findById(state.requests, r.id);
        const wasGiven = old.status === 'given';
        const given = r.given === null ? wasGiven : r.given;
        const next = { ...old, title: r.title, amount: r.amount, need_date: r.need_date };
        if (given && !wasGiven) return giveRequest(next, r.given_amount);  // 還沒給 → 已給：記一筆收入
        if (!given && wasGiven) {                                          // 已給 → 取消：把那筆收入刪掉
          if (old.ledger_id) await Api.deleteLedger(old.ledger_id).catch((e) => console.warn(e));
          await Api.saveRequest({ ...next, status: 'pending' });
          return loadLedger();
        }
        const paid = given && r.given_amount != null ? r.given_amount : givenAmount(old);
        if (given && old.ledger_id && (givenAmount(old) !== paid || old.title !== r.title)) {
          // 已給的申請改了實際金額或用途：帳本裡那一筆跟著改
          const entry = findById(state.ledger, old.ledger_id);
          if (entry) await Api.saveLedger({ ...entry, amount: paid, note: r.title });
        }
        await Api.saveRequest({ ...next, status: given ? 'given' : 'pending', given_amount: given ? paid : null });
        return loadLedger();
      },
      remove: (id) => Api.deleteRequest(id),
      after() { refreshTodos(); if (state.tab === 'notes') render(); }
    },
    'trip-form': {
      read: (f) => ({ id: f.item_id.value || null, title: f.title.value.trim(), place: f.place.value.trim(), start_date: f.start_date.value, end_date: f.end_date.value, note: f.note.value.trim() }),
      check(t) {
        if (!t.title) return '請輸入旅程名稱';
        if (!t.start_date || !t.end_date) return '請選擇出發和回程的日期';
        if (t.end_date < t.start_date) return '回程不能早於出發';
        if (daysBetween(t.start_date, t.end_date) > 60) return '一趟旅程最長 60 天';
        return null;
      },
      async save(t) {
        const data = { title: t.title, place: t.place, start_date: t.start_date, end_date: t.end_date, note: t.note };
        if (t.id) return Api.updateDoc('trips', t.id, data);
        state.tripId = await Api.addDoc('trips', { ...data, created_by: state.userId, created_at: Date.now() });
        state.tripTab = 'plan';
      },
      async remove(id) {
        // 連同底下的行程、日誌、行李、花費一起刪掉（日誌的原圖也刪）
        const t = tripOf(id);
        if (!t || !canDeleteTrip(t)) throw new Error('not-allowed');
        const items = state.tripItems.filter((x) => x.trip_id === id);
        await Promise.all(items.map((x) => Api.deleteDoc('trip_items', x.id)));
        items.filter((x) => x.image_id).forEach((x) => Api.deleteDoc('chat_images', x.image_id).catch(() => {}));
        await Api.deleteDoc('trips', id);
        state.tripId = null;
      },
      after() { render(); }
    },
    'plan-form': {
      read: (f) => ({ id: f.item_id.value || null, title: f.title.value.trim(), date: f.date.value, time: f.time.value, place: f.place.value.trim(), note: f.note.value.trim() }),
      check: (x) => (!x.title ? '請輸入要做什麼' : !x.date ? '請選擇哪一天' : null),
      save: (x) => saveTripItem('plan', x.id, { title: x.title, date: x.date, time: x.time, place: x.place, note: x.note }),
      remove: (id) => Api.deleteDoc('trip_items', id),
      after() { render(); }
    },
    'journal-form': {
      read: (f) => ({ id: f.item_id.value || null, date: f.date.value, text: f.text.value.trim(), file: f.photo.files && f.photo.files[0] }),
      check(x) {
        const old = x.id && findById(state.tripItems, x.id);
        if (!x.date) return '請選擇哪一天';
        if (!x.text && !x.file && !(old && old.thumb)) return '請寫點內容，或放一張照片';
        return null;
      },
      async save(x) {
        const data = { date: x.date, text: x.text };
        if (x.file) {
          const img = await loadImage(x.file);
          let full = shrink(img, 1280, 0.72);
          for (const [side, q] of [[1024, 0.65], [800, 0.6], [640, 0.55]]) { if (full.length <= 900000) break; full = shrink(img, side, q); }
          if (full.length > 900000) throw new Error('too-large');
          const old = x.id && findById(state.tripItems, x.id);
          data.image_id = await Api.addDoc('chat_images', { data: full, sender: state.userId, sent_at: Date.now() });
          data.thumb = shrink(img, 480, 0.65);
          if (old && old.image_id) Api.deleteDoc('chat_images', old.image_id).catch(() => {});
        }
        return saveTripItem('journal', x.id, x.id ? data : { ...data, author: state.userId });
      },
      async remove(id) {
        const old = findById(state.tripItems, id);
        if (!old || !canDeleteJournal(old)) throw new Error('not-allowed');
        await Api.deleteDoc('trip_items', id);
        if (old && old.image_id) Api.deleteDoc('chat_images', old.image_id).catch(() => {});
      },
      after() { render(); }
    },
    'cost-form': {
      read: (f) => ({ id: f.item_id.value || null, title: f.title.value.trim(), amount: Number(f.amount.value), paid_by: f.paid_by.value, date: f.date.value }),
      check(x) {
        if (!Number.isInteger(x.amount) || x.amount < 1) return '請輸入金額（整數，至少 1 元）';
        if (x.amount > 10000000) return '金額太大了，請再確認一次';
        if (!x.title) return '請寫下花在什麼上面';
        if (!x.date) return '請選擇日期';
        return null;
      },
      save: (x) => saveTripItem('cost', x.id, { title: x.title, amount: x.amount, paid_by: x.paid_by, date: x.date }),
      remove: (id) => Api.deleteDoc('trip_items', id),
      after() { render(); }
    },
    'photo-form': {
      read: (f) => ({ files: Array.from(f.photos.files || []), caption: f.caption.value.trim(), date: f.date.value }),
      check(x) {
        if (!x.files.length) return '請選擇照片';
        if (x.files.length > 10) return '一次最多 10 張，請分幾次上傳';
        if (!x.date) return '請選擇哪一天拍的';
        if (x.date > today()) return '日期不能是未來';
        return null;
      },
      async save(x) {
        const err = document.getElementById('form-error');
        let n = 0;
        for (const file of x.files) {
          n++;
          if (err && x.files.length > 1) { err.hidden = false; err.textContent = '上傳中 ' + n + ' / ' + x.files.length + '…'; }
          const img = await loadImage(file);
          let full = shrink(img, 1280, 0.72);
          for (const [side, q] of [[1024, 0.65], [800, 0.6], [640, 0.55]]) { if (full.length <= 900000) break; full = shrink(img, side, q); }
          if (full.length > 900000) throw new Error('too-large');
          const image_id = await Api.addDoc('chat_images', { data: full, sender: state.userId, sent_at: Date.now() });
          await Api.addDoc('photos', {
            month: x.date.slice(0, 7), date: x.date, caption: x.caption, thumb: shrink(img, 360, 0.6), image_id,
            author: state.userId, created_by: state.userId, created_at: Date.now()
          });
        }
      },
      done: '已放進相簿',
      after(x) { if (x) state.albumMonth = x.date.slice(0, 7); state.albumLoaded = null; render(); return loadAlbum(); }
    },
    'turn-form': {
      read: (f) => ({ key_id: f.key_id.value.trim(), api_token: f.api_token.value.trim() }),
      check: (x) => (!x.key_id || !x.api_token ? '兩個欄位都要填' : /\s/.test(x.key_id + x.api_token) ? '中間不會有空白，請重新複製一次' : null),
      save: (x) => Api.setDoc('secrets', 'turn', { key_id: x.key_id, api_token: x.api_token, updated_by: state.userId, updated_at: Date.now() }),
      done: '已儲存'
    },
    'tdx-form': {
      read: (f) => ({ client_id: f.client_id.value.trim(), client_secret: f.client_secret.value.trim() }),
      check: (x) => (!x.client_id || !x.client_secret ? '兩個欄位都要填' : /\s/.test(x.client_id + x.client_secret) ? '金鑰中間不會有空白，請重新複製一次' : null),
      save: (x) => Api.setDoc('secrets', 'tdx', { client_id: x.client_id, client_secret: x.client_secret, updated_by: state.userId, updated_at: Date.now() }),
      done: '金鑰已儲存',
      after() { state.transit.error = ''; }
    },
    'todo-form': {
      read: (f) => ({ id: f.item_id.value, text: f.text.value.trim(), note: f.note.value.trim(), who: f.who.value, due: f.due.value, repeat: f.repeat.value, star: f.star.checked }),
      check(x) {
        const old = findById(state.shopping, x.id);
        if (!old || !canEditTodo(old)) return '這件事是別人交代的，不能修改';
        if (!x.text) return '請寫下要做什麼';
        if (x.repeat && !x.due) return '重複的待辦要選一個開始的日期';
        return null;
      },
      save: (x) => Api.updateDoc('shopping', x.id, { text: x.text, note: x.note, who: x.who, due: x.due, repeat: x.repeat, star: x.star }),
      async remove(id) {
        const old = findById(state.shopping, id);
        if (!old || !canEditTodo(old)) throw new Error('not-allowed');
        await Api.deleteDoc('shopping', id);
      },
      after() { refreshShop(); }
    },
    'score-form': {
      read: (f, form) => ({
        id: f.item_id.value || null, kid: f.kid.value, subject: checkedValues(form, 'subject')[0] || '', term: checkedValues(form, 'term')[0] || '', title: f.title.value.trim(),
        date: f.date.value, score: Number(f.score.value), full: Number(f.full.value), note: f.note.value.trim(),
        blank: f.score.value === ''
      }),
      check(x) {
        if (!x.term) return '請選擇年級與學期';
        if (!x.subject) return subjectList().length ? '請選擇科目' : '還沒有科目，請先到「設定」新增考試科目';
        if (x.blank || !(x.score >= 0)) return '請填寫分數';
        if (!(x.full >= 1) || x.full > 1000) return '滿分請填 1 到 1000 之間';
        if (x.score > x.full) return '分數不能超過滿分';
        if (!x.date) return '請選擇考試日期';
        if (x.date > today()) return '考試日期不能是未來';
        return null;
      },
      save(x) {
        const data = { kid: x.kid, subject: x.subject, term: x.term, title: x.title || '考試', date: x.date, score: x.score, full: x.full, note: x.note };
        return x.id ? Api.updateDoc('scores', x.id, data) : Api.addDoc('scores', data);
      },
      remove: (id) => Api.deleteDoc('scores', id),
      // 存檔後切到那個學期，馬上看得到剛登記的那一筆
      after(x) { if (x && state.scoreTerm) setScoreTerm(x.term); return loadScores(); }
    },
    'poll-form': {
      done: '投票已送出',
      read: (f) => ({
        question: f.question.value.trim(),
        options: f.options.value.split('\n').map((x) => x.trim()).filter(Boolean),
        deadline: f.deadline.value
      }),
      check(p) {
        if (!p.question) return '請寫下想問什麼';
        if (p.options.length < 2) return '至少要有兩個選項，一行一個';
        if (p.options.length > 6) return '選項最多 6 個';
        if (p.options.some((o) => o.length > 30)) return '每個選項最多 30 個字';
        if (new Set(p.options).size !== p.options.length) return '選項有重複';
        if (p.deadline && p.deadline < today()) return '截止日期不能是過去';
        return null;
      },
      save(p) {
        // deadline_at 是截止日當天最後一刻的時間（毫秒），給資料庫規則用來擋掉逾期的票
        const end = p.deadline ? parse(p.deadline) : null;
        if (end) end.setHours(23, 59, 59, 999);
        return Api.addDoc('polls', {
          question: p.question, options: p.options, author: state.userId, created_at: Date.now(), closed: false,
          deadline: p.deadline || '', deadline_at: end ? end.getTime() : 0
        });
      },
      after() { state.pollHistory = false; refreshPolls(); const sc = scroller(); if (sc) sc.scrollTop = 0; }
    },
    'card-form': {
      read: (f) => ({ id: f.item_id.value || null, title: f.title.value.trim(), member: f.member.value, body: f.body.value.trim() }),
      check: (c) => (!c.title ? '請輸入標題' : !c.body ? '請填寫內容' : null),
      save(c) {
        const data = { title: c.title, member: c.member, body: c.body, updated_at: Date.now() };
        return c.id ? Api.updateDoc('cards', c.id, data) : Api.addDoc('cards', data);
      },
      remove: (id) => Api.deleteDoc('cards', id),
      after() { if (state.tab === 'notes') render(); }
    },
    'subject-form': {
      done: '已新增',
      read: (f) => ({ label: f.label.value.trim() }),
      check(x) {
        if (!x.label) return '請輸入科目名稱';
        if (subjectList().includes(x.label)) return '已經有這個科目了';
        if (state.subjects.length >= 30) return '自訂科目最多 30 個';
        return null;
      },
      save: (x) => Api.addDoc('subjects', { label: x.label, created_at: Date.now() }),
      after() { if (state.tab === 'me') render(); }
    },
    'category-form': {
      done: '已新增',
      read: (f) => ({ label: f.label.value.trim(), color: f.color.value }),
      check(c) {
        if (!c.label) return '請輸入類型名稱';
        const taken = EVENT_CATS.map((k) => CATEGORIES[k].label).concat(state.categories.map((x) => x.label));
        if (taken.includes(c.label)) return '已經有這個類型了';
        if (state.categories.length >= 20) return '自訂類型最多 20 個';
        return null;
      },
      save: (c) => Api.addCategory(c),
      after() { if (state.tab === 'me') render(); }
    },
    'post-form': {
      done: '已送出',
      read: (f, form) => ({ text: f.text.value.trim(), to: checkedValues(form, 'to') }),
      check: (p) => (!p.text ? '請寫下想說的話' : !p.to.length ? '請選擇要給誰' : null),
      save: (x) => Api.addPost(x),
      after: () => { const s = scroller(); if (s) s.scrollTop = 0; }
    },
    'profile-form': {
      read: (f) => ({
        id: f.item_id.value, birthday: f.birthday.value, phone: f.phone.value.trim(), org: f.org.value.trim(), note: f.note.value.trim(),
        child: f.child ? f.child.checked : null      // 只有管理員的表單才有這個開關
      }),
      check: (p) => (p.birthday && p.birthday > today() ? '生日不能是未來的日期' : null),
      async save(p) {
        await Api.saveProfile(p.id, p);
        const m = member(p.id);
        if (p.child !== null && m && (m.child === true) !== p.child) await Api.setChild(p.id, p.child);
      },
      async after() { state.members = await Api.listMembers(); await loadProfiles(); await loadEvents(); render(); }
    }
  };

  async function onSave(form) {
    const spec = FORMS[form.id];
    const err = form.querySelector('#form-error');
    const fail = (msg) => { err.textContent = msg; err.hidden = false; };
    const item = spec.read(form.elements, form);
    const problem = spec.check(item, form.elements);
    if (problem) return fail(problem);

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await spec.save(item);
      closeSheet();
      toast(spec.done || '已儲存');
      await spec.after(item);
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      fail('沒有成功，請確認網路後再試一次');
    }
  }

  async function onDelete(btn) {
    // 第一次按只是確認，第二次才真的刪除
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = '再按一次確定刪除';
      return;
    }
    const form = btn.closest('form');
    const spec = FORMS[form.id];
    btn.disabled = true;
    try {
      await spec.remove(form.elements.item_id.value);
      closeSheet();
      toast('已刪除');
      await spec.after(null);
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      toast('刪除失敗，請再試一次');
    }
  }

  // 重複行程：只取消某一次（把那天記進 skip_dates，其他場次不動）
  async function onSkipDay(btn) {
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = '再按一次確定取消這一次';
      return;
    }
    const id = btn.closest('form').elements.item_id.value;
    const hit = findById(state.monthEvents.concat(state.upcoming), id);
    const series = hit && (hit.series || hit);
    if (!series || !sheetOccurrence) return;
    btn.disabled = true;
    try {
      await Api.saveEvent({ ...series, skip_dates: (series.skip_dates || []).concat(sheetOccurrence) });
      closeSheet();
      toast('已取消這一次');
      await loadEvents();
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      toast('取消失敗，請再試一次');
    }
  }

  // ---------- 事件處理 ----------
  function shiftMonth(n) {
    const d = parse(state.cursor + '-01');
    d.setMonth(d.getMonth() + n);
    state.cursor = ymd(d).slice(0, 7);
    state.selected = state.cursor === today().slice(0, 7) ? today() : state.cursor + '-01';
    render();
    loadEvents();
    syncHolidays([state.cursor.slice(0, 4)]);
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'tab') {
      if (el.dataset.tab === 'notes' && state.tab === 'notes' && state.notesView !== 'hub') { state.notesView = 'hub'; state.tripId = null; state.transit.route = null; }
      state.tab = el.dataset.tab;
      state.menuMsg = null; state.pollEdit = null;
      if (state.tab === 'chat') markRead();
      render();
      loadTab();
    }
    else if (act === 'cal-view') { state.calView = el.dataset.view; render(); scroller().scrollTop = 0; }
    else if (act === 'prev') shiftMonth(-1);
    else if (act === 'next') shiftMonth(1);
    else if (act === 'today') { state.cursor = today().slice(0, 7); state.selected = today(); render(); loadEvents(); }
    else if (act === 'pick') {
      state.selected = el.dataset.date;
      if (state.selected.slice(0, 7) !== state.cursor) { state.cursor = state.selected.slice(0, 7); render(); loadEvents(); }
      else render();
    }
    else if (act === 'new') {
      if (state.tab === 'notes' && state.notesView === 'ledger') { if (kids().length) openLedgerSheet(null); }
      else if (state.tab === 'notes' && state.notesView === 'cards') { if (!amChild()) openCardSheet(null); }
      else if (state.tab === 'notes' && state.notesView === 'scores') { if (kids().length) openScoreSheet(null); }
      else if (state.tab === 'notes' && state.notesView === 'album') openAlbumSheet();
      else if (state.tab === 'notes' && state.notesView === 'notes') {
        if (!state.tripId) openTripSheet(null);
        else if (state.tripTab === 'plan') openPlanSheet(null);
        else if (state.tripTab === 'journal') openJournalSheet(null);
        else if (state.tripTab === 'cost') openCostSheet(null);
      }
      else if (state.tab === 'notes') openNoteSheet(null);
      else if (state.tab === 'posts' && state.postsView === 'polls') openPollSheet();
      else if (state.tab === 'posts') openPostSheet();
      else openEventSheet(null);
    }
    else if (act === 'edit-event') {
      const e = findById(state.monthEvents.concat(state.upcoming), el.dataset.id);
      if (e) openEventSheet(e.series || e, el.dataset.date);
    }
    else if (act === 'skip-day') onSkipDay(el);
    else if (act === 'notes-view') { state.notesView = el.dataset.view; render(); scroller().scrollTop = 0; loadTab(); }
    else if (act === 'ledger-kid') { state.ledgerKid = el.dataset.id; state.ledgerDay = null; state.scoreSubject = ''; render(); }
    else if (act === 'ledger-day') { state.ledgerDay = el.dataset.date && el.dataset.date !== state.ledgerDay ? el.dataset.date : null; render(); }
    else if (act === 'req-given') onRequestGiven(el);
    else if (act === 'edit-request') { const r = findById(state.requests, el.dataset.id); if (r) openRequestSheet(r); }
    else if (act === 'open-ledger') {
      Object.assign(state, { tab: 'notes', notesView: 'ledger', ledgerKid: el.dataset.kid, ledgerMonth: el.dataset.month, ledgerDay: null });
      render(); loadLedger();
    }
    else if (act === 'ledger-prev' || act === 'ledger-next' || act === 'ledger-now') {
      const d = parse(state.ledgerMonth + '-01');
      d.setMonth(d.getMonth() + (act === 'ledger-prev' ? -1 : 1));
      state.ledgerMonth = act === 'ledger-now' ? today().slice(0, 7) : ymd(d).slice(0, 7);
      state.ledgerDay = null;
      render();
    }
    else if (act === 'edit-ledger') { const e = findById(state.ledger, el.dataset.id); if (e && canEditLedger(e)) openLedgerSheet(e); }
    else if (act === 'edit-note') { const n = findById(state.notes, el.dataset.id); if (n) openNoteSheet(n); }
    else if (act === 'edit-profile') { if (canEditProfile(el.dataset.id)) openProfileSheet(el.dataset.id); }
    else if (act === 'chat-search') {
      state.chatSearch = !state.chatSearch;
      state.chatQuery = ''; state.menuMsg = null;
      render();
      if (state.chatSearch) document.getElementById('chat-q').focus(); else scrollChat();
    }
    else if (act === 'msg-menu') { state.menuMsg = state.menuMsg === el.dataset.id ? null : el.dataset.id; refreshChat(false); }
    else if (act === 'recall') onRecall(el.dataset.id);
    else if (act === 'del-post') onDeletePost(el);
    else if (act === 'close') closeSheet();
    else if (act === 'delete') onDelete(el);
    else if (act === 'del-journal') onDeleteJournal(el);
    else if (act === 'transit-mode') { const t = state.transit; t.mode = el.dataset.mode; t.error = ''; t.updatedAt = 0; render(); loadTransit(); }
    else if (act === 'transit-route') { const t = state.transit; t.results = null; t.routeDir = Number(el.dataset.dir || 0); t.route = { area: el.dataset.area, areaName: '', name: el.dataset.name, dirs: [] }; t.updatedAt = 0; render(); scroller().scrollTop = 0; loadRoute(el.dataset.area, el.dataset.name); }
    else if (act === 'transit-back') { const t = state.transit; t.route = null; t.updatedAt = 0; render(); scroller().scrollTop = 0; loadTransit(); }
    else if (act === 'transit-clear') { state.transit.results = null; state.transit.q = ''; render(); }
    else if (act === 'transit-dir') { state.transit.routeDir = Number(el.dataset.dir); render(); }
    else if (act === 'transit-refresh') loadTransit();
    else if (act === 'transit-fav') toggleFavStop(el);
    else if (act === 'tra-fav') toggleFavStation();
    else if (act === 'tra-station') { const t = state.transit; const st = (t.stations || []).find((x) => x.id === el.dataset.id); if (st) { t.station = st; t.board = null; t.traQ = ''; t.updatedAt = 0; render(); loadTra(); } }
    else if (act === 'tdx-key') openTdxSheet();
    else if (act === 'turn-key') openTurnSheet();
    else if (act === 'call-pick') openCallPicker();
    else if (act === 'call-start') { closeSheet(); startCall(el.dataset.id); }
    else if (act === 'call-accept') acceptCall();
    else if (act === 'call-decline') declineCall();
    else if (act === 'call-end') hangUp(call.status === 'ringing' ? 'canceled' : 'ended');
    else if (act === 'call-mute') toggleMute();
    else if (act === 'call-cam') toggleCam();
    else if (act === 'call-flip') flipCamera();
    else if (act === 'chat-older') {
      // 往上多展開 60 則，畫面停在原本看的位置
      const sc = scroller(), fromBottom = sc.scrollHeight - sc.scrollTop;
      state.chatShown += 60; refreshChat(false);
      sc.scrollTop = sc.scrollHeight - fromBottom;
    }
    else if (act === 'open-photo') openPhoto(el.dataset.id);
    else if (act === 'close-photo') closePhoto();
    else if (act === 'del-photo') onDeletePhoto(el);
    else if (act === 'del-comment') onDeleteComment(el);
    else if (act === 'album-prev' || act === 'album-next' || act === 'album-now') {
      const d = parse(state.albumMonth + '-01');
      d.setMonth(d.getMonth() + (act === 'album-prev' ? -1 : 1));
      const to = act === 'album-now' ? today().slice(0, 7) : ymd(d).slice(0, 7);
      if (to <= today().slice(0, 7)) { state.albumMonth = to; render(); scroller().scrollTop = 0; loadAlbum(); }
    }
    else if (act === 'posts-view') { state.postsView = el.dataset.view; render(); scroller().scrollTop = 0; }
    else if (act === 'open-polls') { state.tab = 'posts'; state.postsView = 'polls'; state.pollHistory = false; render(); }
    else if (act === 'vote') onVote(el);
    else if (act === 'close-poll') onPollAction(el, 'close');
    else if (act === 'void-poll') onPollAction(el, 'void');
    else if (act === 'poll-open') { state.pollOpen = state.pollOpen === el.dataset.id ? null : el.dataset.id; refreshPolls(); }
    else if (act === 'poll-history') { state.pollHistory = !!el.dataset.history; state.pollEdit = null; state.pollOpen = null; refreshPolls(); scroller().scrollTop = 0; }
    else if (act === 'home-poll') { state.homePollId = el.dataset.id; state.pollEdit = null; refreshPolls(); }
    else if (act === 'poll-edit') { state.pollEdit = state.pollEdit === el.dataset.id ? null : el.dataset.id; refreshPolls(); }
    else if (act === 'del-poll') onPollAction(el, 'del');
    else if (act === 'poll-preset') {
      const f = el.closest('form').elements;
      f.question.value = el.dataset.q; f.options.value = el.dataset.o.split('|').join('\n');
    }
    else if (act === 'open-trip') {
      Object.assign(state, { tab: 'notes', notesView: 'notes', tripId: el.dataset.id, tripTab: 'plan' });
      render(); scroller().scrollTop = 0;
    }
    else if (act === 'trip-back') { state.tripId = null; render(); scroller().scrollTop = 0; }
    else if (act === 'trip-tab') { state.tripTab = el.dataset.tab; render(); }
    else if (act === 'edit-trip') { const t = tripOf(el.dataset.id); if (t) openTripSheet(t); }
    else if (act === 'new-plan') openPlanSheet(null, el.dataset.date);
    else if (act === 'edit-plan') { const x = findById(state.tripItems, el.dataset.id); if (x) openPlanSheet(x); }
    else if (act === 'edit-journal') { const x = findById(state.tripItems, el.dataset.id); if (x && x.author === state.userId) openJournalSheet(x); }
    else if (act === 'edit-cost') { const x = findById(state.tripItems, el.dataset.id); if (x) openCostSheet(x); }
    else if (act === 'trip-photo') openTripPhoto(el.dataset.id);
    else if (act === 'pack-toggle') {
      const x = findById(state.tripItems, el.dataset.id);
      if (x) Api.updateDoc('trip_items', x.id, { done: !x.done, done_by: x.done ? null : state.userId }).catch(() => toast('沒有成功，請再試一次'));
    }
    else if (act === 'pack-del') Api.deleteDoc('trip_items', el.dataset.id).catch(() => toast('刪除失敗，請再試一次'));
    else if (act === 'old-notes') { state.showOldNotes = !state.showOldNotes; if (state.showOldNotes) loadNotes(); render(); }
    else if (act === 'new-note') openNoteSheet(null);
    else if (act === 'score-term') { setScoreTerm(el.dataset.term); state.scoreSubject = ''; render(); }
    else if (act === 'score-subject') { state.scoreSubject = el.dataset.subject === state.scoreSubject ? '' : el.dataset.subject; render(); }
    else if (act === 'edit-score') { const x = findById(state.scores, el.dataset.id); if (x && canEditScore(x)) openScoreSheet(x); }
    else if (act === 'shop-toggle') onShopToggle(el.dataset.id);
    else if (act === 'shop-clear') onShopClear(el);
    else if (act === 'edit-todo') { const x = findById(state.shopping, el.dataset.id); if (x) openTodoSheet(x); }
    else if (act === 'todo-filter') { state.todoFilter = el.dataset.filter; refreshShop(); document.querySelectorAll('.todo-filter button').forEach((b) => { const on = b.dataset.filter === state.todoFilter; b.classList.toggle('on', on); on ? b.setAttribute('aria-pressed', 'true') : b.removeAttribute('aria-pressed'); }); }
    else if (act === 'todo-show-done') { state.todoShowDone = !state.todoShowDone; refreshShop(); }
    else if (act === 'todo-pick') {
      const k = el.dataset.kind;
      if (k === 'who') state.todoNewWho = el.dataset.value; else if (k === 'repeat') state.todoNewRepeat = el.dataset.value; else state.todoNewDue = el.dataset.value;
      document.querySelectorAll('.todo-chip[data-kind="' + k + '"]').forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      if (k === 'due') { const d = document.querySelector('.todo-date'); if (d) { d.classList.remove('on'); d.firstChild.textContent = '選日期'; d.querySelector('input').value = ''; } }
    }
    else if (act === 'todo-undo') onTodoUndo(el.dataset.id);
    else if (act === 'open-todos') { Object.assign(state, { tab: 'notes', notesView: 'shop' }); render(); scroller().scrollTop = 0; }
    else if (act === 'edit-card') { const c = findById(state.cards, el.dataset.id); if (c && !amChild()) openCardSheet(c); }
    else if (act === 'view-image') openImage(el.dataset.id);
    else if (act === 'tray-cancel') closeSheet();
    else if (act === 'tray-remove') { pendingPhotos.splice(Number(el.dataset.i), 1); if (pendingPhotos.length) renderTray(); else closeSheet(); }
    else if (act === 'tray-send') sendPendingPhotos();
    else if (act === 'tray-stop') { cancelPhotos = true; el.disabled = true; el.textContent = '取消中…'; }
    else if (act === 'new-subject') { if (!amChild()) openSubjectSheet(); }
    else if (act === 'del-subject') onDeleteSubject(el);
    else if (act === 'new-category') { if (!amChild()) openCategorySheet(); }
    else if (act === 'del-category') onDeleteCategory(el);
    else if (act === 'theme') { applyTheme(el.dataset.themeId); render(); }
    else if (act === 'push-on') onPushOn(el);
    else if (act === 'push-off') { Api.disablePush().then(() => { toast('已關閉通知'); render(); }); }
    else if (act === 'logout') {
      stopWatching();
      clearCache();
      // 登出時也把這支手機從通知名單移除，避免登出後還收到通知
      Api.disablePush().catch(() => {}).then(() => Api.beat(false)).catch(() => {}).then(() => Api.signOut()).then(() => {
        Object.assign(state.transit, freshTransit());
        if (call.role) hangUp('ended'); hideIncoming();
        Object.assign(state, {
          userId: null, tab: 'cal', messages: [], notes: [], categories: [], requests: [], ledgerDay: null, ledger: [], ledgerKid: null, notesView: 'hub', postsView: 'posts', trips: [], tripItems: [], tripId: null, shopping: [], cards: [], subjects: [], scores: [], scoreSubject: '', polls: [], votes: [], posts: [], replies: [],
          profiles: {}, presence: {}, draft: '', postDrafts: {}, chatSearch: false, chatQuery: ''
        });
        renderLogin();
      });
    }
  });

  document.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const id = form.getAttribute('id');
    if (id === 'login-form') onLogin(form);
    else if (id === 'chat-form') onSend(form);
    else if (id === 'shop-form') onShopAdd(form);
    else if (id === 'pack-form') onPackAdd(form);
    else if (id === 'transit-search-form') onTransitSearch(form);
    else if (id === 'album-comment-form') onPhotoComment(form);
    else if (form.classList.contains('reply-form')) onReply(form);
    else if (FORMS[id]) onSave(form);
  });

  // 送出鈕：手指一碰到就送出，而且不讓按鈕搶走輸入框的焦點。
  // 否則 iPhone 會先收起鍵盤、畫面跟著移動，第一下按不到按鈕，要按第二次才送得出去。
  // 之後瀏覽器補發的 click／submit 會因為輸入框已清空而被忽略，不會重複送出。
  function sendFromButton(ev) {
    const btn = ev.target.closest && ev.target.closest('.send');
    if (!btn) return;
    if (ev.cancelable) ev.preventDefault();
    const form = btn.closest('form');
    if (form.getAttribute('id') === 'chat-form') onSend(form);
    else if (form.getAttribute('id') === 'shop-form') onShopAdd(form);
    else if (form.getAttribute('id') === 'pack-form') onPackAdd(form);
    else if (form.getAttribute('id') === 'transit-search-form') onTransitSearch(form);
    else if (form.getAttribute('id') === 'album-comment-form') onPhotoComment(form);
    else if (form.classList.contains('reply-form')) onReply(form);
  }
  // touchstart 要設 passive: false，preventDefault 才有效（iPhone 靠它才不會收鍵盤）
  document.addEventListener('touchstart', sendFromButton, { passive: false });
  document.addEventListener('pointerdown', sendFromButton);
  document.addEventListener('mousedown', (ev) => { if (ev.target.closest('.send')) ev.preventDefault(); });

  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'chat-input') state.draft = t.value;
    else if (t.id === 'chat-q') { state.chatQuery = t.value; refreshChat(false); }
    else if (t.id === 'transit-q') state.transit.q = t.value;
    else if (t.id === 'todo-date') {
      // 自己選日期：取代「不限／今天／明天」
      state.todoNewDue = t.value || '';
      document.querySelectorAll('.todo-chip[data-kind="due"]').forEach((b) => { const on = !t.value && b.dataset.value === ''; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      t.parentNode.classList.toggle('on', !!t.value);
      t.parentNode.firstChild.textContent = t.value ? shortDate(t.value).replace(/（.*/, '') : '選日期';
    }
    else if (t.id === 'tra-q') {
      state.transit.traQ = t.value;
      if (!ev.isComposing) refreshFoundStations();     // 注音還在選字時先不動，選好字（compositionend）再更新
    }
    else if (t.form && t.form.classList.contains('reply-form')) state.postDrafts[t.form.dataset.post] = t.value;
  });

  // 費用申請表單：打開「已經給了」才出現「實際給的金額」
  document.addEventListener('change', (ev) => {
    const form = ev.target.form;
    if (!form || form.getAttribute('id') !== 'request-form' || ev.target.name !== 'given') return;
    form.querySelector('#given-amount-row').hidden = !ev.target.checked;
  });

  // 零用錢表單：選「申請費用」時，欄位名稱跟著換
  document.addEventListener('change', (ev) => {
    const form = ev.target.form;
    if (!form || form.getAttribute('id') !== 'ledger-form' || ev.target.name !== 'type') return;
    const request = ev.target.value === 'request';
    form.querySelector('#note-label').textContent = request ? '用途' : '項目';
    form.querySelector('#date-label').textContent = request ? '哪一天需要' : '日期';
    form.elements.note.placeholder = request ? '例如：學校舞會' : ev.target.value === 'income' ? '例如：11 月零用錢' : '買了什麼？';
    const hint = form.querySelector('#parent-hint');
    if (hint) hint.hidden = ev.target.value !== 'expense';
  });

  document.addEventListener('change', (ev) => {
    const form = ev.target.form;
    if (!form || form.getAttribute('id') !== 'event-form') return;
    const f = form.elements;
    if (ev.target.name === 'all_day') form.querySelector('#time-row').hidden = ev.target.checked;
    if (ev.target.name === 'event_date' && f.end_date.value < f.event_date.value) f.end_date.value = f.event_date.value;
    if (ev.target.name === 'weekly') {
      const on = ev.target.checked;
      form.querySelector('#days-row').hidden = !on;
      form.querySelector('#end-label').textContent = on ? '重複到' : '結束日期';
      // 預設勾選開始日期那天的星期
      if (on && f.event_date.value && !checkedValues(form, 'weekday').length) {
        f.weekday[parse(f.event_date.value).getDay()].checked = true;
      }
    }
  });

  document.addEventListener('change', (ev) => { if (ev.target.id === 'chat-file') onPickImage(ev.target); });

  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $sheet.innerHTML) closeSheet(); });

  // App 切到背景時標成離線；回來時標成上線並重新讀取目前的分頁
  let hiddenAt = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (!state.userId) return;
    const visible = document.visibilityState === 'visible';
    if (visible && Date.now() - hiddenAt > 5000) Api.reconnect();   // 離開超過 5 秒才需要重連
    if (!visible) hiddenAt = Date.now();
    beat(visible);
    if (!visible || $sheet.innerHTML) return;
    if (state.tab === 'chat') { markRead(); refreshChat(false); refreshBadges(); }
    else loadTab();
  });

  // 鍵盤處理。平常版面由 CSS 填滿螢幕，這裡完全不介入。
  // 只有「輸入框有焦點，而且可見高度明顯變矮」時才視為鍵盤開著：
  // 把 App 縮到可見高度，讓輸入列貼在鍵盤上方，並收起底部選單。
  // 輸入框一失去焦點就立刻還原，不等瀏覽器回報高度
  // （iPhone 收起鍵盤後回報的高度有時是舊的，會讓選單卡在半空中）。
  (function trackKeyboard() {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const height = () => (vv ? vv.height : window.innerHeight);
    let full = height();
    const typing = () => {
      const a = document.activeElement;
      return !!a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT'
        && !/^(checkbox|radio|date|time|button|submit|hidden)$/.test(a.type)));
    };
    function apply() {
      const h = height();
      if (h > full) full = h;
      const open = typing() && full - h > 120;
      const changed = open !== document.body.classList.contains('kb-open');
      document.body.classList.toggle('kb-open', open);
      // 鍵盤彈出或收起時畫面高度變了，聊天室要重新貼到最新一則
      if (changed) setTimeout(scrollChat, 0);
      if (open) root.style.setProperty('--vh', h + 'px'); else root.style.removeProperty('--vh');
      // 鍵盤收起後，把被系統推上去的頁面拉回原位
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    }
    const settle = () => { apply(); setTimeout(apply, 80); setTimeout(apply, 400); };
    if (vv) { vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply); }
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', () => { full = 0; settle(); });
    document.addEventListener('focusin', settle);
    // 焦點離開時稍等一下再判斷：按送出鈕時焦點會馬上回到輸入框，不必讓畫面跳一下
    document.addEventListener('focusout', () => { setTimeout(apply, 60); setTimeout(apply, 400); });
    document.addEventListener('visibilitychange', settle);
    apply();
  })();

  // ---------- 從通知進來 ----------
  // 點了手機上的通知後，直接跳到對應的分頁（聊天，或我有話要說）。
  // App 沒開著時，分頁名稱放在網址的 # 後面；App 開著時，由 service worker 傳訊息過來。
  // ---------- 視訊通話 ----------
  // 一對一視訊，用瀏覽器內建的 WebRTC。雙方交換連線資訊（信令）走 Firestore：
  //   calls/{id}        { from, to: [對方], status: ringing | active | ended | declined | missed | canceled,
  //                       offer, answer, created_at, answered_at, ended_at }
  //   call_signals/{id} { call_id, from, cand（ICE 候選，JSON 字串）, created_at }
  // 行動網路連不上時，影像經 Cloudflare 的中繼伺服器（TURN）轉送；中繼的帳密由雲端函式 callIce 臨時發給。
  // 通話結束後由撥打的人把這通電話的資料刪掉。
  const RING_MS = 60000;                  // 響多久沒接就算未接
  const call = { id: null, peer: null, role: null, status: '', pc: null, local: null, remote: null, pending: [], seen: new Set(),
    started: 0, timer: null, tick: null, muted: false, camOff: false, facing: 'user', incoming: null, unsubSig: null, wake: null, ending: false };
  const dismissedCalls = new Set();
  state.calls = [];
  let $call = null;
  function callRoot() {
    if (!$call) { $call = document.createElement('div'); $call.id = 'call-root'; document.body.appendChild($call); }
    return $call;
  }
  const CALL_ICON = {
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.500" width="12.500" height="11" rx="2.500"/><path d="M15.500 10.500l5-3v9l-5-3z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.500" width="6" height="11" rx="3"/><path d="M5.500 11.500a6.500 6.500 0 0 0 13 0M12 18v2.500"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.500" width="6" height="11" rx="3"/><path d="M5.500 11.500a6.500 6.500 0 0 0 13 0M12 18v2.500M4 4l16 16"/></svg>',
    camOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.500" width="12.500" height="11" rx="2.500"/><path d="M15.500 10.500l5-3v9l-5-3zM3 4l17 16"/></svg>',
    flip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9a8 8 0 0 1 14.500-3.500M20 15a8 8 0 0 1-14.500 3.500"/><path d="M18.500 2.500v3.500H15M5.500 21.500V18H9"/></svg>',
    end: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13.500c5-4.500 13-4.500 18 0l-2 2.500-3.500-1.500v-2.500a10 10 0 0 0-5 0v2.500L7 16z" fill="currentColor"/></svg>'
  };

  // 中繼伺服器的設定：雲端函式發的臨時帳密；拿不到就只用免費的 STUN（同一個 Wi-Fi 或一般網路多半還是連得上）
  async function iceServers() {
    try { const r = await Api.callIce(); if (r && Array.isArray(r.iceServers) && r.iceServers.length) return r.iceServers; }
    catch (e) { console.warn('拿不到中繼伺服器', e); }
    return [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];
  }
  function getMedia() {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { facingMode: call.facing, width: { ideal: 640 }, height: { ideal: 480 } }
    });
  }
  const mediaError = (e) => (e && e.name === 'NotAllowedError'
    ? '沒有相機或麥克風的權限。請到 iPhone 的「設定」允許這個 App 使用相機和麥克風。'
    : '打不開相機或麥克風，請確認沒有其他 App 正在使用。');

  function makePeer(servers) {
    const pc = new RTCPeerConnection({ iceServers: servers });
    call.local.getTracks().forEach((t) => pc.addTrack(t, call.local));
    pc.ontrack = (ev) => { call.remote = ev.streams[0] || new MediaStream([ev.track]); attachVideos(); };
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const c = JSON.stringify(ev.candidate.toJSON());
      if (call.id) sendCandidate(c); else call.pending.push(c);
    };
    pc.onconnectionstatechange = () => {
      if (pc !== call.pc) return;
      const s = pc.connectionState;
      if (s === 'connected') { call.status = 'connected'; if (!call.started) call.started = Date.now(); }
      else if (s === 'disconnected') call.status = 'reconnecting';
      else if (s === 'failed') { toast('連線中斷了'); hangUp('ended'); return; }
      updateCallView();
    };
    return pc;
  }
  function sendCandidate(c) {
    Api.addDoc('call_signals', { call_id: call.id, from: state.userId, cand: c, created_at: Date.now() }).catch((e) => console.warn(e));
  }
  // 對方的 ICE 候選：先設好對方的連線描述才能加
  function useSignals(list) {
    if (!call.pc || !call.pc.remoteDescription) return;
    list.filter((s) => s.call_id === call.id && s.from === call.peer && !call.seen.has(s.id)).forEach((s) => {
      call.seen.add(s.id);
      try { call.pc.addIceCandidate(JSON.parse(s.cand)).catch((e) => console.warn(e)); } catch (e) { console.warn(e); }
    });
  }
  let lastSignals = [];
  function watchSignals() {
    if (call.unsubSig) return;
    call.unsubSig = Api.watchList('call_signals', (list) => { lastSignals = list; useSignals(list); });
  }

  async function startCall(peerId) {
    if (call.id || call.role) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.RTCPeerConnection) return toast('這支手機不支援視訊通話');
    Object.assign(call, { peer: peerId, role: 'caller', status: 'starting', pending: [], seen: new Set(), started: 0, muted: false, camOff: false, ending: false });
    buildCallView();
    try { call.local = await getMedia(); } catch (e) { console.warn(e); endLocal(); return toast(mediaError(e)); }
    attachVideos();
    try {
      call.pc = makePeer(await iceServers());
      const offer = await call.pc.createOffer();
      await call.pc.setLocalDescription(offer);
      if (!call.role) return;                       // 等待時已經掛斷
      call.id = await Api.addDoc('calls', { from: state.userId, to: [peerId], status: 'ringing', offer: { type: offer.type, sdp: offer.sdp }, created_at: Date.now() });
      call.pending.splice(0).forEach(sendCandidate);
      call.status = 'ringing';
      watchSignals();
      updateCallView();
      call.timer = setTimeout(() => { if (call.status === 'ringing') hangUp('missed'); }, RING_MS);
    } catch (e) { console.error(e); toast('撥不出去，請確認網路後再試一次'); hangUp('canceled'); }
  }

  async function acceptCall() {
    const d = state.calls.find((x) => x.id === call.incoming);
    if (!d || d.status !== 'ringing') { hideIncoming(); return toast('對方已經掛斷了'); }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.RTCPeerConnection) return toast('這支手機不支援視訊通話');
    hideIncoming();
    Object.assign(call, { id: d.id, peer: d.from, role: 'callee', status: 'connecting', pending: [], seen: new Set(), started: 0, muted: false, camOff: false, ending: false });
    buildCallView();
    try { call.local = await getMedia(); } catch (e) { console.warn(e); toast(mediaError(e)); return hangUp('declined'); }
    attachVideos();
    try {
      call.pc = makePeer(await iceServers());
      await call.pc.setRemoteDescription(d.offer);
      const answer = await call.pc.createAnswer();
      await call.pc.setLocalDescription(answer);
      await Api.updateDoc('calls', d.id, { answer: { type: answer.type, sdp: answer.sdp }, status: 'active', answered_at: Date.now() });
      watchSignals();
      useSignals(lastSignals);
      updateCallView();
    } catch (e) { console.error(e); toast('接不起來，請再試一次'); hangUp('ended'); }
  }

  function declineCall() {
    const id = call.incoming;
    if (!id) return;
    dismissedCalls.add(id);
    hideIncoming();
    Api.updateDoc('calls', id, { status: 'declined', ended_at: Date.now() }).catch((e) => console.warn(e));
  }

  // 自己掛斷（或撥出去沒人接）：通知對方，然後收掉
  async function hangUp(reason) {
    if (call.ending) return;
    call.ending = true;
    const id = call.id, peer = call.peer, caller = call.role === 'caller';
    endLocal();
    if (!id) return;
    try { await Api.updateDoc('calls', id, { status: reason || 'ended', ended_at: Date.now() }); } catch (e) { console.warn(e); }
    if (caller && reason === 'missed') Api.sendMessage('打視訊給' + nameOf(peer) + '，沒有接到').catch(() => {});
    if (caller) setTimeout(() => cleanupCall(id), 4000);
  }
  // 撥打的人負責清掉這通電話的資料（等幾秒，讓對方先看到「已掛斷」）
  async function cleanupCall(id) {
    try {
      const sigs = await Api.listDocs('call_signals', ['call_id', id]);
      await Promise.all(sigs.map((s) => Api.deleteDoc('call_signals', s.id)));
      await Api.deleteDoc('calls', id);
    } catch (e) { console.warn(e); }
  }

  function endLocal() {
    clearTimeout(call.timer); clearInterval(call.tick);
    if (call.local) call.local.getTracks().forEach((t) => t.stop());
    if (call.pc) { try { call.pc.close(); } catch (e) { /* 已經關了 */ } }
    if (call.unsubSig) call.unsubSig();
    if (call.wake) { call.wake.release().catch(() => {}); }
    Object.assign(call, { id: null, peer: null, role: null, status: '', pc: null, local: null, remote: null, pending: [], timer: null, tick: null, unsubSig: null, wake: null });
    if ($call && !call.incoming) $call.innerHTML = '';
    document.body.classList.remove('in-call');
  }

  // 監聽所有通話：有人打給我就跳出來電畫面；目前這通的狀態變了就跟著處理
  function onCalls(list) {
    state.calls = list;
    const me = state.userId;
    if (!me) return;
    // 自己撥出、已經結束或太舊的：順手清掉（例如上次撥到一半 App 被關掉）
    list.filter((d) => d.from === me && d.id !== call.id && (!['ringing', 'active'].includes(d.status) || Date.now() - (d.created_at || 0) > 3 * 3600000))
      .forEach((d) => { if (!d.cleaning) { d.cleaning = true; cleanupCall(d.id); } });
    if (call.id) {
      const d = list.find((x) => x.id === call.id);
      if (!d) { if (call.role === 'callee') { toast('通話結束'); endLocal(); } return; }
      if (['ended', 'declined', 'missed', 'canceled'].includes(d.status) && !call.ending) {
        if (call.role === 'caller' && d.status === 'declined') toast(nameOf(call.peer) + '現在不方便接');
        else if (d.status === 'ended') toast('通話結束');
        call.ending = true;
        const caller = call.role === 'caller', id = call.id;
        endLocal();
        if (caller) setTimeout(() => cleanupCall(id), 1000);
        return;
      }
      if (call.role === 'caller' && d.answer && call.pc && !call.pc.remoteDescription && !call.answering) {
        call.answering = true;
        clearTimeout(call.timer);
        call.status = 'connecting'; updateCallView();
        call.pc.setRemoteDescription(d.answer).then(() => useSignals(lastSignals)).catch((e) => { console.error(e); hangUp('ended'); })
          .finally(() => { call.answering = false; });
      }
      return;
    }
    const ring = list.find((d) => d.status === 'ringing' && (d.to || []).includes(me) && d.from !== me && d.offer
      && Date.now() - (d.created_at || 0) < RING_MS + 10000 && !dismissedCalls.has(d.id));
    if (ring && call.incoming !== ring.id) showIncoming(ring);
    else if (!ring && call.incoming) {
      const d = list.find((x) => x.id === call.incoming);
      if (!d || d.status !== 'ringing') { if (d && d.status === 'missed') toast('錯過了' + nameOf(d.from) + '的視訊'); hideIncoming(); }
    }
  }

  function showIncoming(d) {
    call.incoming = d.id;
    const who = member(d.from);
    callRoot().innerHTML = `
      <div class="call-incoming" role="alertdialog" aria-label="${esc(nameOf(d.from))}邀請你視訊">
        <div class="call-who">
          ${who ? `<span class="avatar call-avatar ring" style="background:${esc(who.color)}">${esc(who.display_name.slice(0, 1))}</span>` : ''}
          <b>${esc(nameOf(d.from))}</b>
          <span>邀請你視訊</span>
        </div>
        <div class="call-answer">
          <button class="call-btn end" data-act="call-decline" aria-label="拒絕">${CALL_ICON.end}<small>拒絕</small></button>
          <button class="call-btn ok" data-act="call-accept" aria-label="接聽">${CALL_ICON.video}<small>接聽</small></button>
        </div>
      </div>`;
    document.body.classList.add('in-call');
  }
  function hideIncoming() {
    call.incoming = null;
    if ($call && !call.role) { $call.innerHTML = ''; document.body.classList.remove('in-call'); }
  }

  function buildCallView() {
    const who = member(call.peer);
    callRoot().innerHTML = `
      <div class="call-view" role="dialog" aria-label="和${esc(nameOf(call.peer))}視訊">
        <video id="call-remote" autoplay playsinline></video>
        <div class="call-wait" id="call-wait">
          ${who ? `<span class="avatar call-avatar" style="background:${esc(who.color)}">${esc(who.display_name.slice(0, 1))}</span>` : ''}
        </div>
        <div class="call-top"><b>${esc(nameOf(call.peer))}</b><span id="call-status"></span></div>
        <video id="call-local" autoplay playsinline muted></video>
        <div class="call-ctrls">
          <button class="call-btn" data-act="call-mute" id="call-mute"></button>
          <button class="call-btn" data-act="call-cam" id="call-cam"></button>
          <button class="call-btn" data-act="call-flip" aria-label="切換前後鏡頭">${CALL_ICON.flip}<small>翻轉</small></button>
          <button class="call-btn end" data-act="call-end" aria-label="掛斷">${CALL_ICON.end}<small>掛斷</small></button>
        </div>
      </div>`;
    document.body.classList.add('in-call');
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { call.wake = w; }).catch(() => {});
    clearInterval(call.tick);
    call.tick = setInterval(updateCallView, 1000);
    updateCallView();
  }
  function attachVideos() {
    const r = document.getElementById('call-remote'), l = document.getElementById('call-local');
    if (l && call.local && l.srcObject !== call.local) l.srcObject = call.local;
    if (r && call.remote && r.srcObject !== call.remote) { r.srcObject = call.remote; r.play().catch(() => {}); }
    updateCallView();
  }
  function updateCallView() {
    if (!call.role) return;
    const st = document.getElementById('call-status');
    if (!st) return;
    const sec = call.started ? Math.floor((Date.now() - call.started) / 1000) : 0;
    st.textContent = { starting: '準備中…', ringing: '正在等' + nameOf(call.peer) + '接聽…', connecting: '連線中…', reconnecting: '網路不穩，重新連線中…' }[call.status]
      || (call.status === 'connected' ? Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') : '');
    const wait = document.getElementById('call-wait');
    if (wait) wait.hidden = call.status === 'connected' && !!call.remote;
    const mute = document.getElementById('call-mute'), cam = document.getElementById('call-cam');
    mute.innerHTML = (call.muted ? CALL_ICON.micOff : CALL_ICON.mic) + `<small>${call.muted ? '取消靜音' : '靜音'}</small>`;
    mute.classList.toggle('on', call.muted); mute.setAttribute('aria-pressed', call.muted);
    cam.innerHTML = (call.camOff ? CALL_ICON.camOff : CALL_ICON.video) + `<small>${call.camOff ? '開鏡頭' : '關鏡頭'}</small>`;
    cam.classList.toggle('on', call.camOff); cam.setAttribute('aria-pressed', call.camOff);
    const l = document.getElementById('call-local');
    if (l) { l.hidden = call.camOff; l.classList.toggle('mirror', call.facing === 'user'); }
  }
  function toggleMute() {
    call.muted = !call.muted;
    if (call.local) call.local.getAudioTracks().forEach((t) => { t.enabled = !call.muted; });
    updateCallView();
  }
  function toggleCam() {
    call.camOff = !call.camOff;
    if (call.local) call.local.getVideoTracks().forEach((t) => { t.enabled = !call.camOff; });
    updateCallView();
  }
  // 前後鏡頭：拿新的鏡頭畫面，換掉送給對方的那一路，再關掉舊的
  async function flipCamera() {
    if (!call.local) return;
    const facing = call.facing === 'user' ? 'environment' : 'user';
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } });
      const track = s.getVideoTracks()[0];
      const old = call.local.getVideoTracks()[0];
      const sender = call.pc && call.pc.getSenders().find((x) => x.track && x.track.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      if (old) { call.local.removeTrack(old); old.stop(); }
      track.enabled = !call.camOff;
      call.local.addTrack(track);
      call.facing = facing;
      const l = document.getElementById('call-local');
      if (l) { l.srcObject = null; l.srcObject = call.local; }
      updateCallView();
    } catch (e) { console.warn(e); toast('切換不了鏡頭'); }
  }

  function openCallPicker() {
    const others = state.members.filter((m) => m.id !== state.userId);
    showSheet('call-pick', {
      title: '要跟誰視訊？', readonly: true,
      body: `
      <div class="call-pick">
        ${others.map((m) => `
          <button type="button" class="call-pick-row" data-act="call-start" data-id="${esc(m.id)}">
            ${avatarHtml(m)}<b>${esc(m.display_name)}</b><small>${esc(statusText(m.id))}</small>${CALL_ICON.video}
          </button>`).join('')}
      </div>
      <p class="hint">對方會收到通知，點開 App 就能接聽。通話時 App 要停在畫面上，切到別的 App 或鎖定畫面，視訊會中斷。</p>`
    });
  }

  function openTurnSheet() {
    if (!isAdmin()) return;
    Api.getDoc('secrets', 'turn').then((cur) => {
      const has = !!(cur && cur.key_id);
      showSheet('turn-form', {
        title: '視訊的中繼伺服器', focus: !has,
        body: `
        <p class="hint">${has ? '目前已經設定' + (cur.updated_at ? '（' + stamp(cur.updated_at) + ' 儲存）' : '') + '。要更換就直接改掉再儲存。' : '還沒有設定。沒設定也能視訊，但用行動網路時可能連不上。'}</p>
        <label>Turn Token ID<input type="text" name="key_id" value="${esc((cur && cur.key_id) || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="100"></label>
        <label>API Token<input type="text" name="api_token" value="${esc((cur && cur.api_token) || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200"></label>
        <p class="hint">到 dash.cloudflare.com 登入 →「Realtime」→「TURN Server」建立一組，把顯示的 Turn Token ID 和 API Token 複製貼上。</p>
        <p class="hint">只有管理員看得到、改得了；其他家人的手機讀不到。</p>`
      });
    }).catch((e) => { console.error(e); toast('讀不到目前的設定，請確認已經執行過 deploy.bat'); });
  }

  // 中文輸入法選好字之後，補做一次搜尋（有些 iPhone 選字完不會再送一次 input）
  document.addEventListener('compositionend', (ev) => {
    if (ev.target.id === 'tra-q') { state.transit.traQ = ev.target.value; refreshFoundStations(); }
  });

  // 手指往右滑＝返回。鍾家生活裡：功能 → 功能清單、旅程 → 所有旅程、公車路線 → 搜尋頁。
  // 看相簿的照片時，左右滑是上一張、下一張。
  let swipe = null;
  document.addEventListener('touchstart', (ev) => {
    const t = ev.touches[0];
    const tag = ev.target.tagName;
    swipe = ev.touches.length === 1 && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)
      ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  }, { passive: true });
  document.addEventListener('touchend', (ev) => {
    if (!swipe || !state.userId) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, quick = Date.now() - swipe.at < 700;
    swipe = null;
    if (!quick || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;      // 要夠長、夠快、夠水平
    if ($sheet.querySelector('.album-view')) {
      const step = $sheet.querySelector(dx > 0 ? '.album-step.prev' : '.album-step.next');
      if (step) step.click();
      return;
    }
    if (dx < 0 || $sheet.innerHTML || state.tab !== 'notes') return;
    const back = document.querySelector('#scroller .link-btn.back');
    if (!back) return;
    back.click();
    const sc = scroller();
    if (sc) { sc.classList.remove('slide-back'); void sc.offsetWidth; sc.classList.add('slide-back'); }
  }, { passive: true });

  function goTab(tab) {
    if (tab === 'ledger') { state.notesView = 'ledger'; state.ledgerDay = null; tab = 'notes'; }
    if (tab === 'polls') { state.postsView = 'polls'; tab = 'posts'; }
    if (tab === 'todos') { state.notesView = 'shop'; tab = 'notes'; }
    if (!TABS.some(([id]) => id === tab)) return;
    state.tab = tab;
    state.chatSearch = false; state.chatQuery = ''; state.menuMsg = null;
    if (!state.userId) return;            // 還沒登入：登入後會直接顯示這個分頁
    closeSheet();
    if (tab === 'chat') markRead();
    render();
    loadTab();
    if (tab === 'chat') scrollChat();
  }
  function tabFromHash() {
    const tab = location.hash.slice(1);
    if (!tab) return;
    history.replaceState(null, '', location.pathname + location.search);
    goTab(tab);
  }
  tabFromHash();
  window.addEventListener('hashchange', tabFromHash);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (ev.data && ev.data.type === 'open-tab') goTab(ev.data.tab);
    });
  }

  // ---------- 自動更新 ----------
  // 比對伺服器上的 version.txt；有新版而且沒有正在打字或編輯時，自動重新載入。
  // 每個版本只嘗試一次，避免萬一抓不到新檔案時不停重新載入。
  // 請 service worker 把手機上存的程式檔換成最新的，換好（或等太久）才繼續
  function refreshShell() {
    return new Promise((resolve) => {
      const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (!sw) return resolve();
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      setTimeout(resolve, 10000);
      sw.postMessage({ type: 'refresh' }, [channel.port2]);
    });
  }

  async function checkVersion() {
    if (!location.protocol.startsWith('http')) return;
    try {
      const res = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const latest = (await res.text()).trim();
      if (!latest || latest === VERSION) return;
      if (sessionStorage.getItem('family-update-tried') === latest) return;
      const a = document.activeElement;
      const busy = $sheet.innerHTML || state.draft || (a && /^(INPUT|TEXTAREA)$/.test(a.tagName));
      if (busy) return;
      sessionStorage.setItem('family-update-tried', latest);
      await refreshShell();
      location.reload();
    } catch (e) { /* 離線時略過 */ }
  }
  checkVersion();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion(); });
  setInterval(checkVersion, 5 * 60 * 1000);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  syncThemeColor();
  boot();
  syncHolidays([new Date().getFullYear(), new Date().getFullYear() + 1]);
})();
