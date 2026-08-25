import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { A4, HAUTEUR_UTILE_MM, MM_EN_PX } from '../lib/pageA4'

// Moteur documentaire commun d'IDEAL.
//
// Tout document remis à une famille, un élève, un enseignant, la direction ou
// un partenaire passe par ici. Un seul en-tête, un seul pied de page, une
// seule identité — quel que soit le service qui l'émet.
//
// Refonte du 18 août 2026, sur cinq défauts constatés :
//
//   1. La barre de contrôle lisait `theme.name`, clé qui n'existait dans aucun
//      thème : tous les documents affichaient « PROVENANCE : undefined ».
//   2. Aucune pagination. Une fiche de deux pages était coupée au milieu d'une
//      rubrique, à un endroit décidé par le navigateur.
//   3. Les mesures n'étaient pas celles du papier : 820 px de large et des
//      marges en rem, contre 210 mm et des marges en mm sur une feuille A4.
//      L'écran et l'impression ne cadraient pas pareil.
//   4. L'export JPEG haute définition n'existait qu'ici : dans CuisiniereApp.
//      Il est remonté dans le moteur, à l'identique — scale 3, qualité 0.98 —
//      pour que tous les documents en profitent.
//   5. Les sceaux étaient des émojis. À l'écran ils passent ; à l'impression
//      ils dépendent de la police du poste et sortent parfois en carré vide.
//      Remplacés par un sceau typographique, décision du promoteur.

// ─── Mesures du papier ──────────────────────────────────────────────────────
//
// En millimètres, pas en pixels. Le navigateur convertit lui-même pour
// l'écran, et l'impression tombe juste sans réglage. Une largeur en pixels
// obligeait à deviner la résolution, et se décalait à chaque imprimante.


// ─── Provenances ────────────────────────────────────────────────────────────
//
// Chaque service a sa nuance, mais l'ensemble appartient visiblement à la même
// école : même en-tête, même sceau, même pied de page. Seules la couleur
// d'accent et la mention de service changent.

export const PROVENANCES = {
  pedagogie: {
    service: 'Service pédagogique & enseignement',
    mention: 'SUIVI PÉDAGOGIQUE & RÉUSSITE SCOLAIRE',
    bandeau: 'SERVICE PÉDAGOGIQUE & ENSEIGNEMENT',
    accent: '#0284c7', appui: '#4f46e5', fond: '#e0f2fe',
  },
  devoirs: {
    service: 'Service pédagogique — travaux à la maison',
    mention: 'TRAVAIL PERSONNEL & AUTONOMIE',
    bandeau: 'CAHIER DE DEVOIRS DE MAISON',
    accent: '#0284c7', appui: '#4f46e5', fond: '#e0f2fe',
  },
  evaluation: {
    service: "Service d'évaluation académique",
    mention: 'ÉVALUATION & EXCELLENCE ACADÉMIQUE',
    bandeau: "RELEVÉ OFFICIEL D'ÉVALUATION",
    accent: '#059669', appui: '#0f172a', fond: '#dcfce7',
  },
  bulletins: {
    service: "Service d'évaluation académique",
    mention: 'BULLETIN SCOLAIRE OFFICIEL',
    bandeau: 'BULLETIN DE NOTES',
    accent: '#059669', appui: '#0f172a', fond: '#dcfce7',
  },
  administration: {
    service: 'Direction administrative',
    mention: 'ADMINISTRATION & SCOLARITÉ',
    bandeau: 'DOCUMENT ADMINISTRATIF OFFICIEL',
    accent: '#0f172a', appui: '#ca8a04', fond: '#f1f5f9',
  },
  direction: {
    service: 'Direction générale',
    mention: 'DIRECTION GÉNÉRALE',
    bandeau: 'DOCUMENT DE DIRECTION',
    accent: '#0f172a', appui: '#ca8a04', fond: '#f1f5f9',
  },
  certificats: {
    service: 'Direction administrative',
    mention: 'ATTESTATION OFFICIELLE',
    bandeau: 'CERTIFICAT & ATTESTATION',
    accent: '#0f172a', appui: '#ca8a04', fond: '#f8fafc',
  },
  comptabilite: {
    service: 'Direction financière & comptabilité',
    mention: 'COMPTABILITÉ & SCOLARITÉ',
    bandeau: "AVIS D'ÉCHÉANCE & RECOUVREMENT",
    accent: '#7e22ce', appui: '#b45309', fond: '#faf5ff',
  },
  restauration: {
    service: 'Service de restauration',
    mention: 'RESTAURATION & ÉQUILIBRE NUTRITIONNEL',
    bandeau: 'SERVICE DE RESTAURATION SCOLAIRE',
    accent: '#b45309', appui: '#047857', fond: '#fffbeb',
  },
  'vie-scolaire': {
    service: 'Service de vie scolaire',
    mention: 'VIE SCOLAIRE & ACCOMPAGNEMENT',
    bandeau: 'VIE SCOLAIRE',
    accent: '#be123c', appui: '#0f172a', fond: '#fff1f2',
  },
  rh: {
    service: 'Service des ressources humaines',
    mention: 'RESSOURCES HUMAINES',
    bandeau: 'DOCUMENT RESSOURCES HUMAINES',
    accent: '#4338ca', appui: '#0f172a', fond: '#eef2ff',
  },
  'communication-familles': {
    service: 'Communication aux familles',
    mention: 'COMMUNICATION AUX FAMILLES',
    bandeau: 'INFORMATION AUX PARENTS',
    accent: '#0d9488', appui: '#0f172a', fond: '#f0fdfa',
  },
  rapports: {
    service: 'Direction générale',
    mention: 'RAPPORT INSTITUTIONNEL',
    bandeau: 'RAPPORT',
    accent: '#334155', appui: '#0284c7', fond: '#f8fafc',
  },
}

