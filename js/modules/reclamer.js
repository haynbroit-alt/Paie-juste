import { lettreAmiable, miseEnDemeure, annexeReleve, CONTACTS, CONTACTS_NOTE, NOT_LEGAL_ADVICE } from "../letters.js";
import { fmtEur, parisDate } from "../calc.js";
import { esc, fmtParis, nowIso } from "../util.js";
import { currentCompute, periodLabel } from "./paie.js";
import { contratSelect, bindContratSelect } from "./pointer.js";

const ui = { type: "amiable", amiableDate: "", delai: 15 };
const ACTIONS = { debut: "DÉBUT", pause: "PAUSE", reprise: "REPRISE", fin: "FIN" };

export function buildContext(ctx) {
  const R = currentCompute(ctx);
  if (!R) return null;
  const { P, periode } = R;
  const inPeriod = (iso) => periode === "contrat" || parisDate(iso).slice(0, 7) === periode;
  const punches = ctx.state.allPunches
    .filter((p) => p.contratId === P.contrat.id && inPeriod(p.at))
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((p) => {
      const corr = p.corrections[p.corrections.length - 1];
      return {
        quand: fmtParis(p.at, { year: true }),
        action: ACTIONS[p.action],
        contrat: P.contrat.lieu || P.contrat.employeur,
        corrige: !!corr && !p.annule,
        annule: p.annule,
        motif: corr ? corr.motif + " (origine " + fmtParis(p.original.at) + ")" : "",
        hash: p.hash,
      };
    });
  return {
    P,
    profil: ctx.meta.profil || {},
    mission: P.contrat,
    periodeLabel: periodLabel(periode),
    compare: P.cmp,
    dateStr: new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }),
    amiableDate: ui.amiableDate ? new Date(ui.amiableDate + "T12:00:00Z").toLocaleDateString("fr-FR") : "",
    delaiJours: ui.delai,
    annexe: {
      count: ctx.records.length,
      head: ctx.records[ctx.records.length - 1]?.hash,
      verif: ctx.verif?.ok
        ? "chaîne intacte (vérifiée le " + fmtParis(nowIso(), { year: true }) + ", heure de Paris)"
        : "ÉCHEC : chaîne rompue",
      punches,
    },
  };
}

