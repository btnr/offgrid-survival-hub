# offgrid-survival-hub

Offline-fähiges, modulares Survival-Dashboard als Progressive Web App (Local-First).

- **Keine Abhängigkeiten, kein Build-Schritt** – reines HTML/CSS/JS.
- **100 % offline** nach dem ersten Aufruf (Service Worker cacht die App-Shell).
- **Daten bleiben im Browser** (IndexedDB, Fallback localStorage) – Backup per JSON-Export/-Import.
- **Survival Dark Mode** (OLED-Schwarz) + optionaler Rotlicht-Nachtsichtmodus.

## Was macht welche Datei? (ohne Programmierkenntnisse)

Stell dir die App wie ein kleines Notizbuch vor, das im Browser deines Handys wohnt.

| Datei | Was sie macht – in einfachen Worten |
|---|---|
| `index.html` | Das **Gerüst** der App. Legt fest, *was* auf dem Bildschirm steht: Überschrift, Kacheln, System-Bereich, Knöpfe. |
| `styles.css` | Die **Optik**. Legt fest, *wie* es aussieht: schwarzer Hintergrund, grüne und orange Schrift, Abstände, damit auf dem Handy nichts unter der Kamera-Aussparung verschwindet. |
| `app.js` | Das **Gehirn**. Reagiert auf Tippen, speichert Einträge im Browser, prüft Backups beim Import, zeigt Warnungen und Fehlermeldungen an. |
| `service-worker.js` | Der **Offline-Helfer**. Legt beim ersten Besuch eine Kopie der App auf dem Gerät ab. Danach startet die App auch ohne Internet. Meldet, wenn eine neue Version bereitliegt. |
| `manifest.webmanifest` | Der **Ausweis** der App. Sagt dem Handy Name, Farbe und Symbol, damit man sie wie eine normale App auf den Homescreen legen kann. |
| `icon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png` | Das **App-Symbol** in verschiedenen Größen (iPhone braucht PNG). |
| `README.md` | Diese **Anleitung**. |

## Lokal starten

Service Worker brauchen `http://localhost` oder HTTPS (nicht `file://`):

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

## Deployment (GitHub Pages)

Settings → Pages → „Deploy from a branch“ → `main` / `/ (root)`.
Alle Pfade sind relativ, die App läuft daher auch unter `https://<user>.github.io/offgrid-survival-hub/`.

**Nach jeder Code-Änderung** `CACHE_VERSION` in `service-worker.js` erhöhen (z. B. `v2` → `v3`).
Geräte zeigen dann „Neue Version verfügbar – Neu laden“. Welche Version gerade läuft,
steht im System-Bereich unter **App-Version**.

## Auf dem Handy installieren

- **iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm“. Nur so startet die App ohne Safari-Leiste.
- **Android (Chrome):** Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

Ob es geklappt hat, steht im System-Bereich unter **Start-Modus**: „Homescreen-App“ statt „Browser-Tab“.

## Datensicherheit

- **Dauerhaft:** Die App bittet den Browser, die Daten nicht automatisch zu löschen. Im System-Bereich steht, ob der Browser das **gewährt** hat oder nicht.
- **Backup:** Wurde seit mehr als 7 Tagen (oder noch nie) exportiert, erscheint auf dem Dashboard eine orange Warnung mit „Jetzt exportieren“. Die Warnung erscheint nur, wenn es überhaupt Einträge gibt.
- **Import:** Die Datei wird *vollständig geprüft, bevor* etwas gespeichert wird. Kaputte, fremde oder zu neue Dateien werden abgelehnt, die vorhandenen Daten bleiben unverändert. Das Ersetzen passiert in einem Schritt: entweder alles oder nichts.
- **schemaVersion:** Jeder Eintrag trägt eine Formatversion. Ändert sich das Format später, werden alte Einträge und alte Backups automatisch umgewandelt statt unlesbar zu werden (siehe `migrateEntry()` in `app.js`).

## Neues Modul hinzufügen

Einen Eintrag im Objekt `MODULES` in `app.js` ergänzen (Name, Icon, Felder). Formular, Speicherung, Liste und Dashboard-Kachel entstehen automatisch.

## Bekannte Grenzen

Ehrlich gesagt – das sollte man wissen, bevor man sich im Ernstfall auf die App verlässt:

- **Browser-Daten können verloren gehen.** Die Einträge liegen nur im Speicher *dieses einen Browsers auf diesem einen Gerät*. Sie sind weg, wenn
  - du „Verlauf / Websitedaten löschen“ wählst,
  - du die App vom Homescreen entfernst (iPhone),
  - der Browser bei Speichermangel aufräumt (vor allem, wenn „Dauerhaft“ auf *nicht gewährt* steht),
  - **Safari auf dem iPhone** die Seite einige Wochen nicht geöffnet wurde – Safari löscht dann Website-Daten von selbst. Als Homescreen-App ist das Risiko geringer, aber nicht garantiert null,
  - das Handy verloren geht oder kaputt ist.

  **Das einzige echte Gegenmittel ist ein regelmäßiges Backup**, das *außerhalb* des Browsers liegt (anderes Gerät, USB-Stick, Ausdruck).
- **Die App weiß nicht, ob das Backup wirklich gespeichert wurde.** Sie merkt sich nur, dass „Exportieren“ gedrückt wurde. Bricht man den Download ab, hält sie das Backup trotzdem für erledigt.
- **Kein Abgleich zwischen Geräten.** Zwei Handys haben zwei getrennte Datenbestände. Übertragen geht nur per Export/Import – und der Import *ersetzt* alle Daten, er führt nichts zusammen.
- **Einträge können nicht bearbeitet werden**, nur angelegt und gelöscht.
- **Keine Karte.** Das Map-Modul speichert nur Koordinaten. Eine Offline-Karte ist nicht enthalten; der Link „In Karten-App öffnen“ braucht eine installierte Offline-Karten-App (z. B. Organic Maps, OsmAnd).
- **Erster Aufruf braucht Internet.** Offline funktioniert die App erst, nachdem sie einmal online geladen wurde.
- **Keine Verschlüsselung.** Wer das entsperrte Gerät in der Hand hat, kann die Daten lesen – auch die exportierte Backup-Datei ist Klartext.
- **Notlösung localStorage:** Kann der Browser keine IndexedDB öffnen (z. B. manche private Modi), speichert die App in localStorage. Das fasst nur ca. 5 MB; der System-Bereich zeigt das in Orange an.
- **Backup-Export auf dem iPhone:** In der Homescreen-App öffnet iOS beim Export je nach Version eine Vorschau statt direkt zu speichern. Dort über „Teilen“ → „In Dateien sichern“ ablegen. Nicht auf einem echten iPhone getestet.
