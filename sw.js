// 讓 App 在沒有網路時也能打開畫面。
// 策略：優先走網路（確保拿到最新版程式），失敗才用快取。
// 只處理本站的檔案，Firebase 的資料請求完全不經過這裡。
const CACHE = 'family-shell-v2';
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
