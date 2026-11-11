import {
  fmtEur,
  fmtH,
  parisDate,
  TYPES,
  COTIS_2026,
  round2,
  SMIC,
  tauxAJour,
  TAUX_VERIFIES_JUSQU_AU,
  verifierBulletinSeul,
} from "../calc.js";
import { computePeriod, contratRows, periodsOf, previsionMois, prescriptionInfo } from "../compute.js";
import { esc, fmtMois, fmtJour, nowIso } from "../util.js";
import { contratSelect, bindContratSelect } from "./pointer.js";
import { parseBulletin } from "../bulletin-parse.js";

const ui = { periode: null, avecFin: null };
/** Lecture d'un bulletin (photo ou PDF) : état de l'écran, rien n'est enregistré ici. */
const bimp = { progress: null, error: "", champs: null, periode: null, finContrat: null, fill: null, raw: "" };
const NOMS_CHAMPS = {
  heures: "Heures payées",
  base: "Salaire de base",
  hc: "Heures complémentaires",
  hs: "Heures sup",
  primes: "Primes",
  fin: "Indemnité de fin (IFM / précarité)",
  iccp: "Congés payés (ICCP)",
  frais: "Indemnités de frais",
  conges: "Congés payés pris (salaire)",
  intemperies: "Indemnités intempéries",
  brut: "Salaire brut (pour vérifier)",
  netAvantImpot: "Net avant impôt (pour vérifier)",
  net: "Net à payer (pour vérifier)",
};

async function lireBulletin(ctx, file) {
  Object.assign(bimp, { error: "", champs: null, periode: null, progress: { status: "Préparation", progress: 0 } });
  ctx.go("paie");
  const prog = (m) => {
    bimp.progress = m;
    const bar = document.querySelector("#bi-bar");
    const st = document.querySelector("#bi-st");
    if (bar) bar.style.width = Math.round((m.progress || 0) * 100) + "%";
    if (st) st.textContent = m.status || "";
  };
  try {
    const { pdfToText, pdfPageToBlob, imageToText } = await import("../importer.js");
    let text = "";
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const r = await pdfToText(file, prog);
      text = r.text;
      if (text.replace(/\s/g, "").length < 40) text = (await imageToText(await pdfPageToBlob(r.doc, 1), prog)).text;
    } else text = (await imageToText(file, prog)).text;
    analyserBulletin(text);
  } catch (e) {
    bimp.error = "Lecture impossible : " + (e.message || e) + ". Vous pouvez recopier les montants à la main.";
  }
  bimp.progress = null;
  ctx.go("paie");
}
function analyserBulletin(text) {
  bimp.raw = text;
  const r = parseBulletin(text);
  bimp.champs = r.champs;
  bimp.periode = r.periode;
  bimp.finContrat = r.finContrat || null;
  bimp.interim = !!r.interim;
}

const CHAMPS_BULLETIN = [
  "heures",
  "base",
  "hc",
  "hs",
  "primes",
  "conges",
  "fin",
  "iccp",
  "frais",
  "intemperies",
  "brut",
  "net",
];
function valeursLues() {
  /** @type {Record<string, number>} */
  const v = {};
  for (const [k, f] of Object.entries(bimp.champs || {})) v[k] = f.value;
  return v;
}
/** Type de contrat : celui du contrat, sinon deviné sur le bulletin (une IFM = intérim). */
function typeDevine(c) {
  if (c) return c.type;
  if (bimp.interim) return "interim";
  const f = bimp.champs && bimp.champs.fin;
  if (!f) return "cdi";
  return /mission|ifm/i.test(f.extrait) ? "interim" : "cdd";
}
const fmtHeures = (h) => String(h).replace(".", ",") + " h";

