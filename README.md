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
2. **Ordner öffnen → Scannen.** Die Kamera öffnet sich, das Foto wird zugeschnitten auf max. 2200 px,
   im Dokument-Modus in Schwarzweiss mit erhöhtem Kontrast gespeichert (abschaltbar in den Einstellungen).
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

## Backup

Alle Daten liegen im Browser-Speicher (IndexedDB) des Geräts. Vor dem Löschen von Browserdaten oder
einem Gerätewechsel unter **Einstellungen → Backup erstellen** ein ZIP sichern. Dieses lässt sich auf
jedem Gerät über **Backup wiederherstellen** wieder einspielen (alle Jahre, Ordner, Dokumente und Status).
«Speicher dauerhaft schützen» bittet den Browser, die Daten nicht bei Platzmangel zu löschen.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne Abhängigkeiten.

| Datei | Zweck |
|---|---|
| `index.html`, `styles.css` | Oberfläche (mobile first, Hell/Dunkel) |
| `app.js` | Ordner, Dokumente, Scan-Verarbeitung, Export, Backup |
| `db.js` | IndexedDB-Zugriff |
| `pdfwriter.js` | Eigener PDF-Writer (JPEG-Seiten auf A4) |
| `zip.js` | ZIP schreiben (Store) und lesen (Store/Deflate) |
| `sw.js`, `manifest.webmanifest` | Offline-Betrieb und Installation als App |

Bei Änderungen an den Dateien die Cache-Version in `sw.js` (`steuerordner-v1`) hochzählen,
damit installierte Apps die neue Version laden.
