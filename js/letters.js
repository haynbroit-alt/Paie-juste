/** Courriers (texte brut). Rien n'est envoyé : l'utilisateur copie, imprime ou enregistre en PDF. */
import { fmtEur } from "./calc.js";

export const NOT_LEGAL_ADVICE =
  "Ce document a été préparé avec une application personnelle. Ce n'est pas un conseil juridique. Les montants sont une estimation à vérifier.";

export const ARTICLES = {
  "L1251-32": {
    titre: "indemnité de fin de mission égale à 10 % de la rémunération totale brute",
    url: "https://code.travail.gouv.fr/code-du-travail/l1251-32",
  },
  "L1251-19": {
    titre: "indemnité compensatrice de congés payés d'au moins un dixième de la rémunération totale brute",
    url: "https://code.travail.gouv.fr/code-du-travail/l1251-19",
  },
  "L3121-36": {
    titre: "majoration des heures supplémentaires (25 % puis 50 %, à défaut d'accord)",
    url: "https://code.travail.gouv.fr/code-du-travail/l3121-36",
  },
  "L1243-8": {
    titre: "indemnité de fin de contrat (CDD) égale à 10 % de la rémunération totale brute",
    url: "https://code.travail.gouv.fr/code-du-travail/l1243-8",
  },
  "L1242-16": {
    titre: "indemnité compensatrice de congés payés en CDD d'au moins un dixième de la rémunération totale brute",
    url: "https://code.travail.gouv.fr/code-du-travail/l1242-16",
  },
  "L3123-29": {
    titre: "majoration des heures complémentaires du temps partiel (10 % puis 25 %, à défaut d'accord)",
    url: "https://code.travail.gouv.fr/code-du-travail/l3123-29",
  },
  "L3242-1": {
    titre: "mensualisation de la rémunération",
    url: "https://code.travail.gouv.fr/code-du-travail/l3242-1",
  },
  "L3121-27": {
    titre: "durée légale de 35 heures par semaine",
    url: "https://code.travail.gouv.fr/code-du-travail/l3121-27",
  },
  "L1251-18": {
    titre: "rémunération au moins égale à celle prévue au contrat de mise à disposition",
    url: "https://code.travail.gouv.fr/code-du-travail/l1251-18",
  },
  "L3245-1": {
    titre: "prescription de trois ans de l'action en paiement du salaire",
    url: "https://code.travail.gouv.fr/code-du-travail/l3245-1",
  },
  "L3243-3": {
    titre: "l'acceptation d'un bulletin de paie sans réserve ne vaut pas renonciation",
    url: "https://code.travail.gouv.fr/code-du-travail/l3243-3",
  },
  "L3171-4": { titre: "preuve des heures de travail", url: "https://code.travail.gouv.fr/code-du-travail/l3171-4" },
};