export default {
  id: "reclamer",
  label: "Réclamer",
  render(ctx, el) {
    const L = buildContext(ctx);
    if (!L) {
      el.innerHTML = `<div class="card"><h2>Réclamer</h2><p>Ajoutez d'abord votre contrat et vos heures.</p></div>`;
      return;
    }
    const txt = ui.type === "amiable" ? lettreAmiable(L) : ui.type === "med" ? miseEnDemeure(L) : annexeReleve(L);
    const p = L.profil;
    el.innerHTML = `${contratSelect(ctx)}
      <div class="note bad"><b>Ce n'est pas un conseil juridique.</b> L'appli prépare des brouillons. Rien n'est envoyé automatiquement : vous relisez, vous signez, vous envoyez vous-même.</div>
      <div class="card"><div class="row"><div class="grow"><h3>Montant réclamé (${esc(L.periodeLabel)})</h3><p class="muted small">Calculé dans « Ma paie » · estimation, à vérifier</p></div>
        <div class="num" style="font-size:2rem;font-weight:950;color:${L.compare.total > 0 ? "var(--red)" : "var(--green)"}">${fmtEur(Math.max(0, L.compare.total))}</div></div>
        ${L.compare.verdict === "incomplet" ? `<p class="note">Saisissez d'abord votre bulletin dans « Ma paie » pour chiffrer l'écart.</p>` : ""}</div>
      <div class="seg-ctl" role="group" aria-label="Type de courrier">
        <button data-t="amiable" aria-pressed="${ui.type === "amiable"}">① Demande amiable</button>
        <button data-t="med" aria-pressed="${ui.type === "med"}">② Mise en demeure</button>
        <button data-t="annexe" aria-pressed="${ui.type === "annexe"}">③ Relevé scellé</button></div>
      ${ui.type === "med" ? `<div class="grid2"><div><label for="r-am">Date de la demande amiable</label><input id="r-am" type="date" value="${ui.amiableDate}"></div><div><label for="r-del">Délai (jours)</label><input id="r-del" type="number" value="${ui.delai}"></div></div>` : ""}
      <div class="paper" id="paper" style="margin-top:.8rem">${esc(txt)}</div>
      <div class="grid2"><button class="btn primary" id="r-copy">Copier</button><button class="btn" id="r-print">Imprimer / PDF</button></div>
      <p class="small muted">« Imprimer / PDF » ouvre la boîte d'impression du téléphone : choisissez « Enregistrer au format PDF ». Le relevé scellé est ajouté en annexe, sur une nouvelle page.</p>
      <details class="card"><summary style="min-height:48px;display:flex;align-items:center"><b>Mes coordonnées pour les courriers</b></summary>
        <label for="pf-nom">Nom et prénom</label><input id="pf-nom" type="text" value="${esc(p.nom || "")}">
        <label for="pf-adr">Adresse</label><input id="pf-adr" type="text" value="${esc(p.adresse || "")}">
        <label for="pf-ville">Ville (pour « Fait à »)</label><input id="pf-ville" type="text" value="${esc(p.ville || "")}" placeholder="Montpellier">
        <button class="btn" id="pf-save">Enregistrer sur ce téléphone</button></details>
      <div class="card"><h3>Se faire aider (gratuit)</h3><p class="small muted">Pour tout salarié : CDI, CDD, intérim, temps partiel. Coordonnées vérifiées le 10/11/2026 sur les sites officiels.</p>
        ${CONTACTS.map(
          (
            c,
          ) => `<div class="contact"><b>${esc(c.nom)}</b><div class="small muted">${esc(c.role)}</div>${c.lignes.map((l) => `<div class="small">${esc(l)}</div>`).join("")}${c.telAff ? `<div class="small">${esc(c.telAff)}</div>` : ""}
          <div class="actions">${c.tel ? `<a href="tel:${c.tel}">📞 Appeler</a>` : ""}${c.mail ? `<a href="mailto:${c.mail}">✉ ${esc(c.mail)}</a>` : ""}${c.lien ? `<a href="${c.lien}" target="_blank" rel="noopener">Ouvrir</a>` : ""}<a href="${c.source}" target="_blank" rel="noopener" class="dim">source</a></div></div>`,
        ).join("")}
        <p class="small dim">${esc(CONTACTS_NOTE)}</p></div>`;
    bindContratSelect(ctx, el);
    el.querySelectorAll("[data-t]").forEach(
      (b) =>
        (b.onclick = () => {
          ui.type = b.dataset.t;
          ctx.go("reclamer");
        }),
    );
    const am = el.querySelector("#r-am");
    if (am) {
      am.onchange = () => {
        ui.amiableDate = am.value;
        ctx.go("reclamer");
      };
    }
    const de = el.querySelector("#r-del");
    if (de) {
      de.onchange = () => {
        ui.delai = Number(de.value) || 15;
        ctx.go("reclamer");
      };
    }
    el.querySelector("#r-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(txt);
        ctx.toast("Courrier copié. Collez-le dans votre e-mail ou votre traitement de texte.");
      } catch {
        const r = document.createRange();
        r.selectNodeContents(el.querySelector("#paper"));
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        ctx.toast("Texte sélectionné : appuyez sur Copier.", true);
      }
    };
    el.querySelector("#r-print").onclick = () => ctx.print(ui.type === "annexe" ? txt : txt + "\f" + annexeReleve(L));
    el.querySelector("#pf-save").onclick = async () => {
      await ctx.setMeta("profil", {
        nom: el.querySelector("#pf-nom").value.trim(),
        adresse: el.querySelector("#pf-adr").value.trim(),
        ville: el.querySelector("#pf-ville").value.trim(),
      });
      ctx.toast("Coordonnées enregistrées sur ce téléphone.");
      ctx.go("reclamer");
    };
  },
};
export { NOT_LEGAL_ADVICE };
