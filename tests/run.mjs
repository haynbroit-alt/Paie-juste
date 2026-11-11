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
  smicHoraire,
  controleSmic,
  tauxAJour,
  TAUX_VERIFIES_JUSQU_AU,
  verifierBulletinSeul,
} from "../js/calc.js";
import { computePeriod } from "../js/compute.js";
import { sealRecord, verifyChain, GENESIS_HASH } from "../js/chain.js";
import { parseContrat } from "../js/contrat-parse.js";
import { parseBulletin } from "../js/bulletin-parse.js";
import { chiffrer, dechiffrer, estSauvegardeChiffree, codeValide, META_KEYS, ITERATIONS } from "../js/sauvegarde.js";
import { lettreAmiable, miseEnDemeure, demandeAccesRgpd } from "../js/letters.js";
import { demoPartials } from "../js/demo.js";
import { parisLocalToIso } from "../js/util.js";
import {
  journeePunches,
  motifJournee,
  googleAgendaUrl,
  rappelsIcs,
  rappelsParDefaut,
  resumeJournees,
  joursDeSemaine,
  joursRecents,
} from "../js/journee.js";
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
  const rg = demandeAccesRgpd({ profil: {}, mission: P.contrat, periodeLabel: "Octobre 2026", dateStr: "10/11/2026" });
  t(rg.includes("article 15") && rg.includes("2016/679"), "RGPD : article 15 du règlement cité");
  t(rg.includes("un mois") && rg.includes("deux mois") && rg.includes("gratuite"), "RGPD : délai et gratuité");
  t(rg.includes("entreprise utilisatrice"), "RGPD intérim : relevés transmis par l'entreprise utilisatrice");
  t(!/restant dû|vous mets en demeure|Total/.test(rg), "RGPD : aucun montant réclamé, aucune menace");
  t(rg.includes("cnil.fr") && rg.includes("pas un conseil juridique"), "RGPD : recours CNIL et avertissement");
  const rgCdi = demandeAccesRgpd({
    profil: {},
    mission: { type: "cdi", mode: "mensuel", mensuel: 2000, hebdo: 35 },
    periodeLabel: "Octobre 2026",
    dateStr: "10/11/2026",
  });
  t(!rgCdi.includes("entreprise utilisatrice") && rgCdi.includes("pointages"), "RGPD CDI : sans mention d'intérim");
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

