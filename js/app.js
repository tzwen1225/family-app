(function () {
  'use strict';

  const CATEGORIES = {
    schedule: { label: '行程', color: 'var(--c-schedule)' },
    exam:     { label: '考試', color: 'var(--c-exam)' },
    family:   { label: '家庭活動', color: 'var(--c-family)' },
    other:    { label: '其他', color: 'var(--c-other)' },
    birthday: { label: '生日', color: 'var(--c-birthday)' }   // 由成員基本資料自動產生，不能手動新增
  };
  const EVENT_CATS = ['schedule', 'exam', 'family', 'other'];
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
  const state = {
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
  const canEditProfile = (id) => id === state.userId || isAdmin();
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
      <div class="pres ${isOnline(m.id) ? 'on' : ''}">
        ${avatarHtml(m)}
        <span class="pres-name">${esc(m.display_name)}</span>
        <span class="pres-status">${statusText(m.id)}</span>
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

  function expand(list, from, to) {
    const out = birthdayEvents(from, to);
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

  async function loadProfiles() {
    try { state.profiles = await Api.listProfiles(); }
    catch (e) { console.error(e); }
  }

  function loadTab() {
    if (state.tab === 'cal') loadEvents();
    else if (state.tab === 'notes') loadNotes();
  }

  // ---------- 啟動 ----------
  let stopWatchers = [];
  let beatTimer = null;
  function stopWatching() {
    stopWatchers.forEach((fn) => fn());
    stopWatchers = [];
    clearInterval(beatTimer);
  }
  function beat(online) { Api.beat(online).catch((e) => console.warn('上線狀態更新失敗', e)); }

  async function boot() {
    try {
      state.userId = await Api.currentUserId();
      if (state.userId) await enter();
      else renderLogin();
    } catch (e) {
      console.error(e);
      renderLogin('連線失敗，請確認網路後再試一次');
    }
  }

  async function enter() {
    state.members = await Api.listMembers();
    if (!me()) {
      await Api.signOut();
      state.userId = null;
      renderLogin('這個帳號不在家庭成員名單裡');
      return;
    }
    await loadProfiles();
    render();
    await loadEvents();
    stopWatching();
    stopWatchers = [
      Api.watchEvents(() => { if (state.userId) loadEvents(); }),
      Api.watchMessages(onMessages),
      Api.watchPosts((list) => { state.posts = list; refreshPosts(); }),
      Api.watchReplies((list) => { state.replies = list; refreshPosts(); }),
      Api.watchPresence((map) => { state.presence = map; refreshPresence(); })
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
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/></svg>',
    posts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l7 4.5v-13L7 10zM17.500 9.500a4 4 0 0 1 0 5M7.500 14l1 5h2.500"/></svg>',
    notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h8l4 4v11a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z"/><path d="M14.5 3.5v4h4M8.5 12h7M8.5 16h5"/></svg>',
    me: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h10M18 17h2"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12.500 6l6 6-6 6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.500 4h3l1.500 4-2 1.500a11 11 0 0 0 5.500 5.500l1.500-2 4 1.500v3a2 2 0 0 1-2 2A15.500 15.500 0 0 1 4.500 6a2 2 0 0 1 2-2z"/></svg>'
  };
  const TABS = [['cal', '月曆'], ['chat', '聊天'], ['posts', '我有話要說'], ['notes', '雜記'], ['me', '設定']];
  const FAB_LABEL = { cal: '新增行程', posts: '我有話要說', notes: '新增雜記' };

  const hasUnread = () => state.messages.some((m) => m.sender !== state.userId && m.sent_at > state.lastRead);
  const repliedBy = (post, uid) => state.replies.some((r) => r.post_id === post.id && r.author === uid);
  const waitingForMe = () => state.posts.some((p) => p.to.includes(state.userId) && !repliedBy(p, state.userId));
  const badge = (tab) => (tab === 'chat' ? hasUnread() : tab === 'posts' ? waitingForMe() : false);

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
          <input id="chat-input" name="text" type="text" placeholder="輸入訊息" value="${esc(state.draft)}" maxlength="2000" autocomplete="off" enterkeyhint="send" aria-label="訊息">
          <button type="submit" class="send" aria-label="傳送">${ICON.send}</button>
        </form>` : ''}
      ${FAB_LABEL[state.tab] ? `<button class="fab" data-act="new" aria-label="${FAB_LABEL[state.tab]}">＋</button>` : ''}
      <nav class="tabbar" aria-label="主選單">
        ${TABS.map(([id, label]) => `
          <button class="tab ${state.tab === id ? 'on' : ''} ${badge(id) ? 'unread' : ''}" data-act="tab" data-tab="${id}" ${state.tab === id ? 'aria-current="page"' : ''}>
            ${ICON[id]}<span>${label}</span>
          </button>`).join('')}
      </nav>`;
    renderedTab = state.tab;

    // 重畫後恢復捲動位置與輸入焦點
    if (state.tab === 'chat' && !sameTab) scrollChat(); else scroller().scrollTop = keepTop;
    const el = focusId && document.getElementById(focusId);
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* 某些欄位不支援 */ } }
  }

  // ---------- 月曆 ----------
  const eventsOn = (list, date) => list.filter((e) => e.event_date <= date && e.end_date >= date);

  function calSwitch() {
    const b = (v, label) => `<button class="${state.calView === v ? 'on' : ''}" data-act="cal-view" data-view="${v}" ${state.calView === v ? 'aria-pressed="true"' : ''}>${label}</button>`;
    return `<div class="switcher" role="group" aria-label="檢視方式">${b('month', '月曆')}${b('list', '近期')}</div>`;
  }

  function viewCalendar() {
    return `<section class="presence" id="presence" aria-label="家人上線狀態">${presenceHtml()}</section>`
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
        date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : '',
        d === t ? 'today' : '',
        d === state.selected ? 'sel' : ''
      ].join(' ');
      const dots = evs.slice(0, 3).map((e) => `<i style="background:${CATEGORIES[e.category].color}"></i>`).join('');
      cells += `
        <button class="${cls}" data-act="pick" data-date="${d}" aria-label="${date.getMonth() + 1}月${date.getDate()}日，${evs.length} 件事" ${d === state.selected ? 'aria-pressed="true"' : ''}>
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
        </div>
        <div class="leaf-list">
          ${dayEvents.length ? dayEvents.map((e) => eventRow(e)).join('') : `
            <div class="empty">
              <p>這天還沒有安排。</p>
              <button class="link-btn" data-act="new">新增一件事</button>
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
    const cat = CATEGORIES[e.category];
    const inner = `
        <span class="event-time">${timeHtml(e, showDate)}</span>
        <span class="event-main">
          <span class="event-title">${esc(e.title)}</span>
          <span class="event-meta"><span class="cat">${cat.label}</span>${e.series ? '<span class="rep">每週</span>' : ''}${e.readonly ? '' : whoHtml(e)}</span>
          ${e.note ? `<span class="event-note">${esc(e.note)}</span>` : ''}
        </span>`;
    // 生日是自動產生的，不能點開編輯
    if (e.readonly) return `<div class="event" style="--cat:${cat.color}">${inner}</div>`;
    return `<button class="event" data-act="edit-event" data-id="${esc(e.id)}" data-date="${e.event_date}" style="--cat:${cat.color}">${inner}</button>`;
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
          <button class="link-btn" data-act="new">新增一件事</button>
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
      ? state.messages.filter((m) => !m.recalled && m.text.toLowerCase().includes(q.toLowerCase()))
      : state.messages;
    if (q && !list.length) return '<div class="empty big"><p>找不到含有「' + esc(q) + '」的訊息。</p></div>';
    if (!list.length) return '<div class="empty big"><p>還沒有訊息。說聲嗨吧。</p></div>';

    let html = q ? `<p class="found">找到 ${list.length} 則</p>` : '';
    let lastDay = '', lastSender = '';
    list.forEach((m) => {
      const day = ymd(new Date(m.sent_at));
      if (day !== lastDay) {
        const n = daysBetween(day, today());
        html += `<div class="chat-day">${n === 0 ? '今天' : n === 1 ? '昨天' : shortDate(day)}</div>`;
        lastDay = day; lastSender = '';
      }
      const mine = m.sender === state.userId;
      const showName = !mine && (q || m.sender !== lastSender);
      let bubble;
      if (m.recalled) bubble = `<div class="bubble recalled">${mine ? '你' : esc(nameOf(m.sender))}收回了訊息</div>`;
      else if (!q && canRecall(m)) bubble = `<button class="bubble" data-act="msg-menu" data-id="${esc(m.id)}" aria-label="${esc(m.text)}，點一下可以收回">${esc(m.text)}</button>`;
      else bubble = `<div class="bubble">${markText(m.text, q)}</div>`;
      html += `
        <div class="msg ${mine ? 'mine' : ''}" style="--who:${esc(colorOf(m.sender))}">
          ${showName ? `<div class="msg-name">${esc(nameOf(m.sender))}</div>` : ''}
          <div class="msg-row">${bubble}<time>${clock(m.sent_at)}</time></div>
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
        <button class="icon-btn ${state.chatSearch ? 'on' : ''}" data-act="chat-search" aria-label="${state.chatSearch ? '關閉搜尋' : '搜尋訊息'}" aria-pressed="${state.chatSearch}">${ICON.search}</button>
      </header>
      ${state.chatSearch ? `<input id="chat-q" class="search" type="search" placeholder="搜尋訊息" value="${esc(state.chatQuery)}" autocomplete="off" aria-label="搜尋訊息">` : ''}
      <div class="chat" id="chat-list" aria-live="polite">${chatListHtml()}</div>`;
  }

  // 捲到最新一則。畫面高度可能還在變（鍵盤彈出、新訊息剛畫上去），所以隔一下再補捲兩次。
  function scrollChat() {
    const go = () => { const s = scroller(); if (s && state.tab === 'chat' && !state.chatSearch) s.scrollTop = s.scrollHeight; };
    go(); requestAnimationFrame(go); setTimeout(go, 150); setTimeout(go, 400);
  }

  function refreshChat(toBottom) {
    const el = document.getElementById('chat-list');
    if (!el) return;
    el.innerHTML = chatListHtml();
    if (toBottom) scrollChat();
  }

  function markRead() {
    const last = state.messages[state.messages.length - 1];
    if (!last || last.sent_at <= state.lastRead) return;
    state.lastRead = last.sent_at;
    try { localStorage.setItem(READ_KEY, String(state.lastRead)); } catch (e) { /* 忽略 */ }
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

  async function onRecall(id) {
    state.menuMsg = null;
    try { await Api.recallMessage(id); toast('已收回'); }
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
        <button class="link-btn" data-act="new">我有話要說</button>
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
    return `
      <header class="plain-head"><h1>我有話要說</h1><p>被標註的人才能回覆</p></header>
      <div id="post-list">${postListHtml()}</div>`;
  }

  function refreshPosts() {
    refreshBadges();
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
  function viewNotes() {
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
          <p>還沒有雜記。密碼、採買清單、要記得的事都可以放這裡。</p>
          <button class="link-btn" data-act="new">寫第一則</button>
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
      ${pushSectionHtml()}
      ${Api.isDemo ? '<p class="demo-note">示範模式：資料只存在這台裝置。設定 Firebase 後，全家才會看到同一份資料。</p>' : ''}
      <button class="btn ghost" data-act="logout">登出</button>`;
  }

  // ---------- 表單面板（共用外框） ----------
  // opts: { title, submit, body, footer }；footer 是放在最下面的按鈕（例如刪除）
  function showSheet(formId, opts) {
    $sheet.innerHTML = `
      <div class="backdrop" data-act="close"></div>
      <form class="sheet" id="${formId}" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}" novalidate>
        <div class="sheet-head">
          <button type="button" class="link-btn" data-act="close">取消</button>
          <strong>${esc(opts.title)}</strong>
          <button type="submit" class="link-btn strong">${opts.submit || '儲存'}</button>
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
    $sheet.innerHTML = '';
    document.body.classList.remove('sheet-open');
  }

  const DELETE_BTN = '<button type="button" class="btn danger" data-act="delete">刪除</button>';
  let sheetOccurrence = null;   // 從哪一天的場次打開重複行程（用來「只取消這一次」）

  function openEventSheet(ev, occDate) {
    sheetOccurrence = ev && ev.repeat ? occDate : null;
    const weekly = !!(ev && ev.repeat === 'weekly');
    const e = ev || {
      title: '', category: 'schedule', event_date: state.calView === 'month' ? state.selected : today(),
      end_date: null, start_time: null, end_time: null, member_ids: [], note: ''
    };
    const allDay = !e.start_time;
    showSheet('event-form', {
      title: ev ? '編輯' : '新增', focus: !ev,
      body: `
      <input type="hidden" name="item_id" value="${esc(e.id || '')}">
      <input class="title-input" name="title" placeholder="要做什麼？" value="${esc(e.title)}" maxlength="80" autocomplete="off">

      <fieldset class="seg">
        <legend>類型</legend>
        ${EVENT_CATS.map((k) => `
          <label style="--cat:${CATEGORIES[k].color}">
            <input type="radio" name="category" value="${k}" ${e.category === k ? 'checked' : ''}>
            <span>${CATEGORIES[k].label}</span>
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
      <p class="hint">填了生日，月曆上每年會自動出現。填了電話，設定頁可以直接撥打。</p>`
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
    'post-form': {
      done: '已送出',
      read: (f, form) => ({ text: f.text.value.trim(), to: checkedValues(form, 'to') }),
      check: (p) => (!p.text ? '請寫下想說的話' : !p.to.length ? '請選擇要給誰' : null),
      save: (x) => Api.addPost(x),
      after: () => { const s = scroller(); if (s) s.scrollTop = 0; }
    },
    'profile-form': {
      read: (f) => ({ id: f.item_id.value, birthday: f.birthday.value, phone: f.phone.value.trim(), org: f.org.value.trim(), note: f.note.value.trim() }),
      check: (p) => (p.birthday && p.birthday > today() ? '生日不能是未來的日期' : null),
      save: (p) => Api.saveProfile(p.id, p),
      async after() { await loadProfiles(); await loadEvents(); render(); }
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
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'tab') {
      state.tab = el.dataset.tab;
      state.menuMsg = null;
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
      if (state.tab === 'notes') openNoteSheet(null);
      else if (state.tab === 'posts') openPostSheet();
      else openEventSheet(null);
    }
    else if (act === 'edit-event') {
      const e = findById(state.monthEvents.concat(state.upcoming), el.dataset.id);
      if (e) openEventSheet(e.series || e, el.dataset.date);
    }
    else if (act === 'skip-day') onSkipDay(el);
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
    else if (act === 'push-on') onPushOn(el);
    else if (act === 'push-off') { Api.disablePush().then(() => { toast('已關閉通知'); render(); }); }
    else if (act === 'logout') {
      stopWatching();
      // 登出時也把這支手機從通知名單移除，避免登出後還收到通知
      Api.disablePush().catch(() => {}).then(() => Api.beat(false)).catch(() => {}).then(() => Api.signOut()).then(() => {
        Object.assign(state, {
          userId: null, tab: 'cal', messages: [], notes: [], posts: [], replies: [],
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
    else if (form.classList.contains('reply-form')) onReply(form);
    else if (FORMS[id]) onSave(form);
  });

  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'chat-input') state.draft = t.value;
    else if (t.id === 'chat-q') { state.chatQuery = t.value; refreshChat(false); }
    else if (t.form && t.form.classList.contains('reply-form')) state.postDrafts[t.form.dataset.post] = t.value;
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

  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $sheet.innerHTML) closeSheet(); });

  // App 切到背景時標成離線；回來時標成上線並重新讀取目前的分頁
  document.addEventListener('visibilitychange', () => {
    if (!state.userId) return;
    const visible = document.visibilityState === 'visible';
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
    document.addEventListener('focusout', settle);
    document.addEventListener('visibilitychange', settle);
    apply();
  })();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  boot();
})();
