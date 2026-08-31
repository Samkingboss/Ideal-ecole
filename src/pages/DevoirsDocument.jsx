import React, { useState } from 'react'
import DocumentPrintStudio, { Bloc } from './DocumentPrintStudio'
import { HAUTEUR_UTILE_MM } from '../lib/pageA4'
import { lienWhatsAppEcole, WHATSAPP_ECOLE_LISIBLE, NOM_ECOLE } from '../lib/ecole'
import { signature, signatureLigne } from '../lib/identiteProfessionnelle'
import { lireDevoir, viseEleve } from '../lib/devoirs'
import { texteWhatsApp } from '../lib/messageParent'
import { titreDocumentDevoirs } from '../lib/devoirsSelection'
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

// `CarteDevoir` a été retiré : il ne portait plus que le cadre de correction
// et le rappel des fiches jointes, tous deux passés sur la page de garde. Un
// composant qui n'a plus de contenu propre n'a plus de raison d'exister — le
// laisser aurait laissé croire qu'une seconde présentation du devoir existe.

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

function PageDeGarde({ eleve, classe, devoirs, signataire, editeLe, titre }) {
  const total = devoirs.reduce((n, d) => n + lireDevoir(d).piecesJointes.length, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* L'école et le titre — ce que lit le parent en premier. */}
      <div style={{ background: '#0284c7', color: '#fff', borderRadius: 20, padding: '20px 24px' }}>
        {/* Le logo a été retiré d'ici. Il figure déjà dans l'en-tête du moteur,
            en haut de la même feuille : deux fois le même sigle à dix
            centimètres d'écart. Le nom de l'école reste — c'est lui que le
            parent lit — et occupe seul la ligne, sans l'indentation qui le
            calait à droite d'une image absente. */}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.2px', opacity: .92, lineHeight: 1.25 }}>
          {NOM_ECOLE.toUpperCase()}
        </div>
        {/* Ce n'est pas un cahier : c'est une fiche que l'enfant COLLE dans
            son cahier. Le titre promettait l'objet dans lequel elle finit. */}
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6, lineHeight: 1.15 }}>
          {titre}
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
              ? `${n} feuille${n > 1 ? 's' : ''} jointe${n > 1 ? 's' : ''} — page${n > 1 ? 's' : ''} suivante${n > 1 ? 's' : ''}`
              : 'Aucune feuille jointe'} />

            {/* Le cadre de correction, rempli à la main : le module n'a aucun
                circuit de note numérique.
                Il vivait dans un bloc à part, qui n'entrait plus sur la page
                de garde et se retrouvait donc SEUL sur la feuille suivante —
                une page presque vide entre la couverture et la première
                fiche. Il appartient à son devoir, et la place ne manquait pas
                ici : il y descend, sous le devoir qu'il sert à corriger.
                Un cadre par devoir : avec deux devoirs, deux notes. */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <div style={{ background: '#ffffff', border: '2px solid #0284c7', borderRadius: 14,
                            padding: '10px 16px', minWidth: 118, textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, fontWeight: 900, color: '#0284c7', letterSpacing: '.06em' }}>NOTE</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#94a3b8', marginTop: 3 }}>…… / 20</div>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #bae6fd', borderRadius: 14,
                            padding: '10px 14px', flex: '1 1 220px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 900, color: '#0284c7', letterSpacing: '.06em' }}>
                  APPRÉCIATION DE L’ENSEIGNANT
                </div>
                <div style={{ borderBottom: '1px dotted #94a3b8', height: 16, marginTop: 8 }} />
                <div style={{ borderBottom: '1px dotted #94a3b8', height: 16, marginTop: 6 }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PiedDePage({ nominatif, signataire }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, paddingTop: 10, gap: 20 }}>
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
  // Position dans la file « toute la classe ». `null` : file non lancée.
  const [fileParents, setFileParents] = useState(null)

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
      <DocumentPrintStudio type="pedagogie" documentTitle="DEVOIRS DE MAISON" onClose={onClose}
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
      nomFichier="Devoirs_de_maison"
      type="pedagogie"
      documentTitle={titreDocumentDevoirs(list)}
      subTitlePill="📖 PROGRAMME PÉDAGOGIQUE • DEVOIRS DE MAISON"
      onClose={onClose}
    >
      {/* ── Informer les parents ──────────────────────────────────────────
          C'était un petit bouton vert au bout d'une ligne grise, à côté d'un
          compteur de fiches : l'enseignante ne le voyait pas. C'est pourtant
          la seule action de cet écran qui atteint les familles.

          Le publipostage ne change pas : un message PAR enfant, vers le
          WhatsApp officiel de l'école, que la vie scolaire relaie. Aucun
          numéro de parent n'entre jamais dans un lien, et deux familles ne
          peuvent pas se voir. */}
      <div className="no-print" style={{ marginBottom: 18, border: '2px solid #16a34a',
                                         borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ background: '#16a34a', color: '#fff', padding: '12px 15px' }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>📲 Informer les parents</div>
          <div style={{ fontSize: 12, opacity: .95, marginTop: 2 }}>
            {destinataires.length} message{destinataires.length > 1 ? 's' : ''} personnalisé{destinataires.length > 1 ? 's' : ''} à préparer · un par enfant
          </div>
        </div>

        <div style={{ padding: '13px 15px', background: '#f0fdf4', display: 'grid', gap: 11 }}>
          <div style={{ fontSize: 11.5, color: '#166534', lineHeight: 1.5 }}>
            Chaque message part vers le WhatsApp officiel de l’école ({WHATSAPP_ECOLE_LISIBLE}),
            qui le transmet à la famille. Aucun numéro de parent n’apparaît, et deux familles
            ne se voient jamais.
          </div>

          {/* ── Toute la classe ─────────────────────────────────────────────
              Le navigateur bloque l'ouverture de vingt onglets d'un coup, et
              l'on ne contourne pas cette protection : on ouvre UNE
              conversation par clic. Chaque clic est un geste de
              l'utilisatrice, donc jamais bloqué, et le lien reste un vrai
              lien — pas un `window.open` déguisé. */}
          {destinataires.length === 0 ? (
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>
              Aucun enfant concerné par les devoirs sélectionnés.
            </div>
          ) : fileParents === null ? (
            <button onClick={() => setFileParents(0)} style={{
              background: '#166534', color: '#fff', border: 'none', borderRadius: 11,
              padding: '13px 16px', fontWeight: 900, fontSize: 14, cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(22,101,52,.28)',
            }}>
              👥 Toute la classe — préparer les {destinataires.length} messages
            </button>
          ) : fileParents < destinataires.length ? (
            <div style={{ display: 'grid', gap: 9 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#166534' }}>
                Message {fileParents + 1} sur {destinataires.length}
              </div>
              <div style={{ height: 7, background: '#dcfce7', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(fileParents / destinataires.length * 100)}%`,
                              background: '#16a34a', transition: 'width .2s' }} />
              </div>
              <a href={lienWhatsAppEcole(messagePour(destinataires[fileParents]))}
                 target="_blank" rel="noreferrer"
                 onClick={() => setFileParents(fileParents + 1)}
                 style={{ display: 'block', textAlign: 'center', textDecoration: 'none',
                          background: '#16a34a', color: '#fff', borderRadius: 11,
                          padding: '13px 16px', fontWeight: 900, fontSize: 14 }}>
                📤 Ouvrir le message pour {nomComplet(destinataires[fileParents])}
              </a>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-sm" onClick={() => setFileParents(fileParents + 1)}>Passer cet enfant</button>
                <button className="btn-sm" onClick={() => setFileParents(null)}>Arrêter</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#166534' }}>
                ✓ Les {destinataires.length} messages ont été ouverts.
              </span>
              <button className="btn-sm" onClick={() => setFileParents(0)}>Reprendre depuis le début</button>
            </div>
          )}

          {/* Les envois un par un restent disponibles : une enseignante qui ne
              veut prévenir qu'une famille n'a pas à dérouler toute la file. */}
          {destinataires.length > 0 && (
            <button className="btn-sm" onClick={() => setMessagesOuverts(!messagesOuverts)}
                    style={{ justifySelf: 'start' }}>
              {messagesOuverts ? '▾ Masquer' : '▸ Choisir'} un enfant en particulier
            </button>
          )}
          {messagesOuverts && <div style={{ display: 'grid', gap: 7 }}>
            {destinataires.map(e => <a key={e.id} href={lienWhatsAppEcole(messagePour(e))} target="_blank" rel="noreferrer"
              style={{ display: 'block', textDecoration: 'none', background: '#fff', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 9, padding: '8px 10px', fontSize: 12, fontWeight: 800 }}>
              📤 Message pour {nomComplet(e)}
            </a>)}
          </div>}
        </div>
      </div>

      {destinataires.flatMap((eleve, iPage) => {
        const devoirsEleve = list.filter(d => vise(d, eleve))
        // Le nom voyage avec chaque unite : le moteur le pose en pied de
        // CHAQUE page, et le reporte sur celles qui n'en portent pas.
        const mention = nomComplet(eleve) + ' \u00b7 ' + laClasse
        // L'identite du dossier, distincte du libelle affiche : deux enfants
        // homonymes d'une meme classe portent la meme mention, jamais le meme
        // dossier. C'est elle qui fait repartir la numerotation a 1.
        const dossier = 'el:' + (eleve.id ?? ('rang-' + iPage))
        return [
          // La page de garde : une par enfant, elle ouvre sa feuille et se
          // suffit a elle-meme.
          <Bloc key={'g' + (eleve.id || iPage)} sautAvant mention={mention} dossier={dossier}>
            <PageDeGarde eleve={nomComplet(eleve)} classe={laClasse} devoirs={devoirsEleve}
                         signataire={signataire} editeLe={aujourdhui}
                         titre={titreDocumentDevoirs(devoirsEleve)} />
            {/* Le visa du parent appartient à la page de garde : c'est là
                qu'on signe. Rendu en bloc séparé, il finissait seul sur une
                feuille — une page blanche de plus par enfant. */}
            <PiedDePage nominatif signataire={signataire} />
          </Bloc>,
          // Chaque devoir est une unite : le moteur ne coupe jamais une carte
          // en deux. Chaque fiche jointe est une unite a part, en pleine page.
          // Plus aucun bloc entre la page de garde et les fiches. Le bloc
          // `CarteDevoir` ne portait plus que le cadre de correction et un
          // rappel du nombre de fiches — les deux sont maintenant sur la page
          // de garde. Le garder aurait maintenu une feuille intermédiaire
          // presque vide dans chaque dossier.
          ...devoirsEleve.flatMap((item, idx) => {
            const dv = lireDevoir(item)
            return [
              ...dv.piecesJointes.map((f2, k) => (
                <Bloc key={'f' + (eleve.id || iPage) + '-' + idx + '-' + k} sautAvant mention={mention} dossier={dossier}>
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
