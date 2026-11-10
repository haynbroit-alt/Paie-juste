/**
 * Extraction LOCALE de champs depuis le texte d'un contrat (PDF texte, OCR ou collage).
 * Heuristiques simples : chaque champ trouvé est PROPOSÉ avec l'extrait d'origine, jamais appliqué sans validation.
 */
const num = (s) => Number(String(s).replace(/\s/g, "").replace(/\u00a0/g, "").replace(",", "."));
const MOIS = { janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, "août": 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12, decembre: 12 };

function toIsoDate(s) {
  let m = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) { let y = Number(m[3]); if (y < 100) y += 2000; return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`; }
  m = s.match(/(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/i);
  if (m && MOIS[m[2].toLowerCase()]) return `${m[3]}-${String(MOIS[m[2].toLowerCase()]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return null;
}
const DATE = String.raw`(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}(?:er)?\s+[a-zéû]+\s+\d{4})`;

export function parseContrat(text) {
  const t = String(text || "").replace(/\r/g, "").replace(/[ \t\u00a0]+/g, " ");
  const low = t.toLowerCase();
  const out = {};
  const put = (k, value, match) => { if (value != null && value !== "" && !(k in out)) out[k] = { value, extrait: match.trim().slice(0, 140) }; };

  // Type
  let m;
  if ((m = t.match(/contrat de (?:travail temporaire|mission)[^\n]*/i)) || /entreprise de travail temporaire|entreprise utilisatrice|int[ée]rim/i.test(t)) put("type", "interim", m ? m[0] : "mention de l'intérim");
  else if ((m = t.match(/contrat (?:de travail )?[àa] dur[ée]e d[ée]termin[ée]e[^\n]*|\bC\.?D\.?D\b[^\n]*/i))) put("type", "cdd", m[0]);
  else if ((m = t.match(/contrat (?:de travail )?[àa] dur[ée]e ind[ée]termin[ée]e[^\n]*|\bC\.?D\.?I\b[^\n]*/i))) put("type", "cdi", m[0]);

  // Rémunération
  if ((m = t.match(/(\d{1,3}(?:[.,]\d{1,4})?)\s*(?:€|euros?)\s*(?:brut[s]?\s*)?(?:de l'|par |\/\s*|de )?(?:heure|h\b)/i)) || (m = t.match(/taux horaire[^\d\n]{0,40}(\d{1,3}(?:[.,]\d{1,4})?)/i))) put("taux", num(m[1]), m[0]);
  if ((m = t.match(/(\d{1,2}[ .\u00a0]?\d{3}(?:[.,]\d{1,2})?)\s*(?:€|euros?)\s*(?:bruts?\s*)?(?:par mois|mensuel|\/\s*mois)/i)) || (m = t.match(/(?:salaire|r[ée]mun[ée]ration) (?:mensuel(?:le)?|de base)[^\d\n]{0,40}(\d{1,2}[ .\u00a0]?\d{3}(?:[.,]\d{1,2})?)/i))) put("mensuel", num(m[1]), m[0]);
  if (out.mensuel && !out.taux) put("mode", "mensuel", out.mensuel.extrait);
  else if (out.taux) put("mode", "horaire", out.taux.extrait);

  // Durée
  if ((m = t.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:heures|h)\s*(?:de travail\s*)?(?:par semaine|hebdomadaires?|\/\s*semaine)/i))) put("hebdo", num(m[1]), m[0]);
  if (!out.hebdo && (m = t.match(/(\d{3}(?:[.,]\d{1,2})?)\s*(?:heures|h)\s*(?:par mois|mensuelles?)/i))) put("hebdo", Math.round((num(m[1]) * 12 / 52) * 100) / 100, m[0]);

  // Dates
  if ((m = t.match(new RegExp(String.raw`(?:à compter du|a compter du|date de d[ée]but[^\d\n]{0,20}|d[ée]but(?:e)? (?:le|de la mission)[^\d\n]{0,10}|du)\s*` + DATE, "i")))) put("dateDebut", toIsoDate(m[1]), m[0]);
  if ((m = t.match(new RegExp(String.raw`(?:jusqu'au|date de fin[^\d\n]{0,20}|terme (?:pr[ée]vu )?(?:le|au)?[^\d\n]{0,10}|fin (?:de mission )?(?:le|au)|au)\s*` + DATE, "i")))) put("dateFin", toIsoDate(m[1]), m[0]);

  // Parties
  if ((m = t.match(/(?:entreprise de travail temporaire|agence)\s*[:\-]\s*([^\n,]{3,80})/i))) put("employeur", m[1].trim(), m[0]);
  if ((m = t.match(/(?:[Ee]mployeur|EMPLOYEUR|[Ss]oci[ée]t[ée]|[Ee]ntre(?: les soussign[ée]s)?)\s*[:\-]?\s*(?:la soci[ée]t[ée]\s*)?([A-Z][^\n,]{2,80})/))) put("employeur", m[1].trim(), m[0]);
  if ((m = t.match(/entreprise utilisatrice\s*[:\-]\s*([^\n,]{3,80})/i))) put("eu", m[1].trim(), m[0]);
  if ((m = t.match(/(?:lieu de (?:travail|mission)|chantier)\s*[:\-]\s*([^\n]{3,100})/i))) put("lieu", m[1].trim(), m[0]);
  if ((m = t.match(/(?:poste|emploi|qualification)\s*(?:occup[ée])?\s*[:\-]\s*([^\n]{3,80})/i))) put("poste", m[1].trim(), m[0]);
  if ((m = t.match(/convention collective(?: nationale)?\s*(?:applicable)?\s*[:\-]?\s*([^\n]{5,140})/i))) put("convention", m[1].trim(), m[0]);
  if ((m = t.match(/IDCC\s*[:n°\s]*\s*(\d{3,4})/i)) && !out.convention) put("convention", "IDCC " + m[1], m[0]);
  return out;
}
