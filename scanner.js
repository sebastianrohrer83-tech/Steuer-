// Scanner-Oberfläche: Live-Kamera mit Blatterkennung und automatischer Auslösung,
// Ecken-Anpassung, Entzerren und Aufbereiten. Für Fotos aus der Galerie gibt es denselben Ablauf ohne Live-Bild.
import { detectDocument, warpToCanvas, defaultCorners, fullCorners } from './scan.js';

const MAX_SIDE = 2480; // längste Seite des fertigen Scans (ca. 210 dpi bei A4)
const STABLE_MS = 900; // so lange muss das erkannte Blatt ruhig liegen, bis automatisch ausgelöst wird
const TICK_MS = 140; // Abstand der Live-Erkennung
const MODES = [['doc', 'Dokument'], ['color', 'Farbe'], ['orig', 'Original']];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let root = null;

function getRoot() {
  if (!root) {
    root = document.createElement('div');
    root.id = 'scanner';
    document.body.appendChild(root);
  }
  return root;
}
function openRoot() {
  const r = getRoot();
  r.innerHTML = '';
  r.className = 'show';
  document.body.classList.add('scanning');
  return r;
}
function closeRoot() {
  const r = getRoot();
  r.className = '';
  r.innerHTML = '';
  document.body.classList.remove('scanning');
}

const toBlob = (canvas, q) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('JPEG fehlgeschlagen'))), 'image/jpeg', q));

// Das Originalfoto (mit Ecken und Filter) bleibt beim Beleg, damit die Seite später nochmals zugeschnitten oder
// mit einem anderen Filter bearbeitet werden kann. Es wird nicht in die Sync-Datei übernommen (nur auf diesem Gerät).
const SRC_SIDE = 2400;
const keepOriginals = () => { try { return localStorage.getItem('ordni.keepOrig') !== '0'; } catch { return true; } };
async function attachSource(page, canvas, corners, mode) {
  if (!keepOriginals()) return page;
  const s = Math.min(1, SRC_SIDE / Math.max(canvas.width, canvas.height));
  let c = canvas;
  if (s < 1) { c = document.createElement('canvas'); c.width = Math.round(canvas.width * s); c.height = Math.round(canvas.height * s); c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height); }
  page.src = await toBlob(c, 0.8); page.sw = c.width; page.sh = c.height;
  page.corners = corners.map((p) => ({ x: p.x * s, y: p.y * s })); page.mode = mode;
  return page;
}

async function canvasToPage(canvas, mode) {
  return { blob: await toBlob(canvas, mode === 'doc' ? 0.8 : 0.85), w: canvas.width, h: canvas.height };
}

// Blatt in einem (verkleinerten) Canvas suchen. Ecken werden auf die Grösse des Originals umgerechnet.
function detectOn(src, maxSide) {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * s));
  c.height = Math.max(1, Math.round(src.height * s));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const det = detectDocument(ctx.getImageData(0, 0, c.width, c.height));
  if (!det) return null;
  return { ...det, corners: det.corners.map((p) => ({ x: p.x / s, y: p.y / s })) };
}

function fileToCanvas(file, maxSide) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
    img.src = url;
  });
}

const quadArea = (q) => {
  let s = 0;
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
};

