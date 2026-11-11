import { db, onWrite } from './db.js';
import { makePdf } from './pdfwriter.js';
import { ZipWriter, readZip } from './zip.js';
import { scanPages, reviewFiles, editPage } from './scanner.js';

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

// Markenzeichen Ordni: Wortmarke (aus Linien gezeichnet) und Symbol (Ordner mit Haken)
const LOGO_WORDMARK = '<svg class="wm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 248 84" role="img" aria-label="Ordni"><g fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"><circle cx="34" cy="50" r="22.5"/><path d="M78 72.5V27.5M78 46C78 34.5 86.5 27.5 97 27.5"/><circle cx="138" cy="50" r="22.5"/><path d="M160.5 8V72.5"/><path d="M179.5 72.5V27.5M179.5 46C179.5 34.5 188 27.5 198 27.5C209.5 27.5 216 35.5 216 47V72.5"/><path d="M235 27.5V72.5"/></g><circle cx="235" cy="10" r="6.5" fill="var(--primary)"/></svg>';
const LOGO_SYMBOL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Ordni"><path d="M10 31C10 21 16 14 25 14H38C41 14 43.5 15 45.5 17L50 22H79C85.6 22 90 26.4 90 33V74H10Z" fill="#2B50E8"/><rect x="6" y="36" width="88" height="53" rx="11" fill="#fff"/><path d="M33 63L45.5 75.5L68 51" fill="none" stroke="#0F1F3D" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const DEFAULT_BY_KEY = Object.fromEntries(DEFAULT_FOLDERS.map((f) => [f.key, f]));
const shortOf = (f) => (DEFAULT_BY_KEY[f.builtin] && DEFAULT_BY_KEY[f.builtin].short) || (f.hint ? f.hint.slice(0, 48) : '');
const examplesOf = (f) => (DEFAULT_BY_KEY[f.builtin] && DEFAULT_BY_KEY[f.builtin].examples) || [];
// Automatische Namen: «Krankenkasse 2025 – Anna Muster». Der Teil vor dem Jahr kommt vom Checklistenpunkt oder vom Ordner.
const FOLDER_LABEL = { einkommen: 'Lohn', wertschriften: 'Bank', berufsauslagen: 'Berufsauslagen', vorsorge: 'Vorsorge', krankenkasse: 'Krankenkasse', liegenschaft: 'Liegenschaft', schulden: 'Schulden', familie: 'Familie', spenden: 'Spenden', steuern: 'Steuern', sonstiges: 'Beleg' };
const baseLabel = (folder, item) => (item ? item.short : (folder && (FOLDER_LABEL[folder.builtin] || folder.name)) || 'Beleg');
const autoTitle = (base, year, person) => `${base} ${year}${person ? ' – ' + person : ''}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Persönliche Checkliste: allgemeine Orientierung (typische Unterlagen in der Schweiz), keine Steuerberatung.
// need: trifft zu, wenn eine dieser Angaben gewählt ist; leer = für alle. opt: nur falls vorhanden.
const PROFILE_QUESTIONS = [
  ['angestellt', 'Ich bin angestellt', 'Du bekommst einen Lohnausweis.'],
  ['selbstaendig', 'Ich bin selbständig erwerbend', 'Eigene Firma, Praxis oder freiberuflich.'],
  ['rente', 'Ich beziehe eine Rente', 'AHV, IV oder Pensionskasse.'],
  ['wertschriften', 'Ich habe Wertschriften', 'Aktien, Fonds, Kryptowährungen oder ein Depot.'],
  ['saeule3a', 'Ich zahle in die Säule 3a ein', 'Private Vorsorge bei einer Bank oder Versicherung.'],
  ['eigentum', 'Ich besitze Wohneigentum', 'Haus oder Wohnung, meist mit Hypothek.'],
  ['kinder', 'Ich habe Kinder', 'Betreuung, Ausbildung oder Unterstützung.'],
  ['unterhalt_zahle', 'Ich zahle Unterhalt', 'Alimente für Kinder oder an die geschiedene oder getrennte Person.'],
  ['unterhalt_erhalte', 'Ich erhalte Unterhalt', 'Alimente für dich oder für die Kinder.'],
];
const CHECKLIST = [
  { key: 'lohnausweis', folder: 'einkommen', need: ['angestellt'], short: 'Lohnausweis', title: 'Lohnausweis', hint: 'Vom Arbeitgeber, meist im Januar. Bei mehreren Arbeitgebern je einer.', amount: 'Nettolohn (Ziffer 11 auf dem Lohnausweis)' },
  { key: 'taggeld', folder: 'einkommen', need: ['angestellt'], opt: true, short: 'Taggeld', title: 'Taggelder (Arbeitslosen-, Kranken-, Unfalltaggeld)', hint: 'Nur falls du im Jahr welche erhalten hast.', amount: 'Total des Jahres' },
  { key: 'rente_ahv', folder: 'einkommen', need: ['rente'], short: 'AHV-/IV-Rente', title: 'Bescheinigung AHV-/IV-Rente', hint: 'Die Ausgleichskasse schickt sie meist im Januar.', amount: 'Jahresrente' },
  { key: 'rente_pk', folder: 'einkommen', need: ['rente'], opt: true, short: 'Rente Pensionskasse', title: 'Bescheinigung Rente der Pensionskasse', hint: 'Nur falls du eine Pensionskassenrente bekommst.', amount: 'Jahresrente' },
  { key: 'selbst_abschluss', folder: 'einkommen', need: ['selbstaendig'], short: 'Jahresrechnung', title: 'Jahresrechnung (Erfolgsrechnung und Bilanz)', hint: 'Von dir oder deiner Buchhaltung.', amount: 'Reingewinn' },
  { key: 'konto', folder: 'wertschriften', need: [], short: 'Kontoauszug 31.12.', title: 'Kontoauszüge per 31.12. (alle Konten)', hint: 'Saldo und Zins am 31. Dezember. Viele Banken haben dafür einen «Steuerauszug» oder «Zinsausweis».', amount: 'Saldo per 31.12. und Zins' },
  { key: 'depot', folder: 'wertschriften', need: ['wertschriften'], short: 'Steuerauszug Depot', title: 'Steuerauszug oder Depotauszug', hint: 'Die Bank erstellt ihn, oft als «eSteuerauszug».', amount: 'Gesamtwert per 31.12.' },
  { key: 'oev', folder: 'berufsauslagen', need: ['angestellt'], opt: true, short: 'ÖV-Abo', title: 'ÖV-Abo oder Fahrkosten zur Arbeit', hint: 'Nur falls du mit dem ÖV zur Arbeit fährst.', amount: 'Kosten im Jahr' },
  { key: 'weiterbildung', folder: 'berufsauslagen', need: ['angestellt', 'selbstaendig'], opt: true, short: 'Weiterbildung', title: 'Weiterbildungskosten (Kurse, Prüfungen)', hint: 'Nur falls du Kosten hattest.', amount: 'Kosten im Jahr' },
  { key: 's3a', folder: 'vorsorge', need: ['saeule3a'], short: 'Säule 3a', title: 'Säule-3a-Bescheinigung', hint: 'Von der Bank oder Versicherung, meist im Januar.', amount: 'Einzahlung im Jahr' },
  { key: 'pk_einkauf', folder: 'vorsorge', need: ['angestellt', 'selbstaendig'], opt: true, short: 'Einkauf Pensionskasse', title: 'Einkauf in die Pensionskasse', hint: 'Nur falls du freiwillig eingekauft hast.', amount: 'Einkaufssumme' },
  { key: 'kk_praemien', folder: 'krankenkasse', need: [], short: 'Prämienübersicht', title: 'Prämienübersicht der Krankenkasse', hint: 'Die Krankenkasse schickt eine Jahresübersicht.', amount: 'Prämien im Jahr' },
  { key: 'kk_selbst', folder: 'krankenkasse', need: [], opt: true, short: 'Arztrechnungen', title: 'Arzt-, Zahnarzt- und Spitalrechnungen (selbst bezahlt)', hint: 'Nur was du selbst bezahlt hast.', amount: 'Selbst bezahlter Betrag' },
  { key: 'hypo', folder: 'liegenschaft', need: ['eigentum'], short: 'Hypothekarzins', title: 'Hypothekarzins-Bescheinigung', hint: 'Von der Bank, meist im Januar.', amount: 'Schuldzins und Hypothek per 31.12.' },
  { key: 'unterhalt', folder: 'liegenschaft', need: ['eigentum'], opt: true, short: 'Unterhalt', title: 'Rechnungen für Unterhalt und Reparaturen', hint: 'Nur falls du am Haus oder an der Wohnung etwas machen liessest und die tatsächlichen Kosten statt der Pauschale geltend machst.', amount: 'Total Unterhalt' },
  { key: 'schuldzins', folder: 'schulden', need: [], opt: true, short: 'Schuldzinsen', title: 'Schuldzinsen (Kredit, Leasing, Kreditkarte)', hint: 'Nur falls du Schulden ausser der Hypothek hast.', amount: 'Zinsen im Jahr' },
  { key: 'kita', folder: 'familie', need: ['kinder'], opt: true, short: 'Kinderbetreuung', title: 'Kinderbetreuung (Kita, Tagesfamilie)', hint: 'Nur falls du Betreuung selbst bezahlt hast.', amount: 'Kosten im Jahr' },
  { key: 'ausbildung', folder: 'familie', need: ['kinder'], opt: true, short: 'Ausbildung Kinder', title: 'Ausbildungskosten der Kinder', hint: 'Nur falls du solche Kosten hattest.', amount: 'Kosten im Jahr' },
  { key: 'unterhalt_urteil', folder: 'familie', need: ['unterhalt_zahle', 'unterhalt_erhalte'], short: 'Scheidungsurteil', title: 'Scheidungsurteil oder Unterhaltsvereinbarung', hint: 'Kopie der Seiten mit den Unterhaltsbeiträgen. Manche Kantone wollen sie beim ersten Mal, andere jedes Jahr: lies dazu die Wegleitung deines Kantons.', amount: '' },
  { key: 'unterhalt_zahlung', folder: 'familie', need: ['unterhalt_zahle'], short: 'Unterhalt bezahlt', title: 'Zahlungsnachweise für bezahlten Unterhalt', hint: 'Belege über das, was du im Jahr wirklich bezahlt hast, mit Name und Adresse der empfangenden Person. Am besten lässt du dir die Zahlungen von ihr bestätigen.', amount: 'Total bezahlt im Jahr' },
  { key: 'unterhalt_erhalt', folder: 'familie', need: ['unterhalt_erhalte'], short: 'Unterhalt erhalten', title: 'Übersicht über erhaltenen Unterhalt', hint: 'Was du im Jahr bekommen hast, für dich und für die Kinder getrennt, falls beides vorkommt.', amount: 'Total erhalten im Jahr' },
  { key: 'spenden', folder: 'spenden', need: [], opt: true, short: 'Spenden', title: 'Spendenbescheinigungen', hint: 'Nur falls du gespendet hast.', amount: 'Total Spenden' },
  { key: 'veranlagung', folder: 'steuern', need: [], opt: true, short: 'Veranlagung Vorjahr', title: 'Veranlagungsverfügung des Vorjahres', hint: 'Hilft beim Vergleich mit dem letzten Jahr.', amount: '' },
];
function profileFormHtml(p = {}) {
  return `<div class="opts profile">${PROFILE_QUESTIONS.map(([k, t, sub]) => `
    <label class="opt popt"><input type="checkbox" name="p" value="${k}" ${p[k] ? 'checked' : ''}><span class="opt-t"><strong>${t}</strong><small>${sub}</small></span></label>`).join('')}</div>`;
}
const readProfile = (root) => Object.fromEntries([...root.querySelectorAll('input[name=p]')].map((i) => [i.value, i.checked]));
const itemApplies = (it, p) => !it.need.length || it.need.some((k) => p[k]);

const STORAGES = {
  local: { icon: '👤', label: 'Nur ich', short: 'Nur dieses Handy', text: 'Die Belege liegen nur auf diesem Handy. Ich sichere sie ab und zu selbst.' },
  icloud: { icon: '☁️', label: 'Familie mit iCloud Drive', short: 'Familie über iCloud Drive', text: 'Alle teilen einen Ordner in iCloud Drive.' },
  gdrive: { icon: '📁', label: 'Familie mit Google Drive', short: 'Familie über Google Drive', text: 'Alle teilen einen Ordner in Google Drive. Geht auch mit Android.' },
  other: { icon: '🗂️', label: 'Familie mit anderem Dienst', short: 'Familie über OneDrive, Dropbox …', text: 'OneDrive, Dropbox oder ein anderer Dienst. Alle teilen einen Ordner.' },
};

// Absprung zu Google Drive: der gespeicherte Ordner-Link, sonst die Startseite von Drive
const DRIVE_HOME = 'https://drive.google.com/drive/my-drive';
const driveOk = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && /^(drive|docs)\.google\.com$/.test(x.hostname); } catch { return false; } };

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
        <li><strong>Jede Person:</strong> Auf der Startseite auf <em>Jetzt speichern</em> tippen. Auf dem iPhone «In Dateien sichern» wählen, den Ordner «Steuer» öffnen (nicht nur die Ansicht «Geteilt von mir»: dort bleibt «Sichern» grau) und tippe auf «Sichern». Auf Android oder am Computer wählst du den Ordner einmal, danach geht es von selbst.</li>
        <li><strong>Zum Abgleich:</strong> Auf Android und am Computer erledigt <em>Jetzt speichern</em> das gleich mit. Auf dem iPhone unter Einstellungen <em>Dateien einlesen</em> tippen und im Ordner «Steuer» alle Dateien markieren.</li>
      </ol>`;
  }
  if (kind === 'gdrive') {
    return `<p><strong>So richtet ihr den gemeinsamen Ordner ein:</strong></p>
      <ol class="steps">
        <li><strong>Jede Person:</strong> Google-Drive-App installieren und in der Dateien-App unter «…», «Bearbeiten» den Eintrag «Drive» einschalten.</li>
        <li><strong>Einmalig, eine Person:</strong> In Google Drive einen Ordner «Steuer» anlegen und mit den Google-Konten der Familie teilen (Bearbeiter).</li>
        <li><strong>Jede Person:</strong> Auf der Startseite auf <em>Jetzt speichern</em> tippen. Auf dem iPhone «In Dateien sichern» wählen, den Ordner «Steuer» öffnen (nicht nur die Ansicht «Geteilt von mir»: dort bleibt «Sichern» grau) und tippe auf «Sichern». Auf Android oder am Computer wählst du den Ordner einmal, danach geht es von selbst.</li>
        <li><strong>Zum Abgleich:</strong> Auf Android und am Computer erledigt <em>Jetzt speichern</em> das gleich mit. Auf dem iPhone unter Einstellungen <em>Dateien einlesen</em> tippen und im Ordner «Steuer» alle Dateien markieren.</li>
      </ol>`;
  }
  if (kind === 'other') {
    return `<p><strong>So richtet ihr den gemeinsamen Ordner ein:</strong></p>
      <ol class="steps">
        <li><strong>Jede Person:</strong> Die App des Dienstes installieren (zum Beispiel OneDrive oder Dropbox) und anmelden. Auf dem iPhone in der Dateien-App unter «…», «Bearbeiten» den Dienst einschalten.</li>
        <li><strong>Einmalig, eine Person:</strong> Im Dienst einen Ordner «Steuer» anlegen und mit den Konten der Familie teilen (Bearbeiten erlauben).</li>
        <li><strong>Jede Person:</strong> Auf der Startseite auf <em>Jetzt speichern</em> tippen. Auf dem iPhone «In Dateien sichern» wählen, den Ordner «Steuer» öffnen (nicht nur die Ansicht «Geteilt von mir»: dort bleibt «Sichern» grau) und tippe auf «Sichern». Auf Android oder am Computer wählst du den Ordner einmal, danach geht es von selbst.</li>
        <li><strong>Zum Abgleich:</strong> Auf Android und am Computer erledigt <em>Jetzt speichern</em> das gleich mit. Auf dem iPhone unter Einstellungen <em>Dateien einlesen</em> tippen und im Ordner «Steuer» alle Dateien markieren.</li>
      </ol>
      <p class="muted small">Das klappt mit jedem Dienst, der in der Dateien-App, im Dateimanager oder als Ordner am Computer erscheint. Die App sieht nur den Ordner, nicht den Dienst.</p>`;
  }
  return `<p>Deine Belege liegen auf diesem Handy. Damit nichts verloren geht, speichere ab und zu eine <strong>Sicherung</strong>:</p>
    <ol class="steps">
      <li>Auf der Startseite auf <em>Jetzt speichern</em> tippen.</li>
      <li>Auf dem iPhone «In Dateien sichern» wählen, auf Android und am Computer einmal einen Ordner auswählen. Zum Beispiel in iCloud Drive oder Google Drive.</li>
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
// opts.onValue(wert) läuft sofort beim Tippen auf einen Knopf (noch vor dem Schliessen). Das ist nötig, wenn danach die
// Fotoauswahl geöffnet werden soll: Safari auf dem iPhone erlaubt das nur direkt beim Tippen.
// Dialoge mit Eingabefeld sitzen oben und folgen dem sichtbaren Bereich: Auf dem iPhone schiebt sich die Tastatur über den
// Seitenrand, ein Dialog am unteren Rand wäre sonst verdeckt (Feld und Knöpfe nicht mehr zu sehen).
function keepAboveKeyboard(d) {
  d.classList.add('top');
  const vv = window.visualViewport;
  const fit = () => {
    if (!vv) return;
    d.style.maxHeight = Math.max(180, vv.height - 24) + 'px';
    d.style.transform = `translateY(${Math.round(vv.offsetTop)}px)`;
  };
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit(); }
  return () => {
    d.classList.remove('top');
    d.style.maxHeight = ''; d.style.transform = '';
    if (vv) { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); }
  };
}
// Dialog nach unten wegwischen (wie ein iPhone-Blatt) und per Tippen neben den Dialog schliessen.
// Dialoge mit Eingabefeld (Klasse «top») bleiben beim Wischen ruhig, sie folgen der Tastatur.
function swipeToClose(d, close) {
  let y0 = null, dy = 0;
  d.ontouchstart = (e) => { y0 = d.scrollTop <= 0 && !d.classList.contains('top') && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0; d.style.transition = 'none'; };
  d.ontouchmove = (e) => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0 && d.scrollTop <= 0) { e.preventDefault(); d.style.transform = `translateY(${dy}px)`; }
    else { dy = 0; d.style.transform = ''; }
  };
  d.ontouchend = d.ontouchcancel = () => {
    if (y0 === null) return;
    y0 = null;
    if (dy > 90) { close(); return; }
    d.style.transition = 'transform .2s ease-out'; d.style.transform = '';
  };
  d.onclick = (e) => { if (e.target === d) close(); };
  return () => { d.ontouchstart = d.ontouchmove = d.ontouchend = d.ontouchcancel = d.onclick = null; d.style.transition = ''; if (!d.classList.contains('top')) d.style.transform = ''; };
}
function dialog(html, opts = {}) {
  return new Promise((resolve) => {
    const d = $('#dlg');
    d.innerHTML = `<form method="dialog" class="dlg-form" tabindex="-1">${html}</form>`;
    const form = d.querySelector('form');
    let cleanup = () => {};
    const done = (v) => { cleanup(); d.close(); d.innerHTML = ''; resolve(v); };
    const stopSwipe = swipeToClose(d, () => done(null));
    cleanup = () => { stopSwipe(); };
    form.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      e.preventDefault();
      if (opts.onValue && btn.dataset.value !== 'cancel') opts.onValue(btn.dataset.value);
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
    if (form.querySelector('input[type=text], input[type=password], input[type=url], textarea')) {
      const stopKb = keepAboveKeyboard(d);
      cleanup = () => { stopSwipe(); stopKb(); };
    }
    d.showModal();
    if (opts.onReady) opts.onReady(d, done);
    const first = form.querySelector('input[type=text], input:not([type=hidden]):not([type=file]), select, textarea');
    // Ohne Eingabefeld: Fokus auf den Dialog selbst, damit der erste Knopf keinen Fokusrahmen bekommt
    if (first) { first.focus(); if (first.select) first.select(); } else form.focus({ preventScroll: true });
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
    // updatedAt 0: unveränderte Standardordner sind überall gleich; Umbenennen setzt die Zeit.
    await db.put('folders', { id: builtinId(year, f.key), year, name: f.name, icon: f.icon, hint: f.hint, order: onlyMissing ? order++ : i, builtin: f.key, createdAt: Date.now(), updatedAt: onlyMissing ? Date.now() : 0 });
    created++;
  }
  if (onlyMissing && created) await clearTombstones(DEFAULT_FOLDERS.map((f) => 'f:' + builtinId(year, f.key)));
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
async function clearTombstones(keys) {
  const t = await getTombstones();
  let changed = false;
  for (const k of keys) if (k in t) { delete t[k]; changed = true; }
  if (changed) await setSetting('tombstones', t);
}
// Papierkorb: Belege werden zuerst nur markiert («deletedAt») und bleiben 30 Tage wiederherstellbar.
// Die Markierung wird wie jede andere Änderung mit der Familie abgeglichen.
const TRASH_DAYS = 30;
const papierkorbSatz = (n, ort = '') => (n === 0 ? '' : n === 1 ? `Der Beleg${ort} kommt in den Papierkorb und kann dort ${TRASH_DAYS} Tage lang zurückgeholt werden.` : `Die ${n} Belege${ort} kommen in den Papierkorb und können dort ${TRASH_DAYS} Tage lang zurückgeholt werden.`);
const folderSnap = (f) => (f ? { id: f.id, name: f.name, icon: f.icon, hint: f.hint || '', builtin: f.builtin, order: f.order } : null);
async function trashDoc(d, folder) {
  d.deletedAt = Date.now();
  d.updatedAt = Date.now();
  const snap = folderSnap(folder || (await db.get('folders', d.folderId)));
  if (snap) d.trashFolder = snap;
  await db.put('docs', d);
}
async function restoreDoc(d) {
  await ensureYear(d.year);
  let f = await db.get('folders', d.folderId);
  if (!f) {
    const sn = d.trashFolder;
    if (sn && !sn.builtin) {
      f = { id: sn.id, year: d.year, name: sn.name, icon: sn.icon, hint: sn.hint || '', order: sn.order ?? 99, createdAt: Date.now(), updatedAt: Date.now() };
      await db.put('folders', f);
      await clearTombstones([folderKey(f.id)]);
    } else {
      await createDefaultFolders(d.year, true);
      f = (await db.get('folders', d.folderId)) || (await db.get('folders', builtinId(d.year, (sn && sn.builtin) || 'sonstiges')));
      if (f) d.folderId = f.id;
    }
  }
  delete d.deletedAt;
  delete d.trashFolder;
  d.updatedAt = Date.now();
  await db.put('docs', d);
}
async function trashedDocs() { return (await db.getAll('docs')).filter((d) => d.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt); }
async function purgeTrash() {
  const cutoff = Date.now() - TRASH_DAYS * 864e5;
  const old = (await trashedDocs()).filter((d) => d.deletedAt < cutoff);
  if (!old.length) return;
  for (const d of old) await db.del('docs', d.id);
  await markDeleted(old.map((d) => d.id));
}
let trashPurged = false;

// Fehler beim Speichern verständlich melden (vor allem: Speicher voll)
const isQuota = (e) => !!e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || '')));
const QUOTA_MSG = 'Der Speicher auf diesem Gerät ist voll. Der Beleg wurde nicht gespeichert. Schaffe Platz (zum Beispiel alte Fotos oder Apps löschen) und versuche es nochmals.';
function reportDbError(e) {
  busy(false);
  toast(isQuota(e) ? QUOTA_MSG : 'Speichern hat nicht geklappt: ' + ((e && e.message) || e), 7000);
}
window.addEventListener('unhandledrejection', (e) => { if (isQuota(e.reason)) { e.preventDefault(); reportDbError(e.reason); } });
async function tryPersist() {
  if (await getSetting('persistTried', false)) return;
  await setSetting('persistTried', true);
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch { /* egal */ }
}
async function typedConfirm(title, text, word, okLabel) {
  const r = await dialog(`<h2>${esc(title)}</h2><p>${esc(text)}</p>
    <label>Zur Bestätigung «${esc(word)}» eintippen<input type="text" name="v" autocomplete="off" inputmode="numeric" maxlength="20"></label>
    <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="submit" class="btn danger">${esc(okLabel)}</button></div>`);
  if (!r || typeof r !== 'object') return false;
  if (String(r.v || '').trim() !== String(word)) { toast('Die Eingabe stimmt nicht. Nichts wurde gelöscht.', 4000); return false; }
  return true;
}
const folderKey = (id) => 'f:' + id; // Löschmarken für Ordner und Jahre: «f:<id>», «y:<Jahr>»

async function ensureYear(year) {
  if (!(await db.get('years', year))) {
    const prev = (await db.getAll('years')).filter((y) => y.profile).sort((a, b) => b.year - a.year)[0];
    const prevPr = (await db.getAll('years')).filter((y) => y.profiles).sort((a, b) => b.year - a.year)[0];
    const prevP = (await db.getAll('years')).filter((y) => y.persons && y.persons.length).sort((a, b) => (b.personsAt || 0) - (a.personsAt || 0))[0];
    await db.put('years', { year, createdAt: Date.now(), ...(prev ? { profile: prev.profile, profileAt: Date.now() } : {}), ...(prevPr ? { profiles: prevPr.profiles } : {}), ...(prevP ? { persons: prevP.persons, personsAt: prevP.personsAt || Date.now() } : {}) });
    await clearTombstones(['y:' + year]);
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
  const list = (await db.getAllBy('docs', 'folderId', folderId)).filter((d) => !d.deletedAt);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}
function docSize(d) {
  if (d.kind === 'pdf') return d.file ? d.file.size : 0;
  return (d.pages || []).reduce((s, p) => s + (p.blob ? p.blob.size : 0), 0);
}

// Checkliste und Beträge. Angaben und Haken liegen im Jahres-Eintrag und werden mit der Familie abgeglichen.
const getYearRec = async (year) => (await db.get('years', year)) || { year, createdAt: Date.now() };
// Ohne Personen (oder mit nur einer) gibt es eine Checkliste für den ganzen Haushalt: «profile» und Haken unter ihrem Schlüssel.
// Ab zwei Personen hat jede ihre eigenen Angaben («profiles», je mit Zeitstempel) und eigene Haken («Name|Schlüssel»).
async function setProfile(year, profile, person = '') {
  const y = await getYearRec(year);
  if (person) y.profiles = { ...(y.profiles || {}), [person]: { p: profile, at: Date.now() } };
  else { y.profile = profile; y.profileAt = Date.now(); }
  await db.put('years', y);
}
async function setCheck(year, key, st, person = '') {
  const y = await getYearRec(year);
  const k = person ? `${person}|${key}` : key;
  y.checks = { ...(y.checks || {}), [k]: { s: st, at: Date.now() } };
  await db.put('years', y);
}
async function renamePersonData(old, n) {
  for (const y of await db.getAll('years')) {
    let ch = false;
    if (y.profiles && y.profiles[old]) { const pr = { ...y.profiles[old], at: Date.now() }; y.profiles = { ...y.profiles }; delete y.profiles[old]; y.profiles[n] = pr; ch = true; }
    if (y.checks) {
      for (const k of Object.keys(y.checks)) {
        if (!k.startsWith(old + '|')) continue;
        y.checks[n + '|' + k.slice(old.length + 1)] = { ...y.checks[k], at: Date.now() };
        delete y.checks[k];
        ch = true;
      }
    }
    if (ch) await db.put('years', y);
  }
}
// Personen im Haushalt: die Liste steht an jedem Jahres-Eintrag und wird wie die Angaben mit der Familie abgeglichen.
async function getPersons(year) { const y = await db.get('years', year); return (y && y.persons) || []; }
async function setPersons(list) {
  const now = Date.now();
  for (const y of await db.getAll('years')) { y.persons = list; y.personsAt = now; await db.put('years', y); }
}
function parseNames(text) {
  const out = [];
  for (const part of String(text || '').split(/[,;\n]/)) {
    const n = part.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (n && !out.some((o) => o.toLowerCase() === n.toLowerCase())) out.push(n);
  }
  return out.slice(0, 12);
}
async function namesDlg(title, text, value) {
  const r = await dialog(`<h2>${esc(title)}</h2><p class="muted small">${esc(text)}</p>
    <label>Vor- und Nachname, mehrere mit Komma getrennt<input type="text" name="v" value="${esc(value)}" maxlength="200" placeholder="z. B. Anna Muster, Ben Muster" autocomplete="off"></label>
    <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Später</button><button type="submit" class="btn primary">Speichern</button></div>`);
  return r && typeof r === 'object' ? parseNames(r.v) : null;
}
// Beim ersten Scan einmalig fragen, für wen die Belege sind.
async function maybeAskPersons(year) {
  if ((await getPersons(year)).length || (await getSetting('personsAsked', false))) return;
  await setSetting('personsAsked', true);
  const names = await namesDlg('Für wen sammelst du Belege?', 'Die App nennt die Belege danach «Krankenkasse 2025 – Anna Muster» und ordnet sie der Person zu. Du kannst die Liste später in den Einstellungen ändern.', '');
  if (names && names.length) await setPersons(names);
}
async function choosePerson(year) {
  const persons = await getPersons(year);
  if (persons.length < 2) return persons[0] || '';
  const me = ((await getSetting('userName', '')) || '').toLowerCase();
  const last = await getSetting('lastPerson', '');
  const first = persons.find((p) => p === last) || persons.find((p) => me && p.toLowerCase().startsWith(me.split(' ')[0])) || persons[0];
  const ordered = [first, ...persons.filter((p) => p !== first)];
  const r = await dialog(`<h2>Wem gehört der Beleg?</h2>
    <div class="dlg-actions column">
      ${ordered.map((p, i) => `<button type="button" data-value="p:${esc(p)}" class="btn ${i === 0 ? 'primary' : ''}">${esc(p)}</button>`).join('')}
      <button type="button" data-value="none" class="btn ghost">Nicht zuordnen</button>
    </div>`);
  if (r && r.startsWith('p:')) { const p = r.slice(2); await setSetting('lastPerson', p); return p; }
  return '';
}
// Welche Person gerade in der Checkliste angezeigt wird (nur ab zwei Personen)
async function activeClPerson(persons) {
  const saved = await getSetting('clPerson', '');
  if (persons.includes(saved)) return saved;
  const me = ((await getSetting('userName', '')) || '').toLowerCase().split(' ')[0];
  return persons.find((p) => me && p.toLowerCase().startsWith(me)) || persons[0];
}
// Belege ohne Person zählen für alle Personen mit
async function checklistState(year, person = '', docsIn = null) {
  const y = await db.get('years', year);
  const prof = person ? y && y.profiles && y.profiles[person] && y.profiles[person].p : y && y.profile;
  if (!prof) return null;
  const docs = (docsIn || (await db.getAllBy('docs', 'year', year))).filter((d) => !d.deletedAt);
  const countBy = {};
  for (const d of docs) if (d.item && (!person || !d.person || d.person === person)) countBy[d.item] = (countBy[d.item] || 0) + 1;
  const items = CHECKLIST.filter((it) => itemApplies(it, prof)).map((it) => {
    const ck = y.checks && y.checks[person ? `${person}|${it.key}` : it.key];
    const na = !!(ck && ck.s === 'na');
    const n = countBy[it.key] || 0;
    return { ...it, n, na, done: n > 0 || na };
  });
  return { profile: prof, items, done: items.filter((i) => i.done).length, total: items.length };
}
function parseAmount(v) {
  let t = String(v || '').replace(/[’'\s]/g, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
const fmtChf = (n) => Number(n).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function editProfile(year, person = '') {
  const y = await db.get('years', year);
  const cur = { ...((person ? y && y.profiles && y.profiles[person] && y.profiles[person].p : y && y.profile) || (y && y.profile) || {}) };
  const res = dialog(`<h2>${person ? `Was trifft auf ${esc(person)} zu?` : 'Was trifft auf dich zu?'}</h2>
    <p class="muted small">Daraus erstellt die App ${person ? 'die' : 'deine'} Checkliste.</p>
    ${profileFormHtml(cur)}
    <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div>`);
  $('#dlg form').addEventListener('change', (e) => { if (e.target.name === 'p') cur[e.target.value] = e.target.checked; });
  if (!(await res)) return false;
  await setProfile(year, cur, person);
  return true;
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

async function rotateBlob(blob, q) {
  const img = await loadImage(blob);
  const c = document.createElement('canvas');
  c.width = img.naturalHeight; c.height = img.naturalWidth;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return { blob: await toJpeg(c, q), w: c.width, h: c.height };
}
// Ecken [oben links, oben rechts, unten rechts, unten links] nach einer Drehung im Uhrzeigersinn: Punkt (x, y) wird zu (Höhe − y, x),
// und die Reihenfolge rutscht um eins weiter (die frühere untere linke Ecke liegt nun oben links).
function rotateCorners(corners, oldH) {
  if (!corners || corners.length !== 4) return [];
  const r = corners.map((q) => ({ x: oldH - q.y, y: q.x }));
  return [r[3], r[0], r[1], r[2]];
}
async function rotatePage(page) {
  const out = await rotateBlob(page.blob, 0.9);
  if (!page.src) return out;
  // Das Originalfoto dreht mit, samt Ecken (Drehung im Uhrzeigersinn: (x, y) wird zu (Höhe − y, x))
  const s = await rotateBlob(page.src, 0.85);
  return { ...out, src: s.blob, sw: s.w, sh: s.h, corners: rotateCorners(page.corners, page.sh), mode: page.mode };
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
// Ergebnis: true = geteilt oder heruntergeladen, false = abgebrochen
// Kein «title» beim Teilen: iOS legt ihn sonst als zweites Objekt (Text) dazu, «In Dateien sichern» speichert dann «2 Objekte»
// und legt neben der Datei eine Textdatei «Text» im Ordner ab. Mit strict wird ein Fehler gemeldet, statt stumm herunterzuladen.
async function shareOrDownload(blob, name, title, { strict = false } = {}) {
  // Verschlüsselte Dateien haben keinen bekannten Typ: iOS lehnt sie sonst manchmal ab, dann mit Zip-Typ nochmals versuchen
  const variants = [new File([blob], name, { type: blob.type })];
  if (blob.type !== 'application/zip') variants.push(new File([blob], name, { type: 'application/zip' }));
  let failed = null;
  for (const file of variants) {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e.name === 'AbortError') return false; failed = e; }
    }
  }
  if (failed && strict) { const err = new Error(`Das Teilen-Menü liess sich nicht öffnen (${failed.name || 'Fehler'}). Tippe nochmals auf «Jetzt speichern».`); err.shareFailed = true; throw err; }
  download(blob, name);
  return true;
}
const pdfName = (year, folder, doc) => (doc.autoBase && doc.title.includes(String(year)) ? `${slug(doc.title)}.pdf` : `${year}_${slug(folder.name)}_${slug(doc.title)}.pdf`);
function uniqueName(used, name) {
  let n = name, i = 2;
  while (used.has(n.toLowerCase())) n = name.replace(/\.pdf$/i, `_${i++}.pdf`);
  used.add(n.toLowerCase());
  return n;
}

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
    const used = new Set();
    for (const d of docs) {
      const pdf = await docToPdf(d);
      zip.add(base + uniqueName(used, pdfName(year, folder, d)), new Uint8Array(await pdf.arrayBuffer()));
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
      const used = new Set();
      for (const d of docs) {
        const pdf = await docToPdf(d);
        const name = uniqueName(used, pdfName(year, f, d));
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

// Jedes Gerät schreibt nur seine eigene Datei (Name + Gerätekürzel). So überschreiben sich zwei Geräte derselben Person nie.
// Dateiname der Sync-Dateien. Bis Version 1.13 hiessen sie «Steuerordner_Sync_…»: Solche Dateien liest die App weiter und ersetzt die eigene.
const SYNC_PREFIX = 'Ordni_Sync_', SYNC_PREFIX_OLD = 'Steuerordner_Sync_';
const syncFileName = (name, dev, prefix = SYNC_PREFIX) => `${prefix}${name ? slug(name) : 'Geraet'}${dev ? '_' + dev : ''}.zip`;
async function getDeviceId() {
  let d = await getSetting('deviceId', '');
  if (!d) { d = Math.random().toString(36).slice(2, 6).padEnd(4, '0'); await setSetting('deviceId', d); }
  return d;
}
async function ownSyncNames() {
  const name = await ensureUserName(), dev = await getDeviceId();
  const plain = syncFileName(name, dev), old = syncFileName(name, dev, SYNC_PREFIX_OLD);
  return { plain, enc: plain + '.enc', oldPlain: old, oldEnc: old + '.enc' };
}
// Eigene Dateien verschlüsselt schreiben? Das Passwort bleibt auch nach dem Ausschalten gespeichert,
// damit verschlüsselte Dateien der anderen weiter gelesen werden können.
async function encOn() { return !!(await getSetting('syncPass', '')) && !(await getSetting('syncEncOff', false)); }
async function ownSyncName() { const n = await ownSyncNames(); return (await encOn()) ? n.enc : n.plain; }

// Verschlüsselung der Sync-Dateien: AES-256-GCM, der Schlüssel entsteht per PBKDF2 aus dem gemeinsamen Passwort.
// Aufbau: «STXENC1\0» (8 Byte), Durchläufe (4), Salt (16), IV (12), danach der verschlüsselte Inhalt.
const ENC_MAGIC = [83, 84, 88, 69, 78, 67, 49, 0];
const ENC_HEAD = 40;
const ENC_ITER = 300000;
const PASS_NOTE = 'Mindestens 8 Zeichen, am besten ein ganzer Satz. Alle in der Familie brauchen dasselbe Passwort. Wer es vergisst, kann die Dateien im Ordner nicht mehr öffnen. Die Belege in den Apps bleiben erhalten.';
const isEncrypted = (u8) => u8.length > ENC_HEAD && ENC_MAGIC.every((b, i) => u8[i] === b);
const encError = (code, msg) => Object.assign(new Error(msg), { code });
async function deriveKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptBytes(plain, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, ENC_ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const out = new Uint8Array(ENC_HEAD + ct.length);
  out.set(ENC_MAGIC, 0);
  new DataView(out.buffer).setUint32(8, ENC_ITER);
  out.set(salt, 12);
  out.set(iv, 28);
  out.set(ct, ENC_HEAD);
  return out;
}
async function decryptBytes(u8, pass) {
  const iter = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(8);
  if (iter < 1000 || iter > 5000000) throw encError('BAD_FILE', 'Beschädigte Datei');
  const key = await deriveKey(pass, u8.slice(12, 28), iter);
  try { return await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(28, 40) }, key, u8.subarray(ENC_HEAD)); }
  catch { throw encError('WRONG_PASS', 'Das Passwort stimmt nicht.'); }
}
async function setPassphrase(pass) {
  await setSetting('syncPass', pass);
  await setSetting('syncEncOff', false);
  await setSetting('encDirty', true); // eigene Datei beim nächsten Abgleich neu schreiben
  seenFiles.clear();
}
async function passDlg({ title, note, confirm = false, okLabel = 'Speichern' }) {
  for (;;) {
    const r = await dialog(`<h2>${esc(title)}</h2><p class="muted small">${esc(note)}</p>
      <label>Passwort<input type="password" name="p" required minlength="8" autocomplete="${confirm ? 'new-password' : 'current-password'}"></label>
      ${confirm ? '<label>Passwort wiederholen<input type="password" name="p2" required minlength="8" autocomplete="new-password"></label>' : ''}
      <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="submit" class="btn primary">${esc(okLabel)}</button></div>`);
    if (!r) return null;
    if (confirm && r.p !== r.p2) { toast('Die beiden Passwörter sind nicht gleich. Bitte nochmals.', 3500); continue; }
    return r.p;
  }
}
// Einmalig beim ersten Abgleich anbieten
async function offerEncryption() {
  if ((await getSetting('syncPass', '')) || (await getSetting('encAsked'))) return;
  await setSetting('encAsked', true);
  const r = await dialog(`<h2>Dateien verschlüsseln?</h2>
    <p>Im gemeinsamen Ordner liegen deine Belege, zum Beispiel Lohnausweis und Kontoauszüge. Mit einem Passwort kann sie niemand lesen, der Zugriff auf den Ordner hat, etwa der Cloud-Anbieter. Alle in der Familie brauchen dasselbe Passwort.</p>
    <div class="dlg-actions column"><button type="button" data-value="yes" class="btn primary">🔒 Passwort festlegen (empfohlen)</button><button type="button" data-value="cancel" class="btn ghost">Später</button></div>`);
  if (r !== 'yes') return;
  const p = await passDlg({ title: 'Passwort festlegen', note: PASS_NOTE, confirm: true });
  if (p) await setPassphrase(p);
}

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

// Die Datei, die in den Ordner kommt: Zip, bei gesetztem Passwort verschlüsselt.
async function buildSyncFile() {
  const zip = await buildSyncZip();
  const pass = (await encOn()) ? await getSetting('syncPass', '') : '';
  if (!pass) return zip;
  return new Blob([await encryptBytes(new Uint8Array(await zip.arrayBuffer()), pass)], { type: 'application/octet-stream' });
}

// Sync-Datei von Hand speichern (Einstellungen): Teilen-Menü bzw. Download.
async function saveSyncFile(share) {
  const fname = await ownSyncName();
  busy(true, 'Sync-Datei wird erstellt …');
  try {
    const t0 = Date.now();
    const blob = await buildSyncFile();
    let done = true;
    if (share) done = await shareOrDownload(blob, fname, 'Ordni Sync-Datei'); else download(blob, fname);
    if (done) {
      await setSetting('lastSync', t0);
      toast(`Datei «${fname}» erstellt. Im geteilten Ordner ablegen und die alte Version ersetzen.`, 4500);
    }
  } finally { busy(false); }
}

// ---------------------------------------------------------------------------
// «Jetzt speichern»: Abgleich mit der Familie über den gemeinsamen Ordner
// - Chrome (Android/Computer): Ordner einmal wählen. Danach liest und schreibt die App dort direkt. Solange die
//   Erlaubnis des Browsers gilt, gleicht sie sich auch von selbst ab (beim Öffnen, jede Minute, beim Verlassen).
// - iPhone/iPad: Safari darf keinen Ordner dauerhaft beschreiben. Dort führt ein Assistent in zwei Schritten
//   durch «Dateien der anderen einlesen» und «Meine Datei sichern».
// ---------------------------------------------------------------------------
const canWriteFolder = () => typeof window.showDirectoryPicker === 'function';
const quiet = { running: false };
let autoSaving = false;
const seenFiles = new Map(); // Dateiname -> «Grösse:Änderungszeit»: unveränderte Dateien nicht nochmals einlesen
const SYNC_NAME = /^(Ordni|Steuerordner)_Sync.*\.zip(\.enc)?$/i;

async function folderAccess(dir, ask = true) {
  const opt = { mode: 'readwrite' };
  if ((await dir.queryPermission(opt)) === 'granted') return true;
  if (!ask) return false;
  return (await dir.requestPermission(opt)) === 'granted';
}

async function pickSyncFolder(storage) {
  const where = storage === 'gdrive' ? 'in Google Drive' : storage === 'icloud' ? 'in iCloud Drive' : storage === 'other' ? 'in OneDrive, Dropbox oder eurem Dienst' : 'an einem sicheren Ort, zum Beispiel in iCloud Drive oder Google Drive';
  const go = await dialog(`
    <h2>Ordner einmalig auswählen</h2>
    <p>Wähle gleich den gemeinsamen Ordner ${esc(where)} (zum Beispiel «Steuer»). Danach speichert die App ohne weitere Fragen genau dort hinein.</p>
    <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="button" data-value="go" class="btn primary">Ordner wählen</button></div>`);
  if (go !== 'go') return null;
  const dir = await window.showDirectoryPicker({ id: 'steuerordner', mode: 'readwrite' });
  await setSetting('syncDir', dir);
  await setSetting('syncDirName', dir.name);
  seenFiles.clear();
  return dir;
}

// Liest die Dateien der anderen Geräte im Ordner ein und schreibt danach die eigene Datei.
async function syncWithFolder(dir, { force = false, noWrite = false } = {}) {
  const names = await ownSyncNames();
  const mine = new Set([names.plain, names.enc, names.oldPlain, names.oldEnc]);
  const total = { added: 0, updated: 0, deleted: 0, folders: 0 };
  let skipped = 0, okFiles = 0, wrongPass = 0, needPass = false;
  for await (const [name, h] of dir.entries()) {
    if (h.kind !== 'file' || mine.has(name) || !SYNC_NAME.test(name)) continue;
    let sig = '';
    try {
      const file = await h.getFile();
      sig = `${file.size}:${file.lastModified}`;
      if (!force && seenFiles.get(name) === sig) continue;
      const st = await mergeSyncFile(file);
      seenFiles.set(name, sig);
      okFiles++;
      for (const k of Object.keys(total)) total[k] += st[k];
    } catch (e) {
      if (e.code === 'NEED_PASS') needPass = true;
      else {
        skipped++;
        if (e.code === 'WRONG_PASS') { wrongPass++; if (sig) seenFiles.set(name, sig); } // nicht jede Minute neu versuchen
      }
    }
  }
  const got = total.added + total.updated + total.deleted + total.folders;
  // Verschlüsselte Dateien ohne Passwort: nichts schreiben, erst nach der Passwort-Eingabe
  if (needPass || noWrite) return { got, skipped, wrote: false, needPass, wrongPass, okFiles, total };
  const ch = await changesSinceSync();
  const pass = (await encOn()) ? await getSetting('syncPass', '') : '';
  const dirty = await getSetting('encDirty', false);
  let wrote = false;
  if (force || got || dirty || !ch || ch.n) {
    const fname = pass ? names.enc : names.plain;
    const t0 = Date.now();
    const blob = await buildSyncFile();
    const w = await (await dir.getFileHandle(fname, { create: true })).createWritable();
    await w.write(blob);
    await w.close();
    // Die andere Fassung der eigenen Datei entfernen: nach dem Verschlüsseln soll keine lesbare Kopie liegen bleiben.
    // Ebenso die eigene Datei mit dem alten Namen «Steuerordner_Sync_…» (Version 1.13 und früher).
    for (const n of [pass ? names.plain : names.enc, names.oldPlain, names.oldEnc]) {
      try { await dir.removeEntry(n); } catch { /* gab es nicht */ }
    }
    await setSetting('lastSync', t0);
    await setSetting('encDirty', false);
    wrote = true;
  }
  await setSetting('syncDirName', dir.name);
  return { got, skipped, wrote, needPass: false, wrongPass, okFiles, total };
}

async function saveToFolder(storage) {
  let dir = await getSetting('syncDir', null);
  let ok = false;
  if (dir) { try { ok = await folderAccess(dir); } catch { ok = false; } }
  if (!ok) {
    dir = await pickSyncFolder(storage);
    if (!dir) return;
  }
  await ensureUserName();
  await offerEncryption();
  busy(true, 'Wird abgeglichen …');
  try {
    while (quiet.running) await new Promise((r) => setTimeout(r, 150));
    let r = await syncWithFolder(dir, { force: true });
    if (r.needPass) {
      busy(false);
      const p = await passDlg({ title: 'Verschlüsselte Dateien', note: 'Im Ordner liegen verschlüsselte Dateien. Gib das Passwort ein, das ihr in der Familie verwendet.', okLabel: 'Entsperren' });
      if (!p) { toast('Ohne Passwort kann nicht abgeglichen werden.', 4000); return; }
      busy(true, 'Wird abgeglichen …');
      await setPassphrase(p);
      // Erst prüfen, ohne zu schreiben: mit falschem Passwort darf keine Datei entstehen
      const probe = await syncWithFolder(dir, { force: true, noWrite: true });
      if (!probe.okFiles && probe.wrongPass) {
        await setSetting('syncPass', '');
        await setSetting('encDirty', false);
        toast('Das Passwort stimmt nicht.', 5000);
        return;
      }
      r = await syncWithFolder(dir, { force: true });
    }
    toast(`✓ Abgeglichen mit dem Ordner «${dir.name}».${r.got ? ` Von den anderen übernommen: ${r.got} Änderung${r.got === 1 ? '' : 'en'}.` : ' Bei den anderen gibt es nichts Neues.'}${r.wrongPass ? ` ${r.wrongPass} Datei(en) haben ein anderes Passwort. Hat jemand es geändert? Neues Passwort unter Einstellungen eintragen.` : ''}${r.skipped - r.wrongPass > 0 ? ` ${r.skipped - r.wrongPass} Datei(en) konnten nicht gelesen werden.` : ''}`, 6500);
  } finally { busy(false); }
}

// Hintergrund-Abgleich: nur wenn der Browser die Erlaubnis noch hat (sonst genügt ein Tipp auf «Jetzt speichern»).
function refreshIfIdle() {
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean)[0];
  const sc = document.getElementById('scanner');
  if ($('#dlg').open || (sc && sc.classList.contains('show')) || !['f', 'upload', 'checklist', undefined].includes(p)) return;
  render(true);
}
async function quietSync() {
  if (autoSaving || quiet.running || !canWriteFolder()) return;
  quiet.running = true;
  try {
    const dir = await getSetting('syncDir', null);
    if (!dir || !(await getSetting('storage', '')) || !(await getSetting('userName', ''))) return;
    if (!(await folderAccess(dir, false))) return;
    const r = await syncWithFolder(dir);
    if (r.got) toast(`Neues von der Familie übernommen: ${r.got} Änderung${r.got === 1 ? '' : 'en'}.`, 4000);
    if (r.got || r.wrote) refreshIfIdle();
  } catch (e) { console.warn('Hintergrund-Abgleich:', e); } finally { quiet.running = false; }
}

// Automatisch speichern: zwei Sekunden nach der letzten Änderung (Chrome mit Ordnerzugriff).
// Auf dem iPhone ist das nicht möglich: Eine Web-App darf dort nicht selbst in die Dateien-App schreiben.
let autoTimer = null, autoHintShown = false;
function scheduleAutoSave() {
  if (!canWriteFolder()) return;
  clearTimeout(autoTimer);
  const tick = async () => {
    if (autoSaving || quiet.running) { autoTimer = setTimeout(tick, 2000); return; } // läuft gerade etwas: später nochmals
    const dir = await getSetting('syncDir', null);
    if (!dir || !(await getSetting('storage', '')) || !(await getSetting('userName', ''))) return;
    let ok = false;
    try { ok = await folderAccess(dir, false); } catch { ok = false; }
    if (!ok) {
      if (!autoHintShown) { autoHintShown = true; toast('Automatisches Speichern ist pausiert. Tippe einmal auf «Jetzt speichern», damit der Browser den Ordner wieder freigibt.', 6000); }
      return;
    }
    await quietSync();
  };
  autoTimer = setTimeout(tick, 2000);
}
// Ordnerzugriff erneuern: Chrome vergisst die Erlaubnis nach einem Neustart oft. Beim ersten Tipp nach dem Start fragt die App
// von selbst nochmals (dafür braucht der Browser einen Tipp). Im Chrome-Fenster «Bei jedem Besuch zulassen» wählen.
let regrantDone = false;
async function regrantOnFirstTap() {
  if (regrantDone || !canWriteFolder()) return;
  regrantDone = true;
  try {
    const dir = await getSetting('syncDir', null);
    if (!dir || !(await getSetting('storage', ''))) return;
    const opt = { mode: 'readwrite' };
    if ((await dir.queryPermission(opt)) === 'granted') return;
    if ((await dir.requestPermission(opt)) === 'granted') { toast('Ordnerzugriff erneuert. Automatisches Speichern läuft.', 3500); quietSync(); }
  } catch (e) { console.warn('Ordnerzugriff erneuern:', e); }
}
if (canWriteFolder()) document.addEventListener('pointerup', regrantOnFirstTap, { once: true, passive: true });

onWrite((store, obj) => {
  if (store === 'docs' || store === 'folders' || store === 'years' || (store === 'settings' && obj && obj.key === 'tombstones')) scheduleAutoSave();
});

// iPhone/iPad: Assistent mit zwei Schritten
async function syncViaFiles() {
  await ensureUserName();
  await offerEncryption();
  let fname = await ownSyncName();
  let t0 = 0, blob = null, blobP = null, locked = [];
  const build = () => { t0 = Date.now(); blobP = buildSyncFile(); return blobP; };
  build();
  let shareP = null;
  const res = dialog(`
    <h2>Abgleich mit der Familie</h2>
    <p><strong>Schritt 1:</strong> Hole die Änderungen der anderen. Tippe auf «Dateien wählen», öffne den gemeinsamen Ordner und markiere <em>alle</em> Dateien. Überspringe den Schritt, wenn du allein arbeitest.</p>
    <label class="btn filebtn pickover">📂 Dateien wählen<input type="file" id="wizFiles" multiple></label>
    <p id="wizState" class="muted small">Noch nichts gewählt.</p>
    <div id="wizPass" hidden>
      <label>Passwort der Familie<input type="password" id="wizPassIn" autocomplete="current-password"></label>
      <button type="button" id="wizPassBtn" class="btn small">🔓 Entsperren</button>
    </div>
    <p><strong>Schritt 2:</strong> Sichere deine Datei im selben Ordner. Ersetze dabei die ältere Datei «<span id="wizName">${esc(fname)}</span>».</p>
    <div class="dlg-actions column"><button type="button" data-value="save" class="btn primary" disabled>Wird vorbereitet …</button><button type="button" data-value="cancel" class="btn ghost">Abbrechen</button></div>`, {
    // Das Teilen-Menü muss direkt beim Tippen geöffnet werden, sonst blockiert Safari es
    onValue: (v) => { if (v === 'save' && blob) shareP = shareOrDownload(blob, fname, 'Ordni Sync-Datei', { strict: true }).then((ok) => ({ ok }), (error) => ({ error })); },
  });
  const d = $('#dlg');
  const state = d.querySelector('#wizState'), saveBtn = d.querySelector('[data-value=save]'), pick = d.querySelector('#wizFiles');
  const passBox = d.querySelector('#wizPass'), passIn = d.querySelector('#wizPassIn'), passBtn = d.querySelector('#wizPassBtn');
  const prep = () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Wird vorbereitet …'; blob = null;
    const mine = blobP;
    mine.then(async (b) => {
      if (mine !== blobP) return;
      fname = await ownSyncName();
      d.querySelector('#wizName').textContent = fname;
      blob = b; saveBtn.disabled = false; saveBtn.textContent = '💾 Meine Datei sichern';
    });
  };
  prep();
  // Dateien einlesen; Verschlüsselte ohne (richtiges) Passwort merken wir uns für die Passwort-Eingabe
  const readFiles = async (files) => {
    const total = { added: 0, updated: 0, deleted: 0, folders: 0 };
    let bad = 0, why = '';
    const again = [];
    for (const f of files) {
      try { const st = await mergeSyncFile(f); for (const k of Object.keys(total)) total[k] += st[k]; } catch (e) {
        if (e.code === 'NEED_PASS' || e.code === 'WRONG_PASS') again.push(f); else { bad++; if (!why) why = `«${f.name}»: ${(e && e.message) || e}`; }
      }
    }
    return { total, bad, again, why };
  };
  const report = (n, r) => {
    locked = r.again;
    passBox.hidden = !locked.length;
    const lockedNote = locked.length ? ` ${plural(locked.length, 'Datei ist', 'Dateien sind')} verschlüsselt: Passwort eingeben.` : '';
    state.textContent = `✓ ${plural(n, 'Datei', 'Dateien')} gelesen: ${r.total.added} neu, ${r.total.updated} aktualisiert, ${r.total.deleted} gelöscht${r.bad ? `, ${r.bad} nicht lesbar (${r.why})` : ''}.${lockedNote}`;
    build(); prep();
    if (r.total.added + r.total.updated + r.total.deleted + r.total.folders) refreshIfIdle();
  };
  pick.onchange = async () => {
    const files = [...pick.files];
    if (!files.length) return;
    state.textContent = 'Wird eingelesen …';
    saveBtn.disabled = true;
    try { report(files.length, await readFiles(files)); } catch (e) { state.textContent = 'Das Einlesen hat nicht geklappt: ' + ((e && e.message) || e); prep(); }
    pick.value = '';
  };
  passBtn.onclick = async () => {
    const p = passIn.value;
    if (p.length < 8) { state.textContent = 'Das Passwort hat mindestens 8 Zeichen.'; return; }
    const before = await getSetting('syncPass', '');
    saveBtn.disabled = true;
    state.textContent = 'Wird geprüft …';
    await setPassphrase(p);
    const r = await readFiles(locked);
    if (r.again.length === locked.length) {
      await setSetting('syncPass', before);
      await setSetting('encDirty', false);
      state.textContent = 'Das Passwort stimmt nicht.';
      build(); prep();
      return;
    }
    passIn.value = '';
    report(locked.length - r.again.length, r);
  };
  if ((await res) !== 'save' || !blob) return;
  const r = await shareP;
  if (r && r.error) { toast(r.error.message, 7000); return; }
  if (r && r.ok) {
    await setSetting('lastSync', t0);
    await setSetting('encDirty', false);
    toast(`✓ «${fname}» gesichert. Die anderen lesen sie beim nächsten Abgleich ein.`, 5000);
  }
}

// Gewählte Sync-Dateien einlesen und zusammenführen. Verschlüsselte Dateien: Passwort erfragen.
async function mergeFilesInteractive(files) {
  const total = { added: 0, updated: 0, deleted: 0, folders: 0 };
  let bad = 0, why = '', locked = [], wrongPass = false;
  const run = async (list) => {
    locked = [];
    for (const f of list) {
      try { const st = await mergeSyncFile(f); for (const k of Object.keys(total)) total[k] += st[k]; } catch (e) {
        if (e.code === 'NEED_PASS' || e.code === 'WRONG_PASS') locked.push(f); else { bad++; if (!why) why = `«${f.name}»: ${(e && e.message) || e}`; }
      }
    }
  };
  busy(true, 'Wird abgeglichen …');
  try {
    await run(files);
    if (locked.length) {
      busy(false);
      const p = await passDlg({ title: 'Verschlüsselte Dateien', note: 'Einige Dateien sind verschlüsselt. Gib das Passwort ein, das ihr in der Familie verwendet.', okLabel: 'Entsperren' });
      if (p) {
        busy(true, 'Wird abgeglichen …');
        const before = await getSetting('syncPass', '');
        await setPassphrase(p);
        const again = locked;
        await run(again);
        if (locked.length === again.length) { await setSetting('syncPass', before); await setSetting('encDirty', false); wrongPass = true; }
      }
    }
  } finally { busy(false); }
  const got = total.added + total.updated + total.deleted + total.folders;
  if (wrongPass) toast('Das Passwort stimmt nicht.', 5000);
  else toast(got ? `✓ Abgeglichen: ${total.added} neu, ${total.updated} aktualisiert, ${total.deleted} gelöscht${total.folders ? `, ${total.folders} bei Ordnern oder Checkliste` : ''}.` : bad ? `Nicht lesbar: ${why}` : '✓ Abgeglichen. Es gibt nichts Neues.', bad ? 7000 : 5000);
  if (got) render(true);
  return { total, got, bad };
}

// Beim Start fragen, ob die Dateien der Familie aus dem Speicherort zusammengeführt werden sollen.
// Auf dem iPhone darf eine Web-App keinen Ordner von selbst lesen: Die Dateien müssen bei jedem Abgleich gewählt werden.
// Mit Chrome (Computer) läuft der Abgleich im Hintergrund, solange der Browser den Ordnerzugriff behalten hat.
let mergeAsked = false;
async function askMergeOnStart() {
  if (mergeAsked) return;
  mergeAsked = true;
  try {
    const storage = await getSetting('storage', '');
    if (!['icloud', 'gdrive', 'other'].includes(storage)) return;
    if ((await getSetting('mergeAsk', true)) === false) return;
    if (!(await getSetting('userName', '')) || !((await getSetting('onboarded')) || (await getSetting('year')))) return;
    const route = (location.hash.slice(1) || '/').split('/').filter(Boolean)[0];
    if (['welcome', 'privacy'].includes(route) || $('#dlg').open || autoSaving) return;
    if (Date.now() - (await getSetting('mergeAskedAt', 0)) < 3 * 60 * 1000) return; // schnell nochmals geöffnet: nicht nochmals fragen
    const folderMode = canWriteFolder();
    if (folderMode) {
      const dir = await getSetting('syncDir', null);
      if (dir) { let ok = false; try { ok = await folderAccess(dir, false); } catch { ok = false; } if (ok) return; } // läuft schon im Hintergrund
    }
    await setSetting('mergeAskedAt', Date.now());
    const where = { icloud: 'iCloud Drive', gdrive: 'Google Drive', other: 'deinem Speicherort' }[storage];
    let chosen = [];
    const r = await dialog(`<h2>Mit der Familie abgleichen?</h2>
      <p>${folderMode ? `Neue Belege der anderen aus ${esc(where)} holen und zusammenführen.` : `Neue Belege der anderen aus ${esc(where)} holen. Tippe auf «Dateien wählen», öffne den gemeinsamen Ordner und markiere <em>alle</em> Dateien.`}</p>
      ${folderMode ? '<div class="dlg-actions column"><button type="button" data-value="sync" class="btn primary">Jetzt abgleichen</button></div>' : '<label class="btn primary filebtn pickover">📂 Dateien wählen<input type="file" id="startFiles" multiple></label>'}
      <div class="dlg-actions column"><button type="button" data-value="later" class="btn ghost">Später</button><button type="button" data-value="never" class="btn ghost">Nicht mehr fragen</button></div>`, {
      onReady: (d, finish) => {
        const inp = d.querySelector('#startFiles');
        if (inp) inp.onchange = () => { chosen = [...inp.files]; if (chosen.length) finish('files'); };
      },
    });
    if (r === 'never') { await setSetting('mergeAsk', false); toast('Du kannst die Frage unter Einstellungen wieder einschalten.', 4500); }
    else if (r === 'files') await mergeFilesInteractive(chosen);
    else if (r === 'sync') await autoSave();
  } catch (e) {
    if (!e || e.name !== 'AbortError') console.warn('Abgleich beim Start:', e);
  }
}

async function autoSave() {
  if (autoSaving) return;
  autoSaving = true;
  try {
    const storage = await getSetting('storage', '');
    if (!storage) { toast('Lege zuerst den Speicherort fest.'); location.hash = '#/settings'; return; }
    if (canWriteFolder()) await saveToFolder(storage);
    else await syncViaFiles();
  } catch (err) {
    if (!err || err.name !== 'AbortError') toast('Der Abgleich hat nicht geklappt: ' + ((err && err.message) || err), 6000);
  } finally {
    autoSaving = false;
    render();
  }
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
    toast(`Abgleich fertig (${files.length} Datei${files.length === 1 ? '' : 'en'}): ${total.added} neu, ${total.updated} aktualisiert, ${total.deleted} gelöscht${total.folders ? `, ${total.folders} bei Ordnern oder Checkliste` : ''}.`, 5000);
  } finally { busy(false); }
}

async function mergeSyncFile(file) {
  {
    let buf = await file.arrayBuffer();
    const head = new Uint8Array(buf);
    if (isEncrypted(head)) {
      const pass = await getSetting('syncPass', '');
      if (!pass) throw encError('NEED_PASS', 'Die Datei ist verschlüsselt. Es fehlt das Passwort.');
      buf = await decryptBytes(head, pass);
    }
    const entries = await readZip(buf);
    const mf = entries.find((e) => e.name === 'manifest.json');
    if (!mf) throw new Error('Keine Ordni-Sync-Datei (manifest.json fehlt).');
    const manifest = JSON.parse(new TextDecoder().decode(mf.data));
    if (manifest.app !== 'steuerordner') throw new Error('Unbekanntes Dateiformat.');
    const byName = new Map(entries.map((e) => [e.name, e.data]));
    const stats = { added: 0, updated: 0, deleted: 0, folders: 0 };

    const localTomb = await getTombstones();
    const remoteTomb = manifest.tombstones || {};

    for (const y of manifest.years || []) {
      if (localTomb['y:' + y.year] && localTomb['y:' + y.year] >= (y.createdAt || 0)) continue; // Jahr hier gelöscht
      const local = await db.get('years', y.year);
      if (!local) { await db.put('years', y); continue; }
      let changed = false;
      if ((y.profileAt || 0) > (local.profileAt || 0)) { local.profile = y.profile; local.profileAt = y.profileAt; changed = true; }
      if ((y.personsAt || 0) > (local.personsAt || 0)) { local.persons = y.persons; local.personsAt = y.personsAt; changed = true; }
      for (const [name, pr] of Object.entries(y.profiles || {})) {
        const lp = local.profiles && local.profiles[name];
        if (!lp || (pr.at || 0) > (lp.at || 0)) { local.profiles = { ...(local.profiles || {}), [name]: pr }; changed = true; }
      }
      for (const [k, c] of Object.entries(y.checks || {})) {
        const lc = local.checks && local.checks[k];
        if (!lc || c.at > lc.at) { local.checks = { ...(local.checks || {}), [k]: c }; changed = true; }
      }
      if (changed) { await db.put('years', local); stats.folders++; }
    }

    const localFolders = await db.getAll('folders');
    const folderMap = new Map(); // ID aus der Datei → lokale ID
    for (const f of manifest.folders || []) {
      const dead = localTomb[folderKey(f.id)];
      if (dead && dead >= (f.updatedAt || 0)) continue; // Ordner hier gelöscht: Dokumente darin werden übersprungen
      let match = localFolders.find((l) => l.id === f.id);
      if (!match && f.builtin) match = localFolders.find((l) => l.year === f.year && l.builtin === f.builtin);
      if (!match) match = localFolders.find((l) => l.year === f.year && l.name.trim().toLowerCase() === String(f.name).trim().toLowerCase());
      if (match) {
        folderMap.set(f.id, match.id);
        if ((f.updatedAt || 0) > (match.updatedAt || 0)) { // Umbenennen, Symbol, Hinweistext: neuere Fassung gewinnt
          Object.assign(match, { name: f.name, icon: f.icon, hint: f.hint, updatedAt: f.updatedAt });
          await db.put('folders', match);
          stats.folders++;
        }
        continue;
      }
      const nf = f.builtin ? { ...f, id: builtinId(f.year, f.builtin) } : { ...f };
      await db.put('folders', nf);
      localFolders.push(nf);
      folderMap.set(f.id, nf.id);
      stats.folders++;
    }
    for (const d of manifest.docs || []) {
      const delAt = localTomb[d.id];
      if (delAt && delAt >= (d.updatedAt || d.createdAt || 0)) continue; // hier gelöscht, dort älter
      const existing = await db.get('docs', d.id);
      if (existing && (existing.updatedAt || existing.createdAt || 0) >= (d.updatedAt || d.createdAt || 0)) continue;
      const doc = { ...d };
      delete doc.files;
      const fid = folderMap.get(d.folderId) || ((await db.get('folders', d.folderId)) ? d.folderId : null);
      if (!fid) continue; // Ordner existiert hier nicht mehr
      doc.folderId = fid;
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
      if (!localTomb[id] || localTomb[id] < delAt) localTomb[id] = delAt;
      if (id.includes(':')) continue; // Ordner und Jahre: unten
      const local = await db.get('docs', id);
      if (local && (local.updatedAt || local.createdAt || 0) < delAt) { await db.del('docs', id); stats.deleted++; }
    }
    // Gelöschte Ordner und Jahre übernehmen, sofern hier keine Dokumente mehr darin liegen
    for (const [key, delAt] of Object.entries(remoteTomb)) {
      if (key.startsWith('f:')) {
        const f = await db.get('folders', key.slice(2));
        if (f && (f.updatedAt || 0) < delAt && !(await db.getAllBy('docs', 'folderId', f.id)).filter((d) => !d.deletedAt).length) { await db.del('folders', f.id); stats.deleted++; }
      } else if (key.startsWith('y:')) {
        const yr = Number(key.slice(2));
        const y = await db.get('years', yr);
        if (y && (y.createdAt || 0) < delAt && !(await db.getAllBy('docs', 'year', yr)).filter((d) => !d.deletedAt).length) {
          for (const f of await db.getAllBy('folders', 'year', yr)) await db.del('folders', f.id);
          await db.del('years', yr);
          stats.deleted++;
        }
      }
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
  const folders = await db.getAll('folders');
  const years = (await db.getAll('years')).filter((y) => (y.profileAt || 0) > last || (y.personsAt || 0) > last || Object.values(y.profiles || {}).some((p) => p.at > last) || Object.values(y.checks || {}).some((c) => c.at > last)).length;
  const n = docs.filter((d) => (d.updatedAt || d.createdAt) > last).length + folders.filter((f) => (f.updatedAt || 0) > last).length + years + Object.values(t).filter((x) => x > last).length;
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
  let fp = null;
  const r = await dialog(`<h2>Kamera nicht verfügbar</h2>
    <p>Die App darf die Kamera nicht direkt nutzen. Du kannst das Foto stattdessen mit der Kamera-App deines Geräts aufnehmen.</p>
    <div class="dlg-actions column"><button type="button" data-value="photo" class="btn primary">📷 Foto aufnehmen</button><button type="button" data-value="cancel" class="btn ghost">Abbrechen</button></div>`,
  { onValue: (v) => { if (v === 'photo') fp = pickFiles({ camera: true }); } });
  if (r !== 'photo' || !fp) return null;
  const files = (await fp).filter(isImage);
  return files.length ? reviewFiles(files, { mode }) : null;
}

async function collectPhotoPages(files) {
  const imgs = files.filter(isImage);
  return imgs.length ? reviewFiles(imgs, { mode: await getScanMode() }) : null;
}

async function addDocuments(folder, year, pages, pdfs, item = null, person = '') {
  const created = [];
  const author = await getSetting('userName', '');
  const base = baseLabel(folder, item);
  // Gleicher Name im selben Ordner: «… (2)», «… (3)»
  const taken = new Set((await docsOf(folder.id)).map((d) => d.title));
  const nextTitle = () => {
    const t0 = autoTitle(base, year, person);
    let t = t0, n = 2;
    while (taken.has(t)) t = `${t0} (${n++})`;
    taken.add(t);
    return t;
  };
  busy(true, 'Wird abgelegt …');
  try {
    if (pages && pages.length) {
      const doc = { id: uid(), folderId: folder.id, year, title: nextTitle(), autoBase: base, kind: 'images', pages, note: '', author, ...(person ? { person } : {}), ...(item ? { item: item.key } : {}), uploaded: false, createdAt: Date.now(), updatedAt: Date.now() };
      await db.put('docs', doc);
      created.push(doc);
    }
    for (const f of pdfs) {
      const doc = { id: uid(), folderId: folder.id, year, title: nextTitle(), autoBase: base, kind: 'pdf', file: new Blob([await f.arrayBuffer()], { type: 'application/pdf' }), note: f.name, author, ...(person ? { person } : {}), ...(item ? { item: item.key } : {}), uploaded: false, createdAt: Date.now(), updatedAt: Date.now() };
      await db.put('docs', doc);
      created.push(doc);
    }
    if (created.length) tryPersist();
  } catch (e) {
    reportDbError(e);
  } finally { busy(false); }
  return created;
}

function pickFiles({ camera }) {
  return new Promise((resolve) => {
    const input = camera ? $('#camInput') : $('#galInput');
    input.value = '';
    input.onchange = () => resolve([...input.files]);
    input.oncancel = () => resolve([]);
    input.click();
  });
}

async function chooseFolder(year, title = 'Wohin gehört der Beleg?', onPick = null) {
  const folders = await foldersOf(year);
  const r = await dialog(`<h2>${esc(title)}</h2>
    <p>Tippe auf den passenden Ordner.</p>
    <div class="dlg-actions column folderpick">
      ${folders.map((f) => `<button type="button" data-value="${f.id}" class="btn pick"><span class="pk-i">${esc(f.icon || '📁')}</span><span class="pk-t"><strong>${esc(f.name)}</strong><small>${esc(shortOf(f))}</small></span></button>`).join('')}
    </div>
    <div class="dlg-actions column"><button type="button" data-value="cancel" class="btn ghost">Abbrechen</button></div>`, onPick ? { onValue: onPick } : {});
  if (!r || r === 'cancel') return null;
  return folders.find((f) => f.id === r) || null;
}

// filesP: schon geöffnete Fotoauswahl (muss direkt beim Tippen gestartet worden sein, siehe dialog())
async function scanInto(folder, year, camera, item = null, forcePerson = '', filesP = null) {
  let pages = null, pdfs = [];
  if (camera) {
    pages = await collectCameraPages();
    if (!pages) return;
  } else {
    const files = await (filesP || pickFiles({ camera: false }));
    if (!files.length) return;
    pdfs = files.filter(isPdf);
    if (files.length - files.filter(isImage).length - pdfs.length) toast('Nur Bilder und PDF-Dateien werden unterstützt.');
    pages = await collectPhotoPages(files);
    if (!pages && !pdfs.length) return;
  }
  await maybeAskPersons(year);
  const person = forcePerson || (await choosePerson(year));
  const created = await addDocuments(folder, year, pages, pdfs, item, person);
  if (created.length === 1) location.hash = `#/d/${created[0].id}?new=1`;
  else if (created.length) { toast(`${created.length} Dokumente abgelegt.`); location.hash = `#/f/${folder.id}`; }
}

