// @ts-check
/**
 * Moteur de calcul — fonctions pures, sans DOM, testées sous node.
 * Uniquement les règles PROUVÉES de regles.md ; le reste est saisi par l'utilisateur.
 * ESTIMATION, pas un conseil juridique.
 */

/**
 * @typedef {Object} PayRules
 * @property {number} dureeLegaleH
 * @property {number} hs1Heures
 * @property {number} hs1Taux
 * @property {number} hs2Taux
 * @property {number} hc1Taux
 * @property {number} hc2Taux
 * @property {number} finTaux
 * @property {number} iccpTaux
 * @property {number} seuilEcartEuros
 * @property {boolean} [iccpInclutFin]
 */

/**
 * @typedef {Object} Avantage
 * @property {string} [libelle]
 * @property {number} [montant]
 * @property {boolean} [base]
 */

/**
 * @typedef {Object} FinContrat
 * @property {string} [at]
 * @property {string} [motif]
 * @property {boolean} [congesPris]
 * @property {string} [recordId]
 */

/**
 * @typedef {Object} ContratNorm
 * @property {string} type
 * @property {"horaire"|"mensuel"} mode
 * @property {number} hebdo
 * @property {number} taux
 * @property {number} mensuel
 * @property {number|null} tauxRef
 * @property {string} employeur
 * @property {string} employeurAdresse
 * @property {string} eu
 * @property {string} lieu
 * @property {string} poste
 * @property {string} convention
 * @property {string} dateDebut
 * @property {string} dateFin
 * @property {Avantage[]} avantages
 * @property {PayRules} rules
 * @property {boolean} exemple
 * @property {string} [id]
 * @property {FinContrat|null} [fin]
 * @property {boolean} [annule]
 * @property {Object[]} [corrections]
 * @property {Record<string, unknown>} [raw]
 */

/**
 * @typedef {Object} JourRow
 * @property {string} date
 * @property {string} week
 * @property {string} month
 * @property {number} total
 * @property {number} normal
 * @property {number} hc1
 * @property {number} hc2
 * @property {number} hs1
 * @property {number} hs2
 * @property {number} couvert
 */

/**
 * @typedef {Object} PrimeSaisie
 * @property {number|string} [montant]
 * @property {number|string} [jours]
 * @property {boolean} [base]
 * @property {string} [libelle]
 */

/**
 * @typedef {Object} PayOpts
 * @property {boolean} [avecFin]
 * @property {boolean} [finDue]
 * @property {boolean} [avecIccp]
 * @property {boolean} [iccpInclutFin]
 * @property {number} [moisMensuel]
 */

/**
 * @typedef {Object} PayLine
 * @property {string} key
 * @property {string} label
 * @property {string} detail
 * @property {number} montant
 * @property {string} regle
 */

/**
 * @typedef {Object} ExpectedPay
 * @property {{total:number,normal:number,hc1:number,hc2:number,hs1:number,hs2:number,couvert:number}} minutes
 * @property {Record<string, number>} payees
 * @property {number} tauxHoraire
 * @property {PayRules} rules
 * @property {ContratNorm} contrat
 * @property {PayLine[]} lines
 * @property {number} brut
 * @property {number} hsMontant
 * @property {number} hcMontant
 * @property {number} frais
 * @property {number} total
 */

/**
 * @typedef {Object} NetOpts
 * @property {boolean} [cadre]
 * @property {boolean} [alsaceMoselle]
 * @property {number|string} [mutuelle]
 * @property {number|string} [tauxPAS]
 * @property {boolean} [hsExoImpot]
 * @property {boolean} [reductionHC]
 */

/**
 * @typedef {Object} JournalRecord
 * @property {string} id
 * @property {string} type
 * @property {number} [seq]
 * @property {string} [t]
 * @property {string} [hash]
 * @property {Record<string, any>} [data]
 */

/** @typedef {Map<string, number>} DayMinutes */
export const TZ = "Europe/Paris";

