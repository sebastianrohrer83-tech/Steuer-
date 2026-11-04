import { db } from './db.js';
import { makePdf } from './pdfwriter.js';
import { ZipWriter, readZip } from './zip.js';

// ---------------------------------------------------------------------------
// Standardordner: orientiert an den Beilagen der Steuererklärung AR (natürliche Personen)
// ---------------------------------------------------------------------------
export const DEFAULT_FOLDERS = [
  { key: 'einkommen', name: 'Lohn & Einkommen', icon: '💼', hint: 'Lohnausweis(e), AHV/IV-Rente, Pensionskassen-Rente, Taggelder (ALV, Krankentaggeld, Unfall), Erwerbsausfallentschädigung, Nebenerwerb' },
  { key: 'wertschriften', name: 'Bank & Wertschriften', icon: '🏦', hint: 'Zins- und Saldobescheinigungen per 31.12., Steuerauszug Depot, Verrechnungssteuer, Kryptowährungen, Bargeld, Lotteriegewinne' },
  { key: 'berufsauslagen', name: 'Berufsauslagen', icon: '🚆', hint: 'ÖV-Abo / Fahrkosten, Mehrkosten Verpflegung, Weiterbildung, Berufskleider und Werkzeuge, Homeoffice, Wochenaufenthalt' },
  { key: 'vorsorge', name: 'Säule 3a & Pensionskasse', icon: '🛡️', hint: 'Bescheinigung Säule 3a, Einkauf Pensionskasse, Lebens- und Rentenversicherungen (Rückkaufswert), freiwillige AHV-Beiträge' },
  { key: 'krankenkasse', name: 'Krankenkasse & Gesundheit', icon: '🏥', hint: 'Prämienübersicht Krankenkasse, Prämienverbilligung, Arzt-, Zahnarzt- und Spitalrechnungen, Selbstbehalt/Franchise, Brille, behinderungsbedingte Kosten' },
  { key: 'liegenschaft', name: 'Liegenschaft & Wohnen', icon: '🏠', hint: 'Hypothekarzins-Bescheinigung, Unterhalts- und Renovationsrechnungen, Nebenkostenabrechnung, Eigenmietwert, Gebäudeversicherung, Mietvertrag' },
  { key: 'schulden', name: 'Schulden & Schuldzinsen', icon: '💳', hint: 'Privatkredit, Kreditkartenzinsen, Darlehen, Schuldzinsbescheinigungen per 31.12.' },
  { key: 'familie', name: 'Kinder & Familie', icon: '👨‍👩‍👧', hint: 'Fremdbetreuung (Kita, Tagesfamilie, Hort), erhaltene und bezahlte Alimente, Ausbildungskosten der Kinder, Unterstützungsbeiträge' },
  { key: 'spenden', name: 'Spenden & Beiträge', icon: '🎁', hint: 'Spendenbescheinigungen (gemeinnützige Organisationen), Parteibeiträge, Beiträge Berufsverband / Gewerkschaft' },
  { key: 'steuern', name: 'Steuern & Behörden', icon: '🏛️', hint: 'Veranlagungsverfügung Vorjahr, Steuerrechnungen, Steuererklärung Vorjahr, Quellensteuer, Korrespondenz mit dem Steueramt' },
  { key: 'sonstiges', name: 'Sonstiges', icon: '📁', hint: 'Alles, was in keinen anderen Ordner passt (z. B. Erbschaft, Schenkung, Auslandkonten, Weiteres)' },
];

const $ = (s, r = document) => r.querySelector(s);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (ts) => new Date(ts).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtBytes = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB');
const slug = (s) => String(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
  .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'Dokument';

let objectUrls = [];
function blobUrl(blob) {
  const u = URL.createObjectURL(blob);
  objectUrls.push(u);
  return u;
}
function revokeUrls() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls = [];
}

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function busy(on, text = 'Bitte warten …') {
  const b = $('#busy');
  b.querySelector('span').textContent = text;
  b.classList.toggle('show', !!on);
}

// ---------------------------------------------------------------------------
// Dialoge
// ---------------------------------------------------------------------------
function dialog(html) {
  return new Promise((resolve) => {
    const d = $('#dlg');
    d.innerHTML = `<form method="dialog" class="dlg-form">${html}</form>`;
    const form = d.querySelector('form');
    const done = (v) => { d.close(); d.innerHTML = ''; resolve(v); };
    form.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      e.preventDefault();
      if (btn.dataset.value === 'ok' || btn.dataset.value === 'submit') {
        const data = {};
        new FormData(form).forEach((v, k) => (data[k] = v));
        done(data);
      } else done(btn.dataset.value === 'cancel' ? null : btn.dataset.value);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {};
      new FormData(form).forEach((v, k) => (data[k] = v));
      done(data);
    });
    d.addEventListener('cancel', () => done(null), { once: true });
    d.showModal();
    const first = form.querySelector('input[type=text], input:not([type=hidden]), select, textarea');
    if (first) { first.focus(); if (first.select) first.select(); }
  });
}
const confirmDlg = (title, text, okLabel = 'Löschen') => dialog(`
  <h2>${esc(title)}</h2><p>${esc(text)}</p>
  <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="button" data-value="yes" class="btn danger">${esc(okLabel)}</button></div>`)
  .then((v) => v === 'yes');
const promptDlg = (title, label, value = '', okLabel = 'Speichern') => dialog(`
  <h2>${esc(title)}</h2><label>${esc(label)}<input type="text" name="v" value="${esc(value)}" required maxlength="80"></label>
  <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="submit" class="btn primary">${esc(okLabel)}</button></div>`)
  .then((r) => (r && r.v ? r.v.trim() : null));