// ---------------------------------------------------------------------------
// Ansichten
// ---------------------------------------------------------------------------
const view = () => $('#view');
function setHeader(title, { back = null, right = '', logo = false } = {}) {
  if (logo) $('#title').innerHTML = LOGO_WORDMARK; else $('#title').textContent = title;
  const b = $('#backBtn');
  b.style.visibility = back ? 'visible' : 'hidden';
  b.dataset.href = back || '';
  $('#headerRight').innerHTML = right;
}

async function renderHome() {
  const year = await currentYear();
  const years = (await db.getAll('years')).map((y) => y.year).sort((a, b) => b - a);
  const folders = await foldersOf(year);
  const docs = (await db.getAllBy('docs', 'year', year)).filter((d) => !d.deletedAt);
  const countBy = {};
  for (const d of docs) countBy[d.folderId] = (countBy[d.folderId] || 0) + 1;
  const uploaded = docs.filter((d) => d.uploaded).length;
  const first = docs.length === 0;
  const allUp = docs.length > 0 && uploaded === docs.length;
  const sync = await changesSinceSync();
  const backupDays = sync ? Math.floor((Date.now() - sync.last) / 864e5) : null;
  const warnBackup = docs.length > 0 && (!sync || (sync.n > 0 && backupDays >= 14));
  let warnFull = false;
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); warnFull = !!e.quota && e.usage / e.quota > 0.9; } } catch { /* egal */ }
  const tipDismissed = await getSetting('tipDismissed', false);
  const persons = await getPersons(year);
  const perMode = persons.length >= 2;
  const clp = perMode ? await activeClPerson(persons) : '';
  const cl = await checklistState(year, clp, docs);
  const clOthers = [];
  if (perMode) for (const p of persons.filter((x) => x !== clp)) { const o = await checklistState(year, p, docs); clOthers.push(o ? `${p}: ${o.done} von ${o.total}` : `${p}: noch keine Angaben`); }
  const clOpen = cl ? cl.items.filter((i) => !i.done) : [];
  const storage = await getSetting('storage', '');
  const enc = await encOn();
  const driveUrl = (await getSetting('driveUrl', '')) || DRIVE_HOME;
  const dirName = canWriteFolder() ? await getSetting('syncDirName', '') : '';
  let live = false;
  if (dirName) { try { live = await (await getSetting('syncDir', null)).queryPermission({ mode: 'readwrite' }) === 'granted'; } catch { live = false; } }
  setHeader('Ordni', { logo: true, right: `<a class="iconbtn" href="#/help" title="Hilfe" aria-label="Hilfe">?</a><a class="iconbtn" href="#/settings" title="Einstellungen" aria-label="Einstellungen">⚙︎</a>` });
  view().innerHTML = `
    ${tipDismissed ? '' : `<section class="tipcard"><strong>So fängst du an</strong><ol>
      <li>Tippe unten auf <b>Beleg scannen</b>.</li>
      <li>Wähle den passenden Ordner, zum Beispiel <b>Lohn &amp; Einkommen</b> für deinen Lohnausweis.</li>
      <li>Lege das Blatt auf einen dunklen Tisch. Die App macht das Foto von selbst.</li></ol>
      <label class="check tipdone"><input type="checkbox" id="tipDone"> Gelesen, nicht mehr anzeigen</label></section>`}
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
    ${cl ? `<section class="clcard">
      <a class="clmain" href="#/checklist"><strong>Checkliste${perMode ? ' ' + esc(clp) : ''}: ${cl.done} von ${cl.total} erledigt</strong>
        <div class="bar"><i style="width:${cl.total ? Math.round(100 * cl.done / cl.total) : 0}%"></i></div>
        <small>${clOpen.length ? `Noch offen: ${clOpen.slice(0, 3).map((i) => esc(i.short)).join(', ')}${clOpen.length > 3 ? ' …' : ''}` : 'Alles erledigt ✓'}</small>${clOthers.length ? `<small>${clOthers.map(esc).join(' · ')}</small>` : ''}</a>
      <a class="storeline" href="#/summary">🧾 Zahlen fürs Portal ›</a>
    </section>` : `<section class="clcard">
      <strong>${perMode ? `Welche Belege braucht ${esc(clp)}?` : 'Welche Belege brauchst du?'}</strong>
      <p class="muted small">Neun kurze Fragen, dann erstellt die App ${perMode ? 'die' : 'deine persönliche'} Checkliste.</p>${perMode && clOthers.length ? `<p class="muted small">${clOthers.map(esc).join(' · ')}</p>` : ''}
      <a class="btn primary" href="#/checklist">📝 Checkliste einrichten</a>
    </section>`}
    ${warnBackup ? `<section class="warncard"><strong>⚠️ Deine Belege sind nur auf diesem Handy.</strong>
      <p>${sync ? `Die letzte Sicherung ist ${backupDays} Tage her, seither hat sich etwas geändert.` : 'Du hast noch nie gesichert.'} Geht das Handy verloren oder kaputt, sind sie weg.</p>
      <button class="btn primary" data-action="autoSave">💾 Jetzt sichern</button></section>` : ''}
    ${warnFull ? `<section class="warncard"><strong>⚠️ Der Speicher ist fast voll.</strong>
      <p>Sichere deine Belege und schaffe Platz, bevor neue Scans nicht mehr gespeichert werden können.</p></section>` : ''}
    ${storage ? `<section class="savecard ${!sync || sync.n ? 'pending' : ''}">
      <button class="btn ${!sync || sync.n ? 'primary' : ''} big wide" data-action="autoSave">💾 Jetzt speichern</button>
      <p class="muted small">${sync ? `Zuletzt gespeichert: ${new Date(sync.last).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}${sync.n ? ` · ${sync.n} Änderung${sync.n === 1 ? '' : 'en'} noch nicht gesichert` : ' · alles gesichert ✓'}` : 'Noch nie gespeichert.'} ${canWriteFolder() ? (dirName ? `Ordner «${esc(dirName)}»${live ? ': wird automatisch abgeglichen ✓' : ': tippe auf den Knopf, um den automatischen Abgleich zu starten.'}` : 'Beim ersten Mal wählst du den Ordner aus.') : 'Eine kurze Anleitung führt dich durch den Abgleich.'}${enc ? ' 🔒 Verschlüsselt.' : ''}</p>
      ${storage === 'gdrive' ? `<a class="btn wide" style="margin-top:10px" href="${esc(driveUrl)}" target="_blank" rel="noopener">📁 Google Drive öffnen</a>` : ''}
      ${enc ? '' : '<a class="storeline" href="#/settings">🔒 Dateien verschlüsseln (empfohlen) ›</a>'}
    </section>` : ''}
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
  view().onchange = async (e) => {
    if (e.target.id === 'tipDone' && e.target.checked) { await setSetting('tipDismissed', true); render(true); }
  };
  view().onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'autoSave') await autoSave();
    else if (a === 'newFolder') {
      const name = await promptDlg('Eigener Ordner', 'Wie soll der Ordner heissen?', '', 'Anlegen');
      if (!name) return;
      await db.put('folders', { id: uid(), year, name, icon: '📁', hint: '', order: folders.length + 1, createdAt: Date.now(), updatedAt: Date.now() });
      render();
    } else if (a === 'quickScan' || a === 'quickPick') {
      let filesP = null;
      const f = await chooseFolder(year, 'Wohin gehört der Beleg?', a === 'quickPick' ? () => { filesP = pickFiles({ camera: false }); } : null);
      if (f) await scanInto(f, year, a === 'quickScan', null, '', filesP);
    }
  };
}

let personFilter = { folder: '', p: null };
async function renderFolder(folderId) {
  const folder = await db.get('folders', folderId);
  if (!folder) { location.hash = '#/'; return; }
  const year = folder.year;
  const allDocs = await docsOf(folderId);
  const people = [...new Set(allDocs.map((d) => d.person).filter(Boolean))];
  if (personFilter.folder !== folderId) personFilter = { folder: folderId, p: null };
  if (personFilter.p && !people.includes(personFilter.p)) personFilter.p = null;
  const docs = personFilter.p ? allDocs.filter((d) => d.person === personFilter.p) : allDocs;
  setHeader(folder.name, { back: '#/', right: `<button class="iconbtn" data-action="folderMenu" aria-label="Ordner-Menü">⋯</button>` });
  view().innerHTML = `
    ${folder.hint ? `<details class="hintbox" ${docs.length ? '' : 'open'}><summary>Was gehört in diesen Ordner?</summary><p>${esc(folder.hint)}</p></details>` : ''}
    ${people.length > 1 ? `<div class="chips pfilter"><button type="button" class="chip ${personFilter.p ? '' : 'on'}" data-action="pf" data-p="">Alle</button>${people.map((p) => `<button type="button" class="chip ${personFilter.p === p ? 'on' : ''}" data-action="pf" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}
    ${docs.length ? `<ul class="doclist">${docs.map((d) => `
      <li><a href="#/d/${d.id}">
        <div class="thumb">${d.kind === 'pdf' ? '<span class="pdfbadge">PDF</span>' : (d.pages[0] ? `<img src="${blobUrl(d.pages[0].blob)}" alt="">` : '')}</div>
        <div class="docmeta">
          <div class="doctitle">${esc(d.title)}</div>
          <div class="docsub">${fmtDate(d.createdAt)} · ${d.kind === 'pdf' ? 'PDF' : d.pages.length + ' Seite' + (d.pages.length === 1 ? '' : 'n')} · ${fmtBytes(docSize(d))}${d.amount != null ? ' · CHF ' + fmtChf(d.amount) : ''}${d.person ? ' · ' + esc(d.person) : d.author ? ' · von ' + esc(d.author) : ''}${d.note ? ' · ' + esc(d.note) : ''}</div>
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
    if (a === 'pf') { personFilter = { folder: folderId, p: btn.dataset.p || null }; render(true); }
    else if (a === 'scan') await scanInto(folder, year, true);
    else if (a === 'pick') await scanInto(folder, year, false, null, '', pickFiles({ camera: false }));
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
        if (n) { folder.name = n; folder.updatedAt = Date.now(); await db.put('folders', folder); render(); }
      } else if (r === 'hint') {
        const res = await dialog(`<h2>Hinweistext</h2><label>Was gehört in diesen Ordner?<textarea name="v" rows="5">${esc(folder.hint || '')}</textarea></label>
          <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div>`);
        if (res) { folder.hint = res.v.trim(); folder.updatedAt = Date.now(); await db.put('folders', folder); render(); }
      } else if (r === 'icon') {
        const n = await promptDlg('Symbol', 'Emoji oder kurzes Zeichen', folder.icon || '📁');
        if (n) { folder.icon = n.slice(0, 4); folder.updatedAt = Date.now(); await db.put('folders', folder); render(); }
      } else if (r === 'zip') {
        await exportFolderZip(year, folder);
      } else if (r === 'markAll') {
        for (const d of docs) { d.uploaded = true; d.uploadedAt = Date.now(); d.updatedAt = Date.now(); await db.put('docs', d); }
        render();
      } else if (r === 'delete') {
        const ok = await confirmDlg('Ordner löschen?', allDocs.length ? papierkorbSatz(allDocs.length, ' in diesem Ordner') + ' Du findest den Papierkorb unter Einstellungen.' : 'Der Ordner wird gelöscht.', allDocs.length ? 'In den Papierkorb' : 'Löschen');
        if (!ok) return;
        for (const d of allDocs) await trashDoc(d, folder);
        await markDeleted([folderKey(folder.id)]);
        await db.del('folders', folder.id);
        toast(allDocs.length ? 'Ordner gelöscht. Die Belege liegen im Papierkorb.' : 'Ordner gelöscht.', 5000);
        location.hash = '#/';
      }
    }
  };
  view().onclick = handler;
  $('#headerRight').onclick = handler;
}

