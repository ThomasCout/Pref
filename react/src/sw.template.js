/* Service worker de L'apPréfet : fait fonctionner l'app hors ligne et la garde à jour.
   - Coquille de l'app (page, scripts, styles, manifeste, icônes) : mise en cache à l'installation.
   - index.html et manifeste : réseau d'abord (on reçoit les mises à jour), cache en secours si hors ligne ou trop lent.
   - Fichiers de l'app (noms hachés) : cache d'abord, ils ne changent jamais sous un même nom.
   - Polices : servies depuis le cache, rafraîchies en arrière-plan.
   - Tout le reste (Supabase, tuiles de carte, API publiques) passe directement par le réseau. */
const CACHE = 'apprefet-__VERSION__';
const SHELL = __SHELL__;
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(SHELL);
  await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), NETWORK_TIMEOUT))]);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    return (await c.match(req, { ignoreSearch: true })) || (await c.match('index.html')) || Response.error();
  }
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE), hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req); if (r && r.ok) c.put(req, r.clone()); return r;
}
async function staleWhileRevalidate(e) {
  const c = await caches.open(CACHE), hit = await c.match(e.request);
  const net = fetch(e.request).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(e.request, r.clone()); return r; }).catch(() => null);
  e.waitUntil(net);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const page = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname) || url.pathname.endsWith('/manifest.json');
    e.respondWith(page ? networkFirst(req) : cacheFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(e));
  }
});
