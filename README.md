# Ordni (früher Steuerordner)

Private Web-App zum Scannen und Ablegen von Steuerbelegen – vorbereitet für die
Online-Steuererklärung. Die Ordner und die Checkliste zeigen die typischen Unterlagen und sind für alle
Kantone gleich. Es gibt keine Kantonswahl und keinen Link zu einem bestimmten Steuerportal.

- Läuft komplett im Browser, ohne Server. Alle Scans bleiben auf dem Gerät.
- Auf dem Handy installierbar (PWA, «Zum Home-Bildschirm hinzufügen»), funktioniert offline.
- Pro Steuerjahr sind die Standardordner bereits angelegt; eigene Ordner lassen sich ergänzen.
- Belege per Kamera scannen oder Fotos/PDFs aus der Galerie ablegen, mehrseitig, drehbar.
- Export als PDF pro Beleg oder als ZIP-Paket pro Ordner / pro Steuerjahr – bereit zum Hochladen.
- Status «hochgeladen» pro Dokument, Fortschrittsanzeige, Backup und Wiederherstellung.

## Dialoge und Tastatur (iPhone)

Auf dem iPhone legt sich die Tastatur über den Seitenrand, ohne die Seite zu verkleinern. Ein Dialog am unteren Rand wäre dann verdeckt
(Feld und Knöpfe unsichtbar). Dialoge mit Eingabefeld sitzen deshalb oben, folgen dem sichtbaren Bereich (`visualViewport`) und
behalten die Knöpfe am unteren Rand des Dialogs sichtbar. Dialoge ohne Eingabefeld bleiben unten. Der Test `test-keyboard.js` bildet die
Tastatur mit einem nachgebauten `visualViewport` nach, nicht mit einer echten iOS-Tastatur.

## Marke Ordni

Die App heisst **Ordni** («der Steuerordner für die Familie»). Name, Logo und Farben stehen in `brand/`: Wortmarke (`wordmark*.svg`), Symbol
(`symbol*.svg`), beides zusammen (`lockup*.svg`) und das App-Symbol (`app-icon.svg`, `app-icon-1024.png` für den App Store). Das Logo
ist ein Ordner mit zwei Platten und einem Haken; die Wortmarke ist aus Linien gezeichnet und braucht keine Schrift.

**Sync-Dateien:** Sie heissen jetzt `Ordni_Sync_<Name>_<Kürzel>.zip` (verschlüsselt `….zip.enc`). Dateien mit dem alten Namen
`Steuerordner_Sync_…` (Version 1.13 und früher) liest die App weiter, und beim nächsten Speichern ersetzt sie die eigene alte Datei durch
die neue. Auf dem iPhone kann sie die alte Datei nicht selbst löschen: Dort bleibt sie liegen, bis man sie im Ordner entfernt. Sie
schadet nicht, denn die neuere Fassung gewinnt. **Ältere App-Versionen kennen den neuen Namen nicht** und sehen die neuen Dateien nicht:
Alle in der Familie sollten die App aktualisieren.

**Was bewusst gleich bleibt:** Die technischen Namen `steuerordner` (Datenbank, Kennung `app` in den Sync-Dateien).

**Hinweis für Nutzer:** Das Symbol und der Name einer auf dem iPhone schon installierten App ändern sich nicht von selbst. Wer das neue
Symbol sehen will, legt die App neu auf den Home-Bildschirm (vorher sichern). Der Name ist noch nicht als Marke geprüft (Swissreg).
Der Test `test-brand.js` prüft Name, Symbole, Manifest und dass jede Datei der Offline-Liste lädt.

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
3. **Jetzt sichern** (Knopf auf der Startseite, sobald der Speicherort festgelegt ist):
   - *Chrome auf Android oder am Computer:* Beim ersten Mal den Ordner «Steuer» wählen. Danach liest die App dort die
     Dateien der anderen Geräte ein und schreibt ihre eigene Datei. Solange der Browser die Erlaubnis noch hat, geschieht
     das auch von selbst: beim Öffnen, jede Minute und beim Verlassen der App. Nach einem Neustart des Browsers genügt
     ein Tipp auf den Knopf.
   - *iPhone/iPad (Safari):* Safari kann keinen Ordner dauerhaft beschreiben. Der Knopf öffnet einen Assistenten:
     Schritt 1 «Dateien wählen» (im Ordner alle Dateien markieren), Schritt 2 «Meine Datei sichern» («In Dateien
     sichern» → Ordner «Steuer», ältere Datei ersetzen). Erst nach Schritt 2 gilt der Stand als gesichert.

Jedes Gerät schreibt nur **seine eigene** Datei `Ordni_Sync_<Name>_<Gerätekürzel>.zip`. Deshalb überschreiben sich
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

## Checkliste pro Person

