/* ==========================================================
   Off-Grid Survival Hub – App-Logik
   - Hash-Routing (#/food, #/map, ...) ohne Framework
   - Local-First: IndexedDB, Fallback auf localStorage
   - Module werden deklarativ in MODULES definiert
   ========================================================== */
'use strict';

/* ---------------- Modul-Registry ----------------
   Neues Modul = neuer Eintrag hier. Felder erzeugen
   automatisch Formular, Speicherung und Liste.        */
const MODULES = {
  map: {
    name: 'MAP',
    icon: '⌖',
    hint: 'Wegpunkte, Treffpunkte, Wasserstellen. GPS funktioniert auch ohne Internet.',
    fields: [
      { key: 'name', label: 'Bezeichnung', type: 'text', required: true },
      { key: 'lat', label: 'Breite (Lat)', type: 'number', step: 'any', min: -90, max: 90 },
      { key: 'lon', label: 'Länge (Lon)', type: 'number', step: 'any', min: -180, max: 180 },
      { key: 'note', label: 'Notiz', type: 'textarea', full: true },
    ],
    gps: true,
    meta: (e) => [e.lat != null && e.lon != null ? `${(+e.lat).toFixed(5)}, ${(+e.lon).toFixed(5)}` : 'keine Koordinaten', e.note],
  },
  food: {
    name: 'FOOD',
    icon: '◈',
    hint: 'Vorräte mit Ablaufdatum. Orange = < 30 Tage, Rot = abgelaufen.',
    fields: [
      { key: 'name', label: 'Lebensmittel', type: 'text', required: true },
      { key: 'qty', label: 'Menge', type: 'number', step: 'any' },
      { key: 'unit', label: 'Einheit', type: 'select', options: ['Stk', 'kg', 'g', 'L', 'Dosen', 'Portionen'] },
      { key: 'expiry', label: 'Haltbar bis', type: 'date' },
    ],
    status: (e) => expiryStatus(e.expiry),
    meta: (e) => [`${e.qty ?? '?'} ${e.unit ?? ''}`.trim(), e.expiry && `MHD ${e.expiry}`],
  },
  water: {
    name: 'WATER',
    icon: '≈',
    hint: 'Trinkwasservorrat. Richtwert: 3 L pro Person und Tag.',
    fields: [
      { key: 'name', label: 'Quelle / Behälter', type: 'text', required: true },
      { key: 'liters', label: 'Liter', type: 'number', step: 'any' },
      { key: 'state', label: 'Zustand', type: 'select', options: ['Trinkbar', 'Aufbereiten', 'Brauchwasser'] },
    ],
    status: (e) => (e.state === 'Trinkbar' ? '' : 'warn'),
    meta: (e) => [`${e.liters ?? '?'} L`, e.state],
  },
  energy: {
    name: 'ENERGY',
    icon: 'ϟ',
    hint: 'Akkus, Powerbanks, Solar, Treibstoff. Orange < 30 %, Rot < 10 %.',
    fields: [
      { key: 'name', label: 'Gerät / Quelle', type: 'text', required: true },
      { key: 'level', label: 'Ladestand %', type: 'number', min: 0, max: 100 },
      { key: 'capacity', label: 'Kapazität (Wh/mAh/L)', type: 'text' },
    ],
    status: (e) => (e.level == null || e.level === '' ? '' : e.level < 10 ? 'crit' : e.level < 30 ? 'warn' : ''),
    meta: (e) => [e.level != null && e.level !== '' ? `${e.level} %` : '', e.capacity],
  },
  comm: {
    name: 'COMM',
    icon: '⌁',
    hint: 'Funkfrequenzen, Rufzeichen, Kontaktzeiten, Notfallkontakte.',
    fields: [
      { key: 'name', label: 'Kontakt / Kanal', type: 'text', required: true },
      { key: 'freq', label: 'Frequenz / Kanal', type: 'text' },
      { key: 'callsign', label: 'Rufzeichen', type: 'text' },
      { key: 'schedule', label: 'Sendezeit', type: 'text' },
      { key: 'note', label: 'Notiz', type: 'textarea', full: true },
    ],
    meta: (e) => [e.freq, e.callsign && `RZ ${e.callsign}`, e.schedule && `⏱ ${e.schedule}`, e.note],
  },
  med: {
    name: 'MED',
    icon: '✚',
    hint: 'Medikamente & Erste-Hilfe-Material mit Ablaufdatum.',
    fields: [
      { key: 'name', label: 'Medikament / Material', type: 'text', required: true },
      { key: 'qty', label: 'Anzahl', type: 'number' },
      { key: 'expiry', label: 'Haltbar bis', type: 'date' },
      { key: 'note', label: 'Dosierung / Hinweis', type: 'textarea', full: true },
    ],
    status: (e) => expiryStatus(e.expiry),
    meta: (e) => [e.qty != null && e.qty !== '' ? `${e.qty} Stk` : '', e.expiry && `Ablauf ${e.expiry}`, e.note],
  },
};

