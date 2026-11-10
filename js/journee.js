// @ts-check
/** Saisie simple d'une journée et rappels d'agenda. Pur : pas de DOM, testable dans Node. */
import { parisLocalToIso, isoToParisLocal } from "./util.js";
import { parisDate, workIntervals, intervalMinutes } from "./calc.js";

/** @param {string} hhmm */
const toMin = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return NaN;
  const h = Number(m[1]),
    mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : NaN;
};
/** @param {number} min */
const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Transforme « début, fin, pause » en pointages : début, pause, reprise, fin.
 * L'heure exacte de la pause n'est pas connue : elle est placée au milieu du temps de travail,
 * et chaque pointage le dit dans son motif. Seules les durées comptent pour la paie.
 * @param {{ date: string, debut: string, fin: string, pauseMin?: number }} j
 * @returns {{ ok: true, minutes: number, punches: Array<{ action: string, at: string }> } | { ok: false, erreur: string }}
 */
export function journeePunches(j) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(j.date || "")) return { ok: false, erreur: "Date invalide." };
  const d = toMin(j.debut),
    f = toMin(j.fin);
  const p = Math.round(Number(j.pauseMin) || 0);
  if (Number.isNaN(d) || Number.isNaN(f)) return { ok: false, erreur: "Heure invalide (format HH:MM)." };
  if (p < 0) return { ok: false, erreur: "La pause ne peut pas être négative." };
  if (f <= d) {
    return {
      ok: false,
      erreur:
        "L'heure de fin doit être après l'heure de début (une nuit qui passe minuit se note en deux jours : avant et après minuit).",
    };
  }
  const travail = f - d - p;
  if (travail <= 0) return { ok: false, erreur: "La pause est plus longue que la journée." };
  const at = (/** @type {number} */ min) => parisLocalToIso(`${j.date}T${toHHMM(min)}`);
  if (!p) {
    return {
      ok: true,
      minutes: travail,
      punches: [
        { action: "debut", at: at(d) },
        { action: "fin", at: at(f) },
      ],
    };
  }
  const debutPause = d + Math.floor(travail / 2);
  return {
    ok: true,
    minutes: travail,
    punches: [
      { action: "debut", at: at(d) },
      { action: "pause", at: at(debutPause) },
      { action: "reprise", at: at(debutPause + p) },
      { action: "fin", at: at(f) },
    ],
  };
}

/** Motif scellé avec chaque pointage d'une journée saisie. @param {number} pauseMin */
export const motifJournee = (pauseMin) =>
  pauseMin > 0
    ? `Journée saisie en une fois (pause de ${pauseMin} min, heure de la pause non précisée)`
    : "Journée saisie en une fois";

/** @param {string} dateStr AAAA-MM-JJ @param {string} hhmm */
const gcalStamp = (dateStr, hhmm) => dateStr.replace(/-/g, "") + "T" + hhmm.replace(":", "") + "00";

/**
 * Lien Google Agenda qui crée un événement récurrent (l'agenda envoie la notification).
 * Aucune donnée personnelle : seulement le titre, l'heure et l'adresse de l'appli.
 * @param {{ titre: string, details: string, date: string, heure: string, dureeMin?: number, rrule: string }} e
 */
export function googleAgendaUrl(e) {
  const fin = toMin(e.heure) + (e.dureeMin || 10);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.titre,
    details: e.details,
    dates: `${gcalStamp(e.date, e.heure)}/${gcalStamp(e.date, toHHMM(Math.min(fin, 23 * 60 + 59)))}`,
    ctz: "Europe/Paris",
    recur: "RRULE:" + e.rrule,
  });
  return "https://calendar.google.com/calendar/render?" + q.toString();
}

/** @param {string} s */
const icsText = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/**
 * Fichier .ics avec rappels (alarme à l'heure de l'événement), pour les agendas autres que Google.
 * @param {Array<{ uid: string, titre: string, details: string, date: string, heure: string, rrule: string }>} events
 * @param {string} [stamp] horodatage UTC AAAAMMJJTHHMMSSZ (fixé dans les tests)
 */