// Ancien nom, conservé le temps que d'éventuels appels externes disparaissent.
export const DEPARTMENT_THEMES = PROVENANCES

const provenanceDe = type => PROVENANCES[type] || PROVENANCES.administration

// ─── Bordure double ─────────────────────────────────────────────────────────
//
// Positionnée en absolu, volontairement : elle n'occupe aucune place dans le
// flux. Le contenu garde ses 14 mm de marge et la hauteur utile ne bouge pas
// d'un millimètre — la pagination déjà éprouvée reste identique.
//
// Deux filets plutôt qu'un cadre épais : c'est la convention des documents
// institutionnels, et cela reste lisible à l'impression là où une ombre
// portée serait ignorée par la plupart des pilotes.

function BordureDouble({ prov }) {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: '6mm', pointerEvents: 'none',
      border: `0.5mm solid ${prov.accent}`,
    }}>
      <div style={{
        position: 'absolute', inset: '1.2mm',
        border: `0.2mm solid ${prov.accent}88`,
      }} />
    </div>
  )
}

// ─── Sceau typographique ────────────────────────────────────────────────────
//
// Remplace les émojis 🏅 et 👑. Un émoji dépend de la police installée sur le
// poste : sur un document institutionnel imprimé, il sort au mieux en
// monochrome, au pire en carré vide. Un sceau dessiné en CSS sort partout
// pareil, et il appartient à l'école plutôt qu'au système d'exploitation.

function Sceau({ prov, compact = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: compact ? 6 : 8,
      border: `1px solid ${prov.accent}`, borderRadius: 999,
      padding: compact ? '3px 10px' : '5px 14px', background: '#fff',
    }}>
      <span style={{
        fontSize: compact ? 8 : 9, fontWeight: 900, letterSpacing: '.16em',
        color: prov.accent, borderRight: `1px solid ${prov.accent}44`,
        paddingRight: compact ? 6 : 8, lineHeight: 1,
      }}>IDEAL</span>
      <span style={{
        fontSize: compact ? 7 : 8, fontWeight: 700, letterSpacing: '.1em',
        color: prov.accent, lineHeight: 1,
      }}>{prov.mention}</span>
    </span>
  )
}