/* ---------------- Hilfsfunktionen ---------------- */
const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c != null && c !== '') node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

function expiryStatus(date) {
  if (!date) return '';
  const days = (new Date(date) - new Date()) / 86400000;
  return days < 0 ? 'crit' : days < 30 ? 'warn' : '';
}

let toastTimer;
function toast(msg, { error = false } = {}) {
  let t = $('.toast');
  if (!t) t = document.body.appendChild(el('div', { class: 'toast' }));
  t.setAttribute('role', error ? 'alert' : 'status');
  t.classList.toggle('error', error);
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), error ? 8000 : 2500);
}

/* Fehler IMMER sichtbar machen – nie still verschlucken */
function describeError(err) {
  if (err?.name === 'QuotaExceededError') return 'Speicher voll – bitte Backup exportieren und Einträge löschen.';
  return err?.message || String(err);
}
function showError(context, err) {
  console.error(`[${context}]`, err);
  toast(`⚠ ${context}: ${describeError(err)}`, { error: true });
}

/* ---------------- Datensatz-Schema ----------------
   Jeder Datensatz trägt "schemaVersion". Ändert sich das
   Format später, SCHEMA_VERSION erhöhen und in migrateEntry()
   einen Schritt ergänzen – alte Daten bleiben so lesbar.    */
const SCHEMA_VERSION = 1;

function migrateEntry(entry) {
  const e = { ...entry };
  if (!e.schemaVersion) e.schemaVersion = 1; // v0 (ohne Feld) → v1: nur Feld ergänzt
  // if (e.schemaVersion === 1) { …Umbau… ; e.schemaVersion = 2; }
  return e;
}

const META_KEYS = new Set(['id', 'module', 'created', 'schemaVersion']);
const MAX_TEXT = 10000;

function checkValue(field, value) {
  switch (field.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) &&
        (field.min == null || value >= field.min) && (field.max == null || value <= field.max);
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value));
    case 'select':
      return field.options.includes(value);
    default:
      return typeof value === 'string' && value.length <= MAX_TEXT;
  }
}

/* Gibt eine Fehlerbeschreibung zurück oder null, wenn der Eintrag gültig ist */
function validateEntry(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return 'kein gültiger Datensatz';
  const mod = MODULES[e.module];
  if (!mod) return `unbekanntes Modul „${e.module}"`;
  if (typeof e.name !== 'string' || !e.name.trim()) return 'Bezeichnung fehlt';
  if (e.schemaVersion != null && (!Number.isInteger(e.schemaVersion) || e.schemaVersion < 0)) return 'ungültige schemaVersion';
  if (e.schemaVersion > SCHEMA_VERSION) return 'stammt aus einer neueren App-Version';
  if (e.created != null && !Number.isFinite(e.created)) return 'ungültiger Zeitstempel';
  for (const [key, value] of Object.entries(e)) {
    if (META_KEYS.has(key)) continue;
    const field = mod.fields.find((f) => f.key === key);
    if (!field) return `unbekanntes Feld „${key}"`;
    if (!checkValue(field, value)) return `ungültiger Wert im Feld „${field.label}"`;
  }
  return null;
}