export function rappelsIcs(events, stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z") {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Paie Juste//Rappels//FR", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@paie-juste`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Paris:${gcalStamp(e.date, e.heure)}`,
      "DURATION:PT10M",
      `RRULE:${e.rrule}`,
      `SUMMARY:${icsText(e.titre)}`,
      `DESCRIPTION:${icsText(e.details)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(e.titre)}`,
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** Rappels proposés : chaque soir de semaine, et le dernier jour du mois pour vérifier la paie.
 * @param {{ date: string, heure: string, appUrl: string, jours?: string }} o
 */
export function rappelsParDefaut(o) {
  return [
    {
      uid: "rappel-soir",
      titre: "Paie Juste : noter mes heures",
      details: `Notez vos heures du jour (début, fin, pause) dans Paie Juste : ${o.appUrl}`,
      date: o.date,
      heure: o.heure,
      rrule: `FREQ=WEEKLY;BYDAY=${o.jours || "MO,TU,WE,TH,FR"}`,
    },
    {
      uid: "rappel-fin-de-mois",
      titre: "Paie Juste : vérifier ma paie du mois",
      details: `Ouvrez « Ma paie » pour voir le détail de votre salaire, puis comparez-le à votre bulletin : ${o.appUrl}`,
      date: o.date,
      heure: o.heure,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=-1",
    },
  ];
}

/** @param {string} iso */
const heureParis = (iso) => isoToParisLocal(iso).slice(11, 16);

/**
 * Résume les pointages d'un contrat, jour par jour : arrivée, départ, pause, total.
 * Fonctionne aussi pour les anciens pointages faits en direct.
 * @param {Array<Record<string, any>>} punches pointages non annulés, triés par heure
 * @param {Array<Record<string, any>>} [tous] tous les pointages, annulés compris (pour la trace des modifications)
 */
export function resumeJournees(punches, tous = punches) {
  /** @type {Map<string, Array<Record<string, any>>>} */
  const parJour = new Map();
  for (const p of punches) {
    const d = parisDate(p.at);
    parJour.set(d, [...(parJour.get(d) || []), p]);
  }
  /** @type {Map<string, Array<Record<string, any>>>} */
  const traces = new Map();
  for (const p of tous) {
    if (!p.annule && !(p.corrections && p.corrections.length)) continue;
    const d = parisDate(p.original ? p.original.at : p.at);
    traces.set(d, [...(traces.get(d) || []), p]);
  }
  const jours = new Set([...parJour.keys(), ...traces.keys()]);
  return [...jours]
    .sort()
    .reverse()
    .map((date) => {
      const ps = parJour.get(date) || [];
      const w = workIntervals(ps);
      const minutes = w.intervals.reduce((a, i) => a + intervalMinutes(i), 0);
      const debut = ps.find((p) => p.action === "debut");
      const fin = [...ps].reverse().find((p) => p.action === "fin");
      const amplitude = debut && fin ? intervalMinutes({ start: debut.at, end: fin.at }) : 0;
      const modifs = (traces.get(date) || []).flatMap((p) =>
        (p.corrections || []).map((/** @type {any} */ c) => c.motif),
      );
      return {
        date,
        arrivee: debut ? heureParis(debut.at) : "",
        depart: fin ? heureParis(fin.at) : "",
        pauseMin: debut && fin ? Math.max(0, amplitude - minutes) : 0,
        minutes,
        aVerifier: w.anomalies.length > 0 || !debut || !fin,
        supprimee: ps.length === 0,
        modifiee: modifs.length > 0,
        motifs: [...new Set(modifs.filter(Boolean))],
        ids: ps.map((p) => p.id),
      };
    });
}

/** Lundi → dimanche de la semaine qui contient `date`. @param {string} lundi AAAA-MM-JJ (un lundi) */
export function joursDeSemaine(lundi) {
  const [y, m, d] = lundi.split("-").map(Number);
  return Array.from({ length: 7 }, (_, k) => new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10));
}

/** Les `n` derniers jours, du plus récent au plus ancien. @param {string} today @param {number} n */
export function joursRecents(today, n) {
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, k) => new Date(Date.UTC(y, m - 1, d - k)).toISOString().slice(0, 10));
}
