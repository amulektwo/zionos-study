/* ZIONOS service worker — the shell and the index live offline; scroll
   bodies stay behind the gate (a bounded LRU lives in localStorage). */
const SHELL = 'zionos-shell-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg',
  './data/index.json', './data/search-index.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;           /* the gate is never cached here */
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        if (res.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || ASSETS.some(a => url.pathname.endsWith(a.slice(1))))) {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