// ─── En-tête et pied, répétés sur chaque feuille ────────────────────────────

function EnTete({ prov, titre, bandeau }) {
  return (
    <div style={{ flex: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6mm',
        borderBottom: `0.6mm solid ${prov.accent}55`, paddingBottom: '3mm',
      }}>
        {/* Logo horizontal officiel — 1032 × 375 px. Seule la hauteur est
            imposée : la largeur suit le rapport natif du fichier. Jamais les
            deux, sous peine de l'écraser. */}
        <img src="/logo-ideal.png" alt="IDEAL"
             style={{ height: '17mm', width: 'auto', objectFit: 'contain', flex: 'none' }} />
        <div style={{ minWidth: 0 }}>
          {/* L'établissement d'abord, le document ensuite. Le nom passe de
              3,1 à 4,3 mm : il cesse d'être une mention au-dessus du titre
              pour devenir l'identité qui le porte. */}
          <div style={{
            fontSize: '4.3mm', fontWeight: 900, color: prov.accent,
            letterSpacing: '.07em', textTransform: 'uppercase', lineHeight: 1.1,
          }}>École Internationale Bilingue IDEAL</div>
          <div style={{
            fontSize: '6mm', fontWeight: 900, color: '#0f172a',
            letterSpacing: '.01em', lineHeight: 1.15, marginTop: '1.2mm',
          }}>{titre}</div>
        </div>
      </div>
      {bandeau && (
        <div style={{ textAlign: 'center', margin: '4mm 0 0' }}>
          <span style={{
            display: 'inline-block', background: '#0f172a', color: '#fff',
            padding: '2mm 8mm', borderRadius: 999,
            border: `0.4mm solid ${prov.accent}`,
            fontSize: '2.7mm', fontWeight: 900, letterSpacing: '.12em',
            textTransform: 'uppercase',
          }}>{bandeau}</span>
        </div>
      )}
    </div>
  )
}

function Pied({ prov, page, total, etabliLe, mention }) {
  return (
    <div style={{
      flex: 'none', borderTop: `0.4mm solid ${prov.accent}44`, paddingTop: '2.5mm',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: '4mm', fontSize: '2.4mm', color: '#64748b', fontWeight: 700,
    }}>
      <Sceau prov={prov} compact />
      <span style={{ textAlign: 'right', lineHeight: 1.4 }}>
        {/* Le destinataire, répété sur CHAQUE page. Une pile de feuilles se
            distribue ; sans nom en pied, la page 3 d'un cahier ne se rattache
            à personne. */}
        {mention && <><span style={{ fontWeight: 900, color: prov.accent }}>{mention}</span><br /></>}
        <span style={{ fontWeight: 900, color: prov.accent, letterSpacing: '.05em' }}>
          École Internationale Bilingue IDEAL — Bamako, Mali
        </span>
        <br />{prov.service}
        {total > 1 && <> · page {page} sur {total}</>}
        {' '}· établi le {etabliLe}
      </span>
    </div>
  )
}

// ─── Bloc de contenu ────────────────────────────────────────────────────────
//
// L'unité que la pagination ne coupe jamais. Un document paginé se compose de
// blocs ; le moteur les répartit sur les feuilles sans en scinder aucun.

// `sautAvant` et `mention` ne changent RIEN au rendu du bloc : ils sont lus
// par le moteur avant la répartition. Un bloc les reçoit et les ignore.
export function Bloc({ titre, numero, children, style, sautAvant, mention, ...reste }) {
  void sautAvant; void mention; void reste
  const prov = React.useContext(ProvenanceContext)
  return (
    <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', ...style }}>
      {titre && (
        <h6 style={{
          margin: '0 0 1.8mm', display: 'flex', alignItems: 'center', gap: '2.5mm',
          fontSize: '2.9mm', fontWeight: 900,
          letterSpacing: '.11em', textTransform: 'uppercase',
          color: prov.accent, paddingBottom: '1.2mm',
          borderBottom: `0.35mm solid ${prov.accent}44`,
        }}>
          {/* Le numéro est facultatif : les documents déjà en place n'en
              passent pas et gardent exactement leur présentation. */}
          {numero != null && (
            <span style={{
              flex: 'none', width: '5mm', height: '5mm', borderRadius: '1mm',
              background: prov.accent, color: '#fff', fontSize: '2.8mm',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              letterSpacing: 0,
            }}>{numero}</span>
          )}
          <span>{titre}</span>
        </h6>
      )}
      {children}
    </div>
  )
}

