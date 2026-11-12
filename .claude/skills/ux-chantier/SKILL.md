---
name: ux-chantier
description: Concevoir ou modifier un écran de Paie Juste pour un ouvrier sur téléphone Android (Chrome), non développeur. À utiliser pour toute modification d'interface (js/modules/*.js, css/app.css, index.html) ou de texte affiché.
---

# Interface « chantier »

La personne note ses heures en fin de journée, fatiguée, parfois avec des gants. Elle veut savoir en un coup d'œil si sa paie est juste.

## Ce que le propriétaire a demandé (à respecter)

- **Pas d'informations inutiles.** Un écran = une action principale. Pas de paragraphe d'explication : un libellé court suffit. Le détail va dans un bloc repliable.
- **Pas de chronomètre ni de pointage en direct.** On déclare la journée : arrivée, départ, pause, total, un bouton.
- **« Comme d'habitude » en un geste** quand des horaires habituels existent.
- **Heures en 24 h** avec des listes (heure, minutes de 5 en 5), jamais le sélecteur natif (AM/PM selon le téléphone). Jours en français (« Aujourd'hui », « Hier »).
- **Look clair et simple** : fond blanc, texte foncé, jaune réservé aux boutons principaux (`--jaune`) ; `--amber` foncé pour le texte.
- **Un seul bouton pour les papiers** : `boutonDocument()` (`js/modules/document.js`), photo ou PDF, plusieurs pages. L'appli devine fiche de paie ou contrat (`js/document-type.js`) et demande en cas de doute. Ne pas recréer de bouton d'import séparé.
- **Ma paie** commence par « En bref » : heures, heures sup, brut, net à recevoir, état du bulletin.

## Règles de conception

- Cibles tactiles de 48 px minimum, bouton principal de 64 à 88 px.
- Largeur testée à 390 px, sans défilement horizontal (vérifié par `tests/browser.mjs`).
- Contraste AA, vérifié par Lighthouse en CI (`lighthouserc.json`).
- Chiffres en `class="num"`, montants avec `fmtEur`, durées avec `fmtH`.
- Messages d'erreur : ce qui ne va pas et quoi faire, en une phrase.
- Toute action qui modifie le journal se confirme par un toast court ; toute suppression demande un motif.

## Vérifier

- Lancer `tests/browser.mjs`, puis **regarder** les captures de l'écran modifié dans `captures/` (une capture vue vaut mieux qu'un test vert).
- Ne committer que les captures des écrans changés, compressées.