// ---------------------------------------------------------------------------
// Daten
// ---------------------------------------------------------------------------
async function getSetting(k, def) { const r = await db.get('settings', k); return r ? r.value : def; }
async function setSetting(k, v) { await db.put('settings', { key: k, value: v }); }

// Standardordner bekommen eine feste ID je Jahr, damit sie auf allen Geräten identisch sind.
const builtinId = (year, key) => `${year}-${key}`;

async function createDefaultFolders(year, onlyMissing = false) {
  const existing = await db.getAllBy('folders', 'year', year);
  const have = new Set(existing.map((f) => f.builtin).filter(Boolean));
  let order = existing.length ? Math.max(...existing.map((f) => f.order || 0)) + 1 : 0;
  let created = 0;
  for (const [i, f] of DEFAULT_FOLDERS.entries()) {
    if (onlyMissing && have.has(f.key)) continue;
    await db.put('folders', { id: builtinId(year, f.key), year, name: f.name, icon: f.icon, hint: f.hint, order: onlyMissing ? order++ : i, builtin: f.key, createdAt: Date.now() });
    created++;
  }
  return created;
}

// Ältere Installationen hatten zufällige IDs für Standardordner: einmalig umstellen.
async function migrateFolderIds() {
  if (await getSetting('migratedFolderIds')) return;
  for (const f of await db.getAll('folders')) {
    if (!f.builtin) continue;
    const want = builtinId(f.year, f.builtin);
    if (f.id === want) continue;
    const clash = await db.get('folders', want);
    const targetId = clash ? clash.id : want;
    if (!clash) await db.put('folders', { ...f, id: want });
    for (const d of await db.getAllBy('docs', 'folderId', f.id)) { d.folderId = targetId; await db.put('docs', d); }
    await db.del('folders', f.id);
  }
  await setSetting('migratedFolderIds', true);
}

// Gelöschte Dokumente werden gemerkt, damit das Löschen beim Abgleich auf andere Geräte übertragen wird.
async function getTombstones() { return (await getSetting('tombstones', {})) || {}; }
async function markDeleted(ids) {
  const t = await getTombstones();
  const now = Date.now();
  for (const id of ids) t[id] = now;
  await setSetting('tombstones', t);
}
async function deleteDoc(id) { await db.del('docs', id); await markDeleted([id]); }

async function ensureYear(year) {
  if (!(await db.get('years', year))) {
    await db.put('years', { year, createdAt: Date.now() });
    await createDefaultFolders(year);
  }
}

async function currentYear() {
  await migrateFolderIds();
  let y = await getSetting('year');
  if (!y) { y = new Date().getFullYear(); await setSetting('year', y); }
  await ensureYear(y);
  return y;
}

async function foldersOf(year) {
  const list = await db.getAllBy('folders', 'year', year);
  return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'de'));
}
async function docsOf(folderId) {
  const list = await db.getAllBy('docs', 'folderId', folderId);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}
function docSize(d) {
  if (d.kind === 'pdf') return d.file ? d.file.size : 0;
  return (d.pages || []).reduce((s, p) => s + (p.blob ? p.blob.size : 0), 0);
}

// ---------------------------------------------------------------------------
// Bildverarbeitung (Scan)
// ---------------------------------------------------------------------------
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
    img.src = url;
  });
}
const toJpeg = (canvas, q = 0.82) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('JPEG fehlgeschlagen'))), 'image/jpeg', q));

function enhanceCanvas(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h);
  const p = d.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4) {
    const l = ((p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000) | 0;
    p[i] = l;
    hist[l]++;
  }
  const total = w * h;
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * 0.01) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * 0.03) { hi = i; break; } }
  const range = Math.max(32, hi - lo);
  for (let i = 0; i < p.length; i += 4) {
    let v = ((p[i] - lo) * 255) / range;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    v = 255 * Math.pow(v / 255, 1.2);
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  ctx.putImageData(d, 0, 0);
}

