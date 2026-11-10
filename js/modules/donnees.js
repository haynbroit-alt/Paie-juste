import { buildExport, buildCsv, checkImport } from "../export.js";
import { verifyChain } from "../chain.js";
import { downloadBlob, esc } from "../util.js";
import { APP_VERSION } from "../version.js";

const stamp = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).replace(/[-: ]/g, "").slice(0, 12);

export default {
  id: "donnees", label: "Données",
  render(ctx, el) {
    const v = ctx.verif || { ok: false, errors: [] };
    el.innerHTML = `<h2>Mes données</h2>
      <div class="card"><div class="row"><div class="grow"><h3>Chaîne d'empreintes SHA-256</h3><p class="small muted">${ctx.records.length} enregistrements · empreinte finale <span class="num">${esc((ctx.records[ctx.records.length - 1]?.hash || "").slice(0, 16))}…</span></p></div><span class="tag ${v.ok ? "ok" : "bad"}">${v.ok ? "INTACTE" : "ROMPUE"}</span></div>
        <button class="btn" id="d-verify">Vérifier maintenant</button><pre id="d-res" class="small" style="white-space:pre-wrap"></pre>
        <p class="small dim">Chaque enregistrement contient l'empreinte du précédent. Ce n'est ni une blockchain ni une crypto-monnaie, et ce n'est pas une preuve certifiée : cela montre seulement qu'aucune ligne n'a été modifiée ou retirée sans que ça se voie.</p></div>
      <div class="card"><h3>Exporter</h3><p class="small muted">Les fichiers sont créés sur ce téléphone, à votre demande. Gardez-en une copie ailleurs (clé USB, ordinateur).</p>
        <div class="grid2"><button class="btn primary" id="d-json">JSON (complet)</button><button class="btn" id="d-csv">CSV (tableur)</button></div></div>
      <div class="card"><h3>Importer une sauvegarde</h3><p class="small muted">La chaîne est vérifiée avant l'import. Si elle est rompue, l'import est refusé. L'import <b>remplace</b> les données ${ctx.demo ? "de l'exemple" : "de ce téléphone"}.</p>
        <label class="btn" for="d-file" style="cursor:pointer">Choisir un fichier JSON</label><input id="d-file" type="file" accept="application/json,.json" hidden><p id="d-imp" class="small"></p></div>
      <div class="card"><h3>${ctx.demo ? "Vous regardez l'EXEMPLE" : "Voir l'exemple"}</h3>
        <p class="small muted">${ctx.demo ? "Données fictives, rangées à part : vos vraies données ne sont pas touchées." : "Un mois d'intérim fictif avec un bulletin incomplet, pour voir l'appli en action. Rangé à part de vos données."}</p>
        <button class="btn ${ctx.demo ? "go" : "primary"}" id="d-demo">${ctx.demo ? "Revenir à mes données" : "Afficher l'exemple"}</button></div>
      <div class="card" style="border-color:#7a211d"><h3>Tout effacer${ctx.demo ? " (exemple)" : ""}</h3><p class="small muted">Irréversible. Exportez d'abord. Tapez EFFACER.</p>
        <input id="d-wipe-t" type="text" placeholder="EFFACER" autocomplete="off"><button class="btn stop" id="d-wipe">Effacer définitivement</button></div>
      <p class="small dim">Paie Juste v${APP_VERSION} · licence MIT · fonctionne hors ligne · aucune donnée ne quitte ce téléphone (pas de compte, pas de serveur, pas de statistiques).<br>Bibliothèques embarquées : pdf.js et tesseract.js (Apache-2.0).</p>`;
    const name = (ext) => `paie-juste${ctx.demo ? "-EXEMPLE" : ""}-${stamp()}.${ext}`;
    el.querySelector("#d-verify").onclick = async () => { const r = await verifyChain(ctx.records); el.querySelector("#d-res").textContent = r.ok ? `✓ Chaîne intacte : ${ctx.records.length} enregistrements.\nEmpreinte finale : ${r.head}` : "✗ " + r.errors.join("\n"); };
    el.querySelector("#d-json").onclick = () => downloadBlob(name("json"), new Blob([JSON.stringify(buildExport(ctx.records, { exemple: ctx.demo }), null, 2)], { type: "application/json" }));
    el.querySelector("#d-csv").onclick = () => downloadBlob(name("csv"), new Blob([buildCsv(ctx.records)], { type: "text/csv;charset=utf-8" }));
    el.querySelector("#d-file").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const out = el.querySelector("#d-imp");
      try {
        const obj = JSON.parse(await f.text());
        const r = await checkImport(obj);
        if (!r.ok) { out.textContent = "Import refusé : " + r.errors.slice(0, 3).join(" · "); return; }
        if (!confirm(`Chaîne vérifiée (${obj.records.length} enregistrements). Remplacer les données actuelles ?`)) return;
        await ctx.store.replaceAll(obj.records); ctx.toast("Sauvegarde importée."); ctx.refresh();
      } catch (err) { out.textContent = "Fichier illisible : " + err.message; }
    };
    el.querySelector("#d-demo").onclick = () => ctx.setDemo(!ctx.demo);
    el.querySelector("#d-wipe").onclick = async () => {
      if (el.querySelector("#d-wipe-t").value !== "EFFACER") return ctx.toast("Tapez EFFACER pour confirmer.", true);
      await ctx.store.wipe(); ctx.toast("Données effacées."); ctx.refresh();
    };
  },
};
