// 鍾家大宅：推播通知（在 Firebase 的伺服器上執行，不是在手機上）
//
// 資料庫一有新資料，這裡就會被叫起來，把通知送到相關成員的手機：
//   messages 新增 → 通知傳送者以外的所有成員
//   posts    新增 → 通知被標註的人
//   replies  新增 → 通知那則發言的作者
//   requests 新增 → 小朋友申請費用時，通知家長
//   polls    新增 → 通知發起人以外的所有成員
//
// 部署：在專案資料夾執行 firebase deploy --only functions

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
// 家用流量很小，限制同時執行的數量，避免程式出錯時產生意外費用
setGlobalOptions({ maxInstances: 3 });

const db = getFirestore();
const APP_URL = 'https://tzwen1225.github.io/family-app/';
const clip = (text) => (String(text || '').length > 120 ? String(text).slice(0, 120) + '…' : String(text || ''));

async function memberNames() {
  const snap = await db.collection('members').get();
  const names = {};
  snap.forEach((d) => { names[d.id] = d.data().display_name || '家人'; });
  return names;
}

// 把通知送到這些成員登記過的所有手機
async function notify(uids, title, body, tag) {
  const targets = [...new Set(uids)].filter(Boolean);
  if (!targets.length) return;
  const snap = await db.collection('push_tokens').where('uid', 'in', targets).get();
  if (snap.empty) return;

  const result = await getMessaging().sendEachForMulticast({
    tokens: snap.docs.map((d) => d.id),
    notification: { title, body },
    // 手機點通知後要開哪一頁，由 sw.js 依 tag 決定（chat → 聊天，post-… → 我有話要說）
    data: { title, body, tag, url: APP_URL },
    webpush: {
      headers: { Urgency: 'high', TTL: '86400' },
      notification: { icon: APP_URL + 'icons/icon-192.png', tag },
      fcmOptions: { link: APP_URL }
    }
  });

  // 已經失效的裝置代碼（例如 App 被刪除）順手清掉
  const dead = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
  await Promise.all(result.responses.map((r, i) => {
    if (r.success) return null;
    logger.warn('通知沒有送達', r.error && r.error.code);
    return r.error && dead.includes(r.error.code) ? snap.docs[i].ref.delete() : null;
  }));
  logger.info(`通知「${title}」：成功 ${result.successCount}，失敗 ${result.failureCount}`);
}

exports.onChatMessage = onDocumentCreated('messages/{id}', async (event) => {
  const m = event.data.data();
  const names = await memberNames();
  const others = Object.keys(names).filter((uid) => uid !== m.sender);
  await notify(others, names[m.sender] || '家人', m.image_id ? '傳了一張照片' : clip(m.text), 'chat');
});

exports.onPost = onDocumentCreated('posts/{id}', async (event) => {
  const p = event.data.data();
  const names = await memberNames();
  const to = (p.to || []).filter((uid) => uid !== p.author);
  await notify(to, (names[p.author] || '家人') + '有話要對你說', clip(p.text), 'post-' + event.params.id);
});

exports.onReply = onDocumentCreated('replies/{id}', async (event) => {
  const r = event.data.data();
  const post = await db.collection('posts').doc(r.post_id).get();
  if (!post.exists || post.data().author === r.author) return;
  const names = await memberNames();
  await notify([post.data().author], (names[r.author] || '家人') + '回覆了你', clip(r.text), 'post-' + r.post_id);
});

exports.onRequest = onDocumentCreated('requests/{id}', async (event) => {
  const r = event.data.data();
  const snap = await db.collection('members').get();
  const names = {};
  const parents = [];
  snap.forEach((d) => {
    names[d.id] = d.data().display_name || '家人';
    if (d.data().child !== true && d.id !== r.created_by) parents.push(d.id);
  });
  const [, m, day] = String(r.need_date || '').split('-').map(Number);
  await notify(parents, (names[r.kid] || '小朋友') + '需要一筆費用',
    clip(`${r.title}　$${r.amount}${m ? `（${m}/${day} 要用）` : ''}`), 'request-' + event.params.id);
});

exports.onPoll = onDocumentCreated('polls/{id}', async (event) => {
  const p = event.data.data();
  const names = await memberNames();
  const others = Object.keys(names).filter((uid) => uid !== p.author);
  await notify(others, (names[p.author] || '家人') + '發起了投票', clip(p.question), 'poll-' + event.params.id);
});

// ---------- 交通查詢：新竹的公車與台鐵即時資訊 ----------
// 資料來自交通部 TDX 平臺（https://tdx.transportdata.tw）。
// TDX 的金鑰放在資料庫的 secrets/tdx 文件（管理員在 App 的「設定」裡填），
// 手機讀不到那份文件，只有這支在伺服器上的程式讀得到；手機只會拿到查詢結果。
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const TDX = 'https://tdx.transportdata.tw/api/basic';
const TDX_TOKEN_URL = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
const BUS_AREAS = { Hsinchu: '新竹市', HsinchuCounty: '新竹縣', InterCity: '客運' };
let tdxToken = { value: '', until: 0, pending: null };
const tdxCache = new Map();      // 同一個查詢 20 秒內不重複向 TDX 要（即時資料本來就約一分鐘更新一次）

