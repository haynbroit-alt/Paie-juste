import { parisDate, weekKey, fmtH, splitWeekly, sumRows, minutesByDay, workIntervals, TYPES } from "../calc.js";
import { esc, fmtJour, nowIso, isoToParisLocal, downloadBlob } from "../util.js";
import { boutonDocument, brancherDocument } from "./document.js";
import { contratALaMain } from "./contrat.js";
import {
  journeePunches,
  motifJournee,
  googleAgendaUrl,
  rappelsIcs,
  rappelsParDefaut,
  resumeJournees,
  joursDeSemaine,
  joursRecents,
} from "../journee.js";

/** Choix faits à l'écran, gardés le temps de la visite (rien n'est enregistré). */
const ui = { jour: null, semaine: null, edit: false };
const PAUSES = [0, 15, 30, 45, 60, 75, 90, 120];
const JOURS_NOMS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function contratLabel(c) {
  if (!c) return "";
  return `${TYPES[c.type].label} · ${c.employeur || "employeur ?"}${c.lieu ? " · " + c.lieu : ""}`;
}
export function contratSelect(ctx, id = "sel-contrat") {
  const list = [...ctx.state.contrats.values()];
  if (list.length < 2) return "";
  return `<label for="${id}">Contrat</label><select id="${id}">${list.map((c) => `<option value="${c.id}" ${c.id === ctx.meta.currentContrat ? "selected" : ""}>${esc(contratLabel(c))}${c.fin ? " (terminé)" : ""}</option>`).join("")}</select>`;
}
export function bindContratSelect(ctx, el, id = "sel-contrat") {
  const s = el.querySelector("#" + id);
  if (s) {
    s.onchange = async () => {
      await ctx.setMeta("currentContrat", s.value);
      ctx.refresh();
    };
  }
}

const pad = (n) => String(n).padStart(2, "0");
const pauseLabel = (m) => (m ? (m >= 60 ? fmtH(m) : m + " min") : "Pas de pause");
function nomJour(d, today) {
  if (d === today) return "Aujourd'hui";
  if (d === joursRecents(today, 2)[1]) return "Hier";
  return fmtJour(d);
}

/** Deux listes (heures 0-23, minutes de 5 en 5) : toujours en 24 h, quel que soit le téléphone. */
function heureChamp(id, label, hhmm) {
  const [h, m] = (hhmm || "08:00").split(":").map(Number);
  const mins = [...new Set([...Array.from({ length: 12 }, (_, k) => k * 5), m])].sort((a, b) => a - b);
  return `<div><span class="lbl">${label}</span><div class="hm">
      <select id="${id}-h" aria-label="${label} : heure">${Array.from({ length: 24 }, (_, k) => `<option value="${pad(k)}" ${k === h ? "selected" : ""}>${pad(k)} h</option>`).join("")}</select>
      <select id="${id}-m" aria-label="${label} : minutes">${mins.map((k) => `<option value="${pad(k)}" ${k === m ? "selected" : ""}>${pad(k)}</option>`).join("")}</select>
    </div></div>`;
}
const lireHeure = (el, id) => `${el.querySelector(`#${id}-h`).value}:${el.querySelector(`#${id}-m`).value}`;

function journeeCard(ctx, today, jour, existant) {
  const def = ctx.meta.journee || { debut: "07:30", fin: "16:30", pauseMin: 60 };
  const v =
    existant && !existant.supprimee
      ? {
          debut: existant.arrivee || def.debut,
          fin: existant.depart || def.fin,
          pauseMin: existant.depart ? existant.pauseMin : def.pauseMin,
        }
      : def;
  const pauses = [...new Set([...PAUSES, Number(v.pauseMin) || 0])].sort((a, b) => a - b);
  const jours = joursRecents(today, 21);
  if (!jours.includes(jour)) jours.push(jour);
  const modif = existant && !existant.supprimee;
  const h = ctx.meta.journee;
  const habitude = !modif && h ? journeePunches({ date: jour, ...h }) : null;
  const vite = habitude && habitude.ok;
  return `<div class="card" id="journee">
      <h2>Ma journée</h2>
      ${
        vite
          ? `<button class="btn primary big habitude" id="j-vite">✔ ${esc(nomJour(jour, today))} comme d'habitude<small>${esc(h.debut)} → ${esc(h.fin)}${Number(h.pauseMin) ? " · pause " + pauseLabel(Number(h.pauseMin)) : ""} · ${fmtH(habitude.minutes)}</small></button>
      <details id="j-autres"><summary>Autres horaires ou autre jour</summary>`
          : ""
      }
      <label for="j-date">Jour</label><select id="j-date">${jours.map((d) => `<option value="${d}" ${d === jour ? "selected" : ""}>${esc(nomJour(d, today))}</option>`).join("")}</select>
      <div class="grid2">${heureChamp("j-debut", "Arrivée", v.debut)}${heureChamp("j-fin", "Départ", v.fin)}</div>
      <label for="j-pause">Pause (non payée)</label><select id="j-pause">${pauses.map((m) => `<option value="${m}" ${m === Number(v.pauseMin) ? "selected" : ""}>${pauseLabel(m)}</option>`).join("")}</select>
      <div class="total-jour"><span>Total travaillé</span><b class="num" id="j-total">—</b></div>
      ${
        modif
          ? `${existant.aVerifier ? `<p class="note bad">Départ manquant : complétez la journée.</p>` : ""}
      <label for="j-motif">Pourquoi ce changement ?</label><input id="j-motif" type="text" value="${existant.aVerifier ? "Journée complétée" : ""}" placeholder="Ex. : parti à 17 h">`
          : ""
      }
      <p class="note bad" id="j-err" hidden></p>
      <button class="btn primary big" id="j-ok">${modif ? "ENREGISTRER LA MODIFICATION" : "ENREGISTRER MA JOURNÉE"}</button>
      ${modif ? `<button class="btn ghost" id="j-suppr">Supprimer cette journée</button>` : ""}
      ${vite ? "</details>" : ""}
    </div>`;
}

