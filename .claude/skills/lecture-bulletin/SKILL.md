---
name: lecture-bulletin
description: Améliorer la lecture automatique d'un bulletin de paie ou d'un contrat (photo, PDF, texte collé) dans Paie Juste — js/bulletin-parse.js, js/contrat-parse.js, js/importer.js. À utiliser quand un montant ou un champ est mal lu, manquant, ou qu'un nouveau modèle de bulletin doit être reconnu.
---

# Lecture de bulletin et de contrat

La lecture **propose**, la personne **valide**. Elle ne calcule rien et n'enregistre rien seule.

## Règles

- Tout reste sur le téléphone : pdf.js et tesseract.js embarqués dans `vendor/`. Aucun service d'OCR en ligne, aucune IA distante.
- Chaque champ proposé garde son **extrait d'origine** (la ligne lue) : la personne doit pouvoir juger.
- Les lignes de cotisations, cumuls, plafonds et bases sont ignorées (`IGNORE` dans `js/bulletin-parse.js`).
- Le brut et le net lus servent à vérifier, ils ne remplissent pas le formulaire.
- En cas de doute entre deux champs, ne rien proposer plutôt que mal proposer.

## Méthode pour un nouveau modèle de bulletin

1. Obtenir un exemple **anonymisé** : nom, adresse, n° de sécurité sociale, SIRET et employeur remplacés. Ne jamais committer un vrai bulletin.
2. Écrire le texte tel que l'OCR ou pdf.js le rend (une ligne par ligne du bulletin).
3. Ajouter un cas dans `tests/run.mjs` (section « Lecture d'un bulletin ») avec les valeurs attendues lues à l'œil sur le document.
4. Ajuster `REGLES`, `TOTAUX` ou `IGNORE`. L'ordre de `REGLES` compte : le premier motif qui correspond gagne (ex. « prime de panier » = frais, pas prime).
5. Relancer **tous** les cas existants : un nouveau modèle ne doit pas casser les anciens.
6. Pour l'OCR, ajouter ou compléter une fixture HTML dans `tests/fixtures/`, que `tests/browser.mjs` photographie puis lit (comme `bulletin.html`).

## PDF de logiciel de paie

Les cases sont souvent écrites une par une, dans le désordre (colonne par colonne), sans espace. `itemsToLines` (`js/importer.js`) reconstruit les lignes d'après la position : ne jamais revenir à une lecture dans l'ordre du fichier. Tester tout changement avec `tests/fixtures/bulletin-cases.pdf` (généré par `bulletin-cases.py`, modifiable pour reproduire un nouveau modèle).

## Bulletins d'agence d'intérim

- Colonne « Calendrier » en bout de ligne (« M 07 8,00 ») : retirée avant de lire les montants (`CALENDRIER`).
- Page en double (original + copie) : chaque ligne identique ne compte qu'une fois.
- Panier / trajet écrits avant le brut ou « soumis » : salaire (`primes`), pas frais.
- Totaux : le montant est le premier nombre après le mot-clé (« Net à payer » ≠ total employeur).
- Sans contrat, l'intérim se devine (convention, 7820Z, « fin de mission ») : sinon l'IFM n'est pas contrôlée.

## Reconnaître le document

`devinerDocument` (`js/document-type.js`) pèse des mots-clés (« net à payer », « contrat de mission »…). Un nouveau modèle mal reconnu : ajouter un mot-clé et un cas dans la section 30 de `tests/run.mjs`. En cas de doute, renvoyer `null` : l'appli demande.

## Formats de nombres à gérer

`1 823,07` · `1.823,07` · `1823,07` · `1823.07` · espaces insécables · taux à 4 décimales (`12,0200`) · montants négatifs (retenues).

## Interdits

- Envoyer une image ou un texte de bulletin hors du téléphone.
- Remplir et enregistrer sans action de la personne.
