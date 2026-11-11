// @ts-check
/**
 * @typedef {import("./calc.js").ContratNorm} ContratNorm
 * @typedef {import("./calc.js").JourRow} JourRow
 * @typedef {import("./calc.js").NetOpts} NetOpts
 */

/**
 * @typedef {Object} AppState
 * @property {Map<string, ContratNorm>} contrats
 * @property {any[]} punches
 * @property {any[]} primes
 * @property {Map<string, any>} bulletins
 */

/**
 * @typedef {Object} PeriodOpts
 * @property {string} [now]
 * @property {boolean|null} [avecFin]
 * @property {NetOpts} [net]
 */

/** Assemble le calcul d'une période pour un contrat (pur, testable). */
import {
  workIntervals,
  minutesByDay,
  splitWeekly,
  expectedPay,
  egaliteEcart,
  compareBulletin,
  parisDate,
  MOTIFS_FIN,
  prescriptionLimit,
  netEstime,
  joursOuvresRestants,
  tauxHoraire,
  controleSmic,
  TYPES,
} from "./calc.js";

/** @param {AppState} state @param {string} id */
export const contratPunches = (state, id) => state.punches.filter((p) => p.contratId === id);

/** @param {AppState} state @param {string} id @param {string} [now] */
export function contratRows(state, id, now) {
  const c = state.contrats.get(id);
  const w = workIntervals(contratPunches(state, id), { now });
  if (!c) return { rows: [], flags: new Map(), intervals: w.intervals, anomalies: w.anomalies, enCours: w.enCours };
  const { rows, flags } = splitWeekly(minutesByDay(w.intervals), c);
  return { rows, flags, intervals: w.intervals, anomalies: w.anomalies, enCours: w.enCours };
}
/** @param {Array<{month: string}>} rows */
export const periodsOf = (rows) => [...new Set(rows.map((r) => r.month))].sort();

/**
 * periode : « AAAA-MM » ou « contrat » (toute la durée).
 * opts : { avecFin (null = auto), now, net: {cadre, alsaceMoselle, mutuelle, tauxPAS, hsExoImpot}, projection }
 */
/**
 * @param {AppState} state
 * @param {string} id
 * @param {string} periode
 * @param {PeriodOpts} [opts]
 */
export function computePeriod(state, id, periode, opts = {}) {
  const c = state.contrats.get(id);
  if (!c) return null;
  const { rows, flags, anomalies } = contratRows(state, id, opts.now);
  const pr = periode === "contrat" ? rows : rows.filter((r) => r.month === periode);
  const primes = state.primes.filter(
    (p) => p.contratId === id && (periode === "contrat" || (p.date || "").slice(0, 7) === periode),
  );
  // Avantages fixes du contrat (mensuels) : comptés une fois par mois de la période.
  const mois = periode === "contrat" ? Math.max(1, new Set(rows.map((r) => r.month)).size) : 1;
  for (const a of c.avantages || []) {
    if (Number(a.montant)) {
      primes.push({
        libelle: a.libelle,
        montant: Number(a.montant),
        jours: mois,
        base: a.base !== false,
        avantage: true,
      });
    }
  }
  const finDansPeriode =
    !!c.fin && (periode === "contrat" || parisDate(/** @type {string} */ (c.fin.at)).slice(0, 7) === periode);
  const bulletin = state.bulletins.get(id + "|" + periode) || null;
  // Automatique : fin du contrat dans la période, ou bulletin qui verse déjà ces indemnités (versement mensuel).
  const bulletinPaie =
    !!bulletin && [bulletin.fin, bulletin.ifm, bulletin.iccp].some((v) => v !== undefined && v !== null && v !== "");
  const avecFin = opts.avecFin == null ? finDansPeriode || bulletinPaie : !!opts.avecFin;
  const motifKey = c.fin && typeof c.fin.motif === "string" ? c.fin.motif : "";
  const motif = Object.hasOwn(MOTIFS_FIN, motifKey)
    ? MOTIFS_FIN[/** @type {keyof typeof MOTIFS_FIN} */ (motifKey)]
    : null;
  const calcOpts = {
    avecFin,
    finDue: motif ? motif.fin : true,
    avecIccp: c.fin ? !c.fin.congesPris : true,
    iccpInclutFin: !!c.rules.iccpInclutFin,
    moisMensuel: mois,
  };
  const exp = expectedPay(pr, c, primes, calcOpts);
  const egalite = egaliteEcart(pr, c, primes, calcOpts);
  // Sans heures notées pour la période, comparer le bulletin à « 0 h attendues » n'aurait pas de sens.
  const cmp = compareBulletin(exp, pr.length ? bulletin : null, { egalite });
  const weeks = new Map();
  for (const r of pr) {
    const w = weeks.get(r.week) || {
      week: r.week,
      total: 0,
      normal: 0,
      hc1: 0,
      hc2: 0,
      hs1: 0,
      hs2: 0,
      flags: flags.get(r.week) || [],
    };
    for (const k of /** @type {Array<"total"|"normal"|"hc1"|"hc2"|"hs1"|"hs2">} */ ([
      "total",
      "normal",
      "hc1",
      "hc2",
      "hs1",
      "hs2",
    ])) {
      w[k] += r[k];
    }
    weeks.set(r.week, w);
  }
  const net = netEstime(exp, opts.net || {});
  // SMIC : celui du 1er jour du mois (il change toujours un 1er) ; pour tout le contrat, celui du dernier jour travaillé.
  const dateSmic = periode === "contrat" ? (pr.length ? pr[pr.length - 1].date : null) : periode + "-01";
  const smic = dateSmic ? controleSmic(c, dateSmic) : null;
  return {
    smic,
    contrat: c,
    rows: pr,
    weeks: [...weeks.values()],
    primes,
    exp,
    net,
    egalite,
    bulletin,
    cmp,
    avecFin,
    anomalies,
    firstDay: pr[0]?.date || null,
    lastDay: pr[pr.length - 1]?.date || null,
  };
}

/**
 * Prévision « ce que vous allez toucher ce mois » : heures pointées à ce jour + projection simple
 * des jours ouvrés restants à (durée hebdo / 5) heures, en heures normales. Estimation.
 */
/**
 * @param {AppState} state
 * @param {string} id
 * @param {string} todayStr
 * @param {PeriodOpts} [opts]
 */
export function previsionMois(state, id, todayStr, opts = {}) {
  const c = state.contrats.get(id);
  if (!c) return null;
  const mois = todayStr.slice(0, 7);
  const actuel = computePeriod(state, id, mois, { ...opts, avecFin: opts.avecFin ?? null });
  if (!actuel) return null;
  const restants = joursOuvresRestants(todayStr);
  let projMin = 0;
  if (c.mode === "horaire" && !c.fin) projMin = Math.round((restants * c.hebdo * 60) / 5);
  const th = tauxHoraire(c);
  const projBrut = Math.round(((projMin * th) / 60) * 100) / 100;
  const brutFin = Math.round((actuel.exp.brut + projBrut) * 100) / 100;
  const netFin = netEstime({ ...actuel.exp, brut: brutFin }, opts.net || {});
  return {
    mois,
    actuel,
    restants,
    projMin,
    projBrut,
    brutFin,
    netFin,
    type: TYPES[/** @type {keyof typeof TYPES} */ (c.type)].label,
  };
}
/** @param {string|null} firstDay @param {string} todayStr */
export function prescriptionInfo(firstDay, todayStr) {
  if (!firstDay) return null;
  const limite = prescriptionLimit(todayStr);
  return { limite, horsDelai: firstDay < limite };
}
