import { TYPES, MOTIFS_FIN, DEFAULT_RULES, fmtEur, tauxHoraire } from "../calc.js";
import { parseContrat } from "../contrat-parse.js";
import { esc, fmtParis, parisLocalToIso } from "../util.js";
import { contratSelect, bindContratSelect } from "./pointer.js";
import { boutonDocument, brancherDocument, recevoir } from "./document.js";

const ui = { editing: null, draft: null, proposals: null, rawText: "", progress: null, error: "", manuel: false };

/** 2026-10-05 → 05/10/2026 */
const dateFr = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : d || "");

/** Accueil « Remplir mon contrat à la main » : le formulaire s'ouvre directement. */
export function contratALaMain(ctx) {
  ui.manuel = true;
  ctx.go("contrat");
}
const FIELDS = {
  type: "Type de contrat",
  mode: "Salaire",
  taux: "Taux horaire brut",
  mensuel: "Salaire mensuel brut",
  hebdo: "Heures par semaine",
  employeur: "Employeur / agence",
  eu: "Entreprise utilisatrice",
  lieu: "Lieu / chantier",
  poste: "Poste",
  convention: "Convention collective",
  dateDebut: "Début",
  dateFin: "Fin",
};
const showVal = (k, v) =>
  k === "type"
    ? TYPES[v]?.label
    : k === "mode"
      ? v === "mensuel"
        ? "mensuel"
        : "à l'heure"
      : k === "taux" || k === "mensuel"
        ? fmtEur(v)
        : k === "hebdo"
          ? String(v).replace(".", ",") + " h"
          : v;

function blankDraft() {
  return {
    type: "cdi",
    mode: "horaire",
    hebdo: 35,
    taux: "",
    mensuel: "",
    employeur: "",
    employeurAdresse: "",
    eu: "",
    tauxRef: "",
    lieu: "",
    poste: "",
    convention: "",
    dateDebut: "",
    dateFin: "",
    avantages: [],
    rules: {},
  };
}
function draftFrom(c) {
  return { ...blankDraft(), ...c.raw, avantages: [...(c.raw.avantages || [])], rules: { ...(c.raw.rules || {}) } };
}

const pctIn = (id, label, val, def, art) =>
  `<div><label for="${id}">${label} <span class="hint">(${art})</span></label><input id="${id}" type="number" inputmode="decimal" step="0.1" value="${Math.round((val ?? def) * 1000) / 10}"></div>`;

/** Nouveau contrat vide : le long formulaire reste replié tant qu'on ne le demande pas. */
function formOuvert() {
  const d = ui.draft || {};
  return ui.manuel || ui.editing !== "new" || !!(d.employeur || d.taux || d.mensuel || d.dateDebut);
}

