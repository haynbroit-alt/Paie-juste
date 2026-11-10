/** Contrôles statiques : CSP, cache du service worker, empreintes des bibliothèques vendored. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name === "SHA256SUMS") continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function runSecurity(t) {
  console.log("=== 21. CSP, service worker, intégrité des fichiers vendor ===");
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  const csp = html.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/);
  t(!!csp, "meta Content-Security-Policy présente");
  if (csp) {
    const policy = csp[1];
    t(policy.includes("default-src 'self'"), "default-src 'self'");
    t(policy.includes("connect-src 'self'"), "connect-src 'self' : pas d'appel réseau externe");
    t(policy.includes("object-src 'none'") && policy.includes("base-uri 'self'"), "objets et base URI limités");
    t(!/https?:\/\//.test(policy), "la CSP n'autorise aucun hôte distant");
    t(policy.includes("script-src 'self'"), "scripts limités à l'origine");
  }
  const sw = readFileSync(path.join(root, "sw.js"), "utf8");
  t(/const VERSION = "paie-juste-v[\d.]+"/.test(sw), "cache du service worker versionné");
  t(sw.includes("skipWaiting") && sw.includes("clients.claim"), "mise à jour : skipWaiting et claim");
  t(sw.includes("k !== VERSION") && sw.includes("caches.delete"), "les caches d'une autre version sont supprimés");
  t(!/https?:\/\//.test(sw), "le service worker ne cite aucune URL externe");

  const listed = new Map();
  for (const line of readFileSync(path.join(root, "vendor/SHA256SUMS"), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const [hash, file] = line.split(/\s+/);
    listed.set(file, hash);
  }
  const files = walk(path.join(root, "vendor")).map((p) => path.relative(root, p).split(path.sep).join("/"));
  t(files.length === listed.size, `empreintes vendor : ${files.length} fichiers listés`);
  let same = true;
  for (const file of files) {
    const hash = createHash("sha256")
      .update(readFileSync(path.join(root, file)))
      .digest("hex");
    if (listed.get(file) !== hash) same = false;
  }
  t(same && [...listed.keys()].every((f) => files.includes(f)), "chaque fichier vendor correspond à son SHA-256");
}
