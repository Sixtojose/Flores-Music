const CACHE = 'floresmusic-shell-v1'; // aumente (v2, v3...) a cada atualização
const SHELL = ['/', '/index.html'];
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      await c.addAll(SHELL);
      // Biblioteca do Supabase também fica guardada, para o app abrir sem internet
      try { await c.add(CDN); } catch (_) {}
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Script do Supabase: cache primeiro, depois rede
  if (e.request.url === CDN) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }))
    );
    return;
  }

  // Resto de outros domínios (API e arquivos do Supabase) passa direto
  if (url.origin !== location.origin) return;

  // Arquivos do próprio site: rede primeiro, cache se estiver offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});
