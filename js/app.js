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
  const VERSION = '2026-11-23 23:50';
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
  // 選的面板顏色存在 THEME_KEY；打開「跟著手機」時，手機是深色模式就暫時改用夜間，不會改掉原本選的顏色
  const AUTO_NIGHT_KEY = 'family-auto-night';
  let chosenTheme = '';
  try { chosenTheme = localStorage.getItem(THEME_KEY) || ''; } catch (e) { /* 忽略 */ }
  const autoNight = () => { try { return localStorage.getItem(AUTO_NIGHT_KEY) === '1'; } catch (e) { return false; } };
  const darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const currentTheme = () => chosenTheme;
  function paintTheme() {
    const id = autoNight() && darkMq && darkMq.matches ? 'night' : chosenTheme;
    if (id) document.documentElement.dataset.theme = id; else delete document.documentElement.dataset.theme;
    syncThemeColor();
  }
  function applyTheme(id) {
    chosenTheme = id || '';
    try { if (id) localStorage.setItem(THEME_KEY, id); else localStorage.removeItem(THEME_KEY); } catch (e) { /* 忽略 */ }
    paintTheme();
  }
  function setAutoNight(on) {
    try { if (on) localStorage.setItem(AUTO_NIGHT_KEY, '1'); else localStorage.removeItem(AUTO_NIGHT_KEY); } catch (e) { /* 忽略 */ }
    paintTheme();
  }
  if (darkMq) { try { darkMq.addEventListener('change', paintTheme); } catch (e) { darkMq.addListener(paintTheme); } }
  // 小小的慶祝：在剛剛按下去的位置噴幾顆彩色小點（完成待辦、讀完書、投票、報平安）。系統設成「減少動態效果」就不播。
  let lastTap = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  document.addEventListener('pointerdown', (ev) => { lastTap = { x: ev.clientX, y: ev.clientY }; }, { passive: true, capture: true });
  function celebrate() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div');
    box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
    box.style.left = lastTap.x + 'px'; box.style.top = lastTap.y + 'px';
    const colors = ['#E8590C', '#2F6FDE', '#1F8A5F', '#D6457F', '#F2B705', '#7A4FD0'];
    for (let i = 0; i < 10; i++) {
      const dot = document.createElement('i'), ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.5, dist = 34 + Math.random() * 26;
      dot.style.cssText = `background:${colors[i % colors.length]};--dx:${Math.round(Math.cos(ang) * dist)}px;--dy:${Math.round(Math.sin(ang) * dist)}px`;
      box.appendChild(dot);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 800);
  }
  // 介面風格：跟面板顏色分開，可以自由搭配；只存在這支手機
  const STYLES = [
    ['', '原始風格', '清爽的日曆感'],
    ['cute', '可愛風格', '圓圓的、點點底、軟軟的字'],
    ['simple', '簡約風格', '平面、細線、少裝飾'],
    ['big', '大字清楚', '字和按鈕都放大，好讀好按'],
    ['tech', '科技風', '深色螢幕、霓虹光、格線（自帶配色）'],
    ['nature', '自然風', '米色紙張、葉子形狀、溫暖大地色（自帶配色）'],
    ['comic', '漫畫風', '粗黑框、網點底、對話框（自帶配色）']
  ];
  const STYLE_KEY = 'family-style';
  const currentStyle = () => document.documentElement.dataset.style || '';
  function applyStyle(id) {
    if (id) document.documentElement.dataset.style = id; else delete document.documentElement.dataset.style;
    try { if (id) localStorage.setItem(STYLE_KEY, id); else localStorage.removeItem(STYLE_KEY); } catch (e) { /* 忽略 */ }
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
    butler: { msgs: [], busy: false },   // 家庭小管家的對話（不存檔，重新整理就清掉）
    butlerReady: Promise.resolve(),      // 小管家要用的紀錄（行程、成績、零用錢）讀完了沒
    msgReacts: [],                  // 聊天訊息的表情回應
    studyItems: [], studyCheers: [],   // 讀書計畫和爸媽的鼓勵
    studyKid: null, studyMode: 'day', studyDay: null,
    videoReady: null, videos: [], videoViews: [], videoLimits: [], videoMode: 'list', videoCat: '', vdMonths: {},
    checkins: [], places: [], ciKid: '', ciOpen: false, ciParentOpen: false, ciReady: null,   // 報平安   // 影片
    journalReacts: [],              // 旅遊日誌的表情回應
    trips: [], tripItems: [],       // 家庭旅遊：旅程，以及每趟旅程底下的行程、日誌、行李、花費
    tripId: null, tripTab: 'plan',  // 正在看哪一趟旅程、哪個分頁（plan 行程 | journal 日誌 | pack 行李 | cost 花費）
    showOldNotes: false,
    chatShown: 60,           // 聊天室目前畫出最新的幾則
    photos: [], photoComments: [], photoLikes: [], albumFilter: '', slideshow: 0, albumMonth: today().slice(0, 7), albumLoaded: null, photoId: null, albumDay: null, albumTab: 'date', albumId: null, albumYear: null, albums: [], albumSel: null, albumDense: false, memories: null,   // albumDay：正在看哪一天（null = 整個月的天數清單）
      // 家庭相簿：只放正在看的那個月
    subjects: [],                   // 家長自訂的考試科目 { id, label }
    scores: [], scoreSubject: '',   // 成績紀錄
    scoreTerm: '',                  // 目前看哪個學期（空的代表全部）；會記在這支手機上；scoreSubject 是目前只看哪一科（空的代表全部）
    postsView: 'posts',      // posts（留言）| polls（投票）
    polls: [], votes: [],
    pollOpen: null,          // 歷史紀錄裡點開看細節的那一則
    pollHistory: false,      // 投票頁正在看「歷史紀錄」（已結束、已截止、已作廢的投票）
    homePollId: null,        // 首頁投票區展開的那一則（null = 全部合起來）
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
    bdayCards: [],           // 生日卡片
    optDrafts: {},           // 投票裡正在打的新選項（依投票 id）
    menuMsg: null,           // 正在顯示「回覆／收回」按鈕的訊息
    editMsg: null,           // 正在編輯哪一則訊息
    pins: [], pinsOpen: false,   // 聊天室置頂的訊息
    unreadFrom: null, unreadJump: false,   // 進聊天室時上次讀到的時間點（畫「以下是新訊息」用）
    quiet: null,             // 聊天免打擾時段 { on, start, end }
    notices: [], notifyOff: null,   // App 裡的通知紀錄；我關掉的推播種類（null = 還沒讀）
    previews: {},            // 連結預覽
    replyTo: null,           // 正在引用回覆哪一則訊息
    mentionQ: null,          // 正在打 @ 後面的字（null 代表沒有在選人）
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
  const isChildId = (id) => { const m = member(id); return !!(m && m.child); };
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
  // 頭像上的字：基本資料裡有填「頭像上的字」就用它（例如 爸、媽），沒填就用名字的第一個字
  const faceOf = (m) => Array.from((state.profiles[m.id] || {}).face || m.display_name || '?')[0];   // Array.from：表情符號不會被切成一半
  function avatarHtml(m, cls) {
    return `<span class="avatar ${cls || ''} ${isOnline(m.id) ? 'online' : ''}" style="background:${esc(m.color)}">${esc(faceOf(m))}</span>`;
  }
  // short：聊天室標題列用，只有頭像不顯示名字
  // 家人的頭像：點別人的頭像會跳出「語音通話／視訊通話／傳訊息」
  function presenceHtml(short) {
    return state.members.map((m) => {
      const tag = m.id === state.userId ? 'div' : 'button';
      return `
      <${tag} class="pres ${isOnline(m.id) ? 'on' : ''}" ${tag === 'button' ? `data-act="member-card" data-id="${esc(m.id)}" aria-label="${esc(m.display_name)}：${statusText(m.id)}，點一下打電話或傳訊息"` : `role="img" aria-label="${esc(m.display_name)}：${statusText(m.id)}"`} title="${esc(m.display_name)}：${statusText(m.id)}">
        ${avatarHtml(m, 'sm')}
        ${short ? '' : `<span class="pres-name">${esc(m.display_name)}</span>`}
      </${tag}>`;
    }).join('');
  }
  function refreshPresence() {
    const el = document.getElementById('presence');
    const ch = document.getElementById('chat-presence');
    if (ch) ch.innerHTML = presenceHtml(true);
    if (el) el.innerHTML = presenceHtml(true);
    else if (ch) return;
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
    try { state.profiles = await Api.listProfiles(); drawBday(); }
    catch (e) { console.error(e); }
  }

  function loadTab() {
    if (state.ciReady === null && state.userId && me() && !amChild()) { state.ciReady = undefined; checkCiReady(); }
    if (state.tab === 'cal') loadEvents();
    else if (state.tab === 'notes') { if (state.notesView === 'study' && !state.studyDay) state.studyDay = today(); if (state.notesView === 'video') checkVideoReady(); if (state.notesView === 'ledger') loadLedger(); else if (state.notesView === 'notes') { if (state.showOldNotes) loadNotes(); } else if (state.notesView === 'scores') loadScores(); else if (state.notesView === 'butler') state.butlerReady = Promise.all([loadScores(), loadLedger(), loadEvents()]).catch(() => {}); else if (state.notesView === 'album') loadAlbum(); else if (state.notesView === 'transit') loadTransit(); }
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
    // 正開著聊天室在看（畫面在前景、不是在搜尋舊訊息）：告訴伺服器不用再推播聊天通知給我
    const inChat = online && state.tab === 'chat' && !state.chatSearch && document.visibilityState === 'visible';
    Api.beat(online, readAt, inChat).catch((e) => console.warn('上線狀態更新失敗', e));
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

  function onStudyItems(list) { state.studyItems = list; refreshStudy(); }
  function onStudyCheers(list) { state.studyCheers = list; refreshStudy(); }
  let studyDirty = false;
  function refreshStudy() {
    refreshTodos();
    if (state.tab !== 'notes') return;
    if (state.notesView === 'hub' && !$sheet.innerHTML) return render();
    if (state.notesView !== 'study') return;
    // 正在打鼓勵的話或開著表單時先不重畫，關掉再畫
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('.st-give');
    if (typing || $sheet.innerHTML) { studyDirty = true; return; }
    studyDirty = false;
    const sc = scroller(), y = sc ? sc.scrollTop : 0;
    render();
    if (sc && scroller()) scroller().scrollTop = y;
  }
  document.addEventListener('focusout', (ev) => { if (studyDirty && ev.target.closest && ev.target.closest('.st-give')) setTimeout(refreshStudy, 0); });

  function startWatching() {
    stopWatching();
    stopWatchers = [
      Api.watchEvents(() => { if (state.userId) loadEvents(); }),
      Api.watchMessages(onMessages),
      Api.watchPosts((list) => { state.posts = list; syncReplyWatchers(); refreshPosts(); }),
      () => { replyWatch.forEach((w) => w.off()); replyWatch.clear(); },
      Api.watchPresence((map) => {
        state.presence = map; refreshPresence();
        if (state.tab === 'chat') { refreshChat(false); onTypingChange(); }     // 有人讀了訊息：更新「已讀」；有人在打字
      }),
      Api.watchList('subjects', (list) => {
        state.subjects = list.sort((a, b) => a.created_at - b.created_at);
        if (state.tab === 'me' && !$sheet.innerHTML) render();
      }),
      Api.watchList('trips', (list) => { state.trips = list; loadEvents(); refreshTravel(); }),
      Api.watchList('calls', onCalls),
      Api.watchList('trip_items', (list) => { state.tripItems = list; refreshTravel(); }),
      Api.watchWhere('birthday_cards', 'to', state.userId, (list) => { bdayTo = list; state.bdayCards = bdayTo.concat(bdayFrom); drawBday(); }),
      Api.watchWhere('birthday_cards', 'from', state.userId, (list) => { bdayFrom = list; state.bdayCards = bdayTo.concat(bdayFrom); drawBday(); }),
      Api.watchList('journal_reacts', (list) => { state.journalReacts = list; refreshTravel(); }),
      ...(amChild()
        ? [Api.watchWhere('study_items', 'kid', state.userId, onStudyItems), Api.watchWhere('study_cheers', 'kid', state.userId, onStudyCheers)]
        : [Api.watchList('study_items', onStudyItems), Api.watchList('study_cheers', onStudyCheers)]),
      ...(amChild()
        ? [Api.watchHas('videos', 'to', state.userId, (l) => { state.videos = l; onVideoData(); }), Api.watchWhere('video_views', 'kid', state.userId, (l) => { state.videoViews = l; onVideoData(); })]
        : [Api.watchList('videos', (l) => { state.videos = l; onVideoData(); }), Api.watchList('video_views', (l) => { state.videoViews = l; onVideoData(); })]),
      Api.watchList('video_limits', (l) => { state.videoLimits = l; onVideoData(); }),
      (amChild() ? (cb) => Api.watchWhere('checkins', 'kid', state.userId, cb) : (cb) => Api.watchList('checkins', cb))((l) => { state.checkins = l; drawCheckin(); }),
      Api.watchList('places', (l) => { state.places = l; drawCheckin(); }),
      Api.watchList('message_reacts', (list) => { state.msgReacts = list; if (state.tab === 'chat') refreshChat(false); }),
      Api.watchList('albums', (list) => { state.albums = list; if (state.tab === 'notes' && state.notesView === 'album' && !$sheet.innerHTML) render(); }),
      Api.watchList('chat_pins', (list) => { state.pins = list; drawPins(); if (state.tab === 'chat') refreshChat(false); }),
      Api.watchWhere('notifications', 'uid', state.userId, (list) => { state.notices = list; drawBell(); }),
      Api.watchList('settings', (list) => { state.quiet = findById(list, 'chat_quiet') || null; if (state.tab === 'me' && !$sheet.innerHTML) render(); }),
      Api.watchList('shopping', (list) => { state.shopping = list; refreshShop(); }),
      // 資料卡：家長看全部；小朋友只讀得到自己新增的（安全規則也是這樣擋）
      (amChild() ? (cb) => Api.watchWhere('cards', 'created_by', state.userId, cb) : (cb) => Api.watchList('cards', cb))(
        (list) => { state.cards = list; if (state.tab === 'notes' && state.notesView === 'cards' && !$sheet.innerHTML) render(); }),
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
    if (state.notesView === 'hub' || state.notesView === 'butler') return '';
    if (state.notesView === 'album') return '放照片';
    if (state.notesView === 'transit' || state.notesView === 'checkins') return '';   // 報平安紀錄只能看，不能新增
    if (state.notesView === 'shop') return '';                       // 待辦直接在上方輸入
    if (state.notesView === 'cards') return '新增資料卡';
    if (state.notesView === 'video') return amChild() ? '我想看這部' : state.videoMode === 'manage' ? '' : '加一部影片';
    if (state.notesView === 'study') { const k = member(studyKid()); return !k ? '' : k.id === state.userId ? '新增讀書項目' : '幫' + k.display_name + '加讀書項目'; }
    if (state.notesView === 'scores') return kids().length ? '新增成績' : '';
    return kids().length ? '新增一筆零用錢紀錄' : '';
  }

  const hasUnread = () => state.messages.some((m) => m.sender !== state.userId && m.sent_at > state.lastRead);
  // 我還沒讀的聊天訊息有幾則（收回的不算），顯示在下面「聊天」的按鈕上
  const unreadCount = () => state.messages.filter((m) => m.sender !== state.userId && !m.recalled && m.sent_at > state.lastRead).length;
  const countText = (id) => { const n = id === 'chat' ? unreadCount() : 0; return n > 99 ? '99+' : n ? String(n) : ''; };
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
    state.messages.filter((m) => !m.recalled && m.sender !== state.userId && m.sent_at > state.lastRead
      && ((m.mentions || []).includes(state.userId) || (m.reply_to && m.reply_to.sender === state.userId)))
      .slice(-3).forEach((m) => items.push(`
          <div class="todo">
            <button class="todo-main" data-act="tab" data-tab="chat">
              <span class="todo-title">${esc(nameOf(m.sender))}在聊天室${(m.mentions || []).includes(state.userId) ? '提到你' : '回覆你'}</span>
              <span class="todo-sub">${esc(m.text.length > 40 ? m.text.slice(0, 40) + '…' : m.text)}</span>
            </button>
            <button class="todo-done reply" data-act="tab" data-tab="chat">去看</button>
          </div>`));
    if (amChild()) {
      const list = studyOf(state.userId, today()), left = list.filter((x) => !x.done);
      if (left.length) items.push(`
          <div class="todo">
            <button class="todo-main" data-act="open-study">
              <span class="todo-title">今天的讀書計畫 ${list.length - left.length}／${list.length}</span>
              <span class="todo-sub">還沒讀：${esc(left.slice(0, 3).map((x) => x.sub + ' ' + x.title).join('、'))}</span>
            </button>
            <button class="todo-done" data-act="open-study">去讀書</button>
          </div>`);
    }
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
      ${tasks.length ? `${events.length ? '<h3>要處理的事</h3>' : ''}<div class="mine-tasks">${tasks.join('')}</div>` : ''}
      ${events.length ? `${tasks.length ? '<h3>今天的行程</h3>' : ''}${events.map((e) => eventRow(e)).join('')}` : ''}
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
      if (!el) return;
      el.classList.toggle('unread', badge(id));
      const n = countText(id);
      if (n) { el.dataset.count = n; el.setAttribute('aria-label', el.textContent.trim() + '，' + n + ' 則未讀'); }
      else { delete el.dataset.count; el.removeAttribute('aria-label'); }
    });
  }

  let renderedTab = null;
  const scroller = () => document.getElementById('scroller');

  let renderedKey = '';
  let lastMotion = { name: '', at: 0, key: '' };
  const scrollMemo = {};
  // ---------- 中文輸入法選字中，不要重畫畫面 ----------
  // 注音、拼音打字時，字會先停在「組字中」，等選字後才真的打進去。這時候如果畫面被重畫，
  // 輸入框會被換掉，選字列就消失、選不了字。所以組字中要重畫的，先記下來，選好字（或離開輸入框）再做。
  let composing = false;
  const afterCompose = new Set();
  function flushCompose() {
    composing = false;
    const list = Array.from(afterCompose);
    afterCompose.clear();
    if (list.length) setTimeout(() => list.forEach((fn) => fn()), 0);
  }
  document.addEventListener('compositionstart', () => { composing = true; }, true);
  document.addEventListener('compositionend', flushCompose, true);
  document.addEventListener('focusout', () => { if (composing) flushCompose(); }, true);
  // 要重畫的區塊裡有正在組字的輸入框 → 先排隊，回傳 true
  function holdForIme(container, fn) {
    const a = document.activeElement;
    if (!composing || !a || !container || !container.contains(a)) return false;
    afterCompose.add(fn);
    return true;
  }

  // 聊天、小管家的輸入框：字多了自動換行、跟著長高（最多約 5 行，再多就在框裡捲動）
  function growInputs() {
    document.querySelectorAll('textarea.grow').forEach((el) => {
      el.style.height = 'auto';
      const h = Math.min(el.scrollHeight, 132);
      el.style.height = h + 'px';
      el.style.overflowY = el.scrollHeight > 132 ? 'auto' : 'hidden';
    });
  }
  // 程式改了輸入框的內容（送出、清除、編輯、選 @）之後也要重算高度
  ['input', 'click', 'submit'].forEach((type) => document.addEventListener(type, () => setTimeout(growInputs, 0), true));
  // 按 Enter（手機鍵盤的「傳送」）＝送出；電腦上 Shift+Enter 才是換行。選字中的 Enter 不算。
  document.addEventListener('keydown', (ev) => {
    const t = ev.target;
    if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing || ev.keyCode === 229 || !t || !t.classList || !t.classList.contains('grow')) return;
    ev.preventDefault();
    if (t.form) t.form.requestSubmit ? t.form.requestSubmit() : t.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  function render() {
    if (!state.userId) return;
    if (holdForIme($app, render)) return;
    const active = document.activeElement;
    const focusId = active && /^(INPUT|TEXTAREA)$/.test(active.tagName) && !$sheet.contains(active) ? active.id : '';
    const sameTab = renderedTab === state.tab;
    // 每一頁各自記住捲到哪裡：切到別的分頁再回來，會停在原本的位置
    const key = state.tab + (state.tab === 'notes' ? ':' + state.notesView : '');
    const sameKey = renderedKey === key;
    if (scroller() && renderedKey) scrollMemo[renderedKey] = scroller().scrollTop;
    const keepTop = sameKey ? scrollMemo[key] || 0 : state.tab === 'notes' ? 0 : scrollMemo[key] || 0;
    // 換頁的小動畫：換分頁淡入、進到功能從右邊滑入、回上一層從左邊滑入
    const motion = sameKey || !renderedKey ? '' : sameTab && state.tab === 'notes' ? (state.notesView === 'hub' ? 'slide-back' : 'slide-fwd') : 'page-in';
    const views = { cal: viewCalendar, chat: viewChat, posts: viewPosts, notes: viewNotes, me: viewMe };

    $app.innerHTML = `
      <div class="scroller" id="scroller"><div class="screen">${views[state.tab]()}</div></div>
      ${state.tab === 'chat' && !state.chatSearch ? `
        <div class="chat-assist" id="chat-assist">${chatAssistHtml()}</div>
        <form class="chat-bar" id="chat-form">
          <label class="attach" aria-label="傳照片">
            <input type="file" id="chat-file" accept="image/*" multiple hidden>
            ${ICON.photo}
          </label>
          <button type="button" class="attach mic" data-act="voice-start" aria-label="錄語音訊息">${MIC_SVG}</button>
          <span class="chat-field"><textarea id="chat-input" class="grow" name="text" rows="1" placeholder="輸入訊息" maxlength="2000" autocomplete="off" enterkeyhint="send" aria-label="訊息">${esc(state.draft)}</textarea><button type="button" class="chat-clear" data-act="input-clear" data-for="chat-input" aria-label="清除輸入的文字"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button></span>
          <button type="submit" class="send" aria-label="傳送">${ICON.send}</button>
        </form>` : ''}
      ${state.tab === 'notes' && state.notesView === 'butler' ? `
        <form class="chat-bar" id="butler-form">
          <span class="chat-field"><textarea id="butler-input" class="grow" name="text" rows="1" placeholder="${state.butler.msgs.length ? '繼續問' : '想問什麼都可以'}" maxlength="${amChild() ? 1000 : 4000}" autocomplete="off" enterkeyhint="send" aria-label="問小管家"></textarea><button type="button" class="chat-clear" data-act="input-clear" data-for="butler-input" aria-label="清除輸入的文字"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button></span>
          <button type="submit" class="send" aria-label="送出">${ICON.send}</button>
        </form>` : ''}
      ${fabLabel() ? `<div class="addbar"><button class="fab" data-act="new" aria-label="${fabLabel()}"><span class="fab-plus" aria-hidden="true">${ICON.plus}</span>${fabLabel()}</button></div>` : ''}
      <nav class="tabbar" aria-label="主選單">
        ${TABS.map(([id, label]) => `
          <button class="tab ${state.tab === id ? 'on' : ''} ${badge(id) ? 'unread' : ''}" style="--tab-c:${TAB_COLOR[id]}" data-act="tab" data-tab="${id}" ${countText(id) ? `data-count="${countText(id)}" aria-label="${label}，${countText(id)} 則未讀"` : ''} ${state.tab === id ? 'aria-current="page"' : ''}>
            ${state.tab === id ? ICON_ON[id] : ICON[id]}<span>${label}</span>
          </button>`).join('')}
      </nav>`;
    renderedTab = state.tab; renderedKey = key;
    // 資料載入後常會緊接著再畫一次；動畫要接著原本的進度繼續，不能被切斷或重播
    if (motion) lastMotion = { name: motion, at: Date.now(), key };
    const played = Date.now() - lastMotion.at;
    if (lastMotion.key === key && played < 220) {
      scroller().classList.add(lastMotion.name);
      scroller().style.animationDelay = -played + 'ms';
    }

    growInputs();
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

  // ---------- 生日 ----------
  // 生日當天：壽星的首頁最上面是「生日快樂」和大家寫的卡片；其他人看到的是「今天是誰的生日」和寫卡片的按鈕。
  //   卡片 birthday_cards/{壽星UID_年份_寫的人UID} = { to, from, year, text, sticker, created_at }，每人每年一張，可以改
  //   壽星在生日後一週內都還看得到卡片。
  let bdayTo = [], bdayFrom = [];
  const BDAY_STICKERS = ['🎂', '🎁', '🎈', '🎉', '🌟', '💖', '🧸', '🍰'];
  function birthdayOf(id, year) {
    const b = (state.profiles[id] || {}).birthday;
    if (!b) return null;
    const [by, bm, bd] = b.split('-').map(Number);
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return { date: year + '-' + pad(bm) + '-' + pad(bm === 2 && bd === 29 && !leap ? 28 : bd), age: year - by };
  }
  const bdayCardId = (to, year, from) => to + '_' + year + '_' + from;
  const cardsFor = (to, year) => state.bdayCards.filter((c) => c.to === to && c.year === year && member(c.from)).sort((a, b) => a.created_at - b.created_at);
  // 卡片紙色（paper）：寫卡片時挑，沒挑的用粉紅
  const BDAY_PAPERS = [['pink', '粉紅'], ['butter', '奶油黃'], ['sky', '天空藍'], ['mint', '薄荷綠'], ['lilac', '淡紫']];
  const BDAY_PHRASES = ['生日快樂！', '天天開開心心', '願望都會實現', '永遠愛你', '謝謝你一直都在', '今天你最大！'];
  // 生日蛋糕插圖（三根蠟燭的火會輕輕晃）
  const CAKE_ART = `<svg class="bday-art" viewBox="0 0 120 112" aria-hidden="true">
    <g class="flames"><path d="M42 18c-4 6 0 10 0 10s4-4 0-10z" fill="#FFB020"/><path d="M60 12c-4 6 0 10 0 10s4-4 0-10z" fill="#FFB020"/><path d="M78 18c-4 6 0 10 0 10s4-4 0-10z" fill="#FFB020"/></g>
    <rect x="40" y="28" width="4" height="16" rx="2" fill="#7FB7F2"/><rect x="58" y="22" width="4" height="22" rx="2" fill="#F48FB1"/><rect x="76" y="28" width="4" height="16" rx="2" fill="#9AD9A8"/>
    <rect x="24" y="44" width="72" height="26" rx="10" fill="#FFF6EE"/>
    <path d="M24 56c8 6 12-4 18 0s10 6 18 0 12-6 18 0 10 4 18 0V54c0-6-4-10-10-10H34c-6 0-10 4-10 10z" fill="#F48FB1"/>
    <rect x="14" y="70" width="92" height="30" rx="12" fill="#FFE1A8"/>
    <path d="M14 82c10 6 14-4 23 0s13 6 23 0 14-6 23 0 13 4 23 0v-2c0-6-5-10-11-10H25c-6 0-11 4-11 10z" fill="#FFFFFF" opacity=".85"/>
    <circle cx="32" cy="90" r="3" fill="#F48FB1"/><circle cx="52" cy="93" r="3" fill="#7FB7F2"/><circle cx="72" cy="90" r="3" fill="#9AD9A8"/><circle cx="90" cy="93" r="3" fill="#FFB020"/>
    <rect x="6" y="100" width="108" height="6" rx="3" fill="#E9B7C7"/>
  </svg>`;
  const BALLOON = (c) => `<svg class="bday-balloon" viewBox="0 0 40 80" aria-hidden="true"><path d="M20 4C10 4 4 12 4 21c0 11 9 20 16 22 7-2 16-11 16-22C36 12 30 4 20 4z" fill="${c}"/><path d="M17 43h6l-3 4z" fill="${c}"/><path d="M20 47c-4 8 4 14 0 22s3 8 0 10" stroke="#B9A3AD" stroke-width="1.4" fill="none"/><ellipse cx="13" cy="16" rx="3" ry="5" fill="#fff" opacity=".5"/></svg>`;
  const CONFETTI = Array.from({ length: 16 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 5) * 0.18}s;--c:${['#F48FB1', '#FFB020', '#7FB7F2', '#9AD9A8', '#C9A7F5'][i % 5]};--r:${(i * 47) % 180}deg"></i>`).join('');
  // 一張卡片：紙膠帶、郵戳貼紙、有橫線的信紙、右下角簽名
  function bdayCardHtml(c, i) {
    const who = member(c.from);
    return `
      <article class="bcard paper-${esc(c.paper || 'pink')} ${i % 2 ? 'r' : 'l'}">
        <i class="bcard-tape" aria-hidden="true"></i>
        <span class="bcard-sticker" aria-hidden="true"><b>${esc(c.sticker || '🎂')}</b></span>
        <p>${esc(c.text)}</p>
        <footer>${who ? avatarHtml(who, 'xs') : ''}<span>${esc(nameOf(c.from))}${c.year ? `<small>${esc(String(c.year))}</small>` : ''}</span></footer>
      </article>`;
  }
  // 壽星第一次看到的卡片先是一封信（有蠟封），點一下才打開。看過哪些記在這支手機上。
  const BCARD_OPEN_KEY = 'family-bcards-open';
  function openedCards() { try { return JSON.parse(localStorage.getItem(BCARD_OPEN_KEY)) || []; } catch (e) { return []; } }
  function bdayEnvelopeHtml(c, i) {
    const who = member(c.from);
    return `
      <button class="benv paper-${esc(c.paper || 'pink')} ${i % 2 ? 'r' : 'l'}" data-act="bcard-open" data-id="${esc(c.id)}" aria-label="${esc(nameOf(c.from))}寫給你的卡片，點一下打開">
        <i class="benv-flap" aria-hidden="true"></i><i class="benv-seal" aria-hidden="true">♥</i>
        <span class="benv-from">${who ? avatarHtml(who, 'sm') : ''}<b>${esc(nameOf(c.from))}寫給你的卡片</b><small>點一下打開</small></span>
      </button>`;
  }
  // sealed = true：還沒打開的顯示成信封（只有壽星在首頁看自己的卡片時用）
  function bdayCardsHtml(list, sealed) {
    const open = sealed ? openedCards() : null;
    return `<div class="bcards">${list.map((c, i) => (sealed && !open.includes(c.id) ? bdayEnvelopeHtml(c, i) : bdayCardHtml(c, i))).join('')}</div>`;
  }
  function openBdayCard(id) {
    const open = openedCards();
    if (!open.includes(id)) { open.push(id); try { localStorage.setItem(BCARD_OPEN_KEY, JSON.stringify(open.slice(-200))); } catch (e) { /* 忽略 */ } }
    celebrate();
    drawBday();
  }
  // ---- 壽星的驚喜動畫 ----
  // 生日當天，壽星打開 App 時播一次，之後每隔 2～5 分鐘不定時再來一個（氣球、彩帶、煙火、蛋糕輪流）。
  // 動畫蓋在畫面上但點不到，不會擋住操作；看影片、視訊、打字、表單打開時不播。系統設成「減少動態效果」也不播。
  const isMyBirthday = () => { const b = state.userId && me() ? birthdayOf(state.userId, Number(today().slice(0, 4))) : null; return !!b && b.date === today(); };
  const PARTY_KINDS = ['balloons', 'confetti', 'fireworks', 'cake'];
  let partyTimer = null, partyLast = '', partyDay = '';
  function partyBusy() {
    const a = document.activeElement;
    return !!($sheet.innerHTML || vp || (document.getElementById('call-root') || {}).innerHTML || document.visibilityState !== 'visible'
      || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || document.querySelector('.party'));
  }
  function playParty(kind) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (partyBusy()) return false;
    const pool = PARTY_KINDS.filter((k) => k !== partyLast);
    kind = PARTY_KINDS.includes(kind) ? kind : pool[Math.floor(Math.random() * pool.length)];
    partyLast = kind;
    const colors = ['#F48FB1', '#FFB020', '#7FB7F2', '#9AD9A8', '#C9A7F5', '#FF7A59'];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const box = document.createElement('div');
    box.className = 'party party-' + kind; box.setAttribute('aria-hidden', 'true');
    let html = '';
    if (kind === 'balloons') for (let i = 0; i < 9; i++) html += `<span style="--x:${Math.round(rnd(2, 88))}%;--d:${rnd(0, 1.2).toFixed(2)}s;--t:${rnd(3.6, 5.2).toFixed(2)}s;--s:${rnd(.8, 1.25).toFixed(2)};--sway:${Math.round(rnd(-30, 30))}px">${BALLOON(colors[i % colors.length])}</span>`;
    else if (kind === 'confetti') for (let i = 0; i < 46; i++) html += `<i style="--x:${Math.round(rnd(0, 100))}%;--d:${rnd(0, 1.6).toFixed(2)}s;--t:${rnd(2.6, 4.2).toFixed(2)}s;--c:${colors[i % colors.length]};--r:${Math.round(rnd(0, 360))}deg;--dx:${Math.round(rnd(-60, 60))}px"></i>`;
    else if (kind === 'fireworks') for (let b = 0; b < 4; b++) {
      const x = Math.round(rnd(14, 86)), y = Math.round(rnd(14, 52)), c = colors[b % colors.length];
      html += `<span style="left:${x}%;top:${y}%;--d:${(b * 0.55).toFixed(2)}s">${Array.from({ length: 14 }, (_, i) => `<i style="--a:${Math.round((360 / 14) * i)}deg;--c:${i % 3 ? c : '#FFF2B0'};--l:${Math.round(rnd(52, 92))}px"></i>`).join('')}</span>`;
    }
    else html = `<div class="party-card">${CAKE_ART}<b>生日快樂</b><small>${esc(me().display_name)}，今天你最大</small></div>` + Array.from({ length: 18 }, (_, i) => `<i style="--x:${Math.round(rnd(0, 100))}%;--d:${rnd(0, 1).toFixed(2)}s;--t:${rnd(2.4, 3.6).toFixed(2)}s;--c:${colors[i % colors.length]};--r:${Math.round(rnd(0, 360))}deg;--dx:${Math.round(rnd(-40, 40))}px"></i>`).join('');
    box.innerHTML = html;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), kind === 'balloons' ? 6600 : kind === 'cake' ? 4200 : 5400);
    return true;
  }
  // 排下一次：隨機 2～5 分鐘後。沒播成（正在忙）就 20 秒後再試。
  function scheduleParty(firstDelay) {
    clearTimeout(partyTimer);
    if (!isMyBirthday()) return;
    const wait = firstDelay !== undefined ? firstDelay : 120000 + Math.random() * 180000;
    partyTimer = setTimeout(() => { if (!isMyBirthday()) return; scheduleParty(playParty() ? undefined : 20000); }, wait);
  }
  // 資料到齊後呼叫：今天是我生日就開始（每天只啟動一次；回到 App 時馬上再來一個）
  function startParty() {
    if (!isMyBirthday()) { clearTimeout(partyTimer); partyDay = ''; return; }
    if (partyDay === today()) return;
    partyDay = today();
    scheduleParty(900);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && partyDay === today() && isMyBirthday()) scheduleParty(1200); });
  function bdayHtml() {
    if (!state.userId || !me()) return '';
    const t = today(), year = Number(t.slice(0, 4));
    let html = '';
    state.members.forEach((m) => {
      const b = birthdayOf(m.id, year);
      if (!b || b.date !== t) return;
      const cards = cardsFor(m.id, year);
      if (m.id === state.userId) {
        html += `
        <div class="bday-hero">
          <div class="bday-confetti" aria-hidden="true">${CONFETTI}</div>
          ${BALLOON('#F48FB1').replace('bday-balloon', 'bday-balloon left')}${BALLOON('#7FB7F2').replace('bday-balloon', 'bday-balloon right')}
          ${CAKE_ART}
          <h2>生日快樂</h2>
          <p class="bday-name">${esc(m.display_name)}${b.age > 0 ? `<span class="bday-age">${b.age} 歲</span>` : ''}</p>
          <p class="bday-wish">全家都祝你天天開心，願望都實現</p>
          <button class="bday-again" data-act="bday-party">再放一次驚喜</button>
        </div>
        ${cards.length ? `<h3 class="bday-sub">家人寫給你的卡片・${cards.length} 張</h3>${bdayCardsHtml(cards, true)}` : '<p class="bday-none">家人寫的卡片會一張一張出現在這裡 💌</p>'}`;
      } else {
        const mine = cards.find((c) => c.from === state.userId);
        html += `
        <div class="bday-other">
          <div class="bday-confetti small" aria-hidden="true">${CONFETTI}</div>
          <span class="bday-who">${avatarHtml(m)}<span class="bday-hat" aria-hidden="true">🎉</span></span>
          <div>
            <h2>今天是${esc(m.display_name)}的生日${b.age > 0 ? `<small>${b.age} 歲</small>` : ''}</h2>
            <p>${mine ? '你的卡片已經送出 💌' : '寫張卡片祝' + esc(m.display_name) + '生日快樂'}</p>
          </div>
          <button class="btn small" data-act="bday-card" data-to="${esc(m.id)}">${mine ? '改我的卡片' : '寫卡片'}</button>
        </div>`;
      }
    });
    // 自己的生日剛過一週內：卡片還留在首頁
    const mineB = [birthdayOf(state.userId, year), birthdayOf(state.userId, year - 1)].filter((b) => b && b.date < t && b.date >= addDays(t, -7))[0];
    if (mineB) {
      const cards = cardsFor(state.userId, Number(mineB.date.slice(0, 4)));
      if (cards.length) html += `<h3 class="bday-sub">你的生日卡片（${shortDate(mineB.date)}）</h3>${bdayCardsHtml(cards, true)}`;
    }
    return html;
  }
  function drawBday() {
    startParty();
    const arch = document.querySelector('.bday-archive');
    if (arch && state.tab === 'me') arch.outerHTML = bdayArchiveEntry();
    const el = document.getElementById('bday');
    if (!el) return;
    const html = bdayHtml();
    if (el.innerHTML !== html) el.innerHTML = html;
    el.hidden = !html;
  }
  // 卡片只有壽星生日當天可以寫、改、刪（伺服器的規則也是這樣檔）
  const bdayToday = (to) => { const b = birthdayOf(to, Number(today().slice(0, 4))); return !!b && b.date === today(); };
  function openBdaySheet(to) {
    const m = member(to), year = Number(today().slice(0, 4));
    if (!m || m.id === state.userId) return;
    if (!bdayToday(to)) { toast('生日已經過了，卡片不能再修改'); drawBday(); return; }
    const c = state.bdayCards.find((x) => x.id === bdayCardId(to, year, state.userId)) || {};
    showSheet('bday-form', {
      title: '給' + m.display_name + '的生日卡片', submit: c.id ? '儲存' : '送出卡片', focus: false, footer: c.id ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(c.id || '')}">
      <input type="hidden" name="to" value="${esc(to)}">
      <div class="bcard-preview" id="bcard-preview">${bdayCardHtml({ from: state.userId, text: c.text || '寫下想對' + m.display_name + '說的話…', sticker: c.sticker, paper: c.paper }, 0)}</div>
      <fieldset class="seg emoji">
        <legend>貼圖</legend>
        ${BDAY_STICKERS.map((e) => `<label style="--cat:#D94B76"><input type="radio" name="sticker" value="${e}" ${(c.sticker || BDAY_STICKERS[0]) === e ? 'checked' : ''}><span class="big">${e}</span></label>`).join('')}
      </fieldset>
      <fieldset class="bpapers">
        <legend>卡片顏色</legend>
        ${BDAY_PAPERS.map(([k, label]) => `<label class="paper-${k}"><input type="radio" name="paper" value="${k}" ${(c.paper || 'pink') === k ? 'checked' : ''}><span aria-label="${label}"></span></label>`).join('')}
      </fieldset>
      <label>想說的話<textarea name="text" rows="4" maxlength="300" placeholder="生日快樂！…">${esc(c.text || '')}</textarea></label>
      <div class="jr-chips">${BDAY_PHRASES.map((q) => `<button type="button" data-act="bday-phrase" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <p class="hint">${esc(m.display_name)}會收到通知，卡片會出現在${esc(m.display_name)}首頁的最上面。只有你和${esc(m.display_name)}看得到內容。<br>只有今天（生日當天）可以修改或刪除，過了今天就會永久保存、不能再改。</p>`
    });
  }
  // ---------- 生日卡片收藏 ----------
  // 每一年的卡片都留在資料庫裡，不會自動刪除。設定 → 家人 →「生日卡片收藏」可以看：
  //   我收到的：依年份分組，最新的在上面；我寫給家人的：依年份、壽星分組。
  function bdayArchiveEntry() {
    const got = state.bdayCards.filter((c) => c.to === state.userId && member(c.from));
    const sent = state.bdayCards.filter((c) => c.from === state.userId && member(c.to));
    const years = new Set(got.map((c) => c.year)).size;
    return `
      <section class="card-list bday-archive">
        <h2>生日卡片收藏<small>每一年家人寫的卡片都會留在這裡</small></h2>
        <div class="bday-arch-btns">
          <button class="bday-arch-btn" data-act="bday-archive" data-kind="got">
            <span class="bday-arch-ico" aria-hidden="true">💌</span>
            <span class="bday-arch-text"><b>我收到的卡片</b><small>${got.length ? got.length + ' 張・' + years + ' 年' : '還沒有收到卡片'}</small></span>
          </button>
          <button class="bday-arch-btn" data-act="bday-archive" data-kind="sent">
            <span class="bday-arch-ico" aria-hidden="true">✍️</span>
            <span class="bday-arch-text"><b>我寫給家人的卡片</b><small>${sent.length ? sent.length + ' 張' : '還沒有寫過'}</small></span>
          </button>
        </div>
      </section>`;
  }
  function openBdayArchive(kind) {
    const got = kind === 'got';
    const list = state.bdayCards.filter((c) => (got ? c.to === state.userId && member(c.from) : c.from === state.userId && member(c.to)))
      .sort((a, b) => b.year - a.year || a.created_at - b.created_at);
    const years = Array.from(new Set(list.map((c) => c.year)));
    const myBirth = (state.profiles[state.userId] || {}).birthday;
    const body = !list.length
      ? `<p class="bday-none">${got ? '生日當天家人寫給你的卡片，會一年一年收在這裡。' : '家人生日那天寫的卡片，會收在這裡。'}</p>`
      : years.map((y, n) => {
        const rows = list.filter((c) => c.year === y);
        const age = got && myBirth ? y - Number(myBirth.slice(0, 4)) : 0;
        const head = got ? `${y} 年${age > 0 ? `<span class="bday-age">${age} 歲</span>` : ''}` : `${y} 年`;
        const cards = got ? bdayCardsHtml(rows)
          : rows.map((c, i) => `<p class="bday-arch-to">寫給${esc(nameOf(c.to))}</p>${bdayCardHtml(c, i)}`).join('');
        return `
        <details class="bday-year" ${n === 0 ? 'open' : ''}>
          <summary><span>${head}</span><small>${rows.length} 張</small></summary>
          <div class="bday-year-body">${cards}</div>
        </details>`;
      }).join('');
    showSheet('bday-archive', { title: got ? '我收到的生日卡片' : '我寫給家人的卡片', readonly: true, body: `<div class="bday-arch">${body}</div>` });
  }

  function drawBdayPreview() {
    const f = document.getElementById('bday-form'), box = document.getElementById('bcard-preview');
    if (!f || !box) return;
    const m = member(f.elements.to.value);
    box.innerHTML = bdayCardHtml({ from: state.userId, text: f.elements.text.value.trim() || '寫下想對' + (m ? m.display_name : '壽星') + '說的話…', sticker: f.elements.sticker.value, paper: f.elements.paper.value }, 0);
  }

  // ---------- 今天天氣（首頁名字旁邊） ----------
  // 每個人看自己所在位置的天氣：點一下天氣 → 手機問「要不要允許取得位置」→ 之後每次開 App 自動用目前位置。
  // 位置只留在這支手機上（不會存到資料庫，家人看不到），查天氣時把大約的座標（四捨五入到約 1 公里）送給
  // Open-Meteo 查天氣、BigDataCloud 查地名，兩個都免費、不用金鑰。沒允許或抓不到位置時顯示新竹。
  // 半小時更新一次，結果存在手機上，沒網路時顯示上次的。
  const WX_HOME = { name: '新竹', lat: 24.8, lon: 120.97 };
  const WX_KEY = 'family-weather', WX_GEO_KEY = 'family-weather-geo';
  let wx = null, wxLoading = false;
  try { wx = JSON.parse(localStorage.getItem(WX_KEY)); } catch (e) { /* 沒有存過 */ }
  const wxUsesGeo = () => { try { return localStorage.getItem(WX_GEO_KEY) === 'on'; } catch (e) { return false; } };
  // 目前位置（抓不到就回 null）。座標四捨五入到小數兩位，查天氣夠用，也不會送出精確位置
  const wxLocate = (fresh) => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 }),
      (err) => resolve(err && err.code === 1 ? 'denied' : null),
      { enableHighAccuracy: false, timeout: fresh ? 12000 : 8000, maximumAge: fresh ? 0 : 10 * 60000 });   // fresh：不用手機記住的舊位置，重新定位
  });
  async function wxPlaceName(lat, lon) {
    try {
      const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=zh');
      if (!res.ok) return '';
      const d = await res.json();
      const name = String(d.locality || d.city || d.principalSubdivision || '').replace(/^(.{1,8}).*$/, '$1');
      return name;
    } catch (e) { return ''; }
  }
  // 點天氣：第一次打開「用我的位置」，之後點是重新整理
  async function onWeatherTap() {
    let known = null;
    if (!wxUsesGeo()) {
      if (!navigator.geolocation) return toast('這支手機沒辦法取得位置，天氣會顯示新竹');
      const pos = await wxLocate();
      if (pos === 'denied') return toast('沒有允許取得位置。到 iPhone「設定 → 隱私權與安全性 → 定位服務」打開後再點一次');
      if (!pos) return toast('現在抓不到位置，請到空曠一點的地方再試');
      try { localStorage.setItem(WX_GEO_KEY, 'on'); } catch (e) { /* 存不了沒關係 */ }
      known = pos;   // 剛剛才定位過，不用再定位一次
    }
    // 已經打開的：點一下就重新定位、重新查天氣
    if (wxLoading) return;
    const el = document.getElementById('wx');
    if (el) el.classList.add('busy');
    await loadWeather(true, known);
    if (el) el.classList.remove('busy');
    toast(wx && wx.here && Date.now() - wx.at < 5000 ? '已更新：' + wx.place : '現在更新不了，先顯示上次的天氣');
  }
  function wxKind(code) {
    if (code === 0) return ['☀️', '晴'];
    if (code <= 2) return ['🌤️', '晴時多雲'];
    if (code === 3) return ['☁️', '陰'];
    if (code <= 48) return ['🌫️', '有霧'];
    if (code <= 57) return ['🌦️', '毛毛雨'];
    if (code <= 67) return ['🌧️', '下雨'];
    if (code <= 77) return ['🌨️', '下雪'];
    if (code <= 82) return ['🌧️', '陣雨'];
    if (code <= 86) return ['🌨️', '陣雪'];
    return ['⛈️', '雷雨'];
  }
  function weatherHtml() {
    if (!wx || wx.day !== today()) return wxUsesGeo() ? '' : '<span class="wx-text"><small>📍 點一下看這裡的天氣</small></span>';
    const [icon, label] = wxKind(wx.code);
    return `<span class="wx-icon" aria-hidden="true">${icon}</span><span class="wx-text"><b>${esc(label)} ${Math.round(wx.temp)}°</b><small>${wx.here ? '📍' : ''}${esc(wx.place || WX_HOME.name)} ${Math.round(wx.min)}–${Math.round(wx.max)}°${wx.rain >= 30 ? '・降雨 ' + Math.round(wx.rain) + '%' : ''}</small>${wxUsesGeo() ? '' : '<small class="wx-tip">點一下改看我的位置</small>'}</span>`;
  }
  async function loadWeather(force, known) {
    if (wxLoading || (!force && wx && wx.day === today() && Date.now() - wx.at < 30 * 60000)) return;
    wxLoading = true;
    try {
      let spot = WX_HOME, here = false;
      if (wxUsesGeo()) {
        const pos = known || await wxLocate(force);
        if (pos && pos !== 'denied') { spot = { ...pos, name: '' }; here = true; }
        else if (wx && wx.here && wx.lat != null) { spot = { lat: wx.lat, lon: wx.lon, name: wx.place }; here = true; }   // 這次抓不到：用上次的位置
      }
      const [res, name] = await Promise.all([
        fetch('https://api.open-meteo.com/v1/forecast?latitude=' + spot.lat + '&longitude=' + spot.lon
          + '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1'),
        spot.name ? spot.name : wxPlaceName(spot.lat, spot.lon)
      ]);
      if (!res.ok) throw new Error('weather ' + res.status);
      const d = await res.json();
      const next = { at: Date.now(), day: today(), code: Number(d.current.weather_code), temp: Number(d.current.temperature_2m),
        max: Number(d.daily.temperature_2m_max[0]), min: Number(d.daily.temperature_2m_min[0]), rain: Number(d.daily.precipitation_probability_max[0]) || 0,
        here, lat: spot.lat, lon: spot.lon, place: name || (here ? '目前位置' : WX_HOME.name) };
      if (![next.code, next.temp, next.max, next.min].every(Number.isFinite)) throw new Error('weather format');
      wx = next;
      try { localStorage.setItem(WX_KEY, JSON.stringify(wx)); } catch (e) { /* 存不了沒關係 */ }
    } catch (e) { console.warn('天氣讀不到', e); }
    wxLoading = false;
    const el = document.getElementById('wx');
    if (el) el.innerHTML = weatherHtml();
  }

  function calSwitch() {
    const b = (v, label) => `<button class="${state.calView === v ? 'on' : ''}" data-act="cal-view" data-view="${v}" ${state.calView === v ? 'aria-pressed="true"' : ''}>${label}</button>`;
    return `<div class="switcher" role="group" aria-label="檢視方式">${b('month', '月曆')}${b('list', '近期')}</div>`;
  }

  // ---- 報平安 ----
  // checkins/{id}：{ kid, kind, text, note, at, date, lat?, lng?, acc?, place? }
  //   小朋友在首頁按一下就送出，只在按下的那一刻抓一次位置；爸媽收到通知，首頁看得到紀錄。
  //   只有爸媽和小朋友本人讀得到；送出後 30 秒內可以收回；紀錄留 30 天（伺服器每天清）。
  // places/{id}：{ name, lat, lng }　爸媽把某次報平安的位置記成「家」「學校」，之後在附近報平安就顯示這個名字
  const CI_ICON = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    school: '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>',
    bus: '<rect x="4" y="4" width="16" height="13" rx="3"/><path d="M4 11h16"/><circle cx="8" cy="20" r="1.5"/><circle cx="16" cy="20" r="1.5"/>',
    out: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    cram: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
    custom: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  const CI_KINDS = [
    { id: 'home', text: '我到家囉', short: '到家', c: '#C4561B', bg: '#FDE9DC' },
    { id: 'school', text: '我到學校了', short: '到學校', c: '#2456A8', bg: '#E1EBFA' },
    { id: 'bus', text: '我上車了', short: '上車', c: '#1B7A4F', bg: '#DDF1E6' },
    { id: 'out', text: '我下課了', short: '下課', c: '#6A47B0', bg: '#ECE4F8' },
    { id: 'cram', text: '到補習班了', short: '到補習班', c: '#0B7373', bg: '#DAF1F0' },
    { id: 'custom', text: '自己寫一句', short: '留言', c: '#4E5B55', bg: '#ECEFEA' }
  ];
  const CI_UNDO_MS = 30000, CI_KEEP_DAYS = 30, CI_NEAR_M = 150;
  const ciKind = (id) => CI_KINDS.find((k) => k.id === id) || CI_KINDS[5];
  const ciSvg = (name, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${CI_ICON[name] || CI_ICON.custom}</svg>`;
  const ciBadge = (k, cls) => `<i class="ci-badge ${cls || ''}" style="--c:${k.c};--bg:${k.bg}">${ciSvg(k.id)}</i>`;
  const ciList = () => state.checkins.filter((c) => c.at > Date.now() - CI_KEEP_DAYS * 86400000).sort((a, b) => b.at - a.at);
  const ciDate = (c) => ymd(new Date(c.at));     // 用送出的時間算日期，不靠手機當時填的 date
  const ciWhen = (c, timeOnly) => (timeOnly || ciDate(c) === today() ? '' : ciDate(c) === addDays(today(), -1) ? '昨天 ' : shortDate(ciDate(c)) + ' ') + clock(c.at);
  const ciMapUrl = (c) => 'https://www.google.com/maps?q=' + c.lat + ',' + c.lng;
  const ciHasPos = (c) => typeof c.lat === 'number' && typeof c.lng === 'number';
  function metersBetween(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  // 離最近的「記住的地點」不到 150 公尺，就用那個名字
  function ciNearPlace(pos) {
    let best = null, bestD = CI_NEAR_M;
    state.places.forEach((p) => { const d = metersBetween(pos, p); if (d <= bestD) { best = p; bestD = d; } });
    return best;
  }
  const ciPlaceText = (c) => !ciHasPos(c) ? '沒有位置' : (ciNearPlace(c) || {}).name || c.place || '看地圖';
  // 這個時間最可能要按哪一顆：先看自己過去同一個時段最常按的，沒有紀錄就用一般作息猜
  function ciSuggest() {
    const h = new Date().getHours(), count = {};
    state.checkins.forEach((c) => { if (c.kid === state.userId && c.kind !== 'custom' && Math.abs(new Date(c.at).getHours() - h) <= 1) count[c.kind] = (count[c.kind] || 0) + 1; });
    const top = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    if (top && count[top] >= 2) return top;
    return h >= 6 && h < 9 ? 'school' : (h >= 11 && h < 13) || (h >= 15 && h < 17) ? 'out' : h >= 17 && h < 23 ? 'home' : '';
  }
  function ciKidHtml() {
    const last = ciList().find((c) => c.kid === state.userId && ciDate(c) === today());     // 首頁只顯示今天的
    const lk = last && ciKind(last.kind);
    const chip = last ? `<span class="ci-last" style="--c:${lk.c};--bg:${lk.bg}"><i>${ciSvg(lk.id)}</i>${esc(ciWhen(last))} ${esc(last.kind === 'custom' ? last.text.slice(0, 8) : lk.short)}</span>` : '<small>按一下，告訴爸媽你到了</small>';
    if (!state.ciOpen) return `
      <button class="ci-bar" data-act="ci-toggle" aria-expanded="false" aria-controls="ci-panel">
        <i class="ci-badge solid">${ciSvg('pin')}</i><b>報平安</b>${chip}
        <span class="ci-chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
      </button>`;
    const hint = ciSuggest();
    return `
      <div class="ci-panel" id="ci-panel">
        <button class="ci-head" data-act="ci-toggle" aria-expanded="true" aria-controls="ci-panel">
          <i class="ci-badge solid">${ciSvg('pin')}</i><span><b>報平安</b><small>選一個，馬上告訴爸媽</small></span>
          <em>收起<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></em>
        </button>
        <div class="ci-grid">
          ${CI_KINDS.map((k) => `<button class="ci-tile ${k.id === hint ? 'hint' : ''}" style="--c:${k.c};--bg:${k.bg}" data-act="ci-send" data-kind="${k.id}">${ciBadge(k)}<span>${k.text}</span>${k.id === hint ? '<em>現在常用</em>' : ''}</button>`).join('')}
        </div>
        <p class="ci-foot">${ciSvg('pin')}會附上你現在的位置・按錯了 30 秒內可以收回</p>
      </div>`;
  }
  function ciRowHtml(c, withKid, timeOnly) {
    const k = ciKind(c.kind), m = member(c.kid);
    return `
      <button class="ci-row" data-act="ci-view" data-id="${esc(c.id)}">
        ${withKid && m ? avatarHtml(m, 'sm') : ciBadge(k, 'sm')}
        <span class="ci-row-main"><b>${withKid ? esc(nameOf(c.kid)) + '：' : ''}${esc(c.text)}</b>${c.note ? `<small class="ci-note">「${esc(c.note)}」</small>` : ''}
          <small>${ciSvg('pin')}${esc(ciPlaceText(c))}</small></span>
        <time>${esc(ciWhen(c, timeOnly))}</time>
      </button>`;
  }
  function ciParentHtml() {
    const list = ciList();
    // 首頁只顯示今天的；以前的在「鍾家生活 → 報平安紀錄」
    const latest = kids().map((k) => list.find((c) => c.kid === k.id && ciDate(c) === today())).filter(Boolean).sort((a, b) => b.at - a.at);
    if (!kids().length) return '';
    // 沒有紀錄時整張卡都不顯示（只在還沒部署時提醒管理員）
    if (!latest.length && !(state.ciReady === false && isAdmin())) return '';
    // 看過了（點過任一筆、全部紀錄或「收起」）就合成一條；有新的報平安才自動展開
    const unread = latest.some((c) => c.at > ciSeenAt());
    if (latest.length && !unread && !state.ciParentOpen) return `
      <button class="ci-bar ci-pbar" data-act="ci-popen" aria-expanded="false" aria-label="小朋友報平安：${esc(latest.map((c) => nameOf(c.kid) + ' ' + clock(c.at) + ' ' + c.text).join('，'))}。點一下展開">
        <i class="ci-badge solid">${ciSvg('pin')}</i>
        <span class="ci-pchips">${latest.map((c) => { const k = ciKind(c.kind); const m = member(c.kid) || {}; return `<span class="ci-last ci-who" style="--c:${k.c};--bg:${k.bg}"><span class="avatar ci-av" style="background:${esc(m.color || '#888')}">${esc(m.id ? faceOf(m) : '?')}</span><i>${ciSvg(k.id)}</i>${esc(c.kind === 'custom' ? '留言' : k.short)} ${esc(clock(c.at))}</span>`; }).join('')}</span>
        <span class="ci-chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span>
      </button>`;
    return `
      <div class="ci-card ${unread ? 'unread' : ''}">
        <h2>${ciSvg('pin')}今天的報平安${unread ? '<em class="ci-new">新的</em>' : ''}${list.length ? `<button class="link-btn" data-act="ci-all">以前的紀錄</button>` : ''}</h2>
        ${latest.length ? latest.map((c) => ciRowHtml(c, true)).join('')
          : '<p class="none">報平安還沒開通：請用最新的 family-app.zip 執行一次 deploy.bat。</p>'}
        ${latest.length ? `<button class="ci-fold" data-act="ci-pclose">${unread ? '知道了，收起來' : '收起來'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>` : ''}
      </div>`;
  }
  // 爸媽看過的最後一筆報平安時間（存在這支手機上）
  const ciSeenKey = () => 'family-ci-seen-' + state.userId;
  function ciSeenAt() { try { return Number(localStorage.getItem(ciSeenKey())) || 0; } catch (e) { return 0; } }
  function ciMarkSeen() {
    const top = ciList().reduce((m, c) => Math.max(m, c.at), 0);
    try { if (top > ciSeenAt()) localStorage.setItem(ciSeenKey(), String(top)); } catch (e) { /* 存不了就算了 */ }
  }
  const ciHtml = () => (!state.userId || !me() ? '' : amChild() ? ciKidHtml() : ciParentHtml());
  function drawCheckin() {
    if (state.tab === 'notes' && state.notesView === 'checkins' && !$sheet.innerHTML) { const sc = scroller(), y = sc ? sc.scrollTop : 0; render(); if (scroller()) scroller().scrollTop = y; }
    const el = document.getElementById('checkin');
    if (!el) return;
    const html = ciHtml();
    if (el.innerHTML !== html) el.innerHTML = html;
    el.hidden = !html;
  }
  // 抓一次現在的位置（最多等 10 秒）。回 { lat, lng, acc }、'denied' 或 null
  const ciLocate = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: Math.round(pos.coords.latitude * 1e5) / 1e5, lng: Math.round(pos.coords.longitude * 1e5) / 1e5, acc: Math.round(pos.coords.accuracy || 0) }),
      (err) => resolve(err && err.code === 1 ? 'denied' : null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
  const ciMapHtml = (c) => `
    <div class="ci-map"><iframe title="地圖" loading="lazy" referrerpolicy="no-referrer" src="https://maps.google.com/maps?q=${c.lat},${c.lng}&z=16&hl=zh-TW&output=embed"></iframe></div>
    <p class="ci-where">${ciSvg('pin')}<span>${esc((ciNearPlace(c) || {}).name || c.place || '地圖上的位置')}</span>${c.acc ? `<small>誤差約 ${c.acc > 999 ? Math.round(c.acc / 100) / 10 + ' 公里' : c.acc + ' 公尺'}</small>` : ''}<a href="${esc(ciMapUrl(c))}" target="_blank" rel="noopener">用 Google 地圖打開</a></p>`;
  let ciBusy = false, ciSent = null, ciTimer = null;
  function ciSheetHead(k, text, sub, done) {
    return `<div class="ci-sent-head">${ciBadge(k, 'lg' + (done ? ' done' : ''))}<div><h2>${esc(text)}</h2><p>${sub}</p></div></div>`;
  }
  async function sendCheckin(kindId, custom) {
    if (ciBusy || !amChild()) return;
    ciBusy = true;
    const k = ciKind(kindId), text = (custom || k.text).slice(0, 40);
    showSheet('ci-sent-form', { title: '報平安', submit: '完成', body: `<div id="ci-sent">${ciSheetHead(k, '正在告訴爸媽：' + text, '正在取得你現在的位置…')}<div class="ci-wait" aria-hidden="true"><i></i></div></div>` });
    const btn = $sheet.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    try {
      const pos = await ciLocate();
      const data = { kid: state.userId, kind: k.id, text, note: '', at: Date.now(), date: today() };
      if (pos && typeof pos === 'object') {
        Object.assign(data, pos);
        const near = ciNearPlace(pos);
        data.place = near ? near.name : (await wxPlaceName(Math.round(pos.lat * 100) / 100, Math.round(pos.lng * 100) / 100)) || '';   // 查地區名只送出大約的位置（約 1 公里）
      }
      const id = await Api.addDoc('checkins', data);
      ciSent = { ...data, id, denied: pos === 'denied' };
      state.ciOpen = false;
      if (!findById(state.checkins, id)) state.checkins.push({ ...data, id });
      Api.sendMessage('【報平安】' + text, { checkin: id }).catch((e) => console.warn('報平安沒有傳到聊天室', e));
      drawCheckin();
      drawCiSent();
      celebrate();
      clearInterval(ciTimer);
      ciTimer = setInterval(() => {
        const b = document.getElementById('ci-undo');
        if (!ciSent || !b) return clearInterval(ciTimer);
        const left = Math.ceil((ciSent.at + CI_UNDO_MS - Date.now()) / 1000);
        if (left <= 0) { b.remove(); clearInterval(ciTimer); } else b.textContent = '按錯了，收回（' + left + ' 秒）';
      }, 500);
    } catch (e) {
      console.error(e);
      const el = document.getElementById('ci-sent');
      const denied = /permission|denied/i.test(String((e && (e.code || e.message)) || ''));
      if (el) el.innerHTML = ciSheetHead(k, '沒有傳出去', denied ? '報平安還沒開通，請跟爸爸說要重新部署一次。' : '請確認網路後，關掉這個視窗再按一次。');
    } finally { ciBusy = false; if (btn) btn.disabled = false; }
  }
  function drawCiSent() {
    const el = document.getElementById('ci-sent'), c = ciSent;
    if (!el || !c) return;
    const k = ciKind(c.kind), parents = state.members.filter((m) => !m.child).map((m) => m.display_name).join('、');
    el.innerHTML = ciSheetHead(k, '已告訴爸媽：' + c.text, clock(c.at) + '・' + esc(parents) + '會收到通知', true)
      + (ciHasPos(c) ? ciMapHtml(c) : `<p class="ci-nopos">${c.denied ? '這次沒有附上位置：還沒允許取得位置。到 iPhone「設定 → 隱私權與安全性 → 定位服務」打開後，下次就會附上。' : '這次抓不到位置，所以沒有附上。爸媽還是會收到通知。'}</p>`)
      + `<label>想多說一句（可以不寫）<input name="note" class="title-input" maxlength="100" placeholder="例如：在便利商店買東西" autocomplete="off"></label>
         <button type="button" class="btn ci-undo" id="ci-undo" data-act="ci-undo">按錯了，收回（${Math.ceil(CI_UNDO_MS / 1000)} 秒）</button>`;
  }
  async function undoCheckin() {
    const c = ciSent;
    if (!c || Date.now() - c.at > CI_UNDO_MS + 5000) return toast('已經超過 30 秒，不能收回了');
    try {
      await Api.deleteDoc('checkins', c.id);
      const m = state.messages.find((x) => x.checkin === c.id && !x.recalled);
      if (m) Api.recallMessage(m.id, false).catch(() => {});
      state.checkins = state.checkins.filter((x) => x.id !== c.id);
      ciSent = null; clearInterval(ciTimer);
      closeSheet(); drawCheckin();
      toast('已收回，爸媽會知道你收回了');
    } catch (e) { console.error(e); toast('沒有收回成功'); }
  }
  // 爸媽：看一筆（地圖、把這裡記成常去的地點）；小朋友也可以看自己的
  function openCheckin(id) {
    const c = findById(state.checkins, id);
    if (!c) return;
    const k = ciKind(c.kind), near = ciHasPos(c) && ciNearPlace(c);
    const canSave = !amChild() && ciHasPos(c);
    showSheet('ci-view-form', {
      title: nameOf(c.kid) + '的報平安', readonly: !canSave, submit: '記住地點',
      body: `<input type="hidden" name="item_id" value="${esc(c.id)}">
        ${ciSheetHead(k, c.text, esc(ciWhen(c)) + (c.note ? '・「' + esc(c.note) + '」' : ''))}
        ${ciHasPos(c) ? ciMapHtml(c) : '<p class="ci-nopos">這一筆沒有附上位置（當時抓不到，或還沒允許取得位置）。</p>'}
        ${canSave ? `<label>${near ? '這裡已經記成「' + esc(near.name) + '」，可以改名字' : '把這個位置記下來（之後在附近報平安會顯示這個名字）'}
          <input name="place" class="title-input" maxlength="12" value="${near ? esc(near.name) : ''}" placeholder="例如：家、學校、補習班" autocomplete="off"></label>
          ${state.places.length ? `<div class="ci-places"><small>已經記住的地點</small>${state.places.map((p) => `<span>${esc(p.name)}<button type="button" data-act="ci-place-del" data-id="${esc(p.id)}" aria-label="刪除地點：${esc(p.name)}">×</button></span>`).join('')}</div>` : ''}` : ''}`
    });
  }
  // 報平安紀錄（鍾家生活裡的一頁）：最近 30 天，一天一段。爸媽看兩個小朋友的，小朋友看自己的。
  function viewCheckins() {
    const list = ciList().filter((c) => !state.ciKid || c.kid === state.ciKid), days = [];
    list.forEach((c) => { const day = ciDate(c); let d = days.find((x) => x.date === day); if (!d) days.push(d = { date: day, items: [] }); d.items.push(c); });
    const chip = (id, label) => `<button class="album-chip ${state.ciKid === id ? 'on' : ''}" data-act="ci-kid" data-id="${esc(id)}" ${state.ciKid === id ? 'aria-pressed="true"' : ''}>${esc(label)}</button>`;
    return `
      <header class="plain-head"><h1>報平安紀錄</h1><p>最近 30 天・${list.length} 筆</p></header>
      ${!amChild() && kids().length > 1 ? `<div class="album-chips" role="group" aria-label="看誰的紀錄">${chip('', '全部')}${kids().map((k) => chip(k.id, k.display_name)).join('')}</div>` : ''}
      ${days.length ? days.map((d) => `<section class="ci-card ci-day"><h2>${d.date === today() ? '今天' : d.date === addDays(today(), -1) ? '昨天' : shortDate(d.date)}<span>${d.items.length} 筆</span></h2>${d.items.map((c) => ciRowHtml(c, !amChild(), true)).join('')}</section>`).join('')
        : '<div class="empty big"><p>最近 30 天沒有報平安的紀錄。</p></div>'}
      <p class="hint">只保留最近 30 天，超過的會自動刪除。位置只在按下報平安的那一刻記一次，不會持續追蹤。點任何一筆可以看地圖。</p>`;
  }
  function openCheckinAll() { state.ciKid = ''; state.notesView = 'checkins'; goTab('notes'); if (scroller()) scroller().scrollTop = 0; }
  async function checkCiReady() {
    try { await Api.listDocs('places'); state.ciReady = true; } catch (e) { console.warn('報平安還沒開通', e); state.ciReady = false; }
    drawCheckin();
  }

  // ---------- 通知中心 ----------
  // notifications/{id}：伺服器每發一則推播（聊天、來電除外）就記一筆給那個人，留 14 天。錯過推播也能在這裡找到。
  const BELL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>';
  const NOTICE_SEEN_KEY = 'family-notice-seen';
  const NOTIFY_KINDS = [['chat', '聊天'], ['post', '我有話要說'], ['poll', '投票'], ['cal', '行程提醒、生日'], ['money', '零用錢、費用申請'], ['todo', '待辦'], ['study', '讀書計畫'], ['video', '影片']];
  const noticeList = () => state.notices.slice().sort((a, b) => b.at - a.at).slice(0, 60);
  function noticeSeenAt() { try { return Number(localStorage.getItem(NOTICE_SEEN_KEY + '-' + state.userId)) || 0; } catch (e) { return 0; } }
  const noticeNew = () => state.notices.filter((n) => n.at > noticeSeenAt()).length;
  const noticeTab = (tag) => { const k = String(tag || '').split('-')[0]; return { event: 'cal', bday: 'cal', checkin: 'cal', poll: 'polls', post: 'posts', request: 'ledger', todo: 'todos', study: 'study', video: 'video' }[k] || 'cal'; };
  function drawBell() {
    const el = document.getElementById('bell');
    if (!el) return;
    const n = noticeNew();
    el.classList.toggle('has', n > 0);
    el.setAttribute('aria-label', n ? '通知，' + n + ' 則新的' : '通知');
  }
  function openNotices() {
    const seen = noticeSeenAt(), list = noticeList();
    showSheet('notice-form', {
      title: '通知', readonly: true,
      body: (list.length ? list.map((n) => `
        <button class="nt-row ${n.at > seen ? 'new' : ''}" data-act="notice-go" data-tag="${esc(n.tag || '')}">
          <b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}<time>${stamp(n.at)}</time>
        </button>`).join('') : '<p class="none">最近 14 天沒有通知。</p>')
        + '<p class="hint">這裡留著最近 14 天的通知（聊天訊息除外）。想關掉某一種推播，到「設定 → 通知」調整。</p>'
    });
    try { localStorage.setItem(NOTICE_SEEN_KEY + '-' + state.userId, String(Date.now())); } catch (e) { /* 忽略 */ }
    drawBell();
  }
  // 測試通知：請伺服器實際發一則，逐人列出結果和該怎麼處理
  function pushTestRow(r) {
    const codes = [...new Set(r.errors || [])];
    let cls = 'ok', text = '送出了，請看手機有沒有跳出「測試通知」';
    if (!r.tokens) { cls = 'bad'; text = '這個帳號沒有任何手機開啟通知。請' + esc(r.name) + '在自己的手機打開 App →「設定 → 通知」→ 按「開啟這支手機的通知」。'; }
    else if (!r.ok) {
      cls = 'bad';
      text = codes.some((c) => /not-registered|invalid-registration/.test(c)) ? '登記的手機都失效了（例如重裝過 App、關過通知）。請' + esc(r.name) + '到「設定 → 通知」先關閉再重新開啟。'
        : codes.some((c) => /third-party-auth|mismatched-credential|authentication|permission/i.test(c)) ? '伺服器沒有權限送出通知（Firebase 的推播設定或金鑰有問題），請把這個畫面截圖給 Claude。'
        : '送不出去，請把這個畫面截圖給 Claude。';
    } else if (r.ok < r.tokens) { cls = 'warn'; text = r.ok + ' 支手機送出了，另外 ' + (r.tokens - r.ok) + ' 支已經失效（已自動清掉）。'; }
    return `<div class="pt-row ${cls}"><b>${esc(r.name)}</b><span>${r.tokens} 支手機・成功 ${r.ok}</span><p>${text}</p>${codes.length ? `<code>${esc(codes.join(', '))}</code>` : ''}</div>`;
  }
  async function runPushTest(btn) {
    const out = document.getElementById('pt-out');
    if (!out || btn.disabled) return;
    const all = btn.dataset.all === '1', label = btn.textContent;
    btn.disabled = true; btn.textContent = '測試中…';
    try {
      const r = await Api.pushTest(all);
      out.innerHTML = (r.results || []).map(pushTestRow).join('')
        + '<p class="hint">顯示「送出了」但手機沒跳通知：請確認 iPhone「設定 → 通知 → 鍾家大宅」有允許通知、沒有開專注模式或勿擾；App 要是「加入主畫面」的那一個。</p>';
    } catch (e) {
      console.error(e);
      const code = String((e && (e.code || e.message)) || '');
      out.innerHTML = `<div class="pt-row bad"><p>${/not-found|unimplemented|internal/i.test(code) ? '測試功能還沒部署：請到 GitHub → Actions →「部署 Firebase」按一次 Run workflow。' : '測試沒有完成，請確認網路後再試。'}</p><code>${esc(code.slice(0, 80))}</code></div>`;
    }
    btn.disabled = false; btn.textContent = label;
  }
  function pushTestHtml() {
    return `
      <section class="card-list">
        <h2>測試通知<small>檢查通知有沒有正常送出</small></h2>
        <p class="hint">會真的發一則「測試通知」到手機，並列出每個人登記了幾支手機、有沒有送成功。</p>
        <div class="pt-btns"><button class="btn ghost small" data-act="push-test">測試我的手機</button>${isAdmin() ? '<button class="btn ghost small" data-act="push-test" data-all="1">測試全家</button>' : ''}</div>
        <div id="pt-out" aria-live="polite"></div>
      </section>`;
  }
  // 設定頁：我不想收哪幾種推播
  function notifyPrefsHtml() {
    if (state.notifyOff === null) {
      state.notifyOff = undefined;
      Api.getDoc('notify_prefs', state.userId).then((d) => { state.notifyOff = (d && Array.isArray(d.off) ? d.off : []); }, (e) => { console.warn('讀不到通知設定', e); state.notifyOff = false; })
        .then(() => { if (state.tab === 'me' && !$sheet.innerHTML) render(); });
    }
    const off = state.notifyOff;
    return `
      <section class="card-list">
        <h2>要收哪些通知<small>只影響你自己的帳號</small></h2>
        ${off === false ? '<p class="hint">這個設定還沒開通，需要先部署一次。</p>' : !Array.isArray(off) ? '<div class="skel line w60"></div>' : `
        <div class="nt-kinds" role="group" aria-label="要收哪些通知">${NOTIFY_KINDS.map(([id, label]) => `<button class="chip-btn ${off.includes(id) ? '' : 'on'}" data-act="notify-kind" data-kind="${id}" aria-pressed="${!off.includes(id)}">${off.includes(id) ? '' : '✓ '}${label}</button>`).join('')}</div>
        <p class="hint">點一下可以關掉或打開。關掉的種類不會跳通知，但還是會出現在首頁右上角的「通知」裡。報平安和視訊來電一定會通知。</p>`}
      </section>`;
  }
  async function toggleNotifyKind(kind) {
    if (!Array.isArray(state.notifyOff)) return;
    const was = state.notifyOff, off = was.includes(kind) ? was.filter((k) => k !== kind) : was.concat(kind);
    state.notifyOff = off; render();
    try { await Api.setDoc('notify_prefs', state.userId, { off }); }
    catch (e) { console.error(e); state.notifyOff = was; render(); toast('沒有存到，請再試一次'); }
  }
  // ---------- 首頁排列（只存在這支手機） ----------
  const HOME_KEY = 'family-home-layout';
  const HOME_PARTS = [['checkin', '報平安'], ['mine', '我的今天'], ['polls', '投票'], ['cal', '行事曆']];
  function homeLayout() {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(HOME_KEY)) || []; } catch (e) { saved = []; }
    const list = saved.filter((x) => x && HOME_PARTS.some(([id]) => id === x.id)).map((x) => ({ id: x.id, on: x.on !== false || x.id === 'cal' }));
    HOME_PARTS.forEach(([id]) => { if (!list.some((x) => x.id === id)) list.push({ id, on: true }); });
    return list;
  }
  function saveHomeLayout(list) { try { localStorage.setItem(HOME_KEY, JSON.stringify(list)); } catch (e) { /* 存不了就算了 */ } }
  function homeLayoutHtml() {
    const list = homeLayout();
    return `
      <section class="card-list">
        <h2>首頁排列<small>只會改這支手機</small></h2>
        <div class="home-order">${list.map((x, i) => {
          const label = (HOME_PARTS.find(([id]) => id === x.id) || [])[1];
          return `<div class="ho-row ${x.on ? '' : 'off'}">
            <b>${label}</b>
            <button class="icon-btn" data-act="home-move" data-id="${x.id}" data-dir="-1" aria-label="${label}往上移" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-act="home-move" data-id="${x.id}" data-dir="1" aria-label="${label}往下移" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
            ${x.id === 'cal' ? '<span class="ho-fixed">固定顯示</span>' : `<button class="chip-btn ${x.on ? 'on' : ''}" data-act="home-show" data-id="${x.id}" aria-pressed="${x.on}">${x.on ? '顯示中' : '已隱藏'}</button>`}
          </div>`;
        }).join('')}</div>
        <p class="hint">用箭頭調整首頁由上到下的順序；不想看的可以隱藏。生日當天的祝福一定會在最上面。</p>
      </section>`;
  }
  // ---------- 全站搜尋 ----------
  const SEARCH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/></svg>';
  function openSearch() {
    showSheet('search-form', {
      title: '搜尋', readonly: true, focus: true,
      body: `<input id="gs-q" class="search" type="search" placeholder="找行程、聊天、待辦、發言、筆記" autocomplete="off" aria-label="搜尋全部內容">
        <div id="gs-out">${searchHtml('')}</div>`
    });
  }
  function searchHtml(raw) {
    const q = raw.trim().toLowerCase();
    if (!q) return '<p class="hint">輸入關鍵字，一次找行事曆（今天起 90 天和這個月）、最近 300 則聊天、待辦、我有話要說、筆記。</p>';
    const has = (...texts) => texts.some((t) => String(t || '').toLowerCase().includes(q));
    const row = (act, id, title, sub, extra) => `<button class="gs-row" data-act="${act}" data-id="${esc(id)}" ${extra || ''}><b>${markText(String(title || '').slice(0, 80), raw.trim())}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
    const seen = {}, groups = [];
    const events = state.upcoming.concat(state.monthEvents).filter((e) => { const k = (e.series ? e.series.id : e.id) + e.event_date; if (seen[k]) return false; seen[k] = true; return has(e.title, e.note); })
      .sort((a, b) => a.event_date.localeCompare(b.event_date)).slice(0, 12);
    if (events.length) groups.push(['行事曆', events.map((e) => row('gs-event', (e.series || e).id, e.title, shortDate(e.event_date) + '（' + WEEKDAYS[parse(e.event_date).getDay()] + '）' + (e.start_time ? ' ' + e.start_time : ''), `data-date="${esc(e.event_date)}"`))]);
    const msgs = state.messages.filter((m) => !m.recalled && has(m.text)).slice(-12).reverse();
    if (msgs.length) groups.push(['聊天', msgs.map((m) => row('gs-msg', m.id, m.text, nameOf(m.sender) + '・' + stamp(m.sent_at)))]);
    const todos = state.shopping.filter((t) => has(t.text, t.note)).slice(0, 12);
    if (todos.length) groups.push(['待辦', todos.map((t) => row('gs-go', 'todos', t.text, (t.done ? '已完成' : '還沒做') + (t.due ? '・' + shortDate(t.due) : '')))]);
    const posts = state.posts.filter((p) => has(p.text)).slice(0, 12);
    if (posts.length) groups.push(['我有話要說', posts.map((p) => row('gs-go', 'posts', p.text, nameOf(p.author) + '・' + stamp(p.created_at)))]);
    const polls = state.polls.filter((p) => has(p.question, ...(p.options || []))).slice(0, 8);
    if (polls.length) groups.push(['投票', polls.map((p) => row('gs-go', 'polls', p.question, pollOver(p) ? '已結束' : '進行中'))]);
    const notes = state.notes.filter((n) => has(n.title, n.body, n.text)).slice(0, 12);
    if (notes.length) groups.push(['筆記', notes.map((n) => row('gs-go', 'notes', n.title || n.text || '筆記', ''))]);
    if (!groups.length) return `<p class="hint">找不到含有「${esc(raw.trim())}」的內容。</p>`;
    return groups.map(([name, rows]) => `<section class="gs-group"><h3>${name}<span>${rows.length}</span></h3>${rows.join('')}</section>`).join('');
  }
  function searchGo(el) {
    const act = el.dataset.act, id = el.dataset.id;
    closeSheet();
    if (act === 'gs-event') {
      const e = state.upcoming.concat(state.monthEvents).find((x) => (x.series || x).id === id && x.event_date === el.dataset.date);
      if (e) openEventView(e.series || e, el.dataset.date);
    } else if (act === 'gs-msg') { goTab('chat'); setTimeout(() => gotoMessage(id), 350); }
    else if (id === 'notes') { state.notesView = 'notes'; goTab('notes'); }
    else goTab(id);
  }
  // ---------- 沒網路時先排隊，連上後自動補送 ----------
  // 每一則訊息先給一個固定的編號放進 outbox（也存在手機上），送成功才拿掉。
  // 同一個編號重送不會變成兩則：資料庫裡已經有的話，寫入會被擋下，這時確認一下真的有就當作送出了。
  const OUTBOX_KEY = 'family-outbox';
  let outbox = [];
  try { outbox = (JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []).filter((x) => x && x.id && x.text); } catch (e) { outbox = []; }
  const saveOutbox = () => { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox.map((x) => ({ id: x.id, text: x.text, extra: x.extra, at: x.at, uid: x.uid })))); } catch (e) { /* 存不了就算了 */ } };
  const newMsgId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  function dropOutbox(id) { outbox = outbox.filter((x) => x.id !== id); saveOutbox(); if (state.tab === 'chat') refreshChat(false); }
  function trySend(x) {
    if (x.sending || x.uid !== state.userId) return;
    x.sending = true; x.failed = false;
    Api.sendMessage(x.text, x.extra, x.id, x.at).then(() => dropOutbox(x.id), async (e) => {
      x.sending = false;
      console.warn('訊息還沒送出', e);
      if (/permission|already/i.test(String(e && (e.code || e.message)))) {
        const there = await Api.getDoc('messages', x.id).catch(() => null);
        if (there) return dropOutbox(x.id);
      }
      x.failed = true;
      if (state.tab === 'chat') refreshChat(false);
    });
  }
  function flushOutbox(skipFailed) { outbox.forEach((x) => { if (!x.sending && !(skipFailed && x.failed)) trySend(x); }); }
  window.addEventListener('online', () => flushOutbox());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.userId) flushOutbox(); });
  function outboxHtml() {
    const waiting = outbox.filter((x) => x.uid === state.userId && !state.messages.some((m) => m.id === x.id));
    return waiting.map((x) => `
      <div class="msg mine pending ${x.failed ? 'failed' : ''}">
        <div class="msg-row"><div class="bubble">${richText(x.text)}</div><span class="msg-meta">${x.failed
          ? `<button class="link-btn" data-act="outbox-retry" data-id="${esc(x.id)}">沒送出，再試一次</button><button class="link-btn del" data-act="outbox-drop" data-id="${esc(x.id)}">不傳了</button>`
          : `<small class="sending">${navigator.onLine === false ? '沒有網路，連上後會自動送出' : '傳送中…'}</small>`}</span></div>
      </div>`).join('');
  }
  // ---------- 備份（管理員） ----------
  const BACKUP_KEY = 'family-backup-at';
  const BACKUP_SETS = ['members', 'profiles', 'events', 'categories', 'notes', 'trips', 'trip_items', 'ledger', 'requests', 'scores', 'subjects', 'shopping', 'polls', 'poll_votes', 'posts', 'replies',
    'cards', 'contacts', 'messages', 'chat_pins', 'study_items', 'study_cheers', 'videos', 'video_limits', 'checkins', 'places', 'birthday_cards', 'photo_comments', 'settings', 'transit_favs'];
  function backupNote() {
    let at = 0;
    try { at = Number(localStorage.getItem(BACKUP_KEY)) || 0; } catch (e) { at = 0; }
    if (!at) return '這支手機還沒有備份過。建議每個月備份一次。';
    const days = Math.floor((Date.now() - at) / 86400000);
    return '上次備份：' + (days === 0 ? '今天' : days + ' 天前') + (days >= 30 ? '。已經超過一個月，建議再備份一次。' : '。');
  }
  async function exportBackup(btn) {
    if (!isAdmin() || btn.disabled) return;
    btn.disabled = true; btn.textContent = '整理資料中…';
    const data = { app: '鍾家大宅', version: VERSION, exported_at: new Date().toISOString(), collections: {}, skipped: [] };
    for (const name of BACKUP_SETS) {
      try { data.collections[name] = await Api.listDocs(name); }
      catch (e) { console.warn('備份讀不到', name, e); data.skipped.push(name); }
    }
    const count = Object.values(data.collections).reduce((n, l) => n + l.length, 0);
    const file = new File([JSON.stringify(data)], '鍾家大宅備份-' + today() + '.json', { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: file.name });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
      try { localStorage.setItem(BACKUP_KEY, String(Date.now())); } catch (e) { /* 忽略 */ }
      toast('已備份 ' + count + ' 筆資料' + (data.skipped.length ? '（' + data.skipped.length + ' 類讀不到）' : ''));
    } catch (e) { if (!e || e.name !== 'AbortError') { console.error(e); toast('備份沒有完成，請再試一次'); } }
    render();
  }

  function viewCalendar() {
    const hour = new Date().getHours(), now = parse(today());
    const hello = hour < 5 ? '夜深了' : hour < 11 ? '早安' : hour < 18 ? '午安' : '晚安';
    loadWeather();
    startParty();
    // 問候、天氣和家人狀態固定在最上面，往下滑也看得到
    return `<div class="home-top">
        <header class="hello"><div><h1>${hello}，${esc(me().display_name)}</h1><p>${now.getMonth() + 1}月${now.getDate()}日　星期${WEEKDAYS[now.getDay()]}</p></div><button class="wx" id="wx" data-act="wx-tap" aria-label="今天天氣，點一下更新或改用我的位置">${weatherHtml()}</button></header>
        <div class="home-tools"><section class="presence home-pres" id="presence" aria-label="家人上線狀態">${presenceHtml(true)}</section><button class="icon-btn gs-open" data-act="gs-open" aria-label="搜尋全部內容">${SEARCH_SVG}</button><button class="icon-btn gs-open bell ${noticeNew() ? 'has' : ''}" id="bell" data-act="notices" aria-label="通知${noticeNew() ? '，' + noticeNew() + ' 則新的' : ''}">${BELL_SVG}</button></div>
      </div>`
      + `<section class="bday" id="bday" aria-label="生日" ${bdayHtml() ? '' : 'hidden'}>${bdayHtml()}</section>`
      + homeLayout().filter((x) => x.on).map((x) => ({
        checkin: () => `<section class="checkin" id="checkin" aria-label="報平安" ${ciHtml() ? '' : 'hidden'}>${ciHtml()}</section>`,
        mine: () => `<section class="today-card mine-card" id="mine" aria-label="我的今天">${mineHtml()}</section>`,
        polls: () => `<section class="home-polls" id="home-polls" aria-label="投票" ${homePollsHtml() ? '' : 'hidden'}>${homePollsHtml()}</section>`,
        cal: () => calSwitch() + (state.calView === 'month' ? viewMonth() : viewUpcoming())
      })[x.id]()).join('');
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

    // 選到那天的行程放在上面，月曆在下面
    return `
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
      </section>

      <header class="month-head">
        <h1>${y}年${m}月</h1>
        <div class="month-nav">
          ${state.cursor !== t.slice(0, 7) || state.selected !== t ? '<button class="chip-btn" data-act="today">回到今天</button>' : ''}
          <button class="icon-btn" data-act="prev" aria-label="上個月">‹</button>
          <button class="icon-btn" data-act="next" aria-label="下個月">›</button>
        </div>
      </header>
      <div class="weekdays" aria-hidden="true">${WEEKDAYS.map((w, i) => `<span class="${i === 0 || i === 6 ? 'weekend' : ''}">${w}</span>`).join('')}</div>
      <div class="grid">${cells}</div>`;
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

  // ---------- 聊天：@某人、引用回覆 ----------
  const AT_ALL = '所有人';
  // 表情回應：message_reacts/{訊息id_UID} = { msg_id, uid, emoji, at }，每人每則一個，再按一次同一個就收回
  const MSG_REACTS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
  const reactPickHtml = (id) => {
    const my = state.msgReacts.find((r) => r.msg_id === id && r.uid === state.userId);
    return `<div class="react-pick" role="group" aria-label="表情回應">${MSG_REACTS.map((e) => `<button class="${my && my.emoji === e ? 'on' : ''}" data-act="msg-react" data-id="${esc(id)}" data-emoji="${e}" aria-pressed="${!!(my && my.emoji === e)}">${e}</button>`).join('')}</div>`;
  };
  function reactChipsHtml(id) {
    const list = state.msgReacts.filter((r) => r.msg_id === id && member(r.uid));
    if (!list.length) return '';
    const emojis = Array.from(new Set(list.map((r) => r.emoji)));
    return `<div class="react-chips">${emojis.map((e) => {
      const who = list.filter((r) => r.emoji === e);
      const mine = who.some((r) => r.uid === state.userId);
      return `<button class="${mine ? 'on' : ''}" data-act="msg-react" data-id="${esc(id)}" data-emoji="${esc(e)}" aria-label="${esc(e)}：${esc(who.map((r) => nameOf(r.uid)).join('、'))}">${esc(e)}<b>${esc(who.map((r) => nameOf(r.uid)).join('、'))}</b></button>`;
    }).join('')}</div>`;
  }
  async function toggleMsgReact(id, emoji) {
    const key = id + '_' + state.userId;
    const my = state.msgReacts.find((r) => r.msg_id === id && r.uid === state.userId);
    state.menuMsg = null;
    if ($sheet.querySelector('.viewer')) closeSheet();
    try {
      if (my && my.emoji === emoji) await Api.deleteDoc('message_reacts', my.id || key);
      else await Api.setDoc('message_reacts', key, { msg_id: id, uid: state.userId, emoji, at: Date.now() });
    } catch (e) { console.error(e); toast('沒有成功，請確認已經執行過最新的 deploy.bat'); }
    refreshChat(false);
  }
  // 訊息文字：跳脫後把 @名字 標出來（搜尋時改成標出關鍵字）
  // 訊息裡的網址（https://… 或 www.…）變成點得開的連結；結尾的標點不算在網址裡
  const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'，。、；：！？「」『』（）【】]+/gi;
  function splitUrl(raw) {
    const m = raw.match(/[.,;:!?)\]}'"]+$/);
    return m ? [raw.slice(0, -m[0].length), m[0]] : [raw, ''];
  }
  function mentionHtml(text) {
    let out = esc(text);
    if (out.indexOf('@') < 0) return out;
    state.members.map((m) => m.display_name).concat(AT_ALL).sort((a, b) => b.length - a.length).forEach((n) => {
      out = out.split('@' + esc(n)).join('<b class="at">@' + esc(n) + '</b>');
    });
    return out;
  }
  function richText(text, q) {
    if (q) return markText(text, q);
    text = String(text || '');
    let out = '', last = 0;
    text.replace(URL_RE, (raw, at) => {
      const url = splitUrl(raw)[0];
      if (!url || url.length < 5) return raw;
      const href = /^www\./i.test(url) ? 'https://' + url : url;
      out += mentionHtml(text.slice(last, at)) + `<a class="msg-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`;
      last = at + url.length;
      return raw;
    });
    return out + mentionHtml(text.slice(last));
  }
  // 複製文字：先用剪貼簿 API，不行再用舊方法
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 改用下面的方法 */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  // 這段文字 @ 了誰（不含自己）
  function mentionsIn(text) {
    const others = state.members.filter((m) => m.id !== state.userId);
    if (text.includes('@' + AT_ALL)) return others.map((m) => m.id);
    return others.filter((m) => text.includes('@' + m.display_name)).map((m) => m.id);
  }
  const quoteText = (m) => (m.recalled ? '訊息已收回' : m.image_id ? '照片' : m.audio_id ? '語音訊息' : (m.text || '').length > 60 ? m.text.slice(0, 60) + '…' : m.text || '');
  function quoteHtml(r) {
    const live = findById(state.messages, r.id);
    const text = live ? quoteText(live) : r.photo ? '照片' : r.text || '';
    return `<span class="quote" data-act="goto-msg" data-id="${esc(r.id)}" role="button" tabindex="0"><b>${esc(nameOf(r.sender))}</b><span>${esc(text)}</span></span>`;
  }
  // 輸入列上方：正在引用哪一則、@ 可以選誰
  function chatAssistHtml() {
    let html = '';
    const typing = typingNames();
    if (typing.length) html += `<div class="typing" aria-live="polite"><i></i><i></i><i></i>${esc(typing.join('、'))}正在輸入…</div>`;
    if (rec) return html + `
      <div class="rec-strip" role="group" aria-label="錄音中">
        <i class="rec-dot" aria-hidden="true"></i><b id="rec-time">${voiceLen(Date.now() - rec.at)}</b><span>錄音中，最長 60 秒</span>
        <button type="button" data-act="voice-cancel">取消</button><button type="button" class="strong" data-act="voice-send">傳送</button>
      </div>`;
    if (state.editMsg && findById(state.messages, state.editMsg)) html += `
      <div class="reply-strip edit" style="--who:var(--green)">
        <span><b>編輯訊息</b><small>改好之後按傳送</small></span>
        <button type="button" class="icon-btn" data-act="edit-cancel" aria-label="取消編輯">✕</button>
      </div>`;
    if (state.mentionQ !== null) {
      const q = state.mentionQ;
      const names = state.members.filter((m) => m.id !== state.userId).map((m) => ({ name: m.display_name, color: m.color }))
        .concat({ name: AT_ALL, color: 'var(--ink-2)' }).filter((x) => x.name.toLowerCase().startsWith(q.toLowerCase()));
      if (names.length) html += `<div class="at-pick" role="group" aria-label="要提到誰">${names.map((x) =>
        `<button type="button" data-act="pick-mention" data-name="${esc(x.name)}" style="--who:${esc(x.color)}">@${esc(x.name)}</button>`).join('')}</div>`;
    }
    const m = !state.editMsg && state.replyTo && findById(state.messages, state.replyTo);
    if (m && !m.recalled) html += `
      <div class="reply-strip" style="--who:${esc(colorOf(m.sender))}">
        <span><b>回覆 ${esc(m.sender === state.userId ? '自己' : nameOf(m.sender))}</b><small>${esc(quoteText(m))}</small></span>
        <button type="button" class="icon-btn" data-act="reply-cancel" aria-label="取消回覆">✕</button>
      </div>`;
    return html;
  }
  function drawAssist() {
    const el = document.getElementById('chat-assist');
    if (!el) return;
    const html = chatAssistHtml();
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  // 游標前面如果是「@某幾個字」，就打開選人的列
  function watchMention(input) {
    const m = /(?:^|\s)@([^\s@]{0,12})$/.exec(input.value.slice(0, input.selectionStart == null ? input.value.length : input.selectionStart));
    const q = m ? m[1] : null;
    if (q !== state.mentionQ) { state.mentionQ = q; drawAssist(); }
  }
  function pickMention(name) {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const at = input.selectionStart == null ? input.value.length : input.selectionStart;
    const head = input.value.slice(0, at).replace(/@[^\s@]*$/, '@' + name + ' ');
    input.value = head + input.value.slice(at);
    state.draft = input.value; state.mentionQ = null;
    input.focus();
    try { input.setSelectionRange(head.length, head.length); } catch (e) { /* 忽略 */ }
    drawAssist();
  }
  function startReply(id) {
    state.replyTo = id; state.menuMsg = null;
    if ($sheet.querySelector('.viewer')) closeSheet();
    refreshChat(false); drawAssist();
    const input = document.getElementById('chat-input');
    if (input) input.focus();
  }
  function gotoMessage(id) {
    const el = document.getElementById('m-' + id);
    if (!el) return toast('原本的訊息比較早，請按「看更早的訊息」');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  // ---------- 聊天：編輯、置頂、未讀線、正在輸入、連結預覽、語音 ----------
  const EDIT_MS = 15 * 60 * 1000;       // 訊息送出後多久內可以編輯
  const PIN_MAX = 3;
  const canEdit = (m) => m.sender === state.userId && !m.recalled && !!m.text && !m.checkin && !m.image_id && !m.audio_id && Date.now() - m.sent_at < EDIT_MS;
  const PIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/></svg>';
  function msgActsHtml(m) {
    const b = (act, label, cls) => `<button class="${cls || 'reply-btn'}" data-act="${act}" data-id="${esc(m.id)}">${label}</button>`;
    const pinned = state.pins.some((p) => p.id === m.id);
    return `<div class="msg-acts">${b('reply-msg', '回覆')}${m.text ? b('copy-msg', '複製') : ''}${canEdit(m) ? b('edit-msg', '編輯') : ''}${b('pin-msg', pinned ? '取消置頂' : '置頂')}`
      + `${m.text && !m.checkin ? b('msg-todo', '加到待辦') + b('msg-event', '加到行事曆') : ''}${canRecall(m) ? b('recall', '收回', 'recall') : ''}</div>`;
  }
  // 置頂：最上面固定顯示最新的一則，其他的點「還有 N 則」展開
  function pinsHtml() {
    const list = state.pins.slice().sort((a, b) => b.at - a.at);
    if (!list.length || state.chatSearch) return '';
    const shown = state.pinsOpen ? list : list.slice(0, 1);
    return `<div class="pins">${shown.map((p) => `
      <div class="pin-row">
        <button class="pin-main" data-act="goto-msg" data-id="${esc(p.id)}">${PIN_SVG}<b>${esc(nameOf(p.sender))}</b><span>${esc(p.text || '訊息')}</span></button>
        <button class="pin-x" data-act="pin-msg" data-id="${esc(p.id)}" aria-label="取消置頂">×</button>
      </div>`).join('')}${list.length > 1 ? `<button class="pin-more" data-act="pins-toggle">${state.pinsOpen ? '收起' : '還有 ' + (list.length - 1) + ' 則置頂'}</button>` : ''}</div>`;
  }
  function drawPins() { const el = document.getElementById('chat-pins'); if (el) { const h = pinsHtml(); if (el.innerHTML !== h) el.innerHTML = h; } }
  async function togglePin(id) {
    state.menuMsg = null;
    try {
      if (state.pins.some((p) => p.id === id)) { await Api.deleteDoc('chat_pins', id); toast('已取消置頂'); }
      else {
        const m = findById(state.messages, id);
        if (!m || m.recalled) return;
        if (state.pins.length >= PIN_MAX) return toast('最多置頂 ' + PIN_MAX + ' 則，請先取消一則');
        await Api.setDoc('chat_pins', id, { sender: m.sender, text: quoteText(m).slice(0, 200), by: state.userId, at: Date.now() });
        toast('已置頂');
      }
    } catch (e) { console.error(e); toast(/permission/i.test(String(e && (e.code || e.message))) ? '置頂還沒開通，需要先部署一次' : '沒有成功，請再試一次'); }
    refreshChat(false);
  }
  // 進聊天室：有沒看過的訊息，就記下「上次讀到哪」，畫一條「以下是新訊息」並捲到那裡
  function enterChat() {
    const from = Math.max(state.lastRead, (state.presence[state.userId] || {}).read_at || 0);   // 這支手機沒紀錄就用另一支手機讀到的位置
    const n = from ? state.messages.filter((m) => m.sent_at > from && m.sender !== state.userId).length : 0;
    state.unreadFrom = n ? from : null; state.unreadJump = !!n;
    if (n + 5 > state.chatShown) state.chatShown = n + 10;
    if (n) setTimeout(() => { state.unreadJump = false; }, 700);
    markRead();
    setTimeout(() => beat(true), 0);      // 進聊天室：馬上回報「正在看」（這時分頁已經切過去了）
  }
  function leaveChat() {
    state.unreadFrom = null; state.unreadJump = false; state.editMsg = null;
    pingTyping('');
    if (rec) stopVoice(false);
    stopPlaying();
    setTimeout(() => beat(document.visibilityState === 'visible'), 0);   // 離開聊天室：之後的訊息要照常通知
  }
  // 正在輸入：打字時每 3 秒回報一次；別人 6 秒內回報過就顯示
  let typingSent = 0, typingTimer = null;
  function pingTyping(value) {
    const now = Date.now();
    if (!value) { if (typingSent) { typingSent = 0; Api.typing(false).catch(() => {}); } return; }
    if (now - typingSent > 3000) { typingSent = now; Api.typing(true).catch(() => {}); }
  }
  const typingNames = () => state.members.filter((m) => m.id !== state.userId && ((state.presence[m.id] || {}).typing_at || 0) > Date.now() - 6000).map((m) => m.display_name);
  function onTypingChange() {
    drawAssist();
    clearTimeout(typingTimer);
    if (typingNames().length) typingTimer = setTimeout(onTypingChange, 6200);
  }
  function startEdit(id) {
    const m = findById(state.messages, id), input = document.getElementById('chat-input');
    if (!m || !canEdit(m) || !input) return toast('超過 15 分鐘的訊息不能編輯');
    state.editMsg = id; state.replyTo = null; state.menuMsg = null;
    input.value = m.text; state.draft = m.text;
    refreshChat(false); drawAssist();
    input.focus();
  }
  function cancelEdit() {
    state.editMsg = null; state.draft = '';
    const input = document.getElementById('chat-input');
    if (input) input.value = '';
    drawAssist();
  }
  // ---- 連結預覽 ----
  function firstUrl(text) {
    URL_RE.lastIndex = 0;
    const hit = URL_RE.exec(text || '');
    URL_RE.lastIndex = 0;
    if (!hit) return '';
    const url = splitUrl(hit[0])[0];
    return /^www\./i.test(url) ? 'https://' + url : url;
  }
  const previewKey = (url) => { const yt = parseYouTube(url); return yt ? 'yt:' + yt : url; };
  const PREVIEW_KEY = 'family-previews';
  try { state.previews = JSON.parse(localStorage.getItem(PREVIEW_KEY)) || {}; } catch (e) { state.previews = {}; }
  function savePreviews() {
    const keys = Object.keys(state.previews).filter((k) => !state.previews[k].failed).slice(-150), keep = {};
    keys.forEach((k) => { keep[k] = state.previews[k]; });
    try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(keep)); } catch (e) { /* 存不了就算了 */ }
  }
  const previewPending = new Set();
  function loadPreviews() {
    if (state.chatSearch || state.tab !== 'chat') return;
    let n = 0;
    for (const m of state.messages.slice(-state.chatShown)) {
      const url = !m.recalled && m.text ? firstUrl(m.text) : '';
      if (!url) continue;
      const key = previewKey(url);
      if (key in state.previews || previewPending.has(key)) continue;
      if (++n > 4) break;
      previewPending.add(key);
      (key.startsWith('yt:') ? Api.videoInfo(key.slice(3)) : Api.linkPreview(url))
        .then((r) => r || { ok: false }, (e) => { console.warn('連結預覽失敗', e); return { ok: false, failed: true }; })
        .then((r) => {
          previewPending.delete(key); state.previews[key] = r;
          if (!r.failed) savePreviews();
          if (state.tab === 'chat') refreshChat(false);
        });
    }
  }
  function previewHtml(m) {
    const url = !m.recalled && m.text ? firstUrl(m.text) : '';
    if (!url) return '';
    const yt = parseYouTube(url), p = state.previews[previewKey(url)];
    if (yt) {
      const have = state.videos.some((v) => v.yt_id === yt);
      return `<div class="lp yt"><img src="${esc(ytThumb(yt))}" alt="" loading="lazy" decoding="async">
        <span><b>${esc((p && p.title) || 'YouTube 影片')}</b><small>${esc((p && p.channel) || 'YouTube')}</small>
        ${have ? '<em>已在影片清單</em>' : `<button data-act="chat-add-video" data-url="${esc(url)}">${amChild() ? '跟爸媽申請想看' : '加到影片清單'}</button>`}</span></div>`;
    }
    if (!p || !p.ok) return '';
    return `<a class="lp" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><small>${esc(p.site || '')}</small><b>${esc(p.title)}</b>${p.desc ? `<span>${esc(p.desc)}</span>` : ''}</a>`;
  }
  // 從聊天室的 YouTube 連結，直接開「加影片」（小朋友是「我想看這部」）並帶入連結
  function addVideoFromChat(url) {
    state.menuMsg = null;
    openVideoSheet();
    const form = document.getElementById('video-form');
    if (form && form.elements.yt_url) { form.elements.yt_url.value = url; lookupVideo(); }
  }
  // ---- 語音訊息 ----
  // 聲音壓成很小的檔案直接存進資料庫（chat_audio），最長 60 秒；訊息裡只記編號和長度。
  const VOICE_MAX_MS = 60000;
  const MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.500" width="6" height="11" rx="3"/><path d="M5.500 11.500a6.500 6.500 0 0 0 13 0M12 18v3"/></svg>';
  const voiceLen = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + pad(s % 60); };
  let rec = null;       // { mr, stream, chunks, at, timer, send }
  async function startVoice() {
    if (rec) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('這支手機不支援錄音');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { console.warn(e); return toast('沒有麥克風權限：請到手機的設定允許這個 App 使用麥克風'); }
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    let mr;
    try { mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined); }
    catch (e) { stream.getTracks().forEach((t) => t.stop()); return toast('這支手機不支援錄音'); }
    rec = { mr, stream, chunks: [], at: Date.now(), send: false };
    mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) rec && rec.chunks.push(ev.data); };
    mr.onstop = () => finishVoice(mr.mimeType || type || 'audio/mp4');
    mr.start();
    rec.timer = setInterval(() => {
      const el = document.getElementById('rec-time'), ms = Date.now() - rec.at;
      if (el) el.textContent = voiceLen(ms);
      if (ms >= VOICE_MAX_MS) stopVoice(true);
    }, 250);
    drawAssist();
  }
  function stopVoice(send) {
    if (!rec || rec.stopping) return;
    rec.stopping = true; rec.send = send; rec.ms = Date.now() - rec.at;
    clearInterval(rec.timer);
    try { rec.mr.stop(); } catch (e) { finishVoice(''); }
  }
  async function finishVoice(type) {
    const r = rec;
    rec = null;
    if (!r) return;
    r.stream.getTracks().forEach((t) => t.stop());
    drawAssist();
    if (!r.send) return;
    if (r.ms < 700 || !r.chunks.length) return toast('錄音太短了');
    try {
      const blob = new Blob(r.chunks, { type: (type || 'audio/mp4').split(';')[0] });
      const data = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = reject; fr.readAsDataURL(blob); });
      if (!data.startsWith('data:audio/')) throw new Error('not-audio');
      if (data.length > 940000) return toast('錄音太長了，請錄短一點');
      const ms = Math.min(r.ms, VOICE_MAX_MS);
      const id = await Api.addDoc('chat_audio', { sender: state.userId, data, ms });
      voiceCache.set(id, data);
      await Api.sendMessage('', { audio_id: id, audio_ms: ms });
      scrollChat();
    } catch (e) {
      console.error(e);
      toast(/permission/i.test(String(e && (e.code || e.message))) ? '語音訊息還沒開通，需要先部署一次' : '語音沒有送出，請再試一次');
    }
  }
  // 播放：聲音點了才讀。iPhone 要在按下去的當下就開始播放才不會被擋，所以先播一小段無聲的，讀到之後再換成真的。
  const voiceCache = new Map();
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  let playing = null;   // { id, audio }
  function stopPlaying() {
    if (!playing) return;
    try { playing.audio.pause(); } catch (e) { /* 沒關係 */ }
    playing = null;
  }
  async function playVoice(id) {
    const was = playing && playing.id;
    stopPlaying();
    if (was === id) return refreshChat(false);
    const m = findById(state.messages, id);
    if (!m || !m.audio_id) return;
    const audio = new Audio();
    playing = { id, audio };
    audio.onended = () => { if (playing && playing.audio === audio) { playing = null; refreshChat(false); } };
    audio.src = SILENT; audio.play().catch(() => {});
    refreshChat(false);
    try {
      let data = voiceCache.get(m.audio_id);
      if (!data) { const doc = await Api.getDoc('chat_audio', m.audio_id); data = doc && doc.data; }
      if (!data || !String(data).startsWith('data:audio/')) throw new Error('no-audio');
      voiceCache.set(m.audio_id, data);
      if (!playing || playing.audio !== audio) return;
      audio.src = data;
      await audio.play();
    } catch (e) {
      console.error(e);
      if (playing && playing.audio === audio) { playing = null; refreshChat(false); }
      toast('語音播放失敗');
    }
  }
  function voiceBubble(m) {
    const on = playing && playing.id === m.id;
    return `<button class="bubble voice ${on ? 'on' : ''}" data-act="play-voice" data-id="${esc(m.id)}" aria-label="語音訊息 ${Math.round((m.audio_ms || 0) / 1000)} 秒，${on ? '點一下停止' : '點一下播放'}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${on ? '<rect x="7" y="7" width="10" height="10" rx="1.500"/>' : '<path d="M8 5.500v13l10.500-6.500z"/>'}</svg>
      <i class="wave" aria-hidden="true"></i><b>${voiceLen(m.audio_ms || 0)}</b></button>`;
  }
  // 訊息 → 待辦、行事曆
  async function msgToTodo(id) {
    const m = findById(state.messages, id);
    state.menuMsg = null; refreshChat(false);
    if (!m || !m.text) return;
    const text = m.text.replace(/\s+/g, ' ').trim();
    try {
      await Api.addDoc('shopping', { text: text.slice(0, 60), note: text.length > 60 ? text.slice(0, 300) : '', done: false, who: '', due: '', repeat: '', star: false, added_by: state.userId, done_by: null, done_at: null, created_at: Date.now() });
      toast('已加到待辦');
    } catch (e) { console.error(e); toast('沒有加進去，請再試一次'); }
  }
  function msgToEvent(id) {
    const m = findById(state.messages, id);
    state.menuMsg = null; refreshChat(false);
    if (!m || !m.text) return;
    openEventSheet(null, null, { ai_text: m.text.replace(/\s+/g, ' ').trim().slice(0, 300) });
    setTimeout(aiFillEvent, 60);      // 用 AI 把這句話變成日期、時間、名稱，使用者確認後才儲存
  }
  // 免打擾時段（設定頁）
  const quietSet = () => state.quiet || { on: false, start: '22:00', end: '07:00' };
  function openQuietSheet() {
    const q = quietSet();
    showSheet('quiet-form', {
      title: '聊天免打擾', submit: '儲存',
      body: `
      <label class="switch"><span>開啟免打擾</span><input type="checkbox" name="on" ${q.on ? 'checked' : ''}></label>
      <label>開始時間<input type="time" name="start" value="${esc(q.start)}"></label>
      <label>結束時間<input type="time" name="end" value="${esc(q.end)}"></label>
      <p class="hint">這段時間裡，小朋友的手機不會跳聊天通知；打開 App 還是看得到訊息。報平安、行程提醒、爸媽的手機不受影響。</p>`
    });
  }

  function chatListHtml() {
    const q = state.chatSearch ? state.chatQuery.trim() : '';
    if (state.chatSearch && !q) return '<div class="empty big"><p>輸入關鍵字，搜尋最近 300 則訊息。</p></div>';
    const list = q
      ? state.messages.filter((m) => !m.recalled && (m.text || '').toLowerCase().includes(q.toLowerCase()))
      : state.messages;
    if (q && !list.length) return '<div class="empty big"><p>找不到含有「' + esc(q) + '」的訊息。</p></div>';
    if (!list.length && !outbox.length) return '<div class="empty big"><p>還沒有訊息。說聲嗨吧。</p></div>';

    // 平常只畫最新的幾十則（畫得快，新訊息一來馬上出現）；要看更早的再往上展開
    const shown = q ? list : list.slice(-state.chatShown);
    let html = q ? `<p class="found">找到 ${list.length} 則</p>`
      : shown.length < list.length ? '<button class="link-btn chat-older" data-act="chat-older">看更早的訊息</button>' : '';
    const pos = readPositions();
    let lastDay = '', lastSender = '', newLine = false;
    shown.forEach((m) => {
      const day = ymd(new Date(m.sent_at));
      if (day !== lastDay) {
        const n = daysBetween(day, today());
        html += `<div class="chat-day">${n === 0 ? '今天' : n === 1 ? '昨天' : shortDate(day)}</div>`;
        lastDay = day; lastSender = '';
      }
      const mine = m.sender === state.userId;
      if (!q && state.unreadFrom && !newLine && !mine && m.sent_at > state.unreadFrom) {
        html += '<div class="chat-new" id="chat-new"><span>以下是新訊息</span></div>';
        newLine = true; lastSender = '';
      }
      const showName = !mine && (q || m.sender !== lastSender);
      let bubble;
      const thumb = m.thumb && String(m.thumb).startsWith('data:image/') ? m.thumb : '';
      if (!m.recalled && thumb) bubble = `<button class="bubble photo" data-act="view-image" data-id="${esc(m.id)}" aria-label="照片，點一下放大"><img src="${esc(thumb)}" alt="照片"></button>`;
      else if (!m.recalled && m.audio_id) bubble = voiceBubble(m);
      else if (!m.recalled && m.call_log && !q) bubble = callLogBubble(m);
      else if (m.recalled) bubble = `<div class="bubble recalled">${mine ? '你' : esc(nameOf(m.sender))}收回了訊息</div>`;
      else if (!q) bubble = `<div class="bubble" role="button" tabindex="0" data-act="msg-menu" data-id="${esc(m.id)}">${m.reply_to && m.reply_to.id ? quoteHtml(m.reply_to) : ''}${richText(m.text)}</div>`;
      else bubble = `<div class="bubble">${markText(m.text, q)}</div>`;
      const atMe = !mine && !m.recalled && ((m.mentions || []).includes(state.userId) || (m.reply_to && m.reply_to.sender === state.userId));
      html += `
        <div class="msg ${mine ? 'mine' : ''} ${atMe ? 'at-me' : ''} ${state.editMsg === m.id ? 'editing' : ''}" id="m-${esc(m.id)}" style="--who:${esc(colorOf(m.sender))}">
          ${showName ? `<div class="msg-name">${esc(nameOf(m.sender))}</div>` : ''}
          <div class="msg-row">${bubble}<span class="msg-meta">${state.pins.some((p) => p.id === m.id) ? `<i class="pinned-mark" role="img" aria-label="已置頂">${PIN_SVG}</i>` : ''}<time>${clock(m.sent_at)}</time>${m.edited_at && !m.recalled ? '<small class="edited">已編輯</small>' : ''}${m.recalled ? '' : outbox.some((x) => x.id === m.id) ? '<small class="sending">傳送中…</small>' : readersHtml(m, pos)}</span></div>
          ${q ? '' : previewHtml(m)}
          ${m.recalled ? '' : reactChipsHtml(m.id)}
          ${state.menuMsg === m.id && !m.recalled && !q ? reactPickHtml(m.id) + msgActsHtml(m) : ''}
        </div>`;
      lastSender = m.sender;
    });
    return html + (q ? '' : outboxHtml());
  }

  function viewChat() {
    // 標題、視訊、搜尋固定在最上面，訊息再多往上捲也不會不見
    return `
      <div class="chat-top">
      <header class="plain-head with-action">
        <h1>聊天</h1><div class="presence chat-pres" id="chat-presence" aria-label="家人上線狀態">${presenceHtml(true)}</div>
        <button class="icon-btn call-start-btn" data-act="call-pick" aria-label="打電話（語音或視訊）">${PHONE_SVG}</button>
        <button class="icon-btn ${state.chatSearch ? 'on' : ''}" data-act="chat-search" aria-label="${state.chatSearch ? '關閉搜尋' : '搜尋訊息'}" aria-pressed="${state.chatSearch}">${ICON.search}</button>
      </header>
      <div id="call-banner">${callBannerHtml()}</div>
      <div id="chat-pins">${pinsHtml()}</div>
      ${state.chatSearch ? `<input id="chat-q" class="search" type="search" placeholder="搜尋訊息" value="${esc(state.chatQuery)}" autocomplete="off" aria-label="搜尋訊息">` : ''}
      </div>
      <div class="chat" id="chat-list" aria-live="polite">${chatDrawn = chatListHtml()}</div>`;
  }

  // 捲到最新一則。畫面高度可能還在變（鍵盤彈出、新訊息剛畫上去），所以隔一下再補捲兩次。
  function scrollChat() {
    const go = () => {
      const s = scroller();
      if (!s || state.tab !== 'chat' || state.chatSearch) return;
      // 有沒看過的訊息：停在「以下是新訊息」那條線（留出上方固定列的高度），否則到最底
      const mark = state.unreadJump && document.getElementById('chat-new'), top = document.querySelector('.chat-top');
      if (mark) s.scrollTop += mark.getBoundingClientRect().top - (top ? top.getBoundingClientRect().bottom : s.getBoundingClientRect().top) - 8;
      else s.scrollTop = s.scrollHeight;
    };
    go(); requestAnimationFrame(go); setTimeout(go, 150); setTimeout(go, 400);
  }

  function refreshChat(toBottom) {
    const el = document.getElementById('chat-list');
    if (!el) return;
    // 內容沒變就不重畫（別人上線、下線也會觸發這裡，重畫會讓畫面頓一下）
    const html = chatListHtml();
    if (html !== chatDrawn || !el.firstChild) { el.innerHTML = html; chatDrawn = html; }
    if (toBottom) scrollChat();
    loadPreviews();
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
    return `<span class="readers" aria-label="已讀：${esc(who.map((x) => x.display_name).join('、'))}">已讀${who.map((x) => `<span class="avatar xs" style="background:${esc(x.color)}" title="${esc(x.display_name)}">${esc(faceOf(x))}</span>`).join('')}</span>`;
  }

  function onMessages(list) {
    const grew = list.length !== state.messages.length
      || (list.length && state.messages.length && list[list.length - 1].id !== state.messages[state.messages.length - 1].id);
    state.messages = list;
    if (outbox.length) flushOutbox(true);     // 上次沒送完的（例如沒網路時關掉 App）：資料一連上就補送
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
    typingSent = 0; Api.typing(false).catch(() => {});
    if (state.editMsg) {
      const id = state.editMsg, old = findById(state.messages, id);
      state.editMsg = null; input.value = ''; state.draft = ''; state.mentionQ = null; drawAssist();
      input.focus();
      if (!old || old.text === text) return;
      try { await Api.editMessage(id, text, mentionsIn(text)); toast('已修改'); }
      catch (e) { console.error(e); state.draft = text; input.value = text; toast('沒有改成功：超過 15 分鐘的訊息不能編輯'); }
      return;
    }
    state.unreadFrom = null;
    input.value = ''; state.draft = '';
    input.focus();
    scrollChat();
    const extra = {};
    const mentions = mentionsIn(text);
    if (mentions.length) extra.mentions = mentions;
    const quoted = state.replyTo && findById(state.messages, state.replyTo);
    if (quoted && !quoted.recalled) extra.reply_to = { id: quoted.id, sender: quoted.sender, text: quoted.image_id ? '' : quoteText(quoted), photo: !!quoted.image_id };
    state.replyTo = null; state.mentionQ = null; drawAssist();
    // 先放進待送清單（畫面上馬上看得到），沒網路也不會不見，連上後自動送出
    const item = { id: newMsgId(), text, extra, at: Date.now(), uid: state.userId };
    outbox.push(item); saveOutbox();
    refreshChat(true);
    trySend(item);
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
        ${reactPickHtml(m.id)}
        <div class="viewer-bar">
          <span>${esc(nameOf(m.sender))}　${stamp(m.sent_at)}</span>
          <button class="reply-btn" data-act="reply-msg" data-id="${esc(m.id)}">回覆</button>
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
    const imageId = msg && msg.image_id, audioId = msg && msg.audio_id;
    if ($sheet.querySelector('.viewer')) closeSheet();
    if (playing && playing.id === id) stopPlaying();
    if (state.editMsg === id) cancelEdit();
    try {
      await Api.recallMessage(id, !!imageId, !!audioId);
      if (imageId) Api.deleteDoc('chat_images', imageId).catch((e) => console.warn(e));
      if (audioId) Api.deleteDoc('chat_audio', audioId).catch((e) => console.warn(e));
      if (state.pins.some((p) => p.id === id)) Api.deleteDoc('chat_pins', id).catch((e) => console.warn(e));
      toast('已收回');
    }
    catch (e) {
      console.error(e);
      refreshChat(false);
      toast('收回失敗：超過一小時的訊息不能收回');
    }
  }

  // ---------- 我有話要說 ----------
  // 標註了人：只有發話的人和被標註的人看得到、被標註的人可以回覆。沒標註任何人：全家都看得到、都可以回覆。
  const isPublicPost = (p) => p.public === true || !p.to || p.to.length === 0;
  const canReply = (p) => (isPublicPost(p) ? true : p.to.includes(state.userId));
  // 回覆只讀看得到的那幾則發話底下的（安全規則是一則一則檢查的）
  const replyWatch = new Map();
  function syncReplyWatchers() {
    const ids = new Set(state.posts.map((p) => p.id));
    replyWatch.forEach((w, id) => { if (!ids.has(id)) { w.off(); replyWatch.delete(id); } });
    ids.forEach((id) => {
      if (replyWatch.has(id)) return;
      const w = { list: [], off: () => {} };
      replyWatch.set(id, w);
      w.off = Api.watchWhere('replies', 'post_id', id, (list) => {
        w.list = list;
        state.replies = Array.from(replyWatch.values()).flatMap((x) => x.list);
        refreshPosts();
      });
    });
    state.replies = state.replies.filter((r) => ids.has(r.post_id));
  }
  function postListHtml() {
    if (!state.posts.length) return `
      <div class="empty big">
        <p>還沒有人發話。有事要某個人回答時，從這裡說。</p>
      </div>`;
    return state.posts.slice().sort((a, b) => b.created_at - a.created_at).map((p) => {
      const mine = p.author === state.userId;
      const tagged = p.to.includes(state.userId);
      const needsMe = tagged && !repliedBy(p, state.userId);
      const replies = state.replies.filter((r) => r.post_id === p.id).sort((a, b) => a.created_at - b.created_at);
      const open = isPublicPost(p);
      const author = member(p.author);
      return `
        <article class="post ${needsMe ? 'needs' : ''}">
          <header>
            ${author ? avatarHtml(author, 'sm') : ''}
            <b>${esc(nameOf(p.author))}</b>
            <time>${stamp(p.created_at)}${p.edited_at ? '<small class="edited">・已編輯</small>' : ''}</time>
            ${needsMe ? '<span class="flag">等你回覆</span>' : ''}
          </header>
          <p class="post-text">${esc(p.text)}</p>
          <div class="post-to">${open ? '<span class="who all">全家都看得到</span>' : `給
            ${p.to.map((id) => `<span class="who ${repliedBy(p, id) ? 'done' : ''}" style="--who:${esc(colorOf(id))}">${esc(nameOf(id))}${repliedBy(p, id) ? ' ✓' : ''}</span>`).join('')}
            <small class="only">只有你們看得到</small>`}
          </div>
          ${replies.map((r) => `
            <div class="reply" style="--who:${esc(colorOf(r.author))}">
              <b>${esc(nameOf(r.author))}</b><span>${esc(r.text)}</span><time>${stamp(r.created_at)}${r.edited_at ? '・已編輯' : ''}</time>
              ${r.author === state.userId ? `<button class="link-btn reply-edit" data-act="edit-reply" data-id="${esc(r.id)}">編輯</button>` : ''}
            </div>`).join('')}
          ${canReply(p) ? `
            <form class="reply-form" data-post="${esc(p.id)}">
              <input id="reply-${esc(p.id)}" name="text" type="text" placeholder="${mine ? '補充或回覆' : '回覆' + esc(nameOf(p.author))}" value="${esc(state.postDrafts[p.id] || '')}" maxlength="2000" autocomplete="off" enterkeyhint="send" aria-label="回覆">
              <button type="submit" class="send sm" aria-label="送出回覆">${ICON.send}</button>
            </form>` : ''}
          ${mine ? `<div class="post-acts"><button class="link-btn" data-act="edit-post" data-id="${esc(p.id)}">編輯</button><button class="link-btn del" data-act="del-post" data-id="${esc(p.id)}">刪除</button></div>` : ''}
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
      <header class="plain-head"><h1>我有話要說</h1><p>有標註：只有被標註的人看得到；沒標註：全家都看得到</p></header>
      <div id="post-list">${postListHtml()}</div>`;
  }

  // ---------- 投票 ----------
  // 全家都投完之後：最後一次改票（或加選項）滿 1 小時，伺服器會自動結束（每 5 分鐘檢查一次）
  const ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/></svg>';
  function pollQuietText(p, votes) {
    const last = Math.max(p.options_at || 0, ...votes.map((v) => v.voted_at || 0));
    const left = Math.ceil((last + 3600000 - Date.now()) / 60000);
    return !last ? '1 小時內沒有人改票就會自動結束。' : left > 0 ? `再 ${left} 分鐘沒有人改票，就會自動結束。` : '很快就會自動結束。';
  }
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
                <span class="opt-text">${esc(opt)}${(p.option_by || {})[i] && (p.option_by || {})[i] !== p.author ? `<small class="opt-by">${esc(nameOf(p.option_by[i]))}加的</small>` : ''}</span>
                <span class="opt-count">${who.length} 票</span>
                <span class="opt-who">${who.map((v) => `<span class="who" style="--who:${esc(colorOf(v.uid))}">${esc(nameOf(v.uid))}</span>`).join('')}</span>
              </button>`;
            }).join('')}
            ${p.options.length ? '' : `<p class="none">還沒有選項。${over ? '' : '大家可以在下面加。'}</p>`}
          </div>
          ${!over && !home && p.open_options && p.options.length < POLL_MAX ? `
          <form class="opt-add" data-poll="${esc(p.id)}">
            <input name="text" type="text" placeholder="我想加一個選項" value="${esc(state.optDrafts[p.id] || '')}" maxlength="30" autocomplete="off" enterkeyhint="done" aria-label="新增選項">
            <button type="submit" class="opt-add-btn">加入</button>
          </form>` : ''}
          ${!over && home && p.open_options ? '<p class="pick-hint">可以到「投票」加自己的選項</p>' : ''}
          <p class="poll-foot">${due ? `<b>${due}</b>　` : ''}${votes.length} / ${state.members.length} 人已投${waiting.length && !over ? '　還沒投：' + esc(waiting.map((m) => m.display_name).join('、')) : ''}</p>
          ${!over && !waiting.length && p.options.length ? `<p class="poll-auto">${ICON_CLOCK}全家都投完了。${pollQuietText(p, votes)}</p>` : ''}
          ${over && p.auto_closed ? '<p class="poll-auto">全家都投完、1 小時沒有人改票，自動結束。</p>' : ''}
          ${over || !p.options.length ? '' : `<button class="btn ghost small vote-btn" data-act="poll-edit" data-id="${esc(p.id)}">${editing ? '取消' : mine ? '修改我的票' : '我要投票'}</button>`}
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
    // 預設全部合起來，一則一列只顯示標題和狀態；點一列展開那一則（同時只展開一則），再點一次合起來
    const needsMe = (p) => !pollOver(p) && !state.votes.some((v) => v.poll_id === p.id && v.uid === state.userId);
    if (state.homePollId && !list.some((p) => p.id === state.homePollId)) state.homePollId = null;
    const row = (p) => {
      const open = p.id === state.homePollId, over = pollOver(p);
      const n = state.votes.filter((v) => v.poll_id === p.id && member(v.uid)).length;
      const flag = over ? '<em class="hp-flag done">已結束</em>' : needsMe(p) ? '<em class="hp-flag">等你投票</em>' : '<em class="hp-flag ok">已投</em>';
      return `<div class="hp-item ${open ? 'open' : ''}">
        <button class="hp-row" data-act="home-poll" data-id="${esc(p.id)}" aria-expanded="${open}">
          <svg class="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>
          <b>${esc(p.question)}</b>${flag}<small>${n}/${state.members.length}</small>
          <svg class="hp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        ${open ? pollCardHtml(p, true) : ''}
      </div>`;
    };
    return `<h2>投票<button class="link-btn" data-act="open-polls">看全部</button></h2><div class="hp-list">${list.map(row).join('')}</div>`;
  }

  const POLL_MAX = 12;   // 一個投票最多幾個選項
  // 投票進行中，大家都可以加選項（發起時打開「大家可以加選項」才行）。只能加在最後面，原本的選項和票都不會動。
  async function onAddOption(form) {
    const p = findById(state.polls, form.dataset.poll), input = form.elements.text;
    const text = input.value.trim();
    if (!p || !text) return;
    if (p.options.some((o) => o === text)) return toast('已經有這個選項了');
    if (p.options.length >= POLL_MAX) return toast('選項最多 ' + POLL_MAX + ' 個');
    input.value = ''; delete state.optDrafts[p.id];
    try {
      // 先讀最新的投票：別人剛好也加了選項時，接在最新的後面，不會因為清單不一樣被擋下
      const fresh = (await Api.getDoc('polls', p.id)) || p;
      const opts = Array.isArray(fresh.options) ? fresh.options : [];
      if (opts.includes(text)) { toast('已經有這個選項了'); refreshPolls(); return; }
      if (opts.length >= POLL_MAX) { toast('選項最多 ' + POLL_MAX + ' 個'); return; }
      await Api.updateDoc('polls', p.id, { options: opts.concat(text), option_by: { ...(fresh.option_by || {}), [String(opts.length)]: state.userId }, options_at: Date.now() });
      toast('已加入選項');
    } catch (e) {
      console.error('加選項失敗', e); state.optDrafts[p.id] = text; input.value = text;
      const code = String((e && (e.code || e.message)) || '');
      toast(pollOver(p) ? '投票已經結束，不能再加選項'
        : /permission/i.test(code) ? (isAdmin() ? '被資料庫規則擋下來：請用最新的 family-app.zip 執行一次 deploy.bat' : '沒有加進去，請跟管理員說要重新部署')
        : '沒有加進去，請確認網路後再試一次' + (isAdmin() && code ? '（' + code.slice(0, 40) + '）' : ''));
    }
    if (document.activeElement) document.activeElement.blur();
    refreshPolls();
  }
  let pollsDirty = false;
  document.addEventListener('focusout', (ev) => { if (pollsDirty && ev.target.closest && ev.target.closest('.opt-add')) setTimeout(refreshPolls, 0); });
  function refreshPolls() {
    // 正在打新選項時先不重畫（會打斷中文輸入法），離開輸入框再畫
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('.opt-add');
    if (typing) { pollsDirty = true; return; }
    pollsDirty = false;
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
      toast('已投票'); celebrate();
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
      <label>選項（一行一個，最多 ${POLL_MAX} 個）<textarea name="options" rows="5" maxlength="400" placeholder="選項一&#10;選項二"></textarea></label>
      <label class="switch">
        <span>大家可以加選項</span>
        <input type="checkbox" name="open_options" checked>
      </label>
      <p class="hint">打開的話，選項可以先不寫或只寫幾個，投票結束前每個人都能再加自己的選項。</p>
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
      <header class="plain-head with-action"><h1>成績</h1><p>${amChild() ? '只有你和爸媽看得到' : esc(kid.display_name) + '的紀錄'}</p>${amChild() ? '' : '<button class="ai-btn" data-act="ai-scores">AI 分析</button>'}</header>
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
  // 行程的快速連結：地圖、路線、店家、網頁。都是用地點名稱去 Google 搜尋，不是 AI 給的網址。
  const mapUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const dirUrl = (from, to) => 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(from) + '&destination=' + encodeURIComponent(to) + '&travelmode=transit';
  const webUrl = (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q);
  const shopList = (x) => (Array.isArray(x.shops) ? x.shops : []).filter(Boolean);
  function planLinksHtml(x, prev, t) {
    const near = (name) => (t.place && !name.includes(t.place) ? name + ' ' + t.place : name);
    const link = (cls, href, label) => `<a class="plan-link ${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
    let html = '';
    if (x.place) html += link('map', mapUrl(near(x.place)), '地圖');
    if (x.place && prev && prev.place) html += link('dir', dirUrl(near(prev.place), near(x.place)), '路線');
    shopList(x).forEach((n) => { html += link('shop', mapUrl(near(n)), n); });
    if (x.place) html += link('web', webUrl(near(x.place)), '查網頁');
    return html ? `<div class="plan-links">${html}</div>` : '';
  }
  // 行程的種類（cat）、停留時間（minutes）、預估花費（cost）、預約（booking：need 要預約｜done 已預約）、去過了（visited）
  const PLAN_CATS = [['sight', '🏯', '景點'], ['food', '🍜', '美食'], ['play', '🎡', '體驗'], ['shop', '🛍️', '購物'], ['move', '🚆', '交通'], ['stay', '🏨', '住宿']];
  const planCat = (id) => PLAN_CATS.find((c) => c[0] === id);
  const stayText = (min) => (min >= 60 ? (min % 60 ? Math.floor(min / 60) + ' 小時 ' + (min % 60) + ' 分' : min / 60 + ' 小時') : min + ' 分鐘');
  function planRowHtml(x, prev, t, mark) {
    const cat = planCat(x.cat);
    const meta = [
      x.minutes ? '停留 ' + stayText(x.minutes) : '',
      x.cost ? '約 ' + Number(x.cost).toLocaleString('en-US') + ' 元' : '',
      x.booking === 'need' ? '<em class="need">要預約</em>' : x.booking === 'done' ? '<em class="ok">已預約 ✓</em>' : ''
    ].filter(Boolean).join('<i>・</i>');
    const canVisit = x.date <= today();
    return `
            <div class="plan-item ${x.visited ? 'visited' : ''} ${mark || ''}">
            <button class="plan" data-act="edit-plan" data-id="${esc(x.id)}">
              <span class="plan-time">${esc(x.time || '')}${cat ? `<span class="plan-cat" aria-label="${cat[2]}">${cat[1]}</span>` : ''}</span>
              <span class="plan-main">
                ${mark ? `<span class="plan-now">${mark === 'now' ? '現在' : '下一站'}</span>` : ''}
                <span class="plan-title">${esc(x.title)}${x.visited ? '<span class="plan-done" aria-label="去過了">✓</span>' : ''}</span>
                ${x.place ? `<span class="plan-place">${esc(x.place)}</span>` : ''}
                ${meta ? `<span class="plan-meta">${meta}</span>` : ''}
                ${x.transport ? `<span class="plan-move">${esc(x.transport)}</span>` : ''}
                ${x.note ? `<span class="plan-note">${esc(x.note)}</span>` : ''}
              </span>
            </button>
            ${planLinksHtml(x, prev, t).replace(/<\/div>$/, '') || '<div class="plan-links">'}
              ${canVisit ? `<button class="plan-link visit ${x.visited ? 'on' : ''}" data-act="plan-visit" data-id="${esc(x.id)}" aria-pressed="${!!x.visited}">${x.visited ? '去過了 ✓' : '打卡：去過了'}</button>` : ''}
            </div>
            </div>`;
  }

  function tripPlanHtml(t) {
    const items = itemsOf(t.id, 'plan');
    const themes = t.day_themes || {};
    const nowTime = clock(Date.now());
    let html = '';
    for (let d = t.start_date, i = 1; d <= t.end_date; d = addDays(d, 1), i++) {
      const rows = items.filter((x) => x.date === d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      // 旅行當天：標出現在在哪一項、下一站是哪一項
      let nowAt = -1;
      if (d === today()) rows.forEach((x, n) => { if (x.time && x.time <= nowTime) nowAt = n; });
      const nextAt = d === today() ? rows.findIndex((x, n) => n > nowAt && x.time) : -1;
      const timed = rows.filter((x) => x.time);
      const cost = rows.reduce((n, x) => n + (Number(x.cost) || 0), 0);
      const visited = rows.filter((x) => x.visited).length;
      const places = rows.filter((x) => x.place).map((x) => (t.place && !x.place.includes(t.place) ? x.place + ' ' + t.place : x.place));
      const dayMap = places.length >= 2 ? 'https://www.google.com/maps/dir/' + places.slice(0, 10).map(encodeURIComponent).join('/') : '';
      const sum = [
        rows.length ? rows.length + ' 項' : '',
        timed.length > 1 ? timed[0].time + '–' + timed[timed.length - 1].time : '',
        cost ? '預估 ' + cost.toLocaleString('en-US') + ' 元' : '',
        visited ? '去過 ' + visited + '／' + rows.length : ''
      ].filter(Boolean).join('・');
      html += `
        <section class="plan-day ${d === today() ? 'today' : ''}">
          <h2><b>第 ${i} 天</b>${shortDate(d)}<button class="link-btn" data-act="new-plan" data-date="${d}">＋ 加行程</button></h2>
          <div class="plan-dayinfo">
            <button class="plan-theme ${themes[d] ? '' : 'empty'}" data-act="day-theme" data-date="${d}">${themes[d] ? esc(themes[d]) : '＋ 這天的主題'}</button>
            ${sum ? `<span>${sum}</span>` : ''}
            ${dayMap ? `<a class="plan-link map" href="${esc(dayMap)}" target="_blank" rel="noopener">整天路線圖</a>` : ''}
          </div>
          ${rows.length ? rows.map((x, n) => planRowHtml(x, rows[n - 1], t, n === nowAt ? 'now' : n === nextAt ? 'next' : '')).join('') : '<p class="none">這天還沒有安排。</p>'}
        </section>`;
    }
    const total = items.reduce((n, x) => n + (Number(x.cost) || 0), 0);
    const need = items.filter((x) => x.booking === 'need').length;
    html = `<div class="plan-top">${t.end_date >= today() ? '<button class="ai-btn" data-act="ai-trip">請 AI 排行程草稿</button>' : ''}${items.length ? `<span>共 ${items.length} 項${total ? '・預估 ' + total.toLocaleString('en-US') + ' 元' : ''}${need ? `・<em class="need">${need} 項要預約</em>` : ''}</span>` : ''}</div>` + html;
    const stray = items.filter((x) => x.date < t.start_date || x.date > t.end_date);
    if (stray.length) html += `
        <section class="plan-day">
          <h2><b>不在旅程日期內</b></h2>
          ${stray.map((x) => `<button class="plan" data-act="edit-plan" data-id="${esc(x.id)}"><span class="plan-time">${shortDate(x.date).replace(/（.*/, '')}</span><span class="plan-main"><span class="plan-title">${esc(x.title)}</span></span></button>`).join('')}
        </section>`;
    return html;
  }
  function openDayThemeSheet(date) {
    const t = tripOf(state.tripId);
    if (!t) return;
    showSheet('day-form', {
      title: shortDate(date) + '的主題', focus: true,
      body: `
      <input type="hidden" name="date" value="${esc(date)}">
      <input class="title-input" name="theme" placeholder="例如：犬山城下町散步" value="${esc((t.day_themes || {})[date] || '')}" maxlength="30" autocomplete="off">
      <p class="hint">一句話說這天的重點，會顯示在這一天的最上面。清空再儲存就是不要主題。</p>`
    });
  }

  // 日誌：照日期排，每則有作者、文字、可以附一張照片
  // 日誌：照日期一天一段。每則有作者、心情、天氣、地點、文字、一張照片；家人可以按表情回應。
  //   表情回應 journal_reacts/{日誌id_UID} = { item_id, trip_id, uid, emoji, at }，每人每則一個
  const MOODS = [['😆', '開心'], ['😋', '好吃'], ['😍', '好美'], ['🤣', '好笑'], ['😮', '驚訝'], ['😴', '好累'], ['🥲', '可惜']];
  const WEATHERS = [['☀️', '晴天'], ['⛅', '多雲'], ['☁️', '陰天'], ['🌧️', '下雨'], ['❄️', '下雪'], ['💨', '風大']];
  const REACTS = ['❤️', '😂', '👍', '😮'];
  const JR_PROMPTS = ['今天最好吃的是', '最好笑的一件事', '最漂亮的地方', '沒想到會', '明天最期待'];
  const labelOf = (list, e) => (list.find((x) => x[0] === e) || [])[1] || '';
  function tripJournalHtml(t) {
    const items = itemsOf(t.id, 'journal').sort((a, b) => a.date.localeCompare(b.date) || a.created_at - b.created_at);
    if (!items.length) return `
      <div class="empty big"><p>還沒有日誌。今天去了哪、吃了什麼、最好笑的事，寫下來，再放一張照片。</p>
</div>`;
    // 上方的小統計：幾則、幾張照片、誰寫最多
    const count = {};
    items.forEach((j) => { count[j.author] = (count[j.author] || 0) + 1; });
    const top = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    const photos = items.filter((j) => j.thumb).length;
    const days = new Set(items.map((j) => j.date)).size;
    let html = `<p class="jr-stats">${days} 天・${items.length} 則日誌${photos ? '・' + photos + ' 張照片' : ''}${Object.keys(count).length > 1 ? '・寫最多的是' + esc(nameOf(top)) : ''}</p>`;
    let lastDay = '';
    items.forEach((j) => {
      if (j.date !== lastDay) {
        lastDay = j.date;
        const inTrip = j.date >= t.start_date && j.date <= t.end_date;
        const sky = Array.from(new Set(items.filter((x) => x.date === j.date && x.weather).map((x) => x.weather)));
        html += `<h2 class="jr-day">${inTrip ? `<b>第 ${daysBetween(t.start_date, j.date) + 1} 天</b>` : ''}${shortDate(j.date)}${sky.length ? `<span aria-label="天氣：${esc(sky.map((w) => labelOf(WEATHERS, w)).join('、'))}">${sky.map(esc).join(' ')}</span>` : ''}</h2>`;
      }
      const who = member(j.author);
      const mine = j.author === state.userId;
      const inner = `
          <header>${who ? avatarHtml(who, 'sm') : ''}<b>${esc(nameOf(j.author))}</b>${j.mood ? `<span class="jr-mood">${esc(j.mood)} ${esc(labelOf(MOODS, j.mood))}</span>` : ''}</header>
          ${j.text ? `<p class="post-text">${esc(j.text)}</p>` : ''}`;
      const reacts = state.journalReacts.filter((r) => r.item_id === j.id);
      const my = reacts.find((r) => r.uid === state.userId);
      html += `
        <article class="post journal" style="--who:${esc(colorOf(j.author))}">
          ${mine ? `<button class="journal-main" data-act="edit-journal" data-id="${esc(j.id)}">${inner}</button>` : `<div class="journal-main">${inner}</div>`}
          ${j.thumb ? `<button class="journal-photo" data-act="trip-photo" data-id="${esc(j.id)}" aria-label="照片，點一下放大"><img src="${esc(j.thumb)}" alt="照片"></button>` : ''}
          ${j.place ? `<div class="jr-place"><a class="plan-link map" href="${esc(mapUrl(t.place && !j.place.includes(t.place) ? j.place + ' ' + t.place : j.place))}" target="_blank" rel="noopener">📍 ${esc(j.place)}</a></div>` : ''}
          <div class="jr-reacts" role="group" aria-label="表情回應">
            ${REACTS.map((e) => {
              const who2 = reacts.filter((r) => r.emoji === e);
              return `<button class="${my && my.emoji === e ? 'on' : ''}" data-act="jr-react" data-id="${esc(j.id)}" data-emoji="${e}" aria-pressed="${!!(my && my.emoji === e)}" aria-label="${e}${who2.length ? '：' + esc(who2.map((r) => nameOf(r.uid)).join('、')) : ''}">${e}${who2.length ? `<b>${who2.length}</b>` : ''}</button>`;
            }).join('')}
            ${reacts.length ? `<small>${esc(reacts.map((r) => nameOf(r.uid)).join('、'))}</small>` : ''}
          </div>
          ${!mine && canDeleteJournal(j) ? `<button class="link-btn danger journal-del" data-act="del-journal" data-id="${esc(j.id)}">刪除這則日誌</button>` : ''}
        </article>`;
    });
    return html;
  }
  async function toggleJournalReact(id, emoji) {
    const j = findById(state.tripItems, id);
    if (!j) return;
    const key = id + '_' + state.userId;
    const my = state.journalReacts.find((r) => r.item_id === id && r.uid === state.userId);
    try {
      if (my && my.emoji === emoji) await Api.deleteDoc('journal_reacts', my.id || key);
      else await Api.setDoc('journal_reacts', key, { item_id: id, trip_id: j.trip_id, uid: state.userId, emoji, at: Date.now() });
    } catch (e) { console.error(e); toast('沒有成功，請確認已經執行過最新的 deploy.bat'); }
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
      <fieldset class="seg emoji">
        <legend>種類</legend>
        ${PLAN_CATS.map(([id, icon, label]) => `<label style="--cat:var(--c-trip)"><input type="radio" name="cat" value="${id}" ${x.cat === id ? 'checked' : ''}><span>${icon} ${label}</span></label>`).join('')}
        <label style="--cat:var(--ink-2)"><input type="radio" name="cat" value="" ${planCat(x.cat) ? '' : 'checked'}><span>不選</span></label>
      </fieldset>
      <label>地點<input type="text" name="place" value="${esc(x.place || '')}" maxlength="60" autocomplete="off" placeholder="寫正式名稱，行程上會有地圖連結"></label>
      <div class="row two">
        <label>停留幾分鐘<input type="number" name="minutes" inputmode="numeric" min="0" max="1440" step="5" value="${esc(x.minutes || '')}" placeholder="可不填"></label>
        <label>預估花費（元）<input type="number" name="cost" inputmode="numeric" min="0" step="1" value="${esc(x.cost || '')}" placeholder="可不填"></label>
      </div>
      <fieldset class="seg">
        <legend>預約</legend>
        ${[['', '不用'], ['need', '要預約'], ['done', '已預約']].map(([v, label]) => `<label style="--cat:${v === 'need' ? 'var(--c-exam)' : 'var(--green)'}"><input type="radio" name="booking" value="${v}" ${(x.booking || '') === v ? 'checked' : ''}><span>${label}</span></label>`).join('')}
      </fieldset>
      <label>怎麼過去（可不填）<input type="text" name="transport" value="${esc(x.transport || '')}" maxlength="200" autocomplete="off" placeholder="搭什麼車、哪一站到哪一站、大約多久"></label>
      <label>推薦店家（可不填，用「、」分開）<input type="text" name="shops" value="${esc(shopList(x).join('、'))}" maxlength="130" autocomplete="off" placeholder="每一家都會有地圖連結"></label>
      <label>備註<textarea name="note" rows="3" maxlength="500" placeholder="門票、訂位、要注意的事…">${esc(x.note || '')}</textarea></label>`
    });
  }

  function openJournalSheet(item) {
    const t = tripOf(state.tripId);
    const now = today();
    const x = item || { date: now >= t.start_date && now <= t.end_date ? now : t.end_date < now ? t.end_date : t.start_date, text: '' };
    const seg = (name, list, cur) => `
      <fieldset class="seg emoji">
        <legend>${name === 'mood' ? '心情' : '天氣'}（可不選）</legend>
        ${list.map(([e, label]) => `<label style="--cat:var(--c-trip)"><input type="radio" name="${name}" value="${e}" ${cur === e ? 'checked' : ''}><span>${e} ${label}</span></label>`).join('')}
        <label style="--cat:var(--ink-2)"><input type="radio" name="${name}" value="" ${cur ? '' : 'checked'}><span>不選</span></label>
      </fieldset>`;
    showSheet('journal-form', {
      title: item ? '編輯日誌' : '寫日誌', focus: !item, footer: item ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(x.id || '')}">
      <label>哪一天<input type="date" name="date" value="${esc(x.date)}"></label>
      ${seg('mood', MOODS, x.mood || '')}
      ${seg('weather', WEATHERS, x.weather || '')}
      <label>在哪裡（可不填）<input type="text" name="place" value="${esc(x.place || '')}" maxlength="60" autocomplete="off" placeholder="寫了會有地圖連結"></label>
      <div class="jr-chips" id="jr-places"></div>
      <label>內容<textarea class="title-input" name="text" rows="6" maxlength="3000" placeholder="今天去了哪裡？最難忘的是什麼？">${esc(x.text || '')}</textarea></label>
      <div class="jr-chips">${JR_PROMPTS.map((q) => `<button type="button" data-act="jr-prompt" data-text="${esc(q)}">${esc(q)}…</button>`).join('')}</div>
      <button type="button" class="ai-btn jr-ai" data-act="ai-journal">AI 幫我寫成日記</button>
      <p class="hint" id="jr-ai-hint" role="status">先寫幾個關鍵字（例如：犬山城、爬很高、抹茶冰、弟弟迷路），AI 會整理成一段日記，你再改。</p>
      <label>照片（一張，可不放）<input type="file" name="photo" accept="image/*"></label>
      ${item && item.thumb ? '<p class="hint">這則已經有一張照片；選新的會換掉它。</p>' : ''}`
    });
    drawJournalPlaces();
  }
  // 「在哪裡」下面：列出那一天行程裡的地點，點一下就填進去
  function drawJournalPlaces() {
    const form = document.getElementById('journal-form'), box = document.getElementById('jr-places');
    if (!form || !box) return;
    const places = Array.from(new Set(itemsOf(state.tripId, 'plan').filter((p) => p.date === form.elements.date.value && p.place).map((p) => p.place))).slice(0, 8);
    box.innerHTML = places.map((n) => `<button type="button" data-act="jr-place" data-text="${esc(n)}">${esc(n)}</button>`).join('');
  }
  let journalBefore = null;   // AI 改寫前的原文，可以還原
  async function aiWriteJournal(btn) {
    const form = document.getElementById('journal-form');
    if (!form || btn.disabled) return;
    const f = form.elements, hint = document.getElementById('jr-ai-hint');
    if (btn.dataset.undo) { f.text.value = journalBefore || ''; delete btn.dataset.undo; btn.textContent = 'AI 幫我寫成日記'; hint.textContent = '已經換回你原本寫的。'; return; }
    const text = f.text.value.trim();
    if (!text) { hint.textContent = '先在「內容」寫幾個關鍵字，AI 才知道今天發生什麼事。'; f.text.focus(); return; }
    const t = tripOf(state.tripId);
    btn.disabled = true; btn.textContent = '寫作中…'; hint.textContent = '正在請 AI 寫…';
    try {
      const r = await askAi('journal', {
        text, date: f.date.value, place: f.place.value.trim(), mood: labelOf(MOODS, f.mood.value), weather: labelOf(WEATHERS, f.weather.value),
        name: me().display_name, child: amChild(), trip: t.title + (t.place ? '（' + t.place + '）' : ''),
        plans: itemsOf(t.id, 'plan').filter((p) => p.date === f.date.value).map((p) => p.title + (p.place ? '＠' + p.place : '')).slice(0, 12)
      });
      if (!document.getElementById('journal-form')) return;
      journalBefore = text; f.text.value = r.text;
      btn.dataset.undo = '1'; btn.textContent = '換回我原本寫的';
      hint.textContent = 'AI 寫好了，可以直接改。不喜歡就按「換回我原本寫的」。';
    } catch (e) { btn.textContent = 'AI 幫我寫成日記'; hint.textContent = e.friendly || '沒有成功，請再試一次。'; }
    btn.disabled = false;
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
  // 鍾家生活 →「相簿」。日常的照片，按月份看；每張可以留言、按愛心、標註照片裡有誰。
  // 資料：photos = { month, date, caption, people: [UID], thumb（小圖）, image_id（原圖放在 chat_images）, author, created_by, created_at }
  //       photo_comments = { photo_id, month, text, author, created_by, created_at }
  //       photo_likes/{照片id_UID} = { photo_id, month, uid, created_at }
  // 只在打開相簿時讀那一個月的資料，不會拖慢 app 啟動。
  const canDeletePhoto = (p) => isAdmin() || p.author === state.userId;
  const canEditPhoto = canDeletePhoto;
  const commentsOf = (photoId) => state.photoComments.filter((c) => c.photo_id === photoId).sort((a, b) => a.created_at - b.created_at);
  const likesOf = (photoId) => state.photoLikes.filter((l) => l.photo_id === photoId && member(l.uid));
  const likedByMe = (photoId) => state.photoLikes.some((l) => l.photo_id === photoId && l.uid === state.userId);
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.500s-7.500-4.600-7.500-10.100A4.300 4.300 0 0 1 12 7.600a4.300 4.300 0 0 1 7.500 2.800c0 5.500-7.500 10.100-7.500 10.100z"/></svg>';
  const BUBBLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.500 6.500a2.500 2.500 0 0 1 2.500-2.500h10a2.500 2.500 0 0 1 2.500 2.500v7a2.500 2.500 0 0 1-2.500 2.500h-5.500L7 20v-4H7a2.500 2.500 0 0 1-2.500-2.500z"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 7.500L12 3.500l4 4M6 11v7.500A1.500 1.500 0 0 0 7.500 20h9a1.500 1.500 0 0 0 1.500-1.500V11"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.500v13l10.500-6.500z"/></svg>';

  // 相簿改用即時監聽：手機上已經有的照片（離線快取）會馬上顯示，再只向伺服器要新的；
  // 家人新放的照片、留言和愛心也會自動出現。看過的月份留在記憶體，切回來不用重讀。
  const albumCache = {};
  let albumWatch = { month: '', stops: [] };
  function stopAlbum() { albumWatch.stops.forEach((f) => f && f()); albumWatch = { month: '', stops: [] }; }
  function drawAlbum() {
    if (state.tab !== 'notes' || state.notesView !== 'album') return;
    if (!$sheet.innerHTML) render();
    else if (state.photoId) refreshPhotoPanel();
  }
  function loadAlbum() {
    const scope = albumScope(), month = state.albumId ? '' : state.albumMonth, albumId = state.albumId;
    if (albumWatch.month === scope) return;
    stopAlbum();
    const cached = albumCache[scope];
    if (cached) Object.assign(state, { photos: cached.photos, photoComments: cached.comments, photoLikes: cached.likes, albumLoaded: scope });
    const got = { photos: false, comments: false, likes: false };
    const done = () => {
      if (albumWatch.month !== scope || !got.photos || !got.comments || !got.likes) return;
      state.albumLoaded = scope;
      albumCache[scope] = { photos: state.photos, comments: state.photoComments, likes: state.photoLikes };
      syncSummary(albumId ? 'a' : 'm', albumId || month, state.photos);
      drawAlbum();
    };
    const order = (list) => list.sort((a, b) => b.date.localeCompare(a.date) || b.created_at - a.created_at);
    if (!albumId) {
      const watch = (name, key, apply) => Api.watchWhere(name, 'month', month, (list) => {
        if (albumWatch.month !== scope) return;
        apply(list); got[key] = true; done();
      });
      albumWatch = { month: scope, stops: [
        watch('photos', 'photos', (list) => { state.photos = order(list); }),
        watch('photo_comments', 'comments', (list) => { state.photoComments = list; }),
        watch('photo_likes', 'likes', (list) => { state.photoLikes = list; })
      ] };
    } else {
      // 一本相簿的照片可能分散在好幾個月：照片用 album_id 找，留言和愛心再照出現的月份分別讀
      const subs = {}, cm = {}, lk = {};
      const merge = () => { state.photoComments = [].concat(...Object.values(cm)); state.photoLikes = [].concat(...Object.values(lk)); };
      albumWatch = { month: scope, stops: [
        Api.watchWhere('photos', 'album_id', albumId, (list) => {
          if (albumWatch.month !== scope) return;
          state.photos = order(list);
          [...new Set(list.map((p) => p.month))].forEach((m) => {
            if (subs[m]) return;
            subs[m] = [
              Api.watchWhere('photo_comments', 'month', m, (l) => { if (albumWatch.month !== scope) return; cm[m] = l; merge(); done(); }),
              Api.watchWhere('photo_likes', 'month', m, (l) => { if (albumWatch.month !== scope) return; lk[m] = l; merge(); done(); })
            ];
          });
          got.photos = got.comments = got.likes = true; done();
        }),
        () => Object.values(subs).forEach((pair) => pair.forEach((f) => f && f()))
      ] };
    }
    if (cached) drawAlbum();
  }

  // 原圖：看過的留在記憶體；從手機快取讀得到就不等網路。打開一張時順便先載好前後兩張
  const fullImages = new Map();
  async function fullImage(p) {
    if (fullImages.has(p.image_id)) return fullImages.get(p.image_id);
    const doc = await Api.getDocCached('chat_images', p.image_id);
    const data = doc && String(doc.data).startsWith('data:image/') ? doc.data : null;
    if (data) {
      fullImages.set(p.image_id, data);
      if (fullImages.size > 24) fullImages.delete(fullImages.keys().next().value);
    }
    return data;
  }

  // 篩選：全部、我按愛心的、或照片裡有某個人
  // ---------- 相簿：自訂相簿、整年總覽、那年今日、多選、密度 ----------
  // albums/{id}：{ name, created_by, created_at, cover, count }；照片的 album_id 指到相簿（'' = 沒放）
  // album_months/{YYYY-MM}：{ count, cover }　整年總覽用的每月封面，誰打開那個月誰順手更新
  const albumScope = () => (state.albumId ? 'a:' + state.albumId : state.albumMonth);
  const albumOf = (id) => findById(state.albums, id);
  const canEditAlbum = (a) => isAdmin() || a.created_by === state.userId;
  const DENSE_KEY = 'family-album-dense';
  try { state.albumDense = localStorage.getItem(DENSE_KEY) === '1'; } catch (e) { state.albumDense = false; }
  const monthSums = {};      // 'YYYY-MM' → { count, cover }（讀過的）
  const sumSent = {};        // 這次開 App 已經更新過的摘要，內容一樣就不再寫
  function syncSummary(kind, id, list) {
    const cover = list.length ? list[0].thumb : '', key = kind + id, sig = list.length + '|' + cover.length;
    if (sumSent[key] === sig) return;
    sumSent[key] = sig;
    if (kind === 'm') {
      const cur = monthSums[id];
      if (cur && cur.count === list.length && cur.cover === cover) return;
      monthSums[id] = { id, count: list.length, cover };
      Api.setDoc('album_months', id, { count: list.length, cover, updated_at: Date.now() }).catch((e) => console.warn('月份封面沒更新', e));
    } else {
      const a = albumOf(id);
      if (!a || (a.count === list.length && (a.cover || '') === cover)) return;
      Api.updateDoc('albums', id, { count: list.length, cover }).catch((e) => console.warn('相簿封面沒更新', e));
    }
  }
  // 剛放進相簿時先把封面和張數補上（之後誰打開相簿，會再照實際的照片更正）
  function bumpAlbum(id, added, thumb) {
    const a = albumOf(id);
    if (!id || !added) return;
    Api.updateDoc('albums', id, { count: ((a && a.count) || 0) + added, cover: (a && a.cover) || thumb || '' }).catch((e) => console.warn(e));
  }
  const eventTitleOf = (items) => {
    const n = {};
    items.forEach((p) => { if (p.event_title) n[p.event_title] = (n[p.event_title] || 0) + 1; });
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || '';
  };
  const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>';
  // 日期／相簿 兩個分頁
  function albumTabsHtml() {
    const b = (v, label) => `<button class="${state.albumTab === v ? 'on' : ''}" data-act="album-tab" data-tab="${v}" ${state.albumTab === v ? 'aria-pressed="true"' : ''}>${label}</button>`;
    return `<div class="switcher album-tabs" role="group" aria-label="用日期或相簿看照片">${b('date', '依日期')}${b('albums', '相簿' + (state.albums.length ? ' ' + state.albums.length : ''))}</div>`;
  }
  // 所有自訂相簿
  function viewAlbumList() {
    const list = state.albums.slice().sort((a, b) => b.created_at - a.created_at);
    return `
      <header class="month-head"><h1>相簿</h1><div class="month-nav"><button class="chip-btn" data-act="album-new">＋ 新相簿</button></div></header>
      ${albumTabsHtml()}
      ${list.length ? `<div class="album-books">${list.map((a) => `
        <button class="album-book" data-act="album-open" data-id="${esc(a.id)}">
          <span class="album-bcov">${a.cover ? `<img src="${esc(a.cover)}" alt="" loading="lazy" decoding="async">` : '<i aria-hidden="true"></i>'}</span>
          <b>${esc(a.name)}</b><small>${a.count || 0} 張・${esc(nameOf(a.created_by))}</small>
        </button>`).join('')}</div>`
        : '<div class="empty big"><p>還沒有相簿。旅行、表演、畢業典禮這類想放在一起看的照片，可以開一本相簿收起來。</p></div>'}`;
  }
  // 選取列（看某一天、某本相簿時可以多選）
  function albumToolsHtml(items) {
    const sel = state.albumSel;
    if (sel) return '';
    return `<div class="album-tools">
      ${items.length > 1 ? `<button class="album-play" data-act="album-play">${PLAY}播放</button>` : ''}
      <button class="chip-btn" data-act="album-dense" aria-pressed="${state.albumDense}">${state.albumDense ? '大圖' : '小圖'}</button>
      ${items.length ? '<button class="chip-btn" data-act="album-select">選取</button>' : ''}
    </div>`;
  }
  function albumSelBarHtml() {
    const sel = state.albumSel;
    if (!sel) return '';
    const n = sel.length;
    return `<div class="album-selbar" role="group" aria-label="已選的照片">
      <b>已選 ${n} 張</b>
      <button data-act="sel-album" ${n ? '' : 'disabled'}>放進相簿</button>
      <button data-act="sel-people" ${n ? '' : 'disabled'}>標註</button>
      <button data-act="sel-share" ${n ? '' : 'disabled'}>存到手機</button>
      <button class="del" data-act="sel-del" ${n ? '' : 'disabled'}>刪除</button>
      <button class="strong" data-act="album-select">完成</button>
    </div>`;
  }
  // 一本相簿
  function viewAlbumOne() {
    const a = albumOf(state.albumId), loaded = state.albumLoaded === albumScope();
    if (!a) { state.albumId = null; return viewAlbumList(); }
    const items = loaded ? state.photos : [];
    return `
      <button class="link-btn back" data-act="album-close">‹ 所有相簿</button>
      <header class="month-head album-dhead">
        <h1>${esc(a.name)}<small>${loaded ? items.length + ' 張' : '讀取中'}・${esc(nameOf(a.created_by))}建立</small></h1>
        ${canEditAlbum(a) ? '<div class="month-nav"><button class="chip-btn" data-act="album-edit">改名／刪除</button></div>' : ''}
      </header>
      ${albumToolsHtml(items)}
      ${!loaded ? '<div class="skel-wrap"><div class="skel hero"></div></div>' : items.length ? albumGridHtml(items)
        : '<div class="empty big"><p>這本相簿還沒有照片。按下面的「放照片」直接上傳到這裡，或到「依日期」那邊選取照片再「放進相簿」。</p></div>'}
      ${albumSelBarHtml()}`;
  }
  // 整年總覽：12 個月各一張封面
  let yearLoading = '';
  function viewAlbumYear() {
    const y = state.albumYear, now = today().slice(0, 7);
    loadYear(y);
    return `
      <button class="link-btn back" data-act="album-year-close">‹ 回到${Number(state.albumMonth.slice(5))}月</button>
      <header class="month-head">
        <h1>${y}年</h1>
        <div class="month-nav">
          <button class="icon-btn" data-act="album-year-step" data-dir="-1" aria-label="前一年">‹</button>
          <button class="icon-btn" data-act="album-year-step" data-dir="1" aria-label="後一年" ${y >= Number(now.slice(0, 4)) ? 'disabled' : ''}>›</button>
        </div>
      </header>
      <div class="album-year">${Array.from({ length: 12 }, (_, i) => {
        const m = y + '-' + pad(i + 1), s = monthSums[m], future = m > now;
        return `<button class="album-ym ${s && s.count ? '' : 'none'} ${m === state.albumMonth ? 'cur' : ''}" data-act="album-month" data-month="${m}" ${future ? 'disabled' : ''} aria-label="${i + 1}月${s ? '，' + s.count + ' 張' : ''}">
          ${s && s.cover ? `<img src="${esc(s.cover)}" alt="" loading="lazy" decoding="async">` : ''}
          <b>${i + 1}月</b><small>${future ? '' : !s ? '…' : s.count ? s.count + ' 張' : '沒有照片'}</small>
        </button>`;
      }).join('')}</div>`;
  }
  // 讀這一年每個月的封面；還沒有摘要的月份（功能上線前的照片）在背景補算一次
  async function loadYear(y) {
    if (yearLoading === String(y)) return;
    yearLoading = String(y);
    const redraw = () => { if (state.albumYear === y && state.tab === 'notes' && state.notesView === 'album' && !$sheet.innerHTML) render(); };
    try { (await Api.listDocs('album_months')).forEach((d) => { monthSums[d.id] = d; }); } catch (e) { console.warn('讀不到月份封面', e); }
    redraw();
    const now = today().slice(0, 7);
    for (let i = 12; i >= 1; i--) {
      const m = y + '-' + pad(i);
      if (m > now || monthSums[m] || state.albumYear !== y) continue;
      try {
        const list = (await Api.listDocs('photos', ['month', m])).sort((a, b) => b.date.localeCompare(a.date) || b.created_at - a.created_at);
        monthSums[m] = { id: m, count: list.length, cover: list.length ? list[0].thumb : '' };
        Api.setDoc('album_months', m, { count: list.length, cover: monthSums[m].cover, updated_at: Date.now() }).catch(() => {});
        redraw();
      } catch (e) { console.warn(e); monthSums[m] = { id: m, count: 0, cover: '' }; }
    }
  }
  // 那年今日：上個月、去年、前年的同一天
  function loadMemories() {
    if (state.memories !== null) return;
    state.memories = [];
    const t = parse(today()), day = (y, m) => { const d = new Date(t.getFullYear() + y, t.getMonth() + m, t.getDate()); return d.getDate() === t.getDate() ? ymd(d) : ''; };
    const wants = [['上個月的今天', day(0, -1)], ['去年的今天', day(-1, 0)], ['前年的今天', day(-2, 0)]].filter((x) => x[1]);
    Promise.all(wants.map(([label, date]) => Api.listDocs('photos', ['date', date]).then((items) => ({ label, date, items }), () => ({ label, date, items: [] }))))
      .then((list) => { state.memories = list.filter((x) => x.items.length); if (state.memories.length) drawAlbum(); });
  }
  function memoriesHtml() {
    loadMemories();
    if (!state.memories || !state.memories.length) return '';
    return `<section class="album-mem" aria-label="那年今日"><h2>那年今日</h2><div class="album-memrow">${state.memories.map((x) => `
      <button data-act="album-jump" data-date="${esc(x.date)}"><img src="${esc(x.items[0].thumb)}" alt="" loading="lazy" decoding="async"><span><b>${x.label}</b><small>${x.date.slice(0, 4)}年・${x.items.length} 張</small></span></button>`).join('')}</div></section>`;
  }
  function jumpToDay(date) {
    Object.assign(state, { tab: 'notes', notesView: 'album', albumTab: 'date', albumId: null, albumYear: null, albumSel: null, albumFilter: '', albumMonth: date.slice(0, 7), albumDay: date });
    closeSheet(); render(); loadAlbum();
    if (scroller()) scroller().scrollTop = 0;
  }
  // 多選之後的動作
  const selPhotos = () => (state.albumSel || []).map((id) => findById(state.photos, id)).filter(Boolean);
  async function removePhoto(p) {
    await Api.deleteDoc('photos', p.id);
    Api.deleteDoc('chat_images', p.image_id).catch(() => {});
    commentsOf(p.id).forEach((c) => Api.deleteDoc('photo_comments', c.id).catch(() => {}));
    state.photoLikes.filter((l) => l.photo_id === p.id).forEach((l) => Api.deleteDoc('photo_likes', l.id).catch(() => {}));
    state.photos = state.photos.filter((x) => x.id !== p.id);
    state.photoComments = state.photoComments.filter((c) => c.photo_id !== p.id);
  }
  async function selDelete(btn) {
    const list = selPhotos(), mine = list.filter(canDeletePhoto);
    if (!mine.length) return toast('只能刪除自己放的照片');
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = '確定刪 ' + mine.length + ' 張'; return; }
    btn.disabled = true;
    let n = 0;
    for (const p of mine) { try { await removePhoto(p); n++; } catch (e) { console.error(e); } }
    state.albumSel = null;
    toast('已刪除 ' + n + ' 張' + (list.length > mine.length ? '（別人放的 ' + (list.length - mine.length) + ' 張沒有刪）' : ''));
    render();
  }
  async function selShare() {
    const list = selPhotos().slice(0, 10), missing = list.filter((p) => !fullImages.has(p.image_id));
    if (missing.length) {      // iPhone 的分享要在按下去的當下呼叫，所以先把原圖讀好，再請使用者按一次
      toast('正在準備 ' + missing.length + ' 張照片…');
      await Promise.all(missing.map((p) => fullImage(p).catch(() => null)));
      return toast('照片準備好了，請再按一次「存到手機」');
    }
    try {
      const files = list.map((p, i) => dataUrlFile(fullImages.get(p.image_id) || p.thumb, '鍾家相簿-' + p.date + '-' + (i + 1) + '.jpg'));
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: '鍾家相簿' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; console.warn(e); }
    toast('這支手機不能一次存多張，請點開照片一張一張存');
  }
  function openAlbumPick() {
    showSheet('album-pick-form', {
      title: '放進相簿', submit: '確定',
      body: `<fieldset class="album-pickset"><legend>${state.albumSel.length} 張照片要放進哪一本？</legend>
        ${state.albums.map((a) => `<label><input type="radio" name="album" value="${esc(a.id)}"><span>${esc(a.name)}</span></label>`).join('')}
        <label><input type="radio" name="album" value=""><span>不放在任何相簿</span></label>
        <label><input type="radio" name="album" value="+" ${state.albums.length ? '' : 'checked'}><span>開一本新的</span></label></fieldset>
        <label>新相簿的名字<input name="name" maxlength="30" placeholder="例如：2026 日本旅行" autocomplete="off"></label>`
    });
  }
  function openAlbumForm(a) {
    showSheet('album-form', {
      title: a ? '相簿' : '新相簿', submit: a ? '儲存' : '建立', focus: !a,
      body: `<input type="hidden" name="item_id" value="${a ? esc(a.id) : ''}">
        <label>相簿名字<input class="title-input" name="name" maxlength="30" value="${a ? esc(a.name) : ''}" placeholder="例如：2026 日本旅行" autocomplete="off"></label>
        ${a ? '<p class="hint">刪除相簿只會把這本相簿拿掉，裡面的照片還是留在「依日期」裡。</p><button type="button" class="btn ghost danger-text" data-act="album-del">刪除這本相簿</button>' : '<p class="hint">建立之後，上傳照片時可以直接選這本相簿；也可以到「依日期」選取已經有的照片再放進來。</p>'}`
    });
  }
  async function deleteAlbum(btn) {
    const a = albumOf(state.albumId);
    if (!a || !canEditAlbum(a)) return;
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = '再按一次確定刪除'; return; }
    btn.disabled = true;
    try {
      const inside = await Api.listDocs('photos', ['album_id', a.id]);
      await Promise.all(inside.map((p) => Api.updateDoc('photos', p.id, { album_id: '' }).catch(() => {})));
      await Api.deleteDoc('albums', a.id);
      state.albumId = null; state.albumSel = null;
      closeSheet(); render(); loadAlbum(); toast('已刪除相簿，照片還在');
    } catch (e) { console.error(e); btn.disabled = false; toast('沒有刪除成功'); }
  }
  // 上傳時：這一天有哪些行程可以選
  async function fillPhotoEvents() {
    const form = document.getElementById('photo-form');
    if (!form || !form.elements.event_title) return;
    const sel = form.elements.event_title, date = form.elements.date.value;
    let titles = [];
    try { titles = [...new Set(expand(await Api.listEvents(date, date), date, date).map((e) => e.title).filter(Boolean))]; } catch (e) { console.warn(e); }
    if (form.elements.date.value !== date) return;
    sel.innerHTML = '<option value="">不指定</option>' + titles.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    sel.closest('label').hidden = !titles.length;
    form.dataset.events = JSON.stringify(titles);
    if (titles.length === 1) sel.value = titles[0];
  }
  async function photoAi(btn) {
    const form = document.getElementById('photo-form'), out = document.getElementById('photo-ai-out');
    if (!form || !out || btn.disabled) return;
    btn.disabled = true; btn.textContent = '想說明中…'; out.innerHTML = '';
    try {
      const people = Array.from(form.querySelectorAll('input[name="people"]:checked')).map((i) => nameOf(i.value));
      const picked = form.elements.event_title.value;
      const r = await askAi('caption', { date: form.elements.date.value, events: picked ? [picked] : JSON.parse(form.dataset.events || '[]'), people, hint: form.elements.caption.value.trim(), album: (albumOf(form.elements.album_id.value) || {}).name || '' });
      out.innerHTML = (r.captions || []).map((c) => `<button type="button" class="chip-btn" data-act="photo-ai-pick">${esc(c)}</button>`).join('') + '<small>點一句就會填進說明，可以再改。AI 只看日期、行程和標註，看不到照片。</small>';
    } catch (e) { out.innerHTML = `<small>${esc(e.friendly || 'AI 現在沒有回應，請稍後再試')}</small>`; }
    btn.disabled = false; btn.textContent = 'AI 幫我想說明';
  }
  // 大圖手勢：兩指放大縮小、放大後拖曳、往下滑關閉
  let zoom = { scale: 1, x: 0, y: 0 }, pinch = null;
  const stageImg = () => $sheet.querySelector('.album-stage img');
  function applyZoom() { const img = stageImg(); if (img) img.style.transform = zoom.scale > 1 ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` : ''; }
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  document.addEventListener('touchstart', (ev) => {
    if (!ev.target.closest || !ev.target.closest('.album-stage')) { pinch = null; return; }
    const t = ev.touches;
    if (t.length === 2) pinch = { kind: 'pinch', d: dist(t[0], t[1]), scale: zoom.scale };
    else if (t.length === 1) pinch = { kind: zoom.scale > 1 ? 'pan' : 'down', sx: t[0].clientX, sy: t[0].clientY, x: zoom.x, y: zoom.y };
  }, { passive: true });
  document.addEventListener('touchmove', (ev) => {
    if (!pinch) return;
    const t = ev.touches;
    if (pinch.kind === 'pinch' && t.length === 2) {
      zoom.scale = Math.min(4, Math.max(1, pinch.scale * dist(t[0], t[1]) / pinch.d));
      if (zoom.scale === 1) { zoom.x = 0; zoom.y = 0; }
      if (ev.cancelable) ev.preventDefault();
      applyZoom();
    } else if (pinch.kind === 'pan' && t.length === 1) {
      const max = 160 * zoom.scale;
      zoom.x = Math.min(max, Math.max(-max, pinch.x + t[0].clientX - pinch.sx));
      zoom.y = Math.min(max, Math.max(-max, pinch.y + t[0].clientY - pinch.sy));
      if (ev.cancelable) ev.preventDefault();
      applyZoom();
    }
  }, { passive: false });
  document.addEventListener('touchend', (ev) => {
    if (!pinch) return;
    const p = pinch, t = ev.changedTouches[0];
    if (ev.touches.length) return;
    pinch = null;
    if (zoom.scale < 1.08) { zoom = { scale: 1, x: 0, y: 0 }; applyZoom(); }
    if (p.kind === 'down' && t && t.clientY - p.sy > 110 && Math.abs(t.clientX - p.sx) < 70 && state.photoId) closePhoto();
  }, { passive: true });

  function albumList() {
    const f = state.albumFilter;
    if (!f) return state.photos;
    if (f === 'liked') return state.photos.filter((p) => likedByMe(p.id));
    return state.photos.filter((p) => (p.people || []).includes(f));
  }

  function viewAlbum() {
    if (state.albumYear) return viewAlbumYear();
    if (state.albumId) return viewAlbumOne();
    if (state.albumTab === 'albums') return viewAlbumList();
    if (state.albumDay && state.albumLoaded === state.albumMonth) return viewAlbumDay();
    const [y, m] = state.albumMonth.split('-').map(Number);
    const loaded = state.albumLoaded === state.albumMonth;
    const all = loaded ? state.photos : [];
    const photos = loaded ? albumList() : [];
    // 同一天的照片排在一起
    const days = [];
    photos.forEach((p) => { const last = days[days.length - 1]; if (last && last.date === p.date) last.items.push(p); else days.push({ date: p.date, items: [p] }); });
    // 本月精選：愛心最多的那張（一樣多就選最新的）
    const best = all.length ? all.slice().sort((a, b) => likesOf(b.id).length - likesOf(a.id).length || b.created_at - a.created_at)[0] : null;
    const bestLikes = best ? likesOf(best.id).length : 0;
    if (best && !fullImages.has(best.image_id)) fullImage(best).then((data) => {
      const el = document.querySelector('.album-hero[data-id="' + best.id + '"] img');
      if (el && data) el.src = data;
    }).catch(() => {});
    const chip = (v, label, color) => `<button class="album-chip ${state.albumFilter === v ? 'on' : ''}" ${color ? `style="--who:${esc(color)}"` : ''} data-act="album-filter" data-filter="${v}" ${state.albumFilter === v ? 'aria-pressed="true"' : ''}>${label}</button>`;
    const totalComments = state.photoComments.filter((c) => all.some((p) => p.id === c.photo_id)).length;
    const totalLikes = state.photoLikes.filter((l) => all.some((p) => p.id === l.photo_id)).length;
    return `
      <header class="month-head">
        <h1><button class="album-ytitle" data-act="album-year" aria-label="${y}年${m}月，點一下看整年">${y}年${m}月<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></h1>
        <div class="month-nav">
          ${state.albumMonth !== today().slice(0, 7) ? '<button class="chip-btn" data-act="album-now">回到本月</button>' : ''}
          <button class="icon-btn" data-act="album-prev" aria-label="上個月">‹</button>
          <button class="icon-btn" data-act="album-next" aria-label="下個月" ${state.albumMonth >= today().slice(0, 7) ? 'disabled' : ''}>›</button>
        </div>
      </header>
      ${albumTabsHtml()}
      ${state.albumMonth === today().slice(0, 7) && !state.albumFilter ? memoriesHtml() : ''}
      ${!loaded ? '<div class="skel-wrap" role="status" aria-label="讀取照片中"><div class="skel hero"></div><div class="skel line w60"></div><div class="skel row"></div><div class="skel row"></div><div class="skel row"></div></div>' : !all.length ? `
        <div class="empty big">
          <p>這個月還沒有照片。今天的晚餐、放學路上、週末出去玩，拍了就放上來，全家都能看、能留言、按愛心。</p>
        </div>` : `
        <button class="album-hero" data-act="open-photo" data-id="${esc(best.id)}" aria-label="本月精選：${esc(best.caption || nameOf(best.author) + '的照片')}">
          <img src="${esc(fullImages.get(best.image_id) || best.thumb)}" alt="">
          <span class="album-hero-text">
            <small>${bestLikes ? '本月最多愛心' : '最新的照片'}</small>
            <b>${esc(best.caption || shortDate(best.date))}</b>
            <span>${esc(nameOf(best.author))}${bestLikes ? `　<i class="album-hearts">${HEART}${bestLikes}</i>` : ''}</span>
          </span>
        </button>
        <div class="album-stats">
          <span><b>${all.length}</b> 張照片</span><span><b>${totalComments}</b> 則留言</span><span><b>${totalLikes}</b> 個愛心</span>
          <button class="album-play" data-act="album-play">${PLAY}播放</button>
        </div>
        <div class="album-chips" role="group" aria-label="篩選照片">
          ${chip('', '全部')}${chip('liked', '♥ 我喜歡的')}${state.members.map((mm) => chip(mm.id, '有' + esc(mm.display_name), mm.color)).join('')}
        </div>
        ${!photos.length ? `<p class="hint album-wait">${state.albumFilter === 'liked' ? '這個月還沒有你按愛心的照片。' : '這個月沒有標註這個人的照片。'}</p>` : ''}
        <div class="album-days">${days.map((d) => albumDayCard(d)).join('')}</div>`}`;
  }
  // 整個月的清單：一天一張卡片，最多三張縮圖預覽，點進去看那天全部的照片
  function albumDayCard(d) {
    const dt = parse(d.date), cover = d.items.slice(0, 3), more = d.items.length - cover.length;
    const n = d.items.reduce((t, p) => t + commentsOf(p.id).length, 0), h = d.items.reduce((t, p) => t + likesOf(p.id).length, 0);
    const who = [...new Set(d.items.map((p) => p.author))];
    const cap = (d.items.find((p) => p.caption) || {}).caption || '', evt = eventTitleOf(d.items);
    return `
      <button class="album-dcard" data-act="album-day" data-date="${esc(d.date)}" aria-label="${dt.getMonth() + 1}月${dt.getDate()}日，${d.items.length} 張照片">
        <span class="album-dcov n${cover.length}">${cover.map((p, i) => `<img src="${esc(p.thumb)}" alt="" loading="lazy" decoding="async">${i === cover.length - 1 && more > 0 ? `<i>+${more}</i>` : ''}`).join('')}</span>
        <span class="album-dmeta">
          <b>${dt.getMonth() + 1}月${dt.getDate()}日<small>星期${WEEKDAYS[dt.getDay()]}${d.date === today() ? '・今天' : ''}</small></b>
          ${evt ? `<em class="ev">${esc(evt)}</em>` : ''}${cap && cap !== evt ? `<em>${esc(cap)}</em>` : ''}
          <span>${d.items.length} 張${h ? `<i class="album-hearts">${HEART}${h}</i>` : ''}${n ? `<i>${BUBBLE}${n}</i>` : ''}<span class="album-dwho">${who.slice(0, 4).map((u) => member(u) ? avatarHtml(member(u), 'xs') : '').join('')}</span></span>
        </span>
      </button>`;
  }
  function albumGridHtml(items) {
    const sel = state.albumSel;
    return `<div class="album-grid ${state.albumDense || sel ? 'dense' : items.length >= 3 ? 'mosaic' : items.length === 2 ? 'two' : 'one'} ${sel ? 'picking' : ''}">
      ${items.map((p, idx) => {
        const n = commentsOf(p.id).length, h = likesOf(p.id).length;
        // 最後一列沒排滿時，最後一張放寬把那一列補滿，不留空格
        const tail = !state.albumDense && !sel && items.length > 3 && idx === items.length - 1 ? ['', ' wide3', ' wide2'][items.length % 3] : '';
        const on = sel && sel.includes(p.id);
        return `<button class="album-cell${tail}${on ? ' picked' : ''}" data-act="${sel ? 'album-pick' : 'open-photo'}" data-id="${esc(p.id)}" ${sel ? `aria-pressed="${!!on}"` : ''} aria-label="${esc(nameOf(p.author))}的照片${p.caption ? '：' + esc(p.caption) : ''}">
          <img src="${esc(p.thumb)}" alt="" loading="lazy" decoding="async">
          ${sel ? `<span class="album-tick" aria-hidden="true">${on ? CHECK_SVG : ''}</span>` : n || h ? `<span class="album-badges">${h ? `<i class="${likedByMe(p.id) ? 'mine' : ''}">${HEART}${h}</i>` : ''}${n ? `<i>${BUBBLE}${n}</i>` : ''}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`;
  }
  // 看某一天：那天全部的照片，上一天／下一天（同一個月、有照片的日子）
  function viewAlbumDay() {
    const list = albumList(), date = state.albumDay;
    const items = list.filter((p) => p.date === date);
    const dates = [...new Set(list.map((p) => p.date))];   // 新的在前
    const i = dates.indexOf(date), newer = dates[i - 1], older = dates[i + 1];
    const dt = parse(date), [, m] = state.albumMonth.split('-').map(Number);
    return `
      <button class="link-btn back" data-act="album-day-back">‹ ${m}月的相簿</button>
      <header class="month-head album-dhead">
        <h1>${dt.getMonth() + 1}月${dt.getDate()}日<small>星期${WEEKDAYS[dt.getDay()]}・${items.length} 張${eventTitleOf(items) ? '・' + esc(eventTitleOf(items)) : ''}</small></h1>
        <div class="month-nav">
          <button class="icon-btn" data-act="album-day" data-date="${esc(older || '')}" aria-label="前一天有照片的日子" ${older ? '' : 'disabled'}>‹</button>
          <button class="icon-btn" data-act="album-day" data-date="${esc(newer || '')}" aria-label="後一天有照片的日子" ${newer ? '' : 'disabled'}>›</button>
        </div>
      </header>
      ${albumToolsHtml(items)}
      ${items.length ? albumGridHtml(items) : '<p class="hint album-wait">這一天沒有照片。</p>'}
      ${albumSelBarHtml()}`;
  }

  // 選「照片裡有誰」的勾選列（上傳和編輯共用）
  const peoplePicker = (picked) => `
      <fieldset class="people">
        <legend>照片裡有誰？<small>可不選，之後可以用「有○○」找照片</small></legend>
        ${state.members.map((m) => `
          <label style="--who:${esc(m.color)}">
            <input type="checkbox" name="people" value="${esc(m.id)}" ${(picked || []).includes(m.id) ? 'checked' : ''}>
            <span>${esc(m.display_name)}</span>
          </label>`).join('')}
      </fieldset>`;

  function openAlbumSheet() {
    showSheet('photo-form', {
      title: '放照片到相簿', submit: '上傳',
      body: `
      <label>照片（一次最多 10 張）<input type="file" name="photos" accept="image/*" multiple></label>
      <div class="photo-previews" id="photo-previews" hidden></div>
      <label>哪一天拍的<input type="date" name="date" value="${state.albumDay && !state.albumId ? esc(state.albumDay) : today()}" max="${today()}"></label>
      <label hidden>是哪個行程的照片<select name="event_title"><option value="">不指定</option></select></label>
      <label>放進相簿（可不選）<select name="album_id"><option value="">不放</option>${state.albums.map((a) => `<option value="${esc(a.id)}" ${a.id === state.albumId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      ${peoplePicker([])}
      <label>說明（可不填）<input type="text" name="caption" maxlength="100" autocomplete="off" placeholder="例如：阿嬤家的年夜飯"></label>
      <button type="button" class="btn ghost small" data-act="photo-ai">AI 幫我想說明</button>
      <div class="photo-ai-out" id="photo-ai-out"></div>
      <p class="hint">一次選很多張時，同一句說明和標註會放在每一張上，之後可以一張一張改。</p>`
    });
    fillPhotoEvents();
  }
  // 選好照片後先顯示小預覽
  function showPhotoPreviews(input) {
    const box = document.getElementById('photo-previews');
    if (!box) return;
    const files = Array.from(input.files || []).slice(0, 10);
    box.hidden = !files.length;
    const form = input.form;
    if (form) form._done = new Set();
    box.innerHTML = files.map((f, i) => `<span class="pv" data-i="${i}"><img src="${URL.createObjectURL(f)}" alt=""><i></i></span>`).join('')
      + (input.files.length > 10 ? `<span class="hint">只會放前 10 張</span>` : '');
  }

  function openPhotoEditSheet(p) {
    showSheet('photo-edit-form', {
      title: '編輯照片資訊', focus: false,
      body: `
      <input type="hidden" name="item_id" value="${esc(p.id)}">
      <img class="photo-edit-thumb" src="${esc(p.thumb)}" alt="">
      <label>說明<input type="text" name="caption" value="${esc(p.caption || '')}" maxlength="100" autocomplete="off"></label>
      ${peoplePicker(p.people)}
      <label>哪一天拍的<input type="date" name="date" value="${esc(p.date)}" max="${today()}"></label>
      <label>是哪個行程的照片（可不填）<input type="text" name="event_title" value="${esc(p.event_title || '')}" maxlength="60" autocomplete="off" placeholder="例如：鋼琴發表會"></label>
      <label>放進相簿<select name="album_id"><option value="">不放</option>${state.albums.map((a) => `<option value="${esc(a.id)}" ${a.id === p.album_id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>`
    });
  }

  const commentsHtml = (photoId) => {
    const list = commentsOf(photoId);
    return list.length ? list.map((c) => `
      <div class="album-comment">
        <b style="color:${esc(colorOf(c.author))}">${esc(nameOf(c.author))}</b>
        <span>${esc(c.text)}</span>
        ${c.author === state.userId ? `<button class="pack-del" data-act="del-comment" data-id="${esc(c.id)}" aria-label="刪除這則留言">×</button>` : ''}
      </div>`).join('') : '<p class="album-none">還沒有留言，第一個說點什麼吧。</p>';
  };
  function likeBarHtml(p) {
    const likes = likesOf(p.id);
    const mine = likedByMe(p.id);
    return `
      <button class="album-like ${mine ? 'on' : ''}" data-act="photo-like" data-id="${esc(p.id)}" aria-pressed="${mine}" aria-label="${mine ? '收回愛心' : '按愛心'}">${HEART}<b>${likes.length || ''}</b></button>
      <span class="album-likers">${likes.length ? esc(likes.map((l) => nameOf(l.uid)).join('、')) + ' 覺得讚' : '雙擊照片也可以按愛心'}</span>
      <button class="album-act" data-act="photo-share" data-id="${esc(p.id)}" aria-label="存到手機或分享">${SHARE}</button>`;
  }
  // 照片下方（愛心、留言）有變動時只更新這一塊，打到一半的留言不會不見
  function refreshPhotoPanel() {
    const p = findById(state.photos, state.photoId);
    if (!p) return;
    const box = document.getElementById('album-comments');
    if (box) { box.innerHTML = commentsHtml(state.photoId); box.scrollTop = box.scrollHeight; }
    const bar = document.getElementById('album-likebar');
    if (bar) bar.innerHTML = likeBarHtml(p);
  }

  // 看一張照片：先顯示小圖，原圖讀到再換上；上面是第幾張、誰放的，下面是愛心、說明、留言
  async function openPhoto(id) {
    const p = findById(state.photos, id);
    if (!p) return;
    // 在看某一天時：上一張、下一張只在這一天的照片裡切換
    const base = state.albumDay ? albumList().filter((x) => x.date === state.albumDay) : albumList();
    const list = base.includes(p) ? base : state.albumDay ? state.photos.filter((x) => x.date === p.date) : state.photos;
    state.photoId = id;
    const i = list.indexOf(p);
    const prev = list[i - 1], next = list[i + 1];
    const who = member(p.author);
    zoom = { scale: 1, x: 0, y: 0 };
    document.body.classList.add('sheet-open');
    $sheet.innerHTML = `
      <div class="album-view ${state.slideshow ? 'playing' : ''}" role="dialog" aria-label="照片">
        <div class="album-top">
          <button class="album-x" data-act="close-photo" aria-label="關閉">×</button>
          <span class="album-pos">${i + 1} / ${list.length}</span>
          ${canEditPhoto(p) ? `<button class="link-btn" data-act="edit-photo" data-id="${esc(p.id)}">編輯</button>` : ''}
          ${canDeletePhoto(p) ? `<button class="link-btn" data-act="del-photo" data-id="${esc(p.id)}">刪除</button>` : ''}
        </div>
        <div class="album-stage" data-act="photo-stage" data-id="${esc(p.id)}">
          <img src="${esc(fullImages.get(p.image_id) || p.thumb)}" alt="${esc(p.caption || '照片')}" class="${fullImages.has(p.image_id) ? '' : 'loading'}">
          <span class="album-pop" aria-hidden="true">${HEART}</span>
          ${prev ? `<button class="album-step prev" data-act="open-photo" data-id="${esc(prev.id)}" aria-label="上一張">‹</button>` : ''}
          ${next ? `<button class="album-step next" data-act="open-photo" data-id="${esc(next.id)}" aria-label="下一張">›</button>` : ''}
          ${state.slideshow ? '<button class="album-stop" data-act="album-stop">停止播放</button>' : ''}
        </div>
        <div class="album-panel">
          <div class="album-who">
            ${who ? avatarHtml(who, 'sm') : ''}<b>${esc(nameOf(p.author))}</b><time>${shortDate(p.date)}</time>
            ${(p.people || []).filter(member).map((u) => `<span class="who" style="--who:${esc(colorOf(u))}">${esc(nameOf(u))}</span>`).join('')}
          </div>
          ${p.caption ? `<p class="album-caption">${esc(p.caption)}</p>` : ''}
          <div class="album-likebar" id="album-likebar">${likeBarHtml(p)}</div>
          <div id="album-comments">${commentsHtml(id)}</div>
          <form class="shop-add" id="album-comment-form">
            <input name="text" type="text" placeholder="留言…" maxlength="200" autocomplete="off" enterkeyhint="send" aria-label="留言">
            <button type="submit" class="send" aria-label="送出留言">${ICON.send || ICON.plus}</button>
          </form>
        </div>
      </div>`;
    try {
      const data = await fullImage(p);
      const el = $sheet.querySelector('.album-stage img');
      if (state.photoId === id && el && data) { el.src = data; el.classList.remove('loading'); }
    } catch (e) { console.error(e); toast('原圖讀取失敗'); }
    [prev, next].forEach((x) => { if (x) fullImage(x).catch(() => {}); });
    if (state.slideshow) {
      clearTimeout(state.slideshow);
      state.slideshow = setTimeout(() => {
        if (!state.slideshow || state.photoId !== id) return;
        if (next) openPhoto(next.id); else { stopSlideshow(); toast('播放完了'); }
      }, 4000);
    }
  }
  function closePhoto() {
    stopSlideshow(true);
    state.photoId = null;
    $sheet.innerHTML = '';
    document.body.classList.remove('sheet-open');
    render();
  }
  // 幻燈片：從篩選後的第一張開始，每 4 秒換一張
  function startSlideshow() {
    const list = state.albumDay ? albumList().filter((x) => x.date === state.albumDay) : albumList();
    if (!list.length) return;
    state.slideshow = -1;
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { if (state.slideshow) state.slideWake = w; else w.release(); }).catch(() => {});
    openPhoto(list[0].id);
  }
  function stopSlideshow(quiet) {
    if (!state.slideshow) return;
    clearTimeout(state.slideshow);
    state.slideshow = 0;
    if (state.slideWake) { state.slideWake.release().catch(() => {}); state.slideWake = null; }
    if (!quiet && state.photoId) openPhoto(state.photoId);
  }

  async function toggleLike(id, onlyOn) {
    const p = findById(state.photos, id);
    if (!p) return;
    const key = p.id + '_' + state.userId;
    const mine = likedByMe(p.id);
    if (mine && onlyOn) return;
    // 先在畫面上變，伺服器慢一點也不會卡
    if (mine) state.photoLikes = state.photoLikes.filter((l) => !(l.photo_id === p.id && l.uid === state.userId));
    else state.photoLikes = state.photoLikes.concat({ id: key, photo_id: p.id, month: p.month, uid: state.userId, created_at: Date.now() });
    refreshPhotoPanel();
    try {
      if (mine) await Api.deleteDoc('photo_likes', key);
      else await Api.setDoc('photo_likes', key, { photo_id: p.id, month: p.month, uid: state.userId, created_at: Date.now() });
    } catch (e) { console.error(e); toast('沒有成功，請再試一次'); }
  }
  // 雙擊照片＝按愛心（只會按上去，不會收回），中間跳出一顆大愛心
  let lastStageTap = 0;
  function onStageTap(el) {
    if (state.slideshow) return stopSlideshow();
    const now = Date.now();
    if (now - lastStageTap < 320) {
      lastStageTap = 0;
      toggleLike(el.dataset.id, true);
      const pop = $sheet.querySelector('.album-pop');
      if (pop) { pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show'); }
    } else lastStageTap = now;
  }

  // 存到手機：用 iPhone 的分享選單（可以選「儲存影像」）；不支援時提示長按照片。
  // iPhone 規定分享要在「按下去的當下」呼叫，所以檔案直接從記憶體裡的原圖做，不等網路。
  function dataUrlFile(data, name) {
    const [head, b64] = data.split(',');
    const mime = (head.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  }
  function sharePhoto(id) {
    const p = findById(state.photos, id);
    if (!p) return;
    try {
      const file = dataUrlFile(fullImages.get(p.image_id) || p.thumb, '鍾家相簿-' + p.date + '.jpg');
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: p.caption || '鍾家相簿' })
          .catch((e) => { if (!e || e.name !== 'AbortError') toast('長按照片就可以儲存到手機'); });
        return;
      }
    } catch (e) { console.warn(e); }
    toast('長按照片就可以儲存到手機');
  }

  async function onPhotoComment(form) {
    const input = form.elements.text;
    const text = input.value.trim();
    const p = findById(state.photos, state.photoId);
    if (!text || !p) return;
    input.value = '';
    try {
      const data = { photo_id: p.id, month: p.month, text, author: state.userId, created_by: state.userId, created_at: Date.now() };
      await Api.addDoc('photo_comments', data);        // 即時監聽會把新留言帶進畫面
    } catch (e) { console.error(e); input.value = text; toast('留言沒有送出，請再試一次'); }
  }

  async function onDeleteComment(btn) {
    const c = state.photoComments.find((x) => x.id === btn.dataset.id);
    if (!c || c.author !== state.userId) return;          // 留言只能刪自己的
    try {
      await Api.deleteDoc('photo_comments', btn.dataset.id);
      state.photoComments = state.photoComments.filter((x) => x.id !== btn.dataset.id);
      refreshPhotoPanel();
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
      state.photoLikes.filter((l) => l.photo_id === p.id).forEach((l) => Api.deleteDoc('photo_likes', l.id).catch(() => {}));
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
      : tr.error === 'bad-key' ? (isAdmin() ? 'TDX 不接受這組金鑰。請到 TDX 網站的「會員中心 → 資料服務 → API 金鑰」確認金鑰還在、沒有被停用，再到「設定」的「交通查詢」重新貼一次。' : '交通查詢的設定有問題，請爸爸檢查。')
      : tr.error === 'busy' ? '查詢太頻繁了，請過一分鐘再試。'
      : tr.error === 'no-function' ? (isAdmin() ? '查詢用的雲端函式還沒部署好。請重新下載 ZIP、雙擊 deploy.bat，等它顯示 Done 之後再試。' : '交通查詢還沒設定好，請爸爸到電腦上完成部署。')
      : tr.error === 'denied' ? '這個帳號沒有查詢的權限，請重新登入後再試。'
      : tr.error === 'tdx' ? (/tdx-token/.test(tr.errorDetail) ? '交通部 TDX 平臺現在沒辦法驗證金鑰，可能是平臺暫時有狀況，請過幾分鐘再試。' : '交通部 TDX 平臺現在沒有回應這筆資料，請稍後再試。')
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
      tr.errorDetail = (code + ' ' + msg).trim().slice(0, 200);
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
    if (data && tr.station && tr.station.id === id) { tr.board = data.trains; tr.boardDiag = data.diag || '（伺服器是舊版，請重新執行 deploy.bat）'; tr.updatedAt = Date.now(); }
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
    return search + (tr.loading && !tr.favEtas.length && !tr.favs.bus.length ? '<div class="skel-wrap" role="status" aria-label="查詢中"><div class="skel row sm"></div><div class="skel row sm"></div><div class="skel row sm"></div></div>' : '') + (tr.favs.bus.length ? `
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
    if (!tr.stations) return tr.loading ? '<div class="skel-wrap" role="status" aria-label="查詢中"><div class="skel row sm"></div><div class="skel row sm"></div><div class="skel row sm"></div></div>' : '';
    // 常用車站排前面，後面補上新竹附近的幾個站
    const quick = tr.favs.tra.concat(TRA_DEFAULT.map((n) => tr.stations.find((s) => s.name === n)).filter((x) => x && !tr.favs.tra.some((f) => f.id === x.id)));
    const q = tr.traQ.trim();
    const s = tr.station;
    const isFav = s && tr.favs.tra.some((x) => x.id === s.id);
    const now = clock(Date.now());
    // 只留還沒開走的車（含誤點），最多列出接下來的 15 班
    const trains = (tr.board || []).filter((t) => addMinutes(t.time, t.delay || 0) >= now).slice(0, 15);
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
        ${!tr.board ? '<div class="skel-wrap" role="status" aria-label="查詢中"><div class="skel row sm"></div><div class="skel row sm"></div><div class="skel row sm"></div></div>' : trains.length ? trains.map((t) => `
          <div class="transit-row train">
            <span class="train-time">${esc(t.time)}</span>
            <span class="transit-main">往 ${esc(t.to)}<small>${esc(t.type)}　${esc(t.no)} 次</small></span>
            <span class="eta ${t.delay === null || t.delay === undefined ? 'off' : t.delay > 0 ? 'late' : 'ok'}">${t.delay === null || t.delay === undefined ? '表定' : t.delay > 0 ? '晚 ' + t.delay + ' 分' : '準點'}</span>
          </div>`).join('') : `<p class="none">今天接下來已經沒有這一站的班次了。</p>${isAdmin() && !(tr.board || []).length ? `<p class="transit-diag">查詢紀錄（管理員才看得到）：${esc(tr.boardDiag || '')}</p>` : ''}`}
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
    if (holdForIme(el, refreshShop)) return;
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
        toast('完成！下次是 ' + shortDate(next)); celebrate();
      } else { if (!item.done) celebrate(); await Api.updateDoc('shopping', id, { done: !item.done, done_by: item.done ? null : state.userId, done_at: item.done ? null : Date.now() }); }
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
  // 資料卡：家長新增的只有家長看得到；小朋友可以新增自己的，只有自己和家長看得到。
  // 家長可以改所有的卡；小朋友只能改自己新增的。
  const canEditCard = (c) => !amChild() || c.created_by === state.userId;
  function viewCards() {
    const child = amChild();
    if (!state.cards.length) return `
      <header class="plain-head"><h1>資料卡</h1></header>
      <div class="empty big">
        <p>${child ? '還沒有你的資料卡。學號、置物櫃密碼、社團資料，都可以記在這裡，只有你和爸媽看得到。'
          : '還沒有資料卡。健保卡號、學號、過敏與用藥、緊急聯絡人，都可以放在這裡。小朋友看不到家長新增的卡。'}</p>
      </div>`;
    const groups = [['', '全家']].concat(state.members.map((m) => [m.id, m.display_name]));
    return `
      <header class="plain-head"><h1>資料卡</h1><p>${child ? '只有你和爸媽看得到' : '小朋友只看得到自己新增的'}</p></header>
      ${groups.map(([id, label]) => {
        const cards = state.cards.filter((c) => (member(c.member) ? c.member : '') === id)
          .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
        if (!cards.length) return '';
        return `
          <section class="card-group" style="--who:${id ? esc(colorOf(id)) : 'var(--green)'}">
            <h2>${esc(label)}</h2>
            ${cards.map((c) => {
              const byKid = c.created_by && isChildId(c.created_by);
              const inner = `
                <span class="info-title">${esc(c.title)}${!child && byKid ? `<small class="info-by">${esc(nameOf(c.created_by))}新增</small>` : ''}</span>
                <span class="info-body">${esc(c.body)}</span>`;
              return canEditCard(c) ? `<button data-act="edit-card" data-id="${esc(c.id)}" class="info-card">${inner}</button>` : `<div class="info-card">${inner}</div>`;
            }).join('')}
          </section>`;
      }).join('')}`;
  }
  function openCardSheet(card) {
    const child = amChild();
    const c = card || { title: '', member: child ? state.userId : '', body: '' };
    const who = child ? state.members.filter((m) => m.id === state.userId) : state.members;
    showSheet('card-form', {
      title: card ? '編輯資料卡' : '新增資料卡', focus: !card, footer: card ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(c.id || '')}">
      <input class="title-input" name="title" placeholder="標題，例如：${child ? '學校資料' : '健保與醫療'}" value="${esc(c.title)}" maxlength="40" autocomplete="off">
      <fieldset class="seg">
        <legend>這是誰的資料？</legend>
        ${child ? '' : `<label style="--cat:var(--green)"><input type="radio" name="member" value="" ${!member(c.member) ? 'checked' : ''}><span>全家</span></label>`}
        ${who.map((m) => `
          <label style="--cat:${esc(m.color)}"><input type="radio" name="member" value="${esc(m.id)}" ${c.member === m.id ? 'checked' : ''}><span>${esc(m.display_name)}</span></label>`).join('')}
      </fieldset>
      <label>內容<textarea name="body" rows="8" maxlength="2000" placeholder="${child ? '學號：&#10;班級座號：&#10;置物櫃密碼：' : '健保卡號：&#10;血型：&#10;過敏：&#10;固定用藥：&#10;緊急聯絡人：'}">${esc(c.body)}</textarea></label>
      <p class="hint">${child ? '這張卡只有你和爸媽看得到。' : card && card.created_by && isChildId(card.created_by) ? '這張卡是' + esc(nameOf(card.created_by)) + '新增的，他也看得到。' : '家長新增的資料卡，小朋友看不到。'}</p>`
    });
  }

  function refreshPosts() {
    refreshTodos();
    const el = document.getElementById('post-list');
    if (!el) return;
    if (holdForIme(el, refreshPosts)) return;
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
  // ---------- 讀書計畫 ----------
  // 每一項是 study_items 的一筆：{ kid, sub 科目, title, note, date, minutes 預計分鐘, done, spent 實際分鐘, exam_id, series, created_by }
  // 每週重複的在新增時就展開成好幾筆（同一個 series），每一天各自打勾。
  // 爸媽的鼓勵是 study_cheers：{ kid, from, kind: like|text, text, date }
  const STUDY_DEFAULT_SUBJECTS = ['國文', '數學', '英文', '自然', '社會'];
  const STUDY_COLORS = { 國文: '#C2410C', 數學: '#2F6FDE', 英文: '#8A4FD0', 自然: '#1F8A5F', 社會: '#8A5A1F', 理化: '#0E7C86', 生物: '#3F8F3A', 地理: '#9C6B2F', 歷史: '#A1442E', 公民: '#5B6BB0', 作文: '#B4466B' };
  const STUDY_PALETTE = ['#2F6FDE', '#C2410C', '#8A4FD0', '#1F8A5F', '#8A5A1F', '#0E7C86', '#B4466B', '#5B6BB0'];
  const STUDY_MINUTES = [20, 30, 45, 60, 90];
  const STUDY_CHEERS = ['今天很認真', '加油，快完成了', '早點睡', '休息一下再繼續'];
  const studySubjects = () => {
    const custom = state.subjects.map((x) => x.label);
    return custom.length ? custom : STUDY_DEFAULT_SUBJECTS;
  };
  function studyColor(sub) {
    if (STUDY_COLORS[sub]) return STUDY_COLORS[sub];
    let h = 0;
    for (const ch of String(sub)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return STUDY_PALETTE[h % STUDY_PALETTE.length];
  }
  const studyChip = (sub) => `<span class="st-chip" style="--sub:${esc(studyColor(sub))}">${esc(sub)}</span>`;
  const weekStartOf = (d) => addDays(d, -((parse(d).getDay() + 6) % 7));   // 一週從星期一開始
  const studyKid = () => (amChild() ? state.userId : (member(state.studyKid) && state.studyKid) || (kids()[0] || {}).id || null);
  const studyOf = (kid, date) => state.studyItems.filter((x) => x.kid === kid && (!date || x.date === date))
    .sort((a, b) => (a.done - b.done) || (a.created_at || 0) - (b.created_at || 0));
  const minText = (m) => (m >= 60 ? Math.floor(m / 60) + ' 小時' + (m % 60 ? ' ' + (m % 60) + ' 分' : '') : m + ' 分鐘');
  // 這位小朋友接下來的考試（行事曆裡類型是「考試」、標註了他或沒標註人）
  function studyExams(kid) {
    const seen = new Set();
    return state.upcoming.filter((e) => e.category === 'exam' && e.event_date >= today()
      && (!e.member_ids || !e.member_ids.length || e.member_ids.includes(kid)))
      .filter((e) => { const k = (e.series ? e.series.id : e.id) + e.event_date; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }
  // 連續幾天：從今天（今天還沒讀完就從昨天）往回數，每天都有排而且全部打勾
  function studyStreak(kid) {
    let n = 0, d = today();
    const day = (x) => studyOf(kid, x);
    if (day(d).some((x) => !x.done) || !day(d).length) d = addDays(d, -1);
    for (let i = 0; i < 60; i++, d = addDays(d, -1)) {
      const list = day(d);
      if (!list.length) { if (i === 0) continue; break; }
      if (list.some((x) => !x.done)) break;
      n++;
    }
    return n;
  }
  function studyWeekStats(kid, start) {
    const end = addDays(start, 6);
    const list = state.studyItems.filter((x) => x.kid === kid && x.date >= start && x.date <= end);
    const done = list.filter((x) => x.done);
    const missed = [];
    for (let d = start; d < today() && d <= end; d = addDays(d, 1)) {
      if (list.some((x) => x.date === d && !x.done)) missed.push('週' + WEEKDAYS[parse(d).getDay()]);
    }
    return { total: list.length, done: done.length, minutes: done.reduce((n, x) => n + (Number(x.spent) || Number(x.minutes) || 0), 0), missed };
  }

  // ---- 專心計時：存在手機上，離開 App 也繼續算 ----
  const TIMER_KEY = 'family-study-timer';
  let studyTimer = null;
  try { studyTimer = JSON.parse(localStorage.getItem(TIMER_KEY)); } catch (e) { /* 沒有 */ }
  let timerWake = null;
  const timerSec = () => (studyTimer ? Math.max(0, Math.floor((Date.now() - studyTimer.start) / 1000)) : 0);
  const mmss = (sec) => pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
  function startStudyTimer(id) {
    studyTimer = { id, start: Date.now() };
    try { localStorage.setItem(TIMER_KEY, JSON.stringify(studyTimer)); } catch (e) { /* 存不了 */ }
    render();            // 那一項換成「專心中」
    openTimerSheet();
  }
  function clearStudyTimer() {
    studyTimer = null;
    try { localStorage.removeItem(TIMER_KEY); } catch (e) { /* 沒關係 */ }
    if (timerWake) { timerWake.release().catch(() => {}); timerWake = null; }
  }
  function openTimerSheet() {
    const x = studyTimer && findById(state.studyItems, studyTimer.id);
    if (!x) { clearStudyTimer(); return; }
    showSheet('study-timer', {
      title: '專心計時', readonly: true,
      body: `
      <div class="st-timer" style="--sub:${esc(studyColor(x.sub))}">
        <div class="st-timer-sub">${studyChip(x.sub)}<b>${esc(x.title)}</b></div>
        <div class="st-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="track"/><circle cx="60" cy="60" r="52" class="bar" id="st-ring-bar" pathLength="100" stroke-dasharray="0 100"/></svg>
          <div><span id="st-clock" role="timer" aria-live="off">${mmss(timerSec())}</span><small>目標 ${x.minutes} 分鐘</small></div>
        </div>
        <p class="hint" id="st-timer-hint">手機可以放著，離開 App 也會繼續算。</p>
        <div class="st-timer-btns">
          <button type="button" class="btn primary" data-act="study-timer-done">讀完了</button>
          <button type="button" class="btn" data-act="study-timer-stop">先停下來</button>
        </div>
        <button type="button" class="link-btn" data-act="study-timer-cancel">不要記錄，取消計時</button>
      </div>`
    });
    if (navigator.wakeLock && !timerWake) navigator.wakeLock.request('screen').then((w) => { timerWake = w; }).catch(() => {});
    tickTimer();
  }
  function tickTimer() {
    const el = document.getElementById('st-clock');
    const x = studyTimer && findById(state.studyItems, studyTimer.id);
    if (el && x) {
      const sec = timerSec();
      el.textContent = mmss(sec);
      const bar = document.getElementById('st-ring-bar');
      if (bar) bar.setAttribute('stroke-dasharray', Math.min(100, sec / 60 / x.minutes * 100).toFixed(1) + ' 100');
      if (sec >= x.minutes * 60) { const h = document.getElementById('st-timer-hint'); if (h) h.textContent = '已經達到目標時間了，讀完就按「讀完了」。'; }
    }
    document.querySelectorAll('[data-timer]').forEach((pill) => { pill.textContent = '專心中 ' + mmss(timerSec()); });
  }
  setInterval(() => { if (studyTimer) tickTimer(); }, 1000);
  async function finishStudyTimer(markDone) {
    const x = studyTimer && findById(state.studyItems, studyTimer.id);
    const mins = Math.max(1, Math.round(timerSec() / 60));
    clearStudyTimer(); closeSheet();
    if (!x) return;
    try {
      await Api.updateDoc('study_items', x.id, { spent: Math.min(1440, (Number(x.spent) || 0) + mins), ...(markDone ? { done: true, done_at: Date.now() } : {}) });
      toast(markDone ? '記下了 ' + mins + ' 分鐘，完成！' : '記下了 ' + mins + ' 分鐘');
    } catch (e) { console.error(e); toast('沒有記錄成功，請再試一次'); }
  }

  // ---- 畫面 ----
  function studyRowHtml(x, canEdit, canTime) {
    const running = studyTimer && studyTimer.id === x.id;
    const meta = [x.note ? esc(x.note) : '', x.spent ? '讀了 ' + x.spent + ' 分' : ''].filter(Boolean).join('・');
    return `
      <div class="st-row ${x.done ? 'done' : ''}" style="--sub:${esc(studyColor(x.sub))}">
        <button class="st-check" data-act="study-done" data-id="${esc(x.id)}" aria-pressed="${!!x.done}" aria-label="${esc(x.title)}，${x.done ? '已完成，按一下取消' : '按一下完成'}" ${canEdit ? '' : 'disabled'}>
          <svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="11.5"/><path d="M8 13.5l3.2 3.2L18 9.8"/></svg>
        </button>
        <${canEdit ? `button class="st-main" data-act="study-edit" data-id="${esc(x.id)}"` : 'div class="st-main"'}>
          <span class="st-title">${studyChip(x.sub)}<b>${esc(x.title)}</b></span>
          ${meta ? `<span class="st-meta">${meta}</span>` : ''}
        </${canEdit ? 'button' : 'div'}>
        ${running ? `<button class="st-run" data-act="study-timer-open" data-timer>專心中 ${mmss(timerSec())}</button>`
          : canTime && !x.done ? `<button class="st-time" data-act="study-timer" data-id="${esc(x.id)}" aria-label="開始專心計時">${x.minutes} 分<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.500z"/></svg></button>`
            : `<span class="st-min">${x.minutes} 分</span>`}
      </div>`;
  }
  function studyRings(kid, start) {
    const r = 13, c = 2 * Math.PI * r;
    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i), list = studyOf(kid, d);
      const p = list.length ? list.filter((x) => x.done).length / list.length : 0;
      const isSel = d === state.studyDay, isToday = d === today();
      html += `
        <button class="st-day ${isSel ? 'sel' : ''} ${isToday ? 'today' : ''} ${list.length && p === 1 ? 'full' : ''}" data-act="study-day" data-date="${d}" aria-pressed="${isSel}" aria-label="${shortDate(d)}，${list.length ? '完成 ' + Math.round(p * 100) + '%' : '沒有安排'}">
          <span>${WEEKDAYS[parse(d).getDay()]}</span>
          <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="${r}" class="track"/>${list.length ? `<circle cx="16" cy="16" r="${r}" class="bar" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}"/>` : ''}<text x="16" y="20.500">${parse(d).getDate()}</text></svg>
        </button>`;
    }
    return `<div class="st-week">${html}</div>`;
  }
  function studyExamCard(kid) {
    const ex = studyExams(kid)[0];
    if (!ex) return `
      <section class="st-exam none">
        <div><b>最近沒有考試</b><span>在行事曆加一個「考試」，這裡就會倒數。</span></div>
      </section>`;
    const left = daysBetween(today(), ex.event_date);
    const linked = state.studyItems.filter((x) => x.kid === kid && x.exam_id === ex.id);
    const p = linked.length ? Math.round(linked.filter((x) => x.done).length / linked.length * 100) : 0;
    return `
      <section class="st-exam" aria-label="考試倒數">
        <div class="st-count"><small>${left === 0 ? '就是' : '還有'}</small><b>${left === 0 ? '今天' : left}</b><small>${left === 0 ? '' : '天'}</small></div>
        <div class="st-exam-main">
          <b>${esc(ex.title)}</b>
          <span>${shortDate(ex.event_date)}${ex.note ? '・' + esc(ex.note) : ''}</span>
          ${linked.length ? `<div class="st-bar"><i style="width:${p}%"></i></div><em>準備 ${p}%（${linked.filter((x) => x.done).length}／${linked.length} 項）</em>`
            : '<em class="soft">還沒有為這次考試排計畫</em>'}
        </div>
        ${left > 0 ? `<button class="ai-btn st-ai" data-act="study-ai" data-exam="${esc(ex.id)}">AI 排計畫</button>` : ''}
      </section>`;
  }
  function studyKidCards() {
    const start = weekStartOf(today());
    return `<div class="st-kids">${kids().map((k) => {
      const s = studyWeekStats(k.id, start), sel = k.id === studyKid();
      const t = studyOf(k.id, today());
      return `
        <button class="st-kid ${sel ? 'sel' : ''}" data-act="study-kid" data-id="${esc(k.id)}" aria-pressed="${sel}">
          <span class="st-kid-head">${avatarHtml(k, 'sm')}<b>${esc(k.display_name)}</b></span>
          <span class="st-kid-num">${s.done}<small> / ${s.total} 項</small></span>
          <span class="st-bar"><i style="width:${s.total ? Math.round(s.done / s.total * 100) : 0}%"></i></span>
          <span class="st-kid-sub">這週讀了 ${minText(s.minutes)}・連續 ${studyStreak(k.id)} 天</span>
          <span class="st-kid-warn ${s.missed.length ? 'late' : ''}">${s.missed.length ? s.missed.slice(-2).join('、') + '沒有打勾' : t.length ? '今天 ' + t.filter((x) => x.done).length + '／' + t.length : '今天沒有安排'}</span>
        </button>`;
    }).join('')}</div>`;
  }
  function studyCheersHtml(kid) {
    const list = state.studyCheers.filter((c) => c.kid === kid && c.date >= addDays(today(), -6)).sort((a, b) => b.created_at - a.created_at).slice(0, 3);
    if (!list.length) return '';
    return `<section class="st-cheers" aria-label="爸媽的鼓勵">${list.map((c) => {
      const m = member(c.from);
      return `<div class="st-cheer">${m ? avatarHtml(m, 'sm') : ''}<p><b>${esc(nameOf(c.from))}${c.kind === 'like' ? '按了讚' : ''}</b>${c.kind === 'like' && c.text === '讚' ? '' : '：' + esc(c.text)}<small>${stamp(c.created_at)}</small></p>
        ${c.from === state.userId ? `<button class="link-btn" data-act="study-cheer-del" data-id="${esc(c.id)}" aria-label="收回這則鼓勵">收回</button>` : ''}</div>`;
    }).join('')}</section>`;
  }
  function viewStudy() {
    const kid = studyKid();
    const child = amChild();
    if (!kid) return `<header class="plain-head"><h1>讀書計畫</h1></header><div class="empty big"><p>家裡還沒有設定小朋友。到「設定 → 家人」把小朋友的帳號標成小朋友，這裡就能用了。</p></div>`;
    const k = member(kid);
    const canTime = kid === state.userId;
    const day = state.studyDay || today();
    const start = weekStartOf(day);
    let html = `
      <header class="plain-head"><h1>讀書計畫</h1><p>${child ? '只有你和爸媽看得到' : '小朋友的讀書進度'}</p></header>
      ${child ? '' : studyKidCards()}
      ${studyExamCard(kid)}
      <div class="switcher st-switch" role="group" aria-label="檢視">
        <button class="${state.studyMode !== 'week' ? 'on' : ''}" data-act="study-mode" data-mode="day" aria-pressed="${state.studyMode !== 'week'}">每天</button>
        <button class="${state.studyMode === 'week' ? 'on' : ''}" data-act="study-mode" data-mode="week" aria-pressed="${state.studyMode === 'week'}">這週</button>
      </div>`;
    if (state.studyMode === 'week') {
      const list = state.studyItems.filter((x) => x.kid === kid && x.date >= start && x.date <= addDays(start, 6));
      const by = {};
      list.forEach((x) => { by[x.sub] = (by[x.sub] || 0) + (Number(x.minutes) || 0); });
      const total = Object.values(by).reduce((a, b) => a + b, 0);
      html += `
        <div class="st-weekhead">
          <h2>${shortDate(start).replace(/（.*/, '')} – ${shortDate(addDays(start, 6)).replace(/（.*/, '')}</h2>
          <span>完成 ${list.filter((x) => x.done).length}／${list.length}</span>
          <button class="icon-btn" data-act="study-week" data-step="-7" aria-label="上一週">‹</button>
          <button class="icon-btn" data-act="study-week" data-step="7" aria-label="下一週">›</button>
        </div>
        ${total ? `
        <section class="st-sum">
          <b>這週安排 ${minText(total)}</b>
          <div class="st-stack">${Object.keys(by).map((s) => `<i style="flex:${by[s]};background:${esc(studyColor(s))}" title="${esc(s)}"></i>`).join('')}</div>
          <div class="st-legend">${Object.keys(by).map((s) => `<span><i style="background:${esc(studyColor(s))}"></i>${esc(s)} ${by[s]} 分</span>`).join('')}</div>
        </section>` : ''}`;
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i), items = studyOf(kid, d);
        if (!items.length) continue;
        html += `
          <section class="st-list ${d === today() ? 'is-today' : ''}">
            <h3>${shortDate(d)}${d === today() ? '<span class="st-today">今天</span>' : ''}<small>${items.reduce((n, x) => n + (Number(x.minutes) || 0), 0)} 分鐘</small></h3>
            ${items.map((x) => studyRowHtml(x, true, canTime && d === today())).join('')}
          </section>`;
      }
      if (!list.length) html += `<div class="empty"><p>這週還沒有安排。按下面的「新增讀書項目」，或請 AI 排到考試前。</p></div>`;
    } else {
      const items = studyOf(kid, day);
      const left = items.filter((x) => !x.done).reduce((n, x) => n + (Number(x.minutes) || 0), 0);
      const rel = day === today() ? '今天' : day === addDays(today(), 1) ? '明天' : day === addDays(today(), -1) ? '昨天' : '';
      html += studyRings(kid, start) + `
        <section class="st-list">
          <h3>${rel ? rel + ' ' : ''}${shortDate(day)}<small>${items.length ? '完成 ' + items.filter((x) => x.done).length + '／' + items.length + (left ? '・還要約 ' + minText(left) : '・全部完成 🎉') : ''}</small></h3>
          ${items.length ? items.map((x) => studyRowHtml(x, true, canTime && day === today())).join('')
            : `<p class="none">${day < today() ? '這天沒有安排。' : '這天還沒有安排。按下面的「新增讀書項目」。'}</p>`}
        </section>`;
    }
    html += studyCheersHtml(kid);
    if (!child) html += `
      <section class="st-give" aria-label="給${esc(k.display_name)}鼓勵">
        <h3>給${esc(k.display_name)}鼓勵</h3>
        <div class="st-give-btns">
          <button class="st-like" data-act="study-cheer" data-kind="like" data-text="讚">👍 按讚</button>
          ${STUDY_CHEERS.map((t) => `<button data-act="study-cheer" data-kind="text" data-text="${esc(t)}">${esc(t)}</button>`).join('')}
        </div>
        <form class="reply-form st-cheer-form" id="study-cheer-form">
          <input name="text" type="text" maxlength="100" placeholder="留一句話給${esc(k.display_name)}" autocomplete="off" enterkeyhint="send" aria-label="留一句話">
          <button type="submit" class="send sm" aria-label="送出">${ICON.send}</button>
        </form>
      </section>`;
    return html;
  }
  function studyHubNote() {
    const t = today();
    if (amChild()) {
      const list = studyOf(state.userId, t), ex = studyExams(state.userId)[0];
      const a = list.length ? `今天 ${list.filter((x) => x.done).length}／${list.length} 項` : '今天還沒有安排';
      return ex ? `${a}　<em>${esc(ex.title)}還有 ${daysBetween(t, ex.event_date)} 天</em>` : a;
    }
    const parts = kids().map((k) => { const l = studyOf(k.id, t); return l.length ? esc(k.display_name) + ' ' + l.filter((x) => x.done).length + '／' + l.length : ''; }).filter(Boolean);
    return parts.length ? '今天：' + parts.join('、') : '小朋友的讀書計畫和進度';
  }

  // ---- 新增、編輯 ----
  function openStudySheet(item) {
    const kid = item ? item.kid : studyKid();
    if (!kid) return;
    const k = member(kid);
    const x = item || { sub: studySubjects()[0], title: '', note: '', minutes: 30, date: state.studyDay && state.studyDay >= today() ? state.studyDay : today(), exam_id: '' };
    const exams = studyExams(kid);
    const subs = Array.from(new Set(studySubjects().concat(x.sub ? [x.sub] : [])));
    const wd = parse(x.date).getDay();
    showSheet('study-form', {
      title: item ? '編輯讀書項目' : (kid === state.userId ? '新增讀書項目' : '幫' + k.display_name + '加讀書項目'), focus: !item,
      footer: item ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(x.id || '')}">
      <input type="hidden" name="kid" value="${esc(kid)}">
      <fieldset class="seg st-subs">
        <legend>科目</legend>
        ${subs.map((s) => `<label style="--cat:${esc(studyColor(s))}"><input type="radio" name="sub" value="${esc(s)}" ${x.sub === s ? 'checked' : ''}><span>${esc(s)}</span></label>`).join('')}
      </fieldset>
      <label>要讀什麼<input class="title-input" name="title" value="${esc(x.title)}" maxlength="60" placeholder="例如：第四章 例題" autocomplete="off"></label>
      <label>範圍或方法（可不填）<input name="note" value="${esc(x.note || '')}" maxlength="200" placeholder="例如：課本 p.53–60，錯的抄到訂正本" autocomplete="off"></label>
      <fieldset class="seg">
        <legend>大約要多久</legend>
        ${Array.from(new Set(STUDY_MINUTES.concat([Number(x.minutes) || 30]))).sort((a, b) => a - b).map((m) => `<label style="--cat:var(--green)"><input type="radio" name="minutes" value="${m}" ${Number(x.minutes) === m ? 'checked' : ''}><span>${m} 分</span></label>`).join('')}
      </fieldset>
      <div class="row two">
        <label>哪一天<input type="date" name="date" value="${esc(x.date)}"></label>
        <label>為了哪一次考試
          <select name="exam_id">
            <option value="">不是為了考試</option>
            ${exams.map((e) => `<option value="${esc(e.id)}" ${x.exam_id === e.id || (!item && exams[0] === e) ? 'selected' : ''}>${esc(e.title)} ${shortDate(e.event_date).replace(/（.*/, '')}</option>`).join('')}
          </select>
        </label>
      </div>
      ${item ? '' : `
      <label class="switch"><span>每週重複</span><input type="checkbox" name="repeat"></label>
      <div id="st-repeat" hidden>
        <div class="weekday-pick">${WEEKDAYS.map((w, i) => `<label><input type="checkbox" name="wd" value="${i}" ${i === wd ? 'checked' : ''}><span>${w}</span></label>`).join('')}</div>
        <label>重複到哪一天<input type="date" name="until" value="${esc(exams[0] ? addDays(exams[0].event_date, -1) : addDays(x.date, 27))}"></label>
        <p class="hint">會在這段期間的每一個勾選的星期各排一項，每一天各自打勾。</p>
      </div>`}
      ${kid !== state.userId ? `<p class="hint">${esc(k.display_name)}會在讀書計畫看到這一項。</p>` : ''}`
    });
  }
  // 「每週重複」打開時才顯示星期和結束日期
  document.addEventListener('change', (ev) => {
    if (ev.target.name === 'repeat' && ev.target.closest('#study-form')) { const r = document.getElementById('st-repeat'); if (r) r.hidden = !ev.target.checked; }
  });

  // ---- AI 排計畫 ----
  let studyDraft = null;
  async function sendStudyCheer(kind, text) {
    const kid = studyKid();
    if (!kid || amChild()) return;
    try {
      await Api.addDoc('study_cheers', { kid, from: state.userId, kind, text, date: today(), created_at: Date.now() });
      toast(kind === 'like' ? '已按讚，' + nameOf(kid) + '會收到通知' : '已送出');
    } catch (e) { console.error(e); toast('沒有送出，請確認已經執行過最新的 deploy.bat'); }
  }
  function openStudyAiSheet(examId) {
    const kid = studyKid(), k = member(kid);
    const exams = studyExams(kid);
    const ex = exams.find((e) => e.id === examId) || exams[0];
    if (!ex) return toast('先在行事曆加一個「考試」');
    showSheet('study-ai-form', {
      title: '請 AI 排讀書計畫', submit: '開始排',
      body: `
      <input type="hidden" name="exam_id" value="${esc(ex.id)}">
      <p class="hint">${esc(k.display_name)}・${esc(ex.title)} ${shortDate(ex.event_date)}・從今天排到考試前一天（${daysBetween(today(), ex.event_date)} 天）</p>
      <label>各科考試範圍<textarea name="range" rows="5" maxlength="1500" placeholder="國文：第五、六課&#10;數學：第三、四章&#10;英文：Unit 4–6&#10;自然：第四章">${esc(ex.note || '')}</textarea></label>
      <fieldset class="seg">
        <legend>每天大約可以讀多久</legend>
        ${[30, 60, 90, 120].map((m) => `<label style="--cat:var(--green)"><input type="radio" name="minutes" value="${m}" ${m === 60 ? 'checked' : ''}><span>${minText(m)}</span></label>`).join('')}
      </fieldset>
      <p class="hint">會把考試名稱、日期、範圍和科目送到 Google Gemini。排出來的是草稿，你勾選要的再加進計畫，之後都可以改。</p>`
    });
  }
  function openStudyDraftSheet() {
    if (!studyDraft) return;
    const by = {};
    studyDraft.items.forEach((x, i) => { (by[x.date] = by[x.date] || []).push([x, i]); });
    showSheet('study-draft-form', {
      title: 'AI 排的讀書計畫', submit: '加入計畫',
      body: `
      <p class="hint">共 ${studyDraft.items.length} 項，勾選的會加進計畫。</p>
      ${Object.keys(by).sort().map((d) => `
        <h3 class="ai-day">${shortDate(d)}<span>${by[d].reduce((n, [x]) => n + x.minutes, 0)} 分鐘</span></h3>
        <div class="call-pick">
          ${by[d].map(([x, i]) => `
          <label class="call-pick-row ai-pick">
            <span class="plan-main"><span class="plan-title">${studyChip(x.sub)} ${esc(x.title)}</span>${x.note ? `<span class="plan-note">${esc(x.note)}・${x.minutes} 分</span>` : `<span class="plan-note">${x.minutes} 分</span>`}</span>
            <input type="checkbox" name="pick" value="${i}" checked><span class="check" aria-hidden="true"></span>
          </label>`).join('')}
        </div>`).join('')}
      ${studyDraft.tips.length ? `<h3 class="ai-day">小提醒</h3><ul class="ai-tips">${studyDraft.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`
    });
  }

  // ---------- 影片 ----------
  // 爸媽挑好的 YouTube 影片，在 App 裡用嵌入播放器看，不開 YouTube App。
  //   videos        { yt_id, title, channel, duration 秒, cat, note, to[] 給誰看, status ok|pending|rejected, requested_by, reason, added_by, notify }
  //   video_views   {影片id_UID_日期}：{ video_id, kid, date, seconds, finished, title }，只記小朋友的
  //   video_limits  {小朋友UID}：{ minutes }，每天可以看多久；0 是不限制，沒設定過是 60
  // 播放時整個播放器蓋一層透明的擋板，點不到 YouTube 的標題、標誌和片尾推薦；播完由 App 自己換成「看完了」。
  const VIDEO_CATS = { 學習: '#2F6FDE', 英文: '#8A4FD0', 科學: '#1F8A5F', 放鬆: '#C2410C' };
  const videoChip = (c) => (c ? `<span class="st-chip" style="--sub:${esc(VIDEO_CATS[c] || '#5C6A64')}">${esc(c)}</span>` : '');
  const parseYouTube = (url) => {
    const s = String(url || '').trim();
    const m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/.exec(s);
    return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : null;
  };
  const ytThumb = (id) => 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg';
  const durText = (sec) => (sec > 0 ? Math.floor(sec / 60) + ':' + pad(Math.floor(sec % 60)) : '');
  const videoLimit = (kid) => { const l = findById(state.videoLimits, kid); return l ? Number(l.minutes) || 0 : 60; };
  let vp = null;   // 正在播放的影片（播放畫面開著時才有）
  function watchedToday(kid) {
    const key = vp && vp.kid === kid ? vp.viewId : null;
    return state.videoViews.filter((v) => v.kid === kid && v.date === today() && v.id !== key).reduce((n, v) => n + (Number(v.seconds) || 0), 0)
      + (key ? vp.base + vp.acc : 0);
  }
  const videoLeft = (kid) => (videoLimit(kid) === 0 ? Infinity : Math.max(0, videoLimit(kid) * 60 - watchedToday(kid)));
  const vLeftText = (sec) => (sec === Infinity ? '' : '今天還可以看 ' + Math.ceil(sec / 60) + ' 分鐘');
  const myVideos = () => state.videos.filter((v) => v.status === 'ok' && (!amChild() || v.to.includes(state.userId))).sort((a, b) => b.created_at - a.created_at);
  const seenVideo = (v, kid) => state.videoViews.some((x) => x.video_id === v.id && x.kid === kid);
  const doneVideo = (v, kid) => state.videoViews.some((x) => x.video_id === v.id && x.kid === kid && x.finished);

  // 依加進清單的月份分組（新的月份在前）。合起來／展開記在 state.vdMonths['list:2026-11'] 這種 key
  const vMonth = (v) => { const d = new Date(v.created_at || Date.now()); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const vMonthLabel = (k) => k.slice(0, 4) + ' 年 ' + Number(k.slice(5)) + ' 月';
  function byMonth(list) {
    const groups = [];
    list.forEach((v) => { const k = vMonth(v); let g = groups.find((x) => x.key === k); if (!g) groups.push(g = { key: k, items: [] }); g.items.push(v); });
    return groups.sort((a, b) => b.key.localeCompare(a.key));
  }
  // where：list（影片頁，最新的月份預設展開）或 vp（播放頁，全部預設合起來）
  function monthOpen(where, key, first) {
    const k = where + ':' + key;
    return k in state.vdMonths ? state.vdMonths[k] : (where === 'list' && first);
  }
  function monthHead(where, g, open, extra) {
    return `<button class="vd-month-head" data-act="vd-month" data-key="${esc(where + ':' + g.key)}" aria-expanded="${open}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><b>${vMonthLabel(g.key)}</b>${extra || ''}<small>${g.items.length} 部</small></button>`;
  }
  function thumbHtml(v, cls) {
    return `<span class="vd-thumb ${cls || ''}"><img src="${esc(ytThumb(v.yt_id))}" alt="" loading="lazy"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.500v13l10.500-6.500z"/></svg></i>${v.duration ? `<b>${durText(v.duration)}</b>` : ''}</span>`;
  }
  function videoCardHtml(v) {
    const child = amChild();
    const isNew = child && !seenVideo(v, state.userId), done = child && doneVideo(v, state.userId);
    return `
      <article class="vd-card">
        <button class="vd-play" data-act="vd-open" data-id="${esc(v.id)}" aria-label="播放：${esc(v.title)}">${thumbHtml(v)}</button>
        <${child ? 'div' : `button data-act="vd-edit" data-id="${esc(v.id)}"`} class="vd-info">
          <span class="vd-tags">${videoChip(v.cat)}${isNew ? '<em class="new">新</em>' : ''}${done ? '<em class="seen">✓ 看過了</em>' : ''}${child ? '' : `<small>給 ${esc(v.to.map(nameOf).join('、'))}</small>`}</span>
          <b>${esc(v.title)}</b>
          <small>${esc(v.channel || '')}${v.duration ? '・' + Math.max(1, Math.round(v.duration / 60)) + ' 分鐘' : ''}</small>
          ${v.note ? `<span class="vd-note"><b>${esc(nameOf(v.added_by))}</b>：${esc(v.note)}</span>` : ''}
        </${child ? 'div' : 'button'}>
      </article>`;
  }
  function viewVideo() {
    const child = amChild();
    const pending = state.videos.filter((v) => v.status === 'pending');
    let html = `<header class="plain-head"><h1>影片</h1><p>${child ? '爸媽挑給你看的' : '挑給小朋友看的 YouTube 影片'}</p></header>`;
    if (state.videoReady === false) html += `<p class="vd-warn">${isAdmin() ? '影片功能還沒開通：資料庫還不認得它，所以加了也存不進去、看不到。請用最新的 family-app.zip 執行一次 deploy.bat，完成後重新打開 App。' : '影片功能還沒開通，請跟管理員說。'}</p>`;
    if (!child) html += `
      <div class="switcher st-switch" role="group" aria-label="檢視">
        <button class="${state.videoMode !== 'manage' ? 'on' : ''}" data-act="vd-mode" data-mode="list" aria-pressed="${state.videoMode !== 'manage'}">影片清單</button>
        <button class="${state.videoMode === 'manage' ? 'on' : ''}" data-act="vd-mode" data-mode="manage" aria-pressed="${state.videoMode === 'manage'}">管理${pending.length ? `<span class="badge">${pending.length}</span>` : ''}</button>
      </div>`;
    if (!child && state.videoMode === 'manage') {
      const views = state.videoViews.filter((x) => x.date === today()).sort((a, b) => (b.at || 0) - (a.at || 0));
      return html + `
        <section class="st-list vd-reqs">
          <h3>想看的申請</h3>
          ${pending.length ? pending.map((v) => `
            <div class="vd-req">
              <button class="vd-req-main" data-act="vd-open" data-id="${esc(v.id)}" aria-label="先看看：${esc(v.title)}">${thumbHtml(v, 'sm')}
                <span><small><b>${esc(nameOf(v.requested_by))}</b> 想看</small><b>${esc(v.title)}</b><small>${esc(v.channel || '')}</small></span></button>
              ${v.reason ? `<p>「${esc(v.reason)}」</p>` : ''}
              <div class="vd-req-btns"><button class="btn" data-act="vd-review" data-id="${esc(v.id)}" data-status="rejected">先不要</button><button class="btn primary" data-act="vd-review" data-id="${esc(v.id)}" data-status="ok">可以看</button></div>
            </div>`).join('') : '<p class="none">目前沒有申請。點縮圖可以先自己看過再決定。</p>'}
        </section>
        <section class="st-list">
          <h3>今天看了什麼</h3>
          ${views.length ? views.map((x) => `<div class="vd-log"><b>${esc(nameOf(x.kid))}</b><span>${esc(x.title || (findById(state.videos, x.video_id) || {}).title || '影片')}</span><small>${Math.max(1, Math.round(x.seconds / 60))} 分・${clock(x.at || Date.now())}</small><em class="${x.finished ? 'ok' : ''}">${x.finished ? '看完' : '看一部分'}</em></div>`).join('')
            : '<p class="none">今天還沒有人看影片。</p>'}
        </section>
        <section class="st-list vd-limits">
          <h3>每天可以看多久</h3>
          ${kids().map((k) => `
            <div class="vd-limit"><b>${esc(k.display_name)}</b><small>今天看了 ${Math.round(watchedToday(k.id) / 60)} 分</small>
              <button class="icon-btn" data-act="vd-limit" data-kid="${esc(k.id)}" data-step="-10" aria-label="減少 10 分鐘">−</button>
              <span>${videoLimit(k.id) ? videoLimit(k.id) + ' 分' : '不限制'}</span>
              <button class="icon-btn" data-act="vd-limit" data-kid="${esc(k.id)}" data-step="10" aria-label="增加 10 分鐘">+</button></div>`).join('')}
          <p class="hint">減到 0 就是不限制。時間到了，播放中的影片會自動停下來。</p>
        </section>`;
    }
    const list = myVideos();
    const cats = Array.from(new Set(list.map((v) => v.cat).filter(Boolean)));
    const shown = list.filter((v) => !state.videoCat || v.cat === state.videoCat);
    if (child && videoLimit(state.userId)) {
      const used = watchedToday(state.userId), lim = videoLimit(state.userId) * 60;
      html += `
        <section class="vd-quota">
          <div><b>${used >= lim ? '今天的時間用完了，明天再看' : `今天還可以看 <em>${Math.ceil((lim - used) / 60)}</em> 分鐘`}</b><span class="st-bar"><i style="width:${Math.min(100, Math.round(used / lim * 100))}%"></i></span></div>
          <small>已看 ${Math.round(used / 60)}／${videoLimit(state.userId)} 分</small>
        </section>`;
    }
    if (cats.length > 1) html += `<div class="vd-cats" role="group" aria-label="分類">${[''].concat(cats).map((c) => `<button class="${(state.videoCat || '') === c ? 'on' : ''}" data-act="vd-cat" data-cat="${esc(c)}" aria-pressed="${(state.videoCat || '') === c}">${esc(c || '全部')}</button>`).join('')}</div>`;
    html += shown.length ? byMonth(shown).map((g, i) => {
        const open = monthOpen('list', g.key, i === 0);
        const fresh = child ? g.items.filter((v) => !seenVideo(v, state.userId)).length : 0;
        return `<section class="vd-month ${open ? 'open' : ''}">${monthHead('list', g, open, fresh ? `<em class="new">${fresh} 部新的</em>` : '')}${open ? `<div class="vd-grid">${g.items.map(videoCardHtml).join('')}</div>` : ''}</section>`;
      }).join('')
      : `<div class="empty big"><p>${child ? '爸媽還沒有挑影片。看到想看的，可以按下面的「我想看這部」。' : '還沒有影片。按下面的「加一部影片」，貼上 YouTube 連結。'}</p></div>`;
    if (child) {
      const mine = state.videos.filter((v) => v.requested_by === state.userId && v.status !== 'ok');
      if (mine.length) html += `
        <section class="st-list">
          <h3>我想看的</h3>
          ${mine.map((v) => `<div class="vd-log"><span>${esc(v.title)}</span><em class="${v.status === 'pending' ? '' : 'no'}">${v.status === 'pending' ? '等爸媽看看' : '爸媽說先不要'}</em><button class="link-btn" data-act="vd-req-del" data-id="${esc(v.id)}">${v.status === 'pending' ? '取消' : '知道了'}</button></div>`).join('')}
        </section>`;
    }
    return html;
  }
  // 資料庫還不認得「影片」（還沒用新的 ZIP 執行 deploy.bat）時，讀取會被擋：在頁面上直接講清楚
  async function checkVideoReady() {
    try { await Api.listDocs('video_limits'); if (state.videoReady !== true) { state.videoReady = true; if (state.notesView === 'video') render(); } }
    catch (e) { console.warn('影片還沒開通', e); state.videoReady = false; if (state.tab === 'notes' && state.notesView === 'video') render(); }
  }
  function videoHubNote() {
    if (amChild()) {
      const n = myVideos().filter((v) => !seenVideo(v, state.userId)).length;
      const left = videoLeft(state.userId);
      return (n ? `<em>${n} 部新影片</em>　` : '') + (left === Infinity ? '爸媽挑給你看的影片' : left ? '今天還可以看 ' + Math.ceil(left / 60) + ' 分鐘' : '今天的時間用完了');
    }
    const p = state.videos.filter((v) => v.status === 'pending').length;
    return p ? `<em>${p} 個想看的申請</em>` : state.videos.length ? state.videos.filter((v) => v.status === 'ok').length + ' 部影片' : '挑 YouTube 影片給小朋友在這裡看';
  }

  // ---- 加影片、申請想看 ----
  let videoDraft = null, videoLookupTimer = null;
  function openVideoSheet(v) {
    if (!v && state.videoReady === false) return toast('影片功能還沒開通，請先執行 deploy.bat');
    const child = amChild();
    videoDraft = v ? { yt_id: v.yt_id, title: v.title, channel: v.channel || '', ok: true } : null;
    const x = v || { to: kids().map((k) => k.id), cat: '學習', note: '' };
    showSheet('video-form', {
      title: v ? '編輯影片' : child ? '我想看這部' : '加一部影片', submit: v ? '儲存' : child ? '送給爸媽' : '加入', focus: !v,
      footer: v ? DELETE_BTN : '',
      body: `
      <input type="hidden" name="item_id" value="${esc(x.id || '')}">
      ${v ? '' : `
      <label>YouTube 連結
        <span class="vd-url"><input type="url" name="yt_url" placeholder="貼上 YouTube 的分享連結" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url">
        <button type="button" class="btn small" data-act="vd-paste">貼上</button></span>
      </label>`}
      <div id="vd-preview">${videoDraft ? videoPreviewHtml() : '<p class="hint">在 YouTube 按「分享 → 複製連結」，再貼到上面。</p>'}</div>
      ${child ? `
      <label>為什麼想看（可不填）<input name="reason" maxlength="200" placeholder="例如：同學推薦的科學實驗" autocomplete="off"></label>
      <p class="hint">爸媽同意之後，這部影片才會出現在你的清單。</p>` : `
      <fieldset class="people">
        <legend>給誰看</legend>
        ${kids().map((k) => `<label style="--who:${esc(k.color)}"><input type="checkbox" name="to" value="${esc(k.id)}" ${x.to.includes(k.id) ? 'checked' : ''}><span>${esc(k.display_name)}</span></label>`).join('')}
      </fieldset>
      <fieldset class="seg">
        <legend>分類</legend>
        ${Object.keys(VIDEO_CATS).map((c) => `<label style="--cat:${VIDEO_CATS[c]}"><input type="radio" name="cat" value="${c}" ${x.cat === c ? 'checked' : ''}><span>${c}</span></label>`).join('')}
      </fieldset>
      <label>想跟他們說的話（可不填）<input name="note" value="${esc(x.note || '')}" maxlength="200" placeholder="例如：看完跟我說你學到什麼" autocomplete="off"></label>
      ${v ? '' : '<label class="switch"><span>加入後通知他們</span><input type="checkbox" name="notify" checked></label>'}`}`
    });
  }
  function videoPreviewHtml() {
    const d = videoDraft;
    if (!d) return '';
    if (d.loading) return '<p class="hint" role="status">正在查這部影片…</p>';
    if (d.error) return `<p class="form-error">${esc(d.error)}</p>`;
    return `
      <div class="vd-preview">${thumbHtml(d, 'sm')}
        <span>${d.manual ? '' : `<b>${esc(d.title)}</b><small>${esc(d.channel)}</small>`}<em>${d.manual ? '連結沒問題。查不到標題，請在下面自己填' : '✓ 可以在 App 裡播放'}</em></span>
      </div>
      ${d.manual ? '<label>影片標題<input name="manual_title" maxlength="200" autocomplete="off"></label>' : ''}`;
  }
  async function lookupVideo() {
    const form = document.getElementById('video-form'), box = document.getElementById('vd-preview');
    if (!form || !box || !form.elements.yt_url) return;
    const id = parseYouTube(form.elements.yt_url.value);
    const draw = () => { const b = document.getElementById('vd-preview'); if (b) b.innerHTML = videoPreviewHtml(); };
    if (!id) { videoDraft = form.elements.yt_url.value.trim() ? { error: '這不像 YouTube 的影片連結，請再複製一次。' } : null; box.innerHTML = videoDraft ? videoPreviewHtml() : ''; return; }
    if (videoDraft && videoDraft.yt_id === id && !videoDraft.error) return;
    if (state.videos.some((v) => v.yt_id === id && v.status !== 'rejected')) { videoDraft = { error: '這部影片已經在清單或申請裡了。' }; return draw(); }
    const mine = videoDraft = { yt_id: id, loading: true };
    draw();
    try {
      const r = await Promise.race([Api.videoInfo(id), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 8000))]);
      if (videoDraft !== mine) return;
      videoDraft = r.ok ? { yt_id: id, title: r.title, channel: r.channel, ok: true }
        : { error: r.reason === 'no-embed' ? '這部影片的作者不允許在其他地方播放，不能加進來。' : '找不到這部影片，可能已經被刪除或設成不公開。' };
    } catch (e) {
      console.error(e);
      if (videoDraft !== mine) return;
      videoDraft = { yt_id: id, title: '', channel: '', ok: true, manual: true };
    }
    draw();
  }

  // ---- 播放 ----
  const $video = document.createElement('div');
  $video.id = 'video-root'; $video.hidden = true;
  document.body.appendChild($video);
  let ytLoading = null;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (!ytLoading) ytLoading = new Promise((resolve, reject) => {
      const fail = () => { ytLoading = null; reject(new Error('youtube')); };
      window.onYouTubeIframeAPIReady = () => resolve();
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api'; s.onerror = fail;
      document.head.appendChild(s);
      setTimeout(() => { if (!(window.YT && window.YT.Player)) fail(); }, 12000);
    });
    return ytLoading;
  }
  function openPlayer(id) {
    const v = findById(state.videos, id);
    if (!v) return;
    const kid = amChild() ? state.userId : null;
    if (kid && videoLeft(kid) <= 0) return toast('今天看影片的時間用完了，明天再看');
    closeSheet();
    const viewId = kid ? v.id + '_' + kid + '_' + today() : null;
    const old = viewId && findById(state.videoViews, viewId);
    vp = { id: v.id, kid, viewId, base: old ? Number(old.seconds) || 0 : 0, acc: 0, saved: 0, lastT: -1, stuck: 0, mode: 'poster', player: null, started: false, finished: !!(old && old.finished) };
    $video.hidden = false;
    document.body.classList.add('video-open');
    drawPlayer();
  }
  function drawPlayer() {
    const v = vp && findById(state.videos, vp.id);
    if (!v) return closePlayer();
    // 其他也標給同一個小朋友的影片（小朋友看到的是標給自己的），只列標題
    const more = vpOthers(v);
    $video.innerHTML = `
      <div class="vp" role="dialog" aria-modal="true" aria-label="${esc(v.title)}">
        <div class="vp-top"><button class="vp-back" data-act="vp-close">‹ 影片</button><span id="vp-left">${vp.kid ? vLeftText(videoLeft(vp.kid)) : ''}</span></div>
        <div class="vp-screen" id="vp-screen">
        <div class="vp-stage" id="vp-stage">
          <div id="vp-frame"></div>
          <div class="vp-guard top" aria-hidden="true"></div><div class="vp-guard bottom" aria-hidden="true"></div>
          <button class="vp-cover" id="vp-cover" data-act="vp-toggle" aria-label="暫停" hidden></button>
          <button class="vp-poster" id="vp-poster" data-act="vp-start" aria-label="開始播放"><img src="${esc(ytThumb(v.yt_id))}" alt=""><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.500v13l10.500-6.500z"/></svg></i></button>
        </div>
        <div class="vp-ctrl" id="vp-ctrl" hidden>
          <button data-act="vp-seek" data-step="-10" aria-label="倒退 10 秒">−10</button>
          <button class="main" data-act="vp-toggle" id="vp-pp" aria-label="暫停">❚❚</button>
          <button data-act="vp-seek" data-step="10" aria-label="快轉 10 秒">+10</button>
          <input type="range" id="vp-bar" min="0" max="1000" value="0" aria-label="播放進度">
          <span id="vp-time">0:00</span>
          <button data-act="vp-big" id="vp-big" aria-label="放大到全螢幕"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
        </div>
        <p class="vp-hint" id="vp-hint" hidden></p>
        </div>
        <div class="vp-body">
          <div class="vp-meta">${videoChip(v.cat)}<small>${esc(v.channel || '')}</small></div>
          <h2>${esc(v.title)}</h2>
          ${v.note ? `<p class="vd-note big"><b>${esc(nameOf(v.added_by))}說</b>：${esc(v.note)}</p>` : ''}
          ${v.status === 'pending' ? `<p class="hint">這是${esc(nameOf(v.requested_by))}申請想看的影片，看過再決定要不要同意。</p>` : ''}
          ${more ? `<section class="vp-more" id="vp-more">${more}</section>` : ''}
          <p class="hint">影片開頭或中間可能會有 YouTube 的廣告，這個 App 擋不掉。</p>
        </div>
      </div>`;
  }
  // 播放頁下面的「其他影片」：也標給同一個小朋友的（小朋友看到的是標給自己的），依月份合起來，只列標題
  function vpOthers(v) {
    const who = vp.kid ? [vp.kid] : (v.to || []);
    const others = myVideos().filter((x) => x.id !== v.id && (!who.length || (x.to || []).some((k) => who.includes(k))));
    if (!others.length) return '';
    const title = vp.kid ? '爸媽挑的其他影片' : who.length ? '也標給' + who.map(nameOf).join('、') + '的其他影片' : '清單裡的其他影片';
    return `<h3>${esc(title)}（${others.length}）</h3>` + byMonth(others).map((g) => {
      const open = monthOpen('vp', g.key, false);
      return `<div class="vd-month ${open ? 'open' : ''}">${monthHead('vp', g, open)}${open ? `<ul>${g.items.map((x) => `<li><button data-act="vd-open" data-id="${esc(x.id)}"><i aria-hidden="true">▶</i><span>${esc(x.title)}</span></button></li>`).join('')}</ul>` : ''}</div>`;
    }).join('');
  }
  const vpEl = (id) => document.getElementById(id);
  function vpHint(text, btn) {
    const el = vpEl('vp-hint');
    if (!el) return;
    el.hidden = !text;
    el.innerHTML = text ? esc(text) + (btn ? ` <button class="link-btn" data-act="vp-unlock">${esc(btn)}</button>` : '') : '';
  }
  async function startPlayer() {
    const v = vp && findById(state.videos, vp.id);
    if (!v || vp.player) return;
    const mine = vp;
    const poster = vpEl('vp-poster');
    if (poster) poster.classList.add('loading');
    try { await loadYT(); }
    catch (e) { if (vp === mine) { if (poster) poster.classList.remove('loading'); vpHint('播放器載入不了，請確認網路後再按一次。'); } return; }
    if (vp !== mine || !vpEl('vp-frame')) return;
    vp.player = new window.YT.Player('vp-frame', {
      videoId: v.yt_id, host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%',
      playerVars: { autoplay: 1, playsinline: 1, controls: 0, rel: 0, fs: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, origin: location.origin },
      events: {
        onReady: () => { if (vp !== mine) return; const p = vpEl('vp-poster'); if (p) p.hidden = true; vpHint('如果沒有自動開始，點一下影片中間的播放鍵。'); try { vp.player.playVideo(); } catch (e) { /* 等使用者自己點 */ } },
        onStateChange: (ev) => { if (vp === mine) onPlayerState(ev.data); },
        onError: (ev) => { if (vp !== mine) return; showStage(`<div class="vp-msg"><b>這部影片不能在這裡播放</b><span>${[101, 150].includes(ev.data) ? '作者不允許在其他地方播放。' : '影片可能已經被刪除或設成不公開。'}</span></div>`); }
      }
    });
  }
  function onPlayerState(s) {
    const cover = vpEl('vp-cover'), ctrl = vpEl('vp-ctrl'), pp = vpEl('vp-pp');
    if (s === 1) {              // 播放中：整個蓋住，點到的都是我們自己的暫停
      vp.started = true; vp.mode = 'playing'; vp.stuck = 0;
      if (cover) { cover.hidden = false; cover.className = 'vp-cover'; cover.setAttribute('aria-label', '暫停'); }
      if (ctrl) ctrl.hidden = false;
      if (pp) { pp.textContent = '❚❚'; pp.setAttribute('aria-label', '暫停'); }
      vpHint('');
    } else if (s === 2 && vp.started) {   // 暫停：蓋上不透明的一層，看不到 YouTube 暫停時的推薦影片
      vp.mode = 'paused';
      if (cover) { cover.hidden = false; cover.className = 'vp-cover paused'; cover.setAttribute('aria-label', '繼續播放'); }
      if (pp) { pp.textContent = '▶'; pp.setAttribute('aria-label', '繼續播放'); }
      flushView(false);
    } else if (s === 0) finishPlayer();
  }
  // 全螢幕：iPhone 不讓網頁 App 真的進全螢幕，所以自己把播放區放大到整個畫面；手機直拿時轉成橫的。擋板照樣蓋著。
  function setBig(on) {
    const sc = vpEl('vp-screen'), b = vpEl('vp-big');
    if (!sc) return;
    sc.classList.toggle('big', on);
    if (b) b.setAttribute('aria-label', on ? '離開全螢幕' : '放大到全螢幕');
  }
  function togglePlayer() {
    if (!vp || !vp.player) return;
    try {
      if (vp.mode === 'playing') return vp.player.pauseVideo();
      vp.player.playVideo();
      // 有些手機不讓 App 代按播放：等一下還沒開始，就把擋板拿開，讓人直接點影片中間
      const mine = vp;
      setTimeout(() => {
        if (vp !== mine || vp.mode === 'playing') return;
        const cover = vpEl('vp-cover'); if (cover) cover.hidden = true;
        vpHint('點一下影片中間的播放鍵繼續。');
      }, 1500);
    } catch (e) { console.warn(e); }
  }
  function showStage(html) {
    if (vp && vp.player) { try { vp.player.destroy(); } catch (e) { /* 已經沒了 */ } vp.player = null; }
    const stage = vpEl('vp-stage'), ctrl = vpEl('vp-ctrl');
    if (stage) stage.innerHTML = html;
    if (ctrl) ctrl.hidden = true;
    setBig(false);
    vpHint('');
    if (vp) vp.mode = 'done';
  }
  function finishPlayer() {
    const v = vp && findById(state.videos, vp.id);
    if (!v) return;
    vp.finished = true;
    flushView(true);
    showStage(`
      <div class="vp-msg done"><svg viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="25"/><path d="M17 28l7 7 13-15"/></svg><b>看完了！</b>
        <div class="vp-msg-btns"><button class="btn" data-act="vd-open" data-id="${esc(v.id)}">再看一次</button><button class="btn primary" data-act="vp-close">回到清單</button></div>
      </div>`);
    if (vp.kid && v.note) {
      const body = $video.querySelector('.vp-body');
      if (body) body.insertAdjacentHTML('afterbegin', `
        <form class="reply-form vp-answer" id="vp-answer">
          <input name="text" type="text" maxlength="300" placeholder="回答${esc(nameOf(v.added_by))}（會傳到聊天室）" autocomplete="off" enterkeyhint="send" aria-label="回答">
          <button type="submit" class="send sm" aria-label="送出">${ICON.send}</button>
        </form>`);
    }
  }
  // 把這次看的秒數記下來（只記小朋友的）
  function flushView(finished) {
    if (!vp || !vp.kid || (vp.acc === vp.saved && !finished)) return;
    const v = findById(state.videos, vp.id);
    vp.saved = vp.acc;
    Api.setDoc('video_views', vp.viewId, { video_id: vp.id, kid: vp.kid, date: today(), seconds: Math.min(86400, Math.round(vp.base + vp.acc)), finished: !!(vp.finished || finished), title: v ? v.title.slice(0, 80) : '', at: Date.now() })
      .catch((e) => console.warn('觀看紀錄沒存到', e));
  }
  function closePlayer() {
    if (vp) { flushView(false); if (vp.player) { try { vp.player.destroy(); } catch (e) { /* 已經沒了 */ } } }
    vp = null;
    $video.innerHTML = ''; $video.hidden = true;
    document.body.classList.remove('video-open');
    if (state.tab === 'notes' && (state.notesView === 'video' || state.notesView === 'hub')) render();
  }
  // 每秒：算觀看時間、更新進度、檢查每天的上限、猜是不是卡在廣告
  setInterval(() => {
    if (!vp || !vp.player || typeof vp.player.getCurrentTime !== 'function') return;
    let t = 0, dur = 0, s = -1;
    try { t = vp.player.getCurrentTime() || 0; dur = vp.player.getDuration() || 0; s = vp.player.getPlayerState(); } catch (e) { return; }
    if (s === 1 && t > vp.lastT && t - vp.lastT < 3) { if (vp.kid) vp.acc += 1; vp.stuck = 0; }
    else if (s === 1 || s === 3 || (s === -1 && vp.started)) vp.stuck += 1;
    vp.lastT = t;
    const bar = vpEl('vp-bar'), time = vpEl('vp-time');
    if (bar && dur && document.activeElement !== bar) bar.value = Math.round(t / dur * 1000);
    if (time) time.textContent = durText(t) || '0:00';
    const v = findById(state.videos, vp.id);
    if (v && dur > 1 && !v.duration && !vp.durSaved) { vp.durSaved = true; Api.updateDoc('videos', v.id, { duration: Math.round(dur) }).catch(() => {}); }
    if (vp.stuck === 8) vpHint('畫面停住了？可能是廣告。', '讓我按「略過廣告」');
    if (vp.kid) {
      if (vp.acc - vp.saved >= 20) flushView(false);
      const left = videoLeft(vp.kid), el = vpEl('vp-left');
      if (el) el.textContent = vLeftText(left);
      if (left <= 0) {
        try { vp.player.pauseVideo(); } catch (e) { /* 沒關係 */ }
        flushView(false);
        showStage('<div class="vp-msg"><b>今天的時間用完了</b><span>明天再繼續看。</span><div class="vp-msg-btns"><button class="btn primary" data-act="vp-close">回到清單</button></div></div>');
      }
    }
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && vp && vp.player && vp.mode === 'playing') { try { vp.player.pauseVideo(); } catch (e) { /* 沒關係 */ } } });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'vp-bar' && vp && vp.player) { try { const d = vp.player.getDuration() || 0; vp.lastT = -1; vp.player.seekTo(d * Number(ev.target.value) / 1000, true); } catch (e) { /* 沒關係 */ } }
    if (ev.target.name === 'yt_url' && ev.target.closest('#video-form')) { clearTimeout(videoLookupTimer); videoLookupTimer = setTimeout(lookupVideo, 500); }
  });
  function onVideoData() {
    refreshBadges();
    if (state.tab !== 'notes' || $sheet.innerHTML) return;
    if (state.notesView === 'video' || state.notesView === 'hub') { const sc = scroller(), y = sc ? sc.scrollTop : 0; render(); if (scroller()) scroller().scrollTop = y; }
  }

  const HUB = [
    ['butler', '家庭小管家', '#1F6B52', '<path d="M12 4l1.800 4.700L18.500 10.500l-4.700 1.800L12 17l-1.800-4.700L5.500 10.500l4.700-1.800z"/><path d="M18.500 15.500l.700 1.800 1.800.700-1.800.700-.700 1.800-.700-1.800-1.800-.700 1.800-.700z"/>'],
    ['study', '讀書計畫', '#2F6FDE', '<path d="M4 5.500C6.500 4.500 9 4.500 12 6.500c3-2 5.500-2 8-1v13c-2.500-1-5-1-8 1-3-2-5.500-2-8-1z"/><path d="M12 6.500v13"/>'],
    ['video', '影片', '#E0443E', '<rect x="3.500" y="5.500" width="17" height="13" rx="3"/><path d="M10 9.500v5l4.500-2.500z"/>'],
    ['ledger', '零用錢', '#34A853', '<path d="M4 8.500A2.500 2.500 0 0 1 6.500 6H17a2 2 0 0 1 2 2v1"/><rect x="4" y="9" width="16" height="10" rx="2.500"/><circle cx="15.500" cy="14" r="1.300" fill="#fff" stroke="none"/>'],
    ['scores', '成績', '#F29D0B', '<path d="M5 19V11M10 19V5M15 19v-6M20 19V8"/>'],
    ['notes', '旅遊', '#0E9AA7', '<path d="M3.500 12.500l17-7.500-6 15-3-6z"/><path d="M11.500 14l3-3"/>'],
    ['album', '相簿', '#E5557A', '<rect x="3.500" y="5" width="17" height="14" rx="2.500"/><circle cx="9" cy="10" r="1.700"/><path d="M4.500 17l4.500-4 3.500 3 3-2.500 4 3.500"/>'],
    ['transit', '交通', '#3B7BF6', '<rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M8 20l1-3M16 20l-1-3"/><circle cx="8.500" cy="14" r=".900" fill="#fff" stroke="none"/><circle cx="15.500" cy="14" r=".900" fill="#fff" stroke="none"/>'],
    ['checkins', '報平安紀錄', '#D93B30', '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.500"/>'],
    ['shop', '待辦', '#8E5CF7', '<path d="M4 7l1.600 1.600L8.500 5.500M4 13.500l1.600 1.600 2.900-3.100"/><path d="M11.500 7.200h8.500M11.500 13.700h8.500M11.500 19h8.500"/>'],
    ['cards', '資料卡', '#6B7A90', '<rect x="3.500" y="5.500" width="17" height="13" rx="2.500"/><circle cx="9" cy="11" r="2"/><path d="M6.500 16c.500-1.500 4.500-1.500 5 0M14.500 10h3.500M14.500 13.500h3.500"/>']
  ];
  function hubNote(id) {
    if (id === 'ledger') {
      const n = state.requests.filter((r) => r.status !== 'given').length;
      return n ? `<em>${n} 筆費用${amChild() ? '等爸媽給' : '還沒給'}</em>` : amChild() ? '記支出、跟爸媽申請費用' : '小朋友的記帳本';
    }
    if (id === 'butler') return '什麼都可以問，也查得到家裡的紀錄';
    if (id === 'study') return studyHubNote();
    if (id === 'video') return videoHubNote();
    if (id === 'scores') return amChild() ? '只有你和爸媽看得到' : '考試成績紀錄';
    if (id === 'notes') {
      const next = state.trips.filter((t) => t.end_date >= today()).sort((x, y) => x.start_date.localeCompare(y.start_date))[0];
      return next ? `${esc(next.title)}　<em>${tripStatus(next).text}</em>` : state.trips.length ? state.trips.length + ' 趟旅程' : '行程、日誌、行李、花費';
    }
    if (id === 'album') return '日常照片，按月份看';
    if (id === 'checkins') { const n = ciList().filter((c) => ciDate(c) === today()).length; return n ? `<em>今天 ${n} 筆</em>` : amChild() ? '你報過的平安，最近 30 天' : '小朋友最近 30 天的紀錄和位置'; }
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
    const views = { video: viewVideo, study: viewStudy, butler: viewButler, ledger: viewLedger, scores: viewScores, notes: viewTravel, album: viewAlbum, checkins: viewCheckins, transit: viewTransit, shop: viewShop, cards: viewCards };
    const view = views[state.notesView];
    if (!view) return viewHub();
    // 旅程裡面、公車路線裡面已經有自己的「返回」，就不再多放一個
    const inner = (state.notesView === 'album' && (state.albumDay || state.albumId || state.albumYear)) || (state.notesView === 'notes' && state.tripId && tripOf(state.tripId)) || (state.notesView === 'transit' && state.transit.mode === 'bus' && state.transit.route);
    return (inner ? '' : '<button class="link-btn back hub-back" data-act="notes-view" data-view="hub">‹ 鍾家生活</button>') + view();
  }

  // ---------- 零用錢記帳本 ----------
  // 每位小朋友一本。家長可以記「給零用錢」和支出，也能修改任何一筆；
  // 小朋友只看得到自己的帳本，只能新增、修改、刪除自己的支出。
  const canEditLedger = (e) => !amChild() || (e.kid === state.userId && e.type === 'expense' && !e.by_parent);
  // 零用錢紀錄新增後 1 小時內可以改、可以刪，之後就鎖住。只有管理員不受限制。沒有記下新增時間的舊紀錄一律算鎖住（管理員除外）。
  const LEDGER_LOCK_MS = 3600000;
  function createdMs(e) {
    const c = e && e.created_at;
    if (typeof c === 'number') return c;
    if (c && typeof c.toMillis === 'function') return c.toMillis();
    if (c && typeof c.seconds === 'number') return c.seconds * 1000;
    return 0;
  }
  const ledgerLeftMs = (e) => (isAdmin() ? Infinity : createdMs(e) + LEDGER_LOCK_MS - Date.now());
  function leftText(ms) {
    const min = Math.max(1, Math.ceil(ms / 60000));
    return min >= 60 ? Math.floor(min / 60) + ' 小時' + (min % 60 ? ' ' + (min % 60) + ' 分' : '') : min + ' 分鐘';
  }

  setInterval(() => {
    const el = document.getElementById('del-left');
    if (!el || !el.dataset.until) return;
    const left = Number(el.dataset.until) - Date.now();
    if (left > 0) { el.textContent = '還有 ' + leftText(left) + '可以修改或刪除'; return; }
    const f = document.getElementById('ledger-form'), e = f && findById(state.ledger, f.elements.item_id.value);
    if (e) openLedgerSheet(e);   // 時間到：換成鎖住的畫面
  }, 15000);

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
      : `<h2>這個月的明細${amChild() ? '' : '<button class="ai-btn" data-act="ai-ledger">AI 分析</button>'}</h2>`;

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
      <h3 class="set-group">家人</h3>
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
      ${bdayArchiveEntry()}
      <h3 class="set-group">這支手機</h3>
      ${homeLayoutHtml()}
      <section class="card-list">
        <h2>介面風格<small>只會改這支手機，可以和面板顏色自由搭配</small></h2>
        <div class="styles" role="group" aria-label="介面風格">
          ${STYLES.map(([id, name, note]) => `
            <button class="style-opt ${currentStyle() === id ? 'on' : ''}" data-act="ui-style" data-style-id="${id}" ${currentStyle() === id ? 'aria-pressed="true"' : ''}>
              <span class="style-demo" data-demo="${id || 'classic'}" aria-hidden="true"><i></i><b></b><b></b><em></em></span>
              <span class="style-name">${name}</span><small>${note}</small>
            </button>`).join('')}
        </div>
      </section>
      <section class="card-list">
        <h2>面板顏色<small>只會改這支手機</small></h2>
        <div class="themes" role="group" aria-label="面板顏色">
          ${THEMES.map(([id, name, a, b]) => `
            <button class="theme ${currentTheme() === id ? 'on' : ''}" data-act="theme" data-theme-id="${id}" style="--a:${a};--b:${b}" ${currentTheme() === id ? 'aria-pressed="true"' : ''}>
              <span class="swatch"></span>${name}
            </button>`).join('')}
        </div>
        <label class="switch auto-night"><span>跟著手機的深色模式<small>手機切到深色時自動換成夜間，白天換回你選的顏色</small></span><input type="checkbox" id="auto-night" ${autoNight() ? 'checked' : ''}></label>
      </section>
      ${pushSectionHtml()}
      ${pushTestHtml()}
      ${notifyPrefsHtml()}
      <h3 class="set-group">家庭設定</h3>
      <section class="card-list">
        <h2>聊天免打擾<small>小朋友在這段時間不收聊天通知</small></h2>
        <p class="hint">${quietSet().on ? `每天 ${esc(quietSet().start)}～${esc(quietSet().end)}，小朋友的手機不會跳聊天通知（打開 App 還是看得到訊息；報平安、行程提醒不受影響）。` : '目前沒有開啟。'}</p>
        ${amChild() ? '' : '<button class="btn ghost small" data-act="quiet-edit">設定時段</button>'}
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
      <details class="set-admin">
        <summary>管理員設定<small>備份、交通查詢、視訊通話的金鑰</small></summary>
      <section class="card-list">
        <h2>資料備份<small>把全家的資料存一份到手機</small></h2>
        <p class="hint">${backupNote()}會匯出行事曆、零用錢、成績、待辦、聊天文字、讀書計畫等資料成一個檔案（不含照片和語音的原始檔、金鑰）。檔案裡有全家的資料，請存在安全的地方。</p>
        <button class="btn ghost small" data-act="backup">匯出備份</button>
      </section>
      <section class="card-list">
        <h2>交通查詢<small>公車、台鐵即時資訊的資料來源</small></h2>
        <p class="hint">即時資料來自交通部 TDX 平臺，需要一組免費的 API 金鑰。只有管理員可以新增和查看。</p>
        <button class="btn ghost small" data-act="tdx-key">查看或更換 TDX 金鑰</button>
      </section>
      <section class="card-list">
        <h2>視訊通話<small>行動網路的中繼伺服器</small></h2>
        <p class="hint">用 4G／5G 視訊時，影像可能要經過 Cloudflare 的中繼伺服器才連得上。每月 1,000 GB 內免費。只有管理員可以新增和查看。</p>
        <button class="btn ghost small" data-act="turn-key">查看或更換中繼伺服器設定</button>
      </section>
      <section class="card-list">
        <h2>AI 小幫手<small>一句話新增行程、排旅遊草稿、成績與零用錢說明</small></h2>
        <p class="hint">用 Google Gemini。按了才會問，只送出那一次的內容；成績和零用錢只有家長能請 AI 看。只有管理員可以新增和查看金鑰。</p>
        <button class="btn ghost small" data-act="gemini-key">查看或更換 Gemini 金鑰</button>
      </section></details>` : ''}
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
    if (studyDirty) setTimeout(refreshStudy, 0);     // 表單開著時讀書計畫有變動：關掉後補畫
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
        ${(occDate || ev.event_date) <= today() ? `<button type="button" class="btn ghost small" data-act="album-jump" data-date="${esc(occDate || ev.event_date)}">看這天的相簿</button>` : ''}
      </div>`
    });
  }

  // draft：AI 從一句話整理出來的內容，先填進新增表單，讓人看過再儲存
  function openEventSheet(ev, occDate, draft) {
    if (ev && !canEditEvent(ev)) return openEventView(ev, occDate);
    sheetOccurrence = ev && ev.repeat ? occDate : null;
    const e = ev || {
      title: '', category: 'schedule', event_date: state.calView === 'month' ? state.selected : today(),
      end_date: null, start_time: null, end_time: null, member_ids: [], note: '', ...(draft || {})
    };
    const weekly = e.repeat === 'weekly';
    const allDay = !e.start_time;
    if (!eventCatIds().includes(e.category)) e.category = 'other';
    // 舊行程如果是「其他」，編輯時保留這個選項，不強迫改類型
    const catChoices = eventCatIds().concat(ev && e.category === 'other' ? ['other'] : []);
    showSheet('event-form', {
      title: ev ? '編輯' : '新增', focus: !ev && !draft,
      body: `
      <input type="hidden" name="item_id" value="${esc(e.id || '')}">
      ${ev ? '' : `
      <div class="ai-box">
        <label for="ai-text">用一句話新增</label>
        <div class="ai-row">
          <input id="ai-text" name="ai_text" placeholder="下週三晚上七點${esc((kids()[0] || me()).display_name)}鋼琴課" value="${esc((draft && draft.ai_text) || '')}" maxlength="300" autocomplete="off" enterkeyhint="go">
          <button type="button" class="ai-go" data-act="ai-event">AI 幫我填</button>
        </div>
        <p class="hint" id="ai-hint" role="status">${draft ? 'AI 填好了，請檢查下面的內容再按「儲存」。' : '日期、時間、誰的事會自動填到下面，你看過再儲存。'}</p>
      </div>`}
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

  // ---------- AI 小幫手（Google Gemini） ----------
  // 都是「按了才問」：只送出這一次要整理的內容，回來的結果先給人看，不會自己存。
  function aiError(e) {
    const msg = String((e && e.message) || ''), code = String((e && e.code) || '');
    const admin = isAdmin();
    if (msg.includes('no-key')) return admin ? '還沒設定 Gemini 金鑰。到「設定 → 管理員設定 → AI 小幫手」填入。' : 'AI 小幫手還沒開通，請管理員到設定裡填金鑰。';
    if (msg.includes('bad-key')) return admin ? 'Gemini 金鑰不能用，請到設定裡重新貼一次。' : 'AI 小幫手的金鑰有問題，請跟管理員說。';
    if (msg.includes('daily-limit')) return '今天的 AI 次數用完了，明天再試。';
    if (msg.includes('parents-only')) return '這個功能只有家長可以用。';
    if (msg.includes('too-long')) return '旅程超過 14 天，AI 排不了這麼長。';
    // 管理員多看一行原因，方便排除問題
    const d = (e && e.details) || {};
    const more = admin ? '（' + [code.replace('functions/', ''), msg, d.status, d.model, d.why].filter(Boolean).join(' ').slice(0, 160) + '）' : '';
    if (msg.includes('quota')) return (admin ? 'Gemini 今天的額度用完了。到 aistudio.google.com 幫這把金鑰開啟付費（Billing）額度會大很多；不開的話要等額度恢復，通常是隔天下午。' : 'AI 今天的額度用完了，請跟管理員說。') + more;
    if (msg.includes('busy')) return 'Gemini 說現在太頻繁或太忙，過一分鐘再試。' + more;
    if (msg.includes('bad-model')) return (admin ? '找不到這個 Gemini 模型，請到設定把「模型名稱」清空再儲存。' : 'AI 小幫手的設定有問題，請跟管理員說。') + more;
    if (msg.includes('ai-format') || msg.includes('ai-empty')) return 'AI 這次沒有回出能用的內容，請再試一次。' + more;
    if (msg.includes('ai-down')) return 'Gemini 現在忙不過來，過一兩分鐘再試。' + more;
    if (/deadline-exceeded/.test(code)) return 'AI 想太久沒有回來，請再試一次。' + more;
    if (/not-found|internal/.test(code)) return (admin ? 'AI 功能還沒部署好，請用最新的 ZIP 執行一次 deploy.bat。' : 'AI 小幫手還沒開通，請跟管理員說。') + more;
    return '沒有成功，請再試一次。' + more;
  }
  async function askAi(op, args) {
    try { return await Api.ai(op, args); }
    catch (e) { console.error(e); const err = new Error(aiError(e)); err.friendly = err.message; throw err; }
  }

  // 一句話 → 填好的新增行程表單
  async function aiFillEvent() {
    const form = document.getElementById('event-form');
    if (!form || !form.elements.ai_text) return;
    const input = form.elements.ai_text, hint = document.getElementById('ai-hint'), btn = form.querySelector('.ai-go');
    const text = input.value.trim();
    if (!text) { hint.textContent = '先寫一句話，例如「每週二四晚上六點半數學補習」。'; input.focus(); return; }
    if (btn.disabled) return;
    btn.disabled = true; btn.textContent = '整理中…'; hint.textContent = '正在請 AI 整理…';
    const cats = eventCatIds();
    try {
      const r = await askAi('event', { text, members: state.members.map((m) => m.display_name), categories: cats.map((k) => catOf(k).label) });
      if (!document.getElementById('event-form')) return;   // 等待時已經關掉表單
      const weekly = r.weekly && r.weekdays.length > 0;
      openEventSheet(null, null, {
        ai_text: text, title: r.title, event_date: r.date, end_date: r.end_date,
        start_time: r.start_time, end_time: r.end_time, note: r.note,
        category: cats.find((k) => catOf(k).label === r.category) || 'schedule',
        member_ids: state.members.filter((m) => r.members.includes(m.display_name)).map((m) => m.id),
        ...(weekly ? { repeat: 'weekly', repeat_days: r.weekdays } : {})
      });
    } catch (e) {
      btn.disabled = false; btn.textContent = 'AI 幫我填'; hint.textContent = e.friendly || '沒有成功，請再試一次。';
    }
  }

  // 旅遊行程草稿：先問想怎麼玩 → AI 排 → 勾選要留的 → 加進行程
  let aiPlan = null;
  function openAiTripSheet() {
    const t = tripOf(state.tripId);
    if (!t) return;
    showSheet('ai-trip-form', {
      title: '請 AI 排行程', submit: '開始排',
      body: `
      <p class="hint">${esc(t.title)}${t.place ? '・' + esc(t.place) : ''}・${rangeText(t)}</p>
      <label>想怎麼玩？<textarea name="wish" rows="4" maxlength="300" placeholder="想去的地方、不想太累、小朋友想玩水、晚餐想吃海鮮…（可以不填）"></textarea></label>
      <p class="hint">會把這趟旅程的名稱、地點、日期和上面這段話送到 Google Gemini。排出來的是草稿，你勾選要留下的再加進行程。</p>
      <p class="hint">AI 不知道即時的營業時間和票價，出發前請自己再確認一次。</p>`
    });
  }
  function openAiPlanSheet() {
    if (!aiPlan) return;
    showSheet('ai-plan-form', {
      title: 'AI 排的草稿', submit: '加入行程',
      body: `
      <p class="hint">勾選的項目會加進行程，之後都可以再改或刪掉。加入後每一項會有地圖、路線和店家的連結。</p>
      ${aiPlan.days.map((d, di) => `
        <h3 class="ai-day">${shortDate(d.date)}${d.theme ? `<span>${esc(d.theme)}</span>` : ''}</h3>
        <div class="call-pick">
          ${d.items.map((x, i) => `
          <label class="call-pick-row ai-pick">
            <span class="plan-time">${esc(x.time)}</span>
            <span class="plan-main"><span class="plan-title">${planCat(x.cat) ? planCat(x.cat)[1] + ' ' : ''}${esc(x.title)}</span>${x.place ? `<span class="plan-place">${esc(x.place)}</span>` : ''}${x.minutes || x.booking ? `<span class="plan-meta">${[x.minutes ? '停留 ' + stayText(x.minutes) : '', x.booking ? '<em class="need">要預約</em>' : ''].filter(Boolean).join('<i>・</i>')}</span>` : ''}${x.transport ? `<span class="plan-move">${esc(x.transport)}</span>` : ''}${x.note ? `<span class="plan-note">${esc(x.note)}</span>` : ''}${shopList(x).length ? `<span class="plan-shops">推薦：${esc(shopList(x).join('、'))}</span>` : ''}</span>
            <input type="checkbox" name="pick" value="${di}-${i}" checked><span class="check" aria-hidden="true"></span>
          </label>`).join('')}
        </div>`).join('')}
      ${(aiPlan.tips || []).length ? `
        <h3 class="ai-day">小提醒</h3>
        <ul class="ai-tips">${aiPlan.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <label class="switch"><span>把小提醒也存進行程（放在第一天的最後）</span><input type="checkbox" name="keep_tips" checked></label>` : ''}`
    });
  }

  // 成績／零用錢說明：只有家長看得到按鈕，數字先在手機算好再送
  function openAiAnalyze(kind) {
    if (amChild()) return;
    const kid = member(state.ledgerKid);
    if (!kid) return;
    showSheet('ai-analyze', {
      title: kid.display_name + (kind === 'scores' ? '的成績' : '的零用錢'), readonly: true,
      body: `
      <div id="ai-out" data-kind="${kind}">
        <p class="hint">會把${esc(kid.display_name)}${kind === 'scores' ? (state.scoreTerm ? state.scoreTerm + '學期' : '全部') + '的成績紀錄' : '這個月和上個月的記帳紀錄'}送到 Google Gemini，請它寫成一段好讀的說明。結果只顯示在這裡，不會存下來，小朋友也看不到。</p>
        <button type="button" class="btn" data-act="ai-run">開始分析</button>
      </div>`
    });
  }
  async function runAiAnalyze() {
    const out = document.getElementById('ai-out');
    if (!out || out.dataset.busy) return;
    const kind = out.dataset.kind, kid = member(state.ledgerKid);
    let data;
    if (kind === 'scores') {
      const rows = state.scores.filter((x) => x.kid === kid.id && (!state.scoreTerm || x.term === state.scoreTerm))
        .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80);
      if (rows.length < 2) { out.innerHTML = '<p class="hint">成績紀錄還不到兩筆，等多記幾次再來分析。</p>'; return; }
      data = { term: state.scoreTerm || '全部', records: rows.map((x) => ({ term: x.term || '', subject: x.subject, title: x.title, date: x.date, score: x.score, full: x.full })) };
    } else {
      const month = state.ledgerMonth, d = parse(month + '-01'); d.setMonth(d.getMonth() - 1);
      const prev = ymd(d).slice(0, 7);
      const pack = (mo) => {
        const rows = state.ledger.filter((e) => e.kid === kid.id && e.date.slice(0, 7) === mo);
        const sum = (type, par) => rows.filter((e) => e.type === type && !!e.by_parent === par).reduce((n, e) => n + e.amount, 0);
        return {
          month: mo, income: sum('income', false), spent_by_kid: sum('expense', false), paid_by_parents: sum('expense', true),
          entries: rows.slice(0, 100).map((e) => ({ date: e.date, type: e.type === 'income' ? '收入' : e.by_parent ? '父母支出' : '支出', amount: e.amount, note: e.note || '' }))
        };
      };
      data = { this_month: pack(month), last_month: pack(prev) };
      if (!data.this_month.entries.length) { out.innerHTML = '<p class="hint">這個月還沒有記帳紀錄。</p>'; return; }
    }
    out.dataset.busy = '1';
    out.innerHTML = '<p class="ai-wait" role="status">AI 正在看紀錄…</p>';
    try {
      const r = await askAi('analyze', { kind, name: kid.display_name, data });
      const box = document.getElementById('ai-out');
      if (box) box.innerHTML = `<div class="ai-text">${esc(r.text).split(/\n+/).map((p) => `<p>${p}</p>`).join('')}</div><p class="hint">這是 AI 根據紀錄寫的，數字請以紀錄為準。</p>`;
    } catch (e) {
      const box = document.getElementById('ai-out');
      if (box) { delete box.dataset.busy; box.innerHTML = `<p class="form-error">${esc(e.friendly || '沒有成功')}</p><button type="button" class="btn ghost" data-act="ai-run">再試一次</button>`; }
    }
  }

  // ---------- 家庭小管家 ----------
  // 鍾家生活 →「家庭小管家」。用問的查 App 裡的資料。每次發問，把「這個人本來就看得到」的紀錄整理成一份摘要，
  // 連同問題送給 AI；小朋友只會送出自己的成績和零用錢。對話不存檔。
  const BUTLER_SRC = { calendar: ['行事曆', 'cal', ''], todos: ['待辦', 'notes', 'shop'], scores: ['成績', 'notes', 'scores'], ledger: ['零用錢', 'notes', 'ledger'], trips: ['旅遊', 'notes', 'notes'], posts: ['我有話要說', 'posts', ''] };
  function butlerAsks() {
    const k = kids(), child = amChild();
    const next = state.trips.filter((t) => t.end_date >= today()).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    return [
      ['這週', child ? ['我這週有什麼行程？', '我還有哪些事沒做？'] : ['這週全家各有什麼行程？', '這幾天有哪些事還沒處理？']],
      [child ? '我的紀錄' : '小朋友', child ? ['我這學期各科考得怎麼樣？', '我這個月零用錢花在哪裡？']
        : k.length ? [k[0].display_name + '這學期各科考得怎麼樣？', (k[1] || k[0]).display_name + '這個月零用錢花在哪裡？'] : []],
      ['旅遊', next ? [next.title + '還有什麼沒準備？'] : []],
      ['什麼都可以問', child ? ['用簡單的話解釋光合作用', '幫我出五題英文單字小考'] : ['週末全家可以去哪裡走走？', '晚餐想不到煮什麼，給我三個點子']]
    ].filter((g) => g[1].length);
  }
  // 小管家要看的行事曆：前 30 天到後 180 天。讀不到就退回首頁已經有的 90 天。
  async function butlerEvents() {
    const from = addDays(today(), -30), to = addDays(today(), 180);
    try { return { raw: await Api.listEvents(from, to), from, to }; }
    catch (e) { return null; }
  }
  function butlerContext(cal) {
    const t = today(), nm = (id) => nameOf(id);
    const mine = (ids) => !ids || !ids.length ? '全家' : ids.map(nm).join('、');
    const hours = (e) => e.start_time ? e.start_time + (e.end_time ? '–' + e.end_time : '') : '全天';
    const from = cal ? cal.from : t, to = cal ? cal.to : addDays(t, 90);
    const all = cal ? expand(cal.raw, from, to) : state.upcoming;
    // 1) 未來 14 天：每天攤開（重複的行程也算進去）
    const events = [];
    for (let d = t, i = 0; i < 14; d = addDays(d, 1), i++) {
      eventsOn(all, d).sort(byTime).forEach((e) => events.push({ 日期: d, 星期: WEEKDAYS[parse(d).getDay()], 時間: hours(e), 名稱: e.title, 類型: catOf(e.category).label, 誰: mine(e.member_ids), 備註: (e.note || '').slice(0, 60), ...(e.series ? { 每週重複: true } : {}) }));
    }
    // 2) 每週重複的行程：一筆規則就代表範圍內的每一週
    const seen = {}, weekly = [];
    all.forEach((e) => {
      const s = e.series; if (!s || seen[s.id]) return; seen[s.id] = true;
      weekly.push({ 名稱: s.title, 每週星期: (s.repeat_days || []).slice().sort().map((d) => WEEKDAYS[d]).join('、'), 時間: hours(s), 從: s.event_date, 到: s.end_date, 類型: catOf(s.category).label, 誰: mine(s.member_ids), 備註: (s.note || '').slice(0, 60),
        ...((s.skip_dates || []).filter((d) => d >= from && d <= to).length ? { 這幾天停一次: s.skip_dates.filter((d) => d >= from && d <= to).sort() } : {}) });
    });
    // 3) 其他單次行程（過去 30 天和 14 天以後的）
    const last = addDays(t, 13);
    const one = (e) => ({ 日期: e.event_date, ...(e.end_date > e.event_date ? { 到: e.end_date } : {}), 星期: WEEKDAYS[parse(e.event_date).getDay()], 時間: hours(e), 名稱: e.title, 類型: catOf(e.category).label, 誰: mine(e.member_ids), 備註: (e.note || '').slice(0, 40) });
    const singles = all.filter((e) => !e.series);
    const later = singles.filter((e) => e.event_date > last).slice(0, 120).map(one);
    const before = singles.filter((e) => e.end_date < t).slice(-60).map(one);
    const todos = state.shopping.filter((x) => !x.done).slice(0, 40).map((x) => ({ 事情: x.text, 交給: todoWho(x) ? nm(todoWho(x)) : '全家', 期限: todoDue(x) || '', 重要: !!x.star, 誰加的: x.added_by ? nm(x.added_by) : '' }));
    const kidIds = amChild() ? [state.userId] : kids().map((k) => k.id);
    const month = t.slice(0, 7), pd = parse(month + '-01'); pd.setMonth(pd.getMonth() - 1);
    const prev = ymd(pd).slice(0, 7);
    const scores = {}, ledger = {};
    kidIds.forEach((id) => {
      scores[nm(id)] = state.scores.filter((x) => x.kid === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40)
        .map((x) => ({ 學期: x.term || '', 科目: x.subject, 考試: x.title, 日期: x.date, 分數: x.score, 滿分: x.full }));
      const pack = (mo) => {
        const rows = state.ledger.filter((e) => e.kid === id && e.date.slice(0, 7) === mo);
        const sum = (type, par) => rows.filter((e) => e.type === type && !!e.by_parent === par).reduce((n, e) => n + e.amount, 0);
        return { 月份: mo, 收到零用錢: sum('income', false), 自己花的: sum('expense', false), 父母幫忙付的: sum('expense', true),
          明細: rows.slice(0, 60).map((e) => ({ 日期: e.date, 種類: e.type === 'income' ? '收入' : e.by_parent ? '父母支出' : '支出', 金額: e.amount, 項目: e.note || '' })) };
      };
      ledger[nm(id)] = { 這個月: pack(month), 上個月: pack(prev),
        還沒給的費用申請: state.requests.filter((r) => r.kid === id && r.status !== 'given').map((r) => ({ 項目: r.title, 金額: r.amount, 需要日期: r.need_date })) };
    });
    const trips = state.trips.filter((x) => x.end_date >= addDays(t, -7)).sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 3).map((x) => ({
      名稱: x.title, 地點: x.place || '', 開始: x.start_date, 結束: x.end_date, 備註: (x.note || '').slice(0, 100),
      行程: itemsOf(x.id, 'plan').sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'))).slice(0, 60)
        .map((p) => ({ 日期: p.date, 時間: p.time || '', 做什麼: p.title, 地點: p.place || '', 預約: p.booking === 'need' ? '還沒預約' : p.booking === 'done' ? '已預約' : '' })),
      還沒帶的行李: itemsOf(x.id, 'pack').filter((p) => !p.done).map((p) => p.text).slice(0, 40),
      已經帶的行李數: itemsOf(x.id, 'pack').filter((p) => p.done).length
    }));
    const posts = state.posts.filter((p) => p.to.includes(state.userId) && !repliedBy(p, state.userId)).slice(0, 10).map((p) => ({ 誰說的: nm(p.author), 內容: p.text.slice(0, 100) }));
    return {
      今天: t + '（星期' + WEEKDAYS[parse(t).getDay()] + '）', 發問的人: me().display_name,
      家人: state.members.map((m) => m.display_name + (m.child ? '（小朋友）' : '')),
      calendar_說明: '行事曆範圍是 ' + from + ' 到 ' + to + '。「每週重複的行程」每一筆代表從「從」到「到」之間、每個指定星期都有一次（「這幾天停一次」除外），回答某一天或某一週的行程時要把它們算進去。',
      calendar_未來14天行程: events, calendar_每週重複的行程: weekly, calendar_14天以後的單次行程: later, calendar_過去30天的單次行程: before, todos_還沒做的待辦: todos, scores_成績: scores, ledger_零用錢: ledger, trips_旅遊: trips, posts_等我回覆的話: posts
    };
  }
  function viewButler() {
    const b = state.butler;
    const head = `
      <header class="plain-head with-action"><h1>家庭小管家</h1>${b.msgs.length ? '<button class="chip-btn bt-clear" data-act="butler-clear">清除對話</button>' : '<p>什麼都可以問</p>'}</header>`;
    if (!b.msgs.length) return head + `
      <div class="bt-start">
        ${butlerAsks().map(([title, list]) => `
          <section><h2>${esc(title)}</h2>${list.map((q) => `<button class="bt-ask" data-act="butler-ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</section>`).join('')}
        <p class="hint">問題和家裡的紀錄會送到 Google Gemini。對話不會存下來，離開 App 就清掉。${amChild() ? '成績和零用錢只會用到你自己的。' : ''}</p>
        <p class="hint">${amChild() ? '小管家不能上網，不知道今天的新聞、天氣和最新的價格；' : '需要最新資訊時，小管家會自己上 Google 查，並附上來源；'}回答也可能有錯，重要的事請再查一次。</p>
      </div>`;
    return head + `<div class="bt-list" id="butler-list" aria-live="polite">${butlerListHtml()}</div>`;
  }
  function butlerListHtml() {
    const b = state.butler;
    return b.msgs.map((m, i) => (m.role === 'user' ? `<p class="bt-q">${esc(m.text)}</p>` : `
      <article class="bt-a ${m.error ? 'err' : ''}">
        ${esc(m.text).split(/\n+/).map((p) => `<p>${p}</p>`).join('')}
        ${(m.links || []).length || (m.queries || []).length ? `<div class="bt-src"><small>上網查到的資料</small><div>${(m.links || []).map((l) => `<a class="plan-link web" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>`).join('')}${(m.queries || []).map((x) => `<a class="plan-link map" href="${esc(webUrl(x))}" target="_blank" rel="noopener">搜尋：${esc(x)}</a>`).join('')}</div></div>` : ''}
        ${(m.sources || []).length ? `<div class="bt-src"><small>小管家看了這些紀錄，數字請以紀錄為準</small><div>${m.sources.map((k) => `<button class="plan-link map" data-act="butler-go" data-src="${k}">${BUTLER_SRC[k][0]}</button>`).join('')}</div></div>` : ''}
        ${m.error ? '' : `<button class="link-btn bt-copy" data-act="butler-copy" data-i="${i}">複製回答</button>`}
      </article>`)).join('') + (b.busy ? '<p class="ai-wait bt-wait" role="status">小管家正在想…</p>' : '');
  }
  function drawButler() {
    if (state.tab !== 'notes' || state.notesView !== 'butler') return;
    const el = document.getElementById('butler-list');
    if (!el) { render(); } else el.innerHTML = butlerListHtml();
    const go = () => { const sc = scroller(); if (sc && state.notesView === 'butler') sc.scrollTop = sc.scrollHeight; };
    go(); setTimeout(go, 120);
  }
  function sendButler(form) {
    const i = form.elements.text, q = i.value;
    if (!q.trim() || state.butler.busy) return;
    i.value = ''; i.focus();
    askButler(q);
  }
  // 和家裡的事有關才附上完整的紀錄；一般問題只附基本資料，送得少、回得快
  const BUTLER_HOME = /行程|行事曆|待辦|要做|沒做|成績|考|分數|零用錢|花了|花在|費用|旅|行李|預約|今天|明天|後天|昨天|前天|這週|下週|上週|這個月|下個月|上個月|每週|每周|星期|禮拜|週[一二三四五六日]|\d+\s*月|\d+[\/／]\d+|幾點|上課|補習|社團|活動|生日|週末|幾號|什麼時候|有空|誰|我們家|家裡|全家|爸|媽|姊|弟|哥|妹|小孩|小朋友/;
  function butlerNeedsRecords(q) {
    if (BUTLER_HOME.test(q) || state.members.some((m) => q.includes(m.display_name))) return true;
    const last = state.butler.msgs.filter((m) => m.role === 'ai' && !m.error).slice(-1)[0];
    return !!(last && (last.sources || []).length && q.length < 30);   // 接著上一題追問
  }
  async function askButler(q) {
    const b = state.butler, text = String(q || '').trim();
    if (!text || b.busy) return;
    const history = b.msgs.filter((m) => !m.error).slice(-6).map((m) => ({ role: m.role, text: m.text.slice(0, 1200) }));
    b.msgs.push({ role: 'user', text }); b.busy = true;
    drawButler();
    try {
      const full = butlerNeedsRecords(text);
      if (full) await state.butlerReady;   // 剛進來就發問：等紀錄讀完，才不會少送
      const ctx = full ? butlerContext(await butlerEvents()) : { 今天: today() + '（星期' + WEEKDAYS[parse(today()).getDay()] + '）', 發問的人: me().display_name, 家人: state.members.map((m) => m.display_name + (m.child ? '（小朋友）' : '')), 說明: '這一題沒有附上家庭紀錄。如果需要紀錄才能回答，請對方把問題說得具體一點（例如提到行程、待辦、成績、零用錢、旅遊）。' };
      const r = await askAi('butler', { question: text, history, context: JSON.stringify(ctx), child: amChild() });
      b.msgs.push({ role: 'ai', text: r.answer, sources: (r.sources || []).filter((k) => BUTLER_SRC[k]), queries: r.queries || [], links: (r.links || []).filter((l) => /^https:\/\//.test(l.url)) });
    } catch (e) { b.msgs.push({ role: 'ai', text: e.friendly || '沒有成功，請再試一次。', error: true }); }
    b.busy = false;
    drawButler();
  }
  function butlerGo(key) {
    const [, tab, view] = BUTLER_SRC[key] || [];
    if (!tab) return;
    state.tab = tab;
    if (tab === 'notes') { state.notesView = view; if (view === 'notes') state.tripId = null; }
    render(); scroller().scrollTop = 0; loadTab();
  }

  function openGeminiSheet() {
    if (!isAdmin()) return;
    Api.getDoc('secrets', 'gemini').then((cur) => {
      const has = !!(cur && cur.api_key);
      showSheet('gemini-form', {
        title: 'AI 小幫手的金鑰', focus: false,
        body: `
        <p class="hint">${has ? '目前已經設定' + (cur.updated_at ? '（' + stamp(cur.updated_at) + ' 儲存）' : '') + '。要更換就直接改掉再儲存；清空再儲存就是關掉 AI。' : '還沒有設定。沒設定時，AI 的按鈕按了會提示還沒開通。'}</p>
        <label>Gemini API 金鑰<input type="text" name="api_key" value="${esc((cur && cur.api_key) || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200"></label>
        <label>模型名稱（可以不填）<input type="text" name="model" value="${esc((cur && cur.model) || '')}" placeholder="不填會自動用最新的 Flash" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="60"></label>
        <p class="hint">到 aistudio.google.com 登入 →「Get API key」→ 建立金鑰，複製貼上。</p>
        <p class="hint">免費額度的內容 Google 可能拿去改進產品；在 AI Studio 幫這把金鑰開啟付費（Billing）就不會，一家人用一個月大約幾塊到幾十塊台幣。</p>
        <p class="hint">只有管理員看得到、改得了；其他家人的手機讀不到。</p>`
      });
    }).catch((e) => { console.error(e); toast('讀不到目前的設定，請確認已經執行過 deploy.bat'); });
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

  // 發話：沒帶 post 是新增；帶了是編輯自己的發話（已經回覆的人不能從名單拿掉）
  function openPostSheet(post) {
    const others = state.members.filter((m) => m.id !== state.userId);
    const p = post || { text: '', to: [] };
    // 全家的發話已經有其他人回覆過：不能再改成只給特定的人（不然回覆過的人會看不到）
    const lockAudience = !!(post && isPublicPost(post) && state.replies.some((r) => r.post_id === post.id && r.author !== state.userId));
    showSheet('post-form', {
      title: post ? '編輯我說的話' : '我有話要說', submit: post ? '儲存' : '送出', focus: true,
      body: `
      <input type="hidden" name="item_id" value="${esc(p.id || '')}">
      <textarea class="title-input" name="text" rows="4" maxlength="2000" placeholder="想說什麼？">${esc(p.text)}</textarea>
      <fieldset class="people" ${lockAudience ? 'disabled' : ''}>
        <legend>要給誰？<small>不選＝全家都看得到；選了只有被選的人看得到、可以回覆</small></legend>
        ${others.map((m) => {
          const done = post && !isPublicPost(post) && repliedBy(post, m.id);
          return `
          <label style="--who:${esc(m.color)}">
            <input type="checkbox" name="to" value="${esc(m.id)}" ${p.to.includes(m.id) ? 'checked' : ''} ${done ? 'disabled' : ''}>
            <span>${esc(m.display_name)}${done ? ' ✓' : ''}</span>
          </label>`;
        }).join('')}
      </fieldset>
      ${lockAudience ? '<p class="hint">這則是給全家的，而且已經有人回覆，所以只能改內容。</p>'
        : post ? '<p class="hint">已經回覆的人不能拿掉。新加進來的人會收到通知。</p>' : ''}`
    });
  }
  function openReplyEditSheet(r) {
    showSheet('reply-edit-form', {
      title: '編輯我的回覆', submit: '儲存', focus: true,
      body: `
      <input type="hidden" name="item_id" value="${esc(r.id)}">
      <textarea class="title-input" name="text" rows="3" maxlength="2000">${esc(r.text)}</textarea>`
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
      <label>頭像上的字（一個字）<input type="text" name="face" value="${esc(p.face || '')}" maxlength="2" autocomplete="off" placeholder="不填就用名字的第一個字「${esc(m.display_name.slice(0, 1))}」"></label>
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
    const left = entry ? ledgerLeftMs(entry) : 0;
    if (entry && left <= 0) {
      const d = parse(entry.date);
      return showSheet('ledger-locked', {
        title: kid.display_name + '的零用錢', readonly: true,
        body: `
        <p class="lock-note">新增超過 1 小時，這筆紀錄已經鎖住，不能修改或刪除。需要更正請找管理員。</p>
        <dl class="lock-list">
          <dt>種類</dt><dd>${entry.by_parent ? '父母支出' : entry.type === 'income' ? '收入' : '支出'}</dd>
          <dt>金額</dt><dd>${money(entry.amount)}</dd>
          <dt>項目</dt><dd>${esc(entry.note || '')}</dd>
          <dt>日期</dt><dd>${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）</dd>
        </dl>`
      });
    }
    showSheet('ledger-form', {
      title: kid.display_name + '的零用錢', focus: !entry,
      footer: entry ? `<div class="del-row">${DELETE_BTN}<span class="del-left${left === Infinity ? ' admin' : ''}" id="del-left" data-until="${left === Infinity ? '' : Date.now() + left}">${left === Infinity ? '管理員可以隨時修改或刪除' : '還有 ' + leftText(left) + '可以修改或刪除'}</span></div>`
        : `<p class="hint">${isAdmin() ? '你是管理員，之後隨時可以修改或刪除。' : '新增後 1 小時內可以修改或刪除，之後就會鎖住。'}</p>`,
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
      title: nameOf(r.kid) + '需要的費用', footer: r.need_date < today() ? '<p class="hint">已經過了需要的日期，這筆不能刪除了。</p>' : DELETE_BTN,
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
        const old = e.id && findById(state.ledger, e.id);
        if (old && ledgerLeftMs(old) <= 0) { const err = new Error('locked'); err.friendly = '這筆紀錄已經超過 1 小時，不能修改了。'; throw err; }
        return Api.saveLedger({ ...e, note: e.note || '零用錢' });
      },
      remove: (id) => { const old = findById(state.ledger, id); if (old && ledgerLeftMs(old) <= 0) throw new Error('locked'); return Api.deleteLedger(id); },
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
          const paid = old.ledger_id && findById(state.ledger, old.ledger_id);
          if (paid && ledgerLeftMs(paid) <= 0) { const err = new Error('locked'); err.friendly = '這筆錢記到零用錢已經超過 1 小時，不能取消「已經給了」。'; throw err; }
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
      remove: (id) => { const r = findById(state.requests, id); if (r && r.need_date < today()) throw new Error('past'); return Api.deleteRequest(id); },
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
      read: (f) => ({
        id: f.item_id.value || null, title: f.title.value.trim(), date: f.date.value, time: f.time.value, place: f.place.value.trim(), note: f.note.value.trim(),
        transport: f.transport.value.trim(), shops: f.shops.value.split(/[、,，]/).map((n) => n.trim()).filter(Boolean).slice(0, 3),
        cat: f.cat.value, minutes: Math.max(0, Math.round(Number(f.minutes.value) || 0)), cost: Math.max(0, Math.round(Number(f.cost.value) || 0)), booking: f.booking.value
      }),
      check: (x) => (!x.title ? '請輸入要做什麼' : !x.date ? '請選擇哪一天' : null),
      save: (x) => saveTripItem('plan', x.id, { title: x.title, date: x.date, time: x.time, place: x.place, note: x.note, transport: x.transport, shops: x.shops, cat: x.cat, minutes: x.minutes, cost: x.cost, booking: x.booking }),
      remove: (id) => Api.deleteDoc('trip_items', id),
      after() { render(); }
    },
    'bday-form': {
      done: '卡片送出了',
      read: (f) => ({ to: f.to.value, text: f.text.value.trim(), sticker: f.sticker.value, paper: f.paper.value }),
      check: (x) => (!x.text ? '寫幾句話給壽星吧' : !bdayToday(x.to) ? '生日已經過了，卡片不能再修改' : null),
      save(x) {
        const year = Number(today().slice(0, 4));
        return Api.setDoc('birthday_cards', bdayCardId(x.to, year, state.userId), { to: x.to, from: state.userId, year, text: x.text, sticker: x.sticker, paper: x.paper, created_at: Date.now() });
      },
      remove(id) {
        const c = state.bdayCards.find((x) => x.id === id);
        if (c && !bdayToday(c.to) && !isAdmin()) { const e = new Error('locked'); e.friendly = '生日已經過了，卡片不能再刪除'; return Promise.reject(e); }
        return Api.deleteDoc('birthday_cards', id);
      },
      after() { drawBday(); }
    },
    'day-form': {
      read: (f) => ({ date: f.date.value, theme: f.theme.value.trim() }),
      check: () => null,
      save: (x) => Api.updateDoc('trips', state.tripId, { ['day_themes.' + x.date]: x.theme }),
      after() { render(); }
    },
    'journal-form': {
      read: (f) => ({ id: f.item_id.value || null, date: f.date.value, text: f.text.value.trim(), file: f.photo.files && f.photo.files[0], mood: f.mood.value, weather: f.weather.value, place: f.place.value.trim() }),
      check(x) {
        const old = x.id && findById(state.tripItems, x.id);
        if (!x.date) return '請選擇哪一天';
        if (!x.text && !x.file && !(old && old.thumb)) return '請寫點內容，或放一張照片';
        return null;
      },
      async save(x) {
        const data = { date: x.date, text: x.text, mood: x.mood, weather: x.weather, place: x.place };
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
        state.journalReacts.filter((r) => r.item_id === id && r.uid === state.userId).forEach((r) => Api.deleteDoc('journal_reacts', r.id).catch(() => {}));
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
      read: (f) => ({ form: f, album_id: f.album_id.value, event_title: f.event_title.value, files: Array.from(f.photos.files || []), caption: f.caption.value.trim(), date: f.date.value, people: Array.from(document.querySelectorAll('#photo-form input[name="people"]:checked')).map((i) => i.value) }),
      check(x) {
        if (!x.files.length) return '請選擇照片';
        if (x.files.length > 10) return '一次最多 10 張，請分幾次上傳';
        if (!x.date) return '請選擇哪一天拍的';
        if (x.date > today()) return '日期不能是未來';
        return null;
      },
      async save(x) {
        const err = document.getElementById('form-error');
        // 一張一張傳：每張的小預覽會顯示傳送中、完成或失敗。失敗的留著，再按一次「上傳」只會重傳沒成功的。
        const done = x.form._done || (x.form._done = new Set());
        const mark = (i, cls) => { const el = document.querySelector('#photo-previews .pv[data-i="' + i + '"]'); if (el) el.className = 'pv ' + cls; };
        let failed = 0;
        for (let i = 0; i < x.files.length; i++) {
          if (done.has(i)) continue;
          mark(i, 'busy');
          if (err) { err.hidden = false; err.textContent = '上傳中 ' + (done.size + 1) + ' / ' + x.files.length + '…'; }
          let image_id = '';
          try {
            const img = await loadImage(x.files[i]);
            // 盡量保留畫質：從 1600px 開始，太大才一級一級縮（一張要小於資料庫的上限）
            let full = shrink(img, 1600, 0.82);
            for (const [side, q] of [[1440, 0.78], [1280, 0.72], [1024, 0.65], [800, 0.6], [640, 0.55]]) { if (full.length <= 900000) break; full = shrink(img, side, q); }
            if (full.length > 900000) throw new Error('too-large');
            image_id = await Api.addDoc('chat_images', { data: full, sender: state.userId, sent_at: Date.now() });
            await Api.addDoc('photos', {
              month: x.date.slice(0, 7), date: x.date, caption: x.caption, people: x.people, thumb: shrink(img, 360, 0.6), image_id,
              album_id: x.album_id || '', event_title: x.event_title || '',
              author: state.userId, created_by: state.userId, created_at: Date.now()
            });
            done.add(i); mark(i, 'ok');
          } catch (e) { console.error(e); failed++; mark(i, 'bad'); if (image_id) Api.deleteDoc('chat_images', image_id).catch(() => {}); }
        }
        if (x.album_id && done.size > (x.form._bumped || 0)) { bumpAlbum(x.album_id, done.size - (x.form._bumped || 0), ''); x.form._bumped = done.size; }
        if (failed) { const e = new Error('upload-failed'); e.friendly = (done.size ? '已傳好 ' + done.size + ' 張，' : '') + '有 ' + failed + ' 張沒傳成功（紅框的）。再按一次「上傳」只會重傳這幾張。'; throw e; }
      },
      done: '已放進相簿',
      after(x) { if (x && !state.albumId) { state.albumMonth = x.date.slice(0, 7); if (state.albumDay) state.albumDay = x.date; } render(); loadAlbum(); }
    },
    'album-form': {
      read: (f) => ({ id: f.item_id.value, name: f.name.value.trim() }),
      check: (x) => (!x.name ? '請幫相簿取個名字' : null),
      async save(x) {
        if (x.id) await Api.updateDoc('albums', x.id, { name: x.name });
        else x.id = await Api.addDoc('albums', { name: x.name, created_by: state.userId, created_at: Date.now(), cover: '', count: 0 });
      },
      done: '已儲存',
      after(x) { if (x && !state.albumId) { state.albumTab = 'albums'; state.albumId = x.id; state.albumDay = null; } render(); loadAlbum(); }
    },
    'album-pick-form': {
      read: (f) => ({ album: f.album.value, name: f.name.value.trim() }),
      check: (x) => (x.album === '+' && !x.name ? '請輸入新相簿的名字' : x.album === undefined ? '請選一本相簿' : null),
      async save(x) {
        let id = x.album;
        if (id === '+') id = await Api.addDoc('albums', { name: x.name, created_by: state.userId, created_at: Date.now(), cover: '', count: 0 });
        const moving = selPhotos().filter((p) => p.album_id !== id);
        await Promise.all(moving.map((p) => Api.updateDoc('photos', p.id, { album_id: id })));
        if (moving.length) bumpAlbum(id, moving.length, moving[0].thumb);
      },
      done: '已放好',
      after() { state.albumSel = null; render(); }
    },
    'album-people-form': {
      read: () => ({ people: Array.from(document.querySelectorAll('#album-people-form input[name="people"]:checked')).map((i) => i.value) }),
      check: () => null,
      async save(x) {
        const mine = selPhotos().filter(canEditPhoto);
        if (!mine.length) { const e = new Error('not-mine'); e.friendly = '只能標註自己放的照片'; throw e; }
        await Promise.all(mine.map((p) => Api.updateDoc('photos', p.id, { people: x.people })));
      },
      done: '已標註',
      after() { state.albumSel = null; render(); }
    },
    'photo-edit-form': {
      read: (f) => ({ id: f.item_id.value, caption: f.caption.value.trim(), date: f.date.value, event_title: f.event_title.value.trim(), album_id: f.album_id.value, people: Array.from(document.querySelectorAll('#photo-edit-form input[name="people"]:checked')).map((i) => i.value) }),
      check(x) {
        const p = findById(state.photos, x.id);
        if (!p || !canEditPhoto(p)) return '這張照片不能修改';
        if (!x.date || x.date > today()) return '請選擇哪一天拍的（不能是未來）';
        return null;
      },
      async save(x) {
        const p = findById(state.photos, x.id);
        const month = x.date.slice(0, 7), moved = p.month !== month;
        const comments = commentsOf(p.id).map((c) => c.id), likes = state.photoLikes.filter((l) => l.photo_id === p.id).map((l) => l.id);
        await Api.updateDoc('photos', x.id, { caption: x.caption, people: x.people, date: x.date, month, event_title: x.event_title, album_id: x.album_id });
        // 照片搬到別的月份：留言和愛心也要跟著搬，不然在新的月份看不到
        if (moved) await Promise.all(comments.map((id) => Api.updateDoc('photo_comments', id, { month }))
          .concat(likes.map((id) => Api.updateDoc('photo_likes', id, { month })))).catch((e) => console.warn(e));
      },
      done: '已更新',
      after(x) { if (x && x.date.slice(0, 7) !== state.albumMonth) toast('照片移到 ' + Number(x.date.slice(5, 7)) + ' 月了'); render(); }
    },
    'gemini-form': {
      read: (f) => ({ api_key: f.api_key.value.trim(), model: f.model.value.trim() }),
      check: (x) => (/\s/.test(x.api_key + x.model) ? '中間不會有空白，請重新複製一次' : null),
      save: (x) => Api.setDoc('secrets', 'gemini', { api_key: x.api_key, model: x.model, updated_by: state.userId, updated_at: Date.now() }),
      done: '已儲存'
    },
    'ai-trip-form': {
      read: (f) => ({ wish: f.wish.value.trim() }),
      check: () => null,
      async save(x) {
        const t = tripOf(state.tripId);
        const btn = document.querySelector('#ai-trip-form button[type=submit]');
        if (btn) btn.textContent = '排行程中…';
        try {
          aiPlan = await askAi('trip', { title: t.title, place: t.place || '', start_date: t.start_date, end_date: t.end_date, people: state.members.length + ' 人，兩位大人和國中生', note: x.wish });
        } finally { if (btn) btn.textContent = '開始排'; }
      },
      done: '草稿排好了',
      after() { openAiPlanSheet(); }
    },
    'ai-plan-form': {
      read: () => ({ picks: Array.from(document.querySelectorAll('#ai-plan-form input[name="pick"]:checked')).map((i) => i.value.split('-').map(Number)) }),
      check: (x) => (!aiPlan ? '草稿不見了，請重新排一次' : !x.picks.length ? '請至少勾選一項' : null),
      async save(x) {
        for (const [di, i] of x.picks) {
          const d = aiPlan.days[di], it = d.items[i];
          await saveTripItem('plan', null, { title: it.title, date: d.date, time: it.time, place: it.place, note: it.note, transport: it.transport || '', shops: shopList(it), cat: it.cat || '', minutes: it.minutes || 0, cost: 0, booking: it.booking ? 'need' : '' });
        }
        const t = tripOf(state.tripId), themes = {};
        aiPlan.days.forEach((d) => { if (d.theme && !(t.day_themes || {})[d.date]) themes['day_themes.' + d.date] = d.theme; });
        if (Object.keys(themes).length) await Api.updateDoc('trips', t.id, themes).catch((e) => console.warn(e));
        const keep = document.querySelector('#ai-plan-form input[name="keep_tips"]');
        if (keep && keep.checked && aiPlan.tips.length) {
          await saveTripItem('plan', null, { title: '這趟旅程的小提醒', date: aiPlan.days[0].date, time: '', place: '', note: aiPlan.tips.map((t) => '・' + t).join('\n').slice(0, 500) });
        }
        aiPlan = null;
      },
      done: '已加入行程',
      after() { render(); }
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
        deadline: f.deadline.value, open_options: f.open_options.checked
      }),
      check(p) {
        if (!p.question) return '請寫下想問什麼';
        if (p.options.length < 2 && !p.open_options) return '至少要有兩個選項，一行一個；或打開「大家可以加選項」';
        if (p.options.length > POLL_MAX) return '選項最多 ' + POLL_MAX + ' 個';
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
          question: p.question, options: p.options, open_options: p.open_options, author: state.userId, created_at: Date.now(), closed: false,
          deadline: p.deadline || '', deadline_at: end ? end.getTime() : 0
        });
      },
      after() { state.pollHistory = false; refreshPolls(); const sc = scroller(); if (sc) sc.scrollTop = 0; }
    },
    'quiet-form': {
      read: (f) => ({ on: f.on.checked, start: f.start.value, end: f.end.value }),
      check: (d) => (!/^\d\d:\d\d$/.test(d.start) || !/^\d\d:\d\d$/.test(d.end) ? '請選開始和結束的時間' : d.on && d.start === d.end ? '開始和結束的時間不能一樣' : null),
      save: (d) => Api.setDoc('settings', 'chat_quiet', d),
      done: '已儲存',
      after(d) { state.quiet = { id: 'chat_quiet', ...d }; render(); }
    },
    'ci-sent-form': {
      read: (f) => ({ note: f.note ? f.note.value.trim() : '' }),
      check: () => null,
      async save(d) {
        const c = ciSent;
        if (!c || !d.note) return;
        await Api.updateDoc('checkins', c.id, { note: d.note });
        Api.sendMessage('【報平安】' + c.text + '：' + d.note, { checkin: c.id }).catch(() => {});
      },
      done: '爸媽收到了',
      after() { ciSent = null; clearInterval(ciTimer); drawCheckin(); }
    },
    'ci-view-form': {
      read: (f) => ({ id: f.item_id.value, name: f.place ? f.place.value.trim() : '' }),
      check: (d) => (!d.name ? '請輸入地點的名字，例如：家' : null),
      async save(d) {
        const c = findById(state.checkins, d.id);
        if (!c || !ciHasPos(c)) throw new Error('no-position');
        const near = ciNearPlace(c);
        if (near) await Api.updateDoc('places', near.id, { name: d.name });
        else await Api.addDoc('places', { name: d.name, lat: c.lat, lng: c.lng });
      },
      done: '已記住這個地點'
    },
    'card-form': {
      read: (f) => ({ id: f.item_id.value || null, title: f.title.value.trim(), member: amChild() ? state.userId : f.member.value, body: f.body.value.trim() }),
      check(c) {
        const old = c.id && findById(state.cards, c.id);
        if (old && !canEditCard(old)) return '這張卡不能修改';
        return !c.title ? '請輸入標題' : !c.body ? '請填寫內容' : null;
      },
      save(c) {
        const data = { title: c.title, member: c.member, body: c.body, updated_at: Date.now() };
        return c.id ? Api.updateDoc('cards', c.id, data) : Api.addDoc('cards', { ...data, created_by: state.userId, created_at: Date.now() });
      },
      async remove(id) {
        const old = findById(state.cards, id);
        if (!old || !canEditCard(old)) throw new Error('not-allowed');
        await Api.deleteDoc('cards', id);
      },
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
      read: (f, form) => ({ id: f.item_id.value || null, text: f.text.value.trim(), to: checkedValues(form, 'to') }),
      check: (p) => (!p.text ? '請寫下想說的話' : null),
      save(x) {
        if (!x.id) return Api.addPost(x);
        const old = findById(state.posts, x.id);
        if (old && document.querySelector('#post-form fieldset.people[disabled]')) return Api.editPost(x.id, { text: x.text, to: old.to });   // 名單鎖住：只改內容
        // 停用的勾選框（已經回覆的人）讀不到，要自己補回去
        const keep = old && !isPublicPost(old) ? old.to.filter((id) => repliedBy(old, id)) : [];
        return Api.editPost(x.id, { text: x.text, to: Array.from(new Set(keep.concat(x.to))) });
      },
      after: () => { const s = scroller(); if (s) s.scrollTop = 0; }
    },
    'video-form': {
      read: (f, form) => ({
        id: f.item_id.value || null, to: checkedValues(form, 'to'), cat: (form.querySelector('input[name="cat"]:checked') || {}).value || '',
        note: f.note ? f.note.value.trim() : '', reason: f.reason ? f.reason.value.trim() : '', notify: f.notify ? f.notify.checked : true,
        manual: f.manual_title ? f.manual_title.value.trim() : ''
      }),
      check(x) {
        const d = videoDraft;
        if (!d || d.loading) return d ? '還在查這部影片，等一下再按' : '請先貼上 YouTube 連結';
        if (d.error || !d.ok) return d.error || '這部影片不能加入';
        if (d.manual && !x.manual) return '請填影片標題';
        if (!amChild() && !x.to.length) return '請選擇給誰看';
        return null;
      },
      async save(x) {
        const d = videoDraft;
        if (x.id) return Api.updateDoc('videos', x.id, { to: x.to, cat: x.cat, note: x.note });
        const base = { yt_id: d.yt_id, title: (d.manual ? x.manual : d.title).slice(0, 200), channel: d.channel || '', duration: 0, added_by: state.userId, created_at: Date.now() };
        try {
          if (amChild()) await Api.addDoc('videos', { ...base, cat: '', note: '', reason: x.reason, to: [state.userId], status: 'pending', requested_by: state.userId });
          else await Api.addDoc('videos', { ...base, cat: x.cat, note: x.note, to: x.to, status: 'ok', notify: x.notify });
        } catch (e) {
          console.error(e);
          e.friendly = /permission/i.test(String(e.code || e.message)) ? '存不進去：影片功能還沒開通，請用最新的 ZIP 執行 deploy.bat。' : '沒有成功，請確認網路後再試一次。';
          throw e;
        }
        state.videoMode = 'list'; state.videoCat = '';
      },
      remove: (id) => Api.deleteDoc('videos', id),
      done: '已儲存',
      after() { videoDraft = null; render(); }
    },
    'study-form': {
      read: (f, form) => ({
        id: f.item_id.value || null, kid: f.kid.value, sub: (form.querySelector('input[name="sub"]:checked') || {}).value || '',
        title: f.title.value.trim(), note: f.note.value.trim(), minutes: Number((form.querySelector('input[name="minutes"]:checked') || {}).value || 30),
        date: f.date.value, exam_id: f.exam_id.value,
        repeat: !!(f.repeat && f.repeat.checked), wd: checkedValues(form, 'wd').map(Number), until: f.until ? f.until.value : ''
      }),
      check(x) {
        if (!x.sub) return '請選一個科目';
        if (!x.title) return '請寫下要讀什麼';
        if (!x.date) return '請選日期';
        if (x.repeat) {
          if (!x.wd.length) return '請勾選每週哪幾天';
          if (!x.until || x.until < x.date) return '「重複到哪一天」要在開始日期之後';
          if (daysBetween(x.date, x.until) > 120) return '重複最多排四個月';
        }
        return null;
      },
      async save(x) {
        const ex = x.exam_id ? studyExams(x.kid).find((e) => e.id === x.exam_id) : null;
        const data = { kid: x.kid, sub: x.sub, title: x.title, note: x.note, minutes: x.minutes, exam_id: x.exam_id, exam_date: ex ? ex.event_date : '' };
        if (x.id) return Api.updateDoc('study_items', x.id, { ...data, date: x.date });
        const dates = [];
        if (x.repeat) { for (let d = x.date; d <= x.until; d = addDays(d, 1)) if (x.wd.includes(parse(d).getDay())) dates.push(d); }
        else dates.push(x.date);
        if (!dates.length) { const e = new Error('none'); e.friendly = '這段期間沒有勾選的星期，請再確認一次'; throw e; }
        const series = dates.length > 1 ? 's' + Date.now() : '';
        for (const d of dates) await Api.addDoc('study_items', { ...data, date: d, done: false, spent: 0, series, created_by: state.userId, created_at: Date.now() });
        state.studyDay = dates[0];
        if (dates.length > 1) toast('排了 ' + dates.length + ' 天');
      },
      remove: (id) => { if (studyTimer && studyTimer.id === id) clearStudyTimer(); return Api.deleteDoc('study_items', id); },
      after() { render(); }
    },
    'study-ai-form': {
      read: (f, form) => ({ exam_id: f.exam_id.value, range: f.range.value.trim(), minutes: Number((form.querySelector('input[name="minutes"]:checked') || {}).value || 60) }),
      check: (x) => (!x.range ? '請寫下各科的考試範圍' : null),
      async save(x) {
        const kid = studyKid(), ex = studyExams(kid).find((e) => e.id === x.exam_id);
        if (!ex) { const e = new Error('none'); e.friendly = '找不到這次考試，請重新整理再試'; throw e; }
        const btn = document.querySelector('#study-ai-form button[type=submit]');
        if (btn) btn.textContent = '排計畫中…';
        try {
          const r = await askAi('study', { exam: ex.title, exam_date: ex.event_date, start_date: today(), subjects: studySubjects(), range: x.range, minutes: x.minutes, grade: '國中' });
          studyDraft = { kid, exam: ex, items: r.items, tips: r.tips || [] };
        } finally { if (btn) btn.textContent = '開始排'; }
      },
      done: '草稿排好了',
      after() { openStudyDraftSheet(); }
    },
    'study-draft-form': {
      read: () => ({ picks: Array.from(document.querySelectorAll('#study-draft-form input[name="pick"]:checked')).map((i) => Number(i.value)) }),
      check: (x) => (!studyDraft ? '草稿不見了，請重新排一次' : !x.picks.length ? '請至少勾選一項' : null),
      async save(x) {
        const d = studyDraft;
        for (const i of x.picks) {
          const it = d.items[i];
          await Api.addDoc('study_items', { kid: d.kid, sub: it.sub, title: it.title, note: it.note, minutes: it.minutes, date: it.date, exam_id: d.exam.id, exam_date: d.exam.event_date, done: false, spent: 0, series: '', created_by: state.userId, created_at: Date.now(), by_ai: true });
        }
        studyDraft = null;
      },
      done: '已加入計畫',
      after() { state.studyMode = 'week'; state.studyDay = today(); render(); }
    },
    'reply-edit-form': {
      done: '已儲存',
      read: (f) => ({ id: f.item_id.value, text: f.text.value.trim() }),
      check: (r) => (!r.text ? '回覆不能是空的' : null),
      save: (r) => Api.editReply(r.id, r.text)
    },
    'profile-form': {
      read: (f) => ({
        id: f.item_id.value, face: Array.from(f.face.value.trim()).slice(0, 1).join(''), birthday: f.birthday.value, phone: f.phone.value.trim(), org: f.org.value.trim(), note: f.note.value.trim(),
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
      if (spec.after) await spec.after(item);
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      fail((e && e.friendly) || '沒有成功，請確認網路後再試一次');
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
      if (spec.after) await spec.after(null);
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      toast(e.friendly || '刪除失敗，請再試一次');
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

  document.addEventListener('change', (ev) => { if (ev.target.id === 'auto-night') setAutoNight(ev.target.checked); });
  // 長按訊息：叫出選單（表情、回覆、複製、編輯、置頂…）。手指移動超過一點點就算是在捲動，不觸發。
  let press = null, pressFired = 0;
  const endPress = () => { if (press) { clearTimeout(press.timer); press = null; } };
  document.addEventListener('touchstart', (ev) => {
    endPress();
    const b = ev.touches.length === 1 && ev.target.closest && ev.target.closest('#chat-list .bubble[data-id]');
    if (!b || state.chatSearch) return;
    const t = ev.touches[0], id = b.dataset.id;
    press = { x: t.clientX, y: t.clientY, timer: setTimeout(() => {
      press = null; pressFired = Date.now();
      state.menuMsg = id; refreshChat(false);
      if (navigator.vibrate) navigator.vibrate(10);
      const el = document.getElementById('m-' + id);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }, 450) };
  }, { passive: true });
  document.addEventListener('touchmove', (ev) => { const t = ev.touches[0]; if (press && t && Math.hypot(t.clientX - press.x, t.clientY - press.y) > 10) endPress(); }, { passive: true });
  document.addEventListener('touchend', endPress, { passive: true });
  document.addEventListener('touchcancel', endPress, { passive: true });
  document.addEventListener('contextmenu', (ev) => { if (ev.target.closest && ev.target.closest('#chat-list .bubble')) ev.preventDefault(); });
  // 按 × 時不要讓輸入框失去焦點（iPhone 的鍵盤才不會先收起來又跳出來）
  document.addEventListener('mousedown', (ev) => { if (ev.target.closest('.chat-clear')) ev.preventDefault(); });
  document.addEventListener('click', (ev) => {
    if (Date.now() - pressFired < 700) { ev.preventDefault(); return; }   // 剛剛是長按叫出選單，放開手指的這一下不算點擊
    const link = ev.target.closest('a.msg-link, a.lp');
    if (link) {   // 點訊息裡的連結：直接打開，不跳出訊息選單。小朋友點 YouTube 連結：改成跟爸媽申請，不跳去 YouTube
      if (amChild() && parseYouTube(link.href)) { ev.preventDefault(); addVideoFromChat(link.href); }
      return;
    }
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'tab') {
      // 再點一次目前的分頁：回到最上面（聊天是回到最新訊息），跟 iPhone 的習慣一樣
      if (el.dataset.tab === state.tab && !(state.tab === 'notes' && state.notesView !== 'hub')) {
        const sc = scroller();
        if (sc) sc.scrollTo({ top: state.tab === 'chat' ? sc.scrollHeight : 0, behavior: 'smooth' });
        return;
      }
      if (el.dataset.tab === 'notes' && state.tab === 'notes' && state.notesView !== 'hub') { state.notesView = 'hub'; state.tripId = null; state.transit.route = null; }
      if (el.dataset.tab === 'cal' && state.tab !== 'cal') { state.selected = today(); state.cursor = today().slice(0, 7); }   // 回到首頁：日期回到今天
      if (state.tab === 'chat') leaveChat();
      state.tab = el.dataset.tab;
      state.menuMsg = null; state.pollEdit = null;
      if (state.tab === 'chat') enterChat();
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
      // 當天行程在月曆上面：被捲出畫面時，捲回來讓人看到
      const leaf = document.querySelector('.leaf'), sc = scroller(), top = document.querySelector('.home-top');
      if (leaf && sc) {
        const gap = leaf.getBoundingClientRect().top - sc.getBoundingClientRect().top - (top ? top.offsetHeight : 0) - 8;
        if (gap < 0) sc.scrollBy({ top: gap, behavior: 'smooth' });
      }
    }
    else if (act === 'new') {
      if (state.tab === 'notes' && state.notesView === 'ledger') { if (kids().length) openLedgerSheet(null); }
      else if (state.tab === 'notes' && state.notesView === 'cards') openCardSheet(null);
      else if (state.tab === 'notes' && state.notesView === 'study') openStudySheet(null);
      else if (state.tab === 'notes' && state.notesView === 'video') openVideoSheet(null);
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
    else if (act === 'notes-view') { state.notesView = el.dataset.view; state.albumDay = null; state.albumId = null; state.albumYear = null; state.albumSel = null; render(); scroller().scrollTop = 0; loadTab(); }
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
    else if (act === 'input-clear') {
      // 一鍵清掉輸入框的字，游標留在框裡可以直接重打
      const i = document.getElementById(el.dataset.for);
      if (i) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.focus(); }
    }
    else if (act === 'copy-msg') {
      const m = state.messages.find((x) => x.id === el.dataset.id);
      if (m && m.text) copyText(m.text).then((ok) => { toast(ok ? '已複製' : '沒有複製成功，請長按文字自己選取'); if (ok) { state.menuMsg = null; refreshChat(false); } });
    }
    else if (act === 'reply-msg') startReply(el.dataset.id);
    else if (act === 'wx-tap') onWeatherTap();
    else if (act === 'msg-react') toggleMsgReact(el.dataset.id, el.dataset.emoji);
    else if (act === 'reply-cancel') { state.replyTo = null; drawAssist(); }
    else if (act === 'edit-msg') startEdit(el.dataset.id);
    else if (act === 'edit-cancel') cancelEdit();
    else if (act === 'pin-msg') togglePin(el.dataset.id);
    else if (act === 'pins-toggle') { state.pinsOpen = !state.pinsOpen; drawPins(); }
    else if (act === 'msg-todo') msgToTodo(el.dataset.id);
    else if (act === 'msg-event') msgToEvent(el.dataset.id);
    else if (act === 'chat-add-video') addVideoFromChat(el.dataset.url);
    else if (act === 'voice-start') startVoice();
    else if (act === 'voice-send') stopVoice(true);
    else if (act === 'voice-cancel') stopVoice(false);
    else if (act === 'play-voice') playVoice(el.dataset.id);
    else if (act === 'quiet-edit') openQuietSheet();
    else if (act === 'outbox-retry') { const x = outbox.find((o) => o.id === el.dataset.id); if (x) { trySend(x); refreshChat(false); } }
    else if (act === 'outbox-drop') dropOutbox(el.dataset.id);
    else if (act === 'gs-open') openSearch();
    else if (act === 'notices') openNotices();
    else if (act === 'push-test') runPushTest(el);
    else if (act === 'notice-go') { closeSheet(); goTab(noticeTab(el.dataset.tag)); }
    else if (act === 'notify-kind') toggleNotifyKind(el.dataset.kind);
    else if (act === 'gs-event' || act === 'gs-msg' || act === 'gs-go') searchGo(el);
    else if (act === 'backup') exportBackup(el);
    else if (act === 'home-move' || act === 'home-show') {
      const list = homeLayout(), i = list.findIndex((x) => x.id === el.dataset.id);
      if (i < 0) return;
      if (act === 'home-show') list[i].on = !list[i].on;
      else { const j = i + Number(el.dataset.dir); if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; }
      saveHomeLayout(list); render();
    }
    else if (act === 'pick-mention') pickMention(el.dataset.name);
    else if (act === 'goto-msg') gotoMessage(el.dataset.id);
    else if (act === 'del-post') onDeletePost(el);
    else if (act === 'vd-open') openPlayer(el.dataset.id);
    else if (act === 'vd-edit') { const v = findById(state.videos, el.dataset.id); if (v) openVideoSheet(v); }
    else if (act === 'vd-mode') { state.videoMode = el.dataset.mode; render(); }
    else if (act === 'vd-cat') { state.videoCat = el.dataset.cat; render(); }
    else if (act === 'ci-toggle') { state.ciOpen = !state.ciOpen; drawCheckin(); }
    else if (act === 'ci-send') {
      if (el.dataset.kind === 'custom') showSheet('ci-custom-form', { title: '自己寫一句', submit: '傳給爸媽', focus: true, body: '<label>要跟爸媽說什麼？<input name="text" class="title-input" maxlength="40" placeholder="例如：我到阿嬤家了" autocomplete="off"></label><p class="hint">送出時會附上你現在的位置。</p>' });
      else sendCheckin(el.dataset.kind);
    }
    else if (act === 'ci-undo') undoCheckin();
    else if (act === 'ci-view') { if (!amChild()) { ciMarkSeen(); state.ciParentOpen = false; drawCheckin(); } openCheckin(el.dataset.id); }
    else if (act === 'ci-all') { ciMarkSeen(); state.ciParentOpen = false; drawCheckin(); openCheckinAll(); }
    else if (act === 'bcard-open') openBdayCard(el.dataset.id);
    else if (act === 'bday-party') { if (!playParty()) toast('這支手機設成「減少動態效果」，所以不播動畫'); }
    else if (act === 'ci-kid') { state.ciKid = el.dataset.id; render(); }
    else if (act === 'ci-popen') { state.ciParentOpen = true; drawCheckin(); }
    else if (act === 'ci-pclose') { ciMarkSeen(); state.ciParentOpen = false; drawCheckin(); }
    else if (act === 'ci-place-del') { Api.deleteDoc('places', el.dataset.id).then(() => { el.parentNode.remove(); toast('已刪除地點'); }, () => toast('沒有刪除成功')); }
    else if (act === 'vd-month') {
      const k = el.dataset.key;
      state.vdMonths[k] = el.getAttribute('aria-expanded') !== 'true';
      if (k.startsWith('vp:')) {   // 只換「其他影片」這一塊，播放器不能重畫
        const sec = vpEl('vp-more'), v = vp && findById(state.videos, vp.id);
        if (sec && v) sec.innerHTML = vpOthers(v);
      } else render();
    }
    else if (act === 'vd-paste') {
      const input = document.querySelector('#video-form input[name="yt_url"]');
      if (input && navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((t) => { input.value = t.trim(); lookupVideo(); }, () => toast('讀不到剪貼簿，請長按輸入框選「貼上」'));
      else toast('請長按輸入框選「貼上」');
    }
    else if (act === 'vd-review') {
      const v = findById(state.videos, el.dataset.id), ok = el.dataset.status === 'ok';
      if (v) Api.updateDoc('videos', v.id, { status: el.dataset.status, cat: v.cat || (ok ? '放鬆' : '') })
        .then(() => toast(ok ? '已同意，' + nameOf(v.requested_by) + '可以看了' : '已回覆先不要'), () => toast('沒有成功，請再試一次'));
    }
    else if (act === 'vd-req-del') Api.deleteDoc('videos', el.dataset.id).catch(() => toast('沒有成功，請再試一次'));
    else if (act === 'vd-limit') {
      const next = Math.min(600, Math.max(0, videoLimit(el.dataset.kid) + Number(el.dataset.step)));
      Api.setDoc('video_limits', el.dataset.kid, { minutes: next, updated_by: state.userId, updated_at: Date.now() }).catch(() => toast('沒有成功，請確認已經執行過最新的 deploy.bat'));
    }
    else if (act === 'vp-start') startPlayer();
    else if (act === 'vp-toggle') togglePlayer();
    else if (act === 'vp-close') closePlayer();
    else if (act === 'vp-big') { const sc = vpEl('vp-screen'); setBig(!(sc && sc.classList.contains('big'))); }
    else if (act === 'vp-seek') { if (vp && vp.player) { try { vp.lastT = -1; vp.player.seekTo(Math.max(0, vp.player.getCurrentTime() + Number(el.dataset.step)), true); } catch (e) { /* 沒關係 */ } } }
    else if (act === 'vp-unlock') {
      // 廣告的「略過」按鈕在播放器裡面：把擋板拿開 8 秒讓人按，再蓋回去
      $video.querySelectorAll('.vp-cover, .vp-guard').forEach((x) => { x.style.display = 'none'; });
      vpHint('可以按影片上的「略過廣告」了（8 秒後會再鎖起來）。');
      const mine = vp;
      setTimeout(() => { if (vp !== mine) return; $video.querySelectorAll('.vp-cover, .vp-guard').forEach((x) => { x.style.display = ''; }); vp.stuck = 0; vpHint(''); }, 8000);
    }
    else if (act === 'open-study') { state.tab = 'notes'; state.notesView = 'study'; state.studyDay = today(); state.studyMode = 'day'; render(); scroller().scrollTop = 0; }
    else if (act === 'study-kid') { state.studyKid = el.dataset.id; render(); }
    else if (act === 'study-mode') { state.studyMode = el.dataset.mode; render(); }
    else if (act === 'study-day') { state.studyDay = el.dataset.date; render(); }
    else if (act === 'study-week') { state.studyDay = addDays(state.studyDay || today(), Number(el.dataset.step)); render(); }
    else if (act === 'study-edit') { const x = findById(state.studyItems, el.dataset.id); if (x) openStudySheet(x); }
    else if (act === 'study-ai') openStudyAiSheet(el.dataset.exam);
    else if (act === 'study-done') {
      const x = findById(state.studyItems, el.dataset.id);
      if (x) {
        if (!x.done && studyTimer && studyTimer.id === x.id) { finishStudyTimer(true); return; }
        el.classList.add('pop');
        if (!x.done) celebrate();
        Api.updateDoc('study_items', x.id, x.done ? { done: false } : { done: true, done_at: Date.now() })
          .then(() => { if (!x.done && studyOf(x.kid, x.date).every((y) => y.id === x.id || y.done)) toast('這天的全部完成了，很棒！'); })
          .catch((e) => { console.error(e); toast('沒有成功，請再試一次'); });
      }
    }
    else if (act === 'study-timer') {
      if (studyTimer && findById(state.studyItems, studyTimer.id)) { toast('先結束正在計時的那一項'); openTimerSheet(); }
      else startStudyTimer(el.dataset.id);
    }
    else if (act === 'study-timer-open') openTimerSheet();
    else if (act === 'study-timer-done') finishStudyTimer(true);
    else if (act === 'study-timer-stop') finishStudyTimer(false);
    else if (act === 'study-timer-cancel') { clearStudyTimer(); closeSheet(); render(); }
    else if (act === 'study-cheer') sendStudyCheer(el.dataset.kind, el.dataset.text);
    else if (act === 'study-cheer-del') Api.deleteDoc('study_cheers', el.dataset.id).catch(() => toast('沒有成功，請再試一次'));
    else if (act === 'edit-post') { const p = findById(state.posts, el.dataset.id); if (p) openPostSheet(p); }
    else if (act === 'edit-reply') { const r = findById(state.replies, el.dataset.id); if (r) openReplyEditSheet(r); }
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
    else if (act === 'gemini-key') openGeminiSheet();
    else if (act === 'ai-event') aiFillEvent();
    else if (act === 'ai-trip') openAiTripSheet();
    else if (act === 'bday-card') openBdaySheet(el.dataset.to);
    else if (act === 'bday-archive') openBdayArchive(el.dataset.kind);
    else if (act === 'bday-phrase') {
      const f = document.getElementById('bday-form');
      if (f) { const ta = f.elements.text; ta.value = (ta.value.trim() ? ta.value.replace(/\s*$/, '') + (/[！。!~]$/.test(ta.value.trim()) ? '' : '，') : '') + el.dataset.text; drawBdayPreview(); }
    }
    else if (act === 'butler-ask') askButler(el.dataset.q);
    else if (act === 'butler-clear') { state.butler = { msgs: [], busy: false }; render(); }
    else if (act === 'butler-copy') {
      const m = state.butler.msgs[Number(el.dataset.i)];
      if (m && navigator.clipboard) navigator.clipboard.writeText(m.text).then(() => toast('已複製'), () => toast('沒有複製成功，請長按文字選取'));
      else toast('這支手機不能直接複製，請長按文字選取');
    }
    else if (act === 'butler-go') butlerGo(el.dataset.src);
    else if (act === 'day-theme') openDayThemeSheet(el.dataset.date);
    else if (act === 'plan-visit') { const x = findById(state.tripItems, el.dataset.id); if (x) Api.updateDoc('trip_items', x.id, { visited: !x.visited }).catch(() => toast('沒有成功，請再試一次')); }
    else if (act === 'ai-journal') aiWriteJournal(el);
    else if (act === 'jr-react') toggleJournalReact(el.dataset.id, el.dataset.emoji);
    else if (act === 'jr-place') { const f = document.getElementById('journal-form'); if (f) f.elements.place.value = el.dataset.text; }
    else if (act === 'jr-prompt') {
      const f = document.getElementById('journal-form');
      if (f) { const ta = f.elements.text; ta.value = (ta.value && !ta.value.endsWith('\n') ? ta.value + '\n' : ta.value) + el.dataset.text + '：'; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }
    else if (act === 'ai-scores') openAiAnalyze('scores');
    else if (act === 'ai-ledger') openAiAnalyze('ledger');
    else if (act === 'ai-run') runAiAnalyze();
    else if (act === 'turn-key') openTurnSheet();
    else if (act === 'call-pick') openCallPicker();
    else if (act === 'call-all') document.querySelectorAll('#call-form input[name="call_to"]').forEach((c) => { c.checked = true; });
    else if (act === 'call-accept') joinCall(call.incoming);
    else if (act === 'call-join') joinCall(el.dataset.id);
    else if (act === 'call-decline') declineCall();
    else if (act === 'call-end') { if (call.id) leaveCall(); else if (!call.preparing) endLocal(); }
    else if (act === 'call-again') {
      const d = state.calls.find((x) => x.id === el.dataset.id);
      if (d) { closeSheet(); startCall(callPeople(d).filter((u) => u !== state.userId), callKind(d)); }
    }
    else if (act === 'call-accept-video') joinCall(call.incoming, true);
    else if (act === 'call-back') { const to = (el.dataset.to || '').split(',').filter((u) => member(u)); if (to.length) startCall(to, el.dataset.kind); }
    else if (act === 'member-card') openMemberCard(el.dataset.id);
    else if (act === 'mc-call') { closeSheet(); startCall([el.dataset.id], el.dataset.kind); }
    else if (act === 'mc-chat') { closeSheet(); goTab('chat'); const i = document.getElementById('chat-input'); const m = member(el.dataset.id); if (i && m && !i.value) { i.value = '@' + m.display_name + ' '; state.draft = i.value; } }
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
    else if (act === 'album-filter') { state.albumFilter = el.dataset.filter; render(); }
    else if (act === 'album-play') startSlideshow();
    else if (act === 'album-stop') stopSlideshow();
    else if (act === 'photo-like') toggleLike(el.dataset.id);
    else if (act === 'photo-share') sharePhoto(el.dataset.id);
    else if (act === 'photo-stage') onStageTap(el);
    else if (act === 'edit-photo') { const p = findById(state.photos, el.dataset.id); if (p && canEditPhoto(p)) { stopSlideshow(true); state.photoId = null; openPhotoEditSheet(p); } }
    else if (act === 'album-prev' || act === 'album-next' || act === 'album-now') {
      const d = parse(state.albumMonth + '-01');
      d.setMonth(d.getMonth() + (act === 'album-prev' ? -1 : 1));
      const to = act === 'album-now' ? today().slice(0, 7) : ymd(d).slice(0, 7);
      if (to <= today().slice(0, 7)) { state.albumMonth = to; state.albumDay = null; state.albumSel = null; render(); scroller().scrollTop = 0; loadAlbum(); }
    }
    else if (act === 'album-tab') { state.albumTab = el.dataset.tab; state.albumDay = null; state.albumSel = null; render(); scroller().scrollTop = 0; }
    else if (act === 'album-new') openAlbumForm(null);
    else if (act === 'album-edit') openAlbumForm(albumOf(state.albumId));
    else if (act === 'album-del') deleteAlbum(el);
    else if (act === 'album-open') { state.albumId = el.dataset.id; state.albumSel = null; state.albumFilter = ''; render(); scroller().scrollTop = 0; loadAlbum(); }
    else if (act === 'album-close') { state.albumId = null; state.albumSel = null; render(); loadAlbum(); }
    else if (act === 'album-year') { state.albumYear = Number(state.albumMonth.slice(0, 4)); state.albumDay = null; render(); scroller().scrollTop = 0; }
    else if (act === 'album-year-close') { state.albumYear = null; render(); }
    else if (act === 'album-year-step') { const y = state.albumYear + Number(el.dataset.dir); if (y <= Number(today().slice(0, 4)) && y >= 2000) { state.albumYear = y; render(); } }
    else if (act === 'album-month') { state.albumYear = null; state.albumMonth = el.dataset.month; state.albumTab = 'date'; render(); scroller().scrollTop = 0; loadAlbum(); }
    else if (act === 'album-jump') jumpToDay(el.dataset.date);
    else if (act === 'album-dense') { state.albumDense = !state.albumDense; try { localStorage.setItem(DENSE_KEY, state.albumDense ? '1' : '0'); } catch (e) { /* 忽略 */ } render(); }
    else if (act === 'album-select') { state.albumSel = state.albumSel ? null : []; render(); }
    else if (act === 'album-pick') { const i = state.albumSel.indexOf(el.dataset.id); if (i >= 0) state.albumSel.splice(i, 1); else state.albumSel.push(el.dataset.id); const y = scroller().scrollTop; render(); scroller().scrollTop = y; }
    else if (act === 'sel-album') openAlbumPick();
    else if (act === 'sel-people') showSheet('album-people-form', { title: '標註照片裡有誰', submit: '套用', body: peoplePicker([]) + '<p class="hint">會套用到選的每一張（只能改自己放的照片）。</p>' });
    else if (act === 'sel-share') selShare();
    else if (act === 'sel-del') selDelete(el);
    else if (act === 'photo-ai') photoAi(el);
    else if (act === 'photo-ai-pick') { const f = document.getElementById('photo-form'); if (f) f.elements.caption.value = el.textContent.slice(0, 100); }
    else if (act === 'album-day') { if (el.dataset.date) { state.albumSel = null; state.albumDay = el.dataset.date; render(); scroller().scrollTop = 0; } }
    else if (act === 'album-day-back') { const from = state.albumDay; state.albumDay = null; state.albumSel = null; render(); const c = document.querySelector('.album-dcard[data-date="' + from + '"]'); if (c) c.scrollIntoView({ block: 'center' }); }
    else if (act === 'posts-view') { state.postsView = el.dataset.view; render(); scroller().scrollTop = 0; }
    else if (act === 'open-polls') { state.tab = 'posts'; state.postsView = 'polls'; state.pollHistory = false; render(); }
    else if (act === 'vote') onVote(el);
    else if (act === 'close-poll') onPollAction(el, 'close');
    else if (act === 'void-poll') onPollAction(el, 'void');
    else if (act === 'poll-open') { state.pollOpen = state.pollOpen === el.dataset.id ? null : el.dataset.id; refreshPolls(); }
    else if (act === 'poll-history') { state.pollHistory = !!el.dataset.history; state.pollEdit = null; state.pollOpen = null; refreshPolls(); scroller().scrollTop = 0; }
    else if (act === 'home-poll') { state.homePollId = state.homePollId === el.dataset.id ? null : el.dataset.id; state.pollEdit = null; refreshPolls(); }
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
    else if (act === 'edit-card') { const c = findById(state.cards, el.dataset.id); if (c && canEditCard(c)) openCardSheet(c); }
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
    else if (act === 'ui-style') { applyStyle(el.dataset.styleId); render(); toast('已換成' + (STYLES.find(([id]) => id === el.dataset.styleId) || STYLES[0])[1]); }
    else if (act === 'push-on') onPushOn(el);
    else if (act === 'push-off') { Api.disablePush().then(() => { toast('已關閉通知'); render(); }); }
    else if (act === 'logout') {
      stopWatching();
      clearCache();
      // 登出時也把這支手機從通知名單移除，避免登出後還收到通知
      Api.disablePush().catch(() => {}).then(() => Api.beat(false)).catch(() => {}).then(() => Api.signOut()).then(() => {
        Object.assign(state.transit, freshTransit());
        stopAlbum(); stopSlideshow(true); fullImages.clear(); Object.keys(albumCache).forEach((k) => delete albumCache[k]);
        if (call.id) leaveCall(); hideIncoming();
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
    else if (id === 'butler-form') sendButler(form);
    else if (id === 'ci-custom-form') { const t = form.elements.text.value.trim(); if (!t) return; closeSheet(); sendCheckin('custom', t); }
    else if (id === 'shop-form') onShopAdd(form);
    else if (id === 'pack-form') onPackAdd(form);
    else if (id === 'call-form') onCallForm(form);
    else if (id === 'transit-search-form') onTransitSearch(form);
    else if (id === 'album-comment-form') onPhotoComment(form);
    else if (form.id === 'vp-answer') {
      const v = vp && findById(state.videos, vp.id), t = form.elements.text.value.trim();
      if (v && t) Api.sendMessage('看完「' + v.title.slice(0, 40) + '」：' + t, { mentions: [v.added_by] }).then(() => { form.outerHTML = '<p class="hint">已經傳到聊天室了。</p>'; }, () => toast('沒有送出，請再試一次'));
    }
    else if (form.id === 'study-cheer-form') { const i = form.elements.text, t = i.value.trim(); if (t) { i.value = ''; i.blur(); sendStudyCheer('text', t); } }
    else if (form.classList.contains('reply-form')) onReply(form);
    else if (form.classList.contains('opt-add')) onAddOption(form);
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
    else if (form.getAttribute('id') === 'butler-form') sendButler(form);
    else if (form.getAttribute('id') === 'shop-form') onShopAdd(form);
    else if (form.getAttribute('id') === 'pack-form') onPackAdd(form);
    else if (form.getAttribute('id') === 'transit-search-form') onTransitSearch(form);
    else if (form.getAttribute('id') === 'album-comment-form') onPhotoComment(form);
    else if (form.classList.contains('reply-form')) onReply(form);
  }
  // touchstart 要設 passive: false，preventDefault 才有效（iPhone 靠它才不會收鍵盤）
  document.addEventListener('touchstart', sendFromButton, { passive: false });
  document.addEventListener('pointerdown', sendFromButton);
  document.addEventListener('mousedown', (ev) => { if (ev.target.closest('.send, .at-pick button')) ev.preventDefault(); });

  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.name === 'photos' && t.type === 'file') showPhotoPreviews(t);
    if (t.name === 'date' && t.form && t.form.id === 'photo-form') fillPhotoEvents();
    if (t.form && t.form.id === 'bday-form') drawBdayPreview();
    if (t.id === 'chat-input') { state.draft = t.value; watchMention(t); pingTyping(t.value); }
    else if (t.id === 'chat-q') { state.chatQuery = t.value; refreshChat(false); }
    else if (t.id === 'gs-q') { const out = document.getElementById('gs-out'); if (out) out.innerHTML = searchHtml(t.value); }
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
    else if (t.form && t.form.classList.contains('opt-add')) state.optDrafts[t.form.dataset.poll] = t.value;
  });

  // 費用申請表單：打開「已經給了」才出現「實際給的金額」
  document.addEventListener('change', (ev) => { if (ev.target.name === 'date' && ev.target.closest('#journal-form')) drawJournalPlaces(); if (ev.target.closest && ev.target.closest('#bday-form')) drawBdayPreview(); });
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
  // 在「用一句話新增」按 Enter：請 AI 填，不是直接儲存（選字中的 Enter 不算）
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target && ev.target.name === 'ai_text') { ev.preventDefault(); if (!ev.isComposing) aiFillEvent(); }
  });

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
  // 最多四個人一起視訊（每兩個人之間各自直接連線），用瀏覽器內建的 WebRTC。連線資訊（信令）走 Firestore：
  //   calls/{id}        { from（撥打的人）, to: [被邀請的人], status: live | ended, created_at, answered_at, ended_at,
  //                       joined: { UID: 加入時間 }, left: { UID: 離開時間 }, declined: { UID: 拒絕時間 } }
  //   call_signals/{id} { call_id, from, to, kind: offer | answer | cand, data（JSON 字串）, created_at }
  // 每兩個人之間由 UID 比較小的那一方發起連線，避免兩邊同時發起。
  // 通話結束後 calls 留著當作「通話紀錄」，連線資訊（call_signals）刪掉；超過 60 天的紀錄由撥打的人刪掉。
  // 行動網路連不上時，影像經 Cloudflare 的中繼伺服器（TURN）轉送；帳密由雲端函式 callIce 臨時發給。
  const RING_MS = 60000;                  // 邀請後多久沒接就算未接
  const MAX_CALL = 4;
  // kind：voice（語音，只有聲音）或 video。語音通話中可以按「改成視訊」，通話資料的 kind 會改成 video，大家的畫面一起切換。
  const call = { id: null, kind: 'video', local: null, peers: new Map(), servers: null, started: 0, tick: null, muted: false, camOff: false,
    facing: 'user', incoming: null, unsubSig: null, wake: null, ending: false, seen: new Set() };
  const dismissedCalls = new Set();
  let staleChecked = false;
  if (Api.isDemo) window.__call = call;      // 示範模式：方便在電腦上測試
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
    end: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13.500c5-4.500 13-4.500 18 0l-2 2.500-3.500-1.500v-2.500a10 10 0 0 0-5 0v2.500L7 16z" fill="currentColor"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>',
    in: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7L7 17M15 17H7V9"/></svg>'
  };

  const PHONE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.500 3.500h3.500l2 5-2.500 1.500a11 11 0 0 0 5.500 5.500l1.500-2.500 5 2v3.500a2 2 0 0 1-2 2A17 17 0 0 1 3.500 5.500a2 2 0 0 1 2-2z"/></svg>';
  // 首頁、聊天室點家人的頭像：語音通話／視訊通話／傳訊息
  function openMemberCard(id) {
    const m = member(id);
    if (!m || id === state.userId) return;
    const ci = m.child && !amChild() ? ciList().find((c) => c.kid === id && ciDate(c) === today()) : null;
    const busy = state.calls.some((d) => liveCall(d) && inCallIds(d).includes(id));
    showSheet('member-card', {
      title: m.display_name, readonly: true,
      body: `
        <div class="mc-head">${avatarHtml(m)}<div><h2>${esc(m.display_name)}</h2>
          <p class="${isOnline(id) ? 'on' : ''}">${busy ? '正在通話中' : esc(statusText(id))}</p>
          ${ci ? `<small>今天 ${clock(ci.at)} 報平安：${esc(ci.text)}</small>` : ''}</div></div>
        <div class="mc-acts">
          <button class="mc-act main" data-act="mc-call" data-kind="voice" data-id="${esc(id)}">${PHONE_SVG}<b>語音通話</b><small>只有聲音</small></button>
          <button class="mc-act" data-act="mc-call" data-kind="video" data-id="${esc(id)}">${CALL_ICON.video}<b>視訊通話</b><small>看得到臉</small></button>
          <button class="mc-act" data-act="mc-chat" data-id="${esc(id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><b>傳訊息</b><small>到聊天室</small></button>
        </div>
        <p class="hint">${isOnline(id) ? '' : esc(m.display_name) + '現在不在 App 裡也可以打，手機會收到來電通知，點開 App 就能接。'}通話時 App 要停在畫面上，切到別的 App 或鎖定畫面可能會中斷。</p>`
    });
  }
  // 這通電話的人：撥打的人＋被邀請的人；現在在通話裡的：加入了、還沒離開的
  const callPeople = (d) => [d.from].concat(d.to || []);
  const inCallIds = (d) => Object.keys(d.joined || {}).filter((u) => !(d.left || {})[u] || (d.left[u] < d.joined[u]));
  const stillRinging = (d) => Date.now() - (d.created_at || 0) < RING_MS;
  const waitingFor = (d) => (stillRinging(d) ? (d.to || []).filter((u) => !(d.joined || {})[u] && !(d.declined || {})[u]) : []);
  const callNames = (ids) => ids.map(nameOf).join('、');
  const liveCall = (d) => d.status !== 'ended' && Date.now() - (d.created_at || 0) < 3 * 3600000;

  async function iceServers() {
    try { const r = await Api.callIce(); if (r && Array.isArray(r.iceServers) && r.iceServers.length) return r.iceServers; }
    catch (e) { console.warn('拿不到中繼伺服器', e); }
    return [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];
  }
  const callKind = (d) => (d && d.kind === 'voice' ? 'voice' : 'video');
  const kindWord = (k) => (k === 'voice' ? '語音' : '視訊');
  function getMedia() {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: call.kind === 'voice' ? false : { facingMode: call.facing, width: { ideal: 640 }, height: { ideal: 480 } }
    });
  }
  const mediaError = (e) => (e && e.name === 'NotAllowedError'
    ? (call.kind === 'voice' ? '沒有麥克風的權限。請到 iPhone 的「設定」允許這個 App 使用麥克風。' : '沒有相機或麥克風的權限。請到 iPhone 的「設定」允許這個 App 使用相機和麥克風。')
    : (call.kind === 'voice' ? '打不開麥克風，請確認沒有其他 App 正在使用。' : '打不開相機或麥克風，請確認沒有其他 App 正在使用。'));
  // 語音通話也先留一條影像通道（沒有畫面），之後「改成視訊」時直接把鏡頭放上去，不用重新連線
  const videoSender = (pc) => { const t = pc.getTransceivers().find((x) => x.receiver && x.receiver.track && x.receiver.track.kind === 'video'); return t ? t.sender : null; };
  const canVideo = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection);

  function sendSignal(to, kind, data) {
    return Api.addDoc('call_signals', { call_id: call.id, from: state.userId, to, kind, data: JSON.stringify(data), created_at: Date.now() })
      .catch((e) => console.warn(e));
  }

  // 跟某一個人的連線
  function peerFor(uid) {
    let p = call.peers.get(uid);
    if (p) return p;
    const pc = new RTCPeerConnection({ iceServers: call.servers });
    p = { pc, stream: null, pending: [], state: 'connecting' };
    call.peers.set(uid, p);
    call.local.getTracks().forEach((t) => pc.addTrack(t, call.local));
    // 聲音和影像可能分兩次進來（語音通話預留的影像通道沒有附 stream）：每次都把全部的軌道放進一個新的 stream，畫面才會重新接上
    pc.ontrack = (ev) => { const old = p.stream ? p.stream.getTracks() : []; if (!old.includes(ev.track)) p.stream = new MediaStream(old.concat(ev.track)); drawTiles(); };
    pc.onicecandidate = (ev) => { if (ev.candidate) sendSignal(uid, 'cand', ev.candidate.toJSON()); };
    pc.onconnectionstatechange = () => {
      if (call.peers.get(uid) !== p) return;
      p.state = pc.connectionState;
      if (p.state === 'connected' && !call.started) call.started = Date.now();
      if (p.state === 'failed') { toast('和' + nameOf(uid) + '的連線中斷了'); closePeer(uid); }
      drawTiles();
    };
    drawTiles();
    return p;
  }
  function closePeer(uid) {
    const p = call.peers.get(uid);
    if (!p) return;
    try { p.pc.close(); } catch (e) { /* 已經關了 */ }
    call.peers.delete(uid);
    drawTiles();
  }
  async function offerTo(uid) {
    const p = peerFor(uid);
    try {
      if (!videoSender(p.pc)) p.pc.addTransceiver('video', { direction: 'sendrecv', streams: [call.local] });
      const offer = await p.pc.createOffer();
      await p.pc.setLocalDescription(offer);
      sendSignal(uid, 'offer', { type: offer.type, sdp: offer.sdp });
    } catch (e) { console.error(e); }
  }
  async function flushCandidates(p) {
    const list = p.pending.splice(0);
    for (const c of list) { try { await p.pc.addIceCandidate(c); } catch (e) { console.warn(e); } }
  }
  // 收到別人送給我的連線資訊
  async function onSignals(list) {
    if (!call.id) return;
    const mine = list.filter((s) => s.call_id === call.id && s.to === state.userId && !call.seen.has(s.id))
      .sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    for (const s of mine) {
      call.seen.add(s.id);
      let data;
      try { data = JSON.parse(s.data); } catch (e) { continue; }
      try {
        if (s.kind === 'offer') {
          const p = peerFor(s.from);
          await p.pc.setRemoteDescription(data);
          p.pc.getTransceivers().forEach((t) => { if (t.receiver.track && t.receiver.track.kind === 'video' && t.direction === 'recvonly') t.direction = 'sendrecv'; });
          const answer = await p.pc.createAnswer();
          await p.pc.setLocalDescription(answer);
          sendSignal(s.from, 'answer', { type: answer.type, sdp: answer.sdp });
          await flushCandidates(p);
        } else if (s.kind === 'answer') {
          const p = call.peers.get(s.from);
          if (p && !p.pc.remoteDescription) { await p.pc.setRemoteDescription(data); await flushCandidates(p); }
        } else if (s.kind === 'cand') {
          const p = peerFor(s.from);
          if (p.pc.remoteDescription) await p.pc.addIceCandidate(data); else p.pending.push(data);
        }
      } catch (e) { console.warn('連線資訊處理失敗', e); }
    }
  }
  function watchSignals() {
    if (!call.unsubSig) call.unsubSig = Api.watchList('call_signals', onSignals);
  }

  // 依照通話資料，跟現在在通話裡的每個人建立（或關掉）連線
  function syncPeers(d) {
    const here = inCallIds(d).filter((u) => u !== state.userId);
    here.forEach((u) => { if (!call.peers.has(u) && state.userId < u) offerTo(u); });
    [...call.peers.keys()].forEach((u) => {
      if (here.includes(u)) return;
      closePeer(u);
      // 對方離開了：把我送給他的連線資訊清掉，他回來時重新連
      Api.listDocs('call_signals', ['call_id', call.id]).then((list) => Promise.all(list
        .filter((x) => x.from === state.userId && x.to === u).map((x) => Api.deleteDoc('call_signals', x.id)))).catch(() => {});
    });
    drawTiles();
  }

  async function prepareCall() {
    if (!canVideo()) { toast('這支手機不支援' + kindWord(call.kind) + '通話'); return false; }
    Object.assign(call, { peers: new Map(), started: 0, muted: false, camOff: false, ending: false, seen: new Set() });
    try { call.local = await getMedia(); } catch (e) { console.warn(e); toast(mediaError(e)); return false; }
    call.servers = await iceServers();
    return true;
  }

  async function startCall(uids, kind) {
    if (call.id || call.preparing) return;
    const to = uids.filter((u) => u !== state.userId).slice(0, MAX_CALL - 1);
    if (!to.length) return;
    call.kind = kind === 'voice' ? 'voice' : 'video';
    call.preparing = true;
    buildCallView(to);
    const ok = await prepareCall();
    if (!ok) { call.preparing = false; return endLocal(); }
    try {
      const now = Date.now();
      call.id = await Api.addDoc('calls', { from: state.userId, to, kind: call.kind, status: 'live', joined: { [state.userId]: now }, left: {}, declined: {}, created_at: now });
      watchSignals();
      attachLocal();
    } catch (e) { console.error(e); toast('撥不出去，請確認網路後再試一次'); endLocal(); }
    call.preparing = false;
  }

  // 接聽來電，或加入正在進行的通話
  // withVideo：語音來電選「用視訊接」，接起來就把整通改成視訊
  async function joinCall(id, withVideo) {
    const d = state.calls.find((x) => x.id === id);
    if (!d || !liveCall(d) || !inCallIds(d).length) { hideIncoming(); return toast('通話已經結束了'); }
    if (call.id || call.preparing) return;
    hideIncoming();
    call.kind = withVideo ? 'video' : callKind(d);
    call.preparing = true;
    buildCallView(callPeople(d).filter((u) => u !== state.userId));
    const ok = await prepareCall();
    if (!ok) { call.preparing = false; return endLocal(); }
    // 上一次加入時留下、送給我或我送出的舊連線資訊：先標成看過並刪掉，免得跟這次的混在一起
    try {
      const old = (await Api.listDocs('call_signals', ['call_id', id])).filter((s) => s.to === state.userId || s.from === state.userId);
      old.forEach((s) => call.seen.add(s.id));
      await Promise.all(old.map((s) => Api.deleteDoc('call_signals', s.id)));
    } catch (e) { console.warn(e); }
    call.id = id;
    attachLocal();
    watchSignals();
    try {
      const now = Date.now();
      const change = { ['joined.' + state.userId]: now };
      if (!d.answered_at) change.answered_at = now;
      if (withVideo && callKind(d) === 'voice') change.kind = 'video';
      await Api.updateDoc('calls', id, change);
    } catch (e) { console.error(e); toast('加入不了，請再試一次'); endLocal(); }
    call.preparing = false;
  }

  function declineCall() {
    const id = call.incoming;
    if (!id) return;
    dismissedCalls.add(id);
    hideIncoming();
    Api.updateDoc('calls', id, { ['declined.' + state.userId]: Date.now() }).catch((e) => console.warn(e));
  }

  // 自己離開；如果離開後通話裡沒人（或只剩一個人而且也沒人在等著接），整通結束
  async function leaveCall() {
    if (call.ending) return;
    call.ending = true;
    const id = call.id;
    const d = state.calls.find((x) => x.id === id);
    endLocal();
    if (!id) return;
    const now = Date.now();
    const rest = d ? inCallIds(d).filter((u) => u !== state.userId) : [];
    const change = { ['left.' + state.userId]: now };
    // 沒有別人了，或只剩一個人而且也沒有人還在響：整通結束
    const over = !d || !rest.length || (rest.length === 1 && !waitingFor(d).length);
    if (over) Object.assign(change, { status: 'ended', ended_at: now });
    try { await Api.updateDoc('calls', id, change); } catch (e) { console.warn(e); }
    if (over && d) noteMissed(d);
    clearSignals(id, over ? null : state.userId);
  }
  // 撥出去沒有人接：在聊天室留一句，對方會收到通知
  // 通話結束時由撥打的人在聊天室留一則紀錄：沒接到是「未接來電」（對方會收到通知、可以回撥），講完的記通話時間
  // （講完的由最後掛斷、把通話標成結束的那個人留；沒接到的由撥打的人留）
  function noteMissed(d) {
    const k = callKind(d), people = (d.to || []).slice();
    if (d.answered_at) {
      const sec = Math.max(1, Math.round((Date.now() - d.answered_at) / 1000));
      Api.sendMessage(kindWord(k) + '通話・' + callDur(sec), { call_log: { kind: k, sec, missed: false, to: people, with: callPeople(d) } }).catch(() => {});
      return;
    }
    if (d.from !== state.userId) return;
    const missed = people.filter((u) => !(d.declined || {})[u]);
    if (missed.length) Api.sendMessage('打' + kindWord(k) + '給' + callNames(missed) + '，沒有接到', { call_log: { kind: k, sec: 0, missed: true, to: missed } }).catch(() => {});
  }
  const callDur = (sec) => (sec >= 60 ? Math.floor(sec / 60) + ' 分 ' : '') + (sec % 60) + ' 秒';
  // 聊天室裡的通話紀錄泡泡
  function callLogBubble(m) {
    const c = m.call_log, mine = m.sender === state.userId, ic = c.kind === 'voice' ? PHONE_SVG : CALL_ICON.video;
    const peer = Array.isArray(c.with) ? c.with : mine ? (c.to || []) : [m.sender];
    const title = c.missed ? (mine ? '沒有接到' : '未接來電') : kindWord(c.kind) + '通話';
    const sub = c.missed ? kindWord(c.kind) + '・' + clock(m.sent_at) + (mine ? '・' + callNames(c.to || []) : '') : '通話時間 ' + callDur(c.sec || 0);
    return `<div class="bubble callrec ${c.missed ? 'missed' : ''}"><span class="cr-ico">${ic}</span><span class="cr-main"><b>${esc(title)}</b><small>${esc(sub)}</small></span>`
      + `<button class="cr-again" data-act="call-back" data-kind="${c.kind === 'voice' ? 'voice' : 'video'}" data-to="${esc(peer.filter((u) => u !== state.userId && member(u)).join(','))}">${c.missed && !mine ? '回撥' : '再打一次'}</button></div>`;
  }
  // 清掉連線資訊：只清自己送出的（還有人在通話），或整通的（通話結束）
  async function clearSignals(id, onlyFrom) {
    try {
      const sigs = await Api.listDocs('call_signals', ['call_id', id]);
      await Promise.all(sigs.filter((s) => !onlyFrom || s.from === onlyFrom).map((s) => Api.deleteDoc('call_signals', s.id)));
    } catch (e) { console.warn(e); }
  }

  function endLocal() {
    clearInterval(call.tick);
    document.querySelectorAll('#call-root audio, #call-root video').forEach((v) => { try { v.srcObject = null; } catch (e) { /* 忽略 */ } });
    if (call.local) call.local.getTracks().forEach((t) => t.stop());
    call.peers.forEach((p) => { try { p.pc.close(); } catch (e) { /* 已經關了 */ } });
    if (call.unsubSig) call.unsubSig();
    if (call.wake) call.wake.release().catch(() => {});
    Object.assign(call, { id: null, local: null, peers: new Map(), tick: null, unsubSig: null, wake: null, started: 0, preparing: false });
    if ($call && !call.incoming) { $call.innerHTML = ''; document.body.classList.remove('in-call'); }
    refreshCallBanner();
  }

  // 所有通話的資料一變就進來
  function onCalls(list) {
    state.calls = list;
    const me = state.userId;
    if (!me) return;
    // 剛打開 App：如果上次在通話中 App 被關掉，幫自己標成已離開（之後還能從聊天室重新加入）
    if (!staleChecked) {
      staleChecked = true;
      list.filter((d) => liveCall(d) && inCallIds(d).includes(me) && d.id !== call.id).forEach((d) => {
        const rest = inCallIds(d).filter((u) => u !== me);
        const change = { ['left.' + me]: Date.now() };
        if (!rest.length) Object.assign(change, { status: 'ended', ended_at: Date.now() });
        Api.updateDoc('calls', d.id, change).catch(() => {});
      });
    }
    // 自己撥出的：沒結束但已經沒人、或是太舊的，標成結束；超過 60 天的紀錄刪掉
    list.filter((d) => d.from === me && d.id !== call.id).forEach((d) => {
      if (d.status !== 'ended' && (!liveCall(d) || (!inCallIds(d).length && !stillRinging(d)))) {
        Api.updateDoc('calls', d.id, { status: 'ended', ended_at: d.ended_at || Date.now() }).catch(() => {});
        clearSignals(d.id);
      } else if (d.status === 'ended' && Date.now() - (d.created_at || 0) > 60 * 86400000 && !d.cleaning) {
        d.cleaning = true;
        Api.deleteDoc('calls', d.id).catch(() => {});
      }
    });
    if (call.id) {
      const d = list.find((x) => x.id === call.id);
      if (!d || d.status === 'ended') { if (!call.ending) { call.ending = true; toast('通話結束'); endLocal(); } return; }
      if (callKind(d) !== call.kind) switchKind(callKind(d));
      syncPeers(d);
      checkAlone(d);
      updateCallView();
      return;
    }
    // 有人邀請我：還在響、我沒加入也沒拒絕、通話裡還有人
    const ring = list.find((d) => liveCall(d) && (d.to || []).includes(me) && stillRinging(d) && !(d.joined || {})[me]
      && !(d.declined || {})[me] && inCallIds(d).length && !dismissedCalls.has(d.id));
    if (ring && call.incoming !== ring.id && !call.preparing) showIncoming(ring);
    else if (!ring && call.incoming) hideIncoming();
    refreshCallBanner();
  }
  // 通話裡只剩自己、也沒有人在等著接：自動結束
  function checkAlone(d) {
    if (!call.id || call.ending || call.preparing) return;
    const rest = inCallIds(d).filter((u) => u !== state.userId);
    if (!rest.length && !waitingFor(d).length) {
      const answered = !!d.answered_at;
      toast(answered ? '其他人都離開了' : '沒有人接聽');
      leaveCall();
    }
  }

  function showIncoming(d) {
    call.incoming = d.id;
    const who = member(d.from);
    const others = (d.to || []).filter((u) => u !== state.userId);
    callRoot().innerHTML = `
      <div class="call-incoming" role="alertdialog" aria-label="${esc(nameOf(d.from))}${callKind(d) === 'voice' ? '打語音電話給你' : '邀請你視訊'}">
        <div class="call-who">
          ${who ? `<span class="avatar call-avatar ring" style="background:${esc(who.color)}">${esc(faceOf(who))}</span>` : ''}
          <b>${esc(nameOf(d.from))}</b>
          <span>${callKind(d) === 'voice' ? (others.length ? '打語音電話給你和' + esc(callNames(others)) : '打語音電話給你') : (others.length ? '邀請你和' + esc(callNames(others)) + '一起視訊' : '邀請你視訊')}</span>
        </div>
        <div class="call-answer">
          <button class="call-btn end" data-act="call-decline" aria-label="拒絕">${CALL_ICON.end}<small>拒絕</small></button>
          ${callKind(d) === 'voice' ? `<button class="call-btn" data-act="call-accept-video" aria-label="用視訊接">${CALL_ICON.video}<small>用視訊接</small></button>` : ''}
          <button class="call-btn ok" data-act="call-accept" aria-label="接聽">${callKind(d) === 'voice' ? PHONE_SVG : CALL_ICON.video}<small>接聽</small></button>
        </div>
      </div>`;
    document.body.classList.add('in-call');
  }
  function hideIncoming() {
    call.incoming = null;
    if ($call && !call.id && !call.preparing) { $call.innerHTML = ''; document.body.classList.remove('in-call'); }
  }

  // ---- 通話畫面 ----
  function buildCallView(others) {
    callRoot().innerHTML = `
      <div class="call-view ${call.kind === 'voice' ? 'voice' : ''}" id="call-view" role="dialog" aria-label="${kindWord(call.kind)}通話">
        <div class="call-grid" id="call-grid"></div>
        <div class="call-wait" id="call-wait">
          <div class="call-wait-faces">${others.map((u) => { const m = member(u); return m ? `<span class="avatar call-avatar" style="background:${esc(m.color)}">${esc(faceOf(m))}</span>` : ''; }).join('')}</div>
        </div>
        <div class="call-top"><b>${esc(callNames(others))}</b><span id="call-status">準備中…</span></div>
        <video id="call-local" autoplay playsinline muted></video>
        <div class="call-ctrls">
          <button class="call-btn" data-act="call-mute" id="call-mute"></button>
          <button class="call-btn" data-act="call-cam" id="call-cam"></button>
          <button class="call-btn vo-hide" data-act="call-flip" aria-label="切換前後鏡頭">${CALL_ICON.flip}<small>翻轉</small></button>
          <button class="call-btn end" data-act="call-end" aria-label="離開通話">${CALL_ICON.end}<small>掛斷</small></button>
        </div>
      </div>`;
    document.body.classList.add('in-call');
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { call.wake = w; }).catch(() => {});
    clearInterval(call.tick);
    call.tick = setInterval(() => {
      updateCallView();
      const d = call.id && state.calls.find((x) => x.id === call.id);
      if (d) checkAlone(d);
    }, 1000);
    updateCallView();
  }
  function attachLocal() {
    const l = document.getElementById('call-local');
    if (l && call.local && l.srcObject !== call.local) l.srcObject = call.local;
    updateCallView();
  }
  // 每個人一格；格子數變了才重排，影像不重接
  function drawTiles() {
    const grid = document.getElementById('call-grid');
    if (!grid) return;
    const ids = [...call.peers.keys()].filter((u) => call.peers.get(u).stream);
    grid.dataset.n = ids.length;
    [...grid.children].forEach((t) => { if (!ids.includes(t.dataset.uid)) t.remove(); });
    ids.forEach((u) => {
      const p = call.peers.get(u);
      let tile = grid.querySelector(`[data-uid="${u}"]`);
      if (!tile) {
        tile = document.createElement('div');
        tile.className = 'call-tile'; tile.dataset.uid = u;
        const m = member(u);
        tile.innerHTML = `${m ? `<span class="avatar call-avatar tile-face" style="background:${esc(m.color)}">${esc(faceOf(m))}</span>` : ''}<video autoplay playsinline></video><span class="call-name">${esc(nameOf(u))}</span>`;
        grid.appendChild(tile);
      }
      const v = tile.querySelector('video');
      if (v.srcObject !== p.stream) { v.srcObject = p.stream; v.play().catch(() => {}); }
      tile.classList.toggle('weak', p.state === 'disconnected');
    });
    updateCallView();
  }
  function updateCallView() {
    const st = document.getElementById('call-status');
    if (!st) return;
    const d = call.id && state.calls.find((x) => x.id === call.id);
    const live = [...call.peers.values()].filter((p) => p.stream).length;
    const sec = call.started ? Math.floor((Date.now() - call.started) / 1000) : 0;
    const waiting = d ? waitingFor(d) : [];
    let text = '準備中…';
    if (!call.id && call.kind === 'voice') text = '正在撥號…';
    if (call.id && live) text = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + (waiting.length ? '　等' + callNames(waiting) + '加入…' : '');
    else if (call.id && d && inCallIds(d).length > 1) text = '連線中…';
    else if (call.id && waiting.length) text = '正在等' + callNames(waiting) + '接聽…';
    st.textContent = text;
    const top = document.querySelector('.call-top b');
    if (top && d) top.textContent = callNames(callPeople(d).filter((u) => u !== state.userId));
    const wait = document.getElementById('call-wait');
    if (wait) wait.hidden = live > 0 && call.kind !== 'voice';      // 語音通話一直顯示對方的頭像
    const mute = document.getElementById('call-mute'), cam = document.getElementById('call-cam');
    mute.innerHTML = (call.muted ? CALL_ICON.micOff : CALL_ICON.mic) + `<small>${call.muted ? '取消靜音' : '靜音'}</small>`;
    mute.classList.toggle('on', call.muted); mute.setAttribute('aria-pressed', call.muted);
    if (call.kind === 'voice') {
      cam.innerHTML = CALL_ICON.video + '<small>改成視訊</small>';
      cam.classList.remove('on'); cam.removeAttribute('aria-pressed');
    } else {
      cam.innerHTML = (call.camOff ? CALL_ICON.camOff : CALL_ICON.video) + `<small>${call.camOff ? '開鏡頭' : '關鏡頭'}</small>`;
      cam.classList.toggle('on', call.camOff); cam.setAttribute('aria-pressed', call.camOff);
    }
    const l = document.getElementById('call-local');
    if (l) { l.hidden = call.camOff || !call.local; l.classList.toggle('mirror', call.facing === 'user'); }
  }
  function toggleMute() {
    call.muted = !call.muted;
    if (call.local) call.local.getAudioTracks().forEach((t) => { t.enabled = !call.muted; });
    updateCallView();
  }
  function toggleCam() {
    if (call.kind === 'voice') { upgradeToVideo(); return; }
    if (call.local && !call.local.getVideoTracks().length) { cameraOn(); return; }      // 從語音改成視訊的：自己還沒開過鏡頭
    call.camOff = !call.camOff;
    if (call.local) call.local.getVideoTracks().forEach((t) => { t.enabled = !call.camOff; });
    updateCallView();
  }
  // 打開自己的鏡頭，放到已經留好的影像通道上
  async function cameraOn() {
    if (!call.local) return false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: call.facing, width: { ideal: 640 }, height: { ideal: 480 } } });
      const track = s.getVideoTracks()[0];
      await Promise.all([...call.peers.values()].map((p) => { const snd = videoSender(p.pc); return snd ? snd.replaceTrack(track) : null; }));
      call.local.addTrack(track);
      call.camOff = false;
      const l = document.getElementById('call-local');
      if (l) { l.srcObject = null; l.srcObject = call.local; }
      updateCallView();
      return true;
    } catch (e) { console.warn(e); toast(e && e.name === 'NotAllowedError' ? '沒有相機的權限。請到 iPhone 的「設定」允許這個 App 使用相機。' : '打不開相機'); return false; }
  }
  // 語音 → 視訊：我先開鏡頭，再把通話改成視訊（其他人的畫面跟著切換，鏡頭由他們自己決定要不要開）
  async function upgradeToVideo() {
    if (!call.id) return;
    switchKind('video');
    if (await cameraOn()) Api.updateDoc('calls', call.id, { kind: 'video' }).catch((e) => console.warn(e));
    else switchKind('voice');
  }
  function switchKind(kind) {
    if (call.kind === kind) return;
    call.kind = kind;
    if (kind === 'video' && call.local && !call.local.getVideoTracks().length) call.camOff = true;
    const v = document.getElementById('call-view');
    if (v) { v.classList.toggle('voice', kind === 'voice'); v.setAttribute('aria-label', kindWord(kind) + '通話'); }
    if (kind === 'video') toast('改成視訊了' + (call.camOff ? '，要讓大家看到你就按「開鏡頭」' : ''));
    updateCallView();
  }
  async function flipCamera() {
    if (!call.local) return;
    const facing = call.facing === 'user' ? 'environment' : 'user';
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } });
      const track = s.getVideoTracks()[0];
      const old = call.local.getVideoTracks()[0];
      await Promise.all([...call.peers.values()].map((p) => {
        const sender = p.pc.getSenders().find((x) => x.track && x.track.kind === 'video');
        return sender ? sender.replaceTrack(track) : null;
      }));
      if (old) { call.local.removeTrack(old); old.stop(); }
      track.enabled = !call.camOff;
      call.local.addTrack(track);
      call.facing = facing;
      const l = document.getElementById('call-local');
      if (l) { l.srcObject = null; l.srcObject = call.local; }
      updateCallView();
    } catch (e) { console.warn(e); toast('切換不了鏡頭'); }
  }

  // ---- 聊天室上方：正在進行、我可以加入的通話 ----
  function joinableCall() {
    const me = state.userId;
    return state.calls.find((d) => liveCall(d) && callPeople(d).includes(me) && inCallIds(d).length && !inCallIds(d).includes(me)
      && d.id !== call.id && d.id !== call.incoming);
  }
  function callBannerHtml() {
    const d = !call.id && joinableCall();
    if (!d) return '';
    return `<button class="call-banner" data-act="call-join" data-id="${esc(d.id)}">${callKind(d) === 'voice' ? PHONE_SVG : CALL_ICON.video}<span><b>${kindWord(callKind(d))}通話進行中</b><small>${esc(callNames(inCallIds(d)))}</small></span><em>加入</em></button>`;
  }
  function refreshCallBanner() {
    const el = document.getElementById('call-banner');
    if (el) el.innerHTML = callBannerHtml();
  }

  // ---- 撥打畫面＋通話紀錄 ----
  function callLogHtml() {
    const me = state.userId;
    const list = state.calls.filter((d) => callPeople(d).includes(me) && d.status === 'ended')
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, 30);
    if (!list.length) return '<p class="hint">還沒有通話紀錄。</p>';
    return `<div class="call-log">${list.map((d) => {
      const out = d.from === me;
      const others = callPeople(d).filter((u) => u !== me);
      const dur = d.answered_at && d.ended_at ? Math.max(0, Math.round((d.ended_at - d.answered_at) / 1000)) : 0;
      const joinedMe = !!(d.joined || {})[me];
      let result, bad = false;
      if (d.answered_at && joinedMe) result = '通話 ' + (dur >= 60 ? Math.floor(dur / 60) + ' 分 ' : '') + (dur % 60) + ' 秒';
      else if (out) result = d.answered_at ? '對方有接' : '沒有人接';
      else if ((d.declined || {})[me]) result = '已拒絕';
      else { result = '未接來電'; bad = true; }
      return `
        <button class="call-log-row" data-act="call-again" data-id="${esc(d.id)}" aria-label="再打一次給${esc(callNames(others))}">
          <span class="call-dir ${out ? 'out' : bad ? 'missed' : 'in'}" aria-label="${out ? '撥出' : '來電'}">${out ? CALL_ICON.out : CALL_ICON.in}</span>
          <span class="call-log-main"><b class="${bad ? 'missed' : ''}">${esc(callNames(others))}</b><small>${kindWord(callKind(d))}・${result}</small></span>
          <time>${stamp(d.created_at)}</time>
        </button>`;
    }).join('')}</div>`;
  }
  function openCallPicker() {
    const others = state.members.filter((m) => m.id !== state.userId);
    showSheet('call-form', {
      title: '打電話', submit: '開始通話',
      body: `
      <fieldset class="seg call-kind"><legend>通話方式</legend>
        <label><input type="radio" name="call_kind" value="voice"><span>${PHONE_SVG}語音</span></label>
        <label><input type="radio" name="call_kind" value="video" checked><span>${CALL_ICON.video}視訊</span></label>
      </fieldset>
      <p class="hint">選要一起通話的人，可以選好幾個（最多 ${MAX_CALL} 個人一起）。</p>
      <div class="call-pick">
        ${others.map((m) => `
          <label class="call-pick-row">
            ${avatarHtml(m)}<b>${esc(m.display_name)}</b><small>${esc(statusText(m.id))}</small>
            <input type="checkbox" name="call_to" value="${esc(m.id)}"><span class="check" aria-hidden="true"></span>
          </label>`).join('')}
      </div>
      ${others.length > 1 ? '<button type="button" class="btn ghost small" data-act="call-all">全家一起</button>' : ''}
      <p class="hint">對方會收到通知，點開 App 就能接聽。通話時 App 要停在畫面上，切到別的 App 或鎖定畫面，視訊會中斷；回來後可以從聊天室上方重新加入。</p>
      <h3 class="call-log-head">通話紀錄</h3>
      ${callLogHtml()}`
    });
  }
  function onCallForm(form) {
    const to = checkedValues(form, 'call_to');
    const err = form.querySelector('#form-error');
    if (!to.length) { err.textContent = '請選一個以上的人'; err.hidden = false; return; }
    const kind = (form.querySelector('input[name="call_kind"]:checked') || {}).value;
    closeSheet();
    startCall(to, kind);
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

  // 表單面板：抓著上面的標題列往下拉就關閉（跟 iPhone 的面板一樣）
  let pull = null;
  document.addEventListener('touchstart', (ev) => {
    const head = ev.target.closest && ev.target.closest('.sheet-head');
    pull = head && !ev.target.closest('button') && ev.touches.length === 1 ? { y: ev.touches[0].clientY, sheet: head.closest('.sheet') } : null;
  }, { passive: true });
  document.addEventListener('touchmove', (ev) => {
    if (!pull) return;
    const dy = Math.max(0, ev.touches[0].clientY - pull.y);
    pull.dy = dy;
    pull.sheet.style.transition = 'none';
    pull.sheet.style.transform = 'translateY(' + dy + 'px)';
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!pull) return;
    const { sheet, dy } = pull;
    pull = null;
    if (dy > 90) { const x = sheet.querySelector('[data-act="close"]'); if (x) x.click(); return; }
    sheet.style.transition = 'transform .2s'; sheet.style.transform = '';
  }, { passive: true });

  // 中文輸入法選好字之後，補做一次搜尋（有些 iPhone 選字完不會再送一次 input）
  document.addEventListener('compositionend', (ev) => {
    if (ev.target.id === 'tra-q') { state.transit.traQ = ev.target.value; refreshFoundStations(); }
  });

  // 手指往右滑＝返回。鍾家生活裡：功能 → 功能清單、旅程 → 所有旅程、公車路線 → 搜尋頁；
  // 已經在功能清單，或在聊天、我有話要說、設定：回到首頁。
  // 看相簿的照片時，左右滑是上一張、下一張。在可以左右捲的地方（分類標籤列等）滑不算。
  function inSideScroller(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
    }
    return false;
  }
  let swipe = null;
  document.addEventListener('touchstart', (ev) => {
    const t = ev.touches[0];
    const tag = ev.target.tagName;
    swipe = ev.touches.length === 1 && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !inSideScroller(ev.target)
      ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  }, { passive: true });
  document.addEventListener('touchend', (ev) => {
    if (!swipe || !state.userId) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, quick = Date.now() - swipe.at < 700;
    swipe = null;
    if (!quick || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;      // 要夠長、夠快、夠水平
    if ($sheet.querySelector('.album-view')) {
      if (zoom.scale > 1) return;      // 放大看的時候，左右滑是移動照片，不換張
      const step = $sheet.querySelector(dx > 0 ? '.album-step.prev' : '.album-step.next');
      if (step) step.click();
      return;
    }
    if (dx < 0 || $sheet.innerHTML || vp || state.tab === 'cal' || (document.getElementById('call-root') || {}).innerHTML) return;
    const back = state.tab === 'notes' && document.querySelector('#scroller .link-btn.back');
    if (back) back.click();
    else goTab('cal');
    const sc = scroller();
    if (sc) { sc.classList.remove('slide-back'); void sc.offsetWidth; sc.classList.add('slide-back'); }
  }, { passive: true });

  function goTab(tab) {
    if (tab === 'ledger') { state.notesView = 'ledger'; state.ledgerDay = null; tab = 'notes'; }
    if (tab === 'polls') { state.postsView = 'polls'; tab = 'posts'; }
    if (tab === 'todos') { state.notesView = 'shop'; tab = 'notes'; }
    if (tab === 'video') { state.notesView = 'video'; if (!amChild() && state.videos.some((v) => v.status === 'pending')) state.videoMode = 'manage'; tab = 'notes'; }
    if (tab === 'study') { state.notesView = 'study'; state.studyDay = today(); tab = 'notes'; }
    if (!TABS.some(([id]) => id === tab)) return;
    // 從別的分頁回到首頁：日期回到今天（之前點去看別天也一樣）
    if (tab === 'cal' && state.tab !== 'cal') { state.selected = today(); state.cursor = today().slice(0, 7); }
    if (state.tab === 'chat' && tab !== 'chat') leaveChat();
    const entering = tab === 'chat' && state.tab !== 'chat';
    state.tab = tab;
    state.chatSearch = false; state.chatQuery = ''; state.menuMsg = null;
    if (!state.userId) return;            // 還沒登入：登入後會直接顯示這個分頁
    closeSheet();
    if (entering) enterChat(); else if (tab === 'chat') markRead();
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
      const busy = vp || $sheet.innerHTML || state.draft || (a && /^(INPUT|TEXTAREA)$/.test(a.tagName));
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