export const DEFAULT_RULES = Object.freeze({
  dureeLegaleH: 35, // L3121-27
  hs1Heures: 8, // L3121-36
  hs1Taux: 0.25, // L3121-36 (à défaut d'accord)
  hs2Taux: 0.5, // L3121-36 (à défaut d'accord)
  hc1Taux: 0.1, // L3123-29 : dans la limite du 1/10 des heures du contrat
  hc2Taux: 0.25, // L3123-29 : entre 1/10 et 1/3
  finTaux: 0.1, // L1251-32 (intérim) / L1243-8 (CDD). Modifiable : une convention peut prévoir 6 % en CDD (service-public F40)
  iccpTaux: 0.1, // L1251-19 (intérim) / L1242-16 (CDD)
  seuilEcartEuros: 1,
});

export const TYPES = Object.freeze({
  cdi: { label: "CDI", fin: null },
  cdd: { label: "CDD", fin: "Indemnité de fin de contrat (précarité)", finArt: "L1243-8", iccpArt: "L1242-16" },
  interim: { label: "Intérim", fin: "Indemnité de fin de mission (IFM)", finArt: "L1251-32", iccpArt: "L1251-19" },
});

/** Motifs de fin et effet sur l'indemnité de fin (L1251-32/33 intérim, L1243-8/10 CDD). */
export const MOTIFS_FIN = Object.freeze({
  normale: { label: "Fin normale du contrat", fin: true },
  rupture_salarie: { label: "Rupture anticipée à mon initiative", fin: false },
  faute_grave: { label: "Faute grave ou force majeure", fin: false },
  cdi: { label: "Suivi d'un CDI (même entreprise)", fin: false },
  refus_cdi: { label: "CDD : j'ai refusé un CDI équivalent", fin: false },
  autre: { label: "Autre (CDI : démission, licenciement…)", fin: false },
});

/** Taux de cotisations salariales — service-public F2302 (vérifié le 1er janvier 2026) et URSSAF. */
export const COTIS_2026 = Object.freeze({
  source: "https://www.service-public.gouv.fr/particuliers/vosdroits/F2302",
  pmss: 4005, // plafond mensuel 2026
  vieillessePlaf: 0.069,
  vieillesseDeplaf: 0.004,
  agircT1: 0.0315,
  cegT1: 0.0086,
  agircT2: 0.0864,
  cegT2: 0.0108,
  cetT1T2: 0.0014, // seulement si salaire > plafond
  apecCadre: 0.00024,
  csgCrdsAssiette: 0.9825,
  csgDeductible: 0.068,
  csgNonDeductible: 0.024,
  crds: 0.005,
  reductionHS: 0.1131, // service-public F2391 : exonération vieillesse sur HS, limite 11,31 %
});

/**
 * Date jusqu'à laquelle les taux codés (COTIS_2026, SMIC) ont été vérifiés.
 * Après cette date, l'appli prévient que les montants peuvent être faux, et `tests/run.mjs` échoue
 * pour obliger à vérifier les nouveaux taux (SMIC et cotisations changent au 1er janvier).
 */
export const TAUX_VERIFIES_JUSQU_AU = "2026-12-31";

/**
 * SMIC horaire brut (métropole). Sources : service-public A17008 (12,02 € au 1er janvier 2026),
 * arrêté du 22 mai 2026 et service-public A18916 (12,31 € au 1er juin 2026). Lus le 11/11/2026.
 * Non couverts : Mayotte (montant différent), abattements des moins de 18 ans, apprentis.
 */
export const SMIC = Object.freeze({
  source: "https://code.travail.gouv.fr/contribution/quel-est-le-salaire-minimum",
  historique: Object.freeze([
    Object.freeze({ depuis: "2026-01-01", horaire: 12.02 }),
    Object.freeze({ depuis: "2026-06-01", horaire: 12.31 }),
  ]),
});

/** Les taux codés sont-ils encore valables à cette date (AAAA-MM-JJ) ? @param {string} dateStr */
export const tauxAJour = (dateStr) => dateStr <= TAUX_VERIFIES_JUSQU_AU;

/**
 * SMIC horaire en vigueur à une date, ou null s'il n'est pas connu (avant 2026, ou taux non vérifiés).
 * @param {string} dateStr AAAA-MM-JJ
 * @returns {number|null}
 */
export function smicHoraire(dateStr) {
  if (!dateStr || !tauxAJour(dateStr)) return null;
  let v = null;
  for (const h of SMIC.historique) if (dateStr >= h.depuis) v = h.horaire;
  return v;
}