/* ---------------- Datenbank ----------------
   Einheitliche API: all(), add(), remove(), putAll(), replaceAll().
   IndexedDB bevorzugt; localStorage als Fallback
   (z. B. privater Modus in älteren Browsern).       */
const DB_NAME = 'offgrid-hub';
const DB_VERSION = 1;
const STORE = 'entries';

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB nicht verfügbar'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('module', 'module', { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Andere Instanz (z. B. neue App-Version im zweiten Tab) will upgraden
      db.onversionchange = () => {
        db.close();
        toast('Datenbank wurde in einem anderen Tab aktualisiert – bitte neu laden.', { error: true });
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Datenbank blockiert'));
  });
}

function idbStore(db) {
  // Alle Operationen einer Funktion laufen in EINER Transaktion:
  // entweder alles wird geschrieben oder nichts (Rollback).
  const run = (mode, fn) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result;
      try {
        result = fn(tx.objectStore(STORE));
      } catch (err) {
        tx.abort(); // sonst würden bereits angestoßene Schritte (z. B. clear) trotzdem gespeichert
        return reject(err);
      }
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Schreibvorgang abgebrochen'));
    });

  return {
    kind: 'IndexedDB',
    all: (module) => run('readonly', (s) => (module ? s.index('module').getAll(module) : s.getAll())),
    add: (entry) => run('readwrite', (s) => s.add(entry)),
    remove: (id) => run('readwrite', (s) => s.delete(id)),
    putAll: (entries) => run('readwrite', (s) => entries.forEach((e) => s.put(e))),
    replaceAll: (entries) => run('readwrite', (s) => {
      s.clear();
      entries.forEach((e) => s.add(e));
    }),
  };
}

function localStore() {
  const KEY = `${DB_NAME}:${STORE}`;
  const read = () => {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return [];
    const rows = JSON.parse(raw); // Kaputte Daten → Fehler statt stillem Überschreiben mit []
    if (!Array.isArray(rows)) throw new Error('Gespeicherte Daten sind beschädigt');
    return rows;
  };
  const write = (rows) => localStorage.setItem(KEY, JSON.stringify(rows));
  const withIds = (rows, start) => rows.map((e, i) => ({ ...e, id: e.id ?? start + i }));

  return {
    kind: 'localStorage',
    all: async (module) => read().filter((e) => !module || e.module === module),
    add: async (entry) => {
      const rows = read();
      const id = rows.reduce((m, e) => Math.max(m, e.id), 0) + 1;
      rows.push({ ...entry, id });
      write(rows);
      return id;
    },
    remove: async (id) => write(read().filter((e) => e.id !== id)),
    putAll: async (entries) => {
      const byId = new Map(read().map((e) => [e.id, e]));
      entries.forEach((e) => byId.set(e.id, e));
      write([...byId.values()]);
    },
    // Ein einziger setItem-Aufruf → schlägt er fehl, bleibt der alte Stand erhalten
    replaceAll: async (entries) => write(withIds(entries, 1)),
  };
}

async function initDB() {
  try {
    return idbStore(await openIndexedDB());
  } catch (err) {
    console.warn('[DB] Fallback auf localStorage:', err);
    return localStore();
  }
}

/* Bestehende Datensätze ohne/mit alter schemaVersion hochstufen */
async function migrateStoredEntries() {
  const outdated = (await db.all()).filter((e) => e.schemaVersion !== SCHEMA_VERSION);
  if (outdated.length) await db.putAll(outdated.map(migrateEntry));
}

/* ---------------- State ---------------- */
let db;
let currentModule = null;
let persistState = 'wird geprüft …';
let waitingWorker = null;