console.log("=== 22. Saisie simple de la journée et rappels ===");
{
  const j = journeePunches({ date: "2026-11-09", debut: "07:30", fin: "16:30", pauseMin: 60 });
  t(j.ok && j.minutes === 480, "07:30-16:30, pause 1 h → 8 h");
  t(
    j.ok && j.punches.map((p) => p.action).join() === "debut,pause,reprise,fin",
    "4 pointages : début, pause, reprise, fin",
  );
  t(j.ok && j.punches[0].at === parisLocalToIso("2026-11-09T07:30"), "début à l'heure de Paris saisie");
  t(j.ok && j.punches[3].at === parisLocalToIso("2026-11-09T16:30"), "fin à l'heure de Paris saisie");
  if (j.ok) {
    const w = workIntervals(j.punches);
    const mins = [...minutesByDay(w.intervals).values()].reduce((a, b) => a + b, 0);
    t(mins === 480 && !w.anomalies.length, "le moteur de paie compte bien 8 h, sans anomalie");
  }
  const sans = journeePunches({ date: "2026-11-09", debut: "08:00", fin: "12:00", pauseMin: 0 });
  t(sans.ok && sans.punches.length === 2 && sans.minutes === 240, "sans pause : 2 pointages, 4 h");
  const dst = journeePunches({ date: "2026-10-25", debut: "07:00", fin: "16:00", pauseMin: 60 });
  t(dst.ok && dst.minutes === 480, "jour du changement d'heure : 8 h");
  t(!journeePunches({ date: "2026-11-09", debut: "16:00", fin: "08:00" }).ok, "fin avant début refusée");
  t(
    !journeePunches({ date: "2026-11-09", debut: "08:00", fin: "09:00", pauseMin: 60 }).ok,
    "pause plus longue que la journée refusée",
  );
  t(!journeePunches({ date: "2026-11-09", debut: "8h", fin: "17:00" }).ok, "format d'heure invalide refusé");
  t(!journeePunches({ date: "", debut: "08:00", fin: "17:00" }).ok, "date manquante refusée");
  t(motifJournee(45).includes("45 min") && motifJournee(0) === "Journée saisie en une fois", "motif scellé explicite");

  const [soir, mois] = rappelsParDefaut({ date: "2026-11-10", heure: "19:00", appUrl: "https://exemple.netlify.app/" });
  const g = new URL(googleAgendaUrl(soir));
  t(
    g.hostname === "calendar.google.com" && g.searchParams.get("recur") === "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "Google Agenda : rappel chaque soir de semaine",
  );
  t(
    g.searchParams.get("dates") === "20261110T190000/20261110T191000" && g.searchParams.get("ctz") === "Europe/Paris",
    "Google Agenda : 19 h, heure de Paris",
  );
  t(
    new URL(googleAgendaUrl(mois)).searchParams.get("recur") === "RRULE:FREQ=MONTHLY;BYMONTHDAY=-1",
    "Google Agenda : dernier jour du mois",
  );
  const ics = rappelsIcs([soir, mois], "20261110T120000Z");
  t(
    ics.split("BEGIN:VEVENT").length === 3 && ics.split("BEGIN:VALARM").length === 3,
    ".ics : 2 événements avec alarme",
  );
  t(
    ics.includes("DTSTART;TZID=Europe/Paris:20261110T190000") && ics.includes("RRULE:FREQ=MONTHLY;BYMONTHDAY=-1"),
    ".ics : heure et récurrence",
  );
  t(
    ics.includes("\r\n") && ics.includes("https://exemple.netlify.app/"),
    ".ics : fins de ligne CRLF et lien de l'appli",
  );
  t(!/€|salaire brut|@/.test(ics.replaceAll("@paie-juste", "")), ".ics : aucune donnée de paie");
}

console.log("=== 23. Mes journées et ma semaine ===");
{
  const mk = (date, debut, fin, pauseMin, extra = {}) =>
    journeePunches({ date, debut, fin, pauseMin }).punches.map((p, k) => ({
      id: date + k,
      ...p,
      corrections: [],
      ...extra,
    }));
  const lun = mk("2026-11-09", "07:30", "16:30", 60);
  const mar = mk("2026-11-10", "08:00", "12:00", 0);
  const r = resumeJournees([...lun, ...mar]);
  t(r.length === 2 && r[0].date === "2026-11-10", "une ligne par jour, la plus récente d'abord");
  const l = r.find((x) => x.date === "2026-11-09");
  t(
    l.arrivee === "07:30" && l.depart === "16:30" && l.pauseMin === 60 && l.minutes === 480,
    "lundi : 07:30 → 16:30, pause 1 h, 8 h",
  );
  t(!l.aVerifier && !l.modifiee && !l.supprimee, "lundi : complet, non modifié");
  const incomplet = resumeJournees([
    { id: "x", action: "debut", at: parisLocalToIso("2026-11-11T07:30"), corrections: [] },
  ]);
  t(incomplet[0].aVerifier && incomplet[0].depart === "", "départ manquant → « à vérifier »");
  const annules = lun.map((p) => ({ ...p, annule: true, corrections: [{ motif: "parti à 17 h" }] }));
  const neuf = mk("2026-11-09", "07:30", "17:00", 60).map((p) => ({ ...p, id: "n" + p.id }));
  const m = resumeJournees(neuf, [...annules, ...neuf]).find((x) => x.date === "2026-11-09");
  t(
    m.minutes === 510 && m.modifiee && m.motifs.includes("parti à 17 h"),
    "modification : nouveau total et motif gardé",
  );
  const s = resumeJournees([], annules).find((x) => x.date === "2026-11-09");
  t(s.supprimee && s.minutes === 0, "journée supprimée : reste visible, à 0 h");
  const sem = joursDeSemaine("2026-11-09");
  t(sem.length === 7 && sem[0] === "2026-11-09" && sem[6] === "2026-11-15", "semaine du lundi au dimanche");
  t(joursDeSemaine("2026-10-26")[6] === "2026-11-01", "semaine à cheval sur deux mois");
  const rec = joursRecents("2026-03-01", 3);
  t(rec.join() === "2026-03-01,2026-02-28,2026-02-27", "jours récents : passage de mois");
}