async function renderDoc(docId, params) {
  const doc = await db.get('docs', docId);
  if (!doc || doc.deletedAt) { location.hash = '#/'; return; }
  const folder = await db.get('folders', doc.folderId);
  const year = doc.year;
  setHeader(folder ? folder.name : 'Dokument', { back: `#/f/${doc.folderId}`, right: `<button class="iconbtn" data-action="docMenu" aria-label="Dokument-Menü">⋯</button>` });
  const isImg = doc.kind !== 'pdf';
  const persons = await getPersons(year);
  const docItem = doc.item ? CHECKLIST.find((c) => c.key === doc.item) : null;
  view().innerHTML = `
    ${params.get('new') ? '<div class="coach"><strong>Beleg gespeichert.</strong> Gib ihm jetzt einen Namen, damit du ihn später findest.</div>' : ''}
    <section class="docform">
      <label>Name des Belegs<input type="text" id="docTitle" value="${esc(doc.title)}" maxlength="100" placeholder="z. B. Lohnausweis"></label>
      ${persons.length || doc.person ? `<label>Person<select id="docPerson"><option value="">Nicht zugeordnet</option>${[...new Set([...persons, ...(doc.person ? [doc.person] : [])])].map((p) => `<option value="${esc(p)}" ${doc.person === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>` : ''}
      ${folder && examplesOf(folder).length ? `<div><p class="fieldhint">Oder tippe auf einen Vorschlag:</p><div class="chips">${examplesOf(folder).map((t) => `<button type="button" class="chip" data-action="chip" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>` : ''}
      <label>Betrag in CHF (kannst du leer lassen)<input type="text" inputmode="decimal" id="docAmount" value="${doc.amount != null ? esc(String(doc.amount)) : ''}" maxlength="14" placeholder="z. B. 1234.50"></label>
      ${docItem ? `<p class="fieldhint">Gehört zur Checkliste: «${esc(docItem.title)}».${docItem.amount ? ` Trage ein: ${esc(docItem.amount)}.` : ''}</p>` : ''}
      <label>Notiz (kannst du leer lassen)<input type="text" id="docNote" value="${esc(doc.note || '')}" maxlength="200" placeholder="z. B. Betrag CHF 1'234.50"></label>
      <label class="check"><input type="checkbox" id="docUploaded" ${doc.uploaded ? 'checked' : ''}> Ich habe diesen Beleg in der Online-Steuererklärung hochgeladen${doc.uploadedAt ? ` <small>(${fmtDate(doc.uploadedAt)})</small>` : ''}</label>
    </section>
    ${isImg ? `<section class="pages">${doc.pages.map((p, i) => `
      <figure class="page">
        <figcaption>
          <span>Seite ${i + 1}</span>
          <span class="pagebtns">
            <button class="iconbtn wide" data-action="editPage" data-i="${i}" title="Zuschneiden und Filter ändern">✎ Bearbeiten</button>
            <button class="iconbtn" data-action="rotate" data-i="${i}" title="Drehen">⟳</button>
            <button class="iconbtn" data-action="up" data-i="${i}" title="Nach vorne" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="iconbtn" data-action="down" data-i="${i}" title="Nach hinten" ${i === doc.pages.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="iconbtn danger" data-action="delPage" data-i="${i}" title="Seite löschen">✕</button>
          </span>
        </figcaption>
      
        <img src="${blobUrl(p.blob)}" alt="Seite ${i + 1}" data-action="viewPage" data-i="${i}">
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
    // Werte sofort merken: wer die Seite schnell verlässt, verliert den Namen sonst (Eingabefeld ist dann schon weg)
    doc.title = $('#docTitle').value.trim() || doc.title;
    doc.note = $('#docNote').value.trim();
    doc.amount = parseAmount($('#docAmount').value);
    doc.updatedAt = Date.now();
    saveTimer = setTimeout(() => db.put('docs', doc).catch(reportDbError), 150);
  };
  $('#docTitle').oninput = save;
  $('#docNote').oninput = save;
  $('#docAmount').oninput = save;
  if ($('#docPerson')) $('#docPerson').onchange = async (e) => {
    const old = doc.person || '';
    const neu = e.target.value;
    // Hat der Beleg noch den automatischen Namen, zieht der Name mit
    if (doc.autoBase && doc.title === autoTitle(doc.autoBase, year, old)) { doc.title = autoTitle(doc.autoBase, year, neu); $('#docTitle').value = doc.title; }
    if (neu) { doc.person = neu; await setSetting('lastPerson', neu); } else delete doc.person;
    doc.updatedAt = Date.now();
    await db.put('docs', doc);
    toast(neu ? `Zugeordnet: ${neu}.` : 'Zuordnung entfernt.');
  };
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
      doc.title = autoTitle(btn.dataset.t, year, doc.person);
      doc.autoBase = btn.dataset.t;
      $('#docTitle').value = doc.title;
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
    } else if (a === 'editPage') {
      const np = await editPage(doc.pages[i]);
      if (np) { doc.pages[i] = np; doc.updatedAt = Date.now(); await db.put('docs', doc); toast('Seite aktualisiert.'); render(true); }
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
          <button type="button" data-value="delete" class="btn danger">Beleg löschen</button>
          <button type="button" data-value="cancel" class="btn ghost">Abbrechen</button></div>`);
      if (r === 'move') {
        const f = await chooseFolder(year, 'Wohin soll der Beleg?');
        if (f) { doc.folderId = f.id; doc.updatedAt = Date.now(); await db.put('docs', doc); location.hash = `#/f/${f.id}`; }
      } else if (r === 'delete') {
        if (await confirmDlg('Beleg löschen?', `«${doc.title}» kommt in den Papierkorb und bleibt dort ${TRASH_DAYS} Tage. Du findest ihn unter Einstellungen, «Papierkorb».`, 'In den Papierkorb')) {
          await trashDoc(doc, folder);
          toast('In den Papierkorb gelegt. Zurückholen: Einstellungen, «Papierkorb».', 6000);
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
  const persons = await getPersons(year);
  const storage = await getSetting('storage', '');
  const dirName = await getSetting('syncDirName', '');
  const enc = await encOn();
  const haveKey = !!(await getSetting('syncPass', ''));
  const driveLink = await getSetting('driveUrl', '');
  const mergeAsk = (await getSetting('mergeAsk', true)) !== false;
  const trashN = (await trashedDocs()).length;
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

      <h3>Personen im Haushalt</h3>
      <p>Nach dem Scannen fragt die App, wem der Beleg gehört. Der Name lautet dann zum Beispiel «Krankenkasse ${year} – Anna Muster». Die Liste wird mit der Familie abgeglichen.</p>
      ${persons.length ? `<ul class="plain">${persons.map((p, i) => `<li><span>${esc(p)}</span><span><button class="iconbtn" data-action="personRename" data-i="${i}" title="Umbenennen" aria-label="${esc(p)} umbenennen">✎</button><button class="iconbtn danger" data-action="personDel" data-i="${i}" title="Entfernen" aria-label="${esc(p)} entfernen">✕</button></span></li>`).join('')}</ul>` : '<p class="muted">Noch niemand eingetragen.</p>'}
      <div class="row"><button class="btn" data-action="personAdd">＋ Person hinzufügen</button></div>

      <h3>Scannen</h3>
      <label class="setrow">So sehen die Scans aus
        <select id="scanMode">
          <option value="doc" ${scanMode === 'doc' ? 'selected' : ''}>Dokument: Schwarzweiss, ohne Schatten (empfohlen)</option>
          <option value="color" ${scanMode === 'color' ? 'selected' : ''}>Farbe: ohne Schatten</option>
          <option value="orig" ${scanMode === 'orig' ? 'selected' : ''}>Original: nur zuschneiden</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" id="autoCap" ${autoCap ? 'checked' : ''}> Foto automatisch auslösen, sobald das Blatt erkannt ist</label>
      <label class="check"><input type="checkbox" id="keepOrig" ${(() => { try { return localStorage.getItem('ordni.keepOrig') !== '0'; } catch { return true; } })() ? 'checked' : ''}> Originalfoto für späteres Zuschneiden behalten (braucht mehr Speicher)</label>

      <h3>Belege hochladen</h3>
      <p>Hier überträgst du deine Belege in die Online-Steuererklärung. Die App führt dich Schritt für Schritt.</p>
      <a class="btn primary" href="#/upload">📤 Zum Hochladen</a>

      <h3>Papierkorb</h3>
      <p>Gelöschte Belege bleiben ${TRASH_DAYS} Tage hier und lassen sich zurückholen.</p>
      <a class="btn" href="#/trash">🗑️ Papierkorb öffnen${trashN ? ` (${trashN})` : ''}</a>

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
        ${storage ? '<button class="btn primary" data-action="autoSave">💾 Jetzt speichern</button>' : ''}
        <button class="btn ${storage ? '' : 'primary'}" data-action="syncSave">⇪ Meine Datei speichern</button>
        <button class="btn" data-action="syncLoad">⤒ ${storage === 'local' || !storage ? 'Sicherung einlesen' : 'Dateien einlesen'}</button>
      </div>
      ${storage === 'gdrive' ? `<div class="row"><a class="btn" href="${esc(driveLink || DRIVE_HOME)}" target="_blank" rel="noopener">📁 Google Drive öffnen</a><button class="btn" data-action="driveLink">${driveLink ? 'Ordner-Link ändern' : 'Link zum Ordner speichern'}</button></div>
      <p class="muted small">${driveLink ? 'Der Knopf öffnet direkt euren gemeinsamen Ordner. Der Link bleibt auf diesem Gerät gespeichert.' : 'Tipp: Öffne in Google Drive den Ordner «Steuer», tippe auf Teilen und «Link kopieren». Füge ihn hier ein, dann öffnet der Knopf direkt diesen Ordner.'}</p>` : ''}
      ${canWriteFolder() && storage ? `<p class="muted">Ordner für «Jetzt speichern»: ${dirName ? `<strong>${esc(dirName)}</strong>` : 'noch nicht gewählt'} <button class="linkbtn inline" data-action="pickDir">${dirName ? 'ändern' : 'jetzt wählen'}</button></p>
      ${canWriteFolder() && storage ? '<p class="muted small">Wähle im Chrome-Fenster «Bei jedem Besuch zulassen» und installiere Ordni über das Chrome-Menü («Ordni installieren»). Dann fragt Chrome meist nicht mehr nach. Nach einem Neustart genügt ein Tipp in der App, um den Zugriff zu erneuern.</p>' : ''}` : ''}
      ${storage && storage !== 'local' ? `<label class="check"><input type="checkbox" id="mergeAsk" ${mergeAsk ? 'checked' : ''}> Beim Start fragen, ob die Dateien der Familie zusammengeführt werden sollen</label>` : ''}
      <p class="muted">${sync ? `Letzter Abgleich: ${new Date(sync.last).toLocaleString('de-CH')}${sync.n ? ` · ${sync.n} Änderung(en) seither` : ''}` : 'Noch kein Abgleich durchgeführt.'} Die Datei ist zugleich deine Sicherung.</p>

      <h3>Verschlüsselung</h3>
      <p>${enc ? '🔒 <strong>Eingeschaltet.</strong> Die Sync-Dateien sind mit deinem Passwort verschlüsselt (AES-256). Alle in der Familie brauchen dasselbe Passwort.' : `🔓 <strong>Aus.</strong> Deine Sync-Datei im gemeinsamen Ordner kann jeder lesen, der Zugriff auf den Ordner hat, zum Beispiel der Cloud-Anbieter.${haveKey ? ' Verschlüsselte Dateien der anderen liest die App weiter mit dem gespeicherten Passwort.' : ''}`}</p>
      <div class="row">${enc ? '<button class="btn" data-action="encChange">Passwort ändern</button><button class="btn" data-action="encOff">Ausschalten</button>' : '<button class="btn primary" data-action="encOn">🔒 Verschlüsselung einschalten</button>'}</div>
      <p class="muted small">Das Passwort bleibt nur auf diesem Gerät gespeichert, damit sich die App von selbst abgleichen kann. Wer das Passwort vergisst, kann die Dateien im Ordner nicht mehr öffnen. Deine Belege in der App bleiben erhalten.</p>

      <h3>Hilfe</h3>
      <div class="row">
        <a class="btn" href="#/help">Hilfe ansehen</a>
        <button class="btn" data-action="again">Einführung nochmals ansehen</button>
      </div>

      <h3>Sicherheit deiner Daten</h3>
      <a class="btn" href="#/privacy">🔒 Datenschutz lesen</a>
      <p class="muted">Diese App sendet deine Belege an keinen Server der App. Scans, Ordner und Notizen bleiben auf diesem Gerät, bis du sie selbst abgleichst oder ein PDF teilst. Dabei entscheidest du, wohin sie gehen.</p>
      <p class="muted">${esc(storageInfo)}${persisted ? ' · Speicher ist dauerhaft geschützt' : ''}</p>
      ${!persisted && navigator.storage && navigator.storage.persist ? '<button class="btn" data-action="persist">Speicher dauerhaft schützen</button>' : ''}
      <p class="muted">Version ${APP_VERSION}</p>
    </section>`;

  $('#scanMode').onchange = (e) => setSetting('scanMode', e.target.value);
  $('#autoCap').onchange = (e) => setSetting('autoCapture', e.target.checked);
  $('#keepOrig').onchange = (e) => { try { localStorage.setItem('ordni.keepOrig', e.target.checked ? '1' : '0'); } catch { /* ohne Speicher: bleibt an */ } };
  $('#userName').onchange = (e) => setSetting('userName', e.target.value.trim());
  const maBox = $('#mergeAsk'); if (maBox) maBox.onchange = (e) => setSetting('mergeAsk', e.target.checked);
  view().onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'driveLink') {
      const r = await dialog(`<h2>Link zum Ordner</h2><p class="muted small">In Google Drive beim Ordner auf Teilen tippen, dann «Link kopieren». Leer lassen und speichern entfernt den Link.</p>
        <label>Link<input type="text" name="v" value="${esc(driveLink)}" maxlength="400" inputmode="url" autocomplete="off" placeholder="https://drive.google.com/drive/folders/…"></label>
        <div class="dlg-actions"><button type="button" data-value="cancel" class="btn">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div>`);
      if (!r || typeof r !== 'object') return;
      const u = (r.v || '').trim();
      if (u && !driveOk(u)) { toast('Das ist kein Google-Drive-Link. Er beginnt mit https://drive.google.com/', 5500); return; }
      await setSetting('driveUrl', u);
      toast(u ? 'Link gespeichert.' : 'Link entfernt.');
      render(true);
    } else if (a === 'personAdd') {
      const names = await namesDlg('Person hinzufügen', 'Du kannst mehrere Namen mit Komma trennen.', '');
      if (names && names.length) { await setPersons(parseNames([...persons, ...names].join(','))); render(true); }
    } else if (a === 'personRename') {
      const old = persons[Number(btn.dataset.i)];
      const n = old && (await promptDlg('Person umbenennen', 'Vor- und Nachname', old));
      if (!n || n === old) return;
      if (persons.some((p) => p.toLowerCase() === n.toLowerCase() && p !== old)) { toast('Diesen Namen gibt es schon.'); return; }
      await setPersons(persons.map((p) => (p === old ? n : p)));
      await renamePersonData(old, n);
      for (const d of await db.getAll('docs')) {
        if (d.person !== old) continue;
        if (d.autoBase && d.title.startsWith(autoTitle(d.autoBase, d.year, old))) d.title = autoTitle(d.autoBase, d.year, n) + d.title.slice(autoTitle(d.autoBase, d.year, old).length);
        d.person = n; d.updatedAt = Date.now();
        await db.put('docs', d);
      }
      render(true);
    } else if (a === 'personDel') {
      const old = persons[Number(btn.dataset.i)];
      if (old && await confirmDlg('Person entfernen?', `«${old}» steht danach nicht mehr zur Auswahl. Bereits zugeordnete Belege bleiben unverändert.`, 'Entfernen')) { await setPersons(persons.filter((p) => p !== old)); render(true); }
    } else if (a === 'newYear') {
      const y = await promptDlg('Neues Steuerjahr', 'Jahr (z. B. 2025)', String(year + 1), 'Anlegen');
      if (!y || !/^\d{4}$/.test(y)) return;
      await ensureYear(Number(y));
      await setSetting('year', Number(y));
      render();
    } else if (a === 'delYear') {
      const y = Number(btn.dataset.year);
      const docs = (await db.getAllBy('docs', 'year', y)).filter((d) => !d.deletedAt);
      if (!(await typedConfirm(`Steuerjahr ${y} löschen?`, `Alle Ordner dieses Jahres werden entfernt. ${papierkorbSatz(docs.length, ' dieses Jahres')} Die Angaben der Checkliste gehen verloren.`.replace('  ', ' '), y, 'Jahr löschen'))) return;
      const yf = await db.getAllBy('folders', 'year', y);
      const byId = new Map(yf.map((f) => [f.id, f]));
      for (const d of docs) await trashDoc(d, byId.get(d.folderId));
      await markDeleted([...yf.map((f) => folderKey(f.id)), 'y:' + y]);
      for (const f of yf) await db.del('folders', f.id);
      await db.del('years', y);
      if (y === year) { const rest = years.filter((x) => x !== y); await setSetting('year', rest[0] || new Date().getFullYear()); }
      render();
    } else if (a === 'pickStorage') {
      await setSetting('storage', btn.dataset.s);
      render();
    } else if (a === 'again') {
      welcome = {};
      await setSetting('tipDismissed', false);
      location.hash = '#/welcome?again=1';
    } else if (a === 'restoreDefaults') {
      const n = await createDefaultFolders(year, true);
      toast(n ? `${n} Standardordner ergänzt.` : 'Alle Standardordner sind vorhanden.');
    } else if (a === 'exportOpen') await exportYearZip(year, true);
    else if (a === 'exportAll') await exportYearZip(year, false);
    else if (a === 'autoSave') await autoSave();
    else if (a === 'encOn' && (await getSetting('syncPass', ''))) {
      await setSetting('syncEncOff', false);
      await setSetting('encDirty', true);
      toast('Die Verschlüsselung ist wieder eingeschaltet. Beim nächsten Abgleich wird deine Datei neu geschrieben.', 5500);
      render();
    }
    else if (a === 'encOn' || a === 'encChange') {
      const p = await passDlg({ title: a === 'encOn' ? 'Passwort festlegen' : 'Neues Passwort', note: PASS_NOTE, confirm: true });
      if (p) {
        await setPassphrase(p);
        await setSetting('encAsked', true);
        toast('Die Verschlüsselung ist eingeschaltet. Beim nächsten Abgleich wird deine Datei neu geschrieben.', 5500);
        render();
      }
    }
    else if (a === 'encOff') {
      if (await confirmDlg('Verschlüsselung ausschalten?', 'Deine Datei im Ordner ist danach wieder für alle lesbar, die Zugriff auf den Ordner haben. Verschlüsselte Dateien der anderen liest die App weiter.', 'Ausschalten')) {
        await setSetting('syncEncOff', true);
        await setSetting('encDirty', true);
        toast('Die Verschlüsselung ist ausgeschaltet. Beim nächsten Abgleich wird deine Datei wieder lesbar geschrieben.', 5500);
        render();
      }
    }
    else if (a === 'pickDir') {
      try { if (await pickSyncFolder(storage)) { toast('Ordner gewählt.'); render(); } } catch (err) { if (err.name !== 'AbortError') toast('Fehler: ' + err.message, 5000); }
    }
    else if (a === 'syncSave') await saveSyncFile(true);
    else if (a === 'syncLoad') {
      const input = $('#zipInput');
      input.value = '';
      input.onchange = async () => {
        if (!input.files[0]) return;
        try { await mergeFilesInteractive([...input.files]); render(); } catch (err) { toast('Fehler: ' + err.message, 5000); }
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
    const yrec = await db.get('years', Number(welcome.year));
    if (yrec && yrec.profile) welcome.profile = yrec.profile;
  }
  const w = welcome;
  const thisYear = new Date().getFullYear();
  setHeader('Willkommen', {});
  const dots = [0, 1, 2, 3, 4].map((i) => `<span class="dot ${i === w.step ? 'on' : ''}"></span>`).join('');
  let body = '';
  if (w.step === 0) {
    body = `
      <div class="bigicon logo">${LOGO_SYMBOL}</div>
      <h2>Willkommen bei Ordni</h2>
      <p class="lead">Hier sammelst du alle Belege für deine Steuererklärung. Du brauchst dafür nur dein Handy.</p>
      <ul class="points">
        <li><b class="n">1</b><span><strong>Beleg fotografieren.</strong> Die App schneidet das Blatt automatisch zu.</span></li>
        <li><b class="n">2</b><span><strong>Ordner wählen.</strong> Zum Beispiel «Lohn» oder «Krankenkasse».</span></li>
        <li><b class="n">3</b><span><strong>Hochladen.</strong> Die App hilft dir, die Belege in die Online-Steuererklärung zu übertragen.</span></li>
      </ul>
      <p class="muted small">Deine Belege liegen auf deinem Handy, in dieser App. Wenn du möchtest, teilst du sie mit der Familie. Das legst du gleich fest.</p>
      <div class="actions"><button class="btn primary huge" data-action="next">Los geht's</button></div>
      ${w.again ? '' : '<button class="skip" data-action="skip">Einführung überspringen</button>'}
      <p class="muted small center"><a href="#/privacy?from=welcome">Datenschutz</a></p>`;
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
      <div class="bigicon">📝</div>
      <h2>Was trifft auf dich zu?</h2>
      <p class="lead">Daraus erstellt die App deine persönliche Checkliste. Du siehst dann, welche Belege du brauchst. Das kannst du später ändern.</p>
      ${profileFormHtml(w.profile || {})}
      <div class="actions"><button class="btn" data-action="back">Zurück</button><button class="btn primary" data-action="next">Weiter</button></div>`;
  } else if (w.step === 3) {
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
    if (welcome.profile) await setProfile(year, welcome.profile);
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
    if (w.step === 2) w.profile = readProfile(view());
    if (a === 'pickStorage') { w.storage = btn.dataset.s; renderWelcome(params); }
    else if (a === 'next') { w.step++; renderWelcome(params); }
    else if (a === 'back') { w.step--; renderWelcome(params); }
    else if (a === 'skip' || a === 'finish') await finish();
  };
}

// Angaben zum Betreiber der App (für die Datenschutzseite). Leere Felder werden nicht angezeigt.
const OPERATOR = { name: '', adresse: '', email: '' };
const PRIVACY_STAND = '6. November 2026';

async function renderPrivacy(params) {
  const fromWelcome = params.get('from') === 'welcome';
  setHeader('Datenschutz', { back: fromWelcome ? '#/welcome' : '#/settings' });
  const op = [OPERATOR.name, OPERATOR.adresse, OPERATOR.email].filter(Boolean);
  view().innerHTML = `
    <section class="legal">
      <div class="upsteps">
        <strong>Kurz gesagt</strong>
        <p>Deine Belege bleiben auf deinem Gerät. Die App hat keine Benutzerkonten, keine Werbung und keine Analyse. Nur wenn du es selbst auslöst, gelangt etwas aus der App heraus: beim Abgleich mit der Familie und beim Teilen eines PDFs.</p>
      </div>

      <h3>Wer ist verantwortlich?</h3>
      ${op.length ? `<p>${op.map(esc).join('<br>')}</p>` : '<p>Die Kontaktangaben der Betreiberin oder des Betreibers dieser App werden hier noch ergänzt.</p>'}
      <p>Verantwortlich ist, wer die App betreibt. Es gilt das Schweizer Datenschutzgesetz.</p>

      <h3>Was auf deinem Gerät gespeichert wird</h3>
      <ul>
        <li>Die Fotos und PDFs deiner Belege, ihre Namen, Notizen und Beträge.</li>
        <li>Die Namen der Personen im Haushalt und deine Angaben für die Checkliste.</li>
        <li>Einstellungen: Steuerjahr, Speicherort, dein Name, wenn du ihn einträgst.</li>
        <li>Wenn du es einschaltest: das Passwort für die Sync-Dateien und den Link zu deinem Google-Drive-Ordner.</li>
        <li>Ein technischer Zwischenspeicher mit den App-Dateien, damit die App auch ohne Internet läuft, und ein Zeitstempel, wann der Installationshinweis wieder erscheint.</li>
      </ul>
      <p>Das alles liegt im Speicher deines Browsers bzw. deiner installierten App, auf deinem Gerät. Es liegt nicht auf einem Server der App.</p>

      <h3>Was die App nicht tut</h3>
      <ul>
        <li>Sie verlangt kein Konto und keine E-Mail-Adresse.</li>
        <li>Sie setzt keine Cookies und enthält keine Werbung und keine Analyse- oder Tracking-Dienste.</li>
        <li>Sie lädt deine Belege nicht auf einen Server der App hoch. Das Zuschneiden und Aufbereiten der Scans passiert auf deinem Gerät.</li>
        <li>Sie lädt keine Schriften, Skripte oder Bilder von fremden Servern nach.</li>
      </ul>

      <h3>Was beim Aufrufen der App passiert</h3>
      <p>Die App-Dateien werden von einem Hosting-Anbieter ausgeliefert (Vercel Inc., USA). Beim Aufruf fallen dort technisch bedingt Verbindungsdaten an, zum Beispiel IP-Adresse, Zeitpunkt, Browser und die abgerufene Datei. Der Anbieter kann sie protokollieren. Deine Belege und Eingaben sind darin nicht enthalten, denn sie verlassen dein Gerät dabei nicht. Weil der Anbieter in den USA sitzt, kann diese Bearbeitung im Ausland stattfinden. Für Updates lädt die App neue Dateien vom selben Server nach.</p>

      <h3>Kamera</h3>
      <p>Die App fragt vor dem ersten Scan, ob sie die Kamera nutzen darf. Das Bild wird nur auf deinem Gerät verarbeitet. Die Erlaubnis kannst du jederzeit in den Einstellungen deines Geräts zurücknehmen.</p>

      <h3>Abgleich mit der Familie und Teilen</h3>
      <ul>
        <li>«Jetzt speichern» schreibt eine Datei mit deinen Belegen in den Ordner, den du gewählt hast (zum Beispiel in iCloud Drive, Google Drive oder OneDrive). Der Dienst und alle, die Zugriff auf den Ordner haben, können die Datei sehen. Für diese Dienste gelten deren eigene Datenschutzbestimmungen.</li>
        <li>Ohne Passwort ist die Datei lesbar. Mit Passwort ist sie verschlüsselt (AES-256). Das Passwort liegt nur auf deinem Gerät und niemand kann es für dich wiederherstellen.</li>
        <li>Der Dateiname enthält deinen Namen und ein Gerätekürzel.</li>
        <li>Wenn du ein PDF teilst, entscheidest du im Teilen-Menü deines Geräts, wohin es geht.</li>
        <li>Der Knopf «Google Drive öffnen» führt dich auf die Seite von Google. Ab dort gelten die Regeln von Google.</li>
      </ul>

      <h3>Besonders schützenswerte Angaben</h3>
      <p>Steuerbelege enthalten oft heikle Angaben: Lohn, Vermögen, Gesundheitskosten, Unterhalt, Familienverhältnisse. Die App hat keine eigene Sperre. Wer dein entsperrtes Gerät in der Hand hat, kann die Belege sehen. Schütze dein Gerät deshalb mit einem Sperrcode, und verschlüssle die Sync-Dateien, wenn du sie teilst.</p>

      <h3>Löschen und Kontrolle</h3>
      <ul>
        <li>Ein gelöschter Beleg liegt 30 Tage im Papierkorb und wird danach endgültig gelöscht. Beim Abgleich wird die Löschung an die Geräte der Familie weitergegeben.</li>
        <li>Dateien im gemeinsamen Ordner löschst du selbst in deinem Cloud-Dienst.</li>
        <li>Alles entfernen: die App vom Home-Bildschirm löschen und in den Browser-Einstellungen die Website-Daten dieser Adresse löschen. Sichere vorher, was du behalten möchtest.</li>
        <li>Weil deine Daten bei dir liegen, siehst und änderst du sie direkt in der App.</li>
      </ul>

      <h3>Deine Rechte</h3>
      <p>Du kannst Auskunft darüber verlangen, welche Daten die Betreiberin oder der Betreiber über dich bearbeitet, sowie Berichtigung und Löschung. Das sind in der Regel nur die Verbindungsdaten beim Hosting-Anbieter. Schreibe dazu an die Kontaktadresse oben. Du kannst dich auch an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB) wenden.</p>

      <h3>Änderungen</h3>
      <p>Ändert sich etwas an der Funktionsweise, passen wir diese Seite an. Stand: ${PRIVACY_STAND}, App-Version ${APP_VERSION}.</p>
      <p class="muted small">Die Checkliste ist eine allgemeine Orientierung und keine Steuerberatung.</p>
    </section>`;
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
      <details><summary>Wozu ist die Checkliste da?</summary>
        <p>Sie zeigt dir, welche Belege du für deine Situation sammeln solltest, zum Beispiel Lohnausweis oder Säule-3a-Bescheinigung. Sind zwei oder mehr Personen eingetragen, hat jede ihre eigene Checkliste. Wähle oben die Person. Tippe bei einem Punkt auf <strong>Scannen</strong>. Was du nicht brauchst, setzt du auf <strong>Trifft nicht zu</strong>. Sie ist eine Orientierung, keine Steuerberatung.</p>
      </details>
      <details><summary>Wozu soll ich Beträge eintragen?</summary>
        <p>Im Portal musst du meist Zahlen eintippen, nicht nur Dateien hochladen. Trage bei jedem Beleg den Betrag ein. Unter <strong>Zahlen fürs Portal</strong> siehst du dann alles auf einer Seite und kannst es ausdrucken.</p>
      </details>
      <details><summary>Was bringt das Passwort für die Sync-Dateien?</summary>
        <p>Die Dateien im gemeinsamen Ordner enthalten deine Belege. Mit Passwort sind sie verschlüsselt: Wer Zugriff auf den Ordner hat, zum Beispiel der Cloud-Anbieter, sieht nur unlesbare Daten. Alle in der Familie geben dasselbe Passwort ein. Du stellst es unter Einstellungen bei «Verschlüsselung» ein. Vergisst du es, lassen sich die Dateien im Ordner nicht mehr öffnen, deine Belege in der App bleiben aber erhalten.</p>
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
        <p>Alle nutzen einen gemeinsamen Ordner in iCloud Drive oder Google Drive. Jedes Gerät speichert seine eigene Datei dort hinein und liest die Dateien der anderen ein. Das erledigt der Knopf «Jetzt speichern». Die genauen Schritte stehen unter Einstellungen bei «Speicherort und Familie».</p>
      </details>
      <details><summary>Ich habe einen Beleg aus Versehen gelöscht. Was nun?</summary>
        <p>Gelöschte Belege liegen ${TRASH_DAYS} Tage im Papierkorb. Öffne Einstellungen, dann «Papierkorb», und tippe auf <strong>Zurückholen</strong>. Danach ist der Beleg endgültig weg, auch bei der Familie.</p>
      </details>
      <details><summary>Was macht die App mit meinen Daten?</summary>
        <p>Deine Belege bleiben auf deinem Gerät. Es gibt kein Konto, keine Werbung und keine Analyse. Alles Weitere steht in der <a href="#/privacy">Datenschutzerklärung</a>.</p>
      </details>
      <details><summary>Sind meine Daten sicher? Kann etwas verloren gehen?</summary>
        <p>Die Belege bleiben auf deinem Gerät, die App schickt sie an keinen Server. Damit nichts verloren geht, installiere die App auf dem Home-Bildschirm und speichere ab und zu <strong>Meine Datei</strong> in den Einstellungen. Diese Datei ist deine Sicherung.</p>
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
  view().onclick = async (e) => {
    if (e.target.closest('[data-action=again]')) { welcome = {}; await setSetting('tipDismissed', false); location.hash = '#/welcome?again=1'; }
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
        <li>Öffne die Online-Steuererklärung deines Kantons und melde dich an.</li>
        <li>Gehe dort zu der Stelle, an der ein Beleg verlangt wird.</li>
        <li>Tippe hier beim passenden Beleg auf <strong>PDF</strong> und speichere ihn mit «In Dateien sichern». Wähle ihn dann im Portal aus.</li>
        <li>Setze hier den Haken, damit du nichts doppelt hochlädst.</li>
      </ol>
      <p class="muted small">Am Computer geht es einfacher: Speichere alle Belege als ZIP-Datei, entpacke sie und lade die PDFs hoch.</p>
    </section>
    <div class="upbtns">
      <button class="btn primary" data-action="zipOpen" ${all.length ? '' : 'disabled'}>⤓ Noch offene Belege als ZIP speichern</button>
      <button class="btn" data-action="zipAll" ${all.length ? '' : 'disabled'}>⤓ Alle Belege als ZIP speichern</button>
      <a class="btn" href="#/summary">🧾 Zahlen fürs Portal</a>
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

async function renderTrash() {
  const list = await trashedDocs();
  setHeader('Papierkorb', { back: '#/settings' });
  const daysLeft = (d) => Math.max(0, Math.ceil((d.deletedAt + TRASH_DAYS * 864e5 - Date.now()) / 864e5));
  view().innerHTML = `
    <section class="upsteps">
      <strong>Gelöschte Belege</strong>
      <p class="muted small">Nach ${TRASH_DAYS} Tagen werden sie endgültig gelöscht. Gelöscht wird auch bei der Familie, sobald ihr euch abgleicht. Zurückholen geht, solange der Beleg hier liegt.</p>
    </section>
    ${list.length ? `<div class="upbtns"><button class="btn danger" data-action="emptyTrash">Papierkorb leeren</button></div>
    ${list.map((d) => `
      <div class="uprow trashrow">
        <div class="trashtext"><strong>${esc(d.title)}</strong>
          <small>${d.trashFolder ? esc(d.trashFolder.name) + ' · ' : ''}${d.year}${d.person ? ' · ' + esc(d.person) : ''} · noch ${plural(daysLeft(d), 'Tag', 'Tage')}</small></div>
        <div class="trashbtns">
          <button class="btn small primary" data-action="restore" data-id="${d.id}">Zurückholen</button>
          <button class="btn small danger" data-action="purge" data-id="${d.id}">Endgültig löschen</button>
        </div>
      </div>`).join('')}` : '<div class="empty"><div class="empty-icon">🗑️</div><p>Der Papierkorb ist leer.</p><a class="btn" href="#/settings">Zurück</a></div>'}`;
  view().onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    const d = list.find((x) => x.id === btn.dataset.id);
    if (a === 'restore' && d) {
      try { await restoreDoc(d); toast(`Zurückgeholt: ${d.title}`, 4000); } catch (err) { reportDbError(err); }
      render(true);
    } else if (a === 'purge' && d) {
      if (!(await confirmDlg('Endgültig löschen?', `«${d.title}» wird unwiderruflich gelöscht, auch bei der Familie.`, 'Endgültig löschen'))) return;
      await db.del('docs', d.id);
      await markDeleted([d.id]);
      render(true);
    } else if (a === 'emptyTrash') {
      if (!(await confirmDlg('Papierkorb leeren?', `${plural(list.length, 'Beleg', 'Belege')} werden unwiderruflich gelöscht, auch bei der Familie.`, 'Leeren'))) return;
      for (const x of list) await db.del('docs', x.id);
      await markDeleted(list.map((x) => x.id));
      render(true);
    }
  };
}

async function renderChecklist() {
  const year = await currentYear();
  const persons = await getPersons(year);
  const perMode = persons.length >= 2;
  const person = perMode ? await activeClPerson(persons) : '';
  const st = await checklistState(year, person);
  const folderById = new Map((await foldersOf(year)).map((f) => [f.id, f]));
  const chips = perMode ? `<div class="chips pfilter">${persons.map((p) => `<button type="button" class="chip ${p === person ? 'on' : ''}" data-action="clp" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : '';
  const handler = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    const key = btn.dataset.k;
    const it = key ? CHECKLIST.find((c) => c.key === key) : null;
    if (a === 'clp') { await setSetting('clPerson', btn.dataset.p); render(true); }
    else if (a === 'saveProfile') { await setProfile(year, readProfile(view()), person); render(); }
    else if (a === 'profile') { if (await editProfile(year, person)) render(); }
    else if (a === 'na') { await setCheck(year, key, 'na', person); render(true); }
    else if (a === 'undo') { await setCheck(year, key, '', person); render(true); }
    else if ((a === 'scan' || a === 'pick') && it) {
      // Die Fotoauswahl muss direkt beim Tippen aufgehen, darum vor allen Abfragen starten
      const filesP = a === 'pick' ? pickFiles({ camera: false }) : null;
      let folder = folderById.get(builtinId(year, it.folder)) || (await db.get('folders', builtinId(year, it.folder)));
      if (!folder) folder = await chooseFolder(year);
      if (folder) await scanInto(folder, year, a === 'scan', it, person, filesP);
    }
  };
  if (!st) {
    setHeader('Checkliste', { back: '#/' });
    const yrec = await db.get('years', year);
    view().innerHTML = `${chips}<section class="welcome">
      <div class="bigicon">📝</div>
      <h2>${perMode ? `Welche Belege braucht ${esc(person)}?` : 'Welche Belege brauchst du?'}</h2>
      <p class="lead">Beantworte kurz, was ${perMode ? 'auf diese Person' : 'auf dich'} zutrifft. Daraus erstellt die App ${perMode ? 'die' : 'deine persönliche'} Checkliste.</p>
      ${profileFormHtml((yrec && yrec.profile) || {})}
      <div class="actions"><button class="btn primary huge" data-action="saveProfile">Checkliste erstellen</button></div></section>`;
    view().onclick = handler;
    return;
  }
  setHeader('Checkliste', { back: '#/', right: '<button class="iconbtn" data-action="profile" aria-label="Angaben ändern" title="Angaben ändern">✎</button>' });
  const pct = st.total ? Math.round(100 * st.done / st.total) : 0;
  const groups = DEFAULT_FOLDERS.map((f) => ({ f, items: st.items.filter((i) => i.folder === f.key) })).filter((g) => g.items.length);
  const row = (i) => `
    <li class="clitem ${i.n ? 'have' : i.na ? 'na' : ''}">
      <div class="clhead"><span class="clmark">${i.n ? '✓' : i.na ? '–' : '○'}</span>
        <div class="cltext"><strong>${esc(i.title)}</strong>${i.opt ? ' <small>(falls vorhanden)</small>' : ''}
          <small class="clhint">${i.na ? 'Trifft nicht zu.' : i.n ? `${plural(i.n, 'Beleg', 'Belege')} abgelegt.` : esc(i.hint)}</small></div></div>
      <div class="clactions">
        ${i.na ? `<button class="btn small" data-action="undo" data-k="${i.key}">Doch nötig</button>` : `
        <button class="btn small ${i.n ? '' : 'primary'}" data-action="scan" data-k="${i.key}">📷 Scannen</button>
        <button class="btn small" data-action="pick" data-k="${i.key}">🖼️ Aus Fotos</button>
        ${i.n ? '' : `<button class="btn small" data-action="na" data-k="${i.key}">Trifft nicht zu</button>`}`}
      </div>
    </li>`;
  view().innerHTML = `${chips}
    <section class="stepcard">
      <strong>${perMode ? esc(person) + ': ' : ''}${st.done} von ${st.total} erledigt</strong>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="muted small">${st.done === st.total ? 'Alles erledigt. Gut gemacht.' : 'Tippe bei einem Punkt auf «Scannen». Was du nicht hast oder nicht brauchst, setzt du auf «Trifft nicht zu».'}</p>
    </section>
    ${groups.map((g) => `<h3 class="upfolder">${esc(g.f.icon)} ${esc(g.f.name)}</h3><ul class="cl">${g.items.map(row).join('')}</ul>`).join('')}
    <div class="upbtns"><a class="btn" href="#/summary">🧾 Zahlen fürs Portal</a></div>
    <p class="muted small">Die Checkliste ist eine allgemeine Orientierung und ersetzt keine Steuerberatung. Massgebend sind die Unterlagen und Vorgaben deines Kantons.</p>`;
  view().onclick = handler;
  $('#headerRight').onclick = handler;
}

async function renderSummary() {
  const year = await currentYear();
  const folders = await foldersOf(year);
  const groups = [];
  for (const f of folders) {
    const list = (await docsOf(f.id)).reverse();
    if (list.length) groups.push({ f, list });
  }
  const persons = await getPersons(year);
  const seen = new Set(groups.flatMap((g) => g.list.map((d) => d.person || '')));
  const split = [...seen].filter(Boolean).length > 1 || (seen.has('') && [...seen].some(Boolean) && persons.length > 1);
  const order = split ? [...persons.filter((p) => seen.has(p)), ...[...seen].filter((p) => p && !persons.includes(p)), ...(seen.has('') ? [''] : [])] : [null];
  const text = [`Steuerjahr ${year}: erfasste Beträge`, ''];
  const sections = order.map((pn) => {
    if (pn !== null) text.push(`== ${pn || 'Nicht zugeordnet'} ==`, '');
    const sub = pn === null ? groups : groups.map((g) => ({ f: g.f, list: g.list.filter((d) => (d.person || '') === pn) })).filter((g) => g.list.length);
    return (pn === null ? '' : `<h2 class="sectitle">${esc(pn || 'Nicht zugeordnet')}</h2>`) + sumBody(sub, text);
  });
  const body = sections.join('');
  function sumBody(grp, text) { return grp.map((g) => {
    const amounts = g.list.filter((d) => d.amount != null);
    const sum = amounts.reduce((t, d) => t + d.amount, 0);
    text.push(g.f.name);
    const rows = g.list.map((d) => {
      const it = d.item ? CHECKLIST.find((c) => c.key === d.item) : null;
      text.push(`  ${d.title}: ${d.amount != null ? 'CHF ' + fmtChf(d.amount) : 'kein Betrag'}`);
      return `<tr><td>${esc(d.title)}${it && it.amount ? `<small>Eintragen: ${esc(it.amount)}</small>` : ''}</td><td class="num">${d.amount != null ? 'CHF ' + fmtChf(d.amount) : '<span class="muted">–</span>'}</td></tr>`;
    }).join('');
    if (amounts.length > 1) text.push(`  Total: CHF ${fmtChf(sum)}`);
    text.push('');
    return `<h3 class="upfolder">${esc(g.f.icon || '📁')} ${esc(g.f.name)}</h3>
      <table class="sumtab">${rows}${amounts.length > 1 ? `<tr class="tot"><td>Total</td><td class="num">CHF ${fmtChf(sum)}</td></tr>` : ''}</table>`;
  }).join(''); }
  setHeader('Zahlen fürs Portal', { back: '#/' });
  view().innerHTML = `
    <section class="upsteps noprint">
      <strong>Deine Zahlen auf einen Blick</strong>
      <p class="muted small">Hier stehen die Beträge, die du bei den Belegen eingetragen hast. So tippst du sie im Portal ab, ohne jeden Beleg zu öffnen. Ob und wie viel du abziehen darfst, entscheidet das Steueramt.</p>
    </section>
    ${groups.length ? `<h2 class="sectitle printonly">Steuerjahr ${year}</h2>${body}
    <div class="upbtns noprint">
      <button class="btn primary" data-action="print">🖨️ Drucken oder als PDF sichern</button>
      <button class="btn" data-action="copy">📋 Als Text kopieren</button>
    </div>` : '<div class="empty"><p>Noch keine Belege.<br>Lege Belege ab und trage bei jedem den Betrag ein.</p><a class="btn" href="#/">Zur Startseite</a></div>'}`;
  view().onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'print') window.print();
    else if (btn.dataset.action === 'copy') {
      try { await navigator.clipboard.writeText(text.join('\n')); toast('Kopiert.'); } catch { toast('Kopieren geht hier nicht. Nutze «Drucken».', 4000); }
    }
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const APP_VERSION = '1.17.0';
// Anzeigen nacheinander ausführen: Sonst kann eine ältere, noch laufende Anzeige die neuere überschreiben
// (zum Beispiel wenn man während des Abgleichs auf eine andere Seite wechselt).
let rendering = null, renderAgain = false, againKeep = true;
function render(keepScroll = false) {
  if (rendering) { renderAgain = true; againKeep = againKeep && keepScroll; return rendering; }
  rendering = (async () => {
    try {
      await doRender(keepScroll);
      while (renderAgain) { renderAgain = false; const k = againKeep; againKeep = true; await doRender(k); }
    } finally { rendering = null; }
  })();
  return rendering;
}
async function doRender(keepScroll = false) {
  const scrollY = window.scrollY;
  revokeUrls();
  $('#headerRight').onclick = null;
  const hash = location.hash.slice(1) || '/';
  const [path, query = ''] = hash.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  try {
    // Erster Start: Einführung zeigen (bestehende Installationen haben schon ein Jahr gespeichert)
    if (parts[0] !== 'welcome' && parts[0] !== 'privacy' && !(await getSetting('onboarded')) && !(await getSetting('year'))) { location.hash = '#/welcome'; return; }
    if (!trashPurged) { trashPurged = true; await purgeTrash().catch(() => {}); }
    if (parts[0] === 'welcome') await renderWelcome(params);
    else if (parts[0] === 'help') await renderHelp();
    else if (parts[0] === 'upload') await renderUpload();
    else if (parts[0] === 'checklist') await renderChecklist();
    else if (parts[0] === 'summary') await renderSummary();
    else if (parts[0] === 'trash') await renderTrash();
    else if (parts[0] === 'privacy') await renderPrivacy(params);
    else if (parts[0] === 'f' && parts[1]) await renderFolder(parts[1]);
    else if (parts[0] === 'd' && parts[1]) await renderDoc(parts[1], params);
    else if (parts[0] === 'settings') await renderSettings();
    else await renderHome();
  } catch (err) {
    console.error(err);
    view().innerHTML = `<div class="empty"><p>Fehler: ${esc(err.message)}</p><a class="btn" href="#/">Zur Startseite</a></div>`;
  }
  window.scrollTo(0, keepScroll ? scrollY : 0);
}

window.addEventListener('hashchange', () => render());
if (canWriteFolder()) {
  setTimeout(quietSync, 1500);
  setInterval(() => { if (!document.hidden) quietSync(); }, 60000);
  document.addEventListener('visibilitychange', quietSync);
}
$('#backBtn').addEventListener('click', () => { location.hash = $('#backBtn').dataset.href || '#/'; });
render();
setTimeout(askMergeOnStart, 1500);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
