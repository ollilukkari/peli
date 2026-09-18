/** Register offline support without ever interrupting a round for an update. */
export function setupPwa({ onUpdateReady, onOfflineReady, onStatus } = {}) {
  let registration;
  let updateRequested = false;
  let updateAnnounced = false;
  let offlineAnnounced = false;
  let lastCheck = 0;
  const report = (kind, message) => onStatus?.({ kind, message });

  const controller = {
    async applyUpdate() {
      if (!registration?.waiting) return false;
      updateRequested = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    },
  };
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    report('unsupported', 'Offline-pelaaminen edellyttää tuettua selainta ja HTTPS-yhteyttä.');
    return controller;
  }

  const announceUpdate = () => {
    if (!registration?.waiting || !navigator.serviceWorker.controller || updateAnnounced) return;
    updateAnnounced = true;
    report('update-ready', 'Uusi peliversio on valmis. Päivitä kierrosten välissä.');
    onUpdateReady?.();
  };

  const verifyOffline = async () => {
    const worker = registration?.active;
    if (!worker || offlineAnnounced) return;
    const result = await new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        resolve(null);
      }, 5000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(event.data);
      };
      worker.postMessage({ type: 'GET_OFFLINE_STATUS' }, [channel.port2]);
    });
    if (result?.ready) {
      offlineAnnounced = true;
      report('offline-ready', 'Peli on valmis myös offline-pelaamiseen.');
      onOfflineReady?.();
    } else {
      report('error', 'Offline-tallennusta ei voitu varmistaa.');
    }
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) {
      window.location.reload();
      return;
    }
    // First install or an update accepted in another tab must not reload a round.
    void verifyOffline();
  });

  const checkForUpdate = async () => {
    if (!registration || !navigator.onLine || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    try {
      await registration.update();
      announceUpdate();
    } catch {
      report('update-check-failed', 'Päivityksen tarkistus ei onnistunut. Nykyinen peli jatkuu.');
    }
  };

  report('installing', 'Valmistellaan offline-pelaamista…');
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), {
    scope: new URL('../', import.meta.url).href,
    updateViaCache: 'none',
  }).then(async (result) => {
    registration = result;
    announceUpdate();
    const observe = (worker) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') announceUpdate();
        if (worker.state === 'activated') void verifyOffline();
        if (worker.state === 'redundant' && !registration.active) {
          report('error', 'Offline-tallennus epäonnistui. Tarkista verkkoyhteys ja avaa peli uudelleen.');
        }
      });
    };
    observe(registration.installing);
    registration.addEventListener('updatefound', () => observe(registration.installing));
    if (registration.active) await verifyOffline();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    });
    window.addEventListener('online', () => void checkForUpdate());
    window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    }, 15 * 60_000);
  }).catch(() => {
    report('error', 'Offline-tallennus ei onnistunut. Peli tarvitsee nyt verkkoyhteyden.');
  });
  return controller;
}