function verifCard(c, periodeCourante) {
  const F = bimp.champs;
  const prise = `<input id="bi-file" type="file" accept="application/pdf,image/*" hidden>`;
  const etat = `${bimp.progress ? `<p id="bi-st" class="small">${esc(bimp.progress.status || "Lecture…")}</p><div class="progress"><i id="bi-bar"></i></div>` : ""}
    ${bimp.error ? `<p class="note bad">${esc(bimp.error)}</p>` : ""}`;
  const coller = `<details><summary class="small" style="min-height:44px;display:flex;align-items:center">ou coller le texte du bulletin</summary>
      <textarea id="bi-text" placeholder="Collez ici le texte du bulletin">${esc(bimp.raw)}</textarea><button class="btn" id="bi-parse">Vérifier ce texte</button></details>`;
  if (!F || !Object.keys(F).length) {
    return `<div class="card" id="verif"><h2>Ma fiche de paie</h2>
      <label class="btn primary big" for="bi-file" style="cursor:pointer">📷 Vérifier ma fiche de paie</label>${prise}
      ${F ? `<p class="note bad">Je n'ai rien pu lire. Reprenez la photo bien à plat, bien éclairée.</p>` : ""}
      ${etat}${coller}</div>`;
  }
  const periode = bimp.periode || periodeCourante;
  const v = verifierBulletinSeul(valeursLues(), {
    type: typeDevine(c),
    periode,
    finContrat: bimp.finContrat,
    rules: c ? c.rules : undefined,
  });
  const verdict = !v.fiable
    ? `<p class="verdict bad">⚠️ Photo mal lue : des montants manquent. Reprenez la photo.</p>`
    : v.manque > 0
      ? `<p class="verdict bad">❌ Il manque environ ${fmtEur(v.manque)}</p>`
      : v.smic && v.smic.sous
        ? `<p class="verdict bad">❌ Votre taux horaire est sous le SMIC</p>`
        : v.aVerifier
          ? `<p class="verdict bad">⚠️ À vérifier : contrat terminé, indemnités de fin absentes</p>`
          : `<p class="verdict ok">✅ Tout est bon sur ce bulletin</p>`;
  const item = (ok, txt, alerte) =>
    `<li><span class="ic">${alerte ? "⚠️" : ok === true ? "✅" : ok === false ? "❌" : "➖"}</span><span>${txt}</span></li>`;
  const items = [
    ...(v.smic
      ? [
          item(
            !v.smic.sous,
            v.smic.sous
              ? `Taux horaire ${fmtEur(v.smic.taux)} : sous le SMIC (${fmtEur(v.smic.smic)}), soit ${fmtEur(v.smic.manque)} de moins sur le mois. Sauf apprenti ou moins de 18 ans.`
              : `Taux horaire ${fmtEur(v.smic.taux)} : au moins le SMIC (${fmtEur(v.smic.smic)}).`,
          ),
        ]
      : []),
    ...v.lignes.map((l) =>
      item(
        l.ok,
        l.recu == null
          ? `${esc(l.label)} : ${esc(l.note)}`
          : `${esc(l.label)} : ${fmtEur(l.recu)} reçus, ${fmtEur(l.attendu)} attendus${l.ok ? "" : ` — il manque ${fmtEur(l.ecart)}`}.`,
        l.alerte,
      ),
    ),
  ];
  return `<div class="card" id="verif"><h2>Ma fiche de paie · ${esc(fmtMois(periode))}</h2>
    ${verdict}
    <ul class="verifs">${items.join("") || item(null, "Rien à contrôler sur ce bulletin.")}</ul>
    <details><summary class="small" style="min-height:44px;display:flex;align-items:center">Ce que j'ai lu</summary>
      <ul class="verifs">${Object.entries(F)
        .map(
          ([k, f]) =>
            `<li><span>${esc(NOMS_CHAMPS[k] || k)} : <b>${k === "heures" ? fmtHeures(f.value) : fmtEur(f.value)}</b><div class="ex">« ${esc(f.extrait)} »</div></span></li>`,
        )
        .join("")}</ul></details>
    <button class="btn primary big" id="bi-garder">✅ Garder ce bulletin</button>
    <label class="btn" for="bi-file" style="cursor:pointer">📷 Reprendre la photo</label>${prise}
    ${etat}
    <p class="small muted">Estimation, à vérifier. Ce n'est pas un conseil juridique.</p></div>`;
}

function bindVerif(ctx, el, c, periodeCourante) {
  const f = el.querySelector("#bi-file");
  if (f) {
    f.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) lireBulletin(ctx, file);
    };
  }
  const p = el.querySelector("#bi-parse");
  if (p) {
    p.onclick = () => {
      analyserBulletin(el.querySelector("#bi-text").value);
      ctx.go("paie");
    };
  }
  const g = el.querySelector("#bi-garder");
  if (g) {
    g.onclick = async () => {
      g.disabled = true;
      const v = valeursLues();
      const periode = bimp.periode || periodeCourante;
      let contratId = c && c.id;
      if (!contratId) {
        const taux = v.heures > 0 && v.base > 0 ? Math.round((v.base / v.heures) * 10000) / 10000 : "";
        const r = await ctx.append("contrat", {
          type: typeDevine(null),
          mode: "horaire",
          taux,
          hebdo: 35,
          employeur: "",
          depuisBulletin: true,
        });
        await ctx.setMeta("currentContrat", r.id);
        contratId = r.id;
      }
      const data = { contratId, periode, source: "photo", ...(bimp.finContrat ? { finContrat: bimp.finContrat } : {}) };
      for (const k of CHAMPS_BULLETIN) if (typeof v[k] === "number") data[k] = v[k];
      await ctx.append("bulletin", data);
      Object.assign(bimp, { champs: null, raw: "", periode: null, finContrat: null });
      ui.periode = periode;
      ctx.toast(c ? "Bulletin gardé." : "Bulletin gardé. Contrat créé : complétez-le dans « Contrat ».");
      await ctx.refresh();
    };
  }
}
export function selectedPeriod(ctx) {
  const c = ctx.state.contrats.get(ctx.meta.currentContrat);
  if (!c) return null;
  // Mois avec des heures notées, et mois dont un bulletin a été gardé (même sans heures).
  const avecBulletin = [...ctx.state.bulletins.keys()]
    .filter((k) => k.startsWith(c.id + "|"))
    .map((k) => k.slice(c.id.length + 1))
    .filter((m) => /^\d{4}-\d{2}$/.test(m));
  const months = [...new Set([...periodsOf(contratRows(ctx.state, c.id).rows), ...avecBulletin])].sort();
  const cur = parisDate(nowIso()).slice(0, 7);
  const q = new URLSearchParams(location.search).get("periode");
  if (!ui.periode && (q || ctx.meta.periodeDefaut)) ui.periode = q || ctx.meta.periodeDefaut;
  if (!ui.periode || (ui.periode !== "contrat" && !months.includes(ui.periode) && ui.periode !== cur)) {
    ui.periode = months.includes(cur) ? cur : months[months.length - 1] || cur;
  }
  return { c, months, periode: ui.periode, cur };
}
export function periodLabel(p) {
  return p === "contrat" ? "toute la durée du contrat" : fmtMois(p);
}
export function currentCompute(ctx) {
  const s = selectedPeriod(ctx);
  if (!s) return null;
  return { ...s, P: computePeriod(ctx.state, s.c.id, s.periode, { avecFin: ui.avecFin, net: ctx.meta.netOpts || {} }) };
}

