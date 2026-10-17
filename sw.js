// オフライン対応：ネットにつながるときは最新版、つながらないときはキャッシュで動く
const CACHE = 'agri-kingdom-v3';
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const FILES = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './js/firebase-config.js', './js/data/questions.js', './js/data/items.js', './js/core.js', './js/effects.js',
  './js/quiz.js', './js/farm.js', './js/screens.js', './js/cloud.js', './js/main.js',
  FB + 'firebase-app-compat.js', FB + 'firebase-auth-compat.js', FB + 'firebase-firestore-compat.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  // 自サイトのファイルと Firebase SDK だけ扱う（Firestore 等の通信はそのまま）
  if (new URL(url).origin !== location.origin && !url.startsWith(FB)) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
