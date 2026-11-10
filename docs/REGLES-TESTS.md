# Règles et tests

Les montants viennent de `js/calc.js` et `js/compute.js`. Les tests historiques sont dans `tests/run.mjs` (sections 1 à 13). Les cas ajoutés en 0.1.1 sont dans `tests/rules.mjs` (sections 14 à 20). Aucune formule n'a été modifiée pour les faire passer.

| Règle                                                 | Source                          | Test                                                |
| ----------------------------------------------------- | ------------------------------- | --------------------------------------------------- |
| IFM 10 % du brut                                      | L1251-32, service-public F11215 | `run.mjs` §1 ; `rules.mjs` §14 et §17               |
| IFM à 0 selon le motif                                | L1251-33, L1251-32              | `rules.mjs` §17 (motifs d'exclusion)                |
| ICCP 10 % du brut + IFM                               | L1251-19, F11215                | `run.mjs` §1 ; `rules.mjs` §14                      |
| ICCP intérim même si les congés sont cochés           | L1251-19                        | `rules.mjs` §19                                     |
| Durée légale 35 h                                     | L3121-27                        | `run.mjs` §1 ; propriété §20                        |
| Semaine du lundi au dimanche, heure de Paris          | L3121-29, L3121-35              | `run.mjs` §3 et §11 ; `rules.mjs` §16               |
| Heures sup +25 % puis +50 %                           | L3121-36, F2391                 | `run.mjs` §1 et §2 ; `rules.mjs` §14                |
| Taux d'heures sup modifiable                          | L3121-33                        | `rules.mjs` §15 (+10 %)                             |
| Égalité avec le taux de référence saisi               | L1251-18                        | `run.mjs` §9 ; `rules.mjs` §17                      |
| Prescription 3 ans                                    | L3245-1                         | `run.mjs` §11 ; `rules.mjs` §19 (29 février)        |
| Bulletin sans réserve ne vaut pas renonciation        | L3243-3                         | phrase dans `letters.js`, courrier §9               |
| Preuve des heures                                     | L3171-4                         | chaîne `run.mjs` §8 ; annexe du courrier            |
| Précarité CDD 10 %, taux 6 % possible                 | L1243-8, F40                    | `run.mjs` §6                                        |
| Précarité non due                                     | L1243-10                        | `run.mjs` §6 ; `rules.mjs` §17                      |
| ICCP CDD 10 %, hors précarité par défaut              | L1242-16                        | `run.mjs` §6 ; option incluse `rules.mjs` §17       |
| Congés pris : ICCP CDD à 0                            | L1242-16                        | `rules.mjs` §17                                     |
| CDI : pas d'indemnité de fin                          | —                               | `run.mjs` §4 ; `rules.mjs` §15                      |
| Temps partiel et heures complémentaires +10 % / +25 % | L3123-1, L3123-29               | `run.mjs` §4 ; au-delà de 35 h `rules.mjs` §14      |
| Alerte au-delà du tiers ou de 35 h                    | L3123-20, L3123-9               | `run.mjs` §4 ; `rules.mjs` §14                      |
| Mensualisation 52/12                                  | L3242-1                         | `run.mjs` §5 ; projection mensuelle `rules.mjs` §20 |
| Cotisations 2026 et contrôle SMIC                     | F2302, F2301                    | `run.mjs` §7                                        |
| Réduction 11,31 % sur les heures sup seulement        | F2391                           | `run.mjs` §12 ; `rules.mjs` §18                     |
| Heures complémentaires : pas de réduction             | INCONNU, non appliquée          | `rules.mjs` §18                                     |
| Plafond 4 005 €, tranche 2, APEC, Alsace-Moselle      | F2302, URSSAF                   | `rules.mjs` §18                                     |
| Prélèvement à la source saisi                         | bulletin / impots.gouv          | `run.mjs` §7                                        |
| Seuil d'écart 1 €                                     | choix d'affichage               | `run.mjs` §10 ; pile à 1,00 € `rules.mjs` §19       |
| Arrondi au centime                                    | formule de `regles.md` §6       | `rules.mjs` §15 et propriété §20                    |
| Prime dans la base IFM ou hors base                   | saisie, `regles.md` §2          | `rules.mjs` §17                                     |
| Minuit et jour de début du créneau                    | limite connue, `regles.md` §6   | `rules.mjs` §16                                     |
| Entrées vides ou taux négatif                         | robustesse                      | `rules.mjs` §15                                     |
| Lecture de contrat                                    | `regles.md` §1 quater           | `run.mjs` §11 ; `rules.mjs` §20                     |
