#!/usr/bin/env node
/** Tests unitaires node, cas calculés à la main (voir commentaires). */
import {
  normContrat,
  splitWeekly,
  expectedPay,
  compareBulletin,
  netEstime,
  deriveState,
  workIntervals,
  minutesByDay,
  parisDate,
  weekKey,
  tauxHoraire,
  prescriptionLimit,
  joursOuvresRestants,
} from "../js/calc.js";
import { computePeriod } from "../js/compute.js";
import { sealRecord, verifyChain, GENESIS_HASH } from "../js/chain.js";
import { parseContrat } from "../js/contrat-parse.js";
import { lettreAmiable, miseEnDemeure } from "../js/letters.js";
import { demoPartials } from "../js/demo.js";
import { parisLocalToIso } from "../js/util.js";
import fs from "node:fs";
import path from "node:path";
import { runRules } from "./rules.mjs";
import { runSecurity } from "./security.mjs";

let ok = 0,
  ko = 0;
const t = (c, m) => (c ? (ok++, console.log("  OK   " + m)) : (ko++, console.error("  FAIL " + m)));
const eq = (a, b, m) => t(Math.abs(a - b) < 0.005, `${m} : obtenu ${a}, attendu ${b}`);
const line = (e, k) => e.lines.find((l) => l.key === k).montant;
const days = (obj) => new Map(Object.entries(obj).map(([d, h]) => [d, Math.round(h * 60)]));

console.log("=== 1. Intérim 40 h à 15 €/h (semaine du lundi 2 nov. 2026) ===");
{
  const c = normContrat({ type: "interim", taux: 15 });
  const { rows } = splitWeekly(
    days({ "2026-11-02": 8, "2026-11-03": 8, "2026-11-04": 8, "2026-11-05": 8, "2026-11-06": 8 }),
    c,
  );
  const e = expectedPay(rows, c, [], { avecFin: true });
  eq(line(e, "base"), 525, "35 h × 15 = 525");
  eq(line(e, "hs1"), 93.75, "5 h × 18,75 = 93,75");
  eq(line(e, "fin"), 61.88, "IFM 10 % de 618,75 = 61,875 → 61,88");
  eq(line(e, "iccp"), 68.06, "ICCP 10 % de (618,75 + 61,88) = 68,063 → 68,06");
  eq(e.brut, 748.69, "brut total 748,69");
}

console.log("=== 2. Intérim 46 h à 12 €/h : tranche +50 % ===");
{
  const c = normContrat({ type: "interim", taux: 12 });
  const { rows } = splitWeekly(
    days({ "2026-11-02": 10, "2026-11-03": 10, "2026-11-04": 10, "2026-11-05": 10, "2026-11-06": 6 }),
    c,
  );
  const e = expectedPay(rows, c, [], { avecFin: true });
  eq(line(e, "base"), 420, "35 × 12");
  eq(line(e, "hs1"), 120, "8 × 15");
  eq(line(e, "hs2"), 54, "3 × 18");
  eq(line(e, "fin"), 59.4, "IFM 59,40");
  eq(line(e, "iccp"), 65.34, "ICCP 10 % × 653,40");
}

console.log("=== 3. Semaine à cheval sur deux mois (lun. 28 sept. → ven. 2 oct. 2026), 10 h/jour ===");
{
  const c = normContrat({ type: "interim", taux: 10 });
  const { rows } = splitWeekly(
    days({ "2026-09-28": 10, "2026-09-29": 10, "2026-09-30": 10, "2026-10-01": 10, "2026-10-02": 10 }),
    c,
  );
  const oct1 = rows.find((r) => r.date === "2026-10-01"),
    oct2 = rows.find((r) => r.date === "2026-10-02");
  t(oct1.normal === 300 && oct1.hs1 === 300, "1er oct. : 5 h normales + 5 h HS1");
  t(oct2.hs1 === 180 && oct2.hs2 === 420, "2 oct. : 3 h HS1 + 7 h HS2");
  const sept = rows.filter((r) => r.month === "2026-09");
  t(
    sept.every((r) => r.hs1 === 0 && r.hs2 === 0),
    "septembre : aucune HS (30 h)",
  );
}

