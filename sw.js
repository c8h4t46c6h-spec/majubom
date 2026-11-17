// 마주봄 서비스 워커 — 파일을 고쳐 다시 배포할 때마다 VERSION 숫자를 올리세요.
const VERSION = 'majubom-v1';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/js/data.js', '/js/app.js', '/manifest.json',
  '/assets/favicon.png',
  '/assets/images/login_logo.png',
  '/assets/images/icon-192.png', '/assets/images/icon-512.png', '/assets/images/icon-maskable-512.png',
  '/assets/images/home_mascot.png', '/assets/images/home_assessment_icon.png',
  '/assets/images/home_coffee_icon.png', '/assets/images/home_rest_mat.png',
  '/assets/images/seed_mascot.png', '/assets/images/flower_mascot.png',
  '/assets/images/disability_result_mascot.png', '/assets/images/lesson_3_part1_thumbnail.png',
  '/assets/images/record_mood_good.png', '/assets/images/record_mood_normal.png', '/assets/images/record_mood_hard.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 같은 사이트 파일: 인터넷이 되면 최신 파일을 받고, 안 되면 저장된 파일 사용
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
