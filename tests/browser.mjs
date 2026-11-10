/** Tests dans Chrome headless (puppeteer-core) + captures 390×844. Usage : node browser.mjs [url] */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
const BASE = process.argv[2] || "http://127.0.0.1:8781/";
const OUT = process.env.PJ_CAPTURES
  ? path.resolve(process.env.PJ_CAPTURES)
  : path.resolve(new URL(".", import.meta.url).pathname, "../captures");
const FIX = path.resolve(new URL(".", import.meta.url).pathname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });
let ok = 0,
  ko = 0;
const t = (c, m) => (c ? (ok++, console.log("  OK   " + m)) : (ko++, console.error("  FAIL " + m)));
const chromeCandidates = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/local/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const executablePath = chromeCandidates.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error("Chrome introuvable. Installez google-chrome ou définissez CHROME_PATH.");
  process.exit(1);
}
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--lang=fr-FR"],
});
const errors = [];
const external = [];
async function newPage() {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.emulateTimezone("Europe/Paris");
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("request", (r) => {
    const u = new URL(r.url());
    if (!["127.0.0.1", "localhost"].includes(u.hostname) && !["data:", "blob:", "file:"].includes(u.protocol))
      external.push(r.url());
  });
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (p, sel) => p.$eval(sel, (e) => e.innerText);
const click = async (p, sel) => {
  await p.$eval(sel, (e) => e.click());
  await wait(350);
};

// 1. Parcours réel : contrat → pointages → correction → paie
console.log("=== Parcours réel (base vide) ===");
{
  const p = await newPage();
  await p.goto(BASE + "?nosw", { waitUntil: "networkidle0" });
  t((await txt(p, "main")).includes("Bienvenue"), "écran d'accueil sans contrat");
  await click(p, "#go-c");
  await p.select("#f-type", "cdi");
  await wait(300);
  await p.type("#f-taux", "12");
  await p.type("#f-employeur", "Test SARL");
  await click(p, "#f-save");
  await wait(500);
  await p.evaluate(() => window.__pj.go("pointer"));
  await wait(300);
  t(
    !(await p.$("#b-main")) && !(await p.$("#gps")) && !(await p.$(".clock")),
    "plus de chronomètre, de bouton Début ni de GPS",
  );
  await p.select("#j-debut-h", "07");
  await p.select("#j-debut-m", "30");
  await p.select("#j-fin-h", "16");
  await p.select("#j-fin-m", "30");
  await p.select("#j-pause", "60");
  t((await txt(p, "#j-total")).replace(/\s/g, "") === "8h00", "total travaillé : " + (await txt(p, "#j-total")));
  await click(p, "#j-ok");
  await wait(900);
  const types = async () => p.evaluate(async () => (await window.__pj.store.all()).map((x) => x.type).join(","));
  t(
    (await types()) === "genesis,contrat,punch,punch,punch,punch",
    "journée scellée en 4 pointages : " + (await types()),
  );
  t(!!(await p.$("#j-modif")), "journée notée : résumé avec bouton Modifier");
  t((await txt(p, "#s-total")).replace(/\s/g, "") === "8h00", "Ma semaine : total " + (await txt(p, "#s-total")));
  await click(p, "#j-modif");
  await wait(300);
  await p.select("#j-fin-h", "17");
  await p.select("#j-fin-m", "00");
  await click(p, "#j-ok");
  await wait(500);
  t((await types()) === "genesis,contrat,punch,punch,punch,punch", "modification sans motif refusée");
  await p.type("#j-motif", "parti à 17 h");
  await click(p, "#j-ok");
  await wait(1200);
  t((await txt(p, "#s-total")).replace(/\s/g, "") === "8h30", "après modification : " + (await txt(p, "#s-total")));
  await p.$eval("#historique", (d) => (d.open = true));
  const hist = await txt(p, "#historique");
  t(hist.includes("modifiée") && hist.includes("parti à 17 h"), "historique : journée « modifiée » avec le motif");
  t((await txt(p, "#seal-pill")).includes("✓"), "chaîne intacte : " + (await txt(p, "#seal-pill")));
  const v = await types();
  t(
    v === "genesis,contrat,punch,punch,punch,punch,correction,correction,correction,correction,punch,punch,punch,punch",
    "journal append-only (l'ancienne version reste) : " + v,
  );
  // falsification dans IndexedDB → détectée
  const broken = await p.evaluate(async () => {
    const s = window.__pj.store;
    const all = await s.all();
    const rec = { ...all[2], data: { ...all[2].data, at: "2020-01-01T00:00:00.000Z" } };
    await new Promise((res) => {
      const tx = s.db.transaction("records", "readwrite");
      tx.objectStore("records").put(rec);
      tx.oncomplete = res;
    });
    s._cache = null;
    await window.__pj.refresh();
    return document.querySelector("#seal-pill").innerText;
  });
  t(broken.includes("rompue"), "falsification détectée : " + broken);
  await p.close();
}

// 2. Démo + captures
console.log("=== Mode EXEMPLE + captures ===");
const shots = {};
for (const [tab, file] of [
  ["pointer", "1-pointer"],
  ["paie", "2-ma-paie"],
  ["reclamer", "3-reclamer"],
  ["contrat", "4-contrat"],
]) {
  const p = await newPage();
  await p.goto(BASE + `?nosw&exemple=1&onglet=${tab}`, { waitUntil: "networkidle0" });
  await wait(1200);
  t(await p.$eval("body", (b) => b.classList.contains("demo")), `${tab} : bandeau EXEMPLE`);
  await p.screenshot({ path: `${OUT}/${file}.png` });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  t(sw <= 390, `${tab} : pas de débordement horizontal à 390 px (scrollWidth ${sw})`);
  await p.screenshot({ path: `${OUT}/${file}-page-entiere.png`, fullPage: true });
  if (tab === "paie") {
    await p.evaluate(() => document.querySelector("#net-decompte").scrollIntoView({ block: "center" }));
    await wait(300);
    await p.screenshot({ path: `${OUT}/2c-ma-paie-net-verse.png` });
  }
  shots[tab] = await txt(p, "main");
  await p.close();
}
{
  const p = await newPage();
  await p.goto(
    BASE +
      "?nosw&exemple=1&onglet=paie&periode=" +
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" })
        .format(new Date())
        .slice(0, 7),
    { waitUntil: "networkidle0" },
  );
  await wait(1200);
  const m = await txt(p, "main");
  t(m.includes("Ce que vous allez toucher ce mois"), "Ma paie (mois en cours) : prévision brut → net");
  t(!m.includes("vous doit"), "sans bulletin du mois : pas de « vous doit »");
  await p.screenshot({ path: `${OUT}/2b-ma-paie-prevision-mois.png` });
  await p.close();
}
t(
  shots.paie.includes("L'agence vous doit") && shots.paie.includes("382,60"),
  "Ma paie : « L'agence vous doit 382,60 € »",
);
t(shots.paie.includes("estimation"), "Ma paie : mention estimation");
t(
  /\+ Indemnités non soumises[\s\S]*Panier[\s\S]*\+220,00 €[\s\S]*= Net versé\s+2 651,98 €/.test(shots.paie),
  "Ma paie : ligne « + indemnités non soumises » visible entre net avant impôt et net versé",
);
t(
  /Net avant impôt\s+2 431,98 €/.test(shots.paie) && shots.paie.includes("2 989,31 €"),
  "Ma paie : net avant impôt 2 431,98 € et brut 2 989,31 €",
);
t(
  shots.reclamer.includes("pas un conseil juridique") || shots.reclamer.includes("n'est pas un conseil juridique"),
  "Réclamer : mention pas un conseil juridique",
);
t(
  shots.reclamer.includes("0 806 000 126") && shots.reclamer.includes("9 rue de Tarragone"),
  "Réclamer : contacts vérifiés",
);
t(shots.contrat.includes("Intérim") && shots.contrat.includes("EXEMPLE"), "Contrat : fiche exemple");
t(
  shots.pointer.includes("Ma journée") && shots.pointer.includes("Ma semaine"),
  "Mes heures : journée et semaine affichées",
);

// 2 bis. Autre jour, rappels, accès au salaire
console.log("=== Mes heures : autre jour et rappels ===");
{
  const p = await newPage();
  await p.goto(BASE + "?nosw", { waitUntil: "networkidle0" });
  await click(p, "#go-c");
  await p.select("#f-type", "cdi");
  await wait(300);
  await p.type("#f-taux", "12");
  await p.type("#f-employeur", "Journée SARL");
  await click(p, "#f-save");
  await wait(500);
  await p.evaluate(() => window.__pj.go("pointer"));
  await wait(300);
  const hier = await p.evaluate(() =>
    new Date(Date.now() - 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }),
  );
  await p.select("#j-date", hier);
  await wait(400);
  t((await p.$eval("#j-date", (s) => s.value)) === hier, "choix du jour : hier");
  t((await p.$eval("#j-date", (s) => s.options[1].text)) === "Hier", "liste des jours en français (« Hier »)");
  await click(p, "#j-ok");
  await wait(900);
  t(!!(await p.$("#j-modif")), "hier noté");
  const href = await p.$eval("#r-soir", (a) => a.href);
  t(href.startsWith("https://calendar.google.com/") && href.includes("FREQ%3DWEEKLY"), "lien de rappel Google Agenda");
  await click(p, "#j-autre");
  await wait(400);
  t((await p.$eval("#j-date", (s) => s.value)) !== hier, "« Noter un autre jour » propose un jour libre");
  t(!!(await p.$("#j-vite")), "bouton « comme d'habitude » proposé");
  await click(p, "#j-vite");
  await wait(900);
  t(!!(await p.$("#j-modif")), "un seul geste : journée enregistrée avec les horaires habituels");
  t((await txt(p, "#s-total")).replace(/\s/g, "").length > 0, "semaine mise à jour : " + (await txt(p, "#s-total")));
  await p.screenshot({ path: `${OUT}/1b-ma-journee.png`, fullPage: true });
  await click(p, "#go-paie");
  await wait(500);
  t(!!(await p.$(".forecast")), "bouton « détail de mon salaire » → onglet Ma paie");
  const res = await txt(p, "#resume");
  t(
    res.includes("Heures travaillées") && res.includes("Net à recevoir") && res.includes("Mon bulletin"),
    "Ma paie : résumé en clair",
  );
}