/** Contacts vérifiés le 10/11/2026 (voir regles.md, section 5). */
export const CONTACTS = [
  {
    nom: "Renseignement en droit du travail — DDETS de l'Hérault",
    role: "Inspection du travail (réseau DREETS Occitanie). Informe, conseille, oriente. Gratuit et confidentiel.",
    lignes: ["615 boulevard d'Antigone, CS 19002, 34064 Montpellier Cedex 2", "Accueil sur rendez-vous"],
    tel: "0806000126",
    telAff: "0 806 000 126 (lun.-ven. 9 h-11 h 30, 13 h 30-16 h)",
    mail: "ddets-droit-du-travail-renseignements@herault.gouv.fr",
    source: "https://lannuaire.service-public.gouv.fr/occitanie/herault/e2f3a3cd-edd3-4733-94d8-23c08c8c46b7",
  },
  {
    nom: "Conseil de prud'hommes de Montpellier",
    role: "Tribunal des litiges du travail.",
    lignes: [
      "9 rue de Tarragone, 34000 Montpellier",
      "Courrier : 34040 Montpellier Cedex 1",
      "Lun.-ven. 8 h-12 h et 13 h 30-16 h 30",
    ],
    tel: "0434083200",
    telAff: "04 34 08 32 00",
    mail: "cph-montpellier@justice.fr",
    source: "https://lannuaire.service-public.gouv.fr/occitanie/herault/651c531c-ff94-4d52-828d-0e1c778e3171",
  },
  {
    nom: "Union locale CGT de Montpellier",
    role: "Syndicat : aide tous les salariés (CDI, CDD, intérim, temps partiel).",
    lignes: ["Maison des syndicats, 474 allée Henri II de Montmorency, 34000 Montpellier"],
    tel: "0467159170",
    telAff: "04 67 15 91 70",
    mail: "ul.montpellier@cgtmontpellier.com",
    source: "https://herault.cgt.fr/la-cgt-pres-de-chez-vous",
  },
  {
    nom: "Union départementale CGT de l'Hérault",
    role: "Syndicat.",
    lignes: ["Maison des syndicats, 474 allée Henri II de Montmorency, 34000 Montpellier"],
    tel: "0467159167",
    telAff: "04 67 15 91 67",
    mail: "secretariat@cgt34.fr",
    source: "https://herault.cgt.fr/la-cgt-pres-de-chez-vous",
  },
  {
    nom: "DREETS Occitanie (siège)",
    role: "Direction régionale. Le renseignement se fait dans les DDETS départementales (ci-dessus).",
    lignes: ["1 place Émile Blouin, CS 90007, 31952 Toulouse Cedex 9"],
    source: "https://occitanie.dreets.gouv.fr/contact-18711",
  },
  {
    nom: "Code du travail numérique — modèle officiel",
    role: "Modèle « Demande de paiement de salaire » du ministère du Travail.",
    lignes: [],
    lien: "https://code.travail.gouv.fr/modeles-de-courriers/demande-de-paiement-de-salaire",
    source: "https://code.travail.gouv.fr/modeles-de-courriers/demande-de-paiement-de-salaire",
  },
];
export const CONTACTS_NOTE =
  "Autres syndicats (CFDT, FO, CFTC, CFE-CGC, Solidaires…) : coordonnées locales non vérifiées, donc non listées. Ce n'est pas une préférence.";

function tableEcarts(cmp) {
  const rows = cmp.lines.filter((l) => l.ecart != null && Math.abs(l.ecart) >= 0.01);
  if (!rows.length) return "  (aucun écart ligne par ligne)";
  return rows
    .map(
      (l) =>
        `  - ${l.label} : attendu ${fmtEur(l.attendu)}, versé ${fmtEur(l.recu)}, écart ${fmtEur(l.ecart)} (art. ${l.regle})`,
    )
    .join("\n");
}
function articlesCites(cmp) {
  const keys = new Set(["L3243-3", "L3245-1"]);
  for (const l of cmp.lines) if (l.ecart != null && Math.abs(l.ecart) >= 0.01 && ARTICLES[l.regle]) keys.add(l.regle);
  if (cmp.lines.some((l) => l.key === "hs" && l.ecart)) keys.add("L3121-27");
  if (cmp.ecartHeures) keys.add("L3171-4");
  return [...keys].map((k) => `  - Article ${k} du Code du travail : ${ARTICLES[k].titre}.`).join("\n");
}
function entete(ctx) {
  const p = ctx.profil || {},
    m = ctx.mission || {};
  return [
    p.nom || "[Votre nom et prénom]",
    p.adresse || "[Votre adresse]",
    "",
    `À l'attention de : ${m.employeur || "[Employeur]"}`,
    m.employeurAdresse || "[Adresse de l'employeur]",
    "",
    `Fait à ${p.ville || "Montpellier"}, le ${ctx.dateStr}`,
    "",
  ].join("\n");
}
function refMission(ctx) {
  const m = ctx.mission || {};
  const type = { cdi: "CDI", cdd: "CDD", interim: "Contrat de mission (intérim)" }[m.type] || "Contrat";
  const sal =
    m.mode === "mensuel"
      ? `salaire mensuel ${fmtEur(m.mensuel || 0)} brut pour ${m.hebdo} h par semaine`
      : `taux horaire ${fmtEur(m.taux || 0)} brut`;
  return `Contrat : ${type}${m.eu ? " — entreprise utilisatrice " + m.eu : ""}${m.lieu ? " — lieu " + m.lieu : ""} — ${sal}.\nPériode concernée : ${ctx.periodeLabel}.`;
}
function annexe(ctx) {
  const a = ctx.annexe || {};
  return `Pièce jointe : relevé personnel de mes heures, scellé par empreintes SHA-256 chaînées (${a.count ?? "?"} enregistrements, empreinte finale ${a.head ? a.head.slice(0, 16) + "…" : "?"}). Il peut être vérifié avec le fichier d'export.`;
}
function heuresPhrase(cmp) {
  if (cmp.ecartHeures == null || Math.abs(cmp.ecartHeures) < 0.01) return "";
  return `\nMon relevé compte ${cmp.heuresPointees.toFixed(2).replace(".", ",")} h, le bulletin en compte ${cmp.heuresPayees.toFixed(2).replace(".", ",")} h (écart de ${cmp.ecartHeures.toFixed(2).replace(".", ",")} h).`;
}