console.log("=== 24. Lecture d'un bulletin de paie ===");
{
  const texte = [
    "BULLETIN DE PAIE",
    "Période du 01/10/2026 au 31/10/2026",
    "Salaire de base 151,67 12,0200 1 823,07",
    "Heures supplémentaires 25 % 17,33 15,0250 260,38",
    "Heures supplémentaires 50 % 4,00 18,0300 72,12",
    "Prime de salissure 50,00",
    "Indemnité de fin de mission 220,56",
    "Indemnité compensatrice de congés payés 242,61",
    "SALAIRE BRUT 2 668,74",
    "Sécurité sociale maladie 2 668,74 0,00",
    "CSG déductible 2 622,04 6,80 178,30",
    "Indemnité de panier 10 9,50 95,00",
    "Indemnité de trajet 10 4,20 42,00",
    "NET A PAYER 2 214,55",
    "Cumul brut 12 000,00",
  ].join("\n");
  const { champs: c, periode } = parseBulletin(texte);
  t(periode === "2026-10", "période lue : octobre 2026");
  t(c.heures?.value === 151.67, "heures payées : 151,67");
  t(c.base?.value === 1823.07, "salaire de base : 1 823,07 €");
  t(c.hs?.value === 332.5, "heures sup additionnées (25 % + 50 %) : 332,50 €");
  t(c.primes?.value === 50, "prime : 50 €");
  t(c.fin?.value === 220.56, "IFM : 220,56 €");
  t(c.iccp?.value === 242.61, "ICCP : 242,61 €");
  t(c.frais?.value === 137, "panier + trajet : 137 €");
  t(c.brut?.value === 2668.74 && c.net?.value === 2214.55, "brut et net lus pour vérification");
  t(!("csg" in c) && c.brut.value !== 12000, "cotisations et cumuls ignorés");
  t(c.base.extrait.includes("Salaire de base"), "chaque montant garde sa ligne d'origine");
  t(Object.keys(parseBulletin("").champs).length === 0, "texte vide : rien proposé");
  t(parseBulletin("Salaire de base 151.67 12.02 1823.07").champs.base?.value === 1823.07, "points décimaux acceptés");
}