/**
 * Compare le taux horaire du contrat au SMIC. Alerte seulement : le montant attendu n'est pas modifié,
 * car un apprenti ou un salarié de moins de 18 ans peut légalement être payé moins.
 * @param {ContratNorm} c
 * @param {string} dateStr
 * @returns {{ smic: number, taux: number, ecart: number, sous: boolean } | null}
 */
export function controleSmic(c, dateStr) {
  const smic = smicHoraire(dateStr);
  const taux = tauxHoraire(c);
  if (smic == null || !(taux > 0)) return null;
  const t = Math.round(taux * 10000) / 10000;
  return { smic, taux: t, ecart: round2(smic - t), sous: t < smic - 0.004 };
}

/** @param {number} x */
export function cents(x) {
  return Math.round(x * 100 + (x >= 0 ? 1e-7 : -1e-7));
}
/** @param {number} x @returns {number} */
export function round2(x) {
  return cents(x) / 100;
}

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
/** @param {string|Date} iso */
export function parisDate(iso) {
  return dateFmt.format(iso instanceof Date ? iso : new Date(iso));
}
/** @param {string} dateStr */
export function weekKey(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  u.setUTCDate(u.getUTCDate() - ((u.getUTCDay() + 6) % 7));
  return u.toISOString().slice(0, 10);
}
/** @param {string} d */
export const monthKey = (d) => d.slice(0, 7);

/** Normalise un contrat (enregistrement « contrat » + corrections).
 * @param {Record<string, any>} d
 * @returns {ContratNorm}
 */
export function normContrat(d) {
  const rawType = typeof d.type === "string" ? d.type : "";
  const type = Object.hasOwn(TYPES, rawType) ? rawType : "interim";
  const mode = d.mode === "mensuel" ? "mensuel" : "horaire";
  const hebdo = Number(d.hebdo) > 0 ? Number(d.hebdo) : 35;
  /** @param {unknown} v */
  const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    type,
    mode,
    hebdo,
    taux: num(d.taux) || 0,
    mensuel: num(d.mensuel) || 0,
    tauxRef: num(d.tauxRef),
    employeur: d.employeur || d.agence || "",
    employeurAdresse: d.employeurAdresse || d.agenceAdresse || "",
    eu: d.eu || "",
    lieu: d.lieu || d.chantier || "",
    poste: d.poste || "",
    convention: d.convention || "",
    dateDebut: d.dateDebut || "",
    dateFin: d.dateFin || "",
    avantages: Array.isArray(d.avantages) ? d.avantages : [],
    rules: { ...DEFAULT_RULES, ...(d.rules || {}) },
    exemple: !!d.exemple,
  };
}

/** Taux horaire effectif. Mensuel : mensuel / (hebdo × 52/12) (L3242-1, généralisé à la durée du contrat — approximation).
 * @param {ContratNorm} c
 */
export function tauxHoraire(c) {
  if (c.mode === "mensuel") return c.hebdo > 0 ? c.mensuel / ((c.hebdo * 52) / 12) : 0;
  return c.taux;
}
/** @param {ContratNorm} c */
export const isPartiel = (c) => c.hebdo < c.rules.dureeLegaleH;

/** Reconstruit l'état depuis le journal scellé. Les corrections s'ajoutent, ne réécrivent jamais.
 * @param {JournalRecord[]} records
 */
