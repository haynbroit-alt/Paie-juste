import { parisDate, weekKey, fmtH, workIntervals, minutesByDay, splitWeekly, sumRows, TYPES } from "../calc.js";
import { esc, fmtHeure, fmtJour, nowIso, isoToParisLocal, parisLocalToIso, downloadBlob } from "../util.js";
import { journeePunches, motifJournee, googleAgendaUrl, rappelsIcs, rappelsParDefaut } from "../journee.js";

const LABELS = { debut: "Début", pause: "Pause", reprise: "Reprise", fin: "Fin" };
let tick = null;

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

function liveNumbers(ctx) {
  const c = ctx.state.contrats.get(ctx.meta.currentContrat);
  const now = nowIso();
  const punches = ctx.state.punches.filter((p) => p.contratId === c.id);
  const w = workIntervals(punches, { now });
  const byDay = minutesByDay(w.intervals);
  const today = parisDate(now);
  const { rows } = splitWeekly(byDay, c);
  const wk = sumRows(rows.filter((r) => r.week === weekKey(today)));
  const secToday = w.intervals
    .filter((i) => parisDate(i.start) === today)
    .reduce((a, i) => a + (new Date(i.end) - new Date(i.start)) / 1000, 0);
  const last = punches[punches.length - 1];
  const etat = !last || last.action === "fin" ? "idle" : last.action === "pause" ? "pause" : "work";
  return { secToday, wk, etat, today, rows };
}
const hms = (s) => {
  s = Math.max(0, Math.floor(s));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, "0")).join(":");
};

async function getGps() {
  if (!("geolocation" in navigator)) return { indisponible: true };
  return new Promise((res) =>
    navigator.geolocation.getCurrentPosition(
      (p) =>
        res({
          lat: Math.round(p.coords.latitude * 1e5) / 1e5,
          lon: Math.round(p.coords.longitude * 1e5) / 1e5,
          precision: Math.round(p.coords.accuracy),
        }),
      (e) => res({ refus: e.code === 1, erreur: e.code !== 1 ? e.message : undefined }),
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false },
    ),
  );
}

async function punch(ctx, action, extra = {}) {
  const at = extra.at || nowIso();
  const data = { contratId: ctx.meta.currentContrat, action, at, ...extra };
  if (!extra.manuel && ctx.meta.gps) data.gps = await getGps();
  const r = await ctx.append("punch", data);
  ctx.toast(`${LABELS[action]} scellé à ${fmtHeure(at)} · #${r.hash.slice(0, 8)}`);
  if (navigator.vibrate) navigator.vibrate(60);
  await ctx.refresh();
}

export function correctionDialog(ctx, item) {
  ctx.dialog(
    `<h2>Corriger ce pointage</h2>
    <p class="muted">On ne réécrit jamais : la correction est <b>ajoutée</b> et scellée, l'original reste visible.</p>
    <p>Original : <b>${LABELS[item.original.action]} à ${fmtHeure(item.original.at)}</b> le ${fmtJour(parisDate(item.original.at))}</p>
    <label for="c-at">Heure exacte</label><input id="c-at" type="datetime-local" value="${isoToParisLocal(item.at)}">
    <label class="check"><input id="c-annule" type="checkbox"><span>Annuler ce pointage (erreur de bouton)</span></label>
    <label for="c-motif">Motif (obligatoire)</label><input id="c-motif" type="text" placeholder="Ex. : oubli, sortie réelle à 17 h 15">
    <button class="btn primary" id="c-ok">Ajouter la correction</button><button class="btn ghost" id="c-x">Fermer</button>`,
    (d) => {
      d.querySelector("#c-x").onclick = () => d.close();
      d.querySelector("#c-ok").onclick = async () => {
        const motif = d.querySelector("#c-motif").value.trim();
        if (!motif) return ctx.toast("Indiquez un motif : c'est ce qui rend la correction crédible.", true);
        const annule = d.querySelector("#c-annule").checked;
        const at = parisLocalToIso(d.querySelector("#c-at").value);
        await ctx.append("correction", {
          targetId: item.id,
          motif,
          ...(annule ? { annule: true } : { changes: { at } }),
        });
        d.close();
        ctx.toast("Correction scellée.");
        ctx.refresh();
      };
    },
  );
}