console.log("=== 25. Sauvegarde chiffrée ===");
{
  const contenu = { export: { records: [{ seq: 0, type: "genesis" }] }, meta: { profil: { nom: "Jean Exemple" } } };
  const s = await chiffrer(contenu, "mon-code-secret", { iterations: 1000 });
  t(
    estSauvegardeChiffree(s) && s.kdf.name === "PBKDF2" && s.chiffrement.name === "AES-GCM",
    "format : PBKDF2 + AES-GCM",
  );
  t(!JSON.stringify(s).includes("Jean Exemple"), "le fichier ne contient rien de lisible");
  const r = await dechiffrer(s, "mon-code-secret");
  t(JSON.stringify(r) === JSON.stringify(contenu), "aller-retour : données identiques");
  let erreur = "";
  try {
    await dechiffrer(s, "mauvais-code");
  } catch (e) {
    erreur = e.message;
  }
  t(erreur.includes("Code incorrect"), "mauvais code refusé");
  const abime = {
    ...s,
    donnees: s.donnees.slice(0, -6) + (s.donnees.slice(-6, -5) === "A" ? "B" : "A") + s.donnees.slice(-5),
  };
  erreur = "";
  try {
    await dechiffrer(abime, "mon-code-secret");
  } catch (e) {
    erreur = e.message;
  }
  t(erreur !== "", "fichier modifié détecté");
  const s2 = await chiffrer(contenu, "mon-code-secret", { iterations: 1000 });
  t(s2.kdf.sel !== s.kdf.sel && s2.chiffrement.iv !== s.chiffrement.iv, "sel et vecteur tirés au hasard à chaque fois");
  t(codeValide("court") !== "" && codeValide("assez-long") === "", "code de 8 caractères minimum");
  let refuse = false;
  try {
    await chiffrer(contenu, "court");
  } catch {
    refuse = true;
  }
  t(refuse, "chiffrer avec un code trop court : refusé");
  t(ITERATIONS >= 600000, "600 000 itérations par défaut");
  t(
    META_KEYS.includes("journee") && META_KEYS.includes("rappelHeure") && META_KEYS.includes("profil"),
    "réglages sauvegardés et relus (dont horaires habituels)",
  );
  const app = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../js/app.js"), "utf8");
  t(/for \(const k of META_KEYS\)/.test(app), "l'appli relit tous les réglages à l'ouverture");
}

console.log("=== 26. SMIC et date de validité des taux ===");
{
  // Valeurs officielles : 12,02 € au 1er janvier 2026, 12,31 € au 1er juin 2026 (arrêté du 22 mai 2026).
  t(smicHoraire("2026-01-01") === 12.02 && smicHoraire("2026-05-31") === 12.02, "SMIC janvier-mai 2026 : 12,02 €");
  t(
    smicHoraire("2026-06-01") === 12.31 && smicHoraire("2026-11-11") === 12.31,
    "SMIC depuis le 1er juin 2026 : 12,31 €",
  );
  t(smicHoraire("2025-12-31") === null, "SMIC avant 2026 : inconnu, pas d'alerte");
  t(smicHoraire("2027-01-01") === null, "SMIC après la date de vérification : inconnu, pas d'alerte inventée");
  const a = controleSmic(normContrat({ type: "interim", taux: 12 }), "2026-06-15");
  t(a.sous && a.ecart === 0.31, "intérim à 12,00 € en juin : sous le SMIC de 0,31 €/h");
  t(
    !controleSmic(normContrat({ type: "interim", taux: 12.31 }), "2026-06-15").sous,
    "12,31 € en juin : au SMIC, pas d'alerte",
  );
  t(
    !controleSmic(normContrat({ type: "cdi", taux: 12.1 }), "2026-05-15").sous,
    "12,10 € en mai : au-dessus du SMIC de mai",
  );
  t(
    controleSmic(normContrat({ type: "cdi", taux: 12.1 }), "2026-06-15").ecart === 0.21,
    "12,10 € en juin : 0,21 €/h de moins",
  );
  // Mensuel 35 h : 1 867,02 € / 151,67 h = 12,31 €/h ; 1 823,03 € / 151,67 h = 12,02 €/h.
  t(
    !controleSmic(normContrat({ type: "cdi", mode: "mensuel", mensuel: 1867.02, hebdo: 35 }), "2026-06-15").sous,
    "SMIC mensuel 1 867,02 € : pas d'alerte",
  );
  const m = controleSmic(normContrat({ type: "cdi", mode: "mensuel", mensuel: 1823.03, hebdo: 35 }), "2026-06-15");
  t(m.sous && m.ecart === 0.29, "mensuel resté à 1 823,03 € après juin : 0,29 €/h de moins");
  t(controleSmic(normContrat({ type: "cdi", taux: 0 }), "2026-06-15") === null, "taux vide : pas d'alerte");
  t(tauxAJour("2026-12-31") && !tauxAJour("2027-01-01"), "les taux expirent après le 31/12/2026");
  // Ce test échoue à partir du 1er janvier 2027 : vérifier SMIC et cotisations, puis avancer TAUX_VERIFIES_JUSQU_AU.
  const auj = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  t(
    tauxAJour(auj),
    `taux vérifiés jusqu'au ${TAUX_VERIFIES_JUSQU_AU} (aujourd'hui ${auj}) : sinon, mettre à jour SMIC et cotisations`,
  );
}

