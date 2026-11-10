# Analyse des outils existants — ce qu'on en apprend pour Paie Juste

État au 10 novembre 2026. But : comprendre **comment** les meilleurs outils travaillent (leur code, leur serveur, leur méthode), pour faire mieux, **sans les copier**.

Étiquettes : **TESTÉ** = vérifié ici en lançant le code. **LU** = lu sur une source publique (page, dépôt, article), pas testé. **INCONNU** = pas trouvé.

---

## 1. Ce qui a été testé ici (le plus important)

### Le moteur officiel de l'Urssaf confirme le calcul de Paie Juste — TESTÉ

L'Urssaf publie son moteur de calcul de la paie, `modele-social`, en logiciel libre (licence MIT, version 11.1.0 sur npm). C'est ce moteur qui fait tourner le simulateur de mon-entreprise.urssaf.fr. Il fonctionne sans serveur, directement dans un navigateur.

On a comparé le « net avant impôt » de Paie Juste (`js/calc.js`) avec celui de ce moteur, en CDI, sans heures supplémentaires :

| Brut mensuel | Paie Juste | Urssaf (sans mutuelle) | Écart |
| ------------ | ---------- | ---------------------- | ----- |
| 1 867,02 €   | 1 477,93 € | 1 477,93 €             | 0,00  |
| 3 000 €      | 2 374,79 € | 2 374,79 €             | 0,00  |
| 4 005 €      | 3 170,35 € | 3 170,35 €             | 0,00  |
| 4 500 €      | 3 561,76 € | 3 561,78 €             | 0,02  |
| 6 000 €      | 4 764,91 € | 4 764,93 €             | 0,02  |

Le net imposable concorde lui aussi, au centime près jusqu'au plafond (4 005 €). Au-dessus, l'écart est de 1 à 2 centimes, sans doute une question d'arrondi.

**Une différence trouvée, et sa cause** : réglé par défaut, le moteur Urssaf ajoute une mutuelle de 40 € par mois, partagée moitié-moitié. La part payée par l'employeur (20 €) est alors ajoutée à la base de la CSG et de la CRDS. Sans cette mutuelle, les deux calculs donnent le même résultat. Dans Paie Juste, cette réintégration de la part employeur est notée INCONNU dans `regles.md` et n'est pas codée. Le moteur officiel montre **comment** elle se calcule.

Reproduire le test :

```bash
npm i modele-social@11.1.0 publicodes@1.10.4
# puis évaluer 'salarié . rémunération . net . à payer avant impôt'
# avec 'salarié . contrat . salaire brut' = '3000 €/mois'
# et 'salarié . cotisations . prévoyances . santé . montant' = '0 €/mois'
```

---

## 2. Les outils analysés

### A. Outils de calcul de paie

| Outil                                | Qui le fait                       | Code / serveur                                                                                                                          | Méthode de travail                                                                                                                                                                                           | Ce qu'on en retient                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **mon-entreprise / `modele-social`** | Urssaf + beta.gouv                | GitHub `betagouv/mon-entreprise`, MIT, TypeScript. Règles publiées sur npm. TESTÉ hors ligne.                                           | Les règles sont écrites dans un langage lisible, **Publicodes**, en français. Chaque règle cite sa source et peut s'afficher sous forme de page explicative. Le calcul est séparé de l'interface. LU + TESTÉ | Le meilleur témoin pour **vérifier nos calculs à chaque version**. Il montre aussi les cas que nous ne codons pas encore (mutuelle, apprentis, taux réduits…).                                                   |
| **Publicodes**                       | beta.gouv (DINUM)                 | GitHub `publicodes/publicodes`, MIT                                                                                                     | Langage de règles « lisible par un non-développeur ». Utilisé aussi par le Code du travail numérique et Nos Gestes Climat. LU                                                                                | Idée à reprendre **sans copier le code** : chaque montant affiché doit pouvoir s'expliquer, règle par règle, avec sa source.                                                                                     |
| **OpenFisca-France**                 | Communauté + État                 | GitHub `openfisca/openfisca-france`, AGPL-3.0, Python, plutôt sur serveur                                                               | Modèle complet impôts et prestations, testé par des cas YAML. Le premier simulateur de l'Urssaf l'utilisait. LU                                                                                              | Trop lourd pour un téléphone hors ligne, et sa licence AGPL ne se marie pas avec notre licence MIT. Il reste une source pour les cas de test.                                                                    |
| **Code du travail numérique**        | Ministère du Travail (SocialGouv) | GitHub `SocialGouv/code-du-travail-numerique`. Données KALI et LEGI publiées en JSON (`@socialgouv/kali-data`, `@socialgouv/legi-data`) | Simulateurs officiels (préavis, indemnités…). Les conventions collectives sont extraites chaque jour de Légifrance. Le dépôt kali-data se dit lui-même « expérimental ». LU                                  | Les **conventions collectives** (dont celle du BTP) sont disponibles en données ouvertes. C'est la clé pour remplacer le champ « convention en texte libre » par de vraies règles, comme le panier et le trajet. |
| **Relevé** (iPhone)                  | Privé                             | INCONNU (pas de dépôt public trouvé)                                                                                                    | INCONNU : la recherche n'a rien rendu sur releve-interim.fr                                                                                                                                                  | Seul concurrent direct connu en France. Toujours pas d'Android d'après son site.                                                                                                                                 |

