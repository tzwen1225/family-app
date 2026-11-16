(function () {
  'use strict';

  const CATEGORIES = {
    schedule: { label: '行程', color: 'var(--c-schedule)' },
    exam:     { label: '考試', color: 'var(--c-exam)' },
    family:   { label: '家庭活動', color: 'var(--c-family)' },
    other:    { label: '其他', color: 'var(--c-other)' }
  };
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

  // ---------- 日期工具（一律用本地日期字串，避免時區問題） ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const today = () => ymd(new Date());
  const shortDate = (s) => { const d = parse(s); return (d.getMonth() + 1) + '/' + d.getDate() + '（' + WEEKDAYS[d.getDay()] + '）'; };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 狀態 ----------
  const state = {
    userId: null,
    members: [],
    tab: 'month',            // month | upcoming | me
    cursor: today().slice(0, 7), // 目前顯示的月份 'YYYY-MM'
    selected: today(),
    monthEvents: [],
    upcoming: [],
    loading: false
  };

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

  // ---------- 載入資料 ----------
  async function loadData() {
    const { from, to } = gridRange(state.cursor);
    try {
      const [month, upcoming] = await Promise.all([
        Api.listEvents(from, to),
        Api.listEvents(today(), addDays(today(), 90))
      ]);
      state.monthEvents = month;
      state.upcoming = upcoming;
    } catch (e) {
      console.error(e);
      toast('讀取失敗，請確認網路連線');
    }
    render();
  }

  // ---------- 啟動 ----------
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
    await loadData();
    stopWatching();
    stopWatch = Api.watchEvents(() => { if (state.userId) loadData(); });
  }

  let stopWatch = null;
  function stopWatching() { if (stopWatch) { stopWatch(); stopWatch = null; } }

  // ---------- 登入畫面 ----------
  function renderLogin(error) {
    $app.innerHTML = `
      <main class="login">
        <div class="login-mark" aria-hidden="true">家</div>
        <h1>我們家</h1>
        <p class="login-sub">行程、考試、家庭活動，全家看同一本月曆。</p>
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
  function render() {
    if (!state.userId) return;
    const body = state.tab === 'month' ? viewMonth()
      : state.tab === 'upcoming' ? viewUpcoming()
      : viewMe();
    const tab = (id, label, icon) => `
      <button class="tab ${state.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}" ${state.tab === id ? 'aria-current="page"' : ''}>
        ${icon}<span>${label}</span>
      </button>`;
    $app.innerHTML = `
      <div class="screen">${body}</div>
      ${state.tab !== 'me' ? '<button class="fab" data-act="new" aria-label="新增行程">＋</button>' : ''}
      <nav class="tabbar" aria-label="主選單">
        ${tab('month', '月曆', ICON.month)}
        ${tab('upcoming', '近期', ICON.list)}
        ${tab('me', '我', ICON.me)}
      </nav>`;
  }

  const ICON = {
    month: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17.5" r="1"/></svg>',
    me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20c1-4 4-5.5 7.5-5.5s6.5 1.5 7.5 5.5"/></svg>'
  };

  const eventsOn = (list, date) => list.filter((e) => e.event_date <= date && e.end_date >= date);

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
      <button class="event" data-act="edit" data-id="${esc(e.id)}" style="--cat:${cat.color}">
        <span class="event-time">${timeHtml(e, showDate)}</span>
        <span class="event-main">
          <span class="event-title">${esc(e.title)}</span>
          <span class="event-meta"><span class="cat">${cat.label}</span>${whoHtml(e)}</span>
          ${e.note ? `<span class="event-note">${esc(e.note)}</span>` : ''}
        </span>
      </button>`;
  }

  function viewUpcoming() {
    const t = today();
    const list = state.upcoming.slice().sort((a, b) =>
      (a.event_date < t ? t : a.event_date).localeCompare(b.event_date < t ? t : b.event_date));
    const exams = list.filter((e) => e.category === 'exam');

    const groups = {};
    list.forEach((e) => {
      const key = e.event_date < t ? t : e.event_date;
      (groups[key] = groups[key] || []).push(e);
    });

    const examStrip = exams.length ? `
      <section class="exams" aria-label="考試倒數">
        ${exams.slice(0, 4).map((e) => {
          const n = Math.max(0, daysBetween(t, e.event_date));
          return `
            <button class="exam" data-act="edit" data-id="${esc(e.id)}">
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

  // ---------- 新增／編輯表單 ----------
  function openSheet(ev) {
    const isNew = !ev;
    const e = ev || {
      title: '', category: 'schedule', event_date: state.tab === 'month' ? state.selected : today(),
      end_date: null, start_time: null, end_time: null, member_ids: [], note: ''
    };
    const allDay = !e.start_time;
    $sheet.innerHTML = `
      <div class="backdrop" data-act="close"></div>
      <form class="sheet" id="event-form" role="dialog" aria-modal="true" aria-label="${isNew ? '新增' : '編輯'}">
        <div class="sheet-head">
          <button type="button" class="link-btn" data-act="close">取消</button>
          <strong>${isNew ? '新增' : '編輯'}</strong>
          <button type="submit" class="link-btn strong">儲存</button>
        </div>
        <div class="sheet-body">
          <input type="hidden" name="event_id" value="${esc(e.id || '')}">
          <input class="title-input" name="title" placeholder="要做什麼？" value="${esc(e.title)}" maxlength="80" autocomplete="off" required>

          <fieldset class="seg">
            <legend>類型</legend>
            ${Object.keys(CATEGORIES).map((k) => `
              <label style="--cat:${CATEGORIES[k].color}">
                <input type="radio" name="category" value="${k}" ${e.category === k ? 'checked' : ''}>
                <span>${CATEGORIES[k].label}</span>
              </label>`).join('')}
          </fieldset>

          <div class="row two">
            <label>開始日期<input type="date" name="event_date" value="${esc(e.event_date)}" required></label>
            <label>結束日期<input type="date" name="end_date" value="${esc(e.end_date || e.event_date)}" required></label>
          </div>

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

          <label>備註<textarea name="note" rows="3" maxlength="500" placeholder="範圍、地點、要帶的東西…">${esc(e.note || '')}</textarea></label>

          <p class="form-error" id="form-error" role="alert" hidden></p>
          ${isNew ? '' : '<button type="button" class="btn danger" data-act="delete">刪除</button>'}
        </div>
      </form>`;
    document.body.classList.add('sheet-open');
    if (isNew) setTimeout(() => { const i = $sheet.querySelector('.title-input'); if (i) i.focus(); }, 60);
  }

  function closeSheet() {
    $sheet.innerHTML = '';
    document.body.classList.remove('sheet-open');
  }

  async function onSave(form) {
    const err = form.querySelector('#form-error');
    const fail = (msg) => { err.textContent = msg; err.hidden = false; };
    const f = form.elements;
    const allDay = f.all_day.checked;
    const ev = {
      id: f.event_id.value || null,
      title: f.title.value.trim(),
      category: f.category.value,
      event_date: f.event_date.value,
      end_date: f.end_date.value || f.event_date.value,
      start_time: allDay ? null : (f.start_time.value || null),
      end_time: allDay ? null : (f.end_time.value || null),
      member_ids: Array.from(form.querySelectorAll('input[name=member]:checked')).map((i) => i.value),
      note: f.note.value.trim()
    };
    if (!ev.title) return fail('請輸入標題');
    if (!ev.event_date) return fail('請選擇日期');
    if (ev.end_date < ev.event_date) return fail('結束日期不能早於開始日期');
    if (!allDay && !ev.start_time) return fail('請選擇開始時間，或打開「全天」');
    if (ev.start_time && ev.end_time && ev.end_date === ev.event_date && ev.end_time < ev.start_time) return fail('結束時間不能早於開始時間');
    if (!ev.start_time) ev.end_time = null;

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await Api.saveEvent(ev);
      closeSheet();
      state.selected = ev.event_date;
      state.cursor = ev.event_date.slice(0, 7);
      toast('已儲存');
      await loadData();
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      fail('儲存失敗，請確認網路後再試一次');
    }
  }

  async function onDelete(id, btn) {
    // 第一次按只是確認，第二次才真的刪除
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = '再按一次確定刪除';
      return;
    }
    btn.disabled = true;
    try {
      await Api.deleteEvent(id);
      closeSheet();
      toast('已刪除');
      await loadData();
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      toast('刪除失敗，請再試一次');
    }
  }

  // ---------- 事件處理 ----------
  function shiftMonth(n) {
    const d = parse(state.cursor + '-01');
    d.setMonth(d.getMonth() + n);
    state.cursor = ymd(d).slice(0, 7);
    state.selected = state.cursor === today().slice(0, 7) ? today() : state.cursor + '-01';
    render();
    loadData();
  }

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'tab') { state.tab = el.dataset.tab; render(); window.scrollTo(0, 0); }
    else if (act === 'prev') shiftMonth(-1);
    else if (act === 'next') shiftMonth(1);
    else if (act === 'today') { state.cursor = today().slice(0, 7); state.selected = today(); render(); loadData(); }
    else if (act === 'pick') {
      state.selected = el.dataset.date;
      if (state.selected.slice(0, 7) !== state.cursor) { state.cursor = state.selected.slice(0, 7); render(); loadData(); }
      else render();
    }
    else if (act === 'new') openSheet(null);
    else if (act === 'edit') {
      const e = state.monthEvents.concat(state.upcoming).find((x) => String(x.id) === el.dataset.id);
      if (e) openSheet(e);
    }
    else if (act === 'close') closeSheet();
    else if (act === 'delete') onDelete(document.querySelector('#event-form').elements.event_id.value, el);
    else if (act === 'logout') {
      stopWatching();
      Api.signOut().then(() => { state.userId = null; state.tab = 'month'; renderLogin(); });
    }
  });

  document.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (ev.target.id === 'login-form') onLogin(ev.target);
    if (ev.target.id === 'event-form') onSave(ev.target);
  });

  document.addEventListener('change', (ev) => {
    const form = ev.target.form;
    if (!form || form.id !== 'event-form') return;
    if (ev.target.name === 'all_day') form.querySelector('#time-row').hidden = ev.target.checked;
    const f = form.elements;
    if (ev.target.name === 'event_date' && f.end_date.value < f.event_date.value) f.end_date.value = f.event_date.value;
  });

  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $sheet.innerHTML) closeSheet(); });

  // App 從背景回來時重新讀取（家人修改時的即時更新在 enter() 裡啟動）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.userId && !$sheet.innerHTML) loadData();
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  boot();
})();
