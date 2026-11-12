/**
 * UN SEUL bouton pour tous les documents : fiche de paie ou contrat, photo ou PDF, une ou plusieurs pages.
 * L'appli lit sur le téléphone, devine la nature du document (règles de js/document-type.js)
 * et l'envoie au bon écran. En cas de doute, elle demande en deux gros boutons.
 */
import { devinerDocument } from "../document-type.js";
import { parseBulletin } from "../bulletin-parse.js";
import { parseContrat } from "../contrat-parse.js";

/** @type {Record<string, (ctx: any, text: string) => void>} */
const recepteurs = {};
/** Chaque écran déclare ce qu'il fait d'un document de son type. */
export function recevoir(type, fn) {
  recepteurs[type] = fn;
}

/** Le gros bouton jaune, identique partout. */
export function boutonDocument(id, titre = "📄 Ajouter ma fiche de paie ou mon contrat") {
  return `<label class="btn primary big doc-btn" for="${id}" style="cursor:pointer"><span>${titre}</span><small>Photo ou PDF · plusieurs pages possibles</small></label>
    <input id="${id}" type="file" accept="image/*,application/pdf" multiple hidden>`;
}

/** @param {string} id @param {"bulletin"|"contrat"} [prefere] type retenu si le document est flou */
export function brancherDocument(ctx, el, id, prefere) {
  const f = el.querySelector("#" + id);
  if (f) {
    f.onchange = () => {
      const files = Array.from(f.files || []);
      f.value = "";
      if (files.length) ouvrirDocuments(ctx, files, prefere);
    };
  }
}

function fenetre(html) {
  let d = document.getElementById("doc-lecture");
  if (!d) {
    d = document.createElement("div");
    d.id = "doc-lecture";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-modal", "true");
    document.body.appendChild(d);
  }
  d.innerHTML = `<div class="doc-box">${html}</div>`;
  return d;
}
function fermer() {
  const d = document.getElementById("doc-lecture");
  if (d) d.remove();
}

/** @param {File[]} files @param {"bulletin"|"contrat"} [prefere] */
export async function ouvrirDocuments(ctx, files, prefere) {
  const n = files.length;
  fenetre(`<h2>⏳ Je lis ${n > 1 ? `vos ${n} pages` : "votre document"}…</h2>
    <p id="doc-st" class="small">Préparation</p><div class="progress"><i id="doc-bar"></i></div>
    <p class="small muted">Ne fermez pas l'appli. Tout reste sur ce téléphone.<br>Première photo : un peu plus long (une seule fois).</p>`);
  const maj = (m) => {
    const bar = document.getElementById("doc-bar");
    const st = document.getElementById("doc-st");
    if (bar) bar.style.width = Math.round((m.progress || 0) * 100) + "%";
    if (st) st.textContent = traduire(m.status);
  };
  let text;
  try {
    const { lireFichiers } = await import("../importer.js");
    text = await lireFichiers(files, maj);
  } catch (e) {
    fermer();
    ctx.toast("Lecture impossible : " + (e.message || e) + ". Reprenez la photo.", true);
    return;
  }
  fermer();
  await traiterTexte(ctx, text, prefere);
}

/** Messages de l'OCR (en anglais) → français simple. */
function traduire(s) {
  const t = String(s || "");
  if (/recogniz/i.test(t)) return "Lecture du texte" + t.replace(/^[^(]*/, " ");
  if (/load|initializ/i.test(t)) return "Préparation de la lecture";
  return t;
}

/** @param {string} text @param {"bulletin"|"contrat"} [prefere] */
export async function traiterTexte(ctx, text, prefere) {
  // Un vrai document arrive pendant l'exemple : on ferme l'exemple, place aux vraies données.
  if (ctx.demo) {
    await ctx.setDemo(false);
    ctx.toast("Exemple fermé : place à vos vrais documents.");
  }
  let { type } = devinerDocument(text);
  if (!type) {
    const b = parseBulletin(text).champs;
    if (b.brut || b.net) type = "bulletin";
    else if (Object.keys(parseContrat(text)).length >= 2) type = "contrat";
  }
  if (!type && prefere && text.replace(/\s/g, "").length > 40) type = prefere;
  if (type && recepteurs[type]) {
    recepteurs[type](ctx, text);
    return;
  }
  const vide = text.replace(/\s/g, "").length < 40;
  const d = fenetre(`<h2>${vide ? "Je n'arrive pas à lire" : "C'est quel document ?"}</h2>
    <p>${vide ? "La photo est floue ou trop sombre. Posez la feuille à plat, bien éclairée, et prenez toute la page." : "Je n'ai pas su le reconnaître tout seul."}</p>
    ${vide ? "" : `<button class="btn primary big" data-doc="bulletin">💶 Ma fiche de paie</button><button class="btn primary big" data-doc="contrat">📝 Mon contrat</button>`}
    <button class="btn" data-doc="">${vide ? "OK" : "Annuler"}</button>`);
  d.querySelectorAll("[data-doc]").forEach((b) => {
    /** @type {HTMLElement} */ (b).onclick = () => {
      const t = /** @type {HTMLElement} */ (b).dataset.doc;
      fermer();
      if (t && recepteurs[t]) recepteurs[t](ctx, text);
    };
  });
}
