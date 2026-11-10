# Journal des changements

## 0.2.0 — 2026-11-10

Plus simple au quotidien. Les montants de paie ne changent pas.

- Pointer : nouvelle carte « Ma journée ». On note le début, la fin et la pause une fois par jour, au lieu de quatre boutons. Les pointages sont scellés comme avant et marqués « journée saisie ».
- Rappel du soir : un lien crée dans Google Agenda un rappel chaque soir de semaine, et un autre le dernier jour du mois pour vérifier la paie. Un fichier .ics est proposé pour les autres agendas. C'est l'agenda du téléphone qui envoie la notification.
- Bandeau après 17 h si rien n'est noté pour aujourd'hui.
- Bouton « Voir le détail de mon salaire du mois » en haut de l'onglet Pointer.

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
