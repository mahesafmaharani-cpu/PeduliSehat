const CACHE_NAME = 'pedulisehat-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Terima pesan dari halaman utama untuk set alarm
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SET_ALARMS') {
    // Simpan alarms di service worker memory
    self.alarms = e.data.alarms;
    startChecker();
  }
});

let checkerInterval = null;

function startChecker() {
  if (checkerInterval) clearInterval(checkerInterval);
  checkerInterval = setInterval(checkAlarms, 30000); // cek tiap 30 detik
  checkAlarms();
}

function checkAlarms() {
  if (!self.alarms || !self.alarms.length) return;

  const now = new Date();
  const nowStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const today = now.toDateString();

  self.alarms.forEach((r, i) => {
    if (r.alarmOn === false) return;
    if (r.done && r.type !== 'alarm') return;
    if (r.time !== nowStr) return;

    const key = r.time + '-' + i + '-' + today;
    if (!self.firedKeys) self.firedKeys = {};
    if (self.firedKeys[key]) return;
    self.firedKeys[key] = true;

    const emoji = r.type === 'obat' ? '💊' : r.type === 'makan' ? '🍽️' : '⏰';
    const titles = { obat: 'Waktunya Minum Obat!', makan: 'Waktunya Makan!', alarm: 'Alarm!' };
    const title = titles[r.type] || 'Pengingat!';

    self.registration.showNotification('PeduliSehat — ' + title, {
      body: emoji + ' ' + r.name + (r.dose ? '\n' + r.dose : ''),
      icon: '/PeduliSehat/icon.png',
      badge: '/PeduliSehat/icon.png',
      tag: 'alarm-' + i,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      actions: [
        { action: 'done', title: '✓ Selesai' },
        { action: 'snooze', title: '⏱ Tunda 5 mnt' }
      ]
    });

    // Kirim ke semua tab yang terbuka
    clients.matchAll({ type: 'window' }).then(cs => {
      cs.forEach(c => c.postMessage({ type: 'ALARM_TRIGGER', reminder: r, index: i }));
    });
  });
}

// Handle klik notifikasi
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'snooze') {
    // Tunda: kirim pesan ke halaman
    clients.matchAll({ type: 'window' }).then(cs => {
      cs.forEach(c => c.postMessage({ type: 'SNOOZE', tag: e.notification.tag }));
    });
  } else {
    // Buka app
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then(cs => {
        if (cs.length > 0) { cs[0].focus(); return; }
        clients.openWindow('/PeduliSehat/');
      })
    );
  }
});
