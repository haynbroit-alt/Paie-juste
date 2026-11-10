# Journal des changements

## 0.1.1 — 2026-11-10

Durcissement, sans changement des montants de paie.

- Tests supplémentaires sur les règles (temps partiel, frontières de mois, majorations, IFM, ICCP, arrondi, entrées vides).
- Couverture mesurée sur `js/calc.js`, `js/compute.js` et `js/contrat-parse.js`.
- ESLint, Prettier et vérification de types (`tsc --noEmit`) sur le moteur.
- Content-Security-Policy, empreintes SHA-256 des bibliothèques embarquées, test du renouvellement du cache du service worker.
- Contraste, débordements à 390 px, Lighthouse mobile.
- Documentation : architecture, sécurité, correspondance règles / tests.

## 0.1.0 — 2026-11-10

Première publication. Pointeuse, estimation de paie, comparaison au bulletin, brouillon de réclamation. Hors ligne, sans compte, licence MIT.