console.log("=== 27. Vérifier un bulletin à lui seul (sans saisie) ===");
{
  // Salaires soumis = 1 823,07 + 332,50 + 50,00 = 2 205,57 €.
  // IFM = 10 % = 220,557 → 220,56 €. ICCP = 10 % de (2 205,57 + 220,56) = 242,613 → 242,61 €.
  const b = { heures: 151.67, base: 1823.07, hs: 332.5, primes: 50, fin: 220.56, iccp: 242.61, brut: 2668.74 };
  const v = verifierBulletinSeul(b, { type: "interim", periode: "2026-10" });
  const L = Object.fromEntries(v.lignes.map((l) => [l.key, l]));
  t(L.fin.attendu === 220.56 && L.fin.ok, "IFM 10 % : 220,56 € attendus, conforme");
  t(L.iccp.attendu === 242.61 && L.iccp.ok, "ICCP 10 % IFM comprise : 242,61 € attendus, conforme");
  t(v.fiable && v.manque === 0, "brut = somme des lignes : lecture fiable, rien ne manque");
  // Taux = 1 823,07 / 151,67 = 12,02 €/h, SMIC d'octobre 12,31 € : (12,31 − 12,02) × 151,67 = 43,98 €.
  t(
    v.smic.sous && v.smic.taux === 12.02 && v.smic.manque === 43.98,
    "taux de 12,02 € en octobre : sous le SMIC, 43,98 € sur le mois",
  );
  const bas = verifierBulletinSeul({ ...b, fin: 150, brut: 2598.18 }, { type: "interim", periode: "2026-10" });
  t(bas.fiable && bas.manque === 70.56, "IFM versée 150 € au lieu de 220,56 € : il manque 70,56 €");
  const douteux = verifierBulletinSeul({ ...b, fin: 150, brut: 3000 }, { type: "interim", periode: "2026-10" });
  t(!douteux.fiable && douteux.manque === 0, "brut lu incohérent : lecture incomplète, aucun montant annoncé");
  const sansIfm = verifierBulletinSeul({ heures: 151.67, base: 1867.02 }, { type: "interim", periode: "2026-10" });
  t(
    sansIfm.lignes.every((l) => l.ok === null && l.note) && sansIfm.manque === 0,
    "pas d'IFM ni d'ICCP sur le bulletin : rien réclamé, explication",
  );
  t(!sansIfm.smic.sous, "1 867,02 € pour 151,67 h : au SMIC");
  // CDD : congés payés hors précarité par défaut → 10 % de 2 205,57 = 220,56 €.
  const cdd = verifierBulletinSeul({ ...b, iccp: 220.56, brut: 2646.69 }, { type: "cdd", periode: "2026-10" });
  t(Object.fromEntries(cdd.lignes.map((l) => [l.key, l])).iccp.attendu === 220.56, "CDD : congés payés hors précarité");
  t(
    verifierBulletinSeul(b, { type: "cdi", periode: "2026-10" }).lignes.length === 0,
    "CDI : pas d'indemnité de fin à contrôler",
  );
  t(verifierBulletinSeul({}, { type: "interim" }).lignes.length === 0, "bulletin vide : rien à contrôler");
}

runRules(t, eq);
runSecurity(t);

console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
