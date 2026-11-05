import { db } from './db.js';
import { makePdf } from './pdfwriter.js';
import { ZipWriter, readZip } from './zip.js';
import { scanPages, reviewFiles } from './scanner.js';

// ---------------------------------------------------------------------------
// Standardordner: orientiert an den Beilagen der Steuererklärung AR (natürliche Personen)
// ---------------------------------------------------------------------------
export const DEFAULT_FOLDERS = [
  { key: 'einkommen', short: 'Lohnausweis, Rente, Taggelder', examples: ['Lohnausweis', 'AHV-Rente', 'Pensionskassenrente', 'Taggeld-Abrechnung'], name: 'Lohn & Einkommen', icon: '💼', hint: 'Lohnausweis(e), AHV/IV-Rente, Pensionskassen-Rente, Taggelder (ALV, Krankentaggeld, Unfall), Erwerbsausfallentschädigung, Nebenerwerb' },
  { key: 'wertschriften', short: 'Konto, Sparen, Wertschriften', examples: ['Kontoauszug 31.12.', 'Zinsbescheinigung', 'Steuerauszug Depot'], name: 'Bank & Wertschriften', icon: '🏦', hint: 'Zins- und Saldobescheinigungen per 31.12., Steuerauszug Depot, Verrechnungssteuer, Kryptowährungen, Bargeld, Lotteriegewinne' },
  { key: 'berufsauslagen', short: 'ÖV-Abo, Weiterbildung, Berufskleider', examples: ['ÖV-Abo', 'Weiterbildung', 'Berufskleider'], name: 'Berufsauslagen', icon: '🚆', hint: 'ÖV-Abo / Fahrkosten, Mehrkosten Verpflegung, Weiterbildung, Berufskleider und Werkzeuge, Homeoffice, Wochenaufenthalt' },
  { key: 'vorsorge', short: 'Säule 3a, Pensionskasse', examples: ['Säule 3a Bescheinigung', 'Einkauf Pensionskasse'], name: 'Säule 3a & Pensionskasse', icon: '🛡️', hint: 'Bescheinigung Säule 3a, Einkauf Pensionskasse, Lebens- und Rentenversicherungen (Rückkaufswert), freiwillige AHV-Beiträge' },
  { key: 'krankenkasse', short: 'Prämien, Arzt, Zahnarzt', examples: ['Prämienübersicht', 'Arztrechnung', 'Zahnarztrechnung'], name: 'Krankenkasse & Gesundheit', icon: '🏥', hint: 'Prämienübersicht Krankenkasse, Prämienverbilligung, Arzt-, Zahnarzt- und Spitalrechnungen, Selbstbehalt/Franchise, Brille, behinderungsbedingte Kosten' },
  { key: 'liegenschaft', short: 'Hypothek, Nebenkosten, Unterhalt', examples: ['Hypothekarzins', 'Nebenkostenabrechnung', 'Unterhaltsrechnung'], name: 'Liegenschaft & Wohnen', icon: '🏠', hint: 'Hypothekarzins-Bescheinigung, Unterhalts- und Renovationsrechnungen, Nebenkostenabrechnung, Eigenmietwert, Gebäudeversicherung, Mietvertrag' },
  { key: 'schulden', short: 'Kredit, Zinsen', examples: ['Kreditzinsen', 'Schuldzinsbescheinigung'], name: 'Schulden & Schuldzinsen', icon: '💳', hint: 'Privatkredit, Kreditkartenzinsen, Darlehen, Schuldzinsbescheinigungen per 31.12.' },
  { key: 'familie', short: 'Kita, Alimente, Ausbildung der Kinder', examples: ['Kita-Rechnung', 'Alimente', 'Ausbildungskosten'], name: 'Kinder & Familie', icon: '👨‍👩‍👧', hint: 'Fremdbetreuung (Kita, Tagesfamilie, Hort), erhaltene und bezahlte Alimente, Ausbildungskosten der Kinder, Unterstützungsbeiträge' },
  { key: 'spenden', short: 'Spenden, Mitgliederbeiträge', examples: ['Spendenbescheinigung', 'Mitgliederbeitrag'], name: 'Spenden & Beiträge', icon: '🎁', hint: 'Spendenbescheinigungen (gemeinnützige Organisationen), Parteibeiträge, Beiträge Berufsverband / Gewerkschaft' },
  { key: 'steuern', short: 'Veranlagung, Steuerrechnung', examples: ['Veranlagung Vorjahr', 'Steuerrechnung'], name: 'Steuern & Behörden', icon: '🏛️', hint: 'Veranlagungsverfügung Vorjahr, Steuerrechnungen, Steuererklärung Vorjahr, Quellensteuer, Korrespondenz mit dem Steueramt' },
  { key: 'sonstiges', short: 'Alles andere', examples: [], name: 'Sonstiges', icon: '📁', hint: 'Alles, was in keinen anderen Ordner passt (z. B. Erbschaft, Schenkung, Auslandkonten, Weiteres)' },
];

