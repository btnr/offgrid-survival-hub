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
      { key: 'lat', label: 'Breite (Lat)', type: 'number', step: 'any' },
      { key: 'lon', label: 'Länge (Lon)', type: 'number', step: 'any' },
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
function toast(msg) {
  let t = $('.toast');
  if (!t) t = document.body.appendChild(el('div', { class: 'toast', role: 'status' }));
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2500);
}

/* ---------------- Datenbank ----------------
   Einheitliche API: all(), add(), remove(), clear().
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Datenbank blockiert'));
  });
}

function idbStore(db) {
  const run = (mode, fn) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

  return {
    kind: 'IndexedDB',
    all: (module) => run('readonly', (s) => (module ? s.index('module').getAll(module) : s.getAll())),
    add: (entry) => run('readwrite', (s) => s.add(entry)),
    remove: (id) => run('readwrite', (s) => s.delete(id)),
    clear: () => run('readwrite', (s) => s.clear()),
  };
}

function localStore() {
  const KEY = `${DB_NAME}:${STORE}`;
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  };
  const write = (rows) => localStorage.setItem(KEY, JSON.stringify(rows));

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
    clear: async () => write([]),
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

/* ---------------- State ---------------- */
let db;
let currentModule = null;

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
  updateSystemInfo();
}

/* ---------------- Modul-Ansicht ---------------- */
function buildField(f) {
  const id = `f-${f.key}`;
  let input;
  if (f.type === 'textarea') {
    input = el('textarea', { id, name: f.key });
  } else if (f.type === 'select') {
    input = el('select', { id, name: f.key }, f.options.map((o) => el('option', { value: o }, o)));
  } else {
    input = el('input', {
      id, name: f.key, type: f.type,
      step: f.step, min: f.min, max: f.max,
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
  const rows = (await db.all(currentModule)).sort((a, b) => b.created - a.created);
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
  const mod = MODULES[currentModule];
  const data = new FormData(ev.target);
  const entry = { module: currentModule, created: Date.now() };
  for (const f of mod.fields) {
    const v = String(data.get(f.key) ?? '').trim();
    if (v === '') continue;
    entry[f.key] = f.type === 'number' ? Number(v) : v;
  }
  await db.add(entry);
  ev.target.reset();
  toast('Gespeichert');
  renderList();
}

async function deleteEntry(entry) {
  if (!confirm(`„${entry.name}" löschen?`)) return;
  await db.remove(entry.id);
  renderList();
}

function fillGPS() {
  if (!('geolocation' in navigator)) return toast('GPS nicht verfügbar');
  toast('Suche GPS-Signal …');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      $('#f-lat').value = coords.latitude.toFixed(6);
      $('#f-lon').value = coords.longitude.toFixed(6);
      toast(`Position ±${Math.round(coords.accuracy)} m`);
    },
    (err) => toast(`GPS-Fehler: ${err.message}`),
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
    renderList();
  } else {
    currentModule = null;
    $('#view-title').textContent = 'OFF-GRID HUB';
    renderDashboard();
  }
}

/* ---------------- Backup (Export / Import) ---------------- */
async function exportData() {
  const payload = { app: DB_NAME, version: DB_VERSION, exported: new Date().toISOString(), entries: await db.all() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `offgrid-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(file) {
  try {
    const payload = JSON.parse(await file.text());
    const entries = Array.isArray(payload.entries) ? payload.entries.filter((e) => e && MODULES[e.module] && e.name) : null;
    if (!entries) throw new Error('Ungültiges Backup-Format');
    if (!confirm(`${entries.length} Einträge importieren? Bestehende Daten werden ersetzt.`)) return;
    await db.clear();
    for (const { id, ...rest } of entries) await db.add(rest);
    toast(`${entries.length} Einträge importiert`);
    renderDashboard();
  } catch (err) {
    toast(`Import fehlgeschlagen: ${err.message}`);
  }
}

/* ---------------- System-Status ---------------- */
function updateNetStatus() {
  const s = $('#net-status');
  s.textContent = navigator.onLine ? '● ONLINE' : '● OFFLINE';
  s.classList.toggle('online', navigator.onLine);
}

async function updateSystemInfo() {
  $('#sys-db').textContent = db.kind;

  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    $('#sys-storage').textContent =
      `${(usage / 1048576).toFixed(2)} MB / ${(quota / 1048576).toFixed(0)} MB${persisted ? ' · dauerhaft' : ''}`;
  }

  if ('serviceWorker' in navigator) {
    $('#sys-sw').textContent = navigator.serviceWorker.controller ? 'aktiv' : 'wird installiert …';
  } else {
    $('#sys-sw').textContent = 'nicht unterstützt';
  }

  if (navigator.getBattery) {
    const b = await navigator.getBattery();
    $('#sys-battery').textContent = `${Math.round(b.level * 100)} %${b.charging ? ' ⚡' : ''}`;
  } else {
    $('#sys-battery').textContent = 'n/a';
  }
}

/* ---------------- Nachtsicht ---------------- */
function applyNightMode(on) {
  if (on) document.documentElement.setAttribute('data-mode', 'night');
  else document.documentElement.removeAttribute('data-mode');
  try { localStorage.setItem('offgrid:night', on ? '1' : '0'); } catch { /* ignore */ }
}

/* ---------------- Start ---------------- */
async function init() {
  try { applyNightMode(localStorage.getItem('offgrid:night') === '1'); } catch { /* ignore */ }

  db = await initDB();

  // Browser bitten, Daten nicht automatisch zu löschen
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  $('#btn-home').addEventListener('click', () => navigate(null));
  $('#btn-night').addEventListener('click', () =>
    applyNightMode(document.documentElement.getAttribute('data-mode') !== 'night'));
  $('#entry-form').addEventListener('submit', onSubmit);
  $('#btn-export').addEventListener('click', exportData);
  $('#file-import').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);

  updateNetStatus();
  route();

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('service-worker.js');
      navigator.serviceWorker.addEventListener('controllerchange', updateSystemInfo);
    } catch (err) {
      console.warn('[SW] Registrierung fehlgeschlagen:', err);
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