// 存取權杖一天內有效：沒過期就一直用同一個，快過期才重新讀金鑰去換新的
function tdxAccessToken() {
  if (tdxToken.value && Date.now() < tdxToken.until) return Promise.resolve(tdxToken.value);
  if (!tdxToken.pending) {
    tdxToken.pending = (async () => {
      const doc = await db.doc('secrets/tdx').get();
      const id = doc.exists ? String(doc.data().client_id || '').trim() : '';
      const secret = doc.exists ? String(doc.data().client_secret || '').trim() : '';
      if (!id || !secret) throw new HttpsError('failed-precondition', 'no-key');
      const res = await fetch(TDX_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret })
      });
      if (!res.ok) {
        logger.warn('TDX 金鑰驗證失敗', res.status);
        throw new HttpsError('failed-precondition', 'bad-key');
      }
      const json = await res.json();
      tdxToken.value = json.access_token;
      tdxToken.until = Date.now() + (Number(json.expires_in || 3600) - 300) * 1000;
      return tdxToken.value;
    })().finally(() => { tdxToken.pending = null; });
  }
  return tdxToken.pending;
}

async function tdxGet(path, params, ttl) {
  const qs = new URLSearchParams({ ...(params || {}), $format: 'JSON' }).toString().replace(/\+/g, '%20');
  const url = TDX + path + '?' + qs;
  const hit = tdxCache.get(url);
  if (hit && Date.now() < hit.until) return hit.data;
  const res = await fetch(url, { headers: { authorization: 'Bearer ' + await tdxAccessToken() } });
  if (res.status === 429) throw new HttpsError('resource-exhausted', 'busy');
  if (!res.ok) {
    logger.warn('TDX 查詢失敗', res.status, path);
    if (res.status === 401) tdxToken.until = 0;        // 權杖失效：下次重新換
    throw new HttpsError('unavailable', 'tdx-' + res.status);
  }
  const data = await res.json();
  if (tdxCache.size > 200) tdxCache.clear();
  tdxCache.set(url, { data, until: Date.now() + (ttl || 20000) });
  return data;
}

const zh = (name) => (name && (name.Zh_tw || name.zh_tw)) || '';
// 只留中文、英數和少數符號，避免查詢字串被塞進別的條件
const cleanWord = (s, max) => String(s || '').replace(/[^0-9A-Za-z一-鿿()（）\-]/g, '').slice(0, max || 20);
const busPath = (kind, area, route) => (area === 'InterCity'
  ? `/v2/Bus/${kind}/InterCity` + (route ? '/' + encodeURIComponent(route) : '')
  : `/v2/Bus/${kind}/City/${area}` + (route ? '/' + encodeURIComponent(route) : ''));
const sameRoute = (route) => ({ $filter: `RouteName/Zh_tw eq '${route}'` });

// 把 TDX 的到站資料整理成 App 要顯示的樣子
function etaInfo(e) {
  if (!e) return { status: 'none' };
  const sec = typeof e.EstimateTime === 'number' ? e.EstimateTime : null;
  const st = Number(e.StopStatus || 0);
  const next = e.NextBusTime ? String(e.NextBusTime).slice(11, 16) : '';
  if (sec !== null && st === 0) return { status: 'coming', seconds: sec, plate: e.PlateNumb && e.PlateNumb !== '-1' ? e.PlateNumb : '' };
  return { status: ['coming', 'not-yet', 'skip', 'last-gone', 'no-service'][st] || 'none', next };
}
function pickEta(etas, dir, stop) {
  const list = etas.filter((e) => Number(e.Direction) === Number(dir)
    && (e.StopUID === stop.uid || zh(e.StopName) === stop.name));
  list.sort((a, b) => (typeof a.EstimateTime === 'number' ? a.EstimateTime : 1e9) - (typeof b.EstimateTime === 'number' ? b.EstimateTime : 1e9));
  return etaInfo(list[0]);
}