// 3. Mise en demeure + impression
{
  const p = await newPage();
  await p.goto(BASE + "?nosw&exemple=1&onglet=reclamer", { waitUntil: "networkidle0" });
  await wait(800);
  await click(p, '[data-t="med"]');
  const paper = await txt(p, "#paper");
  t(
    paper.includes("mise en demeure") && paper.includes("L1251-32") && paper.includes("382,60"),
    "mise en demeure chiffrée avec articles",
  );
  await click(p, '[data-t="rgpd"]');
  const rgpd = await txt(p, "#paper");
  t(
    rgpd.includes("article 15") && rgpd.includes("un mois") && !rgpd.includes("restant dû"),
    "demande d’accès RGPD affichée, sans montant réclamé",
  );
  await click(p, '[data-t="med"]');
  await wait(700);
  await p.screenshot({ path: `${OUT}/3b-mise-en-demeure.png` });
  await p.evaluate(() => {
    window.print = () => {};
  });
  await click(p, "#r-print");
  const pa = await p.$eval("#print-area", (e) => e.innerText);
  t(pa.includes("ANNEXE") && pa.includes("SHA-256"), "impression : courrier + annexe relevé scellé");
  await p.emulateMediaType("print");
  await p.pdf({
    path: `${OUT}/exemple-mise-en-demeure.pdf`,
    format: "A4",
    margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  });
  await p.close();
}