async function processImage(file, enhance) {
  const img = await loadImage(file);
  const MAX = 2200;
  let w = img.naturalWidth, h = img.naturalHeight;
  const s = Math.min(1, MAX / Math.max(w, h));
  w = Math.max(1, Math.round(w * s));
  h = Math.max(1, Math.round(h * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  if (enhance) enhanceCanvas(ctx, w, h);
  return { blob: await toJpeg(c), w, h };
}

async function rotatePage(page) {
  const img = await loadImage(page.blob);
  const c = document.createElement('canvas');
  c.width = img.naturalHeight; c.height = img.naturalWidth;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return { blob: await toJpeg(c, 0.9), w: c.width, h: c.height };
}

async function docToPdf(doc) {
  if (doc.kind === 'pdf') return doc.file;
  return makePdf(doc.pages, { title: doc.title });
}

// ---------------------------------------------------------------------------
// Dateien herunterladen / teilen
// ---------------------------------------------------------------------------
function download(blob, name) {
  const a = document.createElement('a');
  a.href = blobUrl(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
async function shareOrDownload(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: title || name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(blob, name);
}
const pdfName = (year, folder, doc) => `${year}_${slug(folder.name)}_${slug(doc.title)}.pdf`;

// ---------------------------------------------------------------------------
// Export / Backup
// ---------------------------------------------------------------------------
async function exportFolderZip(year, folder) {
  const docs = await docsOf(folder.id);
  if (!docs.length) { toast('Dieser Ordner ist leer.'); return; }
  busy(true, 'PDFs werden erstellt …');
  try {
    const zip = new ZipWriter();
    const base = `${year}_${slug(folder.name)}/`;
    for (const d of docs) {
      const pdf = await docToPdf(d);
      zip.add(base + pdfName(year, folder, d), new Uint8Array(await pdf.arrayBuffer()));
    }
    download(zip.finish(), `${year}_${slug(folder.name)}.zip`);
    toast('ZIP erstellt. Die PDFs können nun im Steuerportal hochgeladen werden.');
  } finally { busy(false); }
}

async function exportYearZip(year, onlyNotUploaded) {
  const folders = await foldersOf(year);
  busy(true, 'Upload-Paket wird erstellt …');
  try {
    const zip = new ZipWriter();
    let n = 0;
    const lines = [`Steuerjahr ${year} – Belege für die Online-Steuererklärung`, ''];
    for (const f of folders) {
      const docs = (await docsOf(f.id)).filter((d) => !onlyNotUploaded || !d.uploaded);
      if (!docs.length) continue;
      lines.push(`${f.icon || ''} ${f.name}`.trim());
      const base = `${year}_${slug(f.name)}/`;
      for (const d of docs) {
        const pdf = await docToPdf(d);
        const name = pdfName(year, f, d);
        zip.add(base + name, new Uint8Array(await pdf.arrayBuffer()));
        lines.push(`  - ${name}${d.uploaded ? ' (bereits hochgeladen)' : ''}${d.note ? ' – ' + d.note : ''}`);
        n++;
      }
      lines.push('');
    }
    if (!n) { toast(onlyNotUploaded ? 'Alle Dokumente sind bereits als hochgeladen markiert.' : 'Keine Dokumente vorhanden.'); return; }
    zip.add(`${year}_Uebersicht.txt`, new TextEncoder().encode(lines.join('\n')));
    download(zip.finish(), `Steuerbelege_${year}${onlyNotUploaded ? '_offen' : ''}.zip`);
    toast(`${n} Dokument(e) als PDF exportiert.`);
  } finally { busy(false); }
}

const SYNC_FILENAME = 'Steuerordner_Sync.zip';

async function buildSyncZip() {
  const zip = new ZipWriter();
  const years = await db.getAll('years');
  const folders = await db.getAll('folders');
  const docs = await db.getAll('docs');
  const manifest = { app: 'steuerordner', version: 2, createdAt: Date.now(), years, folders, docs: [], tombstones: await getTombstones() };
  for (const d of docs) {
    const entry = { ...d, pages: undefined, file: undefined, files: [] };
    if (d.kind === 'pdf' && d.file) {
      const name = `files/${d.id}/dokument.pdf`;
      zip.add(name, new Uint8Array(await d.file.arrayBuffer()));
      entry.files.push({ name });
    } else {
      for (const [i, p] of (d.pages || []).entries()) {
        const name = `files/${d.id}/seite-${String(i + 1).padStart(2, '0')}.jpg`;
        zip.add(name, new Uint8Array(await p.blob.arrayBuffer()));
        entry.files.push({ name, w: p.w, h: p.h });
      }
    }
    manifest.docs.push(entry);
  }
  zip.add('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)));
  return zip.finish();
}

// Sync-Datei speichern: auf dem Handy über das Teilen-Menü («In Dateien sichern» → iCloud Drive),
// am Computer als Download in den iCloud-Drive-Ordner.
async function saveSyncFile(share) {
  busy(true, 'Sync-Datei wird erstellt …');
  try {
    const blob = await buildSyncZip();
    if (share) await shareOrDownload(blob, SYNC_FILENAME, 'Steuerordner Sync-Datei'); else download(blob, SYNC_FILENAME);
    await setSetting('lastSync', Date.now());
    toast('Sync-Datei erstellt. In iCloud Drive ablegen (vorhandene Datei ersetzen).');
  } finally { busy(false); }
}

// Sync-Datei einlesen und mit dem lokalen Bestand zusammenführen:
// - Dokumente: gleiche ID → neuere Version gewinnt; Löschungen werden übernommen
// - Ordner: Standardordner über ihre feste ID, eigene Ordner über Jahr + Name (keine Duplikate)
async function mergeSyncFile(file) {
  busy(true, 'Sync-Datei wird eingelesen …');
  try {
    const entries = await readZip(await file.arrayBuffer());
    const mf = entries.find((e) => e.name === 'manifest.json');
    if (!mf) throw new Error('Keine Steuerordner-Sync-Datei (manifest.json fehlt).');
    const manifest = JSON.parse(new TextDecoder().decode(mf.data));
    if (manifest.app !== 'steuerordner') throw new Error('Unbekanntes Dateiformat.');
    const byName = new Map(entries.map((e) => [e.name, e.data]));
    const stats = { added: 0, updated: 0, deleted: 0, folders: 0 };

    for (const y of manifest.years || []) if (!(await db.get('years', y.year))) await db.put('years', y);

    const localFolders = await db.getAll('folders');
    const folderMap = new Map(); // ID aus der Datei → lokale ID
    for (const f of manifest.folders || []) {
      let match = localFolders.find((l) => l.id === f.id);
      if (!match && f.builtin) match = localFolders.find((l) => l.year === f.year && l.builtin === f.builtin);
      if (!match) match = localFolders.find((l) => l.year === f.year && l.name.trim().toLowerCase() === String(f.name).trim().toLowerCase());
      if (match) { folderMap.set(f.id, match.id); continue; }
      const nf = f.builtin ? { ...f, id: builtinId(f.year, f.builtin) } : { ...f };
      await db.put('folders', nf);
      localFolders.push(nf);
      folderMap.set(f.id, nf.id);
      stats.folders++;
    }

    const localTomb = await getTombstones();
    const remoteTomb = manifest.tombstones || {};
    for (const d of manifest.docs || []) {
      const delAt = localTomb[d.id];
      if (delAt && delAt >= (d.updatedAt || d.createdAt || 0)) continue; // hier gelöscht, dort älter
      const existing = await db.get('docs', d.id);
      if (existing && (existing.updatedAt || existing.createdAt || 0) >= (d.updatedAt || d.createdAt || 0)) continue;
      const doc = { ...d };
      delete doc.files;
      doc.folderId = folderMap.get(d.folderId) || d.folderId;
      if (d.kind === 'pdf') {
        const data = byName.get(d.files[0] && d.files[0].name);
        if (!data) continue;
        doc.file = new Blob([data], { type: 'application/pdf' });
      } else {
        doc.pages = [];
        for (const f of d.files || []) {
          const data = byName.get(f.name);
          if (data) doc.pages.push({ blob: new Blob([data], { type: 'image/jpeg' }), w: f.w, h: f.h });
        }
        if (!doc.pages.length) continue;
      }
      await db.put('docs', doc);
      if (existing) stats.updated++; else stats.added++;
    }

    for (const [id, delAt] of Object.entries(remoteTomb)) {
      const local = await db.get('docs', id);
      if (local && (local.updatedAt || local.createdAt || 0) < delAt) { await db.del('docs', id); stats.deleted++; }
      if (!localTomb[id] || localTomb[id] < delAt) localTomb[id] = delAt;
    }
    await setSetting('tombstones', localTomb);
    await setSetting('lastSync', Date.now());
    toast(`Abgleich fertig: ${stats.added} neu, ${stats.updated} aktualisiert, ${stats.deleted} gelöscht${stats.folders ? `, ${stats.folders} Ordner` : ''}.`, 4500);
  } finally { busy(false); }
}

async function changesSinceSync() {
  const last = await getSetting('lastSync', 0);
  if (!last) return null;
  const docs = await db.getAll('docs');
  const t = await getTombstones();
  const n = docs.filter((d) => (d.updatedAt || d.createdAt) > last).length + Object.values(t).filter((x) => x > last).length;
  return { last, n };
}

// ---------------------------------------------------------------------------
// Dokumente anlegen
// ---------------------------------------------------------------------------
async function addFiles(files, folder, year) {
  const list = [...files];
  const imgs = list.filter((f) => f.type.startsWith('image/'));
  const pdfs = list.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  const others = list.length - imgs.length - pdfs.length;
  if (others) toast('Nur Bilder und PDF-Dateien werden unterstützt.');
  const enhance = await getSetting('enhance', true);
  const created = [];
  busy(true, 'Scan wird verarbeitet …');
  try {
    if (imgs.length) {
      const pages = [];
      for (const f of imgs) pages.push(await processImage(f, enhance));
      const doc = { id: uid(), folderId: folder.id, year, title: `Beleg vom ${fmtDate(Date.now())}`, kind: 'images', pages, note: '', uploaded: false, createdAt: Date.now(), updatedAt: Date.now() };
      await db.put('docs', doc);
      created.push(doc);
    }
    for (const f of pdfs) {
      const doc = { id: uid(), folderId: folder.id, year, title: f.name.replace(/\.pdf$/i, ''), kind: 'pdf', file: new Blob([await f.arrayBuffer()], { type: 'application/pdf' }), note: '', uploaded: false, createdAt: Date.now(), updatedAt: Date.now() };
      await db.put('docs', doc);
      created.push(doc);
    }
  } finally { busy(false); }
  return created;
}

function pickFiles({ camera }) {
  return new Promise((resolve) => {
    const input = camera ? $('#camInput') : $('#galInput');
    input.value = '';
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}

async function chooseFolder(year, title = 'In welchen Ordner?') {
  const folders = await foldersOf(year);
  const r = await dialog(`<h2>${esc(title)}</h2>
    <label>Ordner<select name="folderId">${folders.map((f) => `<option value="${f.id}">${esc((f.icon || '') + ' ' + f.name)}</option>`).join('')}</select></label>
    <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="submit" class="btn primary">Weiter</button></div>`);
  return r ? folders.find((f) => f.id === r.folderId) : null;
}

async function scanInto(folder, year, camera) {
  const files = await pickFiles({ camera });
  if (!files.length) return;
  const created = await addFiles(files, folder, year);
  if (created.length === 1) location.hash = `#/d/${created[0].id}?new=1`;
  else if (created.length) { toast(`${created.length} Dokumente abgelegt.`); location.hash = `#/f/${folder.id}`; }
}

// ---------------------------------------------------------------------------
// Ansichten
// ---------------------------------------------------------------------------
const view = () => $('#view');
function setHeader(title, { back = null, right = '' } = {}) {
  $('#title').textContent = title;
  const b = $('#backBtn');
  b.style.visibility = back ? 'visible' : 'hidden';
  b.dataset.href = back || '';
  $('#headerRight').innerHTML = right;
}

async function renderHome() {
  const year = await currentYear();
  const years = (await db.getAll('years')).map((y) => y.year).sort((a, b) => b - a);
  const folders = await foldersOf(year);
  const docs = await db.getAllBy('docs', 'year', year);
  const countBy = {};
  const upBy = {};
  for (const d of docs) { countBy[d.folderId] = (countBy[d.folderId] || 0) + 1; if (d.uploaded) upBy[d.folderId] = (upBy[d.folderId] || 0) + 1; }
  const uploaded = docs.filter((d) => d.uploaded).length;
  const sync = await changesSinceSync();
  setHeader('Steuerordner', { right: `<a class="iconbtn" href="#/settings" title="Einstellungen" aria-label="Einstellungen">⚙︎</a>` });
  view().innerHTML = `
    <section class="yearbar">
      <label class="yearsel">Steuerjahr
        <select id="yearSelect">${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}<option value="__new">+ Neues Steuerjahr …</option></select>
      </label>
      <div class="stats">${docs.length} Dokument${docs.length === 1 ? '' : 'e'} · ${uploaded} hochgeladen</div>
      ${docs.length ? `<div class="progress"><div style="width:${Math.round((uploaded / docs.length) * 100)}%"></div></div>` : ''}
      <a class="syncline ${sync && sync.n ? 'pending' : ''}" href="#/settings">${sync ? `Letzter Abgleich ${fmtDate(sync.last)}${sync.n ? ` · ${sync.n} Änderung${sync.n === 1 ? '' : 'en'} noch nicht abgeglichen` : ' · alles abgeglichen'}` : 'Noch kein Abgleich mit anderen Geräten'} ›</a>
    </section>
    <section class="grid">
      ${folders.map((f) => `
        <a class="card" href="#/f/${f.id}">
          <div class="card-icon">${esc(f.icon || '📁')}</div>
          <div class="card-name">${esc(f.name)}</div>
          <div class="card-count">${countBy[f.id] || 0} Dok.${upBy[f.id] ? ` · ${upBy[f.id]} ✓` : ''}</div>
        </a>`).join('')}
      <button class="card card-add" data-action="newFolder"><div class="card-icon">＋</div><div class="card-name">Neuer Ordner</div></button>
    </section>
    <section class="hintbox">
      <strong>So funktioniert's:</strong> Ordner öffnen → <em>Scannen</em> → Beleg fotografieren → Titel vergeben. Für die Online-Steuererklärung (Steuern AR Online) exportierst du die Belege als PDF und lädst sie dort als Beilagen hoch.
    </section>
    <nav class="bottombar">
      <button class="btn primary big" data-action="quickScan">📷 Scannen</button>
      <button class="btn big" data-action="quickPick">🖼️ Datei / Foto</button>
      <button class="btn big" data-action="exportYear">⤓ Upload-Paket</button>
    </nav>`;

  $('#yearSelect').onchange = async (e) => {
    const v = e.target.value;
    if (v === '__new') {
      const y = await promptDlg('Neues Steuerjahr', 'Jahr (z. B. 2025)', String(year + 1), 'Anlegen');
      e.target.value = String(year);
      if (!y || !/^\d{4}$/.test(y)) return;
      await ensureYear(Number(y));
      await setSetting('year', Number(y));
    } else await setSetting('year', Number(v));
    render();
  };
  view().onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'newFolder') {
      const name = await promptDlg('Neuer Ordner', 'Name des Ordners', '', 'Anlegen');
      if (!name) return;
      await db.put('folders', { id: uid(), year, name, icon: '📁', hint: '', order: folders.length + 1, createdAt: Date.now() });
      render();
    } else if (a === 'quickScan' || a === 'quickPick') {
      const f = await chooseFolder(year);
      if (f) await scanInto(f, year, a === 'quickScan');
    } else if (a === 'exportYear') {
      const r = await dialog(`<h2>Upload-Paket ${year}</h2>
        <p>Erstellt eine ZIP-Datei mit allen Belegen als PDF, sortiert nach Ordner. Diese PDFs lädst du anschliessend in der Online-Steuererklärung als Beilagen hoch.</p>
        <div class="dlg-actions column">
          <button type="button" data-value="open" class="btn primary">Nur noch nicht hochgeladene</button>
          <button type="button" data-value="all" class="btn">Alle Dokumente</button>
          <button type="button" data-value="cancel" class="btn ghost">Abbrechen</button></div>`);
      if (r === 'open' || r === 'all') await exportYearZip(year, r === 'open');
    }
  };
}

async function renderFolder(folderId) {
  const folder = await db.get('folders', folderId);
  if (!folder) { location.hash = '#/'; return; }
  const year = folder.year;
  const docs = await docsOf(folderId);
  setHeader(folder.name, { back: '#/', right: `<button class="iconbtn" data-action="folderMenu" aria-label="Ordner-Menü">⋯</button>` });
  view().innerHTML = `
    ${folder.hint ? `<details class="hintbox" ${docs.length ? '' : 'open'}><summary>Was gehört hier hinein?</summary><p>${esc(folder.hint)}</p></details>` : ''}
    ${docs.length ? `<ul class="doclist">${docs.map((d) => `
      <li><a href="#/d/${d.id}">
        <div class="thumb">${d.kind === 'pdf' ? '<span class="pdfbadge">PDF</span>' : (d.pages[0] ? `<img src="${blobUrl(d.pages[0].blob)}" alt="">` : '')}</div>
        <div class="docmeta">
          <div class="doctitle">${esc(d.title)}</div>
          <div class="docsub">${fmtDate(d.createdAt)} · ${d.kind === 'pdf' ? 'PDF' : d.pages.length + ' Seite' + (d.pages.length === 1 ? '' : 'n')} · ${fmtBytes(docSize(d))}${d.note ? ' · ' + esc(d.note) : ''}</div>
        </div>
        <div class="status ${d.uploaded ? 'ok' : ''}" title="${d.uploaded ? 'hochgeladen' : 'noch nicht hochgeladen'}">${d.uploaded ? '✓' : '○'}</div>
      </a></li>`).join('')}</ul>`
      : `<div class="empty"><div class="empty-icon">${esc(folder.icon || '📁')}</div><p>Noch keine Dokumente.<br>Tippe auf <strong>Scannen</strong>, um einen Beleg zu fotografieren.</p></div>`}
    <nav class="bottombar">
      <button class="btn primary big" data-action="scan">📷 Scannen</button>
      <button class="btn big" data-action="pick">🖼️ Datei / Foto</button>
      <button class="btn big" data-action="zip" ${docs.length ? '' : 'disabled'}>⤓ ZIP</button>
    </nav>`;

  const handler = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'scan') await scanInto(folder, year, true);
    else if (a === 'pick') await scanInto(folder, year, false);
    else if (a === 'zip') await exportFolderZip(year, folder);
    else if (a === 'folderMenu') {
      const r = await dialog(`<h2>${esc(folder.name)}</h2>
        <div class="dlg-actions column">
          <button type="button" data-value="rename" class="btn">Umbenennen</button>
          <button type="button" data-value="hint" class="btn">Hinweistext bearbeiten</button>
          <button type="button" data-value="icon" class="btn">Symbol ändern</button>
          <button type="button" data-value="markAll" class="btn">Alle als hochgeladen markieren</button>
          <button type="button" data-value="delete" class="btn danger">Ordner löschen</button>
          <button type="button" data-value="cancel" class="btn ghost">Abbrechen</button></div>`);
      if (r === 'rename') {
        const n = await promptDlg('Ordner umbenennen', 'Name', folder.name);
        if (n) { folder.name = n; await db.put('folders', folder); render(); }
      } else if (r === 'hint') {
        const res = await dialog(`<h2>Hinweistext</h2><label>Was gehört in diesen Ordner?<textarea name="v" rows="5">${esc(folder.hint || '')}</textarea></label>
          <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div>`);
        if (res) { folder.hint = res.v.trim(); await db.put('folders', folder); render(); }
      } else if (r === 'icon') {
        const n = await promptDlg('Symbol', 'Emoji oder kurzes Zeichen', folder.icon || '📁');
        if (n) { folder.icon = n.slice(0, 4); await db.put('folders', folder); render(); }
      } else if (r === 'markAll') {
        for (const d of docs) { d.uploaded = true; d.uploadedAt = Date.now(); d.updatedAt = Date.now(); await db.put('docs', d); }
        render();
      } else if (r === 'delete') {
        const ok = await confirmDlg('Ordner löschen?', docs.length ? `Der Ordner enthält ${docs.length} Dokument(e). Diese werden unwiderruflich gelöscht.` : 'Der Ordner wird gelöscht.');
        if (!ok) return;
        await markDeleted(docs.map((d) => d.id));
        for (const d of docs) await db.del('docs', d.id);
        await db.del('folders', folder.id);
        location.hash = '#/';
      }
    }
  };
  view().onclick = handler;
  $('#headerRight').onclick = handler;
}

async function renderDoc(docId, params) {
  const doc = await db.get('docs', docId);
  if (!doc) { location.hash = '#/'; return; }
  const folder = await db.get('folders', doc.folderId);
  const year = doc.year;
  setHeader(folder ? folder.name : 'Dokument', { back: `#/f/${doc.folderId}`, right: `<button class="iconbtn" data-action="docMenu" aria-label="Dokument-Menü">⋯</button>` });
  const isImg = doc.kind !== 'pdf';
  view().innerHTML = `
    <section class="docform">
      <label>Titel<input type="text" id="docTitle" value="${esc(doc.title)}" maxlength="100" placeholder="z. B. Lohnausweis Firma AG"></label>
      <label>Notiz (optional)<input type="text" id="docNote" value="${esc(doc.note || '')}" maxlength="200" placeholder="z. B. Betrag CHF 1'234.50, Ziffer 2.1"></label>
      <label class="check"><input type="checkbox" id="docUploaded" ${doc.uploaded ? 'checked' : ''}> In der Online-Steuererklärung hochgeladen${doc.uploadedAt ? ` <small>(${fmtDate(doc.uploadedAt)})</small>` : ''}</label>
    </section>
    ${isImg ? `<section class="pages">${doc.pages.map((p, i) => `
      <figure class="page">
        <img src="${blobUrl(p.blob)}" alt="Seite ${i + 1}" data-action="viewPage" data-i="${i}">
        <figcaption>
          <span>Seite ${i + 1}</span>
          <span class="pagebtns">
            <button class="iconbtn" data-action="rotate" data-i="${i}" title="Drehen">⟳</button>
            <button class="iconbtn" data-action="up" data-i="${i}" title="Nach vorne" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="iconbtn" data-action="down" data-i="${i}" title="Nach hinten" ${i === doc.pages.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="iconbtn danger" data-action="delPage" data-i="${i}" title="Seite löschen">✕</button>
          </span>
        </figcaption>
      </figure>`).join('')}
      <div class="addpage">
        <button class="btn" data-action="addPageCam">📷 Seite scannen</button>
        <button class="btn" data-action="addPagePick">🖼️ Seite aus Fotos</button>
      </div></section>`
      : `<section class="pdfinfo"><span class="pdfbadge big">PDF</span><p>${esc(doc.title)}.pdf · ${fmtBytes(docSize(doc))}</p><button class="btn" data-action="openPdf">PDF anzeigen</button></section>`}
    <nav class="bottombar">
      <button class="btn primary big" data-action="share">⇪ PDF teilen / speichern</button>
      <button class="btn big" data-action="download">⤓ PDF</button>
    </nav>`;

  let saveTimer;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      doc.title = $('#docTitle').value.trim() || doc.title;
      doc.note = $('#docNote').value.trim();
      doc.updatedAt = Date.now();
      await db.put('docs', doc);
    }, 300);
  };
  $('#docTitle').oninput = save;
  $('#docNote').oninput = save;
  $('#docUploaded').onchange = async (e) => {
    doc.uploaded = e.target.checked;
    doc.uploadedAt = doc.uploaded ? Date.now() : null;
    doc.updatedAt = Date.now();
    await db.put('docs', doc);
    toast(doc.uploaded ? 'Als hochgeladen markiert.' : 'Markierung entfernt.');
  };
  if (params.get('new')) { $('#docTitle').focus(); $('#docTitle').select(); }

  const handler = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    const i = Number(btn.dataset.i);
    const fname = pdfName(year, folder || { name: 'Ordner' }, doc);
    if (a === 'share' || a === 'download') {
      busy(true, 'PDF wird erstellt …');
      try {
        const pdf = await docToPdf(doc);
        if (a === 'share') await shareOrDownload(pdf, fname, doc.title); else download(pdf, fname);
      } finally { busy(false); }
    } else if (a === 'openPdf') {
      window.open(blobUrl(doc.file), '_blank');
    } else if (a === 'viewPage') {
      window.open(blobUrl(doc.pages[i].blob), '_blank');
    } else if (a === 'rotate') {
      busy(true, 'Seite wird gedreht …');
      try { doc.pages[i] = await rotatePage(doc.pages[i]); doc.updatedAt = Date.now(); await db.put('docs', doc); render(); } finally { busy(false); }
    } else if (a === 'up' || a === 'down') {
      const j = a === 'up' ? i - 1 : i + 1;
      [doc.pages[i], doc.pages[j]] = [doc.pages[j], doc.pages[i]];
      doc.updatedAt = Date.now();
      await db.put('docs', doc); render();
    } else if (a === 'delPage') {
      if (doc.pages.length === 1) { toast('Die letzte Seite kann nicht gelöscht werden. Lösche stattdessen das Dokument.'); return; }
      if (!(await confirmDlg('Seite löschen?', `Seite ${i + 1} wird entfernt.`))) return;
      doc.pages.splice(i, 1);
      doc.updatedAt = Date.now();
      await db.put('docs', doc); render();
    } else if (a === 'addPageCam' || a === 'addPagePick') {
      const files = (await pickFiles({ camera: a === 'addPageCam' })).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      const enhance = await getSetting('enhance', true);
      busy(true, 'Seite wird verarbeitet …');
      try { for (const f of files) doc.pages.push(await processImage(f, enhance)); doc.updatedAt = Date.now(); await db.put('docs', doc); } finally { busy(false); }
      render();
    } else if (a === 'docMenu') {
      const r = await dialog(`<h2>${esc(doc.title)}</h2>
        <div class="dlg-actions column">
          <button type="button" data-value="move" class="btn">In anderen Ordner verschieben</button>
          <button type="button" data-value="delete" class="btn danger">Dokument löschen</button>
          <button type="button" data-value="cancel" class="btn ghost">Abbrechen</button></div>`);
      if (r === 'move') {
        const f = await chooseFolder(year, 'Verschieben nach …');
        if (f) { doc.folderId = f.id; doc.updatedAt = Date.now(); await db.put('docs', doc); location.hash = `#/f/${f.id}`; }
      } else if (r === 'delete') {
        if (await confirmDlg('Dokument löschen?', 'Das Dokument mit allen Seiten wird unwiderruflich gelöscht.')) {
          await deleteDoc(doc.id);
          location.hash = `#/f/${doc.folderId}`;
        }
      }
    }
  };
  view().onclick = handler;
  $('#headerRight').onclick = handler;
}