export function deriveState(records) {
  const contrats = new Map();
  const items = new Map();
  const order = [];
  const corrections = [];
  for (const r of records) {
    const d = r.data || {};
    if (r.type === "contrat" || r.type === "mission") {
      contrats.set(r.id, {
        id: r.id,
        seq: r.seq,
        createdAt: r.t,
        hash: r.hash,
        raw: { ...d },
        ...normContrat(d),
        fin: null,
        corrections: [],
        annule: false,
      });
    } else if (r.type === "contrat_fin" || r.type === "mission_fin") {
      const c = contrats.get(d.contratId || d.missionId);
      if (c) c.fin = { at: d.at || r.t, motif: d.motif || "normale", congesPris: !!d.congesPris, recordId: r.id };
    } else if (r.type === "punch" || r.type === "prime" || r.type === "bulletin") {
      const it = /** @type {any} */ ({
        kind: r.type,
        id: r.id,
        seq: r.seq,
        sealedAt: r.t,
        hash: r.hash,
        ...d,
        contratId: d.contratId || d.missionId,
        original: { ...d },
        annule: false,
        corrections: [],
      });
      items.set(r.id, it);
      order.push(it);
    } else if (r.type === "correction") corrections.push(r);
  }
  for (const c of corrections) {
    const d = c.data || {};
    const target = items.get(d.targetId) || contrats.get(d.targetId);
    if (!target) continue;
    target.corrections.push({
      id: c.id,
      seq: c.seq,
      t: c.t,
      motif: d.motif || "",
      changes: d.changes || {},
      annule: !!d.annule,
      hash: c.hash,
    });
    if (d.annule) target.annule = true;
    if (d.changes) {
      if (contrats.has(d.targetId)) {
        target.raw = {
          ...target.raw,
          ...d.changes,
          rules: { ...(target.raw.rules || {}), ...(d.changes.rules || {}) },
        };
        Object.assign(target, normContrat(target.raw));
      } else Object.assign(target, d.changes);
    }
  }
  const punches = order
    .filter((x) => x.kind === "punch" && !x.annule)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.seq - b.seq));
  const allPunches = order.filter((x) => x.kind === "punch");
  const primes = order.filter((x) => x.kind === "prime" && !x.annule);
  const bulletins = new Map();
  for (const b of order.filter((x) => x.kind === "bulletin" && !x.annule)) {
    bulletins.set(b.contratId + "|" + b.periode, b);
  }
  for (const [k, c] of contrats) if (c.annule) contrats.delete(k);
  return { contrats, punches, allPunches, primes, bulletins, items };
}

/**
 * @param {Array<Record<string, any>>} punches
 * @param {{ now?: string }} [opts]
 */
export function workIntervals(punches, opts = {}) {
  const intervals = [],
    anomalies = [];
  let open = null;
  for (const p of punches) {
    const a = p.action;
    if (a === "debut" || a === "reprise") {
      if (open) {
        anomalies.push({ at: p.at, msg: "Deux débuts de suite : le premier est fermé à ce moment." });
        intervals.push({ start: open.at, end: p.at });
      }
      open = p;
    } else if (a === "pause" || a === "fin") {
      if (!open) {
        anomalies.push({ at: p.at, msg: (a === "pause" ? "Pause" : "Fin") + " sans début : ignoré." });
        continue;
      }
      intervals.push({ start: open.at, end: p.at });
      open = null;
    }
  }
  if (open) {
    if (opts.now) intervals.push({ start: open.at, end: opts.now, enCours: true });
    else anomalies.push({ at: open.at, msg: "Pointage en cours, non compté." });
  }
  return { intervals: intervals.filter((i) => new Date(i.end) > new Date(i.start)), anomalies, enCours: !!open };
}
/** @param {{start: string, end: string}} i */
export const intervalMinutes = (i) => Math.round((new Date(i.end).getTime() - new Date(i.start).getTime()) / 60000);
/** @param {Array<{start: string, end: string}>} intervals */
export function minutesByDay(intervals) {
  const m = new Map();
  for (const i of intervals) {
    const day = parisDate(i.start);
    m.set(day, (m.get(day) || 0) + intervalMinutes(i));
  }
  return m;
}

/**
 * Tranches hebdomadaires (en minutes cumulées dans la semaine) :
 * temps plein : [0,35h) normales, [35h,43h) HS +25 %, au-delà HS +50 %.
 * temps partiel (H < 35) : [0,H) normales, [H, H+H/10) HC +10 %, [H+H/10, 35h) HC +25 % (L3123-29), puis HS.
 * @param {ContratNorm} c
 * @returns {Array<{k: "normal"|"hc1"|"hc2"|"hs1"|"hs2", from: number, to: number}>}
 */
