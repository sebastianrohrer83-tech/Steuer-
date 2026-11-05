# Steuerordner

Private Web-App zum Scannen und Ablegen von Steuerbelegen – vorbereitet für die
Online-Steuererklärung des Kantons Appenzell Ausserrhoden («Steuern AR Online»,
Gemeinde Herisau).

- Läuft komplett im Browser, ohne Server. Alle Scans bleiben auf dem Gerät.
- Auf dem Handy installierbar (PWA, «Zum Home-Bildschirm hinzufügen»), funktioniert offline.
- Pro Steuerjahr sind die Standardordner bereits angelegt; eigene Ordner lassen sich ergänzen.
- Belege per Kamera scannen oder Fotos/PDFs aus der Galerie ablegen, mehrseitig, drehbar.
- Export als PDF pro Beleg oder als ZIP-Paket pro Ordner / pro Steuerjahr – bereit zum Hochladen.
- Status «hochgeladen» pro Dokument, Fortschrittsanzeige, Backup und Wiederherstellung.

## Für Einsteiger

- **Einführung** beim ersten Start: drei kurze Seiten, Steuerjahr und Name. Später über «Hilfe» oder die Einstellungen nochmals aufrufbar.
- **Startseite in zwei Schritten:** «Belege sammeln» und «Belege hochladen» mit Fortschritt. Ein grosser Knopf «Beleg scannen».
- **Ordnerwahl als Liste** mit Erklärung, z. B. «Lohn & Einkommen: Lohnausweis, Rente, Taggelder».
- **Namensvorschläge** pro Ordner (z. B. «Lohnausweis»), per Fingertipp übernehmbar.
- **Scan-Tipp** vor dem ersten Scan: dunkler Tisch, ruhig halten, Rahmen prüfen.
- **Hochladen-Seite:** Schritt-für-Schritt-Anleitung, jeder Beleg als PDF, Haken für «hochgeladen», ZIP für den Computer.
- **Hilfe** mit Fragen und Antworten in einfacher Sprache.

## Standardordner

| Ordner | Typische Belege |
|---|---|
| 💼 Lohn & Einkommen | Lohnausweis, AHV/IV-Rente, Pensionskasse, Taggelder, Nebenerwerb |
| 🏦 Bank & Wertschriften | Zins-/Saldobescheinigungen per 31.12., Steuerauszug Depot |
| 🚆 Berufsauslagen | ÖV-Abo, Fahrkosten, Verpflegung, Weiterbildung |
| 🛡️ Säule 3a & Pensionskasse | 3a-Bescheinigung, PK-Einkauf, Lebensversicherung |
| 🏥 Krankenkasse & Gesundheit | Prämienübersicht, Prämienverbilligung, Arzt-/Zahnarztrechnungen |
| 🏠 Liegenschaft & Wohnen | Hypothekarzins, Unterhalt, Nebenkosten, Eigenmietwert |
| 💳 Schulden & Schuldzinsen | Privatkredit, Kreditkartenzinsen, Darlehen |
| 👨‍👩‍👧 Kinder & Familie | Fremdbetreuung, Alimente, Ausbildungskosten |
| 🎁 Spenden & Beiträge | Spendenbescheinigungen, Parteibeiträge, Verbandsbeiträge |
| 🏛️ Steuern & Behörden | Veranlagung Vorjahr, Steuerrechnungen, Korrespondenz |
| 📁 Sonstiges | Alles Übrige |

Jeder Ordner zeigt beim Öffnen einen Hinweistext «Was gehört hier hinein?», der sich anpassen lässt.

## Nutzung

1. **Steuerjahr wählen** (oben links). Ein neues Jahr legt automatisch alle Standardordner an.
2. **Ordner öffnen → Scannen.** Die Kamera erkennt das Blatt live und zeigt einen grünen Rahmen.
   Sobald das Blatt ruhig liegt, löst die App automatisch aus (abschaltbar, dann per Auslöser).
   Danach prüfst du die erkannten Ecken, ziehst sie bei Bedarf mit dem Finger zurecht und tippst auf «Übernehmen».
   Die App schneidet das Blatt zu, richtet es gerade (Perspektive) und entfernt Schatten.
   Mehrere Seiten nacheinander aufnehmen, dann «Fertig». Bei «Datei / Foto» läuft dieselbe Erkennung auf vorhandene Fotos.
