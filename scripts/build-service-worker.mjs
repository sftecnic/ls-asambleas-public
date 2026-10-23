import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const files = [];
const output = process.argv[2] || 'dist';
async function walk(path, prefix = '') { for (const file of await readdir(path, { withFileTypes: true })) { const url = `${prefix}/${file.name}`; if (file.isDirectory()) await walk(join(path, file.name), url); else if (file.name !== 'sw.js') files.push(url); } }
await walk(output);
const cache = `ls-asambleas-${Date.now()}`;
await writeFile(join(output, 'sw.js'), `
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('ls-asambleas-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html', {ignoreVary: true}))));
    return;
  }
  // Only public build assets: request Origin/Vary can differ between precache and module requests.
  // No authentication, API, document or user-data response is cached here.
  if (FILES.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname, {ignoreVary: true})).then(cached => cached || fetch(event.request)));
  }
});
`);