function faitCard(today, jour, j) {
  return `<div class="card" id="journee">
      <h2>Ma journée</h2>
      <p class="fait">✅ <b>${esc(nomJour(jour, today))}</b> : ${esc(j.arrivee || "?")} → ${esc(j.depart || "?")}${j.pauseMin ? ", pause " + pauseLabel(j.pauseMin) : ""}</p>
      <div class="total-jour"><span>Total travaillé</span><b class="num">${fmtH(j.minutes)}</b></div>
      <div class="grid2"><button class="btn" id="j-modif">Modifier</button><button class="btn primary" id="j-autre">Noter un autre jour</button></div>
    </div>`;
}

async function enregistrer(ctx, c, j, r, existant, motifModif) {
  if (existant && !existant.supprimee) {
    for (const id of existant.ids) await ctx.append("correction", { targetId: id, motif: motifModif, annule: true });
  }
  const base = motifJournee(j.pauseMin);
  const motif = existant && !existant.supprimee ? `${base}. Modification : ${motifModif}` : base;
  for (const p of r.punches) {
    await ctx.append("punch", { contratId: c.id, action: p.action, at: p.at, manuel: true, journee: true, motif });
  }
}

function bindJournee(ctx, el, c, existant) {
  const $ = (s) => el.querySelector(s);
  const lire = () => ({
    date: $("#j-date").value,
    debut: lireHeure(el, "j-debut"),
    fin: lireHeure(el, "j-fin"),
    pauseMin: Number($("#j-pause").value),
  });
  const maj = () => {
    const r = journeePunches(lire());
    $("#j-total").textContent = r.ok ? fmtH(r.minutes) : "—";
    const err = $("#j-err");
    err.hidden = r.ok;
    err.textContent = r.ok ? "" : r.erreur;
    $("#j-ok").disabled = !r.ok;
    return r.ok ? r : null;
  };
  el.querySelectorAll("#journee select").forEach((s) => {
    if (s.id !== "j-date") s.onchange = maj;
  });
  $("#j-date").onchange = () => {
    ui.jour = $("#j-date").value;
    ui.edit = false;
    ctx.go("pointer");
  };
  maj();
  const motifOk = () => {
    const m = $("#j-motif") ? $("#j-motif").value.trim() : "";
    if ($("#j-motif") && !m) {
      ctx.toast("Indiquez pourquoi.", true);
      return null;
    }
    return m;
  };
  $("#j-ok").onclick = async (e) => {
    const r = maj();
    if (!r) return;
    const m = motifOk();
    if (m === null) return;
    e.currentTarget.disabled = true;
    const j = lire();
    await enregistrer(ctx, c, j, r, existant, m);
    await ctx.setMeta("journee", { debut: j.debut, fin: j.fin, pauseMin: j.pauseMin });
    if (navigator.vibrate) navigator.vibrate(60);
    ctx.toast(`${nomJour(j.date, parisDate(nowIso()))} : ${fmtH(r.minutes)} enregistrées.`);
    ui.semaine = weekKey(j.date);
    ui.jour = j.date;
    ui.edit = false;
    ctx.refresh();
  };
  const vite = $("#j-vite");
  if (vite) {
    vite.onclick = async () => {
      const j = { date: $("#j-date").value, ...ctx.meta.journee };
      const r = journeePunches(j);
      if (!r.ok) return ctx.toast(r.erreur, true);
      vite.disabled = true;
      await enregistrer(ctx, c, j, r, existant, "");
      if (navigator.vibrate) navigator.vibrate(60);
      ctx.toast(`${nomJour(j.date, parisDate(nowIso()))} : ${fmtH(r.minutes)} enregistrées.`);
      ui.semaine = weekKey(j.date);
      ui.jour = j.date;
      ui.edit = false;
      ctx.refresh();
    };
  }
  const sup = $("#j-suppr");
  if (sup) {
    sup.onclick = async () => {
      const m = motifOk();
      if (m === null) return;
      for (const id of existant.ids) await ctx.append("correction", { targetId: id, motif: m, annule: true });
      ui.edit = false;
      ctx.toast("Journée supprimée.");
      ctx.refresh();
    };
  }
}