const ProvenanceContext = React.createContext(PROVENANCES.administration)

// ─── Répartition du contenu sur les feuilles ────────────────────────────────
//
// On mesure chaque bloc une fois rendu, puis on les distribue : tant qu'un
// bloc entre dans la feuille courante, il y reste ; sinon il ouvre la
// suivante. Aucun bloc n'est jamais scindé — c'est l'exigence « aucun élément
// coupé ». Un bloc plus haut qu'une feuille occupe sa propre feuille et
// déborde : le moteur le signale en console plutôt que de le tronquer en
// silence.

// `sauts` porte les indices qui doivent OUVRIR une page. Sans eux, le cahier
// de devoirs perdait sa règle métier : la page nominative d'un enfant se
// remplissait avec les devoirs du suivant.
function repartir(hauteurs, hauteurUtilePx, espacementPx, sauts = new Set()) {
  const pages = [[]]
  let restant = hauteurUtilePx
  hauteurs.forEach((h, i) => {
    const cout = h + (pages[pages.length - 1].length ? espacementPx : 0)
    const forcee = sauts.has(i) && pages[pages.length - 1].length
    if (forcee || (cout > restant && pages[pages.length - 1].length)) {
      pages.push([i])
      restant = hauteurUtilePx - h
    } else {
      pages[pages.length - 1].push(i)
      restant -= cout
    }
  })
  return pages
}

// ─── Une feuille A4 ─────────────────────────────────────────────────────────
//
// Définie au niveau du module, pas dans le corps du moteur : un composant
// recréé à chaque rendu change d'identité aux yeux de React, qui démonte et
// remonte tout son sous-arbre — les mesures repartiraient de zéro à chaque
// passe.

// ─── Adaptation à l'écran ────────────────────────────────────────────────────
//
// La feuille mesure 210 mm de large. Sur un téléphone de 375 px, cela fait
// deux fois la largeur de l'écran : le document débordait horizontalement et
// poussait la page entière avec lui.
//
// On ne réduit pas le document : on le met à l'échelle. Le papier reste du A4
// — c'est ce qui sortira de l'imprimante — mais son aperçu tient dans l'écran.
// `zoom` serait plus court ; `transform` est le seul des deux que Firefox et
// Safari traitent pareil, et le tirage annule la transformation de toute façon.

const A4_PX = A4.largeur * 96 / 25.4   // 210 mm à 96 dpi ≈ 794 px

const useEchelleFeuille = () => {
  const cadre  = useRef(null)   // largeur disponible
  const docRef = useRef(null)   // le document à sa taille réelle
  const [echelle, setEchelle] = useState(1)
  const [hauteurDoc, setHauteurDoc] = useState(0)

  useEffect(() => {
    const zone = cadre.current
    if (!zone) return
    const mesurer = () => {
      const dispo = zone.clientWidth
      if (dispo) setEchelle(Math.min(1, dispo / A4_PX))   // jamais d'agrandissement
      if (docRef.current) setHauteurDoc(docRef.current.scrollHeight)
    }
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(zone)
    if (docRef.current) ro.observe(docRef.current)
    window.addEventListener('orientationchange', mesurer)
    return () => { ro.disconnect(); window.removeEventListener('orientationchange', mesurer) }
  })

  return { cadre, docRef, echelle, hauteurDoc }
}

