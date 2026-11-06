// Hinweis zum Installieren als App (Home-Bildschirm). Erscheint nur im Browser, nicht in der installierten App.
(() => {
  const KEY = 'installHintUntil';
  const standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (standalone) return;
  try { if (Number(localStorage.getItem(KEY) || 0) > Date.now()) return; } catch (e) { /* ohne Speicher immer anzeigen */ }

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null;
  let box = null;

  const style = document.createElement('style');
  style.textContent = `
    #installHint { position: fixed; left: 12px; right: 12px; bottom: calc(88px + env(safe-area-inset-bottom)); z-index: 25; max-width: 520px; margin: 0 auto; padding: 14px 14px 12px; border-radius: 14px; background: #16213a; color: #fff; box-shadow: 0 6px 24px rgba(0,0,0,.35); font-size: .95rem; line-height: 1.4; }
    #installHint strong { display: block; margin-bottom: 4px; font-size: 1rem; }
    #installHint .ih-row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; }
    #installHint button { min-height: 40px; padding: 0 16px; border: 0; border-radius: 10px; font: inherit; font-weight: 600; cursor: pointer; background: rgba(255,255,255,.16); color: #fff; }
    #installHint button.ih-go { background: #4f7cff; }
  `;

  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now() + 14 * 24 * 3600 * 1000)); } catch (e) { /* egal */ }
    if (box) { box.remove(); box = null; }
  }

  function show(html, withInstall) {
    if (box) box.remove();
    if (!style.isConnected) document.head.appendChild(style);
    box = document.createElement('div');
    box.id = 'installHint';
    box.setAttribute('role', 'dialog');
    box.innerHTML = `${html}<div class="ih-row">${withInstall ? '<button class="ih-go" data-a="install">Installieren</button>' : ''}<button data-a="close">${withInstall ? 'Später' : 'Verstanden'}</button></div>`;
    box.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'install' && deferred) {
        deferred.prompt();
        try { await deferred.userChoice; } catch (err) { /* egal */ }
        deferred = null;
      }
      dismiss();
    });
    document.body.appendChild(box);
  }

  if (isIOS) {
    window.addEventListener('load', () => setTimeout(() => show(
      '<strong>Als App installieren</strong>Tippe auf das Teilen-Symbol (Quadrat mit Pfeil) oder auf «…», wähle «Zum Home-Bildschirm» und lass «Als Web-App öffnen» eingeschaltet. Danach liegt Ordni wie eine App auf dem Home-Bildschirm.',
      false,
    ), 1200));
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    show('<strong>Als App installieren</strong>Ordni lässt sich wie eine App auf dem Gerät installieren.', true);
  });
})();
