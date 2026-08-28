import React, { useState } from 'react'
import DocumentPrintStudio, { Bloc } from './DocumentPrintStudio'
import { HAUTEUR_UTILE_MM } from '../lib/pageA4'
import { lienWhatsAppEcole, WHATSAPP_ECOLE_LISIBLE, NOM_ECOLE } from '../lib/ecole'
import { signature, signatureLigne } from '../lib/identiteProfessionnelle'
import { lireDevoir, viseEleve } from '../lib/devoirs'
import { texteWhatsApp } from '../lib/messageParent'
import { libellePeriodeStockee } from '../lib/periodeScolaire'

// Le cahier de devoirs imprimable.
//
// Deux façons de sortir le même contenu :
//
//   Un exemplaire pour la classe — une feuille affichée au tableau ou
//   photocopiée telle quelle, sans nom d'élève.
//
//   Un exemplaire par élève (publipostage) — la même liste de devoirs, mais
//   chaque feuille porte le nom de son destinataire et une ligne de visa pour
//   le parent. C'est ce que demande le suivi à la maison : un cahier signé se
//   rend nominativement.
//
// Le publipostage n'imprime pas trente documents séparés : il empile trente
// pages dans un seul, séparées par un saut de page. Une impression, une pile
// à distribuer.

const dateLisible = iso => {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Un devoir, rendu à l'identique dans les deux modes.
function CarteDevoir({ item }) {
  // La lecture passe par la couche unique : un devoir historique porte son
  // type, sa période, son énoncé et son barème, et le papier doit les montrer.
  const d = lireDevoir(item)
  const pieces = d.piecesJointes

  return (
    <div style={{ background: '#e0f2fe', borderRadius: 24, padding: '22px 24px', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ background: '#0284c7', color: '#ffffff', padding: '8px 16px', borderRadius: 12, fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '1px' }}>
          📖 {d.matiere}
        </div>
        {/* Type et période, imprimés par l'ancien module et perdus par
            l'intégré. Ils situent le devoir dans l'année. */}
        <div style={{ background: '#ffffff', border: '1.5px solid #0284c7', color: '#0284c7',
                      padding: '6px 12px', borderRadius: 20, fontWeight: 800, fontSize: 11.5 }}>
          {d.type}{libellePeriodeStockee(d.periode) ? ` · ${libellePeriodeStockee(d.periode)}` : ''}
        </div>
        {d.dateRendu && (
          <div style={{ background: '#ffffff', border: '1.5px solid #0284c7', color: '#0284c7', padding: '6px 14px', borderRadius: 10, fontWeight: 800, fontSize: 12 }}>
            ⏰ À rendre pour le <b>{dateLisible(d.dateRendu)}</b>
          </div>
        )}
      </div>

      {/* Objectif, consigne et bareme ne sont PLUS repetes ici : ils sont sur
          la page de garde, en entier. Les imprimer deux fois allongeait le
          cahier sans rien apprendre, et poussait les fiches plus loin. Cette
          section identifie le devoir et porte son cadre de correction ; les
          feuilles suivent, une par page. */}

      {/* Le cadre de notation, rempli à la main. Le module n'a aucun circuit
          de note numérique : la feuille est faite pour être corrigée au stylo. */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ background: '#ffffff', border: '2px solid #0284c7', borderRadius: 14,
                      padding: '12px 18px', minWidth: 120, textAlign: 'center' }}>
          <div style={{ fontSize: 10.5, fontWeight: 900, color: '#0284c7', letterSpacing: '.06em' }}>NOTE</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#94a3b8', marginTop: 4 }}>…… / 20</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #bae6fd', borderRadius: 14,
                      padding: '12px 16px', flex: '1 1 220px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 900, color: '#0284c7', letterSpacing: '.06em' }}>
            APPRÉCIATION DE L’ENSEIGNANT
          </div>
          <div style={{ borderBottom: '1px dotted #94a3b8', height: 17, marginTop: 9 }} />
          <div style={{ borderBottom: '1px dotted #94a3b8', height: 17, marginTop: 7 }} />
        </div>
      </div>

      {/* Les fiches ne sont plus posees DANS la carte : chacune occupe sa
          propre page, en pleine hauteur. `maxHeight: 340` les reduisait a
          90 mm -- une fiche A4 photographiee sortait au format timbre-poste,
          illisible pour un enfant de CP.

          La carte n'annonce donc plus que leur nombre ; les pages suivent. */}
      {pieces.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800, color: '#0284c7' }}>
          📎 {pieces.length} fiche{pieces.length > 1 ? 's' : ''} jointe{pieces.length > 1 ? 's' : ''}
          <span style={{ fontWeight: 500, color: '#64748b' }}> — page{pieces.length > 1 ? 's' : ''} suivante{pieces.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}

// Une fiche jointe occupe exactement la hauteur utile d'une page, ratio
// conserve.
//
//   `object-fit: contain`, jamais `cover` : `cover` recadre, donc coupe.
//   `display: block`, sans quoi la descendante d'une image en ligne ajoute
//   quatre pixels et fait deborder la page.
//   Aucun `max-height` : la hauteur EST la contrainte.
//
// Zone utile 182 x 214 mm. Une fiche portrait A4 tient en 151 x 214 avec des
// bandes laterales ; une fiche paysage en 182 x 129, centree. Dans les deux
// cas : rien ne depasse, rien n'est coupe.
function FichePleinePage({ piece }) {
  return (
    <img src={piece.url} alt={piece.nom || 'exercice'} style={{
      display: 'block', width: '100%', height: `calc(${HAUTEUR_UTILE_MM}mm - 1mm)`,
      objectFit: 'contain', objectPosition: 'center',
      borderRadius: 12, border: '1px solid #bae6fd', background: '#fff',
      breakInside: 'avoid', pageBreakInside: 'avoid',
    }} />
  )
}

// Un PDF joint ne s'affiche pas dans une balise image : le navigateur refuse
// de le decoder, et le papier ne montrait qu'un cadre vide portant, au mieux,
// le nom du fichier. On le dit, plutot que de faire croire a une fiche.
const estPdf = f => /\.pdf(\?|#|$)/i.test(f?.nom || f?.url || '')

function FicheNonImprimable({ piece }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14,
                  padding: '18px 20px', fontSize: 13, color: '#78350f', fontWeight: 700 }}>
      📄 Document PDF joint — {piece.nom || 'sans nom'}
      <div style={{ fontWeight: 500, marginTop: 6, fontSize: 12 }}>
        Un PDF ne s’imprime pas depuis cette page : ouvrez-le et imprimez-le à part.
      </div>
    </div>
  )
}

