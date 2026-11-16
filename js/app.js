(function () {
  'use strict';

  const CATEGORIES = {
    schedule: { label: '行程', color: 'var(--c-schedule)' },
    exam:     { label: '考試', color: 'var(--c-exam)' },
    family:   { label: '家庭活動', color: 'var(--c-family)' },
    other:    { label: '其他', color: 'var(--c-other)' }
  };
  const CONTACT_GROUPS = ['家人', '親戚', '學校', '醫療', '其他'];
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  const READ_KEY = 'family-chat-read';

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

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 狀態 ----------
  const state = {
    userId: null,
    members: [],
    tab: 'cal',              // cal | chat | notes | contacts | me
    calView: 'month',        // month | list
    cursor: today().slice(0, 7), // 目前顯示的月份 'YYYY-MM'
    selected: today(),
    monthEvents: [],
    upcoming: [],
    notes: [],
    contacts: [],
    contactQuery: '',
    messages: [],
    draft: '',
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
  const member = (id) => state.members.find((m) => m.id === id);

  // ---------- 月曆格子範圍 ----------
  function gridRange(cursor) {
    const first = parse(cursor + '-01');
    const start = new Date(first); start.setDate(1 - first.getDay());
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const end = new Date(last); end.setDate(last.getDate() + (6 - last.getDay()));
    return { from: ymd(start), to: ymd(end) };
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

  function expand(list, from, to) {
    const out = [];
    list.forEach((ev) => {
      if (ev.repeat !== 'weekly') { out.push(ev); return; }
      occurrenceDates(ev, from, to).forEach((d) => out.push({ ...ev, event_date: d, end_date: d, series: ev }));
    });
    return out.sort((a, b) => (a.event_date + (a.start_time || '')).localeCompare(b.event_date + (b.start_time || '')));
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

  async function loadContacts() {
    try { state.contacts = await Api.listContacts(); }
    catch (e) { console.error(e); toast('通訊錄讀取失敗'); }
    if (state.tab === 'contacts') render();
  }

  function loadTab() {
    if (state.tab === 'cal') loadEvents();
    else if (state.tab === 'notes') loadNotes();
    else if (state.tab === 'contacts') loadContacts();
  }

  // ---------- 啟動 ----------
  let stopWatchers = [];
  function stopWatching() { stopWatchers.forEach((fn) => fn()); stopWatchers = []; }

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
    render();
    await loadEvents();
    stopWatching();
    stopWatchers = [
      Api.watchEvents(() => { if (state.userId) loadEvents(); }),
      Api.watchMessages(onMessages)
    ];
  }

  // ---------- 登入畫面 ----------
  function renderLogin(error) {
    $app.innerHTML = `
      <main class="login">
        <div class="login-mark" aria-hidden="true">家</div>
        <h1>鍾家大宅</h1>
        <p class="login-sub">行程、雜記、通訊錄、聊天，都在這裡。</p>
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
      </main>`;
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
    notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h8l4 4v11a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z"/><path d="M14.5 3.5v4h4M8.5 12h7M8.5 16h5"/></svg>',
    contacts: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c.6-2 2.1-3 4-3s3.400 1 4 3M3 8h2M3 12h2M3 16h2"/></svg>',
    me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.500 20c1-4 4-5.500 7.500-5.500s6.500 1.500 7.500 5.500"/></svg>'
  };
  const FAB_LABEL = { cal: '新增行程', notes: '新增雜記', contacts: '新增聯絡人' };

  const hasUnread = () => state.messages.some((m) => m.sender !== state.userId && m.sent_at > state.lastRead);

  function render() {
    if (!state.userId) return;
    const focusId = document.activeElement && document.activeElement.id;
    const views = { cal: viewCalendar, chat: viewChat, notes: viewNotes, contacts: viewContacts, me: viewMe };
    const tab = (id, label) => `
      <button class="tab ${state.tab === id ? 'on' : ''} ${id === 'chat' && hasUnread() ? 'unread' : ''}" data-act="tab" data-tab="${id}" ${state.tab === id ? 'aria-current="page"' : ''}>
        ${ICON[id]}<span>${label}</span>
      </button>`;
    $app.innerHTML = `
      <div class="screen ${state.tab === 'chat' ? 'chat-screen' : ''}">${views[state.tab]()}</div>
      ${FAB_LABEL[state.tab] ? `<button class="fab" data-act="new" aria-label="${FAB_LABEL[state.tab]}">＋</button>` : ''}
      <nav class="tabbar" aria-label="主選單">
        ${tab('cal', '月曆')}${tab('chat', '聊天')}${tab('notes', '雜記')}${tab('contacts', '通訊錄')}${tab('me', '我')}
      </nav>`;
    // 重畫後把輸入焦點放回原本的欄位（聊天輸入框、通訊錄搜尋）
    if (focusId === 'chat-input' || focusId === 'contact-q') {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
    if (state.tab === 'chat') scrollChat();
  }

  // ---------- 月曆 ----------
  const eventsOn = (list, date) => list.filter((e) => e.event_date <= date && e.end_date >= date);

  function calSwitch() {
    const b = (v, label) => `<button class="${state.calView === v ? 'on' : ''}" data-act="cal-view" data-view="${v}" ${state.calView === v ? 'aria-pressed="true"' : ''}>${label}</button>`;
    return `<div class="switcher" role="group" aria-label="檢視方式">${b('month', '月曆')}${b('list', '近期')}</div>`;
  }

  function viewCalendar() {
    return calSwitch() + (state.calView === 'month' ? viewMonth() : viewUpcoming());
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
    return `
      <button class="event" data-act="edit-event" data-id="${esc(e.id)}" data-date="${e.event_date}" style="--cat:${cat.color}">
        <span class="event-time">${timeHtml(e, showDate)}</span>
        <span class="event-main">
          <span class="event-title">${esc(e.title)}</span>
          <span class="event-meta"><span class="cat">${cat.label}</span>${e.series ? '<span class="rep">每週</span>' : ''}${whoHtml(e)}</span>
          ${e.note ? `<span class="event-note">${esc(e.note)}</span>` : ''}
        </span>
      </button>`;
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
  function chatListHtml() {
    if (!state.messages.length) return '<div class="empty big"><p>還沒有訊息。說聲嗨吧。</p></div>';
    let html = '', lastDay = '', lastSender = '';
    state.messages.forEach((m) => {
      const day = ymd(new Date(m.sent_at));
      if (day !== lastDay) {
        const n = daysBetween(day, today());
        html += `<div class="chat-day">${n === 0 ? '今天' : n === 1 ? '昨天' : shortDate(day)}</div>`;
        lastDay = day; lastSender = '';
      }
      const mine = m.sender === state.userId;
      const who = member(m.sender);
      const showName = !mine && m.sender !== lastSender;
      html += `
        <div class="msg ${mine ? 'mine' : ''}" style="--who:${esc(who ? who.color : '#7A847F')}">
          ${showName ? `<div class="msg-name">${esc(who ? who.display_name : '已離開的成員')}</div>` : ''}
          <div class="msg-row"><div class="bubble">${esc(m.text)}</div><time>${clock(m.sent_at)}</time></div>
        </div>`;
      lastSender = m.sender;
    });
    return html;
  }

  function viewChat() {
    return `
      <header class="plain-head"><h1>聊天</h1><p>全家四個人</p></header>
      <div class="chat" id="chat-list" aria-live="polite">${chatListHtml()}</div>
      <form class="chat-bar" id="chat-form">
        <input id="chat-input" name="text" type="text" placeholder="輸入訊息" value="${esc(state.draft)}" maxlength="2000" autocomplete="off" enterkeyhint="send" aria-label="訊息">
        <button type="submit" class="send" aria-label="傳送">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12.500 6l6 6-6 6"/></svg>
        </button>
      </form>`;
  }

  function scrollChat() { window.scrollTo(0, document.documentElement.scrollHeight); }

  function markRead() {
    const last = state.messages[state.messages.length - 1];
    if (!last || last.sent_at <= state.lastRead) return;
    state.lastRead = last.sent_at;
    try { localStorage.setItem(READ_KEY, String(state.lastRead)); } catch (e) { /* 忽略 */ }
  }

  function onMessages(list) {
    state.messages = list;
    if (state.tab === 'chat' && document.visibilityState === 'visible') {
      markRead();
      const el = document.getElementById('chat-list');
      if (el) { el.innerHTML = chatListHtml(); scrollChat(); }
    }
    const tabEl = document.querySelector('.tab[data-tab="chat"]');
    if (tabEl) tabEl.classList.toggle('unread', hasUnread());
  }

  async function onSend(form) {
    const input = form.elements.text;
    const text = input.value.trim();
    if (!text) return;
    input.value = ''; state.draft = '';
    input.focus();
    try { await Api.sendMessage(text); }
    catch (e) {
      console.error(e);
      state.draft = text; input.value = text;
      toast('訊息沒有送出，請再試一次');
    }
  }

  // ---------- 雜記 ----------
  function viewNotes() {
    const cards = state.notes.map((n) => {
      const who = member(n.updated_by);
      return `
        <button class="note ${n.pinned ? 'pinned' : ''}" data-act="edit-note" data-id="${esc(n.id)}">
          ${n.pinned ? '<span class="pin">置頂</span>' : ''}
          <span class="note-title">${esc(n.title || '（沒有標題）')}</span>
          ${n.body ? `<span class="note-body">${esc(n.body)}</span>` : ''}
          <span class="note-meta">${who ? esc(who.display_name) + '　' : ''}${stamp(n.updated_at)}</span>
        </button>`;
    }).join('');
    return `
      <header class="plain-head"><h1>雜記</h1><p>全家都看得到</p></header>
      ${cards ? `<div class="notes">${cards}</div>` : `
        <div class="empty big">
          <p>還沒有雜記。密碼、採買清單、要記得的事都可以放這裡。</p>
          <button class="link-btn" data-act="new">寫第一則</button>
        </div>`}`;
  }

  // ---------- 通訊錄 ----------
  function contactListHtml() {
    const q = state.contactQuery.trim().toLowerCase();
    const list = state.contacts.filter((c) =>
      !q || [c.name, c.phone, c.group, c.note, c.address].join(' ').toLowerCase().includes(q));
    if (!state.contacts.length) return `
      <div class="empty big">
        <p>通訊錄是空的。親戚、老師、診所的電話都可以存在這裡。</p>
        <button class="link-btn" data-act="new">新增聯絡人</button>
      </div>`;
    if (!list.length) return '<div class="empty big"><p>找不到符合的聯絡人。</p></div>';
    const groups = CONTACT_GROUPS.concat(list.map((c) => c.group).filter((g) => !CONTACT_GROUPS.includes(g)));
    return Array.from(new Set(groups)).map((g) => {
      const rows = list.filter((c) => c.group === g);
      if (!rows.length) return '';
      return `
        <section class="contact-group">
          <h2>${esc(g)}</h2>
          ${rows.map((c) => `
            <div class="contact">
              <button class="contact-main" data-act="edit-contact" data-id="${esc(c.id)}">
                <span class="contact-name">${esc(c.name)}</span>
                <span class="contact-sub">${esc([c.phone, c.note].filter(Boolean).join('　'))}</span>
              </button>
              ${c.phone ? `<a class="call" href="tel:${esc(c.phone.replace(/[^\d+#*]/g, ''))}" aria-label="撥打給${esc(c.name)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.500 4h3l1.500 4-2 1.500a11 11 0 0 0 5.500 5.500l1.500-2 4 1.500v3a2 2 0 0 1-2 2A15.500 15.500 0 0 1 4.500 6a2 2 0 0 1 2-2z"/></svg>
              </a>` : ''}
            </div>`).join('')}
        </section>`;
    }).join('');
  }

  function viewContacts() {
    return `
      <header class="plain-head"><h1>通訊錄</h1><p>${state.contacts.length} 位</p></header>
      ${state.contacts.length ? `<input id="contact-q" class="search" type="search" placeholder="搜尋姓名或電話" value="${esc(state.contactQuery)}" autocomplete="off" aria-label="搜尋聯絡人">` : ''}
      <div id="contact-list">${contactListHtml()}</div>`;
  }

  // ---------- 我 ----------
  function viewMe() {
    const m = me();
    return `
      <header class="plain-head"><h1>${esc(m.display_name)}</h1><p>已登入</p></header>
      <section class="card-list">
        <h2>家庭成員</h2>
        ${state.members.map((x) => `
          <div class="member">
            <span class="avatar" style="background:${esc(x.color)}">${esc(x.display_name.slice(0, 1))}</span>
            <span>${esc(x.display_name)}</span>
            ${x.id === state.userId ? '<em>這是你</em>' : ''}
          </div>`).join('')}
      </section>
      ${Api.isDemo ? '<p class="demo-note">示範模式：資料只存在這台裝置。設定 Firebase 後，全家才會看到同一份資料。</p>' : ''}
      <button class="btn ghost" data-act="logout">登出</button>`;
  }

  // ---------- 表單面板（新增／編輯共用外框） ----------
  function showSheet(formId, isNew, body, footer) {
    $sheet.innerHTML = `
      <div class="backdrop" data-act="close"></div>
      <form class="sheet" id="${formId}" role="dialog" aria-modal="true" aria-label="${isNew ? '新增' : '編輯'}" novalidate>
        <div class="sheet-head">
          <button type="button" class="link-btn" data-act="close">取消</button>
          <strong>${isNew ? '新增' : '編輯'}</strong>
          <button type="submit" class="link-btn strong">儲存</button>
        </div>
        <div class="sheet-body">
          ${body}
          <p class="form-error" id="form-error" role="alert" hidden></p>
          ${isNew ? '' : (footer || '<button type="button" class="btn danger" data-act="delete">刪除</button>')}
        </div>
      </form>`;
    document.body.classList.add('sheet-open');
    if (isNew) setTimeout(() => { const i = $sheet.querySelector('.title-input'); if (i) i.focus(); }, 60);
  }

  function closeSheet() {
    $sheet.innerHTML = '';
    document.body.classList.remove('sheet-open');
  }

  let sheetOccurrence = null;   // 從哪一天的場次打開重複行程（用來「只取消這一天」）

  function openEventSheet(ev, occDate) {
    sheetOccurrence = ev && ev.repeat ? occDate : null;
    const weekly = !!(ev && ev.repeat === 'weekly');
    const e = ev || {
      title: '', category: 'schedule', event_date: state.calView === 'month' ? state.selected : today(),
      end_date: null, start_time: null, end_time: null, member_ids: [], note: ''
    };
    const allDay = !e.start_time;
    showSheet('event-form', !ev, `
      <input type="hidden" name="item_id" value="${esc(e.id || '')}">
      <input class="title-input" name="title" placeholder="要做什麼？" value="${esc(e.title)}" maxlength="80" autocomplete="off">

      <fieldset class="seg">
        <legend>類型</legend>
        ${Object.keys(CATEGORIES).map((k) => `
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
      weekly ? `
        ${occDate ? `<button type="button" class="btn ghost skip" data-act="skip-day">只取消 ${shortDate(occDate)} 這一次</button>` : ''}
        <button type="button" class="btn danger" data-act="delete">刪除全部重複行程</button>` : '');
    $sheet.querySelector('form').dataset.skips = JSON.stringify((ev && ev.skip_dates) || []);
  }

  function openNoteSheet(note) {
    const n = note || { title: '', body: '', pinned: false };
    showSheet('note-form', !note, `
      <input type="hidden" name="item_id" value="${esc(n.id || '')}">
      <input class="title-input" name="title" placeholder="標題" value="${esc(n.title)}" maxlength="100" autocomplete="off">
      <label>內容<textarea name="body" rows="9" maxlength="20000" placeholder="想記下來的事…">${esc(n.body)}</textarea></label>
      <label class="switch">
        <span>置頂</span>
        <input type="checkbox" name="pinned" ${n.pinned ? 'checked' : ''}>
      </label>`);
  }

  function openContactSheet(contact) {
    const c = contact || { name: '', group: '其他', phone: '', address: '', note: '' };
    showSheet('contact-form', !contact, `
      <input type="hidden" name="item_id" value="${esc(c.id || '')}">
      <input class="title-input" name="name" placeholder="姓名或稱呼" value="${esc(c.name)}" maxlength="60" autocomplete="off">
      <fieldset class="seg">
        <legend>分類</legend>
        ${CONTACT_GROUPS.map((g) => `
          <label style="--cat:var(--green)">
            <input type="radio" name="group" value="${g}" ${c.group === g ? 'checked' : ''}>
            <span>${g}</span>
          </label>`).join('')}
      </fieldset>
      <label>電話<input type="tel" name="phone" value="${esc(c.phone)}" maxlength="30" autocomplete="off" inputmode="tel"></label>
      <label>地址<input type="text" name="address" value="${esc(c.address)}" maxlength="200" autocomplete="off"></label>
      <label>備註<textarea name="note" rows="3" maxlength="500" placeholder="關係、方便聯絡的時間…">${esc(c.note)}</textarea></label>`);
  }

  // 每種表單：怎麼讀欄位、怎麼驗證、存到哪、存完重新載入什麼
  const FORMS = {
    'event-form': {
      read(f) {
        const allDay = f.all_day.checked;
        const ev = {
          id: f.item_id.value || null,
          title: f.title.value.trim(),
          category: f.category.value,
          event_date: f.event_date.value,
          end_date: f.end_date.value || f.event_date.value,
          start_time: allDay ? null : (f.start_time.value || null),
          end_time: allDay ? null : (f.end_time.value || null),
          member_ids: Array.from(f.member.length === undefined ? [f.member] : f.member).filter((i) => i.checked).map((i) => i.value),
          note: f.note.value.trim()
        };
        if (!ev.start_time) ev.end_time = null;
        if (f.weekly.checked) {
          ev.repeat = 'weekly';
          ev.repeat_days = Array.from(f.weekday).filter((i) => i.checked).map((i) => Number(i.value));
          ev.skip_dates = JSON.parse(f.item_id.form.dataset.skips || '[]');
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
    'contact-form': {
      read: (f) => ({ id: f.item_id.value || null, name: f.name.value.trim(), group: f.group.value, phone: f.phone.value.trim(), address: f.address.value.trim(), note: f.note.value.trim() }),
      check: (c) => (!c.name ? '請輸入姓名或稱呼' : null),
      save: (x) => Api.saveContact(x),
      remove: (id) => Api.deleteContact(id),
      after: () => loadContacts()
    }
  };

  async function onSave(form) {
    const spec = FORMS[form.id];
    const err = form.querySelector('#form-error');
    const fail = (msg) => { err.textContent = msg; err.hidden = false; };
    const item = spec.read(form.elements);
    const problem = spec.check(item, form.elements);
    if (problem) return fail(problem);

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await spec.save(item);
      closeSheet();
      toast('已儲存');
      await spec.after(item);
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      fail('儲存失敗，請確認網路後再試一次');
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

  const findById = (list, id) => list.find((x) => String(x.id) === id);

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
      if (state.tab === 'chat') markRead();
      render();
      if (state.tab !== 'chat') window.scrollTo(0, 0);
      loadTab();
    }
    else if (act === 'cal-view') { state.calView = el.dataset.view; render(); window.scrollTo(0, 0); }
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
      else if (state.tab === 'contacts') openContactSheet(null);
      else openEventSheet(null);
    }
    else if (act === 'edit-event') {
      const e = findById(state.monthEvents.concat(state.upcoming), el.dataset.id);
      if (e) openEventSheet(e.series || e, el.dataset.date);
    }
    else if (act === 'skip-day') onSkipDay(el);
    else if (act === 'edit-note') { const n = findById(state.notes, el.dataset.id); if (n) openNoteSheet(n); }
    else if (act === 'edit-contact') { const c = findById(state.contacts, el.dataset.id); if (c) openContactSheet(c); }
    else if (act === 'close') closeSheet();
    else if (act === 'delete') onDelete(el);
    else if (act === 'logout') {
      stopWatching();
      Api.signOut().then(() => {
        Object.assign(state, { userId: null, tab: 'cal', messages: [], notes: [], contacts: [], draft: '' });
        renderLogin();
      });
    }
  });

  document.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const id = ev.target.id;
    if (id === 'login-form') onLogin(ev.target);
    else if (id === 'chat-form') onSend(ev.target);
    else if (FORMS[id]) onSave(ev.target);
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'chat-input') state.draft = ev.target.value;
    if (ev.target.id === 'contact-q') {
      state.contactQuery = ev.target.value;
      document.getElementById('contact-list').innerHTML = contactListHtml();
    }
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
      if (on && f.event_date.value && !Array.from(f.weekday).some((i) => i.checked)) {
        f.weekday[parse(f.event_date.value).getDay()].checked = true;
      }
    }
  });

  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $sheet.innerHTML) closeSheet(); });

  // App 從背景回來時重新讀取目前的分頁
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.userId || $sheet.innerHTML) return;
    if (state.tab === 'chat') { markRead(); render(); } else loadTab();
  });

  // 鍵盤彈出時，把聊天輸入列貼在鍵盤上方，並收起底部選單
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const onViewport = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', kb + 'px');
      document.body.classList.toggle('kb-open', kb > 120);
    };
    vv.addEventListener('resize', onViewport);
    vv.addEventListener('scroll', onViewport);
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  boot();
})();