function oubliDialog(ctx) {
  ctx.dialog(
    `<h2>Ajouter un pointage oublié</h2>
    <p class="muted">Il sera marqué « ajouté après coup », avec votre motif.</p>
    <label for="o-act">Type</label><select id="o-act">${Object.entries(LABELS)
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join("")}</select>
    <label for="o-at">Date et heure (heure de Paris)</label><input id="o-at" type="datetime-local" value="${isoToParisLocal(nowIso())}">
    <label for="o-motif">Motif (obligatoire)</label><input id="o-motif" type="text" placeholder="Ex. : téléphone déchargé">
    <button class="btn primary" id="o-ok">Ajouter et sceller</button><button class="btn ghost" id="o-x">Fermer</button>`,
    (d) => {
      d.querySelector("#o-x").onclick = () => d.close();
      d.querySelector("#o-ok").onclick = async () => {
        const motif = d.querySelector("#o-motif").value.trim();
        if (!motif) return ctx.toast("Indiquez un motif.", true);
        d.close();
        await punch(ctx, d.querySelector("#o-act").value, {
          at: parisLocalToIso(d.querySelector("#o-at").value),
          manuel: true,
          motif,
        });
      };
    },
  );
}

function timelineHtml(ctx, dayStr) {
  const c = ctx.state.contrats.get(ctx.meta.currentContrat);
  const items = ctx.state.allPunches
    .filter((p) => p.contratId === c.id && parisDate(p.at) === dayStr)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  if (!items.length) {
    return `<p class="muted">Aucun pointage ${dayStr === parisDate(nowIso()) ? "aujourd'hui" : "ce jour-là"}.</p>`;
  }
  const j = items.find((p) => p.journee && !p.annule);
  return `${j ? `<p class="small muted">${esc(j.motif)}.</p>` : ""}<ul class="timeline">${items
    .map((p) => {
      const corr = p.corrections.length ? p.corrections[p.corrections.length - 1] : null;
      return `<li><span class="dot ${p.action}"></span><span class="t num ${p.annule ? "strike" : ""}">${fmtHeure(p.at)}</span>
      <div class="grow"><b>${LABELS[p.action]}</b> ${p.journee ? '<span class="tag">journée saisie</span>' : p.manuel ? '<span class="tag warn">ajouté après coup</span>' : ""} ${p.annule ? '<span class="tag bad">annulé</span>' : corr ? '<span class="tag warn">corrigé</span>' : ""}
      ${corr && !p.annule ? `<div class="small muted">d'abord <span class="strike">${fmtHeure(p.original.at)}</span> · ${esc(corr.motif)}</div>` : ""}
      ${p.annule && corr ? `<div class="small muted">${esc(corr.motif)}</div>` : ""}
      ${p.manuel && p.motif && !p.journee ? `<div class="small muted">${esc(p.motif)}</div>` : ""}
      <div class="hash">#${p.hash.slice(0, 16)}${p.gps && p.gps.lat ? " · 📍 " + p.gps.lat + ", " + p.gps.lon : p.gps && p.gps.refus ? " · lieu refusé" : ""}</div></div>
      ${p.annule ? "" : `<button class="btn sm" data-corr="${p.id}">Corriger</button>`}</li>`;
    })
    .join("")}</ul>`;
}

const PAUSES = [0, 15, 30, 45, 60, 90, 120];