// Prüfbild mit verschiebbaren Ecken. Ergebnis: { action: 'ok', page } | { action: 'retake' | 'skip' | 'cancel' }
function runReview({ canvas, corners, mode, title, retakeLabel }) {
  return new Promise((resolve) => {
    const r = getRoot();
    const el = document.createElement('div');
    el.className = 'sc-review';
    el.innerHTML = `
      <div class="sc-top">
        <button class="sc-btn" data-a="cancel" aria-label="Verwerfen">✕</button>
        <div class="sc-status">${title}</div>
        <button class="sc-btn" data-a="full">Ganzes Bild</button>
      </div>
      <div class="sc-stage"><canvas></canvas></div>
      <div class="sc-hint">Passt der grüne Rahmen genau um das Blatt? Dann tippe auf «Übernehmen». Sonst ziehe die Punkte auf die Blattecken.</div>
      <div class="sc-modes">${MODES.map(([m, l]) => `<button data-m="${m}" class="${m === mode ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="sc-bottom">
        ${retakeLabel ? `<button class="sc-text" data-a="retake">${retakeLabel}</button>` : '<span></span>'}
        <button class="sc-ok" data-a="ok">Übernehmen</button>
      </div>`;
    r.appendChild(el);
    r.classList.add('reviewing');

    let cur = corners.map((p) => ({ x: clamp(p.x, 0, canvas.width), y: clamp(p.y, 0, canvas.height) }));
    let curMode = mode;
    const cv = el.querySelector('canvas');
    const ctx = cv.getContext('2d');
    let scale = 1, ox = 0, oy = 0, W = 0, H = 0, dpr = 1;

    const toScr = (p) => ({ x: ox + p.x * scale, y: oy + p.y * scale });
    const toImg = (x, y) => ({ x: (x - ox) / scale, y: (y - oy) / scale });

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(canvas, ox, oy, canvas.width * scale, canvas.height * scale);
      const pts = cur.map(toScr);
      ctx.beginPath();
      ctx.rect(ox, oy, canvas.width * scale, canvas.height * scale);
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fill('evenodd');
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#4ade80';
      ctx.stroke();
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#16a34a';
        ctx.stroke();
      });
    }
    function layout() {
      const rect = cv.parentElement.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      W = rect.width; H = rect.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const pad = 26;
      scale = Math.min((W - 2 * pad) / canvas.width, (H - 2 * pad) / canvas.height);
      ox = (W - canvas.width * scale) / 2;
      oy = (H - canvas.height * scale) / 2;
      draw();
    }

    let drag = -1;
    const local = (e) => { const rc = cv.getBoundingClientRect(); return { x: e.clientX - rc.left, y: e.clientY - rc.top }; };
    cv.addEventListener('pointerdown', (e) => {
      const { x, y } = local(e);
      let bi = -1, bd = 48;
      cur.forEach((p, i) => { const s = toScr(p); const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) { drag = bi; cv.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    cv.addEventListener('pointermove', (e) => {
      if (drag < 0) return;
      const { x, y } = local(e);
      const p = toImg(x, y);
      cur[drag] = { x: clamp(p.x, 0, canvas.width), y: clamp(p.y, 0, canvas.height) };
      draw();
    });
    const endDrag = () => { drag = -1; };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);

    const cleanup = () => {
      window.removeEventListener('resize', layout);
      el.remove();
      r.classList.remove('reviewing');
    };

    el.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-m]');
      if (m) {
        curMode = m.dataset.m;
        el.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b === m));
        return;
      }
      const btn = e.target.closest('[data-a]');
      if (!btn) return;
      const a = btn.dataset.a;
      if (a === 'full') { cur = fullCorners(canvas.width, canvas.height); draw(); }
      else if (a === 'cancel') { cleanup(); resolve({ action: 'cancel' }); }
      else if (a === 'retake') { cleanup(); resolve({ action: 'retake' }); }
      else if (a === 'ok') {
        if (quadArea(cur) < canvas.width * canvas.height * 0.02) { alert('Die Ecken liegen zu eng beieinander. Bitte auf die Blattecken ziehen.'); return; }
        el.classList.add('working');
        await new Promise((res) => setTimeout(res, 40));
        try {
          const out = warpToCanvas(canvas, cur, { mode: curMode, maxSide: MAX_SIDE });
          const page = await canvasToPage(out, curMode);
          await attachSource(page, canvas, cur, curMode);
          cleanup();
          resolve({ action: 'ok', page });
        } catch (err) {
          el.classList.remove('working');
          alert('Fehler beim Verarbeiten: ' + err.message);
        }
      }
    });
    window.addEventListener('resize', layout);
    layout();
  });
}

// Fotos aus der Galerie: jedes Bild bekommt die automatische Blatterkennung und das Ecken-Prüfbild.
export async function reviewFiles(files, { mode = 'doc' } = {}) {
  openRoot();
  const pages = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const canvas = await fileToCanvas(files[i], 3200);
      const det = detectOn(canvas, 640);
      const corners = det ? det.corners : fullCorners(canvas.width, canvas.height);
      const res = await runReview({
        canvas, corners, mode,
        title: files.length > 1 ? `Seite ${i + 1} von ${files.length}` : (det ? 'Blatt erkannt' : 'Ecken anpassen'),
        retakeLabel: files.length > 1 ? 'Überspringen' : null,
      });
      if (res.action === 'ok') pages.push(res.page);
      else if (res.action === 'cancel') return null;
    }
  } finally { closeRoot(); }
  return pages;
}

// Gespeicherte Seite nochmals bearbeiten: Ecken neu setzen, Filter wechseln. Ergebnis: neue Seite oder null (abgebrochen).
export async function editPage(page) {
  openRoot();
  try {
    let canvas, corners, mode, title;
    if (page.src) {
      canvas = await fileToCanvas(page.src, 3200);
      const k = canvas.width / page.sw;
      corners = (page.corners && page.corners.length === 4 ? page.corners : fullCorners(page.sw, page.sh)).map((p) => ({ x: p.x * k, y: p.y * k }));
      mode = page.mode || 'doc'; title = 'Seite bearbeiten';
    } else { // ältere Seite ohne Originalfoto: das fertige Bild nochmals zuschneiden
      canvas = await fileToCanvas(page.blob, 3200);
      corners = fullCorners(canvas.width, canvas.height); mode = 'orig'; title = 'Seite zuschneiden';
    }
    const res = await runReview({ canvas, corners, mode, title, retakeLabel: null });
    return res.action === 'ok' ? res.page : null;
  } finally { closeRoot(); }
}

// Live-Scanner. Ergebnis: Seitenliste, null (abgebrochen) oder 'unavailable' (keine Kamera).
export function scanPages({ mode = 'doc', auto = true, onAuto = () => {} } = {}) {
  return new Promise((resolve) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { resolve('unavailable'); return; }
    const r = openRoot();
    r.innerHTML = `
      <div class="sc-live">
        <div class="sc-top">
          <button class="sc-btn" data-a="close" aria-label="Schliessen">✕</button>
          <div class="sc-status">Kamera wird gestartet …</div>
          <button class="sc-btn" data-a="torch" hidden aria-label="Licht">🔦</button>
        </div>
        <div class="sc-stage"><video playsinline muted autoplay></video><canvas class="sc-overlay"></canvas></div>
        <div class="sc-prog"><div></div></div>
        <div class="sc-bottom">
          <label class="sc-auto"><input type="checkbox" ${auto ? 'checked' : ''}> Automatisch</label>
          <button class="sc-shutter" data-a="shutter" aria-label="Aufnehmen"></button>
          <button class="sc-ok" data-a="done" disabled>Fertig</button>
        </div>
      </div>`;
    const $ = (s) => r.querySelector(s);
    const video = $('video'), overlay = $('.sc-overlay'), status = $('.sc-live .sc-status'), prog = $('.sc-prog > div');
    const doneBtn = $('[data-a=done]'), torchBtn = $('[data-a=torch]'), autoBox = $('.sc-auto input'), stage = $('.sc-live .sc-stage');

    const pages = [];
    let stream = null, timer = null, closed = false, paused = false, torchOn = false;
    let live = null, lastSeen = 0, stableMs = 0, lastCapture = 0, lastTick = performance.now();
    const small = document.createElement('canvas');
    const sctx = small.getContext('2d', { willReadFrequently: true });

    const finish = (result) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      window.removeEventListener('resize', draw);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      closeRoot();
      resolve(result);
    };

    function setStatus(t) { if (status.textContent !== t) status.textContent = t; }

    function draw() {
      const rect = overlay.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      overlay.width = Math.round(rect.width * dpr);
      overlay.height = Math.round(rect.height * dpr);
      const ctx = overlay.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      if (!live || !video.videoWidth) return;
      const vw = video.videoWidth, vh = video.videoHeight;
      const sc = Math.min(rect.width / vw, rect.height / vh);
      const ox = (rect.width - vw * sc) / 2, oy = (rect.height - vh * sc) / 2;
      const pts = live.corners.map((p) => ({ x: ox + p.x * vw * sc, y: oy + p.y * vh * sc }));
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      const col = live.sure ? '#4ade80' : '#facc15';
      ctx.fillStyle = live.sure ? 'rgba(74,222,128,.22)' : 'rgba(250,204,21,.16)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = col;
      ctx.stroke();
      pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); });
    }

    function update(det, sw, sh, dt, now) {
      const good = det && det.score >= 0.35 && det.area >= 0.12;
      if (good) {
        const nc = det.corners.map((p) => ({ x: p.x / sw, y: p.y / sh }));
        const prev = live && live.corners;
        const d = prev ? Math.max(...nc.map((p, i) => Math.hypot(p.x - prev[i].x, ((p.y - prev[i].y) * sh) / sw))) : 1;
        const corners = prev && d < 0.08 ? nc.map((p, i) => ({ x: (prev[i].x + p.x) / 2, y: (prev[i].y + p.y) / 2 })) : nc;
        live = { corners, sure: det.fill >= 0.93 && det.score >= 0.45 && det.area >= 0.22 };
        lastSeen = now;
        if (d < 0.02 && live.sure) stableMs += dt; else stableMs = 0;
      } else {
        stableMs = 0;
        if (live && now - lastSeen > 500) live = null;
      }
      if (!live) setStatus('Blatt vollständig ins Bild halten');
      else if (!live.sure) setStatus('Blatt wird erkannt …');
      else if (autoBox.checked) setStatus('Ruhig halten …');
      else setStatus('Blatt erkannt, Auslöser drücken');
      prog.style.width = (autoBox.checked && live && live.sure ? Math.min(1, stableMs / STABLE_MS) * 100 : 0) + '%';
      if (autoBox.checked && stableMs >= STABLE_MS && now - lastCapture > 1200) capture();
    }

    function tick() {
      if (closed) return;
      const now = performance.now();
      const dt = now - lastTick;
      lastTick = now;
      if (!paused && video.videoWidth) {
        const vw = video.videoWidth, vh = video.videoHeight;
        const s = 320 / Math.max(vw, vh);
        small.width = Math.round(vw * s);
        small.height = Math.round(vh * s);
        sctx.drawImage(video, 0, 0, small.width, small.height);
        update(detectDocument(sctx.getImageData(0, 0, small.width, small.height)), small.width, small.height, dt, now);
        draw();
      }
      timer = setTimeout(tick, TICK_MS);
    }

    async function capture() {
      if (paused || closed || !video.videoWidth) return;
      paused = true;
      lastCapture = performance.now();
      stableMs = 0;
      prog.style.width = '0%';
      const vw = video.videoWidth, vh = video.videoHeight;
      const frame = document.createElement('canvas');
      frame.width = vw; frame.height = vh;
      frame.getContext('2d').drawImage(video, 0, 0);
      setStatus('Aufgenommen ✓');
      if (navigator.vibrate) navigator.vibrate(40);
      stage.classList.add('flash');
      setTimeout(() => stage.classList.remove('flash'), 180);
      await new Promise((res) => setTimeout(res, 60));
      const det = detectOn(frame, 640);
      const corners = det ? det.corners : (live ? live.corners.map((p) => ({ x: p.x * vw, y: p.y * vh })) : defaultCorners(vw, vh));
      const res = await runReview({ canvas: frame, corners, mode, title: `Seite ${pages.length + 1}`, retakeLabel: 'Wiederholen' });
      if (res.action === 'ok') {
        pages.push(res.page);
        doneBtn.disabled = false;
        doneBtn.textContent = `Fertig (${pages.length})`;
      }
      live = null;
      lastCapture = performance.now();
      try { await video.play(); } catch (err) { /* läuft meist ohnehin weiter */ }
      paused = false;
    }

    $('.sc-live').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-a]');
      if (!btn) return;
      const a = btn.dataset.a;
      if (a === 'shutter') capture();
      else if (a === 'done') finish(pages);
      else if (a === 'close') {
        if (!pages.length || confirm(`${pages.length} aufgenommene Seite(n) verwerfen?`)) finish(null);
      } else if (a === 'torch') {
        torchOn = !torchOn;
        try { await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: torchOn }] }); } catch (err) { torchOn = false; }
        torchBtn.classList.toggle('on', torchOn);
      }
    });
    autoBox.addEventListener('change', () => { onAuto(autoBox.checked); stableMs = 0; });
    window.addEventListener('resize', draw);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
      } catch (err) { finish('unavailable'); return; }
      if (closed) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      try { await video.play(); } catch (err) { /* Wiedergabe startet bei Berührung */ }
      const track = stream.getVideoTracks()[0];
      try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (err) { /* nicht überall verfügbar */ }
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) torchBtn.hidden = false;
      setStatus('Blatt vollständig ins Bild halten');
      lastTick = performance.now();
      tick();
    })();
  });
}