console.log("=== 4. Temps partiel 24 h, CDI, 30 h travaillées à 12 €/h (L3123-29) ===");
{
  const c = normContrat({ type: "cdi", taux: 12, hebdo: 24 });
  const { rows, flags } = splitWeekly(
    days({ "2026-11-02": 6, "2026-11-03": 6, "2026-11-04": 6, "2026-11-05": 6, "2026-11-06": 6 }),
    c,
  );
  const e = expectedPay(rows, c, [], {});
  eq(line(e, "base"), 288, "24 × 12");
  eq(line(e, "hc1"), 31.68, "2,4 h × 13,20");
  eq(line(e, "hc2"), 54, "3,6 h × 15");
  t(!e.lines.some((l) => l.key === "fin"), "CDI : pas d'indemnité de fin");
  t((flags.get("2026-11-02") || []).length === 0, "30 h < 24 + 8 : pas d'alerte du tiers");
  const r2 = splitWeekly(days({ "2026-11-02": 11, "2026-11-03": 11, "2026-11-04": 11 }), c);
  t(r2.flags.get("2026-11-02").includes("tiers"), "33 h > 32 h : alerte dépassement du tiers");
}

console.log("=== 5. CDI mensuel 2 000 € pour 35 h, semaine de 38 h ===");
{
  const c = normContrat({ type: "cdi", mode: "mensuel", mensuel: 2000, hebdo: 35 });
  eq(tauxHoraire(c), 13.1868, "taux horaire 2000 / 151,67");
  const { rows } = splitWeekly(
    days({ "2026-11-02": 8, "2026-11-03": 8, "2026-11-04": 8, "2026-11-05": 8, "2026-11-06": 6 }),
    c,
  );
  const e = expectedPay(rows, c, [], {});
  eq(line(e, "base"), 2000, "salaire de base = mensuel");
  eq(line(e, "hs1"), 49.45, "3 h × 13,1868 × 1,25 = 49,45");
}

console.log("=== 6. CDD 35 h à 12 € : précarité (L1243-8) et ICCP (L1242-16) ===");
{
  const c = normContrat({ type: "cdd", taux: 12 });
  const { rows } = splitWeekly(
    days({ "2026-11-02": 7, "2026-11-03": 7, "2026-11-04": 7, "2026-11-05": 7, "2026-11-06": 7 }),
    c,
  );
  const e = expectedPay(rows, c, [], { avecFin: true });
  eq(line(e, "fin"), 42, "précarité 10 % × 420");
  eq(line(e, "iccp"), 42, "ICCP 10 % × 420 (base sans précarité par défaut)");
  const e2 = expectedPay(rows, normContrat({ type: "cdd", taux: 12, rules: { finTaux: 0.06 } }), [], { avecFin: true });
  eq(line(e2, "fin"), 25.2, "taux réglable 6 % (convention, service-public F40)");
  const e3 = expectedPay(rows, c, [], { avecFin: true, finDue: false });
  eq(line(e3, "fin"), 0, "rupture à l'initiative du salarié : 0 (L1243-10)");
}

console.log("=== 7. Brut → net au SMIC 1 867,02 € (taux service-public F2302) ===");
{
  const c = normContrat({ type: "cdi", mode: "mensuel", mensuel: 1867.02 });
  const e = expectedPay([], c, [], {});
  const n = netEstime(e, {});
  eq(n.cotisations, 389.09, "cotisations 389,09");
  eq(n.netAvantImpot, 1477.93, "net avant impôt 1 477,93");
  eq(n.netImposable, 1531.12, "net imposable 1 531,12");
  const n2 = netEstime(e, { tauxPAS: 5 });
  eq(n2.pas, 76.56, "prélèvement à la source 5 % × 1 531,12");
  eq(n2.netVerse, 1401.37, "net versé");
  const n3 = netEstime(e, { mutuelle: 30 });
  eq(n3.netAvantImpot, 1447.93, "mutuelle saisie 30 € retirée");
}