function animate(el, to) {
  if (!el) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || navigator.webdriver) {
    el.textContent = fmtEur(to);
    return;
  }
  const t0 = performance.now(),
    D = 1400;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / D),
      e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmtEur(round2(to * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function bars(P) {
  if (!P.weeks.length) return `<p class="muted">Aucune heure pointée sur cette période.</p>`;
  const max = Math.max(45 * 60, ...P.weeks.map((w) => w.total));
  const pct = (m) => (m / max) * 100;
  return `<div class="bars">${P.weeks
    .map(
      (w, i) => `<div class="bar" title="Semaine du ${w.week}">
      <div class="val num">${Math.round((w.total / 60) * 10) / 10} h</div>
      <div class="seg h2" style="height:${pct(w.hs2) * 0.82}%;animation-delay:${i * 90}ms"></div>
      <div class="seg h1" style="height:${pct(w.hs1) * 0.82}%;animation-delay:${i * 90}ms"></div>
      <div class="seg c" style="height:${pct(w.hc1 + w.hc2) * 0.82}%;animation-delay:${i * 90}ms"></div>
      <div class="seg n" style="height:${pct(w.normal) * 0.82}%;animation-delay:${i * 90}ms"></div>
      <div class="lbl">${fmtJour(w.week).replace(/^\S+\s/, "")}${w.flags.length ? " ⚠" : ""}</div></div>`,
    )
    .join("")}</div>
    <div class="legend"><span><i style="background:#4b5160"></i>normales</span>${P.contrat.hebdo < 35 ? '<span><i style="background:var(--blue)"></i>complémentaires</span>' : ""}<span><i style="background:var(--amber)"></i>sup +25 %</span><span><i style="background:#ff8a1f"></i>sup +50 %</span></div>`;
}

function hero(P) {
  const v = P.cmp.verdict;
  if (v === "doit") {
    return `<div class="hero doit"><div class="lead">${P.contrat.type === "interim" ? "L'agence vous doit" : "Votre employeur vous doit"}</div><div class="amount num" id="hero-amt">0,00 €</div><div class="muted">brut, d'après vos pointages et votre bulletin</div><span class="est">⚠ estimation, à vérifier</span></div>`;
  }
  if (v === "ordre") {
    return `<div class="hero ordre"><div class="lead">Tout est en ordre ✓</div><div class="amount num">${fmtEur(Math.abs(P.cmp.total))}</div><div class="muted">d'écart seulement entre le bulletin et votre calcul</div><span class="est">estimation, à vérifier</span></div>`;
  }
  if (v === "trop_percu") {
    return `<div class="hero ordre"><div class="lead">Votre bulletin est au-dessus du minimum calculé</div><div class="amount num">+${fmtEur(-P.cmp.total)}</div><div class="muted">Une convention ou un accord peut prévoir plus que la loi.</div><span class="est">estimation, à vérifier</span></div>`;
  }
  return `<div class="hero"><div class="lead">Paie attendue (minimum légal estimé)</div><div class="amount num" id="hero-amt">0,00 €</div><div class="muted">Saisissez votre bulletin ci-dessous pour savoir si le compte est bon.</div><span class="est">estimation, à vérifier</span></div>`;
}

function forecast(ctx, P, isCur) {
  const n = P.net,
    o = ctx.meta.netOpts || {};
  let prev = null;
  if (isCur) prev = previsionMois(ctx.state, P.contrat.id, parisDate(nowIso()), { net: o });
  const N = prev ? prev.netFin : n;
  const fraisLabels = P.primes
    .filter((x) => !x.base)
    .map(
      (x) =>
        x.libelle + " " + fmtEur((Number(x.montant) || 0) * (x.jours == null || x.jours === "" ? 1 : Number(x.jours))),
    )
    .join(", ");
  return `<div class="card forecast"><h3>${isCur ? "Ce que vous allez toucher ce mois" : "Ce que vous auriez dû toucher"}</h3>
      <div class="kpi"><div class="l">Net versé</div><div class="v num" style="color:var(--green)">${fmtEur(N.netVerse)}</div></div>
    </div>
    <table class="calc" id="net-decompte" style="margin-top:.6rem">
      <tr><td>Net avant impôt</td><td class="r num">${fmtEur(N.netAvantImpot)}</td></tr>
      <tr><td>− Impôt à la source (${String(N.tauxPAS || 0).replace(".", ",")} %)<span class="art">taux saisi par vous · base : net imposable ${fmtEur(N.netImposable)}</span></td><td class="r num">${N.pas ? "−" : ""}${fmtEur(N.pas)}</td></tr>
      <tr><td>+ Indemnités non soumises<span class="art">${esc(fraisLabels || "aucune")} · pas de cotisations, versées en plus</span></td><td class="r num">${N.frais ? "+" : ""}${fmtEur(N.frais)}</td></tr>
      <tr class="tot"><td>= Net versé</td><td class="r num" style="color:var(--green)">${fmtEur(N.netVerse)}</td></tr>
    </table>
    ${prev && prev.projMin ? `<p class="small muted">Dont projection : ${prev.restants} jours ouvrés restants × ${String(P.contrat.hebdo / 5).replace(".", ",")} h = ${fmtH(prev.projMin)} (heures normales, jours fériés non déduits).</p>` : ""}
    <details><summary class="small" style="min-height:44px;display:flex;align-items:center">Détail brut → net et réglages</summary>
      <table class="calc"><tr><th>Cotisation</th><th class="r">Taux</th><th class="r">Montant</th></tr>
      ${n.lignes.map((l) => `<tr><td>${esc(l.label)}</td><td class="r">${l.taux == null ? "saisi" : (Math.round(l.taux * 10000) / 100).toString().replace(".", ",") + " %"}</td><td class="r num">${l.montant < 0 ? "+" + fmtEur(-l.montant) : "−" + fmtEur(l.montant)}</td></tr>`).join("")}
      <tr class="tot"><td>Net avant impôt</td><td></td><td class="r num">${fmtEur(n.netAvantImpot)}</td></tr>
      <tr><td>Net imposable</td><td></td><td class="r num">${fmtEur(n.netImposable)}</td></tr></table>
      <p class="small muted">Taux salariaux 2026 de <a href="${COTIS_2026.source}" target="_blank" rel="noopener">service-public.fr (F2302)</a> ; réduction sur heures sup : <a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F2391" target="_blank" rel="noopener">F2391</a>. Mutuelle, prévoyance, taux réduits et cas particuliers : non connus de l'appli.</p>
      <div class="grid2"><div><label for="n-pas">Taux de prélèvement à la source (%)</label><input id="n-pas" type="number" inputmode="decimal" step="0.1" min="0" value="${o.tauxPAS ?? ""}" placeholder="voir votre bulletin"></div>
      <div><label for="n-mut">Mutuelle / prévoyance (€ par mois)</label><input id="n-mut" type="number" inputmode="decimal" step="0.01" min="0" value="${o.mutuelle ?? ""}" placeholder="0"></div></div>
      <label class="check"><input type="checkbox" id="n-cadre" ${o.cadre ? "checked" : ""}><span>Je suis cadre (APEC)</span></label>
      <label class="check"><input type="checkbox" id="n-am" ${o.alsaceMoselle ? "checked" : ""}><span>Alsace-Moselle (+1,30 % maladie, taux URSSAF)</span></label>
      <label class="check"><input type="checkbox" id="n-hs" ${o.hsExoImpot ? "checked" : ""}><span>Heures sup exonérées d'impôt (limite 7 500 € par an, F2391)</span></label>
      <button class="btn" id="n-save">Enregistrer ces réglages</button></details>
    <span class="tag warn">estimation</span></div>`;
}

/** État d'un bulletin gardé quand aucune heure n'est notée : la vérification du bulletin seul. */
function verdictBulletinGarde(P) {
  const b = P.bulletin;
  const v = verifierBulletinSeul(b, {
    type: P.contrat.type,
    periode: b.periode,
    finContrat: b.finContrat || null,
    rules: P.contrat.rules,
  });
  if (!v.fiable) return `<span>gardé, lecture incomplète</span>`;
  if (v.manque > 0) return `<b style="color:var(--red)">il manque ${fmtEur(v.manque)}</b>`;
  if (v.smic && v.smic.sous) return `<b style="color:var(--red)">taux sous le SMIC</b>`;
  if (v.aVerifier) return `<b style="color:var(--amber)">⚠️ fin de contrat à vérifier</b>`;
  return `<b style="color:var(--green)">gardé ✓</b>`;
}

function resumeCard(ctx, P, periode, isCur) {
  const m = P.exp.minutes;
  const sup = m.hs1 + m.hs2 + m.hc1 + m.hc2;
  const prev = isCur
    ? previsionMois(ctx.state, P.contrat.id, parisDate(nowIso()), { net: ctx.meta.netOpts || {} })
    : null;
  // Aucune heure notée mais un bulletin gardé : on montre ce que dit le bulletin plutôt que 0 €.
  const duBulletin = !m.total && P.bulletin && typeof P.bulletin.brut === "number";
  const brut = duBulletin ? P.bulletin.brut : prev ? prev.brutFin : P.exp.brut;
  const net = duBulletin
    ? typeof P.bulletin.net === "number"
      ? P.bulletin.net
      : null
    : (prev ? prev.netFin : P.net).netVerse;
  const v = P.cmp.verdict;
  const bulletin =
    v === "doit"
      ? `<b style="color:var(--red)">il manque ${fmtEur(P.cmp.total)}</b>`
      : v === "ordre" || v === "trop_percu"
        ? `<b style="color:var(--green)">conforme ✓</b>`
        : P.bulletin
          ? verdictBulletinGarde(P)
          : `<a href="#verif">📷 à vérifier ↑</a>`;
  return `<div class="card resume" id="resume"><h2>En bref</h2>
    <table class="resume">
      <tr><td>Heures travaillées</td><td class="r num">${duBulletin && P.bulletin.heures ? fmtH(Math.round(P.bulletin.heures * 60)) + " payées" : fmtH(m.total)}</td></tr>
      ${sup ? `<tr><td>dont heures sup</td><td class="r num">${fmtH(sup)}</td></tr>` : ""}
      <tr><td>Salaire brut${duBulletin ? " (bulletin)" : prev ? " prévu" : ""}</td><td class="r num">${fmtEur(brut)}</td></tr>
      <tr class="tot"><td>${duBulletin ? "Net payé (bulletin)" : "Net à recevoir"}</td><td class="r num">${net == null ? "—" : fmtEur(net)}</td></tr>
      <tr><td>Mon bulletin</td><td class="r">${bulletin}</td></tr>
    </table>
    ${
      P.smic && P.smic.sous
        ? `<p class="note bad" id="alerte-smic">Votre taux horaire (${fmtEur(P.smic.taux)}) est sous le SMIC (${fmtEur(P.smic.smic)} brut de l'heure), soit ${fmtEur(P.smic.ecart)} de moins par heure. Sauf apprenti ou moins de 18 ans, l'employeur doit payer au moins le SMIC. <a href="${SMIC.source}" target="_blank" rel="noopener">source</a></p>`
        : ""
    }
    ${
      tauxAJour(parisDate(nowIso()))
        ? ""
        : `<p class="note bad" id="alerte-taux">Les taux de cette version (SMIC, cotisations) ont été vérifiés jusqu'au ${TAUX_VERIFIES_JUSQU_AU.split("-").reverse().join("/")}. Mettez l'appli à jour : les montants peuvent être faux.</p>`
    }
    ${duBulletin ? `<p class="small muted">Notez vos journées dans « Mes heures » pour vérifier aussi que toutes vos heures sont payées.</p>` : ""}
    <p class="small muted">Estimation, à vérifier.</p></div>`;
}

function primesCard(P) {
  return `<details class="card"><summary><h3>Primes et indemnités</h3></summary>
    ${P.primes.length ? `<table class="calc">${P.primes.map((p) => `<tr><td>${esc(p.libelle)}${p.avantage ? ' <span class="tag">contrat</span>' : ""}<span class="art">${p.base ? "soumis (compte dans le brut)" : "frais non soumis"}</span></td><td class="r num">${fmtEur((Number(p.montant) || 0) * (p.jours == null || p.jours === "" ? 1 : Number(p.jours)))}</td></tr>`).join("")}</table>` : `<p class="muted">Aucune. Les montants de panier, trajet, transport dépendent de votre convention : l'appli n'en invente aucun.</p>`}
    <div class="grid2"><div><label for="p-lib">Libellé</label><input id="p-lib" type="text" placeholder="Ex. : panier"></div><div><label for="p-mt">Montant (€)</label><input id="p-mt" type="number" inputmode="decimal" step="0.01"></div></div>
    <div class="grid2"><div><label for="p-j">Nombre (jours…)</label><input id="p-j" type="number" inputmode="numeric" value="1"></div><div><label for="p-d">Date</label><input id="p-d" type="date"></div></div>
    <label class="check"><input type="checkbox" id="p-base" checked><span>C'est du salaire (soumis, compte dans la base des indemnités). Décochez pour un remboursement de frais.</span></label>
    <button class="btn" id="p-add">＋ Ajouter (scellé)</button></details>`;
}

function bulletinCard(P) {
  const b = P.bulletin || {};
  const fields = [
    ["heures", "Heures payées"],
    ["base", "Salaire de base (€)"],
    ...(P.contrat.hebdo < 35 ? [["hc", "Heures complémentaires (€)"]] : []),
    ["hs", "Heures sup (€)"],
    ["primes", "Primes (€)"],
    ...(TYPES[P.contrat.type].fin
      ? [
          ["fin", P.contrat.type === "interim" ? "IFM (€)" : "Précarité (€)"],
          ["iccp", "Congés payés ICCP (€)"],
        ]
      : []),
    ["frais", "Indemnités de frais (€)"],
  ];
  const fill = bimp.fill || {};
  return `<details class="card" id="bulletin"><summary><h3>Mon bulletin, à la main</h3></summary>
    <p class="small muted">Montants bruts. Laissez vide ce qui n'apparaît pas.</p>
    <div class="grid2">${fields.map(([k, l]) => `<div><label for="b-${k}">${l}</label><input id="b-${k}" type="number" inputmode="decimal" step="0.01" value="${fill[k] ?? b[k] ?? (k === "fin" ? (b.ifm ?? "") : "")}"></div>`).join("")}</div>
    <button class="btn" id="b-save">Enregistrer le bulletin (scellé)</button></details>`;
}

function compareCard(P) {
  if (P.cmp.verdict === "incomplet") return "";
  return `<div class="card"><h3>Ligne par ligne</h3><div class="scroll-x"><table class="calc cmp"><tr><th>Ligne</th><th class="r">Attendu</th><th class="r">Reçu</th><th class="r">Écart</th></tr>
    ${P.cmp.lines
      .filter((l) => l.recu != null)
      .map(
        (l) =>
          `<tr><td>${esc(l.label)}<span class="art">${l.regle === "saisie" ? "montant saisi" : "art. " + l.regle}</span></td><td class="r num">${fmtEur(l.attendu)}</td><td class="r num">${fmtEur(l.recu)}</td><td class="r num ${l.ecart > 0.004 ? "ecart-pos" : l.ecart < -0.004 ? "ecart-neg" : ""}">${l.ecart > 0 ? "+" : ""}${fmtEur(l.ecart)}</td></tr>`,
      )
      .join("")}
    <tr class="tot"><td>Total</td><td></td><td></td><td class="r num ${P.cmp.total > 0 ? "ecart-pos" : ""}">${P.cmp.total > 0 ? "+" : ""}${fmtEur(P.cmp.total)}</td></tr></table></div>
    ${P.cmp.ecartHeures ? `<p class="note">Heures : ${String(Math.round(P.cmp.heuresPointees * 100) / 100).replace(".", ",")} h pointées contre ${String(P.cmp.heuresPayees).replace(".", ",")} h payées (écart ${String(P.cmp.ecartHeures).replace(".", ",")} h).</p>` : ""}
    <p class="small muted">Écart positif = somme qui vous manque. Estimation, à vérifier. Ce n'est pas un conseil juridique.</p></div>`;
}

export default {
  id: "paie",
  label: "Ma paie",
  render(ctx, el) {
    const R = currentCompute(ctx);
    if (!R) {
      el.innerHTML = `${verifCard(null, parisDate(nowIso()).slice(0, 7))}
        <button class="btn" id="go">Ajouter mon contrat à la main</button>`;
      el.querySelector("#go").onclick = () => ctx.go("contrat");
      bindVerif(ctx, el, null, parisDate(nowIso()).slice(0, 7));
      return;
    }
    const { P, months, periode, cur } = R;
    const c = P.contrat;
    const pres = prescriptionInfo(P.firstDay, parisDate(nowIso()));
    const opts = [...new Set([...months, cur])].sort().reverse();
    el.innerHTML = `${contratSelect(ctx)}
      <div class="row" style="margin-bottom:.8rem"><select id="per" class="grow">${opts.map((m) => `<option value="${m}" ${m === periode ? "selected" : ""}>${fmtMois(m)}</option>`).join("")}<option value="contrat" ${periode === "contrat" ? "selected" : ""}>Toute la durée du contrat</option></select></div>
      ${verifCard(c, periode === "contrat" ? cur : periode)}
      ${resumeCard(ctx, P, periode, periode === cur)}
      ${P.cmp.verdict === "doit" ? hero(P) : ""}
      ${forecast(ctx, P, periode === cur)}
      <details class="card"><summary><h3>Mes heures, semaine par semaine</h3></summary>${bars(P)}
        ${P.weeks.some((w) => w.flags.includes("tiers")) ? `<p class="note">⚠ Une semaine dépasse le tiers de votre durée de contrat (limite des heures complémentaires, L3123-20).</p>` : ""}
        ${P.weeks.some((w) => w.flags.includes("legale")) ? `<p class="note">⚠ Une semaine atteint 35 h alors que vous êtes à temps partiel (L3123-9).</p>` : ""}</details>
      <details class="card"><summary><h3>Calcul ligne par ligne</h3></summary>
        <table class="calc">${P.exp.lines
          .filter((l) => l.montant || ["base", "hs1"].includes(l.key))
          .map(
            (l) =>
              `<tr><td>${esc(l.label)}<span class="art">${esc(l.detail)}${l.regle !== "saisie" ? " · art. " + l.regle : ""}</span></td><td class="r num">${fmtEur(l.montant)}</td></tr>`,
          )
          .join("")}
        ${P.egalite > 0 ? `<tr><td>Égalité de salaire<span class="art">taux de référence ${fmtEur(c.tauxRef)} saisi · art. L1251-18</span></td><td class="r num">+${fmtEur(P.egalite)}</td></tr>` : ""}
        <tr class="tot"><td>Total attendu</td><td class="r num">${fmtEur(round2(P.exp.total + P.egalite))}</td></tr></table>
        ${TYPES[c.type].fin ? `<label class="check"><input type="checkbox" id="avecfin" ${P.avecFin ? "checked" : ""}><span>Inclure les indemnités de fin (${c.type === "interim" ? "IFM + ICCP" : "précarité + ICCP"}) sur cette période${c.fin ? "" : " — le contrat n'est pas encore terminé"}</span></label>` : ""}
        <p class="small muted">Minimum légal estimé avec les seules règles vérifiées (voir l'onglet Contrat pour les taux). Votre convention peut prévoir plus. <b>Estimation, à vérifier.</b></p>
        ${
          P.anomalies.filter((a) => !a.msg.startsWith("Pointage en cours")).length
            ? `<p class="note">${P.anomalies
                .filter((a) => !a.msg.startsWith("Pointage en cours"))
                .map((a) => esc(a.msg))
                .join("<br>")}</p>`
            : ""
        }
        ${pres && pres.horsDelai ? `<p class="note bad">Une partie de cette période a plus de 3 ans : délai de prescription des salaires (L3245-1) peut-être dépassé.</p>` : ""}</details>
      ${bulletinCard(P)}
      ${compareCard(P)}
      ${primesCard(P)}
      ${P.cmp.verdict === "doit" ? `<button class="btn primary" id="go-rec">Préparer ma réclamation →</button>` : ""}`;
    bindContratSelect(ctx, el);
    animate(el.querySelector("#hero-amt"), P.cmp.verdict === "doit" ? P.cmp.total : round2(P.exp.total + P.egalite));
    el.querySelector("#per").onchange = (e) => {
      ui.periode = e.target.value;
      ui.avecFin = null;
      ctx.go("paie");
    };
    const af = el.querySelector("#avecfin");
    if (af) {
      af.onchange = () => {
        ui.avecFin = af.checked;
        ctx.go("paie");
      };
    }
    const g = el.querySelector("#go-rec");
    if (g) g.onclick = () => ctx.go("reclamer");
    el.querySelector("#n-save").onclick = async () => {
      const v = (id) => el.querySelector(id).value;
      await ctx.setMeta("netOpts", {
        tauxPAS: v("#n-pas") === "" ? 0 : Number(v("#n-pas")),
        mutuelle: v("#n-mut") === "" ? 0 : Number(v("#n-mut")),
        cadre: el.querySelector("#n-cadre").checked,
        alsaceMoselle: el.querySelector("#n-am").checked,
        hsExoImpot: el.querySelector("#n-hs").checked,
      });
      ctx.toast("Réglages enregistrés sur ce téléphone.");
      ctx.go("paie");
    };
    bindVerif(ctx, el, c, periode === "contrat" ? cur : periode);
    el.querySelector("#b-save").onclick = async () => {
      const data = { contratId: c.id, periode };
      el.querySelectorAll('[id^="b-"]').forEach((i) => {
        if (i.tagName === "INPUT" && i.value !== "") data[i.id.slice(2)] = Number(i.value);
      });
      await ctx.append("bulletin", data);
      bimp.fill = null;
      bimp.raw = "";
      ctx.toast("Bulletin scellé.");
      ctx.refresh();
    };
    el.querySelector("#p-add").onclick = async () => {
      const lib = el.querySelector("#p-lib").value.trim(),
        mt = el.querySelector("#p-mt").value;
      if (!lib || mt === "") return ctx.toast("Libellé et montant, chef.", true);
      const d = el.querySelector("#p-d").value || (periode === "contrat" ? parisDate(nowIso()) : periode + "-01");
      await ctx.append("prime", {
        contratId: c.id,
        libelle: lib,
        montant: Number(mt),
        jours: Number(el.querySelector("#p-j").value || 1),
        base: el.querySelector("#p-base").checked,
        date: d,
      });
      ctx.toast("Prime scellée.");
      ctx.refresh();
    };
  },
};