// 4. Import automatique de contrat : PDF texte (pdf.js) et photo (OCR)
console.log("=== Import de contrat (local) ===");
{
  const gen = await newPage();
  await gen.goto("file://" + FIX + "/contrat-texte.html");
  await gen.pdf({ path: FIX + "/contrat-texte.pdf", format: "A4" });
  await gen.close();
  const p = await newPage();
  await p.goto(BASE + "?nosw&onglet=contrat", { waitUntil: "networkidle0" });
  await wait(500);
  let input = await p.$("#imp-file");
  await input.uploadFile(FIX + "/contrat-texte.pdf");
  await p.waitForSelector("#imp-apply", { timeout: 30000 }).catch(() => {});
  let body = await txt(p, "main");
  t(
    body.includes("13,80") && body.includes("Intérim Exemple Sud") && body.includes("39"),
    "PDF : taux, agence, 39 h proposés",
  );
  await wait(700);
  await p.screenshot({ path: `${OUT}/4b-contrat-import-pdf.png`, fullPage: false });
  await click(p, "#imp-apply");
  t((await p.$eval("#f-taux", (e) => e.value)) === "13.8", "PDF : formulaire pré-rempli, à valider");
  // photo
  const t0 = Date.now();
  input = await p.$("#imp-file");
  await input.uploadFile(FIX + "/contrat-photo.png");
  await p.waitForSelector("#imp-apply", { timeout: 120000 }).catch(() => {});
  body = await txt(p, "main");
  const ocrOk = body.includes("13,20") && /Menuiserie/i.test(body);
  t(ocrOk, `photo (OCR fra local, ${Math.round((Date.now() - t0) / 1000)} s) : taux 13,20 et employeur reconnus`);
  if (!ocrOk) console.log(body.slice(0, 1500));
  t((body.match(/CDD/) || []).length > 0, "photo : type CDD reconnu");
  await wait(700);
  await p.screenshot({ path: `${OUT}/4c-contrat-import-photo.png` });
  await p.close();
}

