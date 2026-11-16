// 讓 App 在沒有網路時也能打開畫面。
// 策略：優先走網路（確保拿到最新版程式），失敗才用快取。
// 只處理本站的檔案，Firebase 的資料請求完全不經過這裡。
const CACHE = 'family-shell-v8';
const SHELL = [
  './', 'index.html', 'css/app.css',
  'js/config.js', 'js/api.js', 'js/app.js', 'vendor/firebase.js',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
  );
});

// ---------- 推播通知 ----------
// 伺服器（functions/index.js）送來的通知會在這裡收到，即使 App 沒有開著。
// 每一則都一定要顯示出來：iPhone 對「收到卻不顯示」的推播會取消訂閱。
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
    data: { url: d.url || self.registration.scope }
  }));
});

// 點通知：App 已經開著就切過去，否則開啟 App
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
