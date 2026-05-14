// Minimal service worker — exists solely so Chrome on Android shows
// "Install app" in the home-screen add menu. Doesn't cache anything;
// every request goes straight to the network. Bumping SONOS_V in
// index.html causes a fresh sw.js fetch on next reload.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch handler must exist for Chrome to consider the SW useful;
// pass-through to network keeps behavior identical to no-SW.
self.addEventListener('fetch', (event) => {
  // No-op: let the network handle it.
});
