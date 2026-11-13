/* Service worker du carnet : fait fonctionner l'app hors ligne et la garde à jour.
   - Coquille de l'app (page, manifeste, icônes) : mise en cache à l'installation.
   - index.html : réseau d'abord (on reçoit les mises à jour), cache en secours si hors ligne ou trop lent.
   - Bibliothèques et polices (CDN) : servies depuis le cache, rafraîchies en arrière-plan.
   - Tout le reste (Supabase, tuiles de carte, API publiques) passe directement par le réseau, jamais mis en cache ici.
   Changer CACHE force le renouvellement du cache si la liste de la coquille évolue. */
const CACHE = 'pref-v1';
const SHELL = ['./', 'index.html', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
/* mêmes adresses que dans index.html : sinon la copie hors ligne ne servirait à rien */
const LIBS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.79.0/dist/umd/supabase.js'
];
const CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(SHELL);                                                                   /* indispensable */
  /* au mieux, et sans bloquer l'activation plus de 8 s si le réseau est lent */
  const libs = Promise.allSettled(LIBS.map(u => c.add(new Request(u, { mode:'no-cors' }))));
  await Promise.race([libs, new Promise(done => setTimeout(done, 8000))]);
  await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

async function networkFirst(req){
  const c = await caches.open(CACHE);
  try {
    const r = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), NETWORK_TIMEOUT))]);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    return (await c.match(req, { ignoreSearch:true })) || (await c.match('index.html')) || Response.error();
  }
}
async function staleWhileRevalidate(e){
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
    e.respondWith(page ? networkFirst(req) : staleWhileRevalidate(e));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(e));
  }
});