/* ---------------- Backup-Zeitpunkt ---------------- */
const BACKUP_KEY = 'offgrid:lastBackup';
const BACKUP_MAX_AGE_DAYS = 7;

function getLastBackup() {
  try {
    const ts = Number(localStorage.getItem(BACKUP_KEY));
    return ts > 0 ? ts : null;
  } catch {
    return null;
  }
}

function setLastBackup(ts) {
  try {
    localStorage.setItem(BACKUP_KEY, String(ts));
  } catch (err) {
    showError('Backup-Zeitpunkt nicht gespeichert', err);
  }
}

function daysSince(ts) {
  return Math.floor((Date.now() - ts) / 86400000);
}

function renderBackupWarning(entryCount) {
  const last = getLastBackup();
  const banner = $('#backup-banner');
  // Ohne Daten gibt es nichts zu sichern
  if (!entryCount || (last && daysSince(last) < BACKUP_MAX_AGE_DAYS)) {
    banner.hidden = true;
    return;
  }
  $('#backup-banner-text').textContent = last
    ? `⚠ Letztes Backup vor ${daysSince(last)} Tagen.`
    : '⚠ Noch kein Backup erstellt.';
  banner.hidden = false;
}

/* ---------------- Dashboard ---------------- */
async function renderDashboard() {
  const all = await db.all();
  const grid = $('#module-grid');
  grid.replaceChildren(
    ...Object.entries(MODULES).map(([id, mod]) => {
      const rows = all.filter((e) => e.module === id);
      const alerts = mod.status ? rows.filter((e) => mod.status(e)).length : 0;
      return el(
        'button',
        { class: 'tile', type: 'button', onclick: () => navigate(id) },
        el('span', { class: 'tile-icon', 'aria-hidden': 'true' }, mod.icon),
        el('span', { class: 'tile-name' }, mod.name),
        el('span', { class: 'tile-meta' }, `${rows.length} Einträge`),
        alerts ? el('span', { class: 'tile-meta warn' }, `⚠ ${alerts} Hinweis${alerts > 1 ? 'e' : ''}`) : null
      );
    })
  );
  renderBackupWarning(all.length);
  updateSystemInfo();
}

/* ---------------- Modul-Ansicht ---------------- */
function buildField(f) {
  const id = `f-${f.key}`;
  let input;
  if (f.type === 'textarea') {
    input = el('textarea', { id, name: f.key, maxlength: MAX_TEXT });
  } else if (f.type === 'select') {
    input = el('select', { id, name: f.key }, f.options.map((o) => el('option', { value: o }, o)));
  } else {
    input = el('input', {
      id, name: f.key, type: f.type,
      step: f.step, min: f.min, max: f.max,
      maxlength: f.type === 'text' ? MAX_TEXT : null,
      required: f.required,
      inputmode: f.type === 'number' ? 'decimal' : null,
    });
  }
  return el('div', { class: `field${f.full ? ' full' : ''}` }, el('label', { for: id }, f.label), input);
}

function renderForm(mod) {
  const form = $('#entry-form');
  const actions = el('div', { class: 'row full' },
    el('button', { class: 'btn primary', type: 'submit' }, '+ Speichern')
  );
  if (mod.gps) {
    actions.append(el('button', { class: 'btn', type: 'button', onclick: fillGPS }, '⌖ GPS-Position'));
  }
  form.replaceChildren(...mod.fields.map(buildField), actions);
}

