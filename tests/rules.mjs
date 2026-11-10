/**
 * Cas supplémentaires : règles de regles.md, bords de mois, temps partiel,
 * majorations, arrondi au centime, entrées vides ou négatives.
 * Les montants attendus sont calculés à la main à partir des formules de calc.js.
 */
import {
  cents,
  round2,
  normContrat,
  tauxHoraire,
  isPartiel,
  deriveState,
  workIntervals,
  minutesByDay,
  splitWeekly,
  expectedPay,
  egaliteEcart,
  netEstime,
  compareBulletin,
  prescriptionLimit,
  joursOuvresRestants,
  parisDate,
  weekKey,
  fmtH,
  fmtEur,
  COTIS_2026,
} from "../js/calc.js";
import { computePeriod, previsionMois, prescriptionInfo, periodsOf, contratPunches } from "../js/compute.js";
import { parseContrat } from "../js/contrat-parse.js";
import { parisLocalToIso } from "../js/util.js";

const days = (obj) => new Map(Object.entries(obj).map(([d, h]) => [d, Math.round(h * 60)]));
const line = (e, k) => e.lines.find((l) => l.key === k);

export function runRules(t, eq) {
  console.log("=== 14. Temps partiel au-delà de 35 h, IFM et ICCP (L3123-29, L3121-36, L1251-32, L1251-19) ===");
  {
    const c = normContrat({ type: "interim", taux: 10, hebdo: 20 });
    t(isPartiel(c), "20 h : temps partiel (L3123-1)");
    const { rows, flags } = splitWeekly(days({ "2026-11-02": 46 }), c);
    const e = expectedPay(rows, c, [], { avecFin: true, finDue: true });
    eq(line(e, "base").montant, 200, "20 h normales × 10");
    eq(line(e, "hc1").montant, 22, "2 h complémentaires × 11 (+10 %)");
    eq(line(e, "hc2").montant, 162.5, "13 h complémentaires × 12,50 (+25 %)");
    eq(line(e, "hs1").montant, 100, "8 h sup × 12,50 (+25 %)");
    eq(line(e, "hs2").montant, 45, "3 h sup × 15 (+50 %)");
    eq(line(e, "fin").montant, 52.95, "IFM 10 % de 529,50");
    eq(line(e, "iccp").montant, 58.25, "ICCP 10 % de (529,50 + 52,95)");
    eq(e.brut, 640.7, "brut interim avec IFM et ICCP");
    t(
      flags.get("2026-11-02").includes("tiers") && flags.get("2026-11-02").includes("legale"),
      "alertes tiers et durée légale",
    );
  }

  console.log("=== 15. Majoration d'accord, arrondi au centime, entrées vides ou négatives ===");
  {
    const c = normContrat({ type: "cdi", taux: 10, rules: { hs1Taux: 0.1 } });
    const { rows } = splitWeekly(days({ "2026-11-02": 36 }), c);
    const e = expectedPay(rows, c, [], {});
    eq(line(e, "hs1").montant, 11, "accord : 1 h sup × 11 € (+10 %, L3121-33)");
    t(!e.lines.some((l) => l.key === "fin"), "CDI : pas de ligne de fin");
    eq(round2((1 / 60) * 10), 0.17, "1 minute à 10 €/h arrondie à 0,17");
    eq(cents(1.005), 101, "1,005 € → 101 centimes (biais du flottant corrigé)");
    eq(cents(-1.005), -101, "centimes négatifs : -1,005 € part vers -101 (arrondi du flottant)");
    t(round2(-10) === -10, "round2 négatif stable");
    const vide = normContrat({});
    t(vide.type === "interim" && vide.hebdo === 35 && vide.taux === 0, "contrat vide : intérim, 35 h, taux 0");
    const ev = expectedPay([], vide, [], { avecFin: true });
    t(ev.lines.every((l) => l.montant === 0) && ev.brut === 0 && ev.total === 0, "paie vide : tout à 0");
    const neg = expectedPay(
      splitWeekly(days({ "2026-11-02": 1 }), normContrat({ type: "cdi", taux: -10 })).rows,
      normContrat({ type: "cdi", taux: -10 }),
      [],
      {},
    );
    eq(line(neg, "base").montant, -10, "taux négatif : le moteur ne le recale pas");
    eq(tauxHoraire({ mode: "mensuel", hebdo: 0, mensuel: 2000 }), 0, "mensuel sans durée : taux 0");
    const nz = netEstime(ev, {});
    eq(nz.cotisations, 0, "net sur brut nul");
    eq(nz.netVerse, 0, "net versé nul");
    t(parseContrat("") && Object.keys(parseContrat("")).length === 0, "contrat texte vide");
    t(Object.keys(parseContrat(null)).length === 0, "contrat texte null");
    const bad = compareBulletin(ev, { base: "abc", heures: "" });
    t(bad.verdict === "incomplet" && bad.ecartHeures == null, "bulletin non numérique ignoré");
  }

  console.log("=== 16. Frontière de mois, minuit, semaine du dimanche (L3121-35) ===");
  {
    const c = normContrat({ type: "cdi", taux: 10 });
    const { rows } = splitWeekly(
      days({ "2026-03-30": 10, "2026-03-31": 10, "2026-04-01": 10, "2026-04-02": 10, "2026-04-03": 10 }),
      c,
    );
    const mars = rows.filter((r) => r.month === "2026-03");
    t(
      mars.every((r) => r.hs1 === 0 && r.hs2 === 0),
      "30-31 mars : encore sous 35 h",
    );
    const a1 = rows.find((r) => r.date === "2026-04-01");
    const a2 = rows.find((r) => r.date === "2026-04-02");
    const a3 = rows.find((r) => r.date === "2026-04-03");
    t(a1.normal === 600 && a1.hs1 === 0, "1er avril : 10 h normales (cumul 30 h)");
    t(a2.normal === 300 && a2.hs1 === 300, "2 avril : 5 h normales + 5 h à +25 %");
    t(a3.hs1 === 180 && a3.hs2 === 420, "3 avril : 3 h à +25 % + 7 h à +50 %");
    t(weekKey("2026-03-01") === "2026-02-23", "dimanche 1er mars → semaine du lundi 23 février");
    const start = "2026-11-01T22:30:00.000Z";
    t(parisDate(start) === "2026-11-01", "23 h 30 à Paris le 1er novembre");
    const mins = minutesByDay([{ start, end: "2026-11-02T00:30:00.000Z" }]);
    t(
      mins.get("2026-11-01") === 120 && !mins.has("2026-11-02"),
      "un créneau qui passe minuit reste sur le jour de début",
    );
  }

  console.log("=== 17. Motifs de fin, congés, primes dans la base (L1251-33, L1243-10, L1242-16) ===");
  {
    const base = normContrat({ type: "cdd", taux: 12, hebdo: 35 });
    const { rows } = splitWeekly(days({ "2026-11-02": 35 }), base);
    const due = expectedPay(rows, base, [], { avecFin: true, finDue: true, avecIccp: true });
    eq(line(due, "fin").montant, 42, "CDD : précarité 10 % de 420");
    eq(line(due, "iccp").montant, 42, "CDD : ICCP sur le brut seul par défaut");
    const avec = expectedPay(rows, base, [], { avecFin: true, finDue: true, avecIccp: true, iccpInclutFin: true });
    eq(line(avec, "iccp").montant, 46.2, "CDD : option ICCP sur brut + précarité");
    const pris = expectedPay(rows, base, [], { avecFin: true, finDue: true, avecIccp: false });
    eq(line(pris, "iccp").montant, 0, "congés pris : ICCP à 0 (L1242-16)");
    for (const motif of ["rupture_salarie", "faute_grave", "cdi", "refus_cdi", "autre"]) {
      const e = expectedPay(rows, base, [], { avecFin: true, finDue: false });
      eq(line(e, "fin").montant, 0, `motif ${motif} : indemnité de fin à 0`);
    }
    const inter = normContrat({ type: "interim", taux: 10 });
    const ir = splitWeekly(days({ "2026-11-02": 35 }), inter).rows;
    const sans = expectedPay(ir, inter, [], { avecFin: true });
    const avecPrime = expectedPay(ir, inter, [{ montant: 100, base: true }], { avecFin: true });
    const hors = expectedPay(ir, inter, [{ montant: 100, base: false, jours: 2 }], { avecFin: true });
    eq(line(sans, "fin").montant, 35, "IFM sans prime");
    eq(line(avecPrime, "fin").montant, 45, "prime soumise : IFM 10 % de 450");
    eq(line(hors, "fin").montant, 35, "frais hors base : IFM inchangée");
    eq(line(hors, "frais").montant, 200, "frais × jours");
    eq(egaliteEcart(ir, inter, [], { avecFin: true }), 0, "sans taux de référence : écart 0");
    eq(egaliteEcart(ir, { ...inter, tauxRef: 10 }, [], {}), 0, "taux de référence égal : écart 0");
    eq(
      egaliteEcart(ir, normContrat({ type: "cdi", taux: 10, tauxRef: 20 }), [], {}),
      0,
      "égalité de salaire ignorée hors intérim",
    );
    const ref = normContrat({ type: "interim", taux: 10, tauxRef: 12 });
    t(egaliteEcart(ir, ref, [], { avecFin: true }) > 0, "taux de référence plus haut : écart positif (L1251-18)");
  }

  console.log("=== 18. Brut → net au-dessus du plafond, options (F2302, F2391) ===");
  {
    const c = normContrat({ type: "cdi", taux: 10 });
    const exp = expectedPay([], { ...c, mode: "horaire" }, [], {});
    const haut = netEstime({ ...exp, brut: 5000, hsMontant: 0, hcMontant: 0, frais: 0 }, {});
    const by = Object.fromEntries(haut.lignes.map((l) => [l.label, l.montant]));
    eq(by["Vieillesse plafonnée"], 276.35, "6,90 % × 4 005");
    eq(by["Vieillesse déplafonnée"], 20, "0,40 % × 5 000");
    eq(by["Retraite complémentaire T1"], 126.16, "3,15 % × 4 005");
    eq(by["CEG T1"], 34.44, "0,86 % × 4 005");
    eq(by["Retraite complémentaire T2"], 85.97, "8,64 % × 995");
    eq(by["CEG T2"], 10.75, "1,08 % × 995");
    eq(by["CET"], 7, "0,14 % × 5 000");
    eq(by["CSG déductible"], 334.05, "6,8 % × 98,25 % × 5 000");
    eq(by["CSG non déductible"], 117.9, "2,4 % × 98,25 % × 5 000");
    eq(by["CRDS"], 24.56, "0,5 % × 98,25 % × 5 000");
    eq(haut.netAvantImpot, round2(5000 - haut.cotisations), "net avant impôt = brut − cotisations");
    const cadre = netEstime(
      { ...exp, brut: 5000, hsMontant: 0, hcMontant: 0, frais: 0 },
      { cadre: true, alsaceMoselle: true },
    );
    t(
      cadre.lignes.some((l) => l.label.startsWith("APEC") && l.montant === 1.2),
      "APEC cadre 0,024 %",
    );
    t(
      cadre.lignes.some((l) => l.label.includes("Alsace") && l.montant === 65),
      "Alsace-Moselle 1,30 %",
    );
    const hs = expectedPay(splitWeekly(days({ "2026-11-02": 36 }), c).rows, c, [], {});
    const n0 = netEstime(hs, {});
    const n1 = netEstime(hs, { hsExoImpot: true });
    t(n1.netImposable < n0.netImposable, "option exonération d'impôt des heures sup (F2391)");
    t(
      n0.lignes.some((l) => l.montant < 0 && l.label.includes("heures sup")),
      "réduction de cotisations sur les heures sup",
    );
    const partiel = normContrat({ type: "cdi", taux: 12, hebdo: 24 });
    const hc = expectedPay(splitWeekly(days({ "2026-11-02": 30 }), partiel).rows, partiel, [], {});
    t(
      netEstime(hc, {}).lignes.every((l) => !l.label.includes("heures sup")),
      "heures complémentaires : pas de réduction (INCONNU)",
    );
    t(
      netEstime(hc, { reductionHC: true }).lignes.some((l) => l.montant < 0),
      "option interne reductionHC",
    );
  }

  console.log("=== 19. Seuil d'écart, alias IFM, prescription, projection ===");
  {
    const c = normContrat({ type: "interim", taux: 10 });
    const e = expectedPay(splitWeekly(days({ "2026-11-02": 7 }), c).rows, c, [], { avecFin: true });
    t(compareBulletin(e, { base: line(e, "base").montant - 1 }).verdict === "doit", "écart de 1,00 € → doit");
    t(compareBulletin(e, { base: line(e, "base").montant - 0.99 }).verdict === "ordre", "écart de 0,99 € → en ordre");
    const viaIfm = compareBulletin(e, { ifm: 0 });
    t(
      viaIfm.lines.some((l) => l.key === "fin" && l.recu === 0),
      "bulletin.ifm alimente la ligne de fin",
    );
    t(prescriptionLimit("2024-02-29") === "2021-03-01", "29 février − 3 ans tombe le 1er mars");
    t(prescriptionLimit("2026-01-31") === "2023-01-31", "31 janvier − 3 ans");
    t(joursOuvresRestants("2026-11-30") === 0, "dernier jour du mois : rien après");
    t(joursOuvresRestants("2026-02-27") === 0, "vendredi 27 février 2026 : le 28 est un samedi");
    t(fmtH(90) === "1 h 30" && fmtH(-30) === "-1 h 30", "format d'heures, y compris négatif");
    t(fmtEur(1234.5).includes("1") && fmtEur(1234.5).includes("234,50"), "format euro fr-FR");
    const st = stateFor(
      { type: "interim", taux: 12, hebdo: 35, avantages: [{ libelle: "panier", montant: 9, base: false }] },
      {
        fin: { at: "2026-11-15T18:00:00.000Z", motif: "normale", congesPris: true },
        punches: [
          { contratId: "c1", action: "debut", at: "2026-11-02T07:00:00.000Z" },
          { contratId: "c1", action: "fin", at: "2026-11-02T15:00:00.000Z" },
        ],
      },
    );
    const P = computePeriod(st, "c1", "2026-11");
    t(P && P.avecFin && line(P.exp, "iccp").montant > 0, "intérim : ICCP due même si les congés sont marqués pris");
    t(
      P.primes.some((p) => p.avantage && p.montant === 9),
      "avantage du contrat compté sur le mois",
    );
    t(computePeriod(st, "absent", "2026-11") === null, "contrat inconnu");
    const ouvert = stateFor(
      { type: "cdi", taux: 12, hebdo: 35 },
      {
        punches: [
          { contratId: "c1", action: "debut", at: "2026-11-02T07:00:00.000Z" },
          { contratId: "c1", action: "fin", at: "2026-11-02T15:00:00.000Z" },
        ],
      },
    );
    const prev = previsionMois(ouvert, "c1", "2026-11-10");
    t(
      prev.restants === 14 && prev.projMin === Math.round((14 * 35 * 60) / 5) && prev.brutFin > prev.actuel.exp.brut,
      "projection des jours ouvrés restants",
    );
    t(prescriptionInfo(null, "2026-11-10") === null, "pas de premier jour");
    t(prescriptionInfo("2020-01-01", "2026-11-10").horsDelai, "2020 est hors délai de 3 ans");
    t(prescriptionInfo("2026-01-01", "2026-11-10").horsDelai === false, "2026 est dans le délai");
    const open = workIntervals([{ action: "debut", at: parisLocalToIso("2026-11-02T08:00") }], {
      now: parisLocalToIso("2026-11-02T10:00"),
    });
    t(
      open.intervals.length === 1 && open.enCours && open.anomalies.length === 0,
      "pointage en cours compté jusqu'à maintenant",
    );
    const doubles = workIntervals([
      { action: "pause", at: parisLocalToIso("2026-11-02T08:00") },
      { action: "debut", at: parisLocalToIso("2026-11-02T09:00") },
      { action: "debut", at: parisLocalToIso("2026-11-02T10:00") },
    ]);
    t(doubles.anomalies.length >= 2, "pause sans début, puis deux débuts");
    const corr = deriveState([
      rec("c", "contrat", { type: "cdi", taux: 10 }),
      rec("k", "correction", { targetId: "c", changes: { taux: 12, rules: { hs1Taux: 0.1 } }, motif: "avenant" }),
    ]);
    eq(corr.contrats.get("c").taux, 12, "correction de contrat appliquée par-dessus");
    eq(corr.contrats.get("c").rules.hs1Taux, 0.1, "correction des taux du contrat");
    const ann = deriveState([
      rec("c", "mission", { type: "interim", taux: 11 }),
      rec("f", "mission_fin", { missionId: "c", at: "2026-11-20T17:00:00.000Z", motif: "faute_grave" }),
      rec("z", "correction", { targetId: "c", annule: true, motif: "doublon" }),
    ]);
    t(!ann.contrats.has("c"), "contrat annulé retiré de l'état");
  }

  console.log("=== 20. Lecture de contrat et invariant d'arrondi ===");
  {
    const p = parseContrat(
      "Contrat de mission\nAgence : Interima Sud\nEntreprise utilisatrice : Chantier Nord\nLieu de travail : Port Marianne\nPoste : coffreur\nà compter du 1er mars 2026 jusqu'au 30/06/2026\n12,50 euros de l'heure\n39 heures par semaine\nIDCC 1596",
    );
    t(
      p.type.value === "interim" && p.employeur.value === "Interima Sud" && p.eu.value === "Chantier Nord",
      "mission : agence et entreprise utilisatrice",
    );
    t(p.lieu.value === "Port Marianne" && p.poste.value === "coffreur" && p.hebdo.value === 39, "lieu, poste, 39 h");
    t(
      p.dateDebut.value === "2026-03-01" && p.dateFin.value === "2026-06-30" && p.taux.value === 12.5,
      "dates en lettres et taux",
    );
    t(p.convention.value === "IDCC 1596", "IDCC si pas de convention nommée");
    const mensuel = parseContrat(
      "CDI\nSalaire de base 2 400,00 € par mois\n151,67 heures par mois\nConvention collective : Métallurgie",
    );
    t(
      mensuel.mode.value === "mensuel" && mensuel.mensuel.value === 2400 && mensuel.hebdo.value === 35,
      "mensuel et 151,67 h → 35 h",
    );
    t(mensuel.convention.value.startsWith("Métallurgie"), "convention nommée prioritaire");
    t(parseContrat("du 01/02/26").dateDebut.value === "2026-02-01", "année sur deux chiffres");
    t(parseContrat("à la fois intérim et CDI").type.value === "interim", "l'intérim est reconnu avant le CDI");
    t(!parseContrat("à compter du 1er nivose 2026").dateDebut, "mois inconnu : date ignorée");
    t(
      periodsOf([{ month: "2026-11" }, { month: "2026-10" }, { month: "2026-11" }]).join() === "2026-10,2026-11",
      "périodes uniques et triées",
    );
    const suivi = stateFor(
      { type: "interim", taux: 12 },
      {
        fin: { at: "2026-11-15T18:00:00.000Z", motif: "normale", congesPris: false },
        punches: [
          { contratId: "c1", action: "debut", at: "2026-11-02T07:00:00.000Z" },
          { contratId: "c1", action: "fin", at: "2026-11-02T15:00:00.000Z" },
        ],
      },
    );
    const duree = computePeriod(suivi, "c1", "contrat", { avecFin: false });
    t(duree.rows.length >= 1 && line(duree.exp, "fin").montant === 0, "toute la durée du contrat, fin forcée à 0");
    t(contratPunches(suivi, "c1").length === 2, "pointages filtrés par contrat");
    const bill = stateFor({ type: "cdd", taux: 12 }, {});
    bill.bulletins.set("c1|2026-11", { contratId: "c1", periode: "2026-11", fin: 1 });
    const auto = computePeriod(bill, "c1", "2026-11");
    t(
      auto.avecFin && line(auto.exp, "fin").montant === 0,
      "un bulletin qui verse l'indemnité active la ligne, même à 0 h",
    );
    const salaireMois = stateFor(
      { type: "cdi", mode: "mensuel", mensuel: 2000, hebdo: 35 },
      {
        punches: [
          { contratId: "c1", action: "debut", at: "2026-11-02T06:00:00.000Z" },
          { contratId: "c1", action: "fin", at: "2026-11-02T16:00:00.000Z" },
        ],
      },
    );
    const pm = previsionMois(salaireMois, "c1", "2026-11-10");
    t(
      pm.projMin === 0 && pm.actuel.exp.lines.some((l) => l.key === "base" && l.detail.includes("mensuel")),
      "mensuel : base affichée, pas de projection horaire",
    );
    t(previsionMois(suivi, "absent", "2026-11-10") === null, "projection sans contrat");
    const zeroAv = stateFor({ type: "cdi", taux: 10, avantages: [{ libelle: "rien", montant: 0 }] }, {});
    t(computePeriod(zeroAv, "c1", "2026-11").primes.length === 0, "avantage à 0 € ignoré");
    const rnd = mulberry32(20261110);
    for (let n = 0; n < 40; n++) {
      const taux = Math.round((8 + rnd() * 30) * 100) / 100;
      const type = ["cdi", "cdd", "interim"][n % 3];
      const hebdo = n % 2 === 0 ? 35 : 24;
      const c = normContrat({ type, taux, hebdo });
      const map = new Map();
      for (let d = 0; d < 5; d++) map.set(`2026-11-0${2 + d}`, Math.round(rnd() * 12 * 60));
      const { rows } = splitWeekly(map, c);
      const e = expectedPay(rows, c, [{ montant: Math.round(rnd() * 50), base: n % 3 === 0, jours: 1 }], {
        avecFin: type !== "cdi",
        finDue: n % 5 !== 0,
      });
      const parts = ["normal", "hc1", "hc2", "hs1", "hs2"].reduce((a, k) => a + e.minutes[k], 0);
      t(parts === e.minutes.total, `répartition des minutes (tirage ${n})`);
      t(
        e.lines.every((l) => Number.isFinite(l.montant) && round2(l.montant) === l.montant),
        `montants au centime (tirage ${n})`,
      );
      if (hebdo === 35 && e.minutes.total <= 35 * 60)
        t(e.minutes.hs1 === 0 && e.minutes.hs2 === 0, `pas d'heures sup sous 35 h (tirage ${n})`);
      if (e.minutes.total > 43 * 60) t(e.minutes.hs2 > 0, `tranche +50 % au-delà de 43 h (tirage ${n})`);
    }
    const sommeVieillesse =
      COTIS_2026.vieillessePlaf + COTIS_2026.vieillesseDeplaf + COTIS_2026.agircT1 + COTIS_2026.cegT1;
    t(Math.abs(sommeVieillesse - COTIS_2026.reductionHS) < 1e-9, "11,31 % = somme des taux vieillesse de la réduction");
  }
}

function rec(id, type, data) {
  return { id, type, seq: 1, t: "2026-11-10T08:00:00.000Z", hash: id, data };
}
function stateFor(contrat, extra = {}) {
  const c = { id: "c1", ...normContrat(contrat), fin: extra.fin || null };
  c.avantages = contrat.avantages || [];
  return { contrats: new Map([["c1", c]]), punches: extra.punches || [], primes: [], bulletins: new Map() };
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