function formHtml(d) {
  const partiel = Number(d.hebdo) < 35;
  return `<div class="card"><h3>${ui.editing === "new" ? "Nouveau contrat" : "Modifier le contrat"}</h3>
    ${ui.editing !== "new" ? `<p class="small muted">La modification est <b>ajoutée</b> à la chaîne (correction tracée) : l'ancienne version reste lisible.</p>` : ""}
    <label for="f-type">Type</label><select id="f-type">${Object.entries(TYPES)
      .map(([k, v]) => `<option value="${k}" ${d.type === k ? "selected" : ""}>${v.label}</option>`)
      .join("")}</select>
    <label for="f-mode">Je suis payé</label><select id="f-mode"><option value="horaire" ${d.mode !== "mensuel" ? "selected" : ""}>à l'heure</option><option value="mensuel" ${d.mode === "mensuel" ? "selected" : ""}>au mois (salaire mensuel)</option></select>
    <div class="grid2">
      ${d.mode === "mensuel" ? `<div><label for="f-mensuel">Salaire mensuel brut (€)</label><input id="f-mensuel" type="number" inputmode="decimal" step="0.01" value="${esc(d.mensuel)}"></div>` : `<div><label for="f-taux">Taux horaire brut (€)</label><input id="f-taux" type="number" inputmode="decimal" step="0.01" value="${esc(d.taux)}"></div>`}
      <div><label for="f-hebdo">Heures / semaine</label><input id="f-hebdo" type="number" inputmode="decimal" step="0.5" value="${esc(d.hebdo)}"></div></div>
    ${partiel ? `<p class="note info">Temps partiel : au-delà de ${String(d.hebdo).replace(".", ",")} h, les heures complémentaires sont majorées de 10 % puis 25 % (L3123-29).</p>` : ""}
    <label for="f-employeur">${d.type === "interim" ? "Agence d'intérim" : "Employeur"}</label><input id="f-employeur" type="text" value="${esc(d.employeur)}">
    <label for="f-employeurAdresse">Adresse ${d.type === "interim" ? "de l'agence" : "de l'employeur"} <span class="hint">(pour les courriers)</span></label><input id="f-employeurAdresse" type="text" value="${esc(d.employeurAdresse)}">
    ${
      d.type === "interim"
        ? `<label for="f-eu">Entreprise utilisatrice</label><input id="f-eu" type="text" value="${esc(d.eu)}">
      <label for="f-tauxRef">Taux de référence de l'entreprise utilisatrice (€/h) <span class="hint">facultatif — figure au contrat de mise à disposition (L1251-43)</span></label><input id="f-tauxRef" type="number" inputmode="decimal" step="0.01" value="${esc(d.tauxRef ?? "")}">`
        : ""
    }
    <label for="f-lieu">Lieu de travail / chantier</label><input id="f-lieu" type="text" value="${esc(d.lieu)}">
    <label for="f-poste">Poste</label><input id="f-poste" type="text" value="${esc(d.poste)}">
    <label for="f-convention">Convention collective <span class="hint">(texte libre, ex. « Ouvriers du bâtiment, IDCC 1597 »)</span></label><input id="f-convention" type="text" value="${esc(d.convention)}">
    <div class="grid2"><div><label for="f-dateDebut">Début</label><input id="f-dateDebut" type="date" value="${esc(d.dateDebut)}"></div><div><label for="f-dateFin">Fin ${d.type === "cdi" ? "(vide)" : "prévue"}</label><input id="f-dateFin" type="date" value="${esc(d.dateFin)}"></div></div>
    <h3 style="margin-top:1rem">Primes et avantages fixes (par mois)</h3>
    <div id="avs">${d.avantages.map((a, i) => `<div class="row" style="margin:.3rem 0"><span class="grow">${esc(a.libelle)} · ${fmtEur(a.montant)}${a.base === false ? " · frais" : ""}</span><button class="btn sm" data-rm="${i}">Retirer</button></div>`).join("") || '<p class="small muted">Aucun.</p>'}</div>
    <div class="grid2"><div><label for="av-l">Libellé</label><input id="av-l" type="text" placeholder="Ex. : prime d'outillage"></div><div><label for="av-m">€ / mois</label><input id="av-m" type="number" inputmode="decimal" step="0.01"></div></div>
    <label class="check"><input type="checkbox" id="av-b" checked><span>Soumis à cotisations (salaire)</span></label>
    <button class="btn sm" id="av-add">＋ Ajouter</button>
    <details style="margin-top:1rem"><summary style="min-height:48px;display:flex;align-items:center"><b>Taux de majoration (si votre accord prévoit autre chose)</b></summary>
      <p class="small muted">Valeurs par défaut : celles du Code du travail, « à défaut d'accord ». Ne changez que si votre convention ou votre accord le dit.</p>
      <div class="grid2">${pctIn("r-hs1", "HS 36e-43e h (%)", d.rules.hs1Taux, DEFAULT_RULES.hs1Taux, "L3121-36")}${pctIn("r-hs2", "HS dès 44e h (%)", d.rules.hs2Taux, DEFAULT_RULES.hs2Taux, "L3121-36")}
      ${pctIn("r-hc1", "Compl. ≤ 1/10 (%)", d.rules.hc1Taux, DEFAULT_RULES.hc1Taux, "L3123-29")}${pctIn("r-hc2", "Compl. 1/10-1/3 (%)", d.rules.hc2Taux, DEFAULT_RULES.hc2Taux, "L3123-29")}
      ${d.type !== "cdi" ? pctIn("r-fin", d.type === "interim" ? "IFM (%)" : "Précarité (%)", d.rules.finTaux, DEFAULT_RULES.finTaux, d.type === "interim" ? "L1251-32" : "L1243-8") + pctIn("r-iccp", "ICCP (%)", d.rules.iccpTaux, DEFAULT_RULES.iccpTaux, d.type === "interim" ? "L1251-19" : "L1242-16") : ""}</div>
      ${d.type === "cdd" ? `<label class="check"><input type="checkbox" id="r-incl" ${d.rules.iccpInclutFin ? "checked" : ""}><span>CDD : inclure la précarité dans la base des congés payés <span class="hint">(INCONNU, non vérifié sur une source officielle)</span></span></label>` : ""}
    </details>
    <button class="btn primary" id="f-save">Enregistrer (scellé)</button><button class="btn ghost" id="f-cancel">Annuler</button></div>`;
}

function readForm(el) {
  const d = ui.draft;
  const v = (id) => {
    const i = el.querySelector("#f-" + id);
    return i ? i.value.trim() : d[id];
  };
  for (const k of [
    "type",
    "mode",
    "taux",
    "mensuel",
    "hebdo",
    "employeur",
    "employeurAdresse",
    "eu",
    "tauxRef",
    "lieu",
    "poste",
    "convention",
    "dateDebut",
    "dateFin",
  ]) {
    d[k] = v(k);
  }
  for (const k of ["taux", "mensuel", "hebdo", "tauxRef"]) d[k] = d[k] === "" || d[k] == null ? "" : Number(d[k]);
  const r = (id, key) => {
    const i = el.querySelector("#r-" + id);
    if (i && i.value !== "") {
      const x = Number(i.value) / 100;
      if (Math.abs(x - DEFAULT_RULES[key]) > 1e-9) d.rules[key] = x;
      else delete d.rules[key];
    }
  };
  r("hs1", "hs1Taux");
  r("hs2", "hs2Taux");
  r("hc1", "hc1Taux");
  r("hc2", "hc2Taux");
  r("fin", "finTaux");
  r("iccp", "iccpTaux");
  const inc = el.querySelector("#r-incl");
  if (inc) d.rules.iccpInclutFin = inc.checked;
  return d;
}

recevoir("contrat", (ctx, text) => {
  if (!ui.editing) {
    ui.editing = "new";
    ui.draft = blankDraft();
  }
  ui.error = "";
  ui.progress = null;
  ui.rawText = text;
  ui.proposals = parseContrat(text);
  ctx.go("contrat");
  window.scrollTo(0, 0);
  ctx.toast("📝 C'est un contrat : vérifiez ce que j'ai trouvé.");
});

function importCard() {
  const P = ui.proposals;
  return `<div class="card"><h3>Le plus simple : votre contrat en photo</h3>
    <p class="small muted">L'appli remplit les cases, vous vérifiez. Rien ne quitte ce téléphone.</p>
    ${boutonDocument("imp-file", "📝 Ajouter mon contrat")}
    ${ui.progress ? `<p id="imp-st" class="small">${esc(ui.progress.status || "")}</p><div class="progress"><i id="imp-bar"></i></div><p class="small dim">Première lecture d'une photo : chargement du moteur OCR (≈ 8 Mo, une seule fois).</p>` : ""}
    ${ui.error ? `<p class="note bad">${esc(ui.error)}</p>` : ""}
    <details ${ui.rawText && !P ? "open" : ""}><summary style="min-height:48px;display:flex;align-items:center">ou coller le texte du contrat</summary>
      <textarea id="imp-text" placeholder="Collez ici le texte du contrat">${esc(ui.rawText)}</textarea><button class="btn" id="imp-parse">Analyser ce texte</button></details>
    ${
      P
        ? Object.keys(P).length
          ? `<h3 style="margin-top:1rem">Ce que j'ai trouvé — cochez ce qui est juste</h3>
      ${Object.entries(P)
        .map(
          ([k, f]) =>
            `<div class="field-proposal"><input type="checkbox" data-k="${k}" checked aria-label="${FIELDS[k] || k}"><div><b>${FIELDS[k] || k} :</b> ${esc(showVal(k, f.value))}<div class="ex">« ${esc(f.extrait)} »</div></div></div>`,
        )
        .join("")}
      <button class="btn primary" id="imp-apply">Remplir le formulaire avec la sélection</button><p class="small muted">Rien n'est enregistré avant que vous appuyiez sur « Enregistrer ».</p>`
          : `<p class="note">Aucun champ reconnu. Remplissez le formulaire à la main.</p>`
        : ""
    }</div>`;
}

function rulesCard() {
  return `<details class="card"><summary style="min-height:48px;display:flex;align-items:center"><b>Règles utilisées (vérifiées le 10/11/2026)</b></summary>
    <table class="calc">
      <tr><td><span class="tag ok">PROUVÉ</span> 35 h/semaine, semaine du lundi au dimanche</td><td class="r small"><a href="https://code.travail.gouv.fr/code-du-travail/l3121-27" target="_blank" rel="noopener">L3121-27</a>, <a href="https://code.travail.gouv.fr/code-du-travail/l3121-35" target="_blank" rel="noopener">L3121-35</a></td></tr>
      <tr><td><span class="tag ok">PROUVÉ</span> Heures sup +25 % (8 premières) puis +50 %, à défaut d'accord</td><td class="r small"><a href="https://code.travail.gouv.fr/code-du-travail/l3121-36" target="_blank" rel="noopener">L3121-36</a></td></tr>
      <tr><td><span class="tag ok">PROUVÉ</span> Heures complémentaires +10 % (≤ 1/10) puis +25 %</td><td class="r small"><a href="https://code.travail.gouv.fr/code-du-travail/l3123-29" target="_blank" rel="noopener">L3123-29</a></td></tr>
      <tr><td><span class="tag ok">PROUVÉ</span> Intérim : IFM 10 %, ICCP 10 % (IFM comprise)</td><td class="r small"><a href="https://code.travail.gouv.fr/code-du-travail/l1251-32" target="_blank" rel="noopener">L1251-32</a>, <a href="https://code.travail.gouv.fr/code-du-travail/l1251-19" target="_blank" rel="noopener">L1251-19</a></td></tr>
      <tr><td><span class="tag ok">PROUVÉ</span> CDD : précarité 10 % (6 % possible par convention), ICCP 10 %</td><td class="r small"><a href="https://code.travail.gouv.fr/code-du-travail/l1243-8" target="_blank" rel="noopener">L1243-8</a>, <a href="https://code.travail.gouv.fr/code-du-travail/l1242-16" target="_blank" rel="noopener">L1242-16</a></td></tr>
      <tr><td><span class="tag ok">PROUVÉ</span> Cotisations salariales 2026</td><td class="r small"><a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F2302" target="_blank" rel="noopener">F2302</a></td></tr>
      <tr><td><span class="tag ok">PROUVÉ</span> Prescription des salaires : 3 ans</td><td class="r small"><a href="https://code.travail.gouv.fr/code-du-travail/l3245-1" target="_blank" rel="noopener">L3245-1</a></td></tr>
      <tr><td><span class="tag warn">INCONNU</span> Panier, trajet, transport, nuit, dimanche, conventions : <b>à saisir par vous</b></td><td class="r small">regles.md</td></tr>
    </table></details>`;
}

function finDialog(ctx, c) {
  ctx.dialog(
    `<h2>Terminer ce contrat</h2>
    <label for="e-at">Dernier jour</label><input id="e-at" type="date" value="${new Date().toISOString().slice(0, 10)}">
    <label for="e-motif">Motif</label><select id="e-motif">${Object.entries(MOTIFS_FIN)
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
      .join("")}</select>
    ${c.type === "cdd" ? `<label class="check"><input type="checkbox" id="e-cp"><span>J'ai pu prendre tous mes congés pendant le CDD (pas d'ICCP)</span></label>` : ""}
    <p class="small muted">Le motif décide si l'indemnité de fin est due (L1251-33, L1243-10).</p>
    <button class="btn stop" id="e-ok">Terminer (scellé)</button><button class="btn ghost" id="e-x">Fermer</button>`,
    (d) => {
      d.querySelector("#e-x").onclick = () => d.close();
      d.querySelector("#e-ok").onclick = async () => {
        const cp = d.querySelector("#e-cp");
        await ctx.append("contrat_fin", {
          contratId: c.id,
          at: parisLocalToIso(d.querySelector("#e-at").value + "T18:00"),
          motif: d.querySelector("#e-motif").value,
          congesPris: cp ? cp.checked : false,
        });
        d.close();
        ctx.toast("Fin de contrat scellée.");
        ctx.refresh();
      };
    },
  );
}

export default {
  id: "contrat",
  label: "Contrat",
  render(ctx, el) {
    const c = ctx.state.contrats.get(ctx.meta.currentContrat);
    if (!c && !ui.editing) {
      ui.editing = "new";
      ui.draft = blankDraft();
    }
    const th = c ? tauxHoraire(c) : 0;
    el.innerHTML = `${ui.editing ? "" : contratSelect(ctx)}
      ${
        c && !ui.editing
          ? `<div class="card"><div class="row"><h2 class="grow">${TYPES[c.type].label}${c.hebdo < 35 ? " · temps partiel" : ""}</h2>${c.fin ? '<span class="tag">terminé</span>' : '<span class="tag ok">en cours</span>'}${c.exemple ? ' <span class="tag warn">EXEMPLE</span>' : ""}</div>
        <div class="grid2"><div class="kpi"><div class="l">${c.mode === "mensuel" ? "Mensuel brut" : "Taux horaire"}</div><div class="v num">${fmtEur(c.mode === "mensuel" ? c.mensuel : c.taux)}</div></div>
          <div class="kpi"><div class="l">Par semaine</div><div class="v num">${String(c.hebdo).replace(".", ",")} h</div></div></div>
        <table class="calc info" style="margin-top:.6rem">
          <tr><td class="muted">${c.type === "interim" ? "Agence" : "Employeur"}</td><td class="r wr">${esc(c.employeur || "—")}</td></tr>
          ${c.type === "interim" ? `<tr><td class="muted">Entreprise utilisatrice</td><td class="r wr">${esc(c.eu || "—")}</td></tr><tr><td class="muted">Taux de référence</td><td class="r wr">${c.tauxRef ? fmtEur(c.tauxRef) : "non saisi"}</td></tr>` : ""}
          <tr><td class="muted">Lieu</td><td class="r wr">${esc(c.lieu || "—")}</td></tr>
          <tr><td class="muted">Poste</td><td class="r wr">${esc(c.poste || "—")}</td></tr>
          <tr><td class="muted">Convention</td><td class="r wr">${esc(c.convention || "non précisée")}</td></tr>
          <tr><td class="muted">Dates</td><td class="r wr">${esc(dateFr(c.dateDebut) || "?")} → ${esc(dateFr(c.dateFin) || (c.type === "cdi" ? "indéterminée" : "?"))}</td></tr>
          ${c.mode === "mensuel" ? `<tr><td class="muted">Taux horaire déduit</td><td class="r wr">${fmtEur(th)} <span class="art">mensuel ÷ (${c.hebdo} × 52/12)</span></td></tr>` : ""}
          ${c.avantages.length ? `<tr><td class="muted">Primes fixes</td><td class="r wr">${c.avantages.map((a) => esc(a.libelle) + " " + fmtEur(a.montant)).join("<br>")}</td></tr>` : ""}
          ${c.fin ? `<tr><td class="muted">Fin</td><td class="r wr">${fmtParis(c.fin.at, { year: true })} · ${esc(MOTIFS_FIN[c.fin.motif]?.label || "")}</td></tr>` : ""}
          ${c.corrections.length ? `<tr><td class="muted">Modifications</td><td class="r wr">${c.corrections.length} (tracées)</td></tr>` : ""}
        </table>
        <div class="grid2"><button class="btn" id="c-edit">Modifier</button>${c.fin ? `<button class="btn" id="c-new">＋ Nouveau</button>` : `<button class="btn stop" id="c-end">Terminer</button>`}</div>
        ${c.fin ? "" : `<button class="btn ghost" id="c-new2">＋ Ajouter un autre contrat</button>`}</div>`
          : ""
      }
      ${
        ui.editing
          ? importCard() +
            (formOuvert()
              ? formHtml(ui.draft)
              : `<button class="btn" id="c-manuel">✍️ Je n'ai pas le document : remplir à la main</button><div hidden>${formHtml(ui.draft)}</div>`)
          : ""
      }
      ${rulesCard()}`;
    bindContratSelect(ctx, el);
    const on = (id, f) => {
      const b = el.querySelector(id);
      if (b) b.onclick = f;
    };
    on("#c-edit", () => {
      ui.editing = c.id;
      ui.draft = draftFrom(c);
      ui.proposals = null;
      ctx.go("contrat");
    });
    const nw = () => {
      ui.editing = "new";
      ui.draft = blankDraft();
      ui.proposals = null;
      ui.rawText = "";
      ctx.go("contrat");
    };
    on("#c-new", nw);
    on("#c-new2", nw);
    on("#c-end", () => finDialog(ctx, c));
    if (!ui.editing) return;
    ["#f-type", "#f-mode", "#f-hebdo"].forEach((id) => {
      const s = el.querySelector(id);
      if (s) {
        s.onchange = () => {
          readForm(el);
          ctx.go("contrat");
        };
      }
    });
    brancherDocument(ctx, el, "imp-file", "contrat");
    on("#imp-parse", () => {
      ui.rawText = el.querySelector("#imp-text").value;
      ui.proposals = parseContrat(ui.rawText);
      ctx.go("contrat");
    });
    on("#c-manuel", () => {
      ui.manuel = true;
      ctx.go("contrat");
    });
    on("#imp-apply", () => {
      readForm(el);
      el.querySelectorAll("[data-k]").forEach((cb) => {
        if (cb.checked) ui.draft[cb.dataset.k] = ui.proposals[cb.dataset.k].value;
      });
      ui.proposals = null;
      ctx.toast("Formulaire rempli : vérifiez puis enregistrez.");
      ctx.go("contrat");
    });
    el.querySelectorAll("[data-rm]").forEach(
      (b) =>
        (b.onclick = () => {
          readForm(el);
          ui.draft.avantages.splice(Number(b.dataset.rm), 1);
          ctx.go("contrat");
        }),
    );
    on("#av-add", () => {
      readForm(el);
      const l = el.querySelector("#av-l").value.trim(),
        m = el.querySelector("#av-m").value;
      if (!l || m === "") return ctx.toast("Libellé et montant.", true);
      ui.draft.avantages.push({ libelle: l, montant: Number(m), base: el.querySelector("#av-b").checked });
      ctx.go("contrat");
    });
    on("#f-cancel", () => {
      ui.editing = c ? null : "new";
      ui.draft = c ? null : blankDraft();
      ui.proposals = null;
      ctx.go(c ? "contrat" : "pointer");
    });
    on("#f-save", async () => {
      const d = readForm(el);
      if (d.mode === "mensuel" ? !(d.mensuel > 0) : !(d.taux > 0)) {
        return ctx.toast(
          d.mode === "mensuel" ? "Indiquez le salaire mensuel brut." : "Indiquez le taux horaire brut.",
          true,
        );
      }
      if (ui.editing === "new") {
        const r = await ctx.append("contrat", d);
        await ctx.setMeta("currentContrat", r.id);
      } else {
        const old = ctx.state.contrats.get(ui.editing).raw;
        const changes = {};
        for (const [k, v] of Object.entries(d)) if (JSON.stringify(v) !== JSON.stringify(old[k])) changes[k] = v;
        if (Object.keys(changes).length) {
          await ctx.append("correction", { targetId: ui.editing, changes, motif: "Modification du contrat" });
        }
      }
      ui.editing = null;
      ui.draft = null;
      ui.proposals = null;
      ui.rawText = "";
      ctx.toast("Contrat scellé.");
      ctx.refresh();
    });
  },
};
