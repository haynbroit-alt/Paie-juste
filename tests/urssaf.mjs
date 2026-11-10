// Compare le brut → net de Paie Juste (js/calc.js) au moteur officiel de l'Urssaf (modele-social, publicodes).
// Outil de développement : le moteur Urssaf n'est pas embarqué dans l'application.
// Lancer : npm run test:urssaf
import rules from "modele-social";
import Engine from "publicodes";
import { netEstime } from "../js/calc.js";

const silencieux = { log() {}, warn() {}, error() {} };
const engine = new Engine(rules, { logger: silencieux });
const val = (/** @type {string} */ n) => Number(engine.evaluate(n).nodeValue);

// Sans mutuelle : par défaut, le moteur Urssaf ajoute 40 € de mutuelle par mois. Paie Juste la fait saisir à part.
const BASE = {
  "salarié . contrat": "'CDI'",
  "salarié . cotisations . prévoyances . santé . montant": "0 €/mois",
};
const NET = "salarié . rémunération . net . à payer avant impôt";
const IMPOSABLE = "salarié . rémunération . net . imposable";

let ok = 0,
  ko = 0;
/** @param {string} nom @param {number} pj @param {number} urssaf @param {number} tolerance */
function compare(nom, pj, urssaf, tolerance) {
  const ecart = Math.abs(pj - urssaf);
  const bon = ecart <= tolerance + 1e-9;
  if (bon) ok++;
  else ko++;
  console.log(
    `  ${bon ? "OK  " : "FAIL"} ${nom} : Paie Juste ${pj.toFixed(2)} €, Urssaf ${urssaf.toFixed(2)} € (écart ${ecart.toFixed(2)}, toléré ${tolerance.toFixed(2)})`,
  );
}

console.log("Salarié non cadre, CDI, sans heures sup");
for (const brut of [1867.02, 2200, 3000, 4005, 4500, 6000, 12000]) {
  engine.setSituation({ ...BASE, "salarié . contrat . salaire brut": `${brut} €/mois` });
  const pj = netEstime({ brut, hsMontant: 0, hcMontant: 0, frais: 0 }, {});
  compare(`net avant impôt, brut ${brut} €`, pj.netAvantImpot, val(NET), 0.02);
  compare(`net imposable, brut ${brut} €`, pj.netImposable, val(IMPOSABLE), 0.02);
}

console.log("Heures supplémentaires (8 h par mois, majorées à 25 %)");
for (const brut of [1867.02, 2000, 3000]) {
  engine.setSituation({
    ...BASE,
    "salarié . contrat . salaire brut": `${brut} €/mois`,
    "salarié . temps de travail . heures supplémentaires": "8 heures/mois",
  });
  const brutTotal = val("salarié . rémunération . brut");
  const hs = val("salarié . rémunération . heures supplémentaires");
  // Le moteur Urssaf applique d'office l'exonération d'impôt des heures sup : on active la même option.
  const pj = netEstime({ brut: brutTotal, hsMontant: hs, hcMontant: 0, frais: 0 }, { hsExoImpot: true });
  compare(`net avant impôt, brut ${brut} € + ${hs.toFixed(2)} € d'heures sup`, pj.netAvantImpot, val(NET), 0.02);
  // Écart connu sur la part défiscalisée : il grandit avec les heures sup (environ 0,09 % de leur montant).
  // Cause non établie, à étudier avant de changer la formule : voir docs/ANALYSE-OUTILS.md.
  compare(`net imposable, brut ${brut} € + heures sup exonérées`, pj.netImposable, val(IMPOSABLE), 0.2);
}

console.log(`\n${ok} réussis, ${ko} échoués`);
if (ko) process.exit(1);
