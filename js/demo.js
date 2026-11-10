/** Données d'EXEMPLE (fictives). Stockées dans une base séparée : vos vraies données ne sont jamais touchées. */
import { parisLocalToIso } from "./util.js";

export const DEMO_PROFIL = { nom: "EXEMPLE — Prénom NOM", adresse: "1 rue de l'Exemple, 34000 Montpellier", ville: "Montpellier" };

/** Retourne une liste d'enregistrements partiels (sans sceau) dans l'ordre. idOf(i) donne l'id du n-ième. */
export function demoPartials(now = new Date()) {
  const out = [];
  const mission = { type: "contrat", data: { exemple: true, type: "interim", mode: "horaire", hebdo: 35, employeur: "EXEMPLE Intérim Sud (fictive)", employeurAdresse: "10 avenue de l'Exemple, 34000 Montpellier", eu: "EXEMPLE Bâtiment SARL", lieu: "Résidence Exemple, Port Marianne", poste: "Coffreur bancheur (exemple)", convention: "Ouvriers du bâtiment (exemple, à vérifier)", taux: 13.5, tauxRef: 13.9, dateDebut: "2026-10-05", dateFin: "2026-11-27" } };
  out.push(mission);
  const days = [];
  for (const start of ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]) {
    const [y, m, d] = start.split("-").map(Number);
    for (let k = 0; k < 5; k++) days.push(new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10));
  }
  for (const day of days) {
    const friday = new Date(day + "T12:00:00Z").getUTCDay() === 5;
    const isBug = day === "2026-10-15";
    const seq = [["debut", "07:30"], ["pause", "12:00"], ["reprise", "12:45"], ["fin", friday ? "15:45" : isBug ? "16:15" : "17:15"]];
    for (const [action, hm] of seq) out.push({ type: "punch", ref: isBug && action === "fin" ? "bug" : undefined, data: { exemple: true, action, at: parisLocalToIso(`${day}T${hm}`), gps: action === "debut" ? { lat: 43.6034, lon: 3.8977, precision: 25, exemple: true } : null } });
  }
  out.push({ type: "correction", targetRef: "bug", data: { exemple: true, changes: { at: parisLocalToIso("2026-10-15T17:15") }, motif: "EXEMPLE : oubli de pointage, sortie réelle à 17 h 15 (témoin : chef d'équipe)" } });
  out.push({ type: "prime", data: { exemple: true, libelle: "Panier (montant fictif d'exemple)", montant: 11, jours: 20, base: false, date: "2026-10-30" } });
  // Mois en cours : jours ouvrés passés (au plus 7) + aujourd'hui en cours, pour montrer le pointage en direct.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [ty, tm, td] = today.split("-").map(Number);
  for (let k = Math.max(1, td - 7); k < td; k++) {
    const day = new Date(Date.UTC(ty, tm - 1, k)).toISOString().slice(0, 10);
    const wd = new Date(day + "T12:00:00Z").getUTCDay();
    if (wd === 0 || wd === 6 || day <= "2026-10-31") continue;
    for (const [action, hm] of [["debut", "07:30"], ["pause", "12:00"], ["reprise", "12:45"], ["fin", wd === 5 ? "15:45" : "17:15"]]) out.push({ type: "punch", data: { exemple: true, action, at: parisLocalToIso(`${day}T${hm}`) } });
  }
  const seqToday = [["debut", "07:30"], ["pause", "12:00"], ["reprise", "12:45"]].filter(([, hm]) => parisLocalToIso(`${today}T${hm}`) < now.toISOString());
  if (today > "2026-10-31") for (const [action, hm] of seqToday) out.push({ type: "punch", data: { exemple: true, action, at: parisLocalToIso(`${today}T${hm}`), gps: action === "debut" ? { refus: true } : null } });
  out.push({ type: "bulletin", data: { exemple: true, periode: "2026-10", heures: 160, base: 1890, hs: 337.5, primes: 0, fin: 222.75, iccp: 245.03, frais: 220 } });
  return out;
}

/** Écrit l'exemple dans un Store (vide sauf genèse). */
export async function seedDemo(store) {
  const parts = demoPartials();
  let missionId = null; const refs = {};
  for (const p of parts) {
    const data = { ...p.data };
    if (p.type !== "contrat" && missionId) data.contratId = missionId;
    if (p.type === "correction") data.targetId = refs[p.targetRef];
    const rec = await store.append({ type: p.type, data });
    if (p.type === "contrat") missionId = rec.id;
    if (p.ref) refs[p.ref] = rec.id;
  }
  await store.setMeta("profil", DEMO_PROFIL);
  await store.setMeta("currentContrat", missionId);
  await store.setMeta("periodeDefaut", "2026-10");
  await store.setMeta("netOpts", { tauxPAS: 0, mutuelle: 0, cadre: false, alsaceMoselle: false, hsExoImpot: false });
  return missionId;
}
