// 國定假日與補假（放假日）對照表。月曆上這些日子的日期會顯示成紅字，點到那天會顯示假日名稱。
//
// 資料來源：行政院人事行政總處公布的「政府行政機關辦公日曆表」
//   115 年（2026）與 116 年（2027）。2025 年下半年起已取消補班，所以沒有「補行上班日」。
//
// 下面這張表是內建的備用資料。App 另外會自動上網抓最新的日曆表（見檔案最下面），
// 所以以後的年份不用手動更新；抓不到的時候才只靠這張表。
window.TW_HOLIDAYS = {
  // ---------- 2026（民國 115 年） ----------
  '2026-01-01': '開國紀念日',
  '2026-02-15': '小年夜',
  '2026-02-16': '除夕',
  '2026-02-17': '春節',
  '2026-02-18': '春節',
  '2026-02-19': '春節',
  '2026-02-20': '春節補假',
  '2026-02-27': '和平紀念日補假',
  '2026-02-28': '和平紀念日',
  '2026-04-03': '兒童節補假',
  '2026-04-04': '兒童節',
  '2026-04-05': '清明節',
  '2026-04-06': '清明節補假',
  '2026-05-01': '勞動節',
  '2026-06-19': '端午節',
  '2026-09-25': '中秋節',
  '2026-09-28': '教師節',
  '2026-10-09': '國慶日補假',
  '2026-10-10': '國慶日',
  '2026-10-25': '臺灣光復節',
  '2026-10-26': '臺灣光復節補假',
  '2026-12-25': '行憲紀念日',

  // ---------- 2027（民國 116 年） ----------
  '2027-01-01': '開國紀念日',
  '2027-02-04': '小年夜',
  '2027-02-05': '除夕',
  '2027-02-06': '春節',
  '2027-02-07': '春節',
  '2027-02-08': '春節',
  '2027-02-09': '春節補假',
  '2027-02-10': '春節補假',
  '2027-02-28': '和平紀念日',
  '2027-03-01': '和平紀念日補假',
  '2027-04-04': '兒童節',
  '2027-04-05': '清明節',
  '2027-04-06': '兒童節補假',
  '2027-04-30': '勞動節補假',
  '2027-05-01': '勞動節',
  '2027-06-09': '端午節',
  '2027-09-15': '中秋節',
  '2027-09-28': '教師節',
  '2027-10-10': '國慶日',
  '2027-10-11': '國慶日補假',
  '2027-10-25': '臺灣光復節',
  '2027-12-24': '行憲紀念日補假',
  '2027-12-25': '行憲紀念日',
  '2027-12-31': '開國紀念日補假'
};

// ---------- 自動更新 ----------
// 來源：GitHub 上的 ruyut/TaiwanCalendar，它把人事行政總處的辦公日曆表整理成每年一個 JSON 檔
// （每天一筆：date、week、isHoliday、description），透過 jsDelivr 提供。
// 做法：每次打開 App，檢查「今年」和「明年」；看月曆翻到其他年份時也會檢查那一年。
//   抓到 → 存在手機上，七天內不再重抓；還沒公布（抓不到）→ 隔天再試。
//   抓到的資料如果格式不對、天數不對，一律不採用，繼續用原本的。
// 補班日（星期六、日但要上班）也會記下來：window.TW_WORKDAYS，月曆上那天不會是紅字。
window.TW_WORKDAYS = {};
(function () {
  const SOURCE = 'https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/';
  const KEY = 'family-holidays-v1';
  const DAY = 86400000;
  const builtin = Object.assign({}, window.TW_HOLIDAYS);

  let store = {};      // { 年份: { at: 抓取時間, ok: 有沒有抓到, holidays: {日期: 名稱}, workdays: {日期: 說明} } }
  try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { store = {}; }

  // 把某一年抓到的資料套用上去：以抓到的為準，名稱優先用內建的（內建寫得比較完整，例如「春節補假」）
  function apply(year) {
    const y = store[year];
    if (!y || !y.ok) return;
    Object.keys(window.TW_HOLIDAYS).forEach((d) => { if (d.startsWith(year + '-')) delete window.TW_HOLIDAYS[d]; });
    Object.keys(window.TW_WORKDAYS).forEach((d) => { if (d.startsWith(year + '-')) delete window.TW_WORKDAYS[d]; });
    Object.keys(y.holidays).forEach((d) => { window.TW_HOLIDAYS[d] = builtin[d] || y.holidays[d]; });
    Object.keys(y.workdays).forEach((d) => { window.TW_WORKDAYS[d] = y.workdays[d]; });
  }
  Object.keys(store).forEach(apply);

  function parse(year, rows) {
    if (!Array.isArray(rows) || rows.length < 365 || rows.length > 366) return null;
    const holidays = {}, workdays = {};
    for (const r of rows) {
      if (!r || typeof r.date !== 'string' || !/^\d{8}$/.test(r.date) || r.date.slice(0, 4) !== String(year)) return null;
      const date = r.date.slice(0, 4) + '-' + r.date.slice(4, 6) + '-' + r.date.slice(6, 8);
      const weekend = r.week === '六' || r.week === '日';
      const name = String(r.description || '').slice(0, 30);
      if (r.isHoliday === true && (!weekend || name)) holidays[date] = name || '放假';
      if (r.isHoliday === false && weekend) workdays[date] = name || '補行上班';
    }
    return { holidays, workdays };
  }

  async function check(year) {
    const have = store[year];
    if (have && Date.now() - have.at < (have.ok ? 7 * DAY : DAY)) return false;
    let parsed = null;
    try {
      const res = await fetch(SOURCE + year + '.json', { cache: 'no-cache' });
      if (res.ok) parsed = parse(year, await res.json());
    } catch (e) { return false; }                       // 沒有網路：下次再試，不記錄
    const before = JSON.stringify(have && have.ok ? [have.holidays, have.workdays] : null);
    if (parsed) store[year] = { at: Date.now(), ok: true, holidays: parsed.holidays, workdays: parsed.workdays };
    else store[year] = Object.assign({ ok: false, holidays: {}, workdays: {} }, have || {}, { at: Date.now() });
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 忽略 */ }
    if (!parsed) return false;
    apply(year);
    return before !== JSON.stringify([parsed.holidays, parsed.workdays]);
  }

  // 檢查這些年份；有任何一年的資料變了就回傳 true（畫面需要重畫）
  window.refreshHolidays = async function (years) {
    const results = await Promise.all(years.map((y) => check(Number(y)).catch(() => false)));
    return results.some(Boolean);
  };
})();
