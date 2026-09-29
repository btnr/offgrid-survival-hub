# offgrid-survival-hub

Offline-fähiges, modulares Survival-Dashboard als Progressive Web App (Local-First).

- **Keine Abhängigkeiten, kein Build-Schritt** – reines HTML/CSS/JS.
- **100 % offline** nach dem ersten Aufruf (Service Worker cacht die App-Shell).
- **Daten bleiben im Browser** (IndexedDB, Fallback localStorage) – Backup per JSON-Export/-Import.
- **Survival Dark Mode** (OLED-Schwarz) + optionaler Rotlicht-Nachtsichtmodus.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Dashboard und generische Modul-Ansicht |
| `styles.css` | Survival Dark Mode, mobil-first |
| `app.js` | Routing, Modul-Registry, Offline-Datenbank, Backup |
| `service-worker.js` | Precache der App-Shell, Cache-First |
| `manifest.webmanifest`, `icon.svg` | Installierbarkeit („Zum Startbildschirm hinzufügen“) |

## Lokal starten

Service Worker brauchen `http://localhost` oder HTTPS (nicht `file://`):

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

## Deployment (GitHub Pages)

Settings → Pages → „Deploy from a branch“ → `main` / `/ (root)`.
Alle Pfade sind relativ, die App läuft daher auch unter `https://<user>.github.io/offgrid-survival-hub/`.

**Nach jeder Code-Änderung** `CACHE_VERSION` in `service-worker.js` erhöhen, damit Geräte die neue Version laden.

## Neues Modul hinzufügen

Einen Eintrag im Objekt `MODULES` in `app.js` ergänzen (Name, Icon, Felder). Formular, Speicherung, Liste und Dashboard-Kachel entstehen automatisch.