console.log("=== 8. Pointages, pauses, corrections tracées, chaîne SHA-256 ===");
{
  const mk = (seq, type, data, prev) =>
    sealRecord({ seq, id: "r" + seq, type, t: "2026-11-10T08:00:00.000Z", data }, prev);
  const recs = [];
  let prev = GENESIS_HASH;
  const push = async (type, data) => {
    const r = await mk(recs.length + 1, type, data, prev);
    recs.push(r);
    prev = r.hash;
    return r;
  };
  await push("genesis", {});
  const c = await push("contrat", { type: "cdi", taux: 10 });
  await push("punch", { contratId: c.id, action: "debut", at: parisLocalToIso("2026-11-09T08:00") });
  await push("punch", { contratId: c.id, action: "pause", at: parisLocalToIso("2026-11-09T12:00") });
  await push("punch", { contratId: c.id, action: "reprise", at: parisLocalToIso("2026-11-09T13:00") });
  const fin = await push("punch", { contratId: c.id, action: "fin", at: parisLocalToIso("2026-11-09T16:00") });
  const bad = await push("punch", { contratId: c.id, action: "debut", at: parisLocalToIso("2026-11-09T18:00") });
  await push("correction", { targetId: fin.id, changes: { at: parisLocalToIso("2026-11-09T17:30") }, motif: "oubli" });
  await push("correction", { targetId: bad.id, annule: true, motif: "erreur de bouton" });
  const st = deriveState(recs);
  const w = workIntervals(st.punches);
  const min = [...minutesByDay(w.intervals).values()].reduce((a, b) => a + b, 0);
  t(min === 8.5 * 60, "4 h + 4 h 30 après correction = 8 h 30");
  t(st.items.get(fin.id).original.at === parisLocalToIso("2026-11-09T16:00"), "l'heure d'origine reste visible");
  t(st.items.get(fin.id).corrections.length === 1, "la correction est attachée");
  t(w.anomalies.length === 0, "pointage annulé ignoré, pas d'anomalie");
  t((await verifyChain(recs)).ok, "chaîne intacte");
  const forged = recs.map((r) => ({ ...r, data: { ...r.data } }));
  forged[3].data.at = parisLocalToIso("2026-11-09T07:00");
  const v = await verifyChain(forged);
  t(!v.ok && v.errors.some((e) => e.includes("altérée")), "modification d'un pointage détectée");
  const cut = recs.filter((_, i) => i !== 4);
  t(!(await verifyChain(cut)).ok, "suppression d'un enregistrement détectée");
}

console.log("=== 9. Données EXEMPLE : écart attendu calculé à la main ===");
{
  const recs = [];
  let prev = GENESIS_HASH;
  let contratId = null;
  const refs = {};
  for (const [i, p] of demoPartials().entries()) {
    const data = { ...p.data };
    if (p.type !== "contrat" && contratId) data.contratId = contratId;
    if (p.type === "correction") data.targetId = refs[p.targetRef];
    const r = await sealRecord({ seq: i + 1, id: "d" + i, type: p.type, t: "2026-11-10T09:00:00.000Z", data }, prev);
    recs.push(r);
    prev = r.hash;
    if (p.type === "contrat") contratId = r.id;
    if (p.ref) refs[p.ref] = r.id;
  }
  const st = deriveState(recs);
  const P = computePeriod(st, contratId, "2026-10");
  eq(P.exp.minutes.total / 60, 174, "174 h pointées (4 × 43,5 h)");
  eq(line(P.exp, "base"), 1890, "140 h × 13,50");
  eq(line(P.exp, "hs1"), 540, "32 h × 16,875");
  eq(line(P.exp, "hs2"), 40.5, "2 h × 20,25");
  eq(line(P.exp, "fin"), 247.05, "IFM");
  eq(line(P.exp, "iccp"), 271.76, "ICCP 10 % × 2 717,55");
  eq(P.egalite, 88.57, "égalité de salaire au taux de référence 13,90");
  eq(P.cmp.total, 382.6, "L'agence vous doit 382,60 € (243 + 24,30 + 26,73 + 88,57)");
  t(P.cmp.verdict === "doit", "verdict « doit »");
  eq(P.cmp.ecartHeures, 14, "174 h pointées − 160 h payées = 14 h");
  const txt = miseEnDemeure({
    profil: {},
    mission: P.contrat,
    periodeLabel: "Octobre 2026",
    compare: P.cmp,
    dateStr: "10/11/2026",
    annexe: { count: recs.length, head: prev },
  });
  t(
    txt.includes("L1251-32") && txt.includes("L3245-1") && txt.includes("382,60"),
    "mise en demeure : articles + montant",
  );
  t(txt.includes("pas un conseil juridique"), "mention « pas un conseil juridique »");
  const am = lettreAmiable({
    profil: {},
    mission: P.contrat,
    periodeLabel: "Octobre 2026",
    compare: P.cmp,
    dateStr: "10/11/2026",
    annexe: {},
  });
  t(am.includes("régularisation") && !am.includes("mise en demeure"), "demande amiable sans menace");
}

