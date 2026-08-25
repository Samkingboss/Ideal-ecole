import React, { useState } from 'react'
import DocumentPrintStudio, { Bloc } from './DocumentPrintStudio'
import { HAUTEUR_UTILE_MM } from '../lib/pageA4'
import { lienWhatsAppEcole, WHATSAPP_ECOLE_LISIBLE, NOM_ECOLE } from '../lib/ecole'
import { signature, signatureLigne } from '../lib/identiteProfessionnelle'
import { lireDevoir, regrouperPages, viseEleve } from '../lib/devoirs'

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
          {d.type}{d.periode ? ` · Période ${d.periode}` : ''}
        </div>
        {d.dateRendu && (
          <div style={{ background: '#ffffff', border: '1.5px solid #0284c7', color: '#0284c7', padding: '6px 14px', borderRadius: 10, fontWeight: 800, fontSize: 12 }}>
            ⏰ À rendre pour le <b>{dateLisible(d.dateRendu)}</b>
          </div>
        )}
      </div>

      <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.7, color: '#334155', fontWeight: 600 }}>
        <span style={{ color: '#0284c7', fontWeight: 900 }}>✦ Objectif du devoir : </span>
        {d.objectif || '—'}
      </div>

      {/* L'énoncé — ce que l'élève doit faire. Absent de l'écran intégré. */}
      {d.enonce && (
        <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 16, fontSize: 13.5,
                      lineHeight: 1.7, color: '#334155', marginTop: 10, whiteSpace: 'pre-wrap' }}>
          <span style={{ color: '#0284c7', fontWeight: 900 }}>✦ Ce qu’il faut faire : </span>
          {d.enonce}
        </div>
      )}

      {/* Le barème est TOUJOURS imprimé, avec un repli quand il est vide.
          C'est la règle de l'ancien module : l'élève doit savoir sur quoi il
          sera noté, et l'absence de barème est elle-même une information. */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '12px 16px',
                    borderRadius: 14, fontSize: 12.5, lineHeight: 1.6, color: '#78350f', marginTop: 10,
                    whiteSpace: 'pre-wrap' }}>
        <span style={{ fontWeight: 900 }}>✦ Barème : </span>
        {d.bareme || 'Barème communiqué lors de la correction.'}
      </div>

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
  const messagePour = e => {
    const sesDevoirs = list.filter(d => vise(d, e)).map(lireDevoir)
    const lignes = regrouperPages(sesDevoirs).map(({ tete: d, pages }) => {
      return `• ${d.type} · ${d.matiere || 'Devoir'} : ${d.objectif || 'voir la fiche'}`
           + ` — à rendre le ${dateLisible(d.dateRendu) || 'date indiquée'}`
           + (pages ? ` (${pages} page${pages > 1 ? 's' : ''} jointe${pages > 1 ? 's' : ''})` : '')
    })
    return `📚 À transmettre au parent de *${nomComplet(e)}* (${laClasse})\n\nChers parents, voici les devoirs de votre enfant :\n${lignes.join('\n')}\n\nMerci de l’accompagner et de veiller au respect des échéances.\n\n${signatureLigne(user, contexteSignature)}\n${NOM_ECOLE}`
  }

  return (
    <DocumentPrintStudio
      pagine
      nomFichier="Cahier_devoirs"
      type="pedagogie"
      documentTitle="CAHIER DE DEVOIRS DE MAISON"
      subTitlePill="📖 PROGRAMME PÉDAGOGIQUE • DEVOIRS DE MAISON"
      eleveInfo={{
        nom: `PUBLIPOSTAGE · ${destinataires.length} ÉLÈVES`,
        classe: laClasse,
        date: aujourdhui,
      }}
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
          // Page de garde nominative -- une par enfant, et elle ouvre sa page.
          <Bloc key={'g' + (eleve.id || iPage)} sautAvant={iPage > 0} mention={mention}>
            <div style={{ background: '#0284c7', color: '#fff', borderRadius: 20, padding: '18px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', opacity: .85 }}>DEVOIRS DE MAISON \u2014 {laClasse.toUpperCase()}</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{nomComplet(eleve)}</div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: .9 }}>
                Remis le {aujourdhui} \u00b7 {devoirsEleve.length} devoir{devoirsEleve.length > 1 ? 's' : ''}
              </div>
            </div>
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
          <Bloc key={'p' + (eleve.id || iPage)} mention={mention}>
            <PiedDePage nominatif signataire={signataire} />
          </Bloc>,
        ]
      })}
    </DocumentPrintStudio>
  )
}
