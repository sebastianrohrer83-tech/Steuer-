# Steuerordner

Private Web-App zum Scannen und Ablegen von Steuerbelegen – vorbereitet für die
Online-Steuererklärung. Die Ordner und die Checkliste zeigen die typischen Unterlagen und sind für alle
Kantone gleich. Es gibt keine Kantonswahl und keinen Link zu einem bestimmten Steuerportal.

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
   - Im Online-Portal deines Kantons die PDFs bei den jeweiligen Positionen als Beilage hochladen.
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

## Checkliste und Zahlen fürs Portal

- **Persönliche Checkliste:** In der Einführung (oder später auf der Startseite) beantwortest du neun Fragen (angestellt,
  selbständig, Rente, Wertschriften, Säule 3a, Wohneigentum, Kinder, Unterhalt zahlen, Unterhalt erhalten). Daraus entsteht eine Liste der Belege, die typischerweise
  gebraucht werden. Pro Punkt: «Scannen», «Aus Fotos» oder «Trifft nicht zu». Ein so abgelegter Beleg trägt den Namen des
  Punktes und weiss, welche Zahl einzutragen ist. Ein neues Steuerjahr übernimmt die Angaben des Vorjahres.
- **Beträge:** Jeder Beleg hat ein optionales Feld «Betrag in CHF».
- **Zahlen fürs Portal:** Eine Seite mit allen erfassten Beträgen pro Ordner, zum Drucken, als PDF sichern oder als Text kopieren.
- Angaben, Haken und Beträge werden wie die Belege mit der Familie abgeglichen.
- Die Checkliste ist eine allgemeine Orientierung (typische Unterlagen in der Schweiz) und keine Steuerberatung. Sie ist nicht
  auf einen Kanton zugeschnitten. Fristen und Vorgaben des Kantons gehen vor.

## Personen und automatische Namen

- **Personen im Haushalt:** Beim ersten Scan fragt die App einmalig nach den Namen (z. B. «Anna Muster, Ben Muster»). Die Liste
  lässt sich in den Einstellungen ändern (hinzufügen, umbenennen, entfernen) und wird mit der Familie abgeglichen.
- **Zuordnung:** Nach dem Scan tippst du auf die Person (die zuletzt gewählte steht oben). Bei nur einer Person entfällt die Frage.
  Im Beleg lässt sich die Person ändern.
- **Automatischer Name:** «Krankenkasse 2025 – Anna Muster». Der erste Teil kommt vom Checklistenpunkt oder vom Ordner, dazu das
  Steuerjahr und die Person. Gleiche Namen bekommen «(2)», «(3)». Das PDF heisst genauso.
- **Ordner und Zahlen:** Im Ordner lässt sich nach Person filtern. «Zahlen fürs Portal» trennt die Beträge nach Person.
- Der Name entsteht aus Ordner, Jahr und Person. Der Inhalt des Scans wird nicht gelesen (keine Texterkennung).

## Gemeinsam im Haushalt (geteilter iCloud-Ordner)

Die App hat keinen Server. Alle im Haushalt nutzen einen gemeinsamen Ordner in iCloud Drive:

1. **Einmalig:** In der Dateien-App einen Ordner «Steuer» in iCloud Drive anlegen, gedrückt halten, «Teilen» →
   «Zusammenarbeiten» → Personen aus dem Haushalt einladen.
2. In der App unter **Einstellungen** den eigenen **Namen** eintragen.
3. **Jetzt speichern** (Knopf auf der Startseite, sobald der Speicherort festgelegt ist):
   - *Chrome auf Android oder am Computer:* Beim ersten Mal den Ordner «Steuer» wählen. Danach liest die App dort die
     Dateien der anderen Geräte ein und schreibt ihre eigene Datei. Solange der Browser die Erlaubnis noch hat, geschieht
     das auch von selbst: beim Öffnen, jede Minute und beim Verlassen der App. Nach einem Neustart des Browsers genügt
     ein Tipp auf den Knopf.
   - *iPhone/iPad (Safari):* Safari kann keinen Ordner dauerhaft beschreiben. Der Knopf öffnet einen Assistenten:
     Schritt 1 «Dateien wählen» (im Ordner alle Dateien markieren), Schritt 2 «Meine Datei sichern» («In Dateien
     sichern» → Ordner «Steuer», ältere Datei ersetzen). Erst nach Schritt 2 gilt der Stand als gesichert.

