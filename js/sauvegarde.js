// @ts-check
/**
 * Sauvegarde chiffrée, faite sur le téléphone avec WebCrypto (rien n'est envoyé).
 * Clé : PBKDF2-SHA-256 (600 000 itérations) tirée du code choisi par la personne.
 * Chiffrement : AES-256-GCM, qui détecte aussi toute modification du fichier.
 * Sans le code, la sauvegarde est illisible : personne ne peut la récupérer, pas même l'auteur de l'appli.
 */
import { APP_ID, APP_VERSION } from "./version.js";

export const FORMAT = APP_ID + "/sauvegarde-chiffree";
export const ITERATIONS = 600000;
export const CODE_MIN = 8;
/** Réglages gardés sur le téléphone (hors journal scellé) : relus à chaque ouverture et inclus dans la sauvegarde. */
export const META_KEYS = [
  "profil",
  "netOpts",
  "currentContrat",
  "gps",
  "periodeDefaut",
  "journee",
  "rappelHeure",
  "derniereSauvegarde",
];

/** @param {Uint8Array} u */
const b64 = (u) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
/** @param {string} s @returns {Uint8Array<ArrayBuffer>} */
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** @param {string} code @param {Uint8Array<ArrayBuffer>} sel @param {number} iterations */
async function cle(code, sel, iterations) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: sel, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** @param {string} code */
export function codeValide(code) {
  if (typeof code !== "string" || code.length < CODE_MIN) {
    return `Le code doit faire au moins ${CODE_MIN} caractères.`;
  }
  return "";
}

/**
 * @param {unknown} contenu tout ce qui doit être sauvegardé (export de la chaîne, réglages)
 * @param {string} code
 * @param {{ iterations?: number }} [opts] iterations : réduit seulement dans les tests
 */
export async function chiffrer(contenu, code, opts = {}) {
  const err = codeValide(code);
  if (err) throw new Error(err);
  const iterations = opts.iterations || ITERATIONS;
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await cle(code, sel, iterations);
  const clair = new TextEncoder().encode(JSON.stringify(contenu));
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, clair));
  return {
    format: FORMAT,
    version: APP_VERSION,
    creeLe: new Date().toISOString(),
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations, sel: b64(sel) },
    chiffrement: { name: "AES-GCM", longueur: 256, iv: b64(iv) },
    donnees: b64(chiffre),
  };
}

/** @param {any} obj */
export const estSauvegardeChiffree = (obj) => !!obj && obj.format === FORMAT && typeof obj.donnees === "string";

/**
 * @param {any} obj fichier de sauvegarde lu (JSON)
 * @param {string} code
 * @returns {Promise<any>} le contenu d'origine
 */
export async function dechiffrer(obj, code) {
  if (!estSauvegardeChiffree(obj)) throw new Error("Ce fichier n'est pas une sauvegarde chiffrée de Paie Juste.");
  const k = await cle(code || "", deB64(obj.kdf.sel), Number(obj.kdf.iterations) || ITERATIONS);
  let clair;
  try {
    clair = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(obj.chiffrement.iv) }, k, deB64(obj.donnees));
  } catch {
    throw new Error("Code incorrect, ou fichier abîmé.");
  }
  return JSON.parse(new TextDecoder().decode(clair));
}
