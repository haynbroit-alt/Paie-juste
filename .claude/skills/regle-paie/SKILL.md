---
name: regle-paie
description: Ajouter, corriger ou vérifier une règle de calcul de paie dans Paie Juste (heures sup, heures complémentaires, IFM, précarité, ICCP, cotisations, brut → net, primes, convention collective). À utiliser dès qu'un montant calculé par js/calc.js ou js/compute.js peut changer, ou qu'un écart de paie est signalé.
---

# Règle de paie

Un montant faux coûte de l'argent à un salarié, ou fait envoyer une réclamation injustifiée. Une règle n'entre dans le code que **prouvée, sourcée et testée**.

## 1. Prouver avant de coder

- Source **officielle** obligatoire : Code du travail (code.travail.gouv.fr, legifrance.gouv.fr), service-public.gouv.fr, urssaf.fr, texte de la convention (Légifrance KALI). Un blog ou un simulateur privé ne suffit pas seul.
- Citer la phrase exacte et la date de lecture.
- Classer dans `regles.md` : **PROUVÉ** (codé), **INCONNU** (non codé, saisi à la main), **CONFLIT** (sources contradictoires, ne pas coder), **ÉCHEC** (source illisible).
- Si la règle dépend d'une convention ou d'un accord, ne pas en faire un défaut : la proposer en réglage du contrat, à valider par la personne.

## 2. Coder

- Uniquement dans `js/calc.js` (règles pures, sans DOM) ou `js/compute.js` (assemblage d'une période). `// @ts-check` strict : `npm run typecheck` doit passer.
- Taux et plafonds datés dans une constante nommée (comme `COTIS_2026`), jamais un nombre magique dans une formule.
- Arrondi au centime avec `round2` / `cents`, comme le reste du moteur.
- Chaque ligne du calcul attendu garde son `regle` (article) et son `detail` : l'écran « Calcul ligne par ligne » et les courriers les affichent.

## 3. Tester

- Ajouter des cas dans `tests/rules.mjs` (section numérotée) avec des montants **calculés à la main** et écrits en clair, jamais recopiés depuis la sortie du code.
- Couvrir : cas nominal, frontières (35 h, 43 h, plafond, mois et semaine à cheval, minuit, changement d'heure), entrées vides ou négatives.
- Mettre à jour `docs/REGLES-TESTS.md` (règle → source → test).
- Brut → net : `npm run test:urssaf` compare au moteur officiel `modele-social`. Ne jamais élargir une tolérance pour le faire passer : expliquer l'écart dans `docs/ANALYSE-OUTILS.md` ou corriger la règle.
- `npm run coverage` : 90 % minimum sur `calc.js`, `compute.js`, `contrat-parse.js`.

## 4. Signaler le changement

- Si un montant existant change : le dire dans le CHANGELOG (avant / après, sur un exemple chiffré) et dans la description de la PR (case « Si une formule change »).
- Sinon, écrire explicitement « les montants de paie ne changent pas ».

## Interdits

- Inventer un taux, un seuil ou un montant de panier ou de trajet BTP : ils dépendent d'accords régionaux, ils restent saisis à la main.
- Modifier un test existant pour qu'il passe sans justifier par une source.