console.log("=== 10. Tout est en ordre / trop-perçu ===");
{
  const c = normContrat({ type: "cdi", taux: 10 });
  const { rows } = splitWeekly(days({ "2026-11-02": 7 }), c);
  const e = expectedPay(rows, c, [], {});
  t(compareBulletin(e, { base: 70 }).verdict === "ordre", "bulletin exact → en ordre");
  t(compareBulletin(e, { base: 69.5 }).verdict === "ordre", "écart de 0,50 € < seuil 1 € → en ordre");
  t(compareBulletin(e, { base: 60 }).verdict === "doit", "10 € manquants → doit");
  t(compareBulletin(e, { base: 80 }).verdict === "trop_percu", "10 € de trop → trop-perçu");
  t(compareBulletin(e, {}).verdict === "incomplet", "bulletin vide → incomplet");
  t(
    compareBulletin(e, null, { egalite: 17.4 }).verdict === "incomplet",
    "sans bulletin, l'écart d'égalité seul ne déclenche pas « doit »",
  );
}

console.log("=== 11. Dates, prescription, extraction de contrat ===");
{
  t(parisDate("2026-10-31T23:30:00Z") === "2026-11-01", "minuit heure de Paris (UTC+1)");
  t(parisDate("2026-07-14T22:30:00Z") === "2026-07-15", "été (UTC+2)");
  t(weekKey("2026-11-08") === "2026-11-02", "dimanche → semaine du lundi");
  t(prescriptionLimit("2026-11-10") === "2023-11-10", "prescription 3 ans (L3245-1)");
  t(joursOuvresRestants("2026-11-10") === 14, "14 jours ouvrés restants après le 10/11/2026 (férié du 11 non déduit)");
  const p = parseContrat(
    "CONTRAT A DUREE DETERMINEE\nEmployeur : Boulangerie Exemple\nPoste : vendeuse\nà compter du 1er décembre 2026 jusqu'au 31/03/2027\nDurée : 24 heures par semaine\nSalaire mensuel brut : 1 300,00 € par mois\nConvention collective : Boulangerie-pâtisserie artisanale",
  );
  t(p.type.value === "cdd", "type CDD détecté");
  t(p.hebdo.value === 24, "24 h/semaine");
  t(p.mensuel.value === 1300 && p.mode.value === "mensuel", "mensuel 1 300 €");
  t(p.dateDebut.value === "2026-12-01" && p.dateFin.value === "2027-03-31", "dates début/fin");
  t(p.employeur.value === "Boulangerie Exemple", "employeur");
  t(!!p.convention, "convention");
  const q = parseContrat(
    "Contrat à durée indéterminée. Rémunération : 12,50 euros de l'heure. 151,67 heures mensuelles.",
  );
  t(
    q.type.value === "cdi" && q.taux.value === 12.5 && Math.abs(q.hebdo.value - 35) < 0.01,
    "CDI, 12,50 €/h, 151,67 h/mois → 35 h",
  );
}