async function renderList() {
  const mod = MODULES[currentModule];
  const rows = (await db.all(currentModule)).sort((a, b) => (b.created || 0) - (a.created || 0));
  const list = $('#entry-list');

  if (!rows.length) {
    list.replaceChildren(el('li', { class: 'empty' }, 'Noch keine Einträge.'));
    return;
  }

  list.replaceChildren(
    ...rows.map((e) => {
      const meta = (mod.meta ? mod.meta(e) : []).filter(Boolean);
      const status = mod.status ? mod.status(e) : '';
      const body = el('div', { class: 'item-body' },
        el('div', { class: 'item-title' }, e.name),
        meta.map((m) => el('div', { class: 'item-meta' }, m))
      );
      if (currentModule === 'map' && e.lat != null && e.lon != null) {
        // geo:-Link öffnet installierte Offline-Karten-App (z. B. OsmAnd, Organic Maps)
        body.append(el('a', { href: `geo:${e.lat},${e.lon}?q=${e.lat},${e.lon}` }, 'In Karten-App öffnen'));
      }
      return el('li', { class: `item ${status}` },
        body,
        el('button', {
          class: 'icon-btn btn danger', type: 'button', 'aria-label': `${e.name} löschen`,
          onclick: () => deleteEntry(e),
        }, '×')
      );
    })
  );
}

async function onSubmit(ev) {
  ev.preventDefault();
  const form = ev.target;
  const mod = MODULES[currentModule];
  const data = new FormData(form);
  const entry = { module: currentModule, created: Date.now(), schemaVersion: SCHEMA_VERSION };
  for (const f of mod.fields) {
    const v = String(data.get(f.key) ?? '').trim();
    if (v === '') continue;
    entry[f.key] = f.type === 'number' ? Number(v) : v;
  }

  const problem = validateEntry(entry);
  if (problem) return toast(`⚠ Nicht gespeichert: ${problem}`, { error: true });

  try {
    await db.add(entry);
  } catch (err) {
    // Formular NICHT leeren, damit die Eingabe nicht verloren geht
    return showError('Speichern fehlgeschlagen', err);
  }
  form.reset();
  toast('Gespeichert');
  renderList().catch((err) => showError('Liste laden', err));
}

async function deleteEntry(entry) {
  if (!confirm(`„${entry.name}" löschen?`)) return;
  try {
    await db.remove(entry.id);
  } catch (err) {
    return showError('Löschen fehlgeschlagen', err);
  }
  toast('Gelöscht');
  renderList().catch((err) => showError('Liste laden', err));
}

function fillGPS() {
  if (!('geolocation' in navigator)) return toast('GPS nicht verfügbar', { error: true });
  toast('Suche GPS-Signal …');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      $('#f-lat').value = coords.latitude.toFixed(6);
      $('#f-lon').value = coords.longitude.toFixed(6);
      toast(`Position ±${Math.round(coords.accuracy)} m`);
    },
    (err) => toast(`GPS-Fehler: ${err.message}`, { error: true }),
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
  );
}

/* ---------------- Routing ---------------- */
function navigate(moduleId) {
  location.hash = moduleId ? `#/${moduleId}` : '#/';
}

