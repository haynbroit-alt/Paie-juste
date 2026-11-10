# Journal des changements

## 0.1.2 — 2026-11-10

Sans changement des montants de paie.

- Onglet Réclamer : nouveau courrier « ④ Mes données (RGPD) ». Il demande à l'employeur ou à l'agence une copie des relevés d'heures et des éléments de paie (article 15 du RGPD), sans réclamer de montant.
- Nouveau test `npm run test:urssaf` : compare le net de Paie Juste au moteur officiel de l'Urssaf (`modele-social` 11.1.0), à chaque passage de la CI. Ce moteur n'est pas embarqué dans l'application.

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