function semaineCard(c, punches, lundi, today) {
  const jours = joursDeSemaine(lundi);
  const { rows } = splitWeekly(minutesByDay(workIntervals(punches).intervals), c);
  const r = rows.filter((x) => x.week === lundi);
  const parJour = new Map(r.map((x) => [x.date, x.total]));
  const s = sumRows(r);
  const sup = s.hs1 + s.hs2 + s.hc1 + s.hc2;
  return `<div class="card" id="semaine">
      <div class="row"><button class="btn sm" id="s-prev" aria-label="Semaine précédente">‹</button>
        <h2 class="grow" style="text-align:center;margin:0">Ma semaine<br><span class="small muted">${jours[0].slice(8)}/${jours[0].slice(5, 7)} → ${jours[6].slice(8)}/${jours[6].slice(5, 7)}</span></h2>
        <button class="btn sm" id="s-next" aria-label="Semaine suivante" ${weekKey(today) === lundi ? "disabled" : ""}>›</button></div>
      <table class="semaine">${jours
        .map(
          (d, k) =>
            `<tr data-jour="${d}" class="${d === today ? "auj" : ""}"><td>${JOURS_NOMS[k]}</td><td class="r num">${parJour.get(d) ? fmtH(parJour.get(d)) : d > today ? "" : "—"}</td></tr>`,
        )
        .join("")}
        <tr class="tot"><td>Total</td><td class="r num" id="s-total">${fmtH(s.total)}</td></tr>
        ${sup ? `<tr><td>${c.hebdo < 35 ? "dont heures compl. et sup" : "dont heures sup"}</td><td class="r num" style="color:var(--amber)">${fmtH(sup)}</td></tr>` : ""}
      </table>
    </div>`;
}

function historiqueCard(journees, today) {
  if (!journees.length) return "";
  return `<details class="card" id="historique"><summary style="min-height:48px;display:flex;align-items:center"><b>Mes journées (${journees.filter((j) => !j.supprimee).length})</b></summary>
      <ul class="jours">${journees
        .slice(0, 60)
        .map(
          (j) => `<li data-jour="${j.date}" class="${j.supprimee ? "strike" : ""}">
          <div class="grow"><b>${esc(nomJour(j.date, today))}</b>
            <div class="small muted">${j.supprimee ? "supprimée" : `${esc(j.arrivee || "?")} → ${esc(j.depart || "?")}${j.pauseMin ? " · pause " + pauseLabel(j.pauseMin) : ""}`}
            ${j.aVerifier && !j.supprimee ? ' <span class="tag warn">à vérifier</span>' : ""}${j.modifiee ? ' <span class="tag warn">modifiée</span>' : ""}</div>
            ${j.motifs.length ? `<div class="small dim">${j.motifs.map(esc).join(" · ")}</div>` : ""}</div>
          <b class="num">${j.supprimee ? "" : fmtH(j.minutes)}</b></li>`,
        )
        .join("")}</ul>
    </details>`;
}

function appUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, "");
}

function rappelCard(ctx, today) {
  const heure = ctx.meta.rappelHeure || "19:00";
  const [soir, mois] = rappelsParDefaut({ date: today, heure, appUrl: appUrl() });
  return `<details class="card" id="rappel"><summary style="min-height:48px;display:flex;align-items:center"><b>🔔 Rappel du soir</b></summary>
      ${heureChamp("r-heure", "Heure du rappel", heure)}
      <a class="btn primary" id="r-soir" target="_blank" rel="noopener" href="${esc(googleAgendaUrl(soir))}">Rappel chaque soir</a>
      <a class="btn" id="r-mois" target="_blank" rel="noopener" href="${esc(googleAgendaUrl(mois))}">Rappel en fin de mois</a>
      <button class="btn ghost" id="r-ics">Autre agenda (.ics)</button>
    </details>`;
}

