const CACHE='nutritrack-v11-0-1-cabecalho-contextual';
const ASSETS=['./','./index.html','./app.js','./foods-default.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('nutritrack-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;
 const isAppFile=r.mode==='navigate'||/\/(?:app\.js|index\.html)$/.test(new URL(r.url).pathname);
 if(isAppFile){e.respondWith(fetch(r).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return response}).catch(()=>caches.match(r).then(c=>c||caches.match('./index.html'))));return}
 e.respondWith(caches.match(r).then(c=>c||fetch(r)));
});