Jedes Gerät schreibt nur **seine eigene** Datei `Steuerordner_Sync_<Name>_<Gerätekürzel>.zip`. Deshalb überschreiben sich
auch zwei Geräte mit demselben Namen nie, und es gehen keine Änderungen verloren, wenn mehrere gleichzeitig arbeiten.
Beim Zusammenführen gilt:

- Dokumente mit gleicher ID: die neuere Version gewinnt (Titel, Notiz, Status «hochgeladen»).
- Gelöschte Dokumente, Ordner und Steuerjahre werden auf allen Geräten entfernt und kommen auch aus alten Dateien nicht zurück.
- Ordner umbenennen, Symbol und Hinweistext ändern wird übernommen (neuere Fassung gewinnt), es entstehen keine Duplikate.
- Standardordner sind auf allen Geräten identisch, eigene Ordner werden über ihre ID erkannt.
- In der Dokumentliste steht, **wer** ein Dokument abgelegt hat.

Die Startseite zeigt, wann zuletzt gespeichert wurde und wie viele Änderungen seither anstehen. Die Dateien sind zugleich das Backup.

Getestet (Playwright, drei Geräte plus ein iPhone-Fall ohne Ordnerzugriff, gemeinsamer Ordner auf der Festplatte):
Dokumente anlegen und abgleichen, Hintergrund-Abgleich, Löschen von Belegen und Ordnern, Umbenennen, zwei Geräte mit
gleichem Namen, Abbrechen im Assistenten. Auf einem echten iPhone und mit echtem iCloud-/Google-Drive-Ordner ist es nicht geprüft.

## Anderer Dienst (OneDrive, Dropbox …)

Neben iCloud Drive und Google Drive gibt es die Auswahl «Familie mit anderem Dienst». Der Ablauf ist derselbe: gemeinsamer Ordner
«Steuer», jedes Gerät schreibt seine eigene Datei hinein. Die App sieht nur den Ordner, nicht den Dienst. Er muss in der Dateien-App
(iPhone), im Dateimanager (Android) oder als Ordner am Computer erscheinen. Getestet ist nur mit einem nachgestellten Ordner, nicht mit echtem
OneDrive oder Dropbox.

## Absprung zu Google Drive

Wer «Familie mit Google Drive» wählt, sieht auf der Startseite und in den Einstellungen den Knopf **Google Drive öffnen**. Er öffnet
Drive in einem neuen Tab bzw. in der Drive-App. In den Einstellungen lässt sich zusätzlich der Link zum gemeinsamen Ordner
speichern (in Drive: Teilen, Link kopieren); dann öffnet der Knopf direkt diesen Ordner. Es werden nur Adressen von
`drive.google.com` und `docs.google.com` angenommen. Der Link bleibt auf dem Gerät gespeichert. Ob die Drive-App auf dem Handy den
Link direkt öffnet, hängt vom Gerät ab.

## Verschlüsselte Sync-Dateien

- Unter Einstellungen bei «Verschlüsselung» (oder beim ersten Abgleich) legst du ein Passwort fest. Alle in der Familie
  verwenden dasselbe. Die Dateien im gemeinsamen Ordner sind dann mit **AES-256-GCM** verschlüsselt, der Schlüssel entsteht
  per **PBKDF2-SHA-256** (300 000 Durchläufe, eigener Salt pro Datei) im Browser. Das Passwort verlässt das Gerät nie.
- Verschlüsselte Dateien heissen `Steuerordner_Sync_<Name>_<Kürzel>.zip.enc`. Beim Einschalten wird die lesbare Fassung der
  eigenen Datei aus dem Ordner entfernt (Chrome); auf dem iPhone löschst du sie selbst in der Dateien-App.
- Die App erkennt verschlüsselte Dateien am Dateikopf und fragt beim Abgleich nach dem Passwort, falls es fehlt. Ein falsches
  Passwort wird abgelehnt und nicht gespeichert. Lesbare (alte) Dateien werden weiter gelesen.
- Das Passwort liegt auf dem Gerät in der App-Datenbank, damit sich die App im Hintergrund abgleichen kann. Wer das entsperrte
  Gerät benutzen kann, hat damit auch Zugriff auf die Belege selbst. Geschützt wird der **Ordner in der Cloud**, nicht das Handy.
- Ohne Passwort lassen sich die Dateien im Ordner nicht wiederherstellen. Die Belege in den Apps bleiben erhalten.
- Nicht verschlüsselt sind die Daten in der App auf dem Gerät und PDFs, die du selbst teilst.

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