- Sind zwei oder mehr Personen eingetragen, hat jede ihre **eigene Checkliste** mit eigenen Angaben («angestellt», «selbständig» …) und
  eigenen Haken («Trifft nicht zu»). Oben wählt man die Person. Bei nur einer Person oder ohne Personen gibt es weiter die gemeinsame
  Checkliste.
- Ein Beleg zählt für die Person, der er zugeordnet ist. **Belege ohne Person zählen für alle** (zum Beispiel ältere Belege aus der Zeit
  vor der Personenliste).
- Scannt man aus einer Checkliste, steht die Person fest; die Frage «Wem gehört der Beleg?» entfällt.
- Die Startseite zeigt den Stand der gewählten Person und kurz die der anderen.
- Eine neue Person übernimmt als Vorgabe die frühere gemeinsame Angabe. Neue Steuerjahre übernehmen die Angaben der Personen. Beim Umbenennen einer Person ziehen Angaben, Haken und Belege mit. Alles wird mit der Familie abgeglichen.
- **Gleichzeitige Anzeigen:** Die Seitenanzeige läuft jetzt nacheinander. Vorher konnte eine ältere, noch laufende Anzeige die neuere
  überschreiben (zum Beispiel beim Wechsel der Seite während des Abgleichs).

## Papierkorb, Speicherfehler, Sicherungs-Erinnerung

- **Papierkorb:** Einen Beleg zu löschen legt ihn zuerst nur in den Papierkorb (Einstellungen, «Papierkorb»). Dort bleibt er 30 Tage und
  lässt sich zurückholen. Die Markierung wird wie jede Änderung mit der Familie abgeglichen. Danach wird er endgültig gelöscht
  (automatisch beim nächsten Öffnen der App) und die Löschung geht an die anderen Geräte. Wer einen Ordner oder ein Steuerjahr löscht,
  schickt dessen Belege in den Papierkorb; Zurückholen stellt Ordner und Jahr bei Bedarf wieder her. Ein Steuerjahr löscht man nur, wenn
  man das Jahr eintippt. Ältere App-Versionen auf anderen Geräten kennen den Papierkorb nicht und zeigen solche Belege weiter an.
- **Speicher voll:** Scheitert das Speichern, weil der Speicher des Geräts voll ist, zeigt die App eine klare Meldung und legt keinen halben
  Beleg an. Ab 90 % Belegung erscheint eine Warnung auf der Startseite. Beim ersten Beleg bittet die App den Browser einmalig um
  dauerhaften Speicher.
- **Sicherungs-Erinnerung:** Gibt es Belege und wurde nie gesichert, oder liegt die letzte Sicherung 14 Tage zurück und es hat sich seither
  etwas geändert, zeigt die Startseite eine Warnung mit dem Knopf «Jetzt sichern».

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
- Verschlüsselte Dateien heissen `Ordni_Sync_<Name>_<Kürzel>.zip.enc`. Beim Einschalten wird die lesbare Fassung der
  eigenen Datei aus dem Ordner entfernt (Chrome); auf dem iPhone löschst du sie selbst in der Dateien-App.
- Die App erkennt verschlüsselte Dateien am Dateikopf und fragt beim Abgleich nach dem Passwort, falls es fehlt. Ein falsches
  Passwort wird abgelehnt und nicht gespeichert. Lesbare (alte) Dateien werden weiter gelesen.
- Das Passwort liegt auf dem Gerät in der App-Datenbank, damit sich die App im Hintergrund abgleichen kann. Wer das entsperrte
  Gerät benutzen kann, hat damit auch Zugriff auf die Belege selbst. Geschützt wird der **Ordner in der Cloud**, nicht das Handy.
- Ohne Passwort lassen sich die Dateien im Ordner nicht wiederherstellen. Die Belege in den Apps bleiben erhalten.
- Nicht verschlüsselt sind die Daten in der App auf dem Gerät und PDFs, die du selbst teilst.

## Datenschutzseite

Unter `#/privacy` (Einstellungen, «Datenschutz lesen»; auch aus der Hilfe und der Einführung) beschreibt die App in einfachen Worten, was
gespeichert wird, was sie nicht tut, was beim Aufrufen passiert (Hosting bei Vercel, USA), wie Abgleich, Kamera und Teilen funktionieren,
wie man löscht und welche Rechte man hat (Schweizer Datenschutzgesetz, EDÖB). Der Test `test-privacy.js` belegt die Kernaussagen: Rundgang
durch alle Seiten ohne Anfragen an fremde Adressen, keine Cookies, im Browser-Speicher höchstens der Zeitstempel des Installationshinweises.

