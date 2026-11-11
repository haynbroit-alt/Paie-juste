// @ts-check
/**
 * Lecture LOCALE d'un bulletin de paie (texte d'un PDF, d'une photo lue par OCR, ou collé).
 * Heuristiques simples, ligne par ligne : chaque montant trouvé est PROPOSÉ avec la ligne d'origine,
 * jamais enregistré sans validation. Les bulletins diffèrent d'un logiciel de paie à l'autre.
 */

/** Montants au format français : 1 823,07 · 1.823,07 · 1823,07 · 12,0200 (taux). */
const NOMBRE = /-?\d{1,3}(?:[ \u00a0.]\d{3})+,\d{2,4}|-?\d+,\d{2,4}|-?\d+\.\d{2}(?!\d)/g;
/** Premier montant d'une ligne (sans le drapeau global de NOMBRE). */
const NOMBRE_SEUL = new RegExp(NOMBRE.source);
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
  // Congés pris pendant la mission, payés comme du salaire (« Hrs Congés payés »).
  ["conges", /(hrs?|heures?)\.? conges|conges payes pris/],
  ["hc", /(heures?|hrs?)\.? compl/],
  ["hs", /(heures?|hrs?)\.? sup|\bh\.?\s?sup|\bhs\s?\d|majoration.*(25|50)\s?%/],
  ["intemperies", /intemperie/],
  ["frais", /panier|trajet|transport|repas|grand deplacement|indemnite.*(kilomet|deplacement)|frais/],
  ["base", /salaire de base|taux horaire|salaire mensuel|(heures?|hrs?)\.? normales|\bbase\b.*\d/],
  ["primes", /prime|gratification|bonus/],
]);
/** Lignes de total (informatives, pas dans le formulaire). Le montant est le premier nombre APRÈS le mot-clé. */
const TOTAUX = /** @type {const} */ ([
  ["brut", /(salaire|total) brut|brut (total|soumis)|\bbrut\b\s*:/],
  ["netAvantImpot", /net\s*a\s*payer avant impots?/],
  ["net", /net\s*a\s*payer|net (paye|verse)/],
]);
/** Lignes à ignorer : cotisations, cumuls, plafonds. */
const IGNORE =
  /cotisation|csg|crds|retraite|vieillesse|maladie|chomage|prevoyance|mutuelle|cumul|plafond|total des retenues|exoneration|imposable|impot sur le revenu preleve/;
/** Colonne « Calendrier » de certains bulletins d'intérim (« M 07 8,00 », « J 01 ») et renvois « Av.. » / « Ap.. ». */
const CALENDRIER = /\s+[LMJVSD]\s\d{2}\b.*$|\s+A[vp]\.\.\s*$/;

/** @param {string} s @returns {string|null} AAAA-MM-JJ */
const isoFr = (s) => {
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

/** @param {string|null|undefined} text */
export function parseBulletin(text) {
  /** @type {Record<string, {value: number, extrait: string}>} */
  const out = {};
  /** @type {Record<string, number[]>} */
  const sommes = {};
  /** @type {Record<string, string[]>} */
  const extraits = {};
  /** Détail lisible des gains, ligne par ligne, dans l'ordre du bulletin. @type {{libelle: string, champ: string, montant: number, quantite: number|null, taux: number|null}[]} */
  const detail = [];
  const vues = new Set();
  const lignes = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    // Un PDF contient parfois deux fois la même page (original et copie) : chaque ligne ne compte qu'une fois.
    .filter((l) => (vues.has(l) ? false : (vues.add(l), true)));
  // Tout ce qui est écrit avant la ligne du brut en fait partie (panier, trajet « soumis »).
  const iBrut = lignes.findIndex((l) => TOTAUX[0][1].test(sansAccents(l)) && !/cumul/i.test(l));
  lignes.forEach((brute, i) => {
    const ligne = brute.replace(CALENDRIER, "");
    const l = sansAccents(ligne);
    if (!nombres(ligne).length) return;
    if (/cumul/.test(l)) return;
    const total = TOTAUX.find(([, re]) => re.test(l));
    if (total) {
      const [k, re] = total;
      const m = /** @type {RegExpExecArray} */ (re.exec(l));
      const apres = nombres(l.slice(m.index + m[0].length));
      if (!(k in out) && apres.length) out[k] = { value: apres[0], extrait: ligne.slice(0, 140) };
      return;
    }
    if (IGNORE.test(l)) return;
    const regle = REGLES.find(([, re]) => re.test(l));
    if (!regle) return;
    let k = /** @type {string} */ (regle[0]);
    if (k === "frais" && (/soumis/.test(l) || (iBrut >= 0 && i < iBrut))) k = "primes";
    const ns = nombres(ligne);
    (sommes[k] ||= []).push(ns[ns.length - 1]);
    (extraits[k] ||= []).push(ligne.slice(0, 140));
    const debut = ligne.search(NOMBRE_SEUL);
    // Libellé lisible : sans le code de rubrique (« 1110 »), ni les points et signes en trop.
    const libelle = (debut > 0 ? ligne.slice(0, debut) : ligne)
      .replace(/^\d{3,5}\s+/, "")
      .replace(/^[\s.°*]+|[\s:.°*-]+$/g, "")
      .slice(0, 48);
    detail.push({
      libelle: libelle.charAt(0).toUpperCase() + libelle.slice(1),
      champ: k,
      montant: ns[ns.length - 1],
      quantite: ns.length >= 3 ? ns[0] : null,
      taux: ns.length >= 3 ? ns[ns.length - 2] : null,
    });
    // Heures payées : sur la ligne du salaire de base, le premier nombre est en général le nombre d'heures.
    if (k === "base" && !("heures" in out) && ns.length >= 2 && ns[0] > 0 && ns[0] <= 260) {
      out.heures = { value: ns[0], extrait: ligne.slice(0, 140) };
    }
  });
  for (const [k, vals] of Object.entries(sommes)) {
    const v = Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100;
    out[k] = { value: v, extrait: extraits[k].join(" | ").slice(0, 200) };
  }
  const t = String(text || "");
  // Période : « du 05/10/2026 au 30/10/2026 », même si « Période de paye » est sur la ligne au-dessus. Mois de fin.
  const per = /\bdu\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s+au\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(t);
  const finPeriode = per ? isoFr(per[2]) : null;
  const ancien = finPeriode ? null : /p[ée]riode\s+du\s+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i.exec(t);
  const periode = finPeriode ? finPeriode.slice(0, 7) : ancien ? (isoFr(ancien[1]) || "").slice(0, 7) || null : null;
  // Fin de mission ou de contrat : « Contrat 21620 … 05/10/2026 30/10/2026 ».
  const ct = /contrat[^\n]*?(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(t);
  const finContrat = ct ? isoFr(ct[2]) : null;
  // Intérim : convention « Travail temporaire », mot « intérim » ou « mission », code NAF 7820Z.
  const interim = /travail temporaire|int[ée]rim|fin de mission|\b78\.?20\s?z\b/i.test(t);
  return { champs: out, detail, periode, finContrat, interim };
}
