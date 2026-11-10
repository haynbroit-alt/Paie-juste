// @ts-check
/** Saisie simple d'une journée et rappels d'agenda. Pur : pas de DOM, testable dans Node. */
import { parisLocalToIso } from "./util.js";

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
        "L'heure de fin doit être après l'heure de début (le travail de nuit sur deux jours se pointe en direct).",
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