const DEFAULT_BY_KEY = Object.fromEntries(DEFAULT_FOLDERS.map((f) => [f.key, f]));
const shortOf = (f) => (DEFAULT_BY_KEY[f.builtin] && DEFAULT_BY_KEY[f.builtin].short) || (f.hint ? f.hint.slice(0, 48) : '');
const examplesOf = (f) => (DEFAULT_BY_KEY[f.builtin] && DEFAULT_BY_KEY[f.builtin].examples) || [];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const STORAGES = {
  local: { icon: '👤', label: 'Nur ich', short: 'Nur dieses Handy', text: 'Die Belege liegen nur auf diesem Handy. Ich sichere sie ab und zu selbst.' },
  icloud: { icon: '☁️', label: 'Familie mit iCloud Drive', short: 'Familie über iCloud Drive', text: 'Alle teilen einen Ordner in iCloud Drive.' },
  gdrive: { icon: '📁', label: 'Familie mit Google Drive', short: 'Familie über Google Drive', text: 'Alle teilen einen Ordner in Google Drive. Geht auch mit Android.' },
};

function storageOptionsHtml(sel) {
  return `<div class="opts">${Object.entries(STORAGES).map(([k, st]) => `
    <button type="button" class="opt ${sel === k ? 'on' : ''}" data-action="pickStorage" data-s="${k}">
      <span class="opt-i">${st.icon}</span>
      <span class="opt-t"><strong>${st.label}</strong><small>${st.text}</small></span>
      <span class="opt-c">${sel === k ? '✓' : ''}</span>
    </button>`).join('')}</div>`;
}

function storageGuideHtml(kind) {
  if (kind === 'icloud') {
    return `<p><strong>So richtet ihr den gemeinsamen Ordner ein:</strong></p>
      <ol class="steps">
        <li><strong>Einmalig, eine Person:</strong> In der Dateien-App in <em>iCloud Drive</em> einen Ordner «Steuer» anlegen, gedrückt halten, «Teilen», «Zusammenarbeiten» und die Familie einladen (Bearbeiten erlauben).</li>
        <li><strong>Jede Person:</strong> Unter Einstellungen auf <em>Meine Datei speichern</em> tippen, «In Dateien sichern» wählen und den Ordner «Steuer» in iCloud Drive auswählen.</li>
        <li><strong>Zum Abgleich:</strong> <em>Dateien einlesen</em> tippen und im Ordner «Steuer» alle Dateien markieren.</li>
      </ol>`;
  }
  if (kind === 'gdrive') {
    return `<p><strong>So richtet ihr den gemeinsamen Ordner ein:</strong></p>
      <ol class="steps">
        <li><strong>Jede Person:</strong> Google-Drive-App installieren und in der Dateien-App unter «…», «Bearbeiten» den Eintrag «Drive» einschalten.</li>
        <li><strong>Einmalig, eine Person:</strong> In Google Drive einen Ordner «Steuer» anlegen und mit den Google-Konten der Familie teilen (Bearbeiter).</li>
        <li><strong>Jede Person:</strong> Unter Einstellungen auf <em>Meine Datei speichern</em> tippen, «In Dateien sichern» wählen und den Ordner «Steuer» in Drive auswählen.</li>
        <li><strong>Zum Abgleich:</strong> <em>Dateien einlesen</em> tippen und im Ordner «Steuer» alle Dateien markieren.</li>
      </ol>`;
  }
  return `<p>Deine Belege liegen auf diesem Handy. Damit nichts verloren geht, speichere ab und zu eine <strong>Sicherung</strong>:</p>
    <ol class="steps">
      <li>Unter Einstellungen auf <em>Meine Datei speichern</em> tippen.</li>
      <li>«In Dateien sichern» wählen und die Datei an einem sicheren Ort ablegen, zum Beispiel in iCloud Drive.</li>
    </ol>`;
}

const $ = (s, r = document) => r.querySelector(s);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (ts) => new Date(ts).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtBytes = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB');
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

const syncFileName = (name) => (name ? `Steuerordner_Sync_${slug(name)}.zip` : 'Steuerordner_Sync.zip');

// Name der Person an diesem Gerät (Haushalt): wird bei neuen Dokumenten gespeichert und im Dateinamen verwendet.
async function ensureUserName() {
  let n = await getSetting('userName', '');
  if (!n) {
    n = await promptDlg('Dein Name', 'Damit der Haushalt sieht, wer etwas abgelegt hat (z. B. Anna)', '', 'Speichern');
    if (n) await setSetting('userName', n);
  }
  return n || '';
}

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
  const user = await ensureUserName();
  const fname = syncFileName(user);
  busy(true, 'Sync-Datei wird erstellt …');
  try {
    const blob = await buildSyncZip();
    if (share) await shareOrDownload(blob, fname, 'Steuerordner Sync-Datei'); else download(blob, fname);
    await setSetting('lastSync', Date.now());
    toast(`Datei «${fname}» erstellt. Im geteilten Ordner ablegen und die alte Datei ersetzen.`, 4500);
  } finally { busy(false); }
}

// Sync-Datei einlesen und mit dem lokalen Bestand zusammenführen:
// - Dokumente: gleiche ID → neuere Version gewinnt; Löschungen werden übernommen
// - Ordner: Standardordner über ihre feste ID, eigene Ordner über Jahr + Name (keine Duplikate)
async function mergeSyncFiles(files) {
  busy(true, 'Dateien werden eingelesen …');
  const total = { added: 0, updated: 0, deleted: 0, folders: 0 };
  try {
    for (const file of files) {
      const st = await mergeSyncFile(file);
      for (const k of Object.keys(total)) total[k] += st[k];
    }
    await setSetting('lastSync', Date.now());
    toast(`Abgleich fertig (${files.length} Datei${files.length === 1 ? '' : 'en'}): ${total.added} neu, ${total.updated} aktualisiert, ${total.deleted} gelöscht${total.folders ? `, ${total.folders} Ordner` : ''}.`, 5000);
  } finally { busy(false); }
}