function bindRappel(ctx, el, today) {
  const lire = () => lireHeure(el, "r-heure");
  const maj = async () => {
    const [soir, mois] = rappelsParDefaut({ date: today, heure: lire(), appUrl: appUrl() });
    el.querySelector("#r-soir").href = googleAgendaUrl(soir);
    el.querySelector("#r-mois").href = googleAgendaUrl(mois);
    await ctx.setMeta("rappelHeure", lire());
  };
  el.querySelector("#r-heure-h").onchange = maj;
  el.querySelector("#r-heure-m").onchange = maj;
  el.querySelector("#r-ics").onclick = () => {
    const ics = rappelsIcs(rappelsParDefaut({ date: today, heure: lire(), appUrl: appUrl() }));
    downloadBlob("paie-juste-rappels.ics", new Blob([ics], { type: "text/calendar" }));
    ctx.toast("Fichier enregistré.");
  };
}

export default {
  id: "pointer",
  label: "Mes heures",
  render(ctx, el) {
    const c = ctx.state.contrats.get(ctx.meta.currentContrat);
    if (!c) {
      el.innerHTML = `<div class="card"><h2>Bienvenue, chef 👷</h2><p>Prenez en photo votre fiche de paie ou votre contrat : l'appli lit, vérifie et vous dit s'il manque de l'argent. <b>Tout reste sur ce téléphone.</b></p>
        ${boutonDocument("w-file")}
        <button class="btn" id="go-c">✍️ Remplir mon contrat à la main</button><button class="btn ghost" id="go-demo">Voir un exemple</button></div>`;
      brancherDocument(ctx, el, "w-file");
      el.querySelector("#go-c").onclick = () => contratALaMain(ctx);
      el.querySelector("#go-demo").onclick = () => ctx.setDemo(true);
      return;
    }
    const today = parisDate(nowIso());
    const punches = ctx.state.punches.filter((p) => p.contratId === c.id);
    const tous = ctx.state.allPunches.filter((p) => p.contratId === c.id);
    const journees = resumeJournees(punches, tous);
    const jour = ui.jour || today;
    const existant = journees.find((j) => j.date === jour);
    const lundi = ui.semaine || weekKey(today);
    const heureParis = Number(isoToParisLocal(nowIso()).slice(11, 13));
    const der = ctx.meta.derniereSauvegarde;
    const aSauvegarder =
      !ctx.demo && journees.length >= 3 && (!der || Date.now() - new Date(der).getTime() > 30 * 864e5);
    const rienAujourdhui = !journees.some((j) => j.date === today && !j.supprimee);
    el.innerHTML = `
      ${contratSelect(ctx)}
      ${rienAujourdhui && heureParis >= 17 ? `<p class="note" id="j-oubli">Heures du jour pas encore notées.</p>` : ""}
      ${aSauvegarder ? `<button class="note" id="go-sauv" style="width:100%;text-align:left;border:0;cursor:pointer">💾 Pensez à sauvegarder vos heures${der ? "" : " (jamais fait)"}.</button>` : ""}
      ${existant && !existant.supprimee && !existant.aVerifier && !ui.edit ? faitCard(today, jour, existant) : journeeCard(ctx, today, jour, existant)}
      ${semaineCard(c, punches, lundi, today)}
      <button class="btn" id="go-paie">📄 Mon salaire du mois</button>
      ${historiqueCard(journees, today)}
      ${rappelCard(ctx, today)}`;
    bindContratSelect(ctx, el);
    if (el.querySelector("#j-modif")) {
      el.querySelector("#j-modif").onclick = () => {
        ui.jour = jour;
        ui.edit = true;
        ctx.go("pointer");
      };
      el.querySelector("#j-autre").onclick = () => {
        const libre = joursRecents(today, 21).find((d) => !journees.some((j) => j.date === d && !j.supprimee));
        ui.jour = libre || joursRecents(today, 2)[1];
        ui.edit = false;
        ctx.go("pointer");
      };
    } else bindJournee(ctx, el, c, existant);
    bindRappel(ctx, el, today);
    el.querySelector("#go-paie").onclick = () => ctx.go("paie");
    const gs = el.querySelector("#go-sauv");
    if (gs) gs.onclick = () => ctx.go("donnees");
    const decale = (n) => {
      const [y, m, d] = lundi.split("-").map(Number);
      ui.semaine = new Date(Date.UTC(y, m - 1, d + 7 * n)).toISOString().slice(0, 10);
      ctx.go("pointer");
    };
    el.querySelector("#s-prev").onclick = () => decale(-1);
    el.querySelector("#s-next").onclick = () => decale(1);
    el.querySelectorAll("[data-jour]").forEach((row) => {
      if (row.dataset.jour > today) return;
      row.style.cursor = "pointer";
      row.onclick = () => {
        ui.jour = row.dataset.jour;
        ui.edit = false;
        ctx.go("pointer");
        document.querySelector("#journee")?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
  },
};