function Feuille({ prov, titre, bandeau, page, total, etabliLe, mention, children }) {
  return (
    <div className="feuille" style={{
      width: `${A4.largeur}mm`,
      minHeight: `${A4.hauteur}mm`,
      padding: `${A4.marge}mm`,
      background: '#fff',
      color: '#0f172a',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '4mm',
      boxShadow: '0 8px 30px rgba(15,23,42,.14)',
      margin: '0 auto 6mm',
      fontSize: '3mm',
      lineHeight: 1.5,
      // `relative` sert d'ancre à la bordure : sans lui elle se placerait
      // par rapport à la page entière et non par rapport à la feuille.
      position: 'relative',
    }}>
      <BordureDouble prov={prov} />
      <EnTete prov={prov} titre={titre} bandeau={page === 1 ? bandeau : null} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4mm' }}>
        {children}
      </div>
      <Pied prov={prov} page={page} total={total} etabliLe={etabliLe} mention={mention} />
    </div>
  )
}

// ─── Bloc d'identification ──────────────────────────────────────────────────

function Identification({ prov, champs }) {
  if (!champs?.length) return null
  return (
    <div style={{
      background: prov.fond, borderRadius: '3mm', padding: '4mm 5mm',
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(38mm, 1fr))',
      gap: '3mm', breakInside: 'avoid', pageBreakInside: 'avoid',
    }}>
      {champs.map((c, i) => (
        <div key={i} style={c.large ? { gridColumn: '1 / -1' } : undefined}>
          <span style={{
            fontSize: '2.2mm', fontWeight: 900, color: prov.accent,
            textTransform: 'uppercase', letterSpacing: '.07em', display: 'block',
          }}>{c.cle}</span>
          <span style={{ fontSize: '3.2mm', fontWeight: 800, color: '#0f172a' }}>
            {c.valeur}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Le moteur ──────────────────────────────────────────────────────────────

export default function DocumentPrintStudio({
  type = 'pedagogie',
  documentTitle = 'DOCUMENT OFFICIEL',
  subTitlePill = null,
  eleveInfo = null,
  /** Métadonnées présentées en tête de document : [{ cle, valeur, large }] */
  meta = null,
  /** Découpe le contenu en feuilles A4 réelles, sans couper aucun bloc.
   *  Réservé aux documents composés de <Bloc>. Les documents historiques
   *  gardent le rendu d'un seul tenant tant qu'ils n'y sont pas convertis. */
  pagine = false,
  /** Nom du fichier JPEG, sans extension. */
  nomFichier = 'Document_IDEAL',
  children,
  onClose = null,
  onPrint = null,
}) {
  const prov = provenanceDe(type)
  const etabliLe = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  // Bloc d'identification. `meta` est la forme moderne ; `eleveInfo` reste
  // accepté pour les quatre documents qui l'utilisent déjà.
  const champs = meta || (eleveInfo ? [
    eleveInfo.nom && { cle: 'Élève / concerné', valeur: eleveInfo.nom },
    eleveInfo.matricule && { cle: 'Matricule', valeur: eleveInfo.matricule },
    eleveInfo.classe && { cle: 'Classe', valeur: eleveInfo.classe },
    eleveInfo.date && { cle: 'Date de délivrance', valeur: eleveInfo.date },
  ].filter(Boolean) : null)

  // Les unités que la pagination répartit. L'identification en fait partie :
  // l'oublier ferait déborder la première feuille de sa propre hauteur.
  const unites = !pagine ? null : [
    ...(champs?.length ? [<Identification key="id" prov={prov} champs={champs} />] : []),
    // Les commandes d'écran — bandeau WhatsApp, boutons — portent
    // `className="no-print"`. Elles ne sont pas du document : les compter
    // comme unité réserverait leur hauteur en haut de la première page, et
    // laisserait un trou sur le papier.
    ...React.Children.toArray(children).filter(
      e => e && !(React.isValidElement(e) && e.props?.className === 'no-print')),
  ]

  // Les indications posées sur les blocs, lues AVANT la répartition. Le
  // décalage tient compte du bloc d'identification, inséré en tête quand des
  // champs sont fournis : sans lui, les indices désigneraient le mauvais bloc.
  // Mémorisées : la répartition les lit dans un effet, et un `Set` reconstruit
  // à chaque rendu relancerait la mise en page sans fin.
  const { sautsForces, mentions } = useMemo(() => {
    const decalage = champs?.length ? 1 : 0
    const utiles = React.Children.toArray(children).filter(
      e => e && !(React.isValidElement(e) && e.props?.className === 'no-print'))
    const sauts = new Set(
      utiles.flatMap((e, i) => (React.isValidElement(e) && e.props?.sautAvant) ? [i + decalage] : []))
    const m = {}
    utiles.forEach((e, i) => {
      if (React.isValidElement(e) && e.props?.mention) m[i + decalage] = e.props.mention
    })
    return { sautsForces: sauts, mentions: m }
  }, [children, champs])

  const mesureRef = useRef(null)
  const [pages, setPages] = useState(null)
  const [enExport, setEnExport] = useState(false)
  const [motExport, setMotExport] = useState(null)

  // Mesure puis répartition. La colonne de mesure est rendue hors écran mais
  // dans le flux : un élément en `display:none` n'a pas de hauteur, et toutes
  // les mesures vaudraient zéro.
  useLayoutEffect(() => {
    if (!pagine || !mesureRef.current) return
    const enfants = [...mesureRef.current.children]
    if (!enfants.length) { setPages([[]]); return }
    const hauteurs = enfants.map(el => el.getBoundingClientRect().height)
    const utile = HAUTEUR_UTILE_MM * MM_EN_PX
    hauteurs.forEach((h, i) => {
      if (h > utile) console.warn(
        `[moteur documentaire] le bloc ${i} mesure ${Math.round(h)} px pour ` +
        `${Math.round(utile)} px utiles : il débordera de sa feuille. ` +
        `Scindez-le en plusieurs <Bloc>.`
      )
    })
    setPages(repartir(hauteurs, utile, 4 * MM_EN_PX, sautsForces))
  }, [pagine, children, meta, eleveInfo, sautsForces])

  // ── Impression ────────────────────────────────────────────────────────────
  //
  // On recopie le seul document dans une fenêtre neuve. `window.print()`
  // imprimait la page entière : la barre de navigation, les onglets et le
  // formulaire de saisie sortaient avec le document, serrés dans une colonne
  // large comme un téléphone.
  const imprimer = () => {
    if (onPrint) { onPrint(); return }
    const doc = document.getElementById('ideal-document')
    if (!doc) { window.print(); return }
    const w = window.open('', '_blank')
    if (!w) { window.print(); return }   // fenêtre bloquée : ancien comportement

    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
      <title>${documentTitle}</title>
      <style>
        @page { size: A4; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; background: #fff;
               font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
        /* Le cadre d'écran — ombre portée, coins arrondis — n'a pas de sens
           sur du papier : il mange la marge utile. */
        .feuille { box-shadow: none !important; border-radius: 0 !important;
                   margin: 0 !important; position: relative; }
        /* La bordure double est à 6 mm du bord : la marge @page est nulle,
           elle tombe donc dans la zone imprimable de toutes les imprimantes
           courantes, dont la marge matérielle dépasse rarement 5 mm. */
        /* Chaque feuille occupe exactement une page, et l'on ne coupe ni un
           bloc, ni une ligne de tableau, ni un titre détaché de sa suite. */
        .feuille { break-after: page; page-break-after: always; }
        .feuille:last-child { break-after: auto; page-break-after: auto; }
        [data-bloc], tr, h6 { break-inside: avoid; page-break-inside: avoid; }
        h6 { break-after: avoid; page-break-after: avoid; }
        img { max-width: 100% !important; }
        .no-print { display: none !important; }
        /* L'apercu a l'ecran met le document a l'echelle pour tenir dans la
           fenetre : un transform scale() pose en style INLINE. La fonction
           d'impression recopie outerHTML, donc ce style part avec elle. Sur
           un telephone, imprimer sortait un document a 47 % cale en haut a
           gauche. App.css a bien la regle qui l'annule, mais elle ne couvre
           que le Ctrl+P direct, pas cette fenetre-ci. */
        #ideal-document { transform: none !important; width: auto !important;
                          height: auto !important; }
      </style></head><body>${doc.outerHTML}</body></html>`)
    w.document.close()

    // Laisser les images arriver avant d'ouvrir la boîte d'impression, sans
    // quoi les exercices photographiés sortent en cadres vides.
    const lancer = () => { w.focus(); w.print() }
    const images = [...w.document.images]
    if (!images.length) { setTimeout(lancer, 200); return }
    let restantes = images.length
    const fini = () => { if (--restantes <= 0) setTimeout(lancer, 100) }
    images.forEach(img => (img.complete ? fini() : (img.onload = fini, img.onerror = fini)))
    setTimeout(lancer, 4000)   // filet si une image ne répond jamais
  }

  // ── Export JPEG haute définition ──────────────────────────────────────────
  //
  // Le réglage vient de l'affiche du menu de la cuisinière, qui sert de
  // référence de qualité : rendu à trois fois la résolution écran, JPEG 0.98.
  // Chaque feuille donne une image, pour que rien ne soit réduit ni recadré.
  const exporterJpeg = async () => {
    const feuilles = [...document.querySelectorAll('#ideal-document .feuille')]
    if (!feuilles.length) return
    setEnExport(true)
    setMotExport('Génération du visuel…')
    // `setEnExport(true)` retire le zoom d'aperçu, mais React ne l'a pas
    // encore peint quand `html2canvas` cloner le DOM : l'appel se fait avant
    // le premier point de suspension. Deux trames garantissent que le style
    // est appliqué — une seule ne suffit pas, le style est posé pendant la
    // première.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    try {
      for (let i = 0; i < feuilles.length; i++) {
        const canvas = await html2canvas(feuilles[i], {
          scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false,
        })
        const lien = document.createElement('a')
        lien.download = feuilles.length > 1
          ? `${nomFichier}_page${i + 1}.jpg`
          : `${nomFichier}.jpg`
        lien.href = canvas.toDataURL('image/jpeg', 0.98)
        lien.click()
        if (i < feuilles.length - 1) await new Promise(r => setTimeout(r, 400))
      }
      setMotExport(feuilles.length > 1
        ? `${feuilles.length} images enregistrées.`
        : 'Image enregistrée.')
    } catch (e) {
      console.error('[moteur documentaire] export JPEG :', e)
      setMotExport("L'image n'a pas pu être créée. Le document reste imprimable.")
    } finally {
      setEnExport(false)
      setTimeout(() => setMotExport(null), 5000)
    }
  }

  const commun = {
    prov, titre: documentTitle, bandeau: subTitlePill || prov.bandeau, etabliLe,
  }

  const { cadre, docRef, echelle, hauteurDoc } = useEchelleFeuille()
  const reduit = echelle < 1 && !enExport

  return (
    <ProvenanceContext.Provider value={prov}>
      {/* Une surcouche, et non un bloc inséré dans la page.
          `print-modal-container` n'avait aucun style : le document A4 était
          poussé dans le flux de l'écran qui l'appelait, sous le contenu
          existant, et débordait de la largeur du téléphone. */}
      <div className="print-modal-container" role="dialog" aria-modal="true"
           aria-label={documentTitle}
           style={{
             fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
             position: 'fixed', inset: 0, zIndex: 1200,
             background: 'rgba(13,42,59,.55)',
             overflowY: 'auto', overflowX: 'hidden',
             WebkitOverflowScrolling: 'touch',
             padding: 'max(12px, env(safe-area-inset-top)) 12px calc(24px + env(safe-area-inset-bottom))',
             overscrollBehavior: 'contain',
           }}>

        {/* Barre de contrôle — jamais imprimée */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12, background: '#fff', padding: '14px 16px',
          borderRadius: 16, border: `2px solid ${prov.accent}`, marginBottom: 16,
          boxShadow: '0 4px 16px rgba(0,0,0,.06)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 900, color: prov.accent,
              textTransform: 'uppercase', letterSpacing: '.08em',
            }}>{prov.service}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a',
                          lineHeight: 1.3, overflowWrap: 'anywhere' }}>
              {documentTitle}
            </div>
            {pages && pages.length > 1 && (
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                {pages.length} pages
              </div>
            )}
          </div>

          <div className="actions-doc">
            {motExport && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                {motExport}
              </span>
            )}
            <button onClick={imprimer} style={{
              background: `linear-gradient(135deg, ${prov.accent}, ${prov.appui})`,
              color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10,
              fontWeight: 900, fontSize: 13, cursor: 'pointer',
              boxShadow: `0 4px 14px ${prov.accent}55`,
            }}>Imprimer / PDF</button>
            <button onClick={exporterJpeg} disabled={enExport} style={{
              background: enExport ? '#cbd5e1' : '#0f172a', color: '#fff',
              border: 'none', padding: '10px 18px', borderRadius: 10,
              fontWeight: 900, fontSize: 13,
              cursor: enExport ? 'default' : 'pointer',
            }}>{enExport ? 'Génération…' : 'Image JPEG'}</button>
            {onClose && (
              <button onClick={onClose} style={{
                background: '#e2e8f0', color: '#334155', border: 'none',
                padding: '10px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer',
              }}>Fermer</button>
            )}
          </div>
        </div>

        {/* Colonne de mesure : rendue hors écran, jamais imprimée, le temps de
            connaître la hauteur de chaque bloc. */}
        {pagine && !pages && (
          <div ref={mesureRef} aria-hidden="true" className="no-print" style={{
            position: 'absolute', left: -99999, top: 0, visibility: 'hidden',
            width: `${A4.largeur - 2 * A4.marge}mm`,
            fontSize: '3mm', lineHeight: 1.5,
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          }}>
            {unites}
          </div>
        )}

        {/* Cadre de mesure : il occupe la largeur disponible et fixe l'échelle.
            Sa hauteur suit celle du document réduit, sinon la surcouche
            garderait la hauteur d'un A4 pleine taille sous le contenu. */}
        <div ref={cadre} style={{ width: '100%' }}>
          <div style={{
            height: reduit ? `${hauteurDoc * echelle}px` : undefined,
            overflow: 'hidden',
          }}>
            {/* html2canvas capture mal un élément dont un ancêtre porte une
                transformation : l'image sortirait à la taille réduite de
                l'écran. Le temps de l'export, le document reprend sa taille
                réelle — l'aperçu saute une seconde, l'image reste en A4. */}
            <div id="ideal-document" ref={docRef} style={{
              transform: reduit ? `scale(${echelle})` : undefined,
              transformOrigin: 'top left',
              width: reduit ? `${A4_PX}px` : undefined,
            }}>
            {!pagine ? (
              // Documents historiques : un seul tenant, en-tête et pied
              // compris. La feuille de style d'impression empêche désormais la
              // coupure au milieu d'un bloc ou d'une ligne de tableau.
              <Feuille {...commun} page={1} total={1}>
                <Identification prov={prov} champs={champs} />
                {children}
              </Feuille>
            ) : !pages ? (
              <div style={{
                width: `${A4.largeur}mm`, maxWidth: '100%', minHeight: '80mm',
                margin: '0 auto', background: '#fff', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#94a3b8', fontSize: 13, fontWeight: 600,
              }}>Mise en page…</div>
            ) : (
              pages.map((indices, p) => (
                /* La mention se REPORTE : une page qui ne contient que des
                   fiches, sans bloc porteur, garde le nom de l'enfant à qui
                   elles appartiennent. Sans report, la page 2 d'un cahier
                   n'aurait plus de destinataire. */
                <Feuille key={p} {...commun} page={p + 1} total={pages.length}
                         mention={indices.map(i => mentions[i]).find(Boolean)
                           ?? [...Array(indices[0] ?? 0).keys()].reverse().map(i => mentions[i]).find(Boolean)}>
                  {indices.map(i => (
                    <div key={i} data-bloc="">{unites[i]}</div>
                  ))}
                </Feuille>
              ))
            )}
            </div>
          </div>
        </div>
      </div>
    </ProvenanceContext.Provider>
  )
}
