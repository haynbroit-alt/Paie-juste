/** Stockage local IndexedDB : journal append-only scellé par chaîne SHA-256 (repris de la Boîte noire). */
import { sealRecord, GENESIS_HASH } from "./chain.js";
import { nowIso, uid } from "./util.js";
import { APP_ID, APP_VERSION } from "./version.js";

const req = (r) =>
  new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const done = (t) =>
  new Promise((res, rej) => {
    t.oncomplete = res;
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });

export class Store {
  constructor(name) {
    this.name = name;
    this.db = null;
    this._w = Promise.resolve();
    this._cache = null;
  }
  _ex(fn) {
    const r = this._w.then(fn, fn);
    this._w = r.then(
      () => {},
      () => {},
    );
    return r;
  }
  async open() {
    this.db = await new Promise((resolve, reject) => {
      const r = indexedDB.open(this.name, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "seq" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await this.ensureGenesis();
    return this;
  }
  close() {
    if (this.db) this.db.close();
    this.db = null;
    this._cache = null;
  }
  async getMeta(key, fb) {
    const v = await req(this.db.transaction("meta").objectStore("meta").get(key));
    return v ? v.value : fb;
  }
  async setMeta(key, value) {
    const t = this.db.transaction("meta", "readwrite");
    t.objectStore("meta").put({ key, value });
    await done(t);
  }
  async all() {
    if (this._cache) return this._cache;
    const rows = await req(this.db.transaction("records").objectStore("records").getAll());
    rows.sort((a, b) => a.seq - b.seq);
    this._cache = rows;
    return rows;
  }
  async ensureGenesis() {
    const all = await this.all();
    if (all.length) return all[all.length - 1];
    return this.append({
      type: "genesis",
      data: {
        app: APP_ID,
        version: APP_VERSION,
        note: "Début de la chaîne d'intégrité SHA-256. Pas une blockchain, pas de crypto-monnaie.",
      },
    });
  }
  append(partial) {
    return this._ex(() => this._append(partial));
  }
  async _append(partial) {
    const all = await this.all();
    const last = all[all.length - 1];
    const rec = await sealRecord(
      {
        seq: last ? last.seq + 1 : 1,
        id: uid(),
        type: partial.type,
        t: partial.t || nowIso(),
        data: partial.data || {},
      },
      last ? last.hash : GENESIS_HASH,
    );
    const t = this.db.transaction("records", "readwrite");
    t.objectStore("records").add(rec);
    await done(t);
    this._cache = [...all, rec];
    return rec;
  }
  /** Remplace tout le journal (import déjà vérifié). */
  replaceAll(records) {
    return this._ex(async () => {
      const t = this.db.transaction("records", "readwrite");
      const s = t.objectStore("records");
      s.clear();
      for (const r of records) s.add(r);
      await done(t);
      this._cache = null;
    });
  }
  wipe() {
    return this._ex(async () => {
      const t = this.db.transaction(["records", "meta"], "readwrite");
      t.objectStore("records").clear();
      t.objectStore("meta").clear();
      await done(t);
      this._cache = null;
    }).then(() => this.ensureGenesis());
  }
}