// ── La page de garde ───────────────────────────────────────────────────────
//
// Elle occupe UNE feuille et se suffit à elle-même. Ce qui la précédait
// n'était qu'un bandeau posé au-dessus des exercices : le nom de l'enfant, sa
// classe, une date. Un cahier qui part à la maison doit dire, sans qu'on
// tourne la page, ce qui est demandé, pour quand, sur quoi l'enfant sera noté
// et combien de feuilles il doit rapporter.
//
// Un enfant reçoit UNE page de garde, qui résume TOUS ses devoirs
// sélectionnés. Chaque devoir a ensuite sa section détaillée, suivie de ses
// fiches en pleine page. C'est la logique demandée : une garde globale, puis
// une section par devoir.
function LignePorte({ etiquette, valeur }) {
  if (!valeur) return null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, lineHeight: 1.5 }}>
      <span style={{ fontWeight: 900, color: '#0284c7', minWidth: 88, fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase' }}>{etiquette}</span>
      <span style={{ color: '#0f172a', fontWeight: 600, overflowWrap: 'anywhere' }}>{valeur}</span>
    </div>
  )
}

function PageDeGarde({ eleve, classe, devoirs, signataire, editeLe }) {
  const total = devoirs.reduce((n, d) => n + lireDevoir(d).piecesJointes.length, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* L'école et le titre — ce que lit le parent en premier. */}
      <div style={{ background: '#0284c7', color: '#fff', borderRadius: 20, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo-ideal.png" alt="Logo IDEAL" style={{ width: 118, height: 44, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: '5px 8px' }} />
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '1.5px', opacity: .9 }}>
            {NOM_ECOLE.toUpperCase()}<br />ÉCOLE INTERNATIONALE BILINGUE
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6, lineHeight: 1.15 }}>
          Cahier de devoirs de maison
        </div>
        <div style={{ fontSize: 12, marginTop: 8, opacity: .92 }}>
          Remis le {editeLe} · {devoirs.length} devoir{devoirs.length > 1 ? 's' : ''}
          {total > 0 && <> · {total} fiche{total > 1 ? 's' : ''} jointe{total > 1 ? 's' : ''}</>}
        </div>
      </div>

      {/* À qui, et de qui. */}
      <div style={{ background: '#e0f2fe', borderRadius: 16, padding: '16px 20px', display: 'grid', gap: 5 }}>
        <LignePorte etiquette="Élève" valeur={eleve} />
        <LignePorte etiquette="Classe" valeur={classe} />
        <LignePorte etiquette="Enseignant" valeur={signataire?.nom
          ? `${signataire.nom}${signataire.fonction ? ` — ${signataire.fonction}` : ''}` : null} />
      </div>

      {/* Un encart par devoir : tout ce que l'enfant et le parent doivent
          savoir avant d'ouvrir les fiches. Rien n'est tronqué — un objectif
          coupé ne sert à personne. */}
      {devoirs.map((item, i) => {
        const d = lireDevoir(item)
        const n = d.piecesJointes.length
        return (
          <div key={item.id || i} style={{ border: '1.5px solid #bae6fd', borderRadius: 16, padding: '14px 18px', display: 'grid', gap: 5 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ background: '#0284c7', color: '#fff', padding: '5px 12px', borderRadius: 10,
                             fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                {d.matiere || 'Devoir'}
              </span>
              <span style={{ border: '1.5px solid #0284c7', color: '#0284c7', padding: '4px 10px',
                             borderRadius: 20, fontWeight: 800, fontSize: 10.5 }}>
                {d.type}{libellePeriodeStockee(d.periode) ? ` · ${libellePeriodeStockee(d.periode)}` : ''}
              </span>
            </div>
            <LignePorte etiquette="À rendre" valeur={dateLisible(d.dateRendu)} />
            <LignePorte etiquette="Objectif" valeur={d.objectif} />
            <LignePorte etiquette="Consigne" valeur={d.enonce} />
            <LignePorte etiquette="Barème" valeur={d.bareme || 'Communiqué lors de la correction.'} />
            <LignePorte etiquette="Fiches" valeur={n
              ? `${n} feuille${n > 1 ? 's' : ''} jointe${n > 1 ? 's' : ''}`
              : 'Aucune feuille jointe'} />
          </div>
        )
      })}
    </div>
  )
}

