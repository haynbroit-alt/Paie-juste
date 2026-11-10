/**
 * Chaînage d'intégrité SHA-256 (pas une blockchain, pas de crypto-monnaie).
 * Chaque enregistrement porte l'empreinte du précédent.
 */
export const GENESIS_HASH = "0".repeat(64);
export const HASH_ALG = "SHA-256";

export function canonicalize(value) {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Nombre non fini interdit dans la chaîne");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "undefined") throw new Error("undefined interdit dans la chaîne");
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalize(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
  }
  throw new Error("Type non sérialisable");
}

function getSubtle() {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error("WebCrypto indisponible");
  return c.subtle;
}

export async function sha256Hex(bytes) {
  const subtle = getSubtle();
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await subtle.digest(HASH_ALG, buf);
  const arr = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < arr.length; i++) hex += arr[i].toString(16).padStart(2, "0");
  return hex;
}

export async function sha256Text(text) {
  return sha256Hex(new TextEncoder().encode(text));
}

/** Corps signé : tous les champs sauf `hash`. */
export function bodyForHash(record) {
  const body = {};
  for (const [k, v] of Object.entries(record)) {
    if (k === "hash" || v === undefined) continue;
    body[k] = v;
  }
  return body;
}

export async function hashRecord(record) {
  return sha256Text(canonicalize(bodyForHash(record)));
}

export async function sealRecord(record, prevHash) {
  const rec = { ...record, prevHash: prevHash || GENESIS_HASH };
  delete rec.hash;
  const hash = await hashRecord(rec);
  rec.hash = hash;
  return rec;
}

/**
 * Vérifie la chaîne dans l'ordre.
 * Retourne { ok, errors[], head }.
 */
export async function verifyChain(records) {
  const errors = [];
  if (!Array.isArray(records) || records.length === 0) {
    return { ok: false, errors: ["Aucun enregistrement."], head: null };
  }
  let expectedPrev = GENESIS_HASH;
  let head = null;
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec || typeof rec !== "object") {
      errors.push("Enregistrement " + i + " invalide.");
      continue;
    }
    if (rec.prevHash !== expectedPrev) {
      errors.push(
        "Rupture de chaîne au n° " +
          (rec.seq ?? i) +
          " : prevHash=" +
          rec.prevHash +
          " attendu=" +
          expectedPrev
      );
    }
    const computed = await hashRecord(rec);
    if (computed !== rec.hash) {
      errors.push(
        "Empreinte altérée au n° " +
          (rec.seq ?? i) +
          " : hash=" +
          rec.hash +
          " calculé=" +
          computed
      );
    }
    expectedPrev = rec.hash || computed;
    head = expectedPrev;
  }
  return { ok: errors.length === 0, errors, head };
}
