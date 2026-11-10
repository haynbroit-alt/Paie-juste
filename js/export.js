import { verifyChain, GENESIS_HASH } from "./chain.js";
import { APP_ID, APP_VERSION } from "./version.js";
import { csvEscape } from "./util.js";

export function buildExport(records, meta = {}) {
  return {
    format: APP_ID + "/export",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    timezone: "Europe/Paris",
    exemple: !!meta.exemple,
    hashAlg: "SHA-256",
    genesis: GENESIS_HASH,
    head: records.length ? records[records.length - 1].hash : null,
    count: records.length,
    records,
  };
}
export function buildCsv(records) {
  const head = [
    "seq",
    "type",
    "scelle_le_utc",
    "quand_utc",
    "action",
    "mission_id",
    "detail",
    "cible",
    "motif",
    "prevHash",
    "hash",
  ];
  const rows = records.map((r) => {
    const d = r.data || {};
    const detail =
      r.type === "mission"
        ? [d.agence, d.eu, d.chantier, d.taux + " €/h"].join(" / ")
        : r.type === "prime"
          ? `${d.libelle} ${d.montant} € × ${d.jours ?? 1}`
          : r.type === "bulletin"
            ? `bulletin ${d.periode}`
            : r.type === "correction"
              ? JSON.stringify(d.changes || {}) + (d.annule ? " ANNULE" : "")
              : "";
    return [
      r.seq,
      r.type,
      r.t,
      d.at || "",
      d.action || "",
      d.missionId || "",
      detail,
      d.targetId || "",
      d.motif || "",
      r.prevHash,
      r.hash,
    ]
      .map(csvEscape)
      .join(";");
  });
  return "\ufeff" + head.join(";") + "\n" + rows.join("\n") + "\n";
}
/** Vérifie un export JSON avant import. */
export async function checkImport(obj) {
  if (!obj || !Array.isArray(obj.records)) {
    return { ok: false, errors: ["Fichier non reconnu (pas de liste records)."] };
  }
  if (obj.format && obj.format !== APP_ID + "/export") {
    return { ok: false, errors: ["Ce fichier vient d'une autre application : " + obj.format] };
  }
  const v = await verifyChain(obj.records);
  if (v.ok && obj.head && obj.head !== v.head) {
    (v.errors.push("L'empreinte finale annoncée ne correspond pas."), (v.ok = false));
  }
  return v;
}