export function lettreAmiable(ctx) {
  const c = ctx.compare;
  return `${entete(ctx)}Objet : demande de régularisation de salaire

Madame, Monsieur,

En comparant mon bulletin de paie à mon relevé personnel d'heures, je constate un écart.

${refMission(ctx)}${heuresPhrase(c)}

Détail de l'écart estimé :
${tableEcarts(c)}

Total estimé restant dû : ${fmtEur(Math.max(0, c.total))} brut.

Je vous remercie de bien vouloir vérifier ces éléments et, le cas échéant, de procéder à la régularisation sur mon prochain bulletin, ou de m'expliquer le calcul retenu.

${annexe(ctx)}

Je reste disponible pour en parler.

Cordialement,

${(ctx.profil && ctx.profil.nom) || "[Signature]"}

---
${NOT_LEGAL_ADVICE}`;
}

export function miseEnDemeure(ctx) {
  const c = ctx.compare;
  return `${entete(ctx)}Lettre recommandée avec accusé de réception

Objet : mise en demeure de payer des sommes dues au titre de mon contrat de travail

Madame, Monsieur,

${ctx.amiableDate ? `Par courrier du ${ctx.amiableDate}, je vous ai demandé` : "Je vous ai déjà demandé"} la régularisation de mon salaire. À ce jour, je n'ai reçu ni paiement ni explication.

${refMission(ctx)}${heuresPhrase(c)}

Selon mon décompte, les sommes suivantes restent dues :
${tableEcarts(c)}

Soit un total de ${fmtEur(Math.max(0, c.total))} brut.

Je vous rappelle notamment :
${articlesCites(c)}

En conséquence, je vous mets en demeure de me verser la somme de ${fmtEur(Math.max(0, c.total))} brut dans un délai de ${ctx.delaiJours || 15} jours à compter de la réception de ce courrier, accompagnée d'un bulletin de paie rectificatif.

À défaut, je me réserve le droit de saisir le conseil de prud'hommes compétent.

${annexe(ctx)}

Veuillez agréer, Madame, Monsieur, mes salutations distinguées.

${(ctx.profil && ctx.profil.nom) || "[Signature]"}

---
${NOT_LEGAL_ADVICE} Avant d'envoyer une mise en demeure, faites-vous relire par le service de renseignement en droit du travail (0 806 000 126) ou par un syndicat.`;
}