async function mergeSyncFile(file) {
  {
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
    return stats;
  }
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
async function getScanMode() {
  const m = await getSetting('scanMode');
  if (m) return m;
  return (await getSetting('enhance', true)) ? 'doc' : 'orig';
}

const isImage = (f) => f.type.startsWith('image/');
const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

// Seiten per Live-Scanner aufnehmen. Ohne Kamerazugriff wird die Foto-Aufnahme des Geräts verwendet.
// Ergebnis: Seitenliste oder null (abgebrochen).
async function maybeScanTip() {
  if (await getSetting('scanTipSeen')) return true;
  const r = await dialog(`<h2>So gelingt der Scan</h2>
    <ol class="bigsteps">
      <li>Lege das Blatt flach auf einen <strong>dunklen Tisch</strong>.</li>
      <li>Halte das Handy ruhig. Das <strong>ganze Blatt</strong> muss im Bild sein.</li>
      <li>Die App löst <strong>von selbst</strong> aus, sobald der Rahmen grün ist.</li>
      <li>Prüfe den Rahmen und tippe auf <strong>Übernehmen</strong>.</li>
    </ol>
    <div class="dlg-actions column">
      <button type="button" data-value="go" class="btn primary">Verstanden, Kamera öffnen</button>
      <button type="button" data-value="cancel" class="btn ghost">Abbrechen</button>
    </div>`);
  if (r !== 'go') return false;
  await setSetting('scanTipSeen', true);
  return true;
}

async function collectCameraPages() {
  if (!(await maybeScanTip())) return null;
  const mode = await getScanMode();
  const res = await scanPages({ mode, auto: await getSetting('autoCapture', true), onAuto: (v) => setSetting('autoCapture', v) });
  if (res !== 'unavailable') return res;
  toast('Kamera nicht verfügbar. Das Foto wird über die Kamera-App aufgenommen.', 3500);
  const files = (await pickFiles({ camera: true })).filter(isImage);
  return files.length ? reviewFiles(files, { mode }) : null;
}

async function collectPhotoPages(files) {
  const imgs = files.filter(isImage);
  return imgs.length ? reviewFiles(imgs, { mode: await getScanMode() }) : null;
}

async function addDocuments(folder, year, pages, pdfs) {
  const created = [];
  const author = await getSetting('userName', '');
  busy(true, 'Wird abgelegt …');
  try {
    if (pages && pages.length) {
      const doc = { id: uid(), folderId: folder.id, year, title: `Beleg vom ${fmtDate(Date.now())}`, kind: 'images', pages, note: '', author, uploaded: false, createdAt: Date.now(), updatedAt: Date.now() };
      await db.put('docs', doc);
      created.push(doc);
    }
    for (const f of pdfs) {
      const doc = { id: uid(), folderId: folder.id, year, title: f.name.replace(/\.pdf$/i, ''), kind: 'pdf', file: new Blob([await f.arrayBuffer()], { type: 'application/pdf' }), note: '', author, uploaded: false, createdAt: Date.now(), updatedAt: Date.now() };
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

async function chooseFolder(year, title = 'Wohin gehört der Beleg?') {
  const folders = await foldersOf(year);
  const r = await dialog(`<h2>${esc(title)}</h2>
    <p>Tippe auf den passenden Ordner.</p>
    <div class="dlg-actions column folderpick">
      ${folders.map((f) => `<button type="button" data-value="${f.id}" class="btn pick"><span class="pk-i">${esc(f.icon || '📁')}</span><span class="pk-t"><strong>${esc(f.name)}</strong><small>${esc(shortOf(f))}</small></span></button>`).join('')}
    </div>
    <div class="dlg-actions column"><button type="button" data-value="cancel" class="btn ghost">Abbrechen</button></div>`);
  if (!r || r === 'cancel') return null;
  return folders.find((f) => f.id === r) || null;
}

async function scanInto(folder, year, camera) {
  let pages = null, pdfs = [];
  if (camera) {
    pages = await collectCameraPages();
    if (!pages) return;
  } else {
    const files = await pickFiles({ camera: false });
    if (!files.length) return;
    pdfs = files.filter(isPdf);
    if (files.length - files.filter(isImage).length - pdfs.length) toast('Nur Bilder und PDF-Dateien werden unterstützt.');
    pages = await collectPhotoPages(files);
    if (!pages && !pdfs.length) return;
  }
  const created = await addDocuments(folder, year, pages, pdfs);
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
  for (const d of docs) countBy[d.folderId] = (countBy[d.folderId] || 0) + 1;
  const uploaded = docs.filter((d) => d.uploaded).length;
  const first = docs.length === 0;
  const allUp = docs.length > 0 && uploaded === docs.length;
  const sync = await changesSinceSync();
  const storage = await getSetting('storage', '');
  setHeader('Steuerordner', { right: `<a class="iconbtn" href="#/help" title="Hilfe" aria-label="Hilfe">?</a><a class="iconbtn" href="#/settings" title="Einstellungen" aria-label="Einstellungen">⚙︎</a>` });
  view().innerHTML = `
    <section class="stepcard">
      <label class="yearsel">Steuerjahr
        <select id="yearSelect">${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}<option value="__new">+ Anderes Jahr anlegen …</option></select>
      </label>
      <p class="muted small">Das Jahr, für das du die Steuererklärung ausfüllst.</p>
      <a class="storeline" href="#/settings">📍 Speicherort: ${storage ? esc(STORAGES[storage].short) : 'noch nicht festgelegt, hier tippen'} ›</a>
      <ol class="stepper">
        <li class="${first ? 'now' : 'done'}"><b>${first ? '1' : '✓'}</b><span>Belege sammeln<small>${plural(docs.length, 'Beleg', 'Belege')} gesammelt</small></span></li>
        <li class="${allUp ? 'done' : (first ? '' : 'now')}"><b>${allUp ? '✓' : '2'}</b><span>Belege hochladen<small>${uploaded} von ${docs.length} hochgeladen</small></span></li>
      </ol>
    </section>
    ${first ? `<section class="tipcard"><strong>So fängst du an</strong><ol>
      <li>Tippe unten auf <b>Beleg scannen</b>.</li>
      <li>Wähle den passenden Ordner, zum Beispiel <b>Lohn &amp; Einkommen</b> für deinen Lohnausweis.</li>
      <li>Lege das Blatt auf einen dunklen Tisch. Die App macht das Foto von selbst.</li></ol></section>` : ''}
    <h2 class="sectitle">Deine Ordner</h2>
    <section class="grid">
      ${folders.map((f) => `
        <a class="card" href="#/f/${f.id}">
          <div class="card-icon">${esc(f.icon || '📁')}</div>
          <div class="card-name">${esc(f.name)}</div>
          <div class="card-short">${esc(shortOf(f))}</div>
          <div class="card-count">${countBy[f.id] ? plural(countBy[f.id], 'Beleg', 'Belege') : 'noch leer'}</div>
        </a>`).join('')}
      <button class="card card-add" data-action="newFolder"><div class="card-icon">＋</div><div class="card-name">Eigener Ordner</div></button>
    </section>
    <button class="linkbtn" data-action="quickPick">🖼️ Belege aus Fotos oder Dateien hinzufügen</button>
    ${sync ? `<a class="syncline ${sync.n ? 'pending' : ''}" href="#/settings">Letzter Abgleich mit der Familie: ${fmtDate(sync.last)}${sync.n ? ` · ${sync.n} Änderung${sync.n === 1 ? '' : 'en'} noch nicht abgeglichen` : ''} ›</a>` : ''}
    <nav class="bottombar">
      <button class="btn primary big wide" data-action="quickScan">📷 Beleg scannen</button>
      <a class="btn big" href="#/upload">📤 Hochladen</a>
    </nav>`;

  $('#yearSelect').onchange = async (e) => {
    const v = e.target.value;
    if (v === '__new') {
      const y = await promptDlg('Anderes Steuerjahr', 'Jahr (z. B. 2025)', String(year + 1), 'Anlegen');
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
      const name = await promptDlg('Eigener Ordner', 'Wie soll der Ordner heissen?', '', 'Anlegen');
      if (!name) return;
      await db.put('folders', { id: uid(), year, name, icon: '📁', hint: '', order: folders.length + 1, createdAt: Date.now() });
      render();
    } else if (a === 'quickScan' || a === 'quickPick') {
      const f = await chooseFolder(year);
      if (f) await scanInto(f, year, a === 'quickScan');
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
    ${folder.hint ? `<details class="hintbox" ${docs.length ? '' : 'open'}><summary>Was gehört in diesen Ordner?</summary><p>${esc(folder.hint)}</p></details>` : ''}
    ${docs.length ? `<ul class="doclist">${docs.map((d) => `
      <li><a href="#/d/${d.id}">
        <div class="thumb">${d.kind === 'pdf' ? '<span class="pdfbadge">PDF</span>' : (d.pages[0] ? `<img src="${blobUrl(d.pages[0].blob)}" alt="">` : '')}</div>
        <div class="docmeta">
          <div class="doctitle">${esc(d.title)}</div>
          <div class="docsub">${fmtDate(d.createdAt)} · ${d.kind === 'pdf' ? 'PDF' : d.pages.length + ' Seite' + (d.pages.length === 1 ? '' : 'n')} · ${fmtBytes(docSize(d))}${d.author ? ' · von ' + esc(d.author) : ''}${d.note ? ' · ' + esc(d.note) : ''}</div>
        </div>
        <div class="status ${d.uploaded ? 'ok' : ''}" title="${d.uploaded ? 'hochgeladen' : 'noch nicht hochgeladen'}">${d.uploaded ? '✓' : '○'}</div>
      </a></li>`).join('')}</ul>`
      : `<div class="empty"><div class="empty-icon">${esc(folder.icon || '📁')}</div><p>Hier ist noch nichts.<br>Tippe auf <strong>Beleg scannen</strong>${examplesOf(folder)[0] ? `, zum Beispiel für «${esc(examplesOf(folder)[0])}»` : ''}.</p></div>`}
    <nav class="bottombar">
      <button class="btn primary big wide" data-action="scan">📷 Beleg scannen</button>
      <button class="btn big" data-action="pick">🖼️ Aus Fotos</button>
    </nav>`;

  const handler = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'scan') await scanInto(folder, year, true);
    else if (a === 'pick') await scanInto(folder, year, false);
    else if (a === 'folderMenu') {
      const r = await dialog(`<h2>${esc(folder.name)}</h2>
        <div class="dlg-actions column">
          <button type="button" data-value="rename" class="btn">Umbenennen</button>
          <button type="button" data-value="hint" class="btn">Hinweistext bearbeiten</button>
          <button type="button" data-value="icon" class="btn">Symbol ändern</button>
          <button type="button" data-value="zip" class="btn">Alle Belege als ZIP-Datei speichern</button>
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
      } else if (r === 'zip') {
        await exportFolderZip(year, folder);
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
    ${params.get('new') ? '<div class="coach"><strong>Beleg gespeichert.</strong> Gib ihm jetzt einen Namen, damit du ihn später findest.</div>' : ''}
    <section class="docform">
      <label>Name des Belegs<input type="text" id="docTitle" value="${esc(doc.title)}" maxlength="100" placeholder="z. B. Lohnausweis"></label>
      ${folder && examplesOf(folder).length ? `<div><p class="fieldhint">Oder tippe auf einen Vorschlag:</p><div class="chips">${examplesOf(folder).map((t) => `<button type="button" class="chip" data-action="chip" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>` : ''}
      <label>Notiz (kannst du leer lassen)<input type="text" id="docNote" value="${esc(doc.note || '')}" maxlength="200" placeholder="z. B. Betrag CHF 1'234.50"></label>
      <label class="check"><input type="checkbox" id="docUploaded" ${doc.uploaded ? 'checked' : ''}> Ich habe diesen Beleg in der Online-Steuererklärung hochgeladen${doc.uploadedAt ? ` <small>(${fmtDate(doc.uploadedAt)})</small>` : ''}</label>
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
        <button class="btn" data-action="addPageCam">📷 Weitere Seite scannen</button>
        <button class="btn" data-action="addPagePick">🖼️ Seite aus Fotos</button>
      </div></section>`
      : `<section class="pdfinfo"><span class="pdfbadge big">PDF</span><p>${esc(doc.title)}.pdf · ${fmtBytes(docSize(doc))}</p><button class="btn" data-action="openPdf">PDF anzeigen</button></section>`}
    <nav class="bottombar">
      <button class="btn primary big wide" data-action="share">📤 PDF teilen oder speichern</button>
      <button class="btn big" data-action="download">⤓ PDF laden</button>
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
    if (a === 'chip') {
      $('#docTitle').value = btn.dataset.t;
      doc.title = btn.dataset.t;
      doc.updatedAt = Date.now();
      await db.put('docs', doc);
      toast('Name gespeichert.');
    } else if (a === 'share' || a === 'download') {
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
      const pages = a === 'addPageCam' ? await collectCameraPages() : await collectPhotoPages(await pickFiles({ camera: false }));
      if (!pages || !pages.length) return;
      doc.pages.push(...pages);
      doc.updatedAt = Date.now();
      await db.put('docs', doc);
      render();
    } else if (a === 'docMenu') {
      const r = await dialog(`<h2>${esc(doc.title)}</h2>
        <div class="dlg-actions column">
          <button type="button" data-value="move" class="btn">In anderen Ordner verschieben</button>
          <button type="button" data-value="delete" class="btn danger">Dokument löschen</button>
          <button type="button" data-value="cancel" class="btn ghost">Abbrechen</button></div>`);
      if (r === 'move') {
        const f = await chooseFolder(year, 'Wohin soll der Beleg?');
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
  const scanMode = await getScanMode();
  const autoCap = await getSetting('autoCapture', true);
  const userName = await getSetting('userName', '');
  const storage = await getSetting('storage', '');
  let storageInfo = '';
  if (navigator.storage && navigator.storage.estimate) {
    const e = await navigator.storage.estimate();
    storageInfo = `Belegt: ${fmtBytes(e.usage || 0)} von ca. ${fmtBytes(e.quota || 0)}`;
  }
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const sync = await changesSinceSync();
  setHeader('Einstellungen', { back: '#/' });
  view().innerHTML = `
    <section class="settings">
      <h3>Ich</h3>
      <label class="setrow">Mein Name
        <input type="text" id="userName" value="${esc(userName)}" maxlength="30" placeholder="z. B. Anna">
        <span class="fieldhint">Er wird bei neuen Belegen vermerkt, damit die Familie sieht, wer sie abgelegt hat.</span>
      </label>

      <h3>Scannen</h3>
      <label class="setrow">So sehen die Scans aus
        <select id="scanMode">
          <option value="doc" ${scanMode === 'doc' ? 'selected' : ''}>Dokument: Schwarzweiss, ohne Schatten (empfohlen)</option>
          <option value="color" ${scanMode === 'color' ? 'selected' : ''}>Farbe: ohne Schatten</option>
          <option value="orig" ${scanMode === 'orig' ? 'selected' : ''}>Original: nur zuschneiden</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" id="autoCap" ${autoCap ? 'checked' : ''}> Foto automatisch auslösen, sobald das Blatt erkannt ist</label>

      <h3>Belege hochladen</h3>
      <p>Hier überträgst du deine Belege in die Online-Steuererklärung. Die App führt dich Schritt für Schritt.</p>
      <a class="btn primary" href="#/upload">📤 Zum Hochladen</a>

      <h3>Steuerjahre</h3>
      <ul class="plain">${years.map((y) => `<li><span>Steuerjahr ${y}${y === year ? ' (aktiv)' : ''}</span><button class="iconbtn danger" data-action="delYear" data-year="${y}" title="Steuerjahr löschen">✕</button></li>`).join('')}</ul>
      <div class="row">
        <button class="btn" data-action="newYear">＋ Steuerjahr anlegen</button>
        <button class="btn" data-action="restoreDefaults">Fehlende Standardordner ergänzen (${year})</button>
      </div>

      <h3>Speicherort und Familie</h3>
      <p>Deine Belege liegen immer <strong>auf diesem Handy</strong>, in der App. Hier legst du fest, wie du sie sicherst und ob du sie mit der Familie teilst.</p>
      ${storageOptionsHtml(storage)}
      ${storage ? `<div class="guide">${storageGuideHtml(storage)}</div>` : '<p class="muted">Wähle oben deinen Speicherort.</p>'}
      <div class="row">
        <button class="btn primary" data-action="syncSave">⇪ Meine Datei speichern</button>
        <button class="btn" data-action="syncLoad">⤒ ${storage === 'local' || !storage ? 'Sicherung einlesen' : 'Dateien einlesen'}</button>
      </div>
      <p class="muted">${sync ? `Letzter Abgleich: ${new Date(sync.last).toLocaleString('de-CH')}${sync.n ? ` · ${sync.n} Änderung(en) seither` : ''}` : 'Noch kein Abgleich durchgeführt.'} Die Datei ist zugleich deine Sicherung.</p>

      <h3>Hilfe</h3>
      <div class="row">
        <a class="btn" href="#/help">Hilfe ansehen</a>
        <button class="btn" data-action="again">Einführung nochmals ansehen</button>
      </div>

      <h3>Sicherheit deiner Daten</h3>
      <p class="muted">Diese App sendet keine Daten ins Internet. Scans, Ordner und Notizen bleiben auf diesem Gerät. Beim Teilen eines PDFs entscheidest du selbst, wohin es geht.</p>
      <p class="muted">${esc(storageInfo)}${persisted ? ' · Speicher ist dauerhaft geschützt' : ''}</p>
      ${!persisted && navigator.storage && navigator.storage.persist ? '<button class="btn" data-action="persist">Speicher dauerhaft schützen</button>' : ''}
      <p class="muted">Version ${APP_VERSION}</p>
    </section>`;

  $('#scanMode').onchange = (e) => setSetting('scanMode', e.target.value);
  $('#autoCap').onchange = (e) => setSetting('autoCapture', e.target.checked);
  $('#userName').onchange = (e) => setSetting('userName', e.target.value.trim());
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
    } else if (a === 'pickStorage') {
      await setSetting('storage', btn.dataset.s);
      render();
    } else if (a === 'again') {
      welcome = {};
      location.hash = '#/welcome?again=1';
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
        try { await mergeSyncFiles([...input.files]); render(); } catch (err) { toast('Fehler: ' + err.message, 5000); }
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
// Einführung (erster Start), Hilfe, Hochladen
// ---------------------------------------------------------------------------
let welcome = {};

async function renderWelcome(params) {
  if (!welcome.init) {
    const d = new Date();
    welcome = {
      init: true, step: 0,
      name: await getSetting('userName', ''),
      storage: await getSetting('storage', 'local'),
      year: (await getSetting('year')) || (d.getMonth() < 6 ? d.getFullYear() - 1 : d.getFullYear()),
      again: !!params.get('again'),
    };
  }
  const w = welcome;
  const thisYear = new Date().getFullYear();
  setHeader('Willkommen', {});
  const dots = [0, 1, 2, 3].map((i) => `<span class="dot ${i === w.step ? 'on' : ''}"></span>`).join('');
  let body = '';
  if (w.step === 0) {
    body = `
      <div class="bigicon">🗂️</div>
      <h2>Willkommen bei Steuerordner</h2>
      <p class="lead">Hier sammelst du alle Belege für deine Steuererklärung. Du brauchst dafür nur dein Handy.</p>
      <ul class="points">
        <li><b class="n">1</b><span><strong>Beleg fotografieren.</strong> Die App schneidet das Blatt automatisch zu.</span></li>
        <li><b class="n">2</b><span><strong>Ordner wählen.</strong> Zum Beispiel «Lohn» oder «Krankenkasse».</span></li>
        <li><b class="n">3</b><span><strong>Hochladen.</strong> Die App hilft dir, die Belege in die Online-Steuererklärung zu übertragen.</span></li>
      </ul>
      <p class="muted small">Deine Belege liegen auf deinem Handy, in dieser App. Wenn du möchtest, teilst du sie mit der Familie. Das legst du gleich fest.</p>
      <div class="actions"><button class="btn primary huge" data-action="next">Los geht's</button></div>
      ${w.again ? '' : '<button class="skip" data-action="skip">Einführung überspringen</button>'}`;
  } else if (w.step === 1) {
    body = `
      <div class="bigicon">✏️</div>
      <h2>Zwei kurze Angaben</h2>
      <div class="form">
        <label>Für welches Steuerjahr sammelst du Belege?
          <select id="wYear">${[thisYear - 2, thisYear - 1, thisYear].map((y) => `<option value="${y}" ${Number(w.year) === y ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <span class="fieldhint">Das Jahr, für das du die Steuererklärung ausfüllst. Du kannst das später ändern.</span>
        </label>
        <label>Wie heisst du? (kannst du leer lassen)
          <input type="text" id="wName" value="${esc(w.name)}" maxlength="30" placeholder="z. B. Anna">
          <span class="fieldhint">Praktisch, wenn mehrere Personen zusammen Belege sammeln.</span>
        </label>
      </div>
      <div class="actions"><button class="btn" data-action="back">Zurück</button><button class="btn primary" data-action="next">Weiter</button></div>`;
  } else if (w.step === 2) {
    body = `
      <div class="bigicon">📍</div>
      <h2>Wo liegen deine Belege?</h2>
      <p class="lead">Deine Scans werden immer auf diesem Handy gespeichert. Hier legst du fest, ob du sie zusätzlich mit deiner Familie teilst.</p>
      ${storageOptionsHtml(w.storage)}
      <div class="actions"><button class="btn" data-action="back">Zurück</button><button class="btn primary" data-action="next">Weiter</button></div>`;
  } else {
    body = `
      <div class="bigicon">🎉</div>
      <h2>Alles bereit</h2>
      <p class="lead">Dein Steuerordner für ${esc(w.year)} ist angelegt, mit allen wichtigen Ordnern.</p>
      <div class="guide"><p><strong>Dein Speicherort: ${esc(STORAGES[w.storage].short)}</strong></p>${storageGuideHtml(w.storage)}<p class="muted small">Das erledigst du später in Ruhe. Du findest alles unter Einstellungen, «Speicherort und Familie».</p></div>
      <ul class="points">
        <li><b class="n">💼</b><span><strong>Tipp zum Start:</strong> Beginne mit dem Lohnausweis. Tippe auf <em>Beleg scannen</em> und wähle <em>Lohn &amp; Einkommen</em>.</span></li>
        <li><b class="n">?</b><span><strong>Fragen?</strong> Oben rechts auf der Startseite findest du die Hilfe.</span></li>
      </ul>
      <div class="actions"><button class="btn" data-action="back">Zurück</button><button class="btn primary" data-action="finish">Zur Startseite</button></div>`;
  }
  view().innerHTML = `<section class="welcome">${body}<div class="dots">${dots}</div></section>`;

  const finish = async () => {
    const year = Number(welcome.year);
    await ensureYear(year);
    await setSetting('year', year);
    if (welcome.name) await setSetting('userName', welcome.name);
    await setSetting('storage', welcome.storage || 'local');
    await setSetting('onboarded', true);
    welcome = {};
    location.hash = '#/';
  };
  view().onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (w.step === 1) {
      const y = $('#wYear'), n = $('#wName');
      if (y) w.year = Number(y.value);
      if (n) w.name = n.value.trim();
    }
    if (a === 'pickStorage') { w.storage = btn.dataset.s; renderWelcome(params); }
    else if (a === 'next') { w.step++; renderWelcome(params); }
    else if (a === 'back') { w.step--; renderWelcome(params); }
    else if (a === 'skip' || a === 'finish') await finish();
  };
}

async function renderHelp() {
  setHeader('Hilfe', { back: '#/' });
  view().innerHTML = `
    <section class="help">
      <p class="muted">Tippe auf eine Frage, um die Antwort zu sehen.</p>
      <details open><summary>Wie scanne ich einen Beleg?</summary>
        <ol>
          <li>Tippe auf der Startseite auf <strong>Beleg scannen</strong>.</li>
          <li>Wähle den passenden Ordner.</li>
          <li>Lege das Blatt flach auf einen <strong>dunklen Tisch</strong> und halte das Handy ruhig. Wenn der Rahmen grün wird, macht die App das Foto von selbst.</li>
          <li>Prüfe den Rahmen und tippe auf <strong>Übernehmen</strong>.</li>
          <li>Gib dem Beleg einen Namen. Mehrseitige Belege: mehrere Seiten nacheinander aufnehmen, dann <strong>Fertig</strong>.</li>
        </ol>
      </details>
      <details><summary>Der Scan ist schief oder abgeschnitten. Was tun?</summary>
        <p>Nach dem Foto siehst du einen grünen Rahmen mit vier Punkten. Ziehe jeden Punkt mit dem Finger genau auf eine Ecke des Blattes und tippe dann auf <strong>Übernehmen</strong>. Ein dunkler Tisch und gutes Licht helfen. Mit <strong>Ganzes Bild</strong> nimmst du das ganze Foto.</p>
      </details>
      <details><summary>Was ist das Steuerjahr?</summary>
        <p>Das Jahr, für das du die Steuererklärung ausfüllst, zum Beispiel 2025. Du wählst es oben auf der Startseite. Für jedes Jahr gibt es eigene Ordner.</p>
      </details>
      <details><summary>Wo finde ich meine Belege wieder?</summary>
        <p>Tippe auf der Startseite auf einen Ordner. Dort siehst du alle Belege dieses Ordners. Tippe einen Beleg an, um ihn umzubenennen, Seiten zu drehen oder ihn zu löschen.</p>
      </details>
      <details><summary>Wie komme ich zur Online-Steuererklärung?</summary>
        <p>Tippe auf der Startseite auf <strong>Hochladen</strong>. Dort führt dich die App Schritt für Schritt und zeigt dir jeden Beleg als PDF.</p>
      </details>
      <details><summary>Wo liegen meine Belege?</summary>
        <p>Auf deinem Handy, in dieser App. Sie werden nicht ins Internet gesendet. Zusätzlich kannst du eine Sicherung oder einen gemeinsamen Ordner mit der Familie in iCloud Drive oder Google Drive nutzen. Das stellst du unter Einstellungen bei «Speicherort und Familie» ein.</p>
      </details>
      <details><summary>Wie arbeiten wir zu zweit oder als Familie?</summary>
        <p>Alle nutzen einen gemeinsamen Ordner in iCloud Drive oder Google Drive. Jede Person speichert ihre eigene Datei dort hinein und liest die Dateien der anderen ein. Die genauen Schritte stehen unter Einstellungen bei «Speicherort und Familie».</p>
      </details>
      <details><summary>Sind meine Daten sicher? Kann etwas verloren gehen?</summary>
        <p>Die Belege bleiben auf deinem Gerät, die App sendet nichts ins Internet. Damit nichts verloren geht, installiere die App auf dem Home-Bildschirm und speichere ab und zu <strong>Meine Datei</strong> in den Einstellungen. Diese Datei ist deine Sicherung.</p>
      </details>
      <details><summary>Wie lege ich die App auf den Home-Bildschirm?</summary>
        <ol>
          <li>Öffne die Seite in <strong>Safari</strong>.</li>
          <li>Tippe auf das Teilen-Symbol (Quadrat mit Pfeil) oder auf «…».</li>
          <li>Wähle <strong>Zum Home-Bildschirm</strong> und tippe auf <strong>Hinzufügen</strong>.</li>
        </ol>
      </details>
      <button class="btn" data-action="again">Einführung nochmals ansehen</button>
    </section>`;
  view().onclick = (e) => {
    if (e.target.closest('[data-action=again]')) { welcome = {}; location.hash = '#/welcome?again=1'; }
  };
}

async function renderUpload() {
  const year = await currentYear();
  const folders = await foldersOf(year);
  const groups = [];
  for (const f of folders) {
    const list = await docsOf(f.id);
    if (list.length) groups.push({ f, list });
  }
  const all = groups.flatMap((g) => g.list);
  const done = all.filter((d) => d.uploaded).length;
  setHeader('Hochladen', { back: '#/' });
  view().innerHTML = `
    <section class="upsteps">
      <strong>So lädst du die Belege hoch</strong>
      <ol>
        <li>Öffne die Online-Steuererklärung (Knopf unten) und melde dich an.</li>
        <li>Gehe dort zu der Stelle, an der ein Beleg verlangt wird.</li>
        <li>Tippe hier beim passenden Beleg auf <strong>PDF</strong> und speichere ihn mit «In Dateien sichern». Wähle ihn dann im Portal aus.</li>
        <li>Setze hier den Haken, damit du nichts doppelt hochlädst.</li>
      </ol>
      <p class="muted small">Am Computer geht es einfacher: Speichere alle Belege als ZIP-Datei, entpacke sie und lade die PDFs hoch.</p>
    </section>
    <div class="upbtns">
      <a class="btn primary" href="https://mein.ar.ch" target="_blank" rel="noopener">🌐 Online-Steuererklärung öffnen</a>
      <button class="btn" data-action="zipOpen" ${all.length ? '' : 'disabled'}>⤓ Noch offene Belege als ZIP speichern</button>
      <button class="btn" data-action="zipAll" ${all.length ? '' : 'disabled'}>⤓ Alle Belege als ZIP speichern</button>
    </div>
    ${all.length ? `<p><strong>${done} von ${all.length}</strong> Belegen hochgeladen.</p>` : '<div class="empty"><p>Du hast noch keine Belege gesammelt.<br>Tippe auf der Startseite auf <strong>Beleg scannen</strong>.</p><a class="btn" href="#/">Zur Startseite</a></div>'}
    ${groups.map((g) => `
      <h3 class="upfolder">${esc(g.f.icon || '📁')} ${esc(g.f.name)}</h3>
      ${g.list.map((d) => `
        <div class="uprow ${d.uploaded ? 'done' : ''}">
          <label class="check"><input type="checkbox" data-doc="${d.id}" ${d.uploaded ? 'checked' : ''}><span><strong>${esc(d.title)}</strong><small>${d.kind === 'pdf' ? 'PDF' : plural(d.pages.length, 'Seite', 'Seiten')}${d.author ? ' · von ' + esc(d.author) : ''}</small></span></label>
          <button class="btn small" data-action="pdf" data-doc="${d.id}">PDF</button>
        </div>`).join('')}`).join('')}`;

  view().onchange = async (e) => {
    const cb = e.target.closest('input[data-doc]');
    if (!cb) return;
    const d = all.find((x) => x.id === cb.dataset.doc);
    if (!d) return;
    d.uploaded = cb.checked;
    d.uploadedAt = cb.checked ? Date.now() : null;
    d.updatedAt = Date.now();
    await db.put('docs', d);
    render();
  };
  view().onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'zipOpen') await exportYearZip(year, true);
    else if (a === 'zipAll') await exportYearZip(year, false);
    else if (a === 'pdf') {
      const d = all.find((x) => x.id === btn.dataset.doc);
      const g = groups.find((x) => x.list.includes(d));
      if (!d) return;
      busy(true, 'PDF wird erstellt …');
      try {
        const pdf = await docToPdf(d);
        await shareOrDownload(pdf, pdfName(year, g.f, d), d.title);
      } finally { busy(false); }
    }
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const APP_VERSION = '1.5.0';
async function render() {
  revokeUrls();
  $('#headerRight').onclick = null;
  const hash = location.hash.slice(1) || '/';
  const [path, query = ''] = hash.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  try {
    // Erster Start: Einführung zeigen (bestehende Installationen haben schon ein Jahr gespeichert)
    if (parts[0] !== 'welcome' && !(await getSetting('onboarded')) && !(await getSetting('year'))) { location.hash = '#/welcome'; return; }
    if (parts[0] === 'welcome') await renderWelcome(params);
    else if (parts[0] === 'help') await renderHelp();
    else if (parts[0] === 'upload') await renderUpload();
    else if (parts[0] === 'f' && parts[1]) await renderFolder(parts[1]);
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