**Noch zu tun:** In `app.js` die Konstante `OPERATOR` (Name, Adresse, E-Mail der Betreiberin oder des Betreibers) ausfüllen. Leere Felder
werden nicht angezeigt; solange alles leer ist, steht ein neutraler Hinweis. Der Text ist eine verständliche Beschreibung der
Funktionsweise und keine Rechtsberatung. Vor einem Verkauf sollte ihn eine Fachperson prüfen.

## Tipp «So fängst du an»

Auf der Startseite steht ganz oben der Tipp «So fängst du an» mit dem Kästchen «Gelesen, nicht mehr anzeigen». Er bleibt, bis man das
Kästchen abhakt (auch wenn schon Belege da sind), und das gilt pro Gerät. «Einführung nochmals ansehen» (Einstellungen oder Hilfe) schaltet
ihn wieder ein.

## Fotoauswahl auf dem iPhone

Safari öffnet die Fotoauswahl nur, wenn sie direkt beim Tippen angefordert wird, nicht erst nach einer Datenbank-Abfrage. Die App
startet die Auswahl deshalb zuerst und stellt danach Fragen (zum Beispiel einmalig «Für wen sammelst du Belege?»). Fällt die Kamera
aus, erscheint ein Knopf «Foto aufnehmen». Der Test `test-pick.js` bildet die strenge Regel nach. Auf einem echten iPhone ist es
nicht geprüft.

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

## Abgleich beim Start

Bei den Speicherorten iCloud Drive, Google Drive und «Anderer Dienst» fragt die App beim Start, ob die Dateien der Familie zusammengeführt werden sollen (nicht öfter als alle drei Minuten, «Später» und «Nicht mehr fragen» sind möglich; Schalter unter Einstellungen).

- **iPhone/iPad:** Eine Web-App darf keinen Ordner von selbst lesen. Die Frage führt darum direkt zu «Dateien wählen»; der gemeinsame Ordner wird jedes Mal neu geöffnet und alle Dateien werden markiert. Verschlüsselte Dateien: die App fragt das Passwort ab.
- **Chrome am Computer:** Hat der Browser den Ordnerzugriff behalten, läuft der Abgleich im Hintergrund ohne Frage. Sonst fragt die App und gleicht mit «Jetzt abgleichen» ab.

## Automatisch speichern (alle zwei Sekunden)

Mit Chrome am Computer (Ordnerzugriff) schreibt die App ihre Sync-Datei zwei Sekunden nach der letzten Änderung von selbst in den gemeinsamen Ordner und liest dabei die Dateien der anderen ein. Hat der Browser den Ordnerzugriff verloren, erscheint ein Hinweis; ein Tipp auf «Jetzt sichern» gibt ihn wieder frei. Auf dem iPhone ist das nicht möglich, weil eine Web-App dort nicht selbst in die Dateien-App schreiben darf; dort bleibt es bei «Jetzt sichern».

## Seiten nachbearbeiten

Bei jeder gescannten Seite steht «Bearbeiten». Es öffnet das Originalfoto mit den Ecken und dem Filter (Dokument, Farbe, Original) von damals: Ecken neu setzen, Filter wechseln, übernehmen. Seiten, die gedreht wurden, drehen das Originalfoto mit. Das Originalfoto bleibt nur auf dem Gerät (nicht in der Sync-Datei, nicht im PDF) und braucht etwa doppelt so viel Platz wie die Seite; unter Einstellungen lässt es sich abschalten. Ältere Seiten ohne Originalfoto lassen sich zuschneiden und mit einem anderen Filter neu aufbereiten.

## Weniger Tipps beim Speichern (iPhone)

Hat man die Dateien der anderen in den letzten 20 Minuten geholt (zum Beispiel bei der Frage beim Start), entfällt Schritt 1 in «Jetzt sichern»: Der Assistent zeigt nur noch «Meine Datei sichern», mit «Nochmals holen» als Ausweg. iOS merkt sich den zuletzt gewählten Ordner im Teilen-Menü und in der Dateiauswahl; ab dem zweiten Mal bleibt es bei etwa vier Tipps pro Richtung. Mehr geht mit einer Web-App auf dem iPhone nicht, weil sie nicht selbst in die Dateien-App schreiben darf.

## Zahlen fürs Portal als PDF

«Drucken» (window.print) funktioniert in der Home-Bildschirm-App auf dem iPhone nicht. Darum erzeugt die App aus den Zahlen ein PDF (A4, Seiten als Bilder gezeichnet) und öffnet das Teilen-Menü («In Dateien sichern»). Das PDF wird schon beim Öffnen der Seite vorbereitet, damit das Teilen-Menü direkt beim Tippen aufgeht; «Drucken» erscheint nur noch im Browser.

## Wortwahl

Der Knopf auf der Startseite heisst «Jetzt sichern», im Assistenten «Meine Datei sichern» (früher «Jetzt speichern» und «Meine Datei speichern»).
