// Kleine IndexedDB-Schicht. Alle Daten bleiben lokal im Browser des Geräts.
const DB_NAME = 'steuerordner';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('years')) d.createObjectStore('years', { keyPath: 'year' });
      if (!d.objectStoreNames.contains('folders')) {
        const f = d.createObjectStore('folders', { keyPath: 'id' });
        f.createIndex('year', 'year');
      }
      if (!d.objectStoreNames.contains('docs')) {
        const s = d.createObjectStore('docs', { keyPath: 'id' });
        s.createIndex('folderId', 'folderId');
        s.createIndex('year', 'year');
      }
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return open().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || (req && req.error) || new DOMException('Speichern wurde abgebrochen', 'AbortError'));
  }));
}

// Änderungen melden: Die App speichert damit zwei Sekunden nach der letzten Änderung von selbst (siehe app.js)
const listeners = new Set();
export const onWrite = (fn) => listeners.add(fn);
const notify = (store, obj) => { for (const f of listeners) { try { f(store, obj); } catch (e) { /* Zuhörer dürfen das Speichern nie stören */ } } };

export const db = {
  get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
  getAll: (store) => run(store, 'readonly', (s) => s.getAll()),
  getAllBy: (store, index, value) => run(store, 'readonly', (s) => s.index(index).getAll(value)),
  put: (store, obj) => run(store, 'readwrite', (s) => s.put(obj)).then((r) => { notify(store, obj); return r; }),
  del: (store, key) => run(store, 'readwrite', (s) => s.delete(key)).then((r) => { notify(store, { key }); return r; }),
  clear: (store) => run(store, 'readwrite', (s) => s.clear()),
};