console.log("=== Photo du bulletin de paie (OCR local) ===");
{
  const gen = await newPage();
  await gen.setViewport({ width: 1000, height: 640 });
  await gen.goto("file://" + FIX + "/bulletin.html");
  await gen.screenshot({ path: FIX + "/bulletin-photo.png" });
  await gen.close();
  const p = await newPage();
  await p.goto(BASE + "?nosw&exemple=1&onglet=paie", { waitUntil: "networkidle0" });
  await wait(600);
  const input = await p.$("#bi-file");
  t(!!input, "Ma paie : bouton « Photo ou PDF de ma fiche de paie »");
  const t0 = Date.now();
  await input.uploadFile(FIX + "/bulletin-photo.png");
  await p.waitForSelector("#bi-apply", { timeout: 120000 }).catch(() => {});
  const body = await txt(p, "#bulletin");
  const ok = body.includes("1 823,07") && body.includes("220,56");
  t(ok, `photo du bulletin (OCR, ${Math.round((Date.now() - t0) / 1000)} s) : salaire de base et IFM lus`);
  if (!ok) console.log(body.slice(0, 1200));
  await p.evaluate(() => document.querySelector("#bulletin").scrollIntoView({ block: "start" }));
  await wait(900);
  await p.screenshot({ path: `${OUT}/2d-ma-paie-photo-bulletin.png` });
  await click(p, "#bi-apply");
  await wait(600);
  t((await p.$eval("#b-base", (e) => e.value)) === "1823.07", "formulaire du bulletin pré-rempli, à valider");
  await p.close();
}