### B. Outils où le salarié garde ses propres preuves

| Outil                          | Qui le fait                         | Code / serveur                                                    | Méthode de travail                                                                                                                                                                                                                                                                                     | Ce qu'on en retient                                                                                                                                                                 |
| ------------------------------ | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DOL Timesheet** (États-Unis) | Ministère du Travail américain      | Appli officielle iOS (2011), Android (2022)                       | Le salarié note ses heures **sans dépendre des relevés de l'employeur**. Calcul automatique des heures sup, plusieurs employeurs, résumé par jour, semaine et mois envoyé par e-mail. Calendrier papier pour ceux qui n'ont pas de smartphone. LU                                                      | La même idée que Paie Juste, portée par un État. Deux bonnes idées : **plusieurs employeurs** (utile pour un intérimaire qui change d'agence) et une **version papier imprimable**. |
| **WeClock**                    | UNI Global Union + Guardian Project | Libre, sur GitLab (`spotlightproject`), Android et iOS            | Le salarié suit ses heures, ses pauses, ses trajets et le temps passé sur les applis de travail hors horaires. Les développeurs n'ont pas accès aux données, qui ne sont partagées qu'avec l'accord du salarié. LU                                                                                     | Même philosophie que nous. Point faible connu : environ 1 800 installations. **La technique ne suffit pas, il faut un relais syndical ou associatif.**                              |
| **ProofMode**                  | Guardian Project + WITNESS          | Libre, GitHub `guardianproject/proofmode`                         | Chaque photo ou vidéo reçoit une empreinte SHA-256 et une **signature** par une clé propre au téléphone, plus un relevé des capteurs. Les fichiers d'origine ne sont jamais modifiés, et la preuve se vérifie avec des outils standards. Le projet reconnaît qu'il n'a jamais été testé en justice. LU | Va plus loin que notre chaîne d'empreintes : la **signature** relie le journal à un téléphone précis. Bon modèle pour l'annexe du courrier et pour la Boîte noire.                  |
| **OpenTimestamps**             | Communauté                          | Libre, client JavaScript. Ancrage gratuit dans la chaîne Bitcoin. | Prouve qu'une empreinte existait à une date donnée, sans tiers de confiance payant. Problème connu : les serveurs publics **refusent les requêtes directes d'un navigateur** (CORS), comme FreeTSA. LU                                                                                                 | Même blocage que FreeTSA. Piste : un export « à horodater » que l'utilisateur dépose lui-même sur le site opentimestamps.org. Rien ne partirait automatiquement.                    |
| **Worker Info Exchange**       | ONG britannique                     | Pas d'appli : modèles de demandes RGPD                            | Aide les travailleurs à **demander leurs données** à l'employeur (article 15 du RGPD) et à les comparer à leurs propres relevés. Plus de 500 demandes en 8 mois. LU                                                                                                                                    | Un courrier « droit d'accès RGPD » pour récupérer les relevés d'heures de l'agence serait facile à ajouter à l'onglet Réclamer.                                                     |

### C. Bruit (Boîte noire)

| Outil            | Qui le fait               | Code                                                                    | Ce qu'on en retient                                                                                                                                                                                                                              |
| ---------------- | ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **NoiseCapture** | Université Gustave Eiffel | GitHub `Universite-Gustave-Eiffel/NoiseCapture`, GPL-3.0, Android natif | Appli française et publique de mesure du bruit, avec un article scientifique qui traite de l'**étalonnage des téléphones**. Sa licence GPL interdit de reprendre son code dans une appli MIT, mais sa méthode d'étalonnage peut être étudiée. LU |

---

## 3. Ce que font les meilleurs, et que nous ne faisons pas encore

1. **Un témoin indépendant pour les calculs.** L'Urssaf publie ses règles. On peut tester Paie Juste contre elles à chaque version, sans les embarquer dans l'appli.
2. **Chaque montant s'explique.** Publicodes affiche le « pourquoi » de chaque ligne. Paie Juste montre déjà le calcul ligne par ligne. Il manque le lien direct vers l'article de loi, ligne par ligne.
3. **Les conventions collectives viennent des données officielles**, au lieu d'un texte libre (Code du travail numérique, KALI).
4. **Une preuve signée**, pas seulement enchaînée (ProofMode).
5. **Plusieurs employeurs dans un même journal** (DOL Timesheet), pour suivre une carrière d'intérimaire.
6. **Un relais humain** : un syndicat, une association ou l'inspection du travail. WeClock montre qu'un bon outil sans relais reste peu utilisé.

---

## 4. Propositions, par ordre d'impact pour le coût

| #   | Proposition                                                                                                                           | Impact                                         | Coût   | Risque                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| 1   | **Test automatique contre le moteur Urssaf** (outil de développement seulement, l'appli ne change pas)                                | Fort : protège chaque montant à chaque version | Faible | Faible. Le moteur Urssaf évolue, donc on fixe sa version.                       |
| 2   | **Réintégrer la part employeur de la mutuelle** dans la CSG, la CRDS et le net imposable, avec la règle vérifiée sur le moteur Urssaf | Moyen : net plus juste pour qui a une mutuelle | Faible | Moyen : il faut une source officielle avant de passer la règle en PROUVÉ.       |
| 3   | **Courrier « droit d'accès RGPD »** dans Réclamer, pour demander à l'agence ses relevés d'heures                                      | Fort, et nouveau en France pour un salarié     | Faible | Faible : on cite l'article 15 du RGPD, rien n'est envoyé automatiquement.       |
| 4   | **Convention BTP depuis KALI** : primes de panier et de trajet par zone, au lieu de la saisie manuelle                                | Fort pour le BTP                               | Moyen  | Moyen : les montants régionaux dépendent d'accords locaux.                      |
| 5   | **Journal multi-employeurs** (une mission = une agence + une entreprise utilisatrice)                                                 | Fort pour l'intérim                            | Moyen  | Faible                                                                          |
| 6   | **Signature du journal** par une clé créée sur le téléphone (WebCrypto), en plus de la chaîne SHA-256                                 | Moyen : preuve plus solide                     | Moyen  | Il ne faut pas promettre de valeur juridique. La clé perdue = signature perdue. |
| 7   | **Export « à horodater »**, déposé par l'utilisateur sur OpenTimestamps                                                               | Faible à moyen                                 | Faible | Il faut l'expliquer simplement.                                                 |
| 8   | **Relais** : contacter une union locale ou une association de Montpellier, pour faire tester l'appli par de vrais intérimaires        | Très fort                                      | Humain | C'est à vous de choisir, et de faire la démarche.                               |

---

## 5. Limites de cette analyse

- Seul le moteur Urssaf a été **testé**. Le reste a été lu sur des sources publiques, avec des recherches web, sans ouvrir chaque dépôt.
- Les chiffres des dépôts (étoiles, installations) changent d'une source à l'autre. Ils ne servent qu'à donner un ordre de grandeur.
- Le test Urssaf couvre un CDI sans heures sup. Les heures sup, le temps partiel et l'intérim restent à comparer.

## Sources

- [betagouv/mon-entreprise (ecosystem.code.gouv.fr)](https://ecosystem.code.gouv.fr/hosts/GitHub/repositories/betagouv%2Fmon-entreprise/readme?sha=v1.37) · [Genèse de Publicodes](https://hackmd.io/@laem/genese-publicodes) · [Simon Willison sur modele-social](https://simonwillison.net/2024/Jan/2/betagouv/) · [publicodes sur npm](https://www.npmjs.com/package/publicodes)
- [openfisca-france (code.gouv.fr)](https://ecosystem.code.gouv.fr/hosts/GitHub/repositories/openfisca%2Fopenfisca-france) · [Documentation OpenFisca](https://openfisca.readthedocs.io/)
- [@socialgouv/kali-data](https://www.npmjs.com/package/@socialgouv/kali-data) · [@socialgouv/legi-data](https://npmjs.com/package/@socialgouv/legi-data) · [SocialGouv (code.gouv.fr)](https://data.code.gouv.fr/hosts/GitHub/owners/SocialGouv)
- [DOL : lancement de l'appli Android (2022)](https://www.dol.gov/newsroom/releases/whd/whd20220630) · [DOL : lancement en 2011](https://www.dol.gov/newsroom/releases/whd/whd20110509)
- [WeClock, Guardian Project](https://guardianproject.info/podcast/2020/weclock.html) · [Code WeClock (GitLab)](https://gitlab.com/spotlightproject) · [WeClock et le vol de salaire](https://thenewpowerreview.substack.com/p/weclock-tackling-wage-theft-and-reclaiming)
- [ProofMode (Guardian Project)](https://guardianproject.info/apps/org.witness.proofmode/) · [Starling Lab, ProofMode](https://starling.stanford.edu/prototypes/proofmode-authentication/)
- [OpenTimestamps](https://opentimestamps.org/) · [Blocage CORS des serveurs OTS](https://gitlab.com/guardianproject/proofmode/proofcheck-web/-/issues/40)
- [Worker Info Exchange, rapport](https://www.business-humanrights.org/en/latest-news/ngo-worker-info-exchange-publishes-new-report-on-data-driven-exploitation-in-the-gig-economy)
- [NoiseCapture (code.gouv.fr)](https://data.code.gouv.fr/hosts/GitHub/repositories/Universite-Gustave-Eiffel%2FNoiseCapture)