function route() {
  const id = location.hash.replace(/^#\/?/, '');
  const mod = MODULES[id];

  $('#view-dashboard').hidden = !!mod;
  $('#view-module').hidden = !mod;
  $('#btn-home').hidden = !mod;
  window.scrollTo(0, 0);

  if (mod) {
    currentModule = id;
    $('#view-title').textContent = `${mod.icon} ${mod.name}`;
    $('#module-hint').textContent = mod.hint;
    renderForm(mod);
    renderList().catch((err) => showError('Liste laden', err));
  } else {
    currentModule = null;
    $('#view-title').textContent = 'OFF-GRID HUB';
    renderDashboard().catch((err) => showError('Dashboard laden', err));
  }
}

/* ---------------- Backup (Export / Import) ---------------- */
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

async function exportData() {
  let entries;
  try {
    entries = await db.all();
  } catch (err) {
    return showError('Export fehlgeschlagen', err);
  }
  const now = new Date();
  const payload = { app: DB_NAME, schemaVersion: SCHEMA_VERSION, exported: now.toISOString(), entries };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `offgrid-backup-${now.toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);

  setLastBackup(now.getTime());
  toast(`Backup mit ${entries.length} Einträgen erstellt`);
  if (!currentModule) renderDashboard().catch((err) => showError('Dashboard laden', err));
}

/* Prüft eine Backup-Datei vollständig, BEVOR irgendetwas gespeichert wird.
   Wirft einen Fehler mit verständlicher Beschreibung. */
function parseBackup(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Datei ist kein gültiges JSON (beschädigt?)');
  }
  if (!payload || typeof payload !== 'object' || payload.app !== DB_NAME) {
    throw new Error('Datei ist kein Backup dieser App');
  }
  if (!Array.isArray(payload.entries)) throw new Error('Backup enthält keine Einträge-Liste');
  if (payload.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Backup stammt aus einer neueren App-Version – bitte App aktualisieren');
  }
  const problems = [];
  payload.entries.forEach((e, i) => {
    const p = validateEntry(e);
    if (p) problems.push(`Eintrag ${i + 1}: ${p}`);
  });
  if (problems.length) {
    throw new Error(`${problems.length} fehlerhafte Einträge (${problems.slice(0, 2).join('; ')}${problems.length > 2 ? '; …' : ''})`);
  }
  const exported = Date.parse(payload.exported);
  // IDs werden neu vergeben
  return {
    entries: payload.entries.map(({ id, ...rest }) => migrateEntry(rest)),
    exported: Number.isFinite(exported) ? exported : null,
  };
}

async function importData(file) {
  let backup;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Datei ist zu groß');
    backup = parseBackup(await file.text());
  } catch (err) {
    // Vorhandene Daten wurden nicht angefasst
    return showError('Import abgelehnt – vorhandene Daten unverändert', err);
  }

  if (!confirm(`${backup.entries.length} Einträge importieren? Bestehende Daten werden ersetzt.`)) return;

  try {
    await db.replaceAll(backup.entries); // eine Transaktion: alles oder nichts
    const count = (await db.all()).length;
    if (count !== backup.entries.length) {
      throw new Error(`nach dem Import ${count} statt ${backup.entries.length} Einträge vorhanden`);
    }
  } catch (err) {
    return showError('Import fehlgeschlagen', err);
  }

  // Die Daten entsprechen jetzt genau dieser Backup-Datei
  if (backup.exported) setLastBackup(backup.exported);
  toast(`${backup.entries.length} Einträge importiert`);
  navigate(null);
  route();
}

/* ---------------- Speicher dauerhaft? ----------------
   Nur "gewährt" schützt davor, dass der Browser die Daten bei
   Speichermangel automatisch löscht.                       */
async function checkPersistence() {
  if (!navigator.storage?.persisted) return 'nicht unterstützt';
  try {
    let granted = await navigator.storage.persisted();
    if (!granted && navigator.storage.persist) granted = await navigator.storage.persist();
    return granted ? 'gewährt' : 'nicht gewährt';
  } catch (err) {
    console.warn('[Storage] persist:', err);
    return 'unbekannt (Fehler)';
  }
}

/* ---------------- Service Worker / Updates ---------------- */
function askWorker(worker, message) {
  return new Promise((resolve) => {
    if (!worker) return resolve(null);
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;

  let reg;
  try {
    reg = await navigator.serviceWorker.register('service-worker.js');
  } catch (err) {
    return showError('Offline-Cache nicht aktiv', err);
  }

  const offerUpdate = (worker) => {
    waitingWorker = worker;
    $('#update-banner').hidden = false;
    updateSystemInfo();
  };

  // Update wurde schon bei einem früheren Besuch geladen
  if (reg.waiting && hadController) offerUpdate(reg.waiting);

  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker?.addEventListener('statechange', () => {
      // "installed" + bestehender Controller = neue Version wartet
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
    });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Erstinstallation: nur Status aktualisieren. Update: Seite neu laden,
    // damit HTML, CSS und JS garantiert aus derselben Version stammen.
    if (!hadController) return updateSystemInfo();
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  // Beim Zurückkehren in die App nach Updates suchen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
  });
}

function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}

/* ---------------- System-Status ---------------- */
function updateNetStatus() {
  const s = $('#net-status');
  s.textContent = navigator.onLine ? '● ONLINE' : '● OFFLINE';
  s.classList.toggle('online', navigator.onLine);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

async function updateSystemInfo() {
  const set = (sel, text, warn = false) => {
    const node = $(sel);
    node.textContent = text;
    node.classList.toggle('warn-text', warn);
  };

  set('#sys-db', db.kind === 'IndexedDB' ? 'IndexedDB' : 'localStorage (Notlösung, max. ~5 MB)', db.kind !== 'IndexedDB');
  set('#sys-persist', persistState, persistState !== 'gewährt');
  set('#sys-mode', isStandalone() ? 'Homescreen-App' : 'Browser-Tab');

  const last = getLastBackup();
  set('#sys-backup', last ? `${new Date(last).toLocaleString('de-DE')} (vor ${daysSince(last)} T.)` : 'noch nie', !last || daysSince(last) >= BACKUP_MAX_AGE_DAYS);

  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      set('#sys-storage', `${(usage / 1048576).toFixed(2)} MB / ${(quota / 1048576).toFixed(0)} MB`);
    }
  } catch { /* nur Anzeige */ }

  if ('serviceWorker' in navigator) {
    const controller = navigator.serviceWorker.controller;
    set('#sys-sw', controller ? 'aktiv' : 'wird installiert …', !controller);
    const current = await askWorker(controller, { type: 'GET_VERSION' });
    const waiting = waitingWorker && (await askWorker(waitingWorker, { type: 'GET_VERSION' }));
    set('#sys-version', `${current?.version ?? '–'}${waiting?.version ? ` (Update ${waiting.version} bereit)` : ''}`);
  } else {
    set('#sys-sw', 'nicht unterstützt', true);
  }

  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      set('#sys-battery', `${Math.round(b.level * 100)} %${b.charging ? ' ⚡' : ''}`);
    } else {
      set('#sys-battery', 'n/a');
    }
  } catch { /* nur Anzeige */ }
}

/* ---------------- Nachtsicht ---------------- */
function applyNightMode(on) {
  if (on) document.documentElement.setAttribute('data-mode', 'night');
  else document.documentElement.removeAttribute('data-mode');
  try { localStorage.setItem('offgrid:night', on ? '1' : '0'); } catch { /* nur Komfort */ }
}

/* ---------------- Viewport-Höhe ----------------
   Moderne Browser nutzen 100dvh (CSS). Nur ältere Browser ohne
   dvh bekommen die echte sichtbare Höhe per JS.            */
function fixViewportHeight() {
  if (window.CSS?.supports?.('height', '100dvh')) return;
  const setHeight = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  setHeight();
  window.addEventListener('resize', setHeight);
}

/* ---------------- Start ---------------- */
async function init() {
  fixViewportHeight();
  try { applyNightMode(localStorage.getItem('offgrid:night') === '1'); } catch { /* nur Komfort */ }

  // Unerwartete Fehler sichtbar machen
  window.addEventListener('unhandledrejection', (e) => showError('Unerwarteter Fehler', e.reason));
  window.addEventListener('error', (e) => showError('Unerwarteter Fehler', e.error || e.message));

  db = await initDB();
  try {
    await migrateStoredEntries();
  } catch (err) {
    showError('Datenmigration fehlgeschlagen', err);
  }

  $('#btn-home').addEventListener('click', () => navigate(null));
  $('#btn-night').addEventListener('click', () =>
    applyNightMode(document.documentElement.getAttribute('data-mode') !== 'night'));
  $('#entry-form').addEventListener('submit', onSubmit);
  $('#btn-export').addEventListener('click', exportData);
  $('#btn-backup-now').addEventListener('click', exportData);
  $('#btn-update').addEventListener('click', applyUpdate);
  $('#file-import').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);

  updateNetStatus();
  route();

  persistState = await checkPersistence();
  updateSystemInfo();

  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