/** Articles du RGPD cités dans la demande d'accès (règlement (UE) 2016/679). Voir regles.md, section 1 quinquies. */
export const RGPD = {
  url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=fr",
  cnilModele: "https://www.cnil.fr/fr/modele/courrier/exercer-son-droit-dacces",
  cnilPlainte: "https://www.cnil.fr/fr/plaintes",
};

/**
 * Demande d'accès à ses données personnelles (article 15 du RGPD). Ne réclame aucun montant :
 * elle sert à obtenir les relevés d'heures et éléments de paie détenus par l'employeur ou l'agence.
 */
export function demandeAccesRgpd(ctx) {
  const m = ctx.mission || {};
  const interim = m.type === "interim";
  const heures = interim
    ? "les relevés d'heures me concernant, y compris ceux transmis par l'entreprise utilisatrice" +
      (m.eu ? ` (${m.eu})` : "") +
      ", avec leur date de réception"
    : "les relevés d'heures, pointages ou décomptes du temps de travail me concernant";
  return `${entete(ctx)}Lettre recommandée avec accusé de réception (ou remise en main propre contre signature)

Objet : demande d'accès à mes données personnelles (article 15 du RGPD)

Madame, Monsieur,

En application de l'article 15 du règlement (UE) 2016/679 (RGPD), je vous demande de me confirmer si vous traitez des données personnelles me concernant et, si c'est le cas, de m'en communiquer une copie.

${refMission(ctx)}

Je souhaite en particulier recevoir, pour cette période :
  - ${heures} ;
  - les éléments variables transmis pour l'établissement de ma paie (heures, primes, indemnités, absences) ;
  - mes bulletins de paie et mon ou mes contrats ;
  - les informations prévues à l'article 15 : finalités du traitement, destinataires, durée de conservation et source des données lorsqu'elles n'ont pas été collectées auprès de moi.

Je ne demande que les données me concernant, et aucune donnée relative à d'autres salariés.

Selon l'article 12 du RGPD, vous disposez d'un mois à compter de la réception de cette demande pour y répondre. Ce délai peut être prolongé de deux mois si la demande est complexe, à condition de m'en informer dans le premier mois. La première copie est gratuite (articles 12 et 15).

Une copie sous forme électronique courante (PDF ou tableur) me convient.

Veuillez agréer, Madame, Monsieur, mes salutations distinguées.

${(ctx.profil && ctx.profil.nom) || "[Signature]"}

---
${NOT_LEGAL_ADVICE} Sans réponse dans le délai, vous pouvez adresser une plainte à la CNIL (${RGPD.cnilPlainte}). Modèle officiel de la CNIL : ${RGPD.cnilModele}`;
}

export function annexeReleve(ctx) {
  const a = ctx.annexe || {};
  const lines = (a.punches || []).map(
    (p) =>
      `${p.quand}  ${p.action.padEnd(8)}  ${p.contrat}${p.corrige ? "  [corrigé : " + p.motif + "]" : ""}${p.annule ? "  [annulé]" : ""}  #${p.hash.slice(0, 12)}`,
  );
  return `ANNEXE — Relevé personnel des heures (scellé SHA-256)

Contrat : ${(ctx.mission && ctx.mission.employeur) || ""}${ctx.mission && ctx.mission.eu ? " / " + ctx.mission.eu : ""} — ${(ctx.mission && ctx.mission.lieu) || ""}
Période : ${ctx.periodeLabel}
Heures en heure de Paris (Europe/Paris).

${lines.join("\n") || "(aucun pointage sur la période)"}

Chaîne : ${a.count ?? "?"} enregistrements — vérification : ${a.verif || "non faite"}
Empreinte finale (SHA-256) : ${a.head || "?"}

Les corrections ne remplacent jamais un pointage : elles sont ajoutées à la suite et gardent la trace de l'original.
Ce relevé est un élément personnel. Il n'a pas de valeur certifiée : le juge l'apprécie avec les autres éléments (art. L3171-4).`;
}
