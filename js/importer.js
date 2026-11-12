/** Lecture LOCALE d'un contrat : PDF (pdf.js) ou photo (tesseract.js). Aucun envoi réseau hors de l'appli. */
const abs = (p) => new URL(p, import.meta.url).href;

/**
 * Reconstruit les lignes d'une page d'après la POSITION des textes, pas leur ordre dans le fichier.
 * Les logiciels de paie écrivent souvent chaque case à part, colonne par colonne, sans espace :
 * lus dans l'ordre du fichier, libellés et montants se retrouvent séparés ou collés.
 * @param {Array<{str: string, transform?: number[], width?: number, height?: number}>} items
 */
export function itemsToLines(items) {
  const cells = items
    .filter((it) => it.str && it.str.trim() && it.transform)
    .map((it) => {
      const t = /** @type {number[]} */ (it.transform);
      const h = Math.abs(it.height || t[3] || 10) || 10;
      return { str: it.str, x: t[4], y: t[5], w: it.width || it.str.length * h * 0.5, h };
    });
  // Du haut vers le bas, puis de gauche à droite.
  cells.sort((a, b) => b.y - a.y || a.x - b.x);
  /** @type {Array<{y: number, h: number, cells: typeof cells}>} */
  const rows = [];
  for (const c of cells) {
    const row = rows.find((r) => Math.abs(r.y - c.y) <= Math.max(2, Math.min(r.h, c.h) * 0.45));
    if (row) row.cells.push(c);
    else rows.push({ y: c.y, h: c.h, cells: [c] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.cells.sort((a, b) => a.x - b.x);
    let line = "",
      end = null;
    for (const c of r.cells) {
      if (end != null) {
        const gap = c.x - end;
        // Un nombre déjà complet (avec ses décimales) suivi d'un chiffre : c'est un autre nombre.
        const nombreFini = /\d,\d{2,4}$/.test(line) && /^\d/.test(c.str);
        // Écart d'au moins un tiers de caractère : deux cases différentes, on les sépare.
        if ((gap > c.h * 0.15 || nombreFini) && !/\s$/.test(line) && !/^\s/.test(c.str)) {
          line += gap > c.h * 1.5 ? "   " : " ";
        }
      }
      line += c.str;
      end = c.x + c.w;
    }
    return line.replace(/[ \t]+$/, "");
  });
}

export async function pdfToText(file, onProgress = () => {}) {
  const pdfjs = await import("../vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = abs("../vendor/pdfjs/pdf.worker.min.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false })
    .promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress({ status: "Lecture du PDF", progress: i / doc.numPages });
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    text += itemsToLines(tc.items).join("\n") + "\n";
  }
  return { text, pages: doc.numPages, doc };
}

/** Rend la 1re page d'un PDF scanné en image pour l'OCR. */
export async function pdfPageToBlob(doc, n = 1) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}

let tessLoading = null;
function loadTesseract() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if (!tessLoading) {
    tessLoading = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = abs("../vendor/tesseract/tesseract.min.js");
      s.onload = () => res(globalThis.Tesseract);
      s.onerror = () => rej(new Error("OCR introuvable dans l'appli"));
      document.head.appendChild(s);
    });
  }
  return tessLoading;
}

export async function imageToText(blob, onProgress = () => {}) {
  const T = await loadTesseract();
  const worker = await T.createWorker("fra", 1, {
    workerPath: abs("../vendor/tesseract/worker.min.js"),
    corePath: abs("../vendor/tesseract/"),
    langPath: abs("../vendor/tesseract/lang"),
    gzip: true,
    workerBlobURL: false,
    cacheMethod: "write",
    logger: (m) => onProgress({ status: m.status, progress: m.progress }),
  });
  try {
    const { data } = await worker.recognize(blob);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}

/**
 * Lit un ou plusieurs fichiers (PDF ou photos, plusieurs pages possibles) et renvoie tout le texte.
 * PDF scanné (sans texte) : chaque page passe à l'OCR, jusqu'à 6 pages.
 * @param {File[]} files
 * @param {(m: {status: string, progress: number}) => void} [onProgress]
 */
export async function lireFichiers(files, onProgress = () => {}) {
  const parts = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const n = files.length > 1 ? ` (${i + 1}/${files.length})` : "";
    const prog = (m) => onProgress({ status: (m.status || "") + n, progress: m.progress || 0 });
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      const r = await pdfToText(f, prog);
      if (r.text.replace(/\s/g, "").length >= 40) parts.push(r.text);
      else {
        for (let p = 1; p <= Math.min(r.pages, 6); p++) {
          prog({ status: `PDF scanné : lecture de la page ${p}`, progress: 0 });
          parts.push((await imageToText(await pdfPageToBlob(r.doc, p), prog)).text);
        }
      }
    } else parts.push((await imageToText(f, prog)).text);
  }
  return parts.join("\n");
}