3. **Titel und Notiz** vergeben, bei Bedarf weitere Seiten anhängen, Seiten drehen oder umsortieren.
4. **Für die Online-Steuererklärung:**
   - Einzelner Beleg: «PDF teilen / speichern» (Handy) oder «PDF» (Download).
   - Ganzer Ordner: «ZIP».
   - Ganzes Jahr: Startseite → «Upload-Paket» (wahlweise nur die noch nicht hochgeladenen Belege).
     Das ZIP enthält pro Ordner einen Unterordner mit einem PDF pro Beleg und eine Übersichtsdatei.
   - Im Portal [mein.ar.ch](https://mein.ar.ch) (Steuern AR Online) die PDFs bei den jeweiligen
     Positionen als Beilage hochladen.
5. **Hochgeladen markieren.** Häkchen im Dokument setzen (oder im Ordner-Menü «Alle als hochgeladen markieren»).
   Die Startseite zeigt den Fortschritt pro Ordner.

Dateinamen folgen dem Muster `JAHR_Ordner_Titel.pdf`, z. B.
`2025_Krankenkasse_Gesundheit_Praemienuebersicht_CSS.pdf`.

## Installation

### Variante A: GitHub Pages (empfohlen)

1. Im Repository unter **Settings → Pages** als Source «Deploy from a branch», Branch `main`, Ordner `/ (root)` wählen.
2. Nach ein bis zwei Minuten ist die App unter `https://<benutzername>.github.io/<repository>/` erreichbar.
3. Auf dem Handy die Adresse öffnen und über das Browser-Menü «Zum Home-Bildschirm hinzufügen».

### Variante B: lokal

```bash
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen. Ein `file://`-Aufruf reicht nicht, weil der Browser
für Kamera, Service Worker und Module eine echte Web-Adresse braucht.

## Gemeinsam im Haushalt (geteilter iCloud-Ordner)

Die App hat keinen Server. Alle im Haushalt nutzen einen gemeinsamen Ordner in iCloud Drive:

1. **Einmalig:** In der Dateien-App einen Ordner «Steuer» in iCloud Drive anlegen, gedrückt halten, «Teilen» →
   «Zusammenarbeiten» → Personen aus dem Haushalt einladen.
2. In der App unter **Einstellungen** den eigenen **Namen** eintragen.
3. **Jetzt speichern** (Knopf auf der Startseite, sobald der Speicherort festgelegt ist):
   - *Chrome auf Android oder am Computer:* Beim ersten Mal den Ordner «Steuer» wählen. Danach schreibt die App
     `Steuerordner_Sync_<Name>.zip` direkt dorthin und liest dabei gleich die Dateien der anderen ein. Nach einem
     Neustart des Browsers fragt dieser einmal nach der Erlaubnis.
   - *iPhone/iPad (Safari):* Safari kann keinen Ordner dauerhaft beschreiben. Der Knopf öffnet das Teilen-Menü,
     dort «In Dateien sichern» → Ordner «Steuer», die ältere Datei ersetzen.
4. **Dateien einlesen** (nur iPhone nötig, Einstellungen): Im Ordner «Steuer» *alle* Dateien markieren. Die App führt sie zusammen.

Jede Person überschreibt nur die eigene Datei, deshalb gehen keine Änderungen verloren, auch wenn mehrere gleichzeitig
arbeiten. Beim Zusammenführen gilt:

- Dokumente mit gleicher ID: die neuere Version gewinnt (Titel, Notiz, Status «hochgeladen»).
- Gelöschte Dokumente werden auf allen Geräten entfernt und kommen auch aus alten Dateien nicht zurück.
- Standardordner sind auf allen Geräten identisch, eigene Ordner werden über Jahr und Name erkannt. Es entstehen keine Duplikate.
- In der Dokumentliste steht, **wer** ein Dokument abgelegt hat.

Die Startseite zeigt, wann zuletzt abgeglichen wurde und wie viele Änderungen seither anstehen. Die Dateien sind zugleich das Backup.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne Abhängigkeiten.

| Datei | Zweck |
|---|---|
| `index.html`, `styles.css` | Oberfläche (mobile first, Hell/Dunkel) |
| `app.js` | Ordner, Dokumente, Export, Abgleich |
| `scan.js` | Blatterkennung, Entzerrung, Schattenentfernung (ohne Bibliotheken) |
| `scanner.js` | Live-Scanner, automatische Auslösung, Ecken-Prüfbild |
| `ui.css` | Oberfläche für Einsteiger (Schritte, Einführung, Hilfe, Hochladen) |
| `db.js` | IndexedDB-Zugriff |
| `pdfwriter.js` | Eigener PDF-Writer (JPEG-Seiten auf A4) |
| `zip.js` | ZIP schreiben (Store) und lesen (Store/Deflate) |
| `sw.js`, `manifest.webmanifest` | Offline-Betrieb und Installation als App |

Bei Änderungen an den Dateien die Cache-Version in `sw.js` (`steuerordner-v6`) hochzählen,
damit installierte Apps die neue Version laden.

## Scan-Qualität

- Aufbereitung wählbar unter Einstellungen: **Dokument** (Schwarzweiss, Schatten entfernt), **Farbe** (Schatten entfernt)
  oder **Original** (nur zuschneiden und begradigen). Im Prüfbild lässt sich der Modus pro Seite wechseln.
- Die Blatterkennung braucht einen Untergrund, der sich vom Papier abhebt (z. B. dunkler Tisch). Bei weissem Blatt auf
  weissem Tisch oder sehr starkem Schatten findet sie den Rand nicht sicher, dann die Ecken von Hand ziehen.
- Ohne Kamerazugriff (z. B. Berechtigung verweigert) nimmt die App stattdessen ein Foto über die Kamera-App des Geräts auf
  und führt es durch dieselbe Erkennung.
