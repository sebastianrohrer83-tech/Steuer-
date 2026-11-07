# CLAUDE.md – Ordni (früher Steuerordner)

## Worum es geht
Ordni ist eine private Web-App (PWA) zum Scannen und Ablegen von Steuerbelegen. Sie läuft komplett im Browser ohne Server, alle Scans bleiben auf dem Gerät. Sie ist auf dem Handy installierbar und funktioniert offline. Details stehen in `README.md`.

**Dieses Repo ist öffentlich.** Lege nie echte Steuerdaten, Belege, Zugangsdaten, persönliche Angaben oder Geschäftsinterna ins Repo, auch nicht in Tests, Beispielen, Commit-Nachrichten oder Pull Requests.

## Regeln
- Datenschutz zuerst: keine Server, keine Übertragung von Belegen, keine Tracker. Neue externe Abhängigkeiten nur nach Rückfrage.
- Keine Änderung, die gespeicherte Daten oder Sync-Dateien unlesbar macht. Ältere Formate (`Steuerordner_Sync_…`, Version 1.13 und früher) bleiben lesbar.
- Technische Namen `steuerordner` (Datenbank, Kennung `app`) bleiben unverändert.
- Dialoge mit Eingabefeld sitzen oben und folgen `visualViewport` (iPhone-Tastatur). Nicht ändern, ohne das Verhalten auf einem iPhone oder im Test zu prüfen.
- Dateien der Offline-Liste (`sw.js`) müssen laden. Das README nennt `test-keyboard.js` und `test-brand.js`, sie liegen aber nicht im Repo. Fehlende Tests zuerst vorschlagen, nicht stillschweigend neu erfinden.
- Texte in der App: Deutsch, Schweizer Rechtschreibung (ss statt ß), einfache Sprache, keine Steuerberatung und keine Kantonsbindung.
- Marke Ordni: Name, Logo und Farben in `brand/`.

## Arbeitsweise
Kleine Schritte auf einem Branch, nie direkt auf `main`. Zuerst lesen, dann ändern. Vor jeder Abgabe Tests ausführen und das Ergebnis nennen.

## Team (Subagenten in `.claude/agents/`)
`software-entwickler`, `software-tester`, `lektorat`.

## Freigaben
Sebastian gibt frei: Merge nach `main`, neue Versionen, Löschen von Dateien, Änderungen am Sync-Format.