console.log("=== Service worker et manifeste (sous-chemin) ===");
{
  const p = await newPage();
  const basePath = (() => {
    const u = new URL(BASE);
    return u.pathname.endsWith("/") ? u.pathname : u.pathname + "/";
  })();
  await p.goto(BASE, { waitUntil: "load" });
  let info = null;
  try {
    info = await p.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]').href;
      const manRes = await fetch(link);
      const manifest = await manRes.json();
      const abs = (u) => new URL(u, link).href;
      const iconChecks = [];
      for (const ic of manifest.icons) {
        const r = await fetch(abs(ic.src));
        iconChecks.push({ status: r.status });
      }
      let swError = null;
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        try {
          reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
        } catch (e) {
          swError = String(e && (e.message || e));
        }
      }
      let scope = null,
        script = null;
      if (!swError) {
        try {
          const ready = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, rej) => setTimeout(() => rej(new Error("service worker inactif après 20 s")), 20000)),
          ]);
          scope = ready.scope;
          script = ready.active && ready.active.scriptURL;
        } catch (e) {
          swError = String(e && (e.message || e));
        }
      }
      return {
        manifestStatus: manRes.status,
        start: abs(manifest.start_url || "./"),
        scopeUrl: abs(manifest.scope || "./"),
        iconChecks,
        swError,
        scope,
        script,
      };
    });
  } catch (e) {
    t(false, "service worker / manifeste : " + e);
  }
  if (info) {
    t(info.manifestStatus === 200, "manifest.json chargé");
    t(new URL(info.start).pathname.startsWith(basePath), "start_url dans le dossier de l'appli : " + info.start);
    t(new URL(info.scopeUrl).pathname === basePath, "scope du manifeste = dossier de l'appli : " + info.scopeUrl);
    t(!info.swError, "service worker enregistré" + (info.swError ? " : " + info.swError : ""));
    if (info.scope) t(new URL(info.scope).pathname === basePath, "scope du service worker : " + info.scope);
    if (info.script)
      t(new URL(info.script).pathname === basePath + "sw.js", "script du service worker : " + info.script);
    t(info.iconChecks.length >= 2 && info.iconChecks.every((i) => i.status === 200), "icônes du manifeste accessibles");
  }
  await p.close();
}
{
  const fresh = await newPage();
  await fresh.goto(BASE + (BASE.includes("?") ? "&" : "?") + "nosw", { waitUntil: "load" });
  const updated = await fresh.evaluate(async () => {
    const staleName = "paie-juste-v0-test-stale";
    const stale = await caches.open(staleName);
    await stale.put(new Request(new URL("./stale-test", location.href)), new Response("stale"));
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
    let keys = await caches.keys();
    const start = Date.now();
    while (keys.includes(staleName) && Date.now() - start < 3000) {
      await new Promise((r) => setTimeout(r, 50));
      keys = await caches.keys();
    }
    const hit = await caches.match(new URL("./index.html", location.href).href);
    return { keys, hasIndex: !!hit };
  });
  t(updated && !updated.keys.includes("paie-juste-v0-test-stale"), "activation : ancien cache supprimé");
  t(
    updated && updated.keys.some((k) => k.startsWith("paie-juste-v")),
    "cache versionné : " + (updated ? updated.keys.join(", ") : ""),
  );
  t(updated && updated.hasIndex, "précache : index.html présent après installation");
  await fresh.close();
}
{
  const live = await browser.newPage();
  await live.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await live.goto(BASE, { waitUntil: "load" });
  await live.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await live.createCDPSession();
  const inst = await cdp
    .send("Page.getInstallabilityErrors")
    .catch((e) => ({ installabilityErrors: [{ errorId: String(e) }] }));
  const installErrors = inst.installabilityErrors || [];
  t(
    installErrors.length === 0,
    "PWA installable" + (installErrors.length ? " : " + JSON.stringify(installErrors) : ""),
  );
  await live.close();
}

t(external.length === 0, "aucune requête hors de l'appli" + (external.length ? " : " + external.join(", ") : ""));
t(errors.length === 0, "aucune erreur JavaScript" + (errors.length ? " : " + errors.slice(0, 5).join(" | ") : ""));
await browser.close();
console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
