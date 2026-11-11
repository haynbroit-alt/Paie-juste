---
name: courrier-reclamation
description: Créer ou modifier un courrier de Paie Juste (demande amiable, mise en demeure, demande d'accès RGPD, annexe du relevé scellé, contacts d'aide) dans js/letters.js et l'onglet Réclamer. À utiliser pour tout texte destiné à un employeur ou une agence.
---

# Courriers de réclamation

Ce courrier peut être envoyé par un salarié à son employeur. Une erreur peut lui nuire.

## Règles

- **Brouillon seulement.** Rien n'est envoyé : copier, imprimer ou enregistrer en PDF. Jamais d'envoi automatique, jamais d'adresse e-mail pré-remplie vers l'employeur.
- **Chaque article cité** vient de la table `ARTICLES` de `js/letters.js` (titre et lien code.travail.gouv.fr vérifiés). Pour un nouvel article : le lire sur la source, l'ajouter à la table, et le noter dans `regles.md`.
- **Montants** : uniquement ceux calculés par le moteur (`compareBulletin`), jamais retapés dans le texte. Toujours « brut » et « estimation ».
- **Gradation** : amiable (sans menace) → mise en demeure (délai, prud'hommes, avec le conseil de se faire relire avant) → saisine, hors appli.
- Chaque courrier se termine par `NOT_LEGAL_ADVICE`.
- **Contacts d'aide** (`CONTACTS`) : seulement des coordonnées vérifiées sur un annuaire officiel, avec la source et la date. Pas de préférence entre syndicats : ceux non vérifiés ne sont pas listés, et on le dit (`CONTACTS_NOTE`).

## Style

Phrases courtes, vouvoiement, pas de jargon inutile. Les champs inconnus restent entre crochets (`[Votre adresse]`) plutôt qu'inventés.

## Tests

Dans `tests/run.mjs` (section 9) : articles présents, montant correct, pas de menace dans l'amiable, mention « pas un conseil juridique ». Dans `tests/browser.mjs` : le courrier s'affiche dans l'onglet Réclamer et l'impression contient l'annexe quand elle est prévue.