function PiedDePage({ nominatif, signataire }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28, paddingTop: 10, gap: 20 }}>
      <div style={{ background: '#ffffff', borderRadius: 16, padding: '14px 20px', border: '1px solid #bae6fd', flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#0284c7' }}>💡 RECOMMANDATION AUX PARENTS :</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Veuillez accompagner votre enfant durant 20 minutes chaque soir et signer son cahier une fois les exercices terminés.
        </div>
      </div>

      {/* Deux signataires, deux rôles distincts : celui qui donne le devoir,
          et celui qui atteste l'avoir vu. Le premier est nommé — un document
          n'est jamais signé d'un nom seul, ni d'une fonction seule. */}
      {signataire?.nom && (
        <div style={{ textAlign: 'center', width: 190 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
            Devoir donné par
          </div>
          <div style={{ height: 75, background: '#ffffff', border: '2px solid #0284c7', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 10px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{signataire.nom}</div>
            <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.3, marginTop: 2 }}>{signataire.fonction}</div>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', width: 190 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
          {nominatif ? 'Visa du parent' : 'Visa de la direction'}
        </div>
        <div style={{ height: 75, background: '#ffffff', border: '2px solid #0284c7', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>
          (Visa &amp; Signature)
        </div>
      </div>
    </div>
  )
}

export default function DevoirsDocument({ devoirsList, classeNom, eleves = [], user = null, onClose }) {
  const [messagesOuverts, setMessagesOuverts] = useState(false)

  const list = devoirsList || []

  // La fonction du signataire dépend de ce que porte le document. Un cahier
  // qui ne traite qu'une matière fait signer « Enseignant de Mathématiques » ;
  // un cahier qui en mêle plusieurs s'en tient au rôle. C'est ce qui permet à
  // un directeur qui enseigne de signer ici son titre d'enseignant, et ailleurs
  // son titre de direction.
  const matieresDuCahier = [...new Set(list.map(d => d.matiere).filter(Boolean))]
  const contexteSignature = {
    role: 'professeur',
    matiere: matieresDuCahier.length === 1 ? matieresDuCahier[0] : null,
  }
  const signataire = signature(user, contexteSignature)
  const laClasse = classeNom || 'la classe'
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  if (list.length === 0) {
    return (
      <DocumentPrintStudio type="pedagogie" documentTitle="CAHIER DE DEVOIRS DE MAISON" onClose={onClose}
        subTitlePill="📖 PROGRAMME PÉDAGOGIQUE • DEVOIRS DE MAISON">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          Aucun devoir enregistré pour {laClasse}. Ajoutez-en un avant d’imprimer.
        </div>
      </DocumentPrintStudio>
    )
  }

  // Le ciblage se lit par la couche unique, jamais par une copie locale.
  //
  // Cette fonction lisait `contenu.destinataire_mode` directement. Sur les
  // cinq devoirs historiques de la base, cette clé n'existe pas : le ciblage
  // y est écrit `contenu.destinataires = { mode: 'choix', eleves: [...] }`.
  // `undefined !== 'choix'` étant vrai, ils étaient tous traités comme
  // s'adressant à TOUTE LA CLASSE.
  //
  // Mesuré : un devoir visant deux enfants sortait trois fiches nominatives,
  // dont une pour un enfant qui n'avait pas ce devoir. La liste de l'écran,
  // elle, annonçait bien deux — l'écran et le papier ne désignaient pas les
  // mêmes enfants, parce qu'ils lisaient le ciblage à deux endroits.
  //
  // `viseEleve` est cet endroit unique. Il existait déjà.
  const vise = (devoir, eleve) => viseEleve(devoir, eleve.id, eleve.matricule)
  // Union des destinataires : chaque enfant reçoit une page nominative ne
  // contenant que les devoirs qui le concernent.
  const destinataires = eleves.filter(e => list.some(d => vise(d, e)))
  const nomComplet = e => [e.prenom, e.nom].filter(Boolean).join(' ')
  // Le message au parent — relayé par le WhatsApp de l'école, jamais envoyé
  // en direct. Il annonce le type et le nombre de feuilles, comme le faisait
  // le sommaire visuel de l'ancien module : le parent sait ce qu'il doit
  // recevoir avant que l'enfant rentre.
  //
  // L'ancienne plateforme créait une ligne par photo : le parent recevait le
  // même devoir annoncé trois fois. Les lignes restent intactes en base — on
  // les REGROUPE à l'affichage, et seulement quand tous les critères sûrs
  // coïncident. Dans le doute, elles s'affichent séparément.
  // Le message au parent n'est PAS le cahier de l'élève. Il répond à trois
  // questions et s'arrête : quoi, pour quand, combien de feuilles. L'objectif
  // pédagogique, l'énoncé et le barème sont sur la fiche que l'enfant
  // rapporte — les répéter ici allonge sans informer, et le parent lit sur un
  // téléphone.
  //
  // Il ne peut plus contenir d'archives : `list` est la sélection de
  // l'enseignant, et rien d'autre n'y entre.
  const messagePour = e => texteWhatsApp({
    devoirs: list.filter(d => vise(d, e)),
    nomEleve: nomComplet(e),
    classe: laClasse,
    signature: signatureLigne(user, contexteSignature),
    ecole: NOM_ECOLE,
  })

  return (
    // Pas d'`eleveInfo` : le moteur en ferait un bloc d'identification qui
    // occuperait une feuille entiere avant la page de garde, en repetant ce
    // qu'elle dit deja. Une page blanche de plus par tirage.
    <DocumentPrintStudio
      pagine
      nomFichier="Cahier_devoirs"
      type="pedagogie"
      documentTitle="CAHIER DE DEVOIRS DE MAISON"
      subTitlePill="📖 PROGRAMME PÉDAGOGIQUE • DEVOIRS DE MAISON"
      onClose={onClose}
    >
      <div className="no-print" style={{ marginBottom: 18, padding: '12px 14px', background: '#f1f5f9', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>{destinataires.length} fiche(s) nominative(s) prête(s)</span>
          <button className="btn-sm" onClick={() => setMessagesOuverts(!messagesOuverts)} style={{ background: '#16a34a', color: '#fff', padding: '8px 13px' }}>📲 Informer les parents via l’école</button>
        </div>
        {messagesOuverts && <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
          <div style={{ fontSize: 11, color: '#475569' }}>Chaque bouton ouvre un message personnalisé vers le WhatsApp officiel de l’école ({WHATSAPP_ECOLE_LISIBLE}). La vie scolaire le transmet ensuite au parent concerné.</div>
          {destinataires.map(e => <a key={e.id} href={lienWhatsAppEcole(messagePour(e))} target="_blank" rel="noreferrer"
            style={{ display: 'block', textDecoration: 'none', background: '#fff', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 9, padding: '8px 10px', fontSize: 12, fontWeight: 800 }}>
            📤 Message pour {nomComplet(e)}
          </a>)}
        </div>}
      </div>

      {destinataires.flatMap((eleve, iPage) => {
        const devoirsEleve = list.filter(d => vise(d, eleve))
        // Le nom voyage avec chaque unite : le moteur le pose en pied de
        // CHAQUE page, et le reporte sur celles qui n'en portent pas.
        const mention = nomComplet(eleve) + ' \u00b7 ' + laClasse
        return [
          // La page de garde : une par enfant, elle ouvre sa feuille et se
          // suffit a elle-meme.
          <Bloc key={'g' + (eleve.id || iPage)} sautAvant mention={mention}>
            <PageDeGarde eleve={nomComplet(eleve)} classe={laClasse} devoirs={devoirsEleve}
                         signataire={signataire} editeLe={aujourdhui} />
            {/* Le visa du parent appartient à la page de garde : c'est là
                qu'on signe. Rendu en bloc séparé, il finissait seul sur une
                feuille — une page blanche de plus par enfant. */}
            <PiedDePage nominatif signataire={signataire} />
          </Bloc>,
          // Chaque devoir est une unite : le moteur ne coupe jamais une carte
          // en deux. Chaque fiche jointe est une unite a part, en pleine page.
          ...devoirsEleve.flatMap((item, idx) => {
            const dv = lireDevoir(item)
            return [
              <Bloc key={'d' + (eleve.id || iPage) + '-' + idx} mention={mention}>
                <CarteDevoir item={item} />
              </Bloc>,
              ...dv.piecesJointes.map((f2, k) => (
                <Bloc key={'f' + (eleve.id || iPage) + '-' + idx + '-' + k} sautAvant mention={mention}>
                  {estPdf(f2) ? <FicheNonImprimable piece={f2} /> : <FichePleinePage piece={f2} />}
                </Bloc>
              )),
            ]
          }),
        ]
      })}
    </DocumentPrintStudio>
  )
}