function journeeCard(ctx, today) {
  const j = ctx.meta.journee || { debut: "07:30", fin: "16:30", pauseMin: 60 };
  return `<div class="card" id="journee">
      <h2>Ma journée</h2>
      <p class="muted small">Le plus simple : notez le début, la fin et la pause, une fois par jour. Vous pouvez aussi pointer en direct plus bas.</p>
      <label for="j-date">Jour</label><input id="j-date" type="date" value="${today}" max="${today}">
      <div class="grid2">
        <div><label for="j-debut">Début</label><input id="j-debut" type="time" value="${esc(j.debut)}"></div>
        <div><label for="j-fin">Fin</label><input id="j-fin" type="time" value="${esc(j.fin)}"></div>
      </div>
      <label for="j-pause">Pause (non payée)</label><select id="j-pause">${PAUSES.map((m) => `<option value="${m}" ${m === Number(j.pauseMin) ? "selected" : ""}>${m ? (m >= 60 ? fmtH(m) : m + " min") : "Pas de pause"}</option>`).join("")}</select>
      <p class="kpi" style="margin:.6rem 0"><span class="l">Heures travaillées</span> <span class="v num" id="j-total">—</span></p>
      <p class="note bad" id="j-err" hidden></p>
      <button class="btn primary" id="j-ok">Enregistrer ma journée</button>
    </div>`;
}

function bindJournee(ctx, el, c) {
  const $ = (id) => el.querySelector(id);
  const lire = () => ({
    date: $("#j-date").value,
    debut: $("#j-debut").value,
    fin: $("#j-fin").value,
    pauseMin: Number($("#j-pause").value),
  });
  const dejaPointe = (date) =>
    ctx.state.allPunches.some((p) => p.contratId === c.id && !p.annule && parisDate(p.at) === date);
  const maj = () => {
    const j = lire();
    const r = journeePunches(j);
    const err = $("#j-err");
    $("#j-total").textContent = r.ok ? fmtH(r.minutes) : "—";
    const msg = !r.ok
      ? r.erreur
      : dejaPointe(j.date)
        ? "Ce jour a déjà des pointages : corrigez-les dans la liste plus bas."
        : "";
    err.hidden = !msg;
    err.textContent = msg;
    $("#j-ok").disabled = !!msg;
    return r.ok && !msg ? r : null;
  };
  ["#j-date", "#j-debut", "#j-fin", "#j-pause"].forEach((id) => ($(id).oninput = maj));
  maj();
  $("#j-ok").onclick = async (e) => {
    const r = maj();
    if (!r) return;
    e.currentTarget.disabled = true;
    const j = lire();
    const motif = motifJournee(j.pauseMin);
    for (const p of r.punches) {
      await ctx.append("punch", { contratId: c.id, action: p.action, at: p.at, manuel: true, journee: true, motif });
    }
    await ctx.setMeta("journee", { debut: j.debut, fin: j.fin, pauseMin: j.pauseMin });
    if (navigator.vibrate) navigator.vibrate(60);
    ctx.toast(`Journée du ${fmtJour(j.date)} enregistrée : ${fmtH(r.minutes)}. Scellée.`);
    ctx.refresh();
  };
}

function appUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, "");
}

function rappelCard(ctx, today) {
  const heure = ctx.meta.rappelHeure || "19:00";
  const [soir, mois] = rappelsParDefaut({ date: today, heure, appUrl: appUrl() });
  return `<details class="card" id="rappel"><summary style="min-height:48px;display:flex;align-items:center"><b>🔔 Me rappeler le soir de noter mes heures</b></summary>
      <p class="small muted">Une appli sans serveur ne peut pas envoyer de notification à heure fixe de façon fiable. Le rappel passe donc par l'agenda de votre téléphone, qui sonne tout seul.</p>
      <label for="r-heure">Heure du rappel</label><input id="r-heure" type="time" value="${esc(heure)}">
      <a class="btn primary" id="r-soir" target="_blank" rel="noopener" href="${esc(googleAgendaUrl({ ...soir }))}">Rappel chaque soir (lun.-ven.) dans Google Agenda</a>
      <a class="btn" id="r-mois" target="_blank" rel="noopener" href="${esc(googleAgendaUrl({ ...mois }))}">Rappel le dernier jour du mois : vérifier ma paie</a>
      <button class="btn ghost" id="r-ics">Autre agenda : télécharger les 2 rappels (.ics)</button>
      <p class="small dim">Google Agenda s'ouvre avec le rappel déjà rempli : appuyez sur « Enregistrer ». Aucune donnée de paie n'est envoyée, seulement le titre et l'heure.</p>
    </details>`;
}