const transitOps = {
  // 用路線名稱（號碼）搜尋：新竹市、新竹縣、公路客運一起找
  async searchRoutes({ q }) {
    const word = cleanWord(q, 12);
    if (!word) return { routes: [] };
    const params = { $filter: `contains(RouteName/Zh_tw,'${word}')`, $top: '30', $select: 'RouteUID,RouteName,DepartureStopNameZh,DestinationStopNameZh' };
    const lists = await Promise.all(Object.keys(BUS_AREAS).map((area) => tdxGet(busPath('Route', area), params, 3600000)
      .then((rows) => rows.map((r) => ({ area, areaName: BUS_AREAS[area], name: zh(r.RouteName), from: r.DepartureStopNameZh || '', to: r.DestinationStopNameZh || '' })))
      .catch((e) => { if (e.code === 'failed-precondition') throw e; return []; })));
    const routes = [].concat(...lists).filter((r) => r.name);
    routes.sort((a, b) => (a.name === word ? -1 : 0) - (b.name === word ? -1 : 0) || a.name.length - b.name.length || a.name.localeCompare(b.name));
    return { routes: routes.slice(0, 40) };
  },

  // 一條路線：兩個方向的每一站，加上現在幾分鐘後到
  async route({ area, name }) {
    if (!BUS_AREAS[area]) throw new HttpsError('invalid-argument', 'area');
    const route = cleanWord(name, 30);
    const [stops, etas] = await Promise.all([
      tdxGet(busPath('StopOfRoute', area, route), sameRoute(route), 3600000),
      tdxGet(busPath('EstimatedTimeOfArrival', area, route), sameRoute(route))
    ]);
    const dirs = [];
    [0, 1].forEach((dir) => {
      // 同方向可能有好幾條支線，取站數最多的那一條
      const best = stops.filter((s) => Number(s.Direction) === dir).sort((a, b) => (b.Stops || []).length - (a.Stops || []).length)[0];
      if (!best || !(best.Stops || []).length) return;
      const list = best.Stops.slice().sort((a, b) => a.StopSequence - b.StopSequence)
        .map((s) => ({ uid: s.StopUID, name: zh(s.StopName) }));
      dirs.push({ dir, to: list[list.length - 1].name, stops: list.map((s) => ({ ...s, eta: pickEta(etas, dir, s) })) });
    });
    return { area, areaName: BUS_AREAS[area], name: route, dirs };
  },

  // 常用站牌：一次查好幾個（同一條路線只向 TDX 問一次）
  async etas({ items }) {
    // 回傳的順序和筆數要和傳進來的一樣（手機用位置對應），格式不對的那筆回 error
    const list = (Array.isArray(items) ? items : []).slice(0, 20)
      .map((x) => (x && BUS_AREAS[x.area]
        ? { area: x.area, route: cleanWord(x.route, 30), dir: Number(x.dir) ? 1 : 0, uid: String(x.uid || '').slice(0, 40), name: String(x.name || '').slice(0, 40) }
        : null));
    const groups = {};
    list.filter(Boolean).forEach((x) => { groups[x.area + '|' + x.route] = groups[x.area + '|' + x.route] || tdxGet(busPath('EstimatedTimeOfArrival', x.area, x.route), sameRoute(x.route)).catch((e) => { if (e.code === 'failed-precondition') throw e; return null; }); });
    const out = [];
    for (const x of list) {
      if (!x) { out.push({ status: 'error' }); continue; }
      const etas = await groups[x.area + '|' + x.route];
      out.push(etas ? pickEta(etas, x.dir, { uid: x.uid, name: x.name }) : { status: 'error' });
    }
    return { etas: out };
  },

  // 台鐵車站清單（用站名找車站代碼）
  async traStations() {
    const data = await tdxGet('/v3/Rail/TRA/Station', { $select: 'StationID,StationName' }, 86400000);
    const rows = Array.isArray(data) ? data : data.Stations || [];
    return { stations: rows.map((s) => ({ id: s.StationID, name: zh(s.StationName) })).filter((s) => s.id && s.name) };
  },

  // 台鐵某一站的即時看板：接下來進站的列車和誤點幾分
  async tra({ station }) {
    const id = String(station || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 8);
    if (!id) throw new HttpsError('invalid-argument', 'station');
    const data = await tdxGet('/v3/Rail/TRA/StationLiveBoard/Station/' + id, {}, 30000);
    const rows = Array.isArray(data) ? data : data.StationLiveBoards || [];
    const trains = rows.map((t) => ({
      no: t.TrainNo || '', type: zh(t.TrainTypeName).replace(/\(.*$/, ''), to: zh(t.EndingStationName),
      dir: Number(t.Direction) ? 1 : 0,
      time: String(t.ScheduleDepartureTime || t.ScheduleArrivalTime || '').slice(0, 5),
      delay: Number(t.DelayTime || 0)
    })).filter((t) => t.no && t.time);
    trains.sort((a, b) => a.time.localeCompare(b.time));
    return { trains, updated: data.UpdateTime || '' };
  }
};

exports.transit = onCall({ region: 'asia-east1', maxInstances: 3, timeoutSeconds: 20, memory: '256MiB' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'login');
  const member = await db.doc('members/' + req.auth.uid).get();        // 只有家人能用
  if (!member.exists) throw new HttpsError('permission-denied', 'not-family');
  const data = req.data || {};
  const op = transitOps[data.op];
  if (!op) throw new HttpsError('invalid-argument', 'op');
  try { return await op(data); }
  catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.error('交通查詢失敗', data.op, e);
    throw new HttpsError('unavailable', 'failed');
  }
});
