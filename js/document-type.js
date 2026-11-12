// @ts-check
/**
 * Devine la nature d'un document lu sur le téléphone : fiche de paie ou contrat.
 * Règles simples et explicites (mots-clés pondérés), aucune IA. En cas de doute : null,
 * et l'appli demande à la personne au lieu de deviner.
 */

/** @param {string} s */
const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'");

/** Mots qui annoncent une fiche de paie, avec leur poids. */
const BULLETIN = /** @type {const} */ ([
  [/bulletin de (paie|paye|salaire)/, 3],
  [/net\s*a\s*payer/, 3],
  [/net (imposable|social)/, 2],
  [/(salaire|total) brut|brut total/, 2],
  [/cotisations?/, 1],
  [/\bcsg\b/, 1],
  [/cumuls?\b/, 1],
  [/periode de pa(ie|ye)/, 2],
]);

/** Mots qui annoncent un contrat de travail ou de mission. */
const CONTRAT = /** @type {const} */ ([
  [/contrat de (mission|travail|mise a disposition)/, 3],
  [/contrat a duree (in)?determinee/, 3],
  [/entre les soussigne/, 3],
  [/periode d'essai/, 2],
  [/duree (hebdomadaire|du contrat|de la mission)/, 2],
  [/motif (de recours|du recours)/, 2],
  [/entreprise utilisatrice/, 1],
  [/lu et approuve|fait en (deux|2) exemplaires/, 1],
  [/remuneration/, 1],
  [/qualification/, 1],
]);

/** @param {string} t @param {ReadonlyArray<readonly [RegExp, number]>} regles */
const score = (t, regles) => regles.reduce((s, [re, p]) => s + (re.test(t) ? p : 0), 0);

/**
 * @param {string|null|undefined} text texte lu (PDF, photo ou collé)
 * @returns {{ type: "bulletin"|"contrat"|null, bulletin: number, contrat: number }}
 */
export function devinerDocument(text) {
  const t = norm(String(text || ""));
  const bulletin = score(t, BULLETIN);
  const contrat = score(t, CONTRAT);
  /** @type {"bulletin"|"contrat"|null} */
  let type = null;
  if (bulletin >= 3 && bulletin >= contrat + 2) type = "bulletin";
  else if (contrat >= 3 && contrat >= bulletin + 2) type = "contrat";
  return { type, bulletin, contrat };
}