console.log("=== 12. Net versé = net avant impôt − impôt + indemnités non soumises (exemple d'octobre) ===");
{
  const recs = [];
  let prev = GENESIS_HASH;
  let cid = null;
  const refs = {};
  for (const [i, p] of demoPartials().entries()) {
    const data = { ...p.data };
    if (p.type !== "contrat" && cid) data.contratId = cid;
    if (p.type === "correction") data.targetId = refs[p.targetRef];
    const r = await sealRecord({ seq: i + 1, id: "n" + i, type: p.type, t: "2026-11-10T09:00:00.000Z", data }, prev);
    recs.push(r);
    prev = r.hash;
    if (p.type === "contrat") cid = r.id;
    if (p.ref) refs[p.ref] = r.id;
  }
  const st = deriveState(recs);
  for (const tauxPAS of [0, 5.4]) {
    const P = computePeriod(st, cid, "2026-10", { net: { tauxPAS } });
    const affichees = P.primes.filter((x) => !x.base).reduce((a, x) => a + x.montant * (x.jours ?? 1), 0);
    eq(affichees, 220, `PAS ${tauxPAS} % : indemnités non soumises affichées = 20 × 11 € = 220 €`);
    eq(P.net.frais, affichees, "le net utilise exactement les indemnités affichées");
    eq(
      P.net.netVerse,
      Math.round((P.net.netAvantImpot - P.net.pas + affichees) * 100) / 100,
      `net versé ${P.net.netVerse} = ${P.net.netAvantImpot} − ${P.net.pas} + ${affichees}`,
    );
    eq(P.exp.brut, 2989.31, "brut attendu 2 989,31 (1 890 + 540 + 40,50 + IFM 247,05 + ICCP 271,76)");
    t(!P.exp.lines.some((l) => l.key !== "frais" && l.montant === 220), "les 220 € ne sont pas dans le brut");
  }
  const P0 = computePeriod(st, cid, "2026-10", { net: {} });
  // À la main : 6,90 % 206,26 · 0,40 % 11,96 · 3,15 % 94,16 · 0,86 % 25,71 · assiette 2 989,31 × 98,25 % = 2 936,997
  // CSG 6,8 % 199,72 · 2,4 % 70,49 · CRDS 0,5 % 14,68 · réduction HS 580,50 × 11,31 % = −65,65 → 557,33
  eq(P0.net.cotisations, 557.33, "cotisations 557,33 (calcul à la main)");
  eq(P0.net.netAvantImpot, 2431.98, "net avant impôt 2 431,98 = 2 989,31 − 557,33");
  eq(P0.net.netVerse, 2651.98, "net versé 2 651,98 = 2 431,98 − 0 + 220");
}

console.log("=== 13. Chemins relatifs pour GitHub Pages (/Paie-juste/) ===");
{
  const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  const pages = "https://haynbroit-alt.github.io/Paie-juste/";
  const manifestUrl = new URL("manifest.json", pages);
  t(
    String(manifest.start_url).startsWith("./") && String(manifest.scope).startsWith("./"),
    "manifeste : start_url et scope relatifs",
  );
  t(
    manifest.icons.every((i) => String(i.src).startsWith("./")),
    "manifeste : icônes relatives",
  );
  t(!/href="\//.test(html) && !/src="\//.test(html), "HTML : aucun chemin à la racine du domaine");
  t(
    /register\(\s*"\.\/sw\.js"/.test(app) && !/register\(\s*"\//.test(app),
    "service worker enregistré en relatif, pas à la racine du domaine",
  );
  const start = new URL(manifest.start_url, manifestUrl);
  const scope = new URL(manifest.scope, manifestUrl);
  t(start.pathname.startsWith("/Paie-juste/"), "start_url résolu : " + start.pathname);
  t(scope.pathname === "/Paie-juste/", "scope résolu : " + scope.pathname);
  t(
    manifest.icons.every((i) => new URL(i.src, manifestUrl).pathname.startsWith("/Paie-juste/icons/")),
    "icônes résolues sous /Paie-juste/icons/",
  );
  t(new URL("./sw.js", pages).pathname === "/Paie-juste/sw.js", "sw.js résolu sous /Paie-juste/");
}

runRules(t, eq);
runSecurity(t);

console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
