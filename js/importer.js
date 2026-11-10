/** Lecture LOCALE d'un contrat : PDF (pdf.js) ou photo (tesseract.js). Aucun envoi réseau hors de l'appli. */
const abs = (p) => new URL(p, import.meta.url).href;

export async function pdfToText(file, onProgress = () => {}) {
  const pdfjs = await import("../vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = abs("../vendor/pdfjs/pdf.worker.min.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress({ status: "Lecture du PDF", progress: i / doc.numPages });
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let lastY = null;
    for (const it of tc.items) {
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) text += "\n";
      text += it.str + (it.hasEOL ? "\n" : "");
      lastY = y;
    }
    text += "\n";
  }
  return { text, pages: doc.numPages, doc };
}

/** Rend la 1re page d'un PDF scanné en image pour l'OCR. */
export async function pdfPageToBlob(doc, n = 1) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}

let tessLoading = null;
function loadTesseract() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if (!tessLoading) tessLoading = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = abs("../vendor/tesseract/tesseract.min.js");
    s.onload = () => res(globalThis.Tesseract); s.onerror = () => rej(new Error("OCR introuvable dans l'appli"));
    document.head.appendChild(s);
  });
  return tessLoading;
}

export async function imageToText(blob, onProgress = () => {}) {
  const T = await loadTesseract();
  const worker = await T.createWorker("fra", 1, {
    workerPath: abs("../vendor/tesseract/worker.min.js"),
    corePath: abs("../vendor/tesseract/"),
    langPath: abs("../vendor/tesseract/lang"),
    gzip: true, workerBlobURL: false, cacheMethod: "write",
    logger: (m) => onProgress({ status: m.status, progress: m.progress }),
  });
  try { const { data } = await worker.recognize(blob); return { text: data.text, confidence: data.confidence }; }
  finally { await worker.terminate(); }
}
