// 구구단 챌린지 — offline cache
// 네트워크 우선: 인터넷이 되면 항상 서버의 최신 파일을 쓰고, 안 되거나 느리면 저장해 둔 파일을 씁니다.
// 그래서 배포할 때 이 파일(캐시 버전)을 따로 고칠 필요가 없습니다.
const CACHE = 'gugudan';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const SLOW_MS = 3000; // 이보다 오래 걸리면 저장본을 먼저 보여 줌

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // 브라우저 HTTP 캐시도 건너뛰고 서버에 확인 (바뀐 게 없으면 304라서 가벼움)
  const net = fetch(req, { cache: 'no-cache' });

  // 받아 온 최신 파일은 오프라인용으로 저장
  e.waitUntil(net.then(res => {
    if (!res.ok) return;
    const copy = res.clone();
    return caches.open(CACHE).then(c => c.put(req, copy));
  }).catch(() => {}));

  const saved = () => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));

  e.respondWith(new Promise(resolve => {
    let done = false;
    const finish = res => { if (!done && res) { done = true; clearTimeout(timer); resolve(res); } };
    const timer = setTimeout(() => saved().then(finish), SLOW_MS);
    net.then(finish).catch(() => saved().then(hit => finish(hit || Response.error())));
  }));
});
