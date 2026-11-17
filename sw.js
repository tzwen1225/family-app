// 讓 App 一點開就有畫面，沒有網路時也能打開。
// 策略：程式檔先用手機上存的那一份（馬上顯示），同時在背景向伺服器拿新的，存起來給下次用。
// 有新版本時，App 會比對 version.txt，通知這裡把檔案全部換新，再重新載入。
// 只處理本站的檔案，Firebase 的資料請求完全不經過這裡。
const CACHE = 'family-shell-v64';
const SHELL = [
  './', 'index.html', 'css/app.css',
  'js/config.js', 'js/holidays.js', 'js/api.js', 'js/app.js', 'vendor/firebase.js',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png'
];

// cache: 'no-cache' = 一定向伺服器確認有沒有更新（GitHub Pages 的檔案否則會被瀏覽器留用約十分鐘）
const fresh = (url) => fetch(url, { cache: 'no-cache', credentials: 'same-origin' });
const refill = () => caches.open(CACHE).then((c) =>
  Promise.all(SHELL.map((u) => fresh(u).then((res) => { if (!res.ok) throw new Error(u); return c.put(u, res); }))));

self.addEventListener('install', (e) => {
  e.waitUntil(refill().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // version.txt 永遠直接問伺服器，不放進快取
  if (url.pathname.endsWith('/version.txt')) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const update = fresh(req.url).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
    if (hit) { e.waitUntil(update.catch(() => {})); return hit; }      // 有存：馬上給，背景更新
    return update.catch(() => cache.match('index.html'));               // 沒存過：等網路
  }));
});

// App 發現有新版本時會叫這裡把所有程式檔換新，換好後回報
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'refresh') return;
  const reply = (msg) => { if (e.ports && e.ports[0]) e.ports[0].postMessage(msg); };
  e.waitUntil(refill().then(() => reply('done'), () => reply('failed')));
});

// ---------- 推播通知 ----------
// 伺服器（functions/index.js）送來的通知會在這裡收到，即使 App 沒有開著。
// 每一則都一定要顯示出來：iPhone 對「收到卻不顯示」的推播會取消訂閱。
// 通知要帶使用者去哪一頁：聊天訊息 → 聊天；「我有話要說」→ 我有話要說；費用申請 → 零用錢
const tabFor = (tag) => {
  const t = String(tag || '');
  return t.startsWith('poll') ? 'polls' : t.startsWith('post') ? 'posts' : t.startsWith('request') ? 'ledger' : t.startsWith('todo') ? 'todos' : 'chat';
};

self.addEventListener('push', (e) => {
  let payload = {};
  try { payload = e.data ? e.data.json() : {}; } catch (err) { /* 不是 JSON 就用預設文字 */ }
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || '鍾家大宅';
  e.waitUntil(self.registration.showNotification(title, {
    body: n.body || d.body || '有新的訊息',
    icon: 'icons/icon-192.png',
    tag: d.tag || undefined,
    data: { tab: tabFor(d.tag) }
  }));
});

// 點通知：App 已經開著就切過去並跳到對應的分頁；沒開就直接開在那個分頁
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const tab = (e.notification.data && e.notification.data.tab) || 'chat';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (!open) return self.clients.openWindow(self.registration.scope + '#' + tab);
      open.postMessage({ type: 'open-tab', tab });
      return open.focus();
    })
  );
});
