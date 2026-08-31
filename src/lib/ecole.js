// Identité officielle de l'école, en un seul endroit.
//
// Le numéro WhatsApp était écrit en dur à cinq endroits : ProfApp, le cahier
// de devoirs, `rapports.html`, `pedago-archive/app.js`, plus les libellés qui
// l'affichent. Cinq copies d'un même fait, qu'un changement de numéro aurait
// laissées dans cinq états différents.
//
// Une note antérieure de la constitution le qualifiait de numéro personnel
// contraire au §8. Vérification faite, c'est bien le numéro officiel de
// l'école : il figure sur l'en-tête institutionnel de la comptabilité, à côté
// de l'adresse, et sert de numéro Wave à l'établissement. Le §8 est respecté.
//
// Les pages statiques de `public/` ne peuvent pas importer ce module — elles
// gardent leur propre constante. Elles sont listées ci-dessous pour qu'un
// changement de numéro n'en oublie aucune.

// ── Canal officiel ───────────────────────────────────────────────────────────
//
// V2.1 §8 : le canal opérationnel officiel est le compte WhatsApp de l'école.
// Les enseignants n'écrivent jamais depuis leur numéro personnel : le message
// part vers ce compte, que la vie scolaire relaie à la famille.

export const WHATSAPP_ECOLE = '22390190007'

// Forme affichée à l'écran et sur les documents.
export const WHATSAPP_ECOLE_LISIBLE = '+223 90 19 00 07'

// Lien de rédaction vers le compte officiel, message pré-rempli.
export const lienWhatsAppEcole = message =>
  `https://wa.me/${WHATSAPP_ECOLE}?text=${encodeURIComponent(String(message || ''))}`

// ── Identité ─────────────────────────────────────────────────────────────────
//
// Dix-sept variantes du nom circulaient sur les documents officiels. La
// direction a tranché le 31/08/2026 : la marque vient EN TÊTE.
//
//     IDEAL École Internationale Bilingue
//
// et non « École Internationale Bilingue IDEAL ». L'ordre compte : c'est le
// nom officiel de l'établissement, pas une description suivie d'un sigle.
//
// Cette constante est la source. Tout document qui affiche le nom doit la
// lire, jamais le réécrire — c'est la réécriture qui avait produit les dix-sept
// variantes.

export const NOM_ECOLE = 'IDEAL École Internationale Bilingue'
export const VILLE     = 'Bamako'
export const ADRESSE   = 'Faladié Sema, Bamako, Mali'

// ── Copies hors de portée d'un import ────────────────────────────────────────
//
// À mettre à jour à la main si le numéro change :
//   public/rapports.html            — const IDEAL_WA
//   public/pedago-archive/app.js    — const IDEAL_WA
//   public/pedago-archive/index.html — libellé affiché
//   public/comptabilite.html        — en-têtes institutionnels et WAVE_NUMERO

// ── Le chef d'établissement ──────────────────────────────────────────────────
//
// Un certificat de scolarité est un acte du chef d'établissement : il est
// signé par le Directeur, quelle que soit la personne qui l'imprime. Le
// responsable administratif qui édite un certificat ne le signe pas de son
// nom — il édite un document que le Directeur signe.
//
// Le nom vivait nulle part : le certificat affichait « M. Directeur IDEAL »,
// c'est-à-dire la FONCTION à la place du nom. Il est ici, une fois, à côté du
// reste de l'identité officielle.
export const DIRECTEUR = {
  civilite: 'M.',
  nom: 'Samuel MOGADZI',
  fonction: 'Directeur',
}
