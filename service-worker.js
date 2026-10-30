'use strict';
// Update the release identifier whenever any shell asset changes.
const VERSION='paceriq-v2-20261030-1';
const SCOPE=self.registration.scope;
const CACHE=VERSION+'-'+new URL(SCOPE).pathname;
const PREFIX='paceriq-v2-';
const SHELL=['./','./index.html','./assets/css/app.css','./assets/js/engine.js','./assets/js/storage.js','./assets/js/evidence.js','./assets/js/app.js','./manifest.webmanifest','./assets/icons/favicon.svg','./assets/icons/apple-touch-icon.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png'];
const urls=SHELL.map(path=>new URL(path,SCOPE).href);
self.addEventListener('install',event=>{
  // All-or-nothing install: an incomplete release must never become the offline shell.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})))).catch(async error=>{await caches.delete(CACHE);throw error;}));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key.endsWith('-'+new URL(SCOPE).pathname)&&key!==CACHE).map(key=>caches.delete(key)))));
  // Do not claim existing tabs; each open tab keeps its coherent cached release.
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.href.startsWith(SCOPE))return;
  if(event.request.mode==='navigate'){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(new URL('index.html',SCOPE).href))||fetch(event.request)));
  }else if(urls.includes(url.href)){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
  }
});