export function tranches(c) {
  const L = c.rules.dureeLegaleH * 60,
    H = c.hebdo * 60,
    hs1 = c.rules.hs1Heures * 60;
  /** @type {Array<{k: "normal"|"hc1"|"hc2"|"hs1"|"hs2", from: number, to: number}>} */
  const t = [];
  if (H < L) {
    t.push({ k: "normal", from: 0, to: H });
    t.push({ k: "hc1", from: H, to: Math.min(L, H + Math.round(H / 10)) });
    t.push({ k: "hc2", from: Math.min(L, H + Math.round(H / 10)), to: L });
  } else t.push({ k: "normal", from: 0, to: L });
  t.push({ k: "hs1", from: L, to: L + hs1 });
  t.push({ k: "hs2", from: L + hs1, to: Infinity });
  return t;
}
/** @type {readonly ["normal", "hc1", "hc2", "hs1", "hs2"]} */
const KEYS = ["normal", "hc1", "hc2", "hs1", "hs2"];
/** @returns {{total:number, normal:number, hc1:number, hc2:number, hs1:number, hs2:number, couvert:number}} */
const zero = () => ({ total: 0, normal: 0, hc1: 0, hc2: 0, hs1: 0, hs2: 0, couvert: 0 });

/**
 * Répartit jour par jour, dans l'ordre, selon le cumul de la semaine (lundi→dimanche, L3121-35).
 * Mensuel : les minutes jusqu'à la durée du contrat sont « couvertes » par le salaire mensuel.
 * @param {Map<string, number>} dayMinutes
 * @param {ContratNorm} c
 */
