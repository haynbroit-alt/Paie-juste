/** Paie Juste — noyau : stockage, état, onglets modulaires (on peut brancher la Boîte noire comme module). */
import { Store } from "./db.js";
import { deriveState } from "./calc.js";
import { verifyChain } from "./chain.js";
import { seedDemo } from "./demo.js";
import { APP_VERSION } from "./version.js";
import { META_KEYS } from "./sauvegarde.js";
import pointer from "./modules/pointer.js";
import paie from "./modules/paie.js";
import reclamer from "./modules/reclamer.js";
import contrat from "./modules/contrat.js";
import donnees from "./modules/donnees.js";

const $ = (s) => document.querySelector(s);
/** Registre des modules. Pour ajouter un onglet (ex. Boîte noire bruit/vibrations) : un objet {id,label,icon,render}. */
export const MODULES = [pointer, paie, reclamer, contrat];
const HIDDEN = [donnees];
const DB_REEL = "paie-juste",
  DB_DEMO = "paie-juste-exemple";

const ctx = {
  store: null,
  records: [],
  state: null,
  demo: false,
  verif: null,
  view: "pointer",
  meta: {},
  version: APP_VERSION,
  async refresh(opts = {}) {
    this.records = await this.store.all();
    this.state = deriveState(this.records);
    for (const k of META_KEYS) {
      this.meta[k] = await this.store.getMeta(k, null);
    }
    if (!this.meta.currentContrat || !this.state.contrats.has(this.meta.currentContrat)) {
      const last =
        [...this.state.contrats.values()].filter((c) => !c.fin).pop() || [...this.state.contrats.values()].pop();
      this.meta.currentContrat = last ? last.id : null;
    }
    this.verif = await verifyChain(this.records);
    renderPill();
    if (opts.render !== false) render();
  },
  async setMeta(k, v) {
    await this.store.setMeta(k, v);
    this.meta[k] = v;
  },
  append(type, data) {
    return this.store.append({ type, data: this.demo ? { ...data, exemple: true } : data });
  },
  go(view) {
    this.view = view;
    render();
    window.scrollTo({ top: 0 });
  },
  toast(msg, bad) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = bad ? "bad" : "";
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.hidden = true), 3200);
  },
  dialog(html, bind) {
    const d = $("#dlg");
    d.innerHTML = html;
    bind && bind(d);
    d.showModal();
    return d;
  },
  print(text) {
    const p = $("#print-area");
    p.textContent = "";
    text.split("\f").forEach((chunk, i) => {
      const div = document.createElement("div");
      if (i) div.className = "pb";
      div.textContent = chunk;
      p.appendChild(div);
    });
    window.print();
  },
  async setDemo(on) {
    localStorage.setItem("pj-mode", on ? "demo" : "reel");
    if (this.store) this.store.close();
    this.demo = on;
    document.body.classList.toggle("demo", on);
    this.store = await new Store(on ? DB_DEMO : DB_REEL).open();
    if (on) {
      await this.store.wipe();
      await seedDemo(this.store);
    }
    await this.refresh();
  },
};
window.__pj = ctx; // pour les tests du navigateur

const ICONS = {
  pointer:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
  paie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>',
  reclamer:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  contrat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
};

function renderTabs() {
  $("#tabs").innerHTML = MODULES.map(
    (m) =>
      `<button data-v="${m.id}" ${ctx.view === m.id ? 'aria-current="page"' : ""}>${ICONS[m.id] || m.icon || ""}<span>${m.label}</span></button>`,
  ).join("");
  $("#tabs")
    .querySelectorAll("button")
    .forEach((b) => (b.onclick = () => ctx.go(b.dataset.v)));
}
function renderPill() {
  const p = $("#seal-pill");
  if (!ctx.verif) return;
  p.className = "seal-pill" + (ctx.verif.ok ? "" : " bad");
  p.title = ctx.verif.ok
    ? `${ctx.records.length} enregistrement${ctx.records.length > 1 ? "s" : ""} scellé${ctx.records.length > 1 ? "s" : ""} : rien n'a été effacé ni modifié en cachette.`
    : "Un enregistrement a été modifié : la chaîne d'empreintes est rompue.";
  p.textContent = ctx.verif.ok ? "🔒 Protégé" : "⚠ chaîne rompue";
}
let current = null;
function render() {
  renderTabs();
  const mod = [...MODULES, ...HIDDEN].find((m) => m.id === ctx.view) || MODULES[0];
  if (current && current.unmount) current.unmount();
  current = mod;
  const el = document.createElement("section");
  el.className = "view";
  el.id = "view-" + mod.id;
  $("#main").replaceChildren(el);
  mod.render(ctx, el);
}

$("#btn-data").onclick = () => ctx.go("donnees");
const params = new URLSearchParams(location.search);
const startDemo = params.get("exemple") === "1" || localStorage.getItem("pj-mode") === "demo";
if (params.get("onglet")) ctx.view = params.get("onglet");
ctx.setDemo(startDemo).catch((e) => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<p class="note bad">Erreur au démarrage : ${String(e.message || e)}</p>`,
  );
});

if ("serviceWorker" in navigator && location.protocol !== "file:" && !params.has("nosw")) {
  // Scope « ./ » : le dossier de la page ( / en local, /Paie-juste/ sur GitHub Pages).
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
}
