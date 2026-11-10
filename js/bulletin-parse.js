// @ts-check
/**
 * Lecture LOCALE d'un bulletin de paie (texte d'un PDF, d'une photo lue par OCR, ou collé).
 * Heuristiques simples, ligne par ligne : chaque montant trouvé est PROPOSÉ avec la ligne d'origine,
 * jamais enregistré sans validation. Les bulletins diffèrent d'un logiciel de paie à l'autre.
 */

/** Montants au format français : 1 823,07 · 1.823,07 · 1823,07 · 12,0200 (taux). */
const NOMBRE = /-?\d{1,3}(?:[ \u00a0.]\d{3})+,\d{2,4}|-?\d+,\d{2,4}|-?\d+\.\d{2}(?!\d)/g;
/** @param {string} s */
const num = (s) => {
  const t = s.replace(/[ \u00a0]/g, "");
  return t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
};
/** @param {string} line */
const nombres = (line) => (line.match(NOMBRE) || []).map(num).filter((n) => Number.isFinite(n));
/** @param {string} s */
const sansAccents = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Champ du formulaire « Mon bulletin » → mots qui l'annoncent sur une ligne. L'ordre compte : le premier qui correspond gagne. */
const REGLES = /** @type {const} */ ([
  ["iccp", /indemnite compensatrice de conges|\bi\.?c\.?c\.?p\b|\bicp\b|conges payes (verses|fin)/],
  ["fin", /fin de mission|\bi\.?f\.?m\b|precarite|fin de contrat/],
  ["hc", /heures? compl/],
  ["hs", /heures? sup|\bh\.?\s?sup|\bhs\s?\d|majoration.*(25|50)\s?%/],
  ["frais", /panier|trajet|transport|repas|grand deplacement|indemnite.*(kilomet|deplacement)|frais/],
  ["base", /salaire de base|taux horaire|salaire mensuel|heures normales|\bbase\b.*\d/],
  ["primes", /prime|gratification|bonus/],
]);
/** Lignes de total (informatives, pas dans le formulaire). */
const TOTAUX = /** @type {const} */ ([
  ["brut", /(salaire|total) brut|brut (total|soumis)|\bbrut\b\s*:/],
  ["net", /net (a payer|paye|verse)|net a payer avant impot/],
]);
/** Lignes à ignorer : cotisations, cumuls, plafonds. */
const IGNORE =
  /cotisation|csg|crds|retraite|vieillesse|maladie|chomage|prevoyance|mutuelle|cumul|plafond|total des retenues|exoneration|imposable/;

/** @param {string|null|undefined} text */
export function parseBulletin(text) {
  /** @type {Record<string, {value: number, extrait: string}>} */
  const out = {};
  /** @type {Record<string, number[]>} */
  const sommes = {};
  /** @type {Record<string, string[]>} */
  const extraits = {};
  const lignes = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  for (const ligne of lignes) {
    const l = sansAccents(ligne);
    const ns = nombres(ligne);
    if (!ns.length) continue;
    const total = TOTAUX.find(([, re]) => re.test(l));
    if (total) {
      const [k] = total;
      if (!(k in out)) out[k] = { value: ns[ns.length - 1], extrait: ligne.slice(0, 140) };
      continue;
    }
    if (IGNORE.test(l)) continue;
    const regle = REGLES.find(([, re]) => re.test(l));
    if (!regle) continue;
    const [k] = regle;
    const montant = ns[ns.length - 1];
    (sommes[k] ||= []).push(montant);
    (extraits[k] ||= []).push(ligne.slice(0, 140));
    // Heures payées : sur la ligne du salaire de base, le premier nombre est en général le nombre d'heures.
    if (k === "base" && !("heures" in out) && ns.length >= 2 && ns[0] > 0 && ns[0] <= 260) {
      out.heures = { value: ns[0], extrait: ligne.slice(0, 140) };
    }
  }
  for (const [k, vals] of Object.entries(sommes)) {
    const v = Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100;
    out[k] = { value: v, extrait: extraits[k].join(" | ").slice(0, 200) };
  }
  const per = String(text || "").match(/p[ée]riode\s+du\s+\d{1,2}[/.-](\d{1,2})[/.-](\d{4})/i);
  const periode = per ? `${per[2]}-${per[1].padStart(2, "0")}` : null;
  return { champs: out, periode };
}