async function renderSettings() {
  const year = await currentYear();
  const years = (await db.getAll('years')).map((y) => y.year).sort((a, b) => b - a);
  const enhance = await getSetting('enhance', true);
  let storage = '';
  if (navigator.storage && navigator.storage.estimate) {
    const e = await navigator.storage.estimate();
    storage = `Belegt: ${fmtBytes(e.usage || 0)} von ca. ${fmtBytes(e.quota || 0)}`;
  }
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const sync = await changesSinceSync();
  setHeader('Einstellungen', { back: '#/' });
  view().innerHTML = `
    <section class="settings">
      <h3>Scan</h3>
      <label class="check"><input type="checkbox" id="enhance" ${enhance ? 'checked' : ''}> Dokument-Modus (Schwarzweiss, mehr Kontrast, kleinere Dateien)</label>

      <h3>Steuerjahre</h3>
      <ul class="plain">${years.map((y) => `<li><span>Steuerjahr ${y}${y === year ? ' (aktiv)' : ''}</span><button class="iconbtn danger" data-action="delYear" data-year="${y}" title="Steuerjahr löschen">✕</button></li>`).join('')}</ul>
      <div class="row">
        <button class="btn" data-action="newYear">＋ Steuerjahr anlegen</button>
        <button class="btn" data-action="restoreDefaults">Fehlende Standardordner ergänzen (${year})</button>
      </div>

      <h3>Export für die Steuererklärung</h3>
      <p>Die Online-Steuererklärung von Appenzell Ausserrhoden («Steuern AR Online», über <a href="https://mein.ar.ch" target="_blank" rel="noopener">mein.ar.ch</a>) nimmt Beilagen als Dateien entgegen. Erstelle hier das Upload-Paket (ZIP mit einem PDF pro Beleg), entpacke es am Computer und lade die PDFs bei den jeweiligen Positionen hoch. Markiere danach die Dokumente in der App als «hochgeladen».</p>
      <div class="row">
        <button class="btn primary" data-action="exportOpen">⤓ Upload-Paket ${year} (offene)</button>
        <button class="btn" data-action="exportAll">⤓ Upload-Paket ${year} (alle)</button>
      </div>

      <h3>Abgleich zwischen Geräten (iCloud Drive)</h3>
      <p>Die App speichert alles nur auf diesem Gerät. Für Handy und Computer dient eine <strong>Sync-Datei</strong> in iCloud Drive (oder einem anderen Ordner der Dateien-App) als gemeinsamer Speicher. Beim Einlesen werden die Daten zusammengeführt: Neueres gewinnt, Löschungen werden übernommen, nichts wird doppelt angelegt.</p>
      <ol class="steps">
        <li><strong>Sync-Datei speichern</strong> → im Teilen-Menü «In Dateien sichern» → iCloud Drive → vorhandene Datei ersetzen.</li>
        <li>Auf dem anderen Gerät <strong>Sync-Datei einlesen</strong> und dieselbe Datei auswählen.</li>
        <li>Dort weiterarbeiten und am Schluss wieder <strong>Sync-Datei speichern</strong>.</li>
      </ol>
      <div class="row">
        <button class="btn primary" data-action="syncSave">⇪ Sync-Datei speichern</button>
        <button class="btn" data-action="syncLoad">⤒ Sync-Datei einlesen</button>
      </div>
      <p class="muted">${sync ? `Letzter Abgleich: ${new Date(sync.last).toLocaleString('de-CH')}${sync.n ? ` · ${sync.n} Änderung(en) seither` : ''}` : 'Noch kein Abgleich durchgeführt.'} Die Sync-Datei ist zugleich dein Backup.</p>
      <p class="muted">${esc(storage)}${persisted ? ' · Speicher ist dauerhaft geschützt' : ''}</p>
      ${!persisted && navigator.storage && navigator.storage.persist ? '<button class="btn" data-action="persist">Speicher dauerhaft schützen</button>' : ''}

      <h3>Datenschutz</h3>
      <p class="muted">Diese App sendet keine Daten an einen Server. Scans, Ordner und Notizen bleiben lokal auf dem Gerät (IndexedDB). Beim Teilen eines PDFs entscheidest du selbst, wohin es geht.</p>
      <p class="muted">Version ${APP_VERSION}</p>
    </section>`;

  $('#enhance').onchange = (e) => setSetting('enhance', e.target.checked);
  view().onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'newYear') {
      const y = await promptDlg('Neues Steuerjahr', 'Jahr (z. B. 2025)', String(year + 1), 'Anlegen');
      if (!y || !/^\d{4}$/.test(y)) return;
      await ensureYear(Number(y));
      await setSetting('year', Number(y));
      render();
    } else if (a === 'delYear') {
      const y = Number(btn.dataset.year);
      const docs = await db.getAllBy('docs', 'year', y);
      if (!(await confirmDlg(`Steuerjahr ${y} löschen?`, `Alle Ordner und ${docs.length} Dokument(e) dieses Jahres werden unwiderruflich gelöscht.`))) return;
      await markDeleted(docs.map((d) => d.id));
      for (const d of docs) await db.del('docs', d.id);
      for (const f of await db.getAllBy('folders', 'year', y)) await db.del('folders', f.id);
      await db.del('years', y);
      if (y === year) { const rest = years.filter((x) => x !== y); await setSetting('year', rest[0] || new Date().getFullYear()); }
      render();
    } else if (a === 'restoreDefaults') {
      const n = await createDefaultFolders(year, true);
      toast(n ? `${n} Standardordner ergänzt.` : 'Alle Standardordner sind vorhanden.');
    } else if (a === 'exportOpen') await exportYearZip(year, true);
    else if (a === 'exportAll') await exportYearZip(year, false);
    else if (a === 'syncSave') await saveSyncFile(true);
    else if (a === 'syncLoad') {
      const input = $('#zipInput');
      input.value = '';
      input.onchange = async () => {
        if (!input.files[0]) return;
        try { await mergeSyncFile(input.files[0]); render(); } catch (err) { toast('Fehler: ' + err.message, 5000); }
      };
      input.click();
    } else if (a === 'persist') {
      const ok = await navigator.storage.persist();
      toast(ok ? 'Speicher ist jetzt dauerhaft geschützt.' : 'Der Browser hat die Anfrage abgelehnt.');
      render();
    }
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const APP_VERSION = '1.1.0';
async function render() {
  revokeUrls();
  $('#headerRight').onclick = null;
  const hash = location.hash.slice(1) || '/';
  const [path, query = ''] = hash.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  try {
    if (parts[0] === 'f' && parts[1]) await renderFolder(parts[1]);
    else if (parts[0] === 'd' && parts[1]) await renderDoc(parts[1], params);
    else if (parts[0] === 'settings') await renderSettings();
    else await renderHome();
  } catch (err) {
    console.error(err);
    view().innerHTML = `<div class="empty"><p>Fehler: ${esc(err.message)}</p><a class="btn" href="#/">Zur Startseite</a></div>`;
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
$('#backBtn').addEventListener('click', () => { location.hash = $('#backBtn').dataset.href || '#/'; });
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