export function splitWeekly(dayMinutes, c) {
  const tr = tranches(c);
  const H = c.hebdo * 60;
  const cum = new Map();
  const rows = [];
  const flags = new Map();
  for (const [date, min] of [...dayMinutes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const wk = weekKey(date);
    const a = cum.get(wk) || 0,
      b = a + min;
    const row = /** @type {JourRow} */ ({ date, week: wk, month: monthKey(date), ...zero(), total: min });
    for (const t of tr) {
      const ov = Math.max(0, Math.min(b, t.to) - Math.max(a, t.from));
      row[t.k] += ov;
    }
    if (c.mode === "mensuel") row.couvert = Math.max(0, Math.min(b, H) - a);
    cum.set(wk, b);
    rows.push(row);
    const f = flags.get(wk) || [];
    if (isPartiel(c) && b > H + H / 3 && !f.includes("tiers")) f.push("tiers");
    if (isPartiel(c) && b >= c.rules.dureeLegaleH * 60 && !f.includes("legale")) f.push("legale");
    flags.set(wk, f);
  }
  return { rows, flags };
}
/** @param {JourRow[]} rows */
export function sumRows(rows) {
  const s = zero();
  /** @type {Array<"normal"|"hc1"|"hc2"|"hs1"|"hs2"|"total"|"couvert">} */
  const keys = [...KEYS, "total", "couvert"];
  for (const r of rows) for (const k of keys) s[k] += r[k];
  return s;
}

/**
 * Brut attendu (minimum légal estimé).
 * @param {JourRow[]} rows
 * @param {ContratNorm} c
 * @param {PrimeSaisie[]} [primes]
 * @param {PayOpts} [opts]
 * @returns {ExpectedPay}
 */
export function expectedPay(rows, c, primes = [], opts = {}) {
  const r = c.rules;
  const th = tauxHoraire(c);
  const s = sumRows(rows);
  const mult = { normal: 1, hc1: 1 + r.hc1Taux, hc2: 1 + r.hc2Taux, hs1: 1 + r.hs1Taux, hs2: 1 + r.hs2Taux };
  /** @param {number} x */
  const pct = (x) => Math.round(x * 1000) / 10 + " %";
  /** @param {number} m */
  const fH = (m) => fmtH(m);
  // En mensuel, les minutes « couvertes » sont retirées des tranches de rang le plus bas.
  const pay = { ...s };
  if (c.mode === "mensuel") {
    let left = s.couvert;
    for (const k of KEYS) {
      const t = Math.min(left, pay[k]);
      pay[k] -= t;
      left -= t;
    }
  }
  /** @param {"normal"|"hc1"|"hc2"|"hs1"|"hs2"} k */
  const amt = (k) => cents((pay[k] * th * mult[k]) / 60);
  const lines = [];
  let baseC;
  if (c.mode === "mensuel") {
    const nb = opts.moisMensuel ?? 1;
    baseC = cents(c.mensuel * nb) + amt("normal");
    lines.push({
      key: "base",
      label: "Salaire de base",
      detail: nb + " × " + fmtEur(c.mensuel) + " (mensuel du contrat)" + (pay.normal ? " + " + fH(pay.normal) : ""),
      montant: baseC / 100,
      regle: "L3242-1",
    });
  } else {
    baseC = amt("normal");
    lines.push({
      key: "base",
      label: "Heures normales",
      detail: fH(pay.normal) + " × " + fmtEur(th),
      montant: baseC / 100,
      regle: "L3121-27",
    });
  }
  const hcC = amt("hc1") + amt("hc2");
  if (isPartiel(c)) {
    lines.push({
      key: "hc1",
      label: "Heures complémentaires +" + pct(r.hc1Taux),
      detail: fH(pay.hc1) + " × " + fmtEur(th * mult.hc1),
      montant: amt("hc1") / 100,
      regle: "L3123-29",
    });
    lines.push({
      key: "hc2",
      label: "Heures complémentaires +" + pct(r.hc2Taux),
      detail: fH(pay.hc2) + " × " + fmtEur(th * mult.hc2),
      montant: amt("hc2") / 100,
      regle: "L3123-29",
    });
  }
  const hsC = amt("hs1") + amt("hs2");
  lines.push({
    key: "hs1",
    label: "Heures sup +" + pct(r.hs1Taux),
    detail: fH(pay.hs1) + " × " + fmtEur(th * mult.hs1),
    montant: amt("hs1") / 100,
    regle: "L3121-36",
  });
  lines.push({
    key: "hs2",
    label: "Heures sup +" + pct(r.hs2Taux),
    detail: fH(pay.hs2) + " × " + fmtEur(th * mult.hs2),
    montant: amt("hs2") / 100,
    regle: "L3121-36",
  });
  let primesBaseC = 0,
    primesHorsC = 0;
  for (const p of primes) {
    const v = cents((Number(p.montant) || 0) * (p.jours == null || p.jours === "" ? 1 : Number(p.jours) || 0));
    if (p.base) primesBaseC += v;
    else primesHorsC += v;
  }
  lines.push({
    key: "primes",
    label: "Primes et avantages soumis",
    detail: "saisis par vous",
    montant: primesBaseC / 100,
    regle: "saisie",
  });
  const brutC = baseC + hcC + hsC + primesBaseC;
  const T = TYPES[/** @type {keyof typeof TYPES} */ (c.type)];
  let finC = 0,
    iccpC = 0;
  if (T.fin) {
    finC = opts.avecFin && opts.finDue !== false ? cents((brutC * r.finTaux) / 100) : 0;
    lines.push({
      key: "fin",
      label: (c.type === "interim" ? "Fin de mission (IFM) " : "Fin de contrat (précarité) ") + pct(r.finTaux),
      detail: !opts.avecFin
        ? "pas sur cette période"
        : opts.finDue === false
          ? "non due (motif de fin)"
          : pct(r.finTaux) + " du brut",
      montant: finC / 100,
      regle: T.finArt,
    });
    const avecIccp = c.type === "interim" ? opts.avecFin : opts.avecFin && opts.avecIccp !== false;
    const inclut = c.type === "interim" ? true : !!opts.iccpInclutFin;
    iccpC = avecIccp ? cents(((brutC + (inclut ? finC : 0)) * r.iccpTaux) / 100) : 0;
    lines.push({
      key: "iccp",
      label: "Congés payés (ICCP) " + pct(r.iccpTaux),
      detail: !avecIccp
        ? "pas sur cette période"
        : pct(r.iccpTaux) + " de " + (inclut && finC ? "(brut + indemnité de fin)" : "brut"),
      montant: iccpC / 100,
      regle: T.iccpArt,
    });
  }
  lines.push({
    key: "frais",
    label: "Indemnités de frais (non soumises)",
    detail: "panier, trajet… saisis par vous",
    montant: primesHorsC / 100,
    regle: "saisie",
  });
  const brutTotalC = brutC + finC + iccpC;
  return {
    minutes: s,
    payees: pay,
    tauxHoraire: th,
    rules: r,
    contrat: c,
    lines,
    brut: brutTotalC / 100,
    hsMontant: hsC / 100,
    hcMontant: hcC / 100,
    frais: primesHorsC / 100,
    total: (brutTotalC + primesHorsC) / 100,
  };
}

/** Écart d'égalité de salaire (L1251-18, intérim) : même calcul au taux de référence saisi.
 * @param {JourRow[]} rows
 * @param {ContratNorm} c
 * @param {PrimeSaisie[]} primes
 * @param {PayOpts} opts
 */
export function egaliteEcart(rows, c, primes, opts) {
  if (c.type !== "interim" || c.mode !== "horaire" || c.tauxRef == null || !(c.tauxRef > c.taux)) return 0;
  return round2(
    expectedPay(rows, { ...c, taux: c.tauxRef }, primes, opts).total - expectedPay(rows, c, primes, opts).total,
  );
}

/**
 * Brut → net estimé (taux service-public F2302). Ne couvre pas : mutuelle/prévoyance (saisie), taux
 * réduits, apprentis, Alsace-Moselle (option), exonérations particulières.
 * @param {ExpectedPay} exp
 * @param {NetOpts} [opts]
 */
export function netEstime(exp, opts = {}) {
  const K = COTIS_2026;
  const brut = exp.brut;
  const t1 = Math.min(brut, K.pmss),
    t2 = Math.max(0, brut - K.pmss);
  const l = [];
  /** @param {string} label @param {number} base @param {number} taux */
  const add = (label, base, taux) => {
    const m = round2(base * taux);
    l.push({ label, base: round2(base), taux, montant: m });
    return m;
  };
  let cot = 0;
  cot += add("Vieillesse plafonnée", t1, K.vieillessePlaf);
  cot += add("Vieillesse déplafonnée", brut, K.vieillesseDeplaf);
  cot += add("Retraite complémentaire T1", t1, K.agircT1);
  cot += add("CEG T1", t1, K.cegT1);
  if (t2 > 0) {
    cot += add("Retraite complémentaire T2", t2, K.agircT2);
    cot += add("CEG T2", t2, K.cegT2);
    cot += add("CET", brut, K.cetT1T2);
  }
  if (opts.cadre) cot += add("APEC (cadre)", Math.min(brut, 4 * K.pmss), K.apecCadre);
  if (opts.alsaceMoselle) cot += add("Maladie Alsace-Moselle (taux URSSAF)", brut, 0.013);
  const assiette = brut * K.csgCrdsAssiette;
  const csgD = add("CSG déductible", assiette, K.csgDeductible);
  const csgND = add("CSG non déductible", assiette, K.csgNonDeductible);
  const crds = add("CRDS", assiette, K.crds);
  cot += csgD + csgND + crds;
  const hsBrut = exp.hsMontant + (opts.reductionHC ? exp.hcMontant : 0);
  const reduc = round2(
    Math.min(hsBrut * K.reductionHS, hsBrut * (K.vieillessePlaf + K.vieillesseDeplaf + K.agircT1 + K.cegT1)),
  );
  if (reduc > 0) {
    l.push({ label: "Réduction cotisations heures sup", base: round2(hsBrut), taux: -K.reductionHS, montant: -reduc });
  }
  const mutuelle = round2(Number(opts.mutuelle) || 0);
  if (mutuelle) l.push({ label: "Mutuelle / prévoyance (saisie)", base: null, taux: null, montant: mutuelle });
  const cotisations = round2(cot - reduc + mutuelle);
  const netAvantImpot = round2(brut - cotisations);
  // Option (service-public F2391) : heures sup exonérées d'impôt dans une limite annuelle de 7 500 €.
  const rVieil = K.vieillessePlaf + K.vieillesseDeplaf + K.agircT1 + K.cegT1;
  const hsImposable = round2(hsBrut - hsBrut * rVieil + reduc - hsBrut * K.csgCrdsAssiette * K.csgDeductible);
  const netImposable = round2(netAvantImpot + csgND + crds - (opts.hsExoImpot ? hsImposable : 0));
  const tauxPAS = Number(opts.tauxPAS) || 0;
  const pas = round2((Math.max(0, netImposable) * tauxPAS) / 100);
  const netVerse = round2(netAvantImpot - pas + exp.frais);
  return { lignes: l, cotisations, netAvantImpot, netImposable, tauxPAS, pas, frais: exp.frais, netVerse, hsImposable };
}

/** Compare l'attendu au bulletin, ligne par ligne. Champs vides = non comparés.
 * @param {ExpectedPay} exp
 * @param {Record<string, any>|null} bulletin
 * @param {{ egalite?: number }} [extra]
 */
export function compareBulletin(exp, bulletin, extra = {}) {
  /** @param {string} k */
  const val = (k) => (exp.lines.find((l) => l.key === k) || { montant: 0 }).montant;
  const defs = [
    {
      key: "base",
      label: "Salaire de base",
      attendu: val("base"),
      regle: exp.contrat.mode === "mensuel" ? "L3242-1" : "L3121-27",
    },
    ...(isPartiel(exp.contrat)
      ? [{ key: "hc", label: "Heures complémentaires", attendu: round2(val("hc1") + val("hc2")), regle: "L3123-29" }]
      : []),
    { key: "hs", label: "Heures supplémentaires", attendu: round2(val("hs1") + val("hs2")), regle: "L3121-36" },
    { key: "primes", label: "Primes", attendu: val("primes"), regle: "saisie" },
    ...(() => {
      const info = TYPES[/** @type {keyof typeof TYPES} */ (exp.contrat.type)];
      if (!info.fin) return [];
      const finArt = "finArt" in info ? info.finArt : "";
      const iccpArt = "iccpArt" in info ? info.iccpArt : "";
      return [
        {
          key: "fin",
          label: exp.contrat.type === "interim" ? "Indemnité de fin de mission" : "Indemnité de fin de contrat",
          attendu: val("fin"),
          regle: finArt,
        },
        { key: "iccp", label: "Congés payés (ICCP)", attendu: val("iccp"), regle: iccpArt },
      ];
    })(),
    { key: "frais", label: "Indemnités de frais", attendu: val("frais"), regle: "saisie" },
  ];
  const b = bulletin || {};
  const lines = [];
  let ecartC = 0,
    compared = 0;
  for (const d of defs) {
    let raw = b[d.key];
    if (d.key === "fin" && (raw === undefined || raw === "")) raw = b.ifm;
    const has = raw !== undefined && raw !== null && raw !== "" && Number.isFinite(Number(raw));
    const recu = has ? Number(raw) : null;
    const ecart = has && recu != null ? round2(d.attendu - recu) : null;
    if (has && ecart != null) {
      compared++;
      ecartC += cents(ecart);
    }
    lines.push({ ...d, recu, ecart });
  }
  const egalite = extra.egalite || 0;
  if (egalite > 0 && compared > 0) {
    lines.push({
      key: "egalite",
      label: "Égalité de salaire (taux de référence)",
      attendu: egalite,
      recu: 0,
      ecart: egalite,
      regle: "L1251-18",
    });
    ecartC += cents(egalite);
    compared++;
  }
  const heuresPointees = exp.minutes.total / 60;
  const heuresPayees = b.heures === undefined || b.heures === null || b.heures === "" ? null : Number(b.heures);
  const total = ecartC / 100;
  const seuil = exp.rules.seuilEcartEuros ?? 1;
  const verdict = compared === 0 ? "incomplet" : total >= seuil ? "doit" : total <= -seuil ? "trop_percu" : "ordre";
  return {
    lines,
    total,
    verdict,
    heuresPointees,
    heuresPayees,
    ecartHeures: heuresPayees == null ? null : Math.round((heuresPointees - heuresPayees) * 100) / 100,
  };
}

/** @param {string} fromDateStr */
export function prescriptionLimit(fromDateStr) {
  const [y, m, d] = fromDateStr.split("-").map(Number);
  return new Date(Date.UTC(y - 3, m - 1, d)).toISOString().slice(0, 10);
}
/** Jours ouvrés (lun.-ven.) restants dans le mois, après la date donnée. */
/** @param {string} dateStr */
export function joursOuvresRestants(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  let n = 0;
  for (let k = d + 1; ; k++) {
    const u = new Date(Date.UTC(y, m - 1, k));
    if (u.getUTCMonth() !== m - 1) break;
    const w = u.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}
/** @param {number} min */
export function fmtH(min) {
  const h = Math.floor(min / 60),
    m = Math.abs(min % 60);
  return h + " h " + String(m).padStart(2, "0");
}
/** @param {number} x */
export function fmtEur(x) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
    .format(x)
    .replace(/[\u202f\u00a0]/g, " ");
}
