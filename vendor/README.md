# Bibliothèques embarquées (aucun CDN)

| Dossier | Bibliothèque | Version | Licence | Origine |
|---|---|---|---|---|
| `pdfjs/` | pdf.js (`pdfjs-dist`, build legacy) | 4.10.38 | Apache-2.0 (`pdfjs/LICENSE`) | npm `pdfjs-dist` |
| `tesseract/tesseract.min.js`, `worker.min.js` | tesseract.js | 5.1.1 | Apache-2.0 (`LICENSE-tesseract.js.md`) | npm `tesseract.js` |
| `tesseract/*.wasm.js` | tesseract.js-core (moteur LSTM, avec et sans SIMD) | 5.1.1 | Apache-2.0 (`tesseract/LICENSE`) | npm `tesseract.js-core` |
| `tesseract/lang/fra.traineddata.gz` | données de langue française (tessdata « best_int ») | 4.0.0 | Apache-2.0 (projet tessdata) | npm `@tesseract.js-data/fra` |

Taille totale ≈ 10 Mo. L'OCR (≈ 8,5 Mo) n'est chargé qu'au premier usage, puis gardé en cache pour fonctionner hors ligne.
