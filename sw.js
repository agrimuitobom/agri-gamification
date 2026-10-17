// オフライン対応：ネットにつながるときは最新版、つながらないときはキャッシュで動く
const CACHE = 'agri-kingdom-v2';
const FILES = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './js/data/questions.js', './js/data/items.js', './js/core.js', './js/effects.js',
  './js/quiz.js', './js/farm.js', './js/screens.js', './js/main.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