function bindRappel(ctx, el, today) {
  const h = el.querySelector("#r-heure");
  if (!h) return;
  const maj = () => {
    const [soir, mois] = rappelsParDefaut({ date: today, heure: h.value || "19:00", appUrl: appUrl() });
    el.querySelector("#r-soir").href = googleAgendaUrl(soir);
    el.querySelector("#r-mois").href = googleAgendaUrl(mois);
  };
  h.onchange = async () => {
    maj();
    await ctx.setMeta("rappelHeure", h.value || "19:00");
  };
  el.querySelector("#r-ics").onclick = () => {
    const ics = rappelsIcs(rappelsParDefaut({ date: today, heure: h.value || "19:00", appUrl: appUrl() }));
    downloadBlob("paie-juste-rappels.ics", new Blob([ics], { type: "text/calendar" }));
    ctx.toast("Fichier enregistré : ouvrez-le pour l'ajouter à votre agenda.");
  };
}

export default {
  id: "pointer",
  label: "Pointer",
  unmount() {
    clearInterval(tick);
  },
  render(ctx, el) {
    clearInterval(tick);
    const c = ctx.state.contrats.get(ctx.meta.currentContrat);
    if (!c) {
      el.innerHTML = `<div class="card"><h2>Bienvenue, chef 👷</h2><p>Paie Juste pointe vos heures, vérifie votre fiche de paie et prépare votre réclamation. <b>Tout reste sur ce téléphone.</b></p>
        <button class="btn primary" id="go-c">Ajouter mon contrat</button><button class="btn" id="go-demo">Voir l'exemple (données fictives)</button></div>`;
      el.querySelector("#go-c").onclick = () => ctx.go("contrat");
      el.querySelector("#go-demo").onclick = () => ctx.setDemo(true);
      return;
    }
    const n = liveNumbers(ctx);
    const days = [...new Set(ctx.state.allPunches.filter((p) => p.contratId === c.id).map((p) => parisDate(p.at)))]
      .sort()
      .reverse();
    const dayShown = days.includes(n.today) || !days.length ? n.today : days[0];
    const btn =
      n.etat === "idle"
        ? { cls: "go", txt: "DÉBUT", sub: "Commencer la journée", act: "debut" }
        : n.etat === "work"
          ? { cls: "pause", txt: "PAUSE", sub: "Mettre en pause", act: "pause" }
          : { cls: "resume", txt: "REPRENDRE", sub: "Fin de la pause", act: "reprise" };
    const heureParis = Number(isoToParisLocal(nowIso()).slice(11, 13));
    const rien = !days.includes(n.today);
    el.innerHTML = `
      ${contratSelect(ctx)}
      ${n.etat === "idle" && rien && heureParis >= 17 ? `<p class="note" id="j-oubli">Vous n'avez pas encore noté vos heures aujourd'hui.</p>` : ""}
      ${n.etat === "idle" ? journeeCard(ctx, n.today) : ""}
      <button class="btn" id="go-paie">📄 Voir le détail de mon salaire du mois</button>
      ${n.etat === "idle" ? `<h3 class="muted" style="margin:1rem 0 .3rem">Ou pointer en direct</h3>` : ""}
      <div class="card ${n.etat === "work" ? "working" : ""}">
        <div class="row"><span class="tag">${esc(contratLabel(c))}</span></div>
        <div class="clock ${n.etat}">
          <p><span class="state"><i></i>${n.etat === "work" ? "Au travail" : n.etat === "pause" ? "En pause" : "Pas pointé"}</span></p>
          <div class="big num" id="live-today">${hms(n.secToday)}</div>
          <div class="sub">aujourd'hui</div>
        </div>
        <div class="bigbtn-wrap"><span class="ring"></span><span class="ring r2"></span>
          <button class="bigbtn ${btn.cls}" id="b-main">${btn.txt}<small>${btn.sub}</small></button></div>
        ${n.etat !== "idle" ? `<button class="btn stop" id="b-fin">FIN de journée</button>` : ""}
        <div class="grid2" style="margin-top:.9rem">
          <div class="kpi"><div class="l">Semaine</div><div class="v num" id="live-week">${fmtH(n.wk.total)}</div></div>
          <div class="kpi"><div class="l">${c.hebdo < 35 ? "Compl. + sup" : "Heures sup"}</div><div class="v num" style="color:var(--amber)" id="live-hs">${fmtH(n.wk.hs1 + n.wk.hs2 + n.wk.hc1 + n.wk.hc2)}</div></div>
        </div>
        <label class="check"><input type="checkbox" id="gps" ${ctx.meta.gps ? "checked" : ""}><span>Ajouter ma position GPS à chaque pointage <span class="hint">(facultatif ; vous pouvez refuser, le pointage est quand même enregistré)</span></span></label>
      </div>
      <div class="card"><div class="row"><h3 class="grow">${dayShown === n.today ? "Aujourd'hui" : fmtJour(dayShown)}</h3>
        ${days.length > 1 ? `<select id="day" class="day-select" aria-label="Jour affiché">${days.map((d) => `<option value="${d}" ${d === dayShown ? "selected" : ""}>${fmtJour(d)}</option>`).join("")}</select>` : ""}</div>
        <div id="tl">${timelineHtml(ctx, dayShown)}</div>
        <button class="btn" id="b-oubli">＋ Pointage oublié</button></div>
      ${rappelCard(ctx, n.today)}
      <p class="small dim">Chaque pointage est scellé par une empreinte SHA-256 qui inclut celle du précédent : toute modification après coup se voit. Ce n'est pas une preuve certifiée.</p>`;
    bindContratSelect(ctx, el);
    if (n.etat === "idle") bindJournee(ctx, el, c);
    bindRappel(ctx, el, n.today);
    el.querySelector("#go-paie").onclick = () => ctx.go("paie");
    el.querySelector("#b-main").onclick = (e) => {
      e.currentTarget.disabled = true;
      punch(ctx, btn.act);
    };
    const f = el.querySelector("#b-fin");
    if (f) {
      f.onclick = (e) => {
        e.currentTarget.disabled = true;
        punch(ctx, "fin");
      };
    }
    el.querySelector("#gps").onchange = (e) => ctx.setMeta("gps", e.target.checked);
    el.querySelector("#b-oubli").onclick = () => oubliDialog(ctx);
    const bindTl = () =>
      el
        .querySelectorAll("[data-corr]")
        .forEach((b) => (b.onclick = () => correctionDialog(ctx, ctx.state.items.get(b.dataset.corr))));
    bindTl();
    const ds = el.querySelector("#day");
    if (ds) {
      ds.onchange = () => {
        el.querySelector("#tl").innerHTML = timelineHtml(ctx, ds.value);
        bindTl();
      };
    }
    if (n.etat === "work") {
      tick = setInterval(() => {
        const m = liveNumbers(ctx);
        const a = el.querySelector("#live-today");
        if (a) a.textContent = hms(m.secToday);
        const w = el.querySelector("#live-week");
        if (w) w.textContent = fmtH(m.wk.total);
      }, 1000);
    }
  },
};
