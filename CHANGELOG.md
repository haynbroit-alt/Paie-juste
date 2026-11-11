# Journal des changements

## 0.5.0 — 2026-11-11

Ne plus rien perdre si le téléphone casse. Les montants de paie ne changent pas.

- Mes données : « 💾 Sauvegarde chiffrée ». Un fichier unique, chiffré sur le téléphone (AES-256-GCM, clé PBKDF2-SHA-256 à 600 000 itérations tirée d'un code de 8 caractères minimum). Il contient tout le journal scellé et les réglages. Sur Android, il s'envoie où l'on veut (Drive, e-mail…) ; sinon il est téléchargé.
- Restauration : code demandé, chaîne d'empreintes vérifiée avant de remplacer quoi que ce soit. Un mauvais code ou un fichier modifié sont refusés.
- Mes heures : un rappel s'affiche si la dernière sauvegarde date de plus de 30 jours.
- Correction : les horaires habituels (« comme d'habitude ») et l'heure du rappel sont relus à l'ouverture de l'appli. Ils étaient perdus au redémarrage depuis la 0.4.0.

## 0.4.0 — 2026-11-10

Plus rapide, plus clair. Les montants de paie ne changent pas.

- Mes heures : un bouton « ✔ Aujourd'hui comme d'habitude » enregistre la journée en un geste avec vos horaires habituels. Les autres horaires restent accessibles en dessous.
- Look clair et simple : fond blanc, texte foncé, jaune réservé aux boutons.
- Ma paie : bouton « 📷 Photo ou PDF de ma fiche de paie ». La lecture se fait sur le téléphone (OCR embarqué). Les montants trouvés (heures, base, heures sup, primes, IFM, ICCP, frais) sont proposés avec leur ligne d'origine, à cocher puis à enregistrer. Le brut et le net lus servent à vérifier.
- Ma paie : un résumé « En bref » en tête (heures, heures sup, brut, net à recevoir, état du bulletin). Le détail semaine par semaine, le calcul ligne par ligne et les primes sont repliés.

## 0.3.0 — 2026-11-10

« Je travaille, je note mes heures, Paie Juste vérifie ma paie. » Les montants de paie ne changent pas.

- L'onglet « Pointer » devient « Mes heures ». Le chronomètre, les boutons Début / Pause / Fin, le GPS et le pointage en direct disparaissent de l'écran.
- Ma journée : jour, arrivée, départ, pause, total, puis un seul bouton « Enregistrer ma journée ». Les heures se choisissent dans des listes en 24 h (plus de « AM / PM », quel que soit le téléphone). Le jour se choisit dans une liste en français (« Aujourd'hui », « Hier »…).
- Ma semaine : du lundi au dimanche, total et heures sup, avec les semaines précédentes.
- Mes journées : l'historique. Modifier ou supprimer une journée demande un motif. L'ancienne version reste, barrée, dans le journal scellé.
- Les anciens pointages en direct restent lus. Une journée incomplète (départ manquant) est signalée et se complète depuis le formulaire.

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
