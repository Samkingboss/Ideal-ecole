import React, { useState } from 'react'
import DocumentPrintStudio from './DocumentPrintStudio'

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
  const pieces = item.fichiers?.length
    ? item.fichiers
    : (item.fichier_url ? [{ url: item.fichier_url, nom: item.fichier_nom }] : [])

  return (
    <div style={{ background: '#e0f2fe', borderRadius: 24, padding: '22px 24px', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ background: '#0284c7', color: '#ffffff', padding: '8px 16px', borderRadius: 12, fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '1px' }}>
          📖 {item.matiere}
        </div>
        {item.date_rendu && (
          <div style={{ background: '#ffffff', border: '1.5px solid #0284c7', color: '#0284c7', padding: '6px 14px', borderRadius: 10, fontWeight: 800, fontSize: 12 }}>
            ⏰ À rendre pour le <b>{dateLisible(item.date_rendu)}</b>
          </div>
        )}
      </div>

      <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.7, color: '#334155', fontWeight: 600 }}>
        <span style={{ color: '#0284c7', fontWeight: 900 }}>✦ Objectif du devoir : </span>
        {item.description || '—'}
      </div>

      {/* Les exercices photographiés. Sur le papier une adresse ne sert à
          rien : on imprime l'image elle-même. */}
      {pieces.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {pieces.map((f, k) => (
            <img key={k} src={f.url} alt={f.nom || 'exercice'}
              style={{ maxWidth: '100%', maxHeight: 340, borderRadius: 12, border: '1px solid #bae6fd', background: '#fff' }} />
          ))}
        </div>
      )}
    </div>
  )
}

function PiedDePage({ nominatif }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28, paddingTop: 10, gap: 20 }}>
      <div style={{ background: '#ffffff', borderRadius: 16, padding: '14px 20px', border: '1px solid #bae6fd', flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#0284c7' }}>💡 RECOMMANDATION AUX PARENTS :</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Veuillez accompagner votre enfant durant 20 minutes chaque soir et signer son cahier une fois les exercices terminés.
        </div>
      </div>

      <div style={{ textAlign: 'center', width: 220 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
          {nominatif ? 'Visa du parent' : "L'enseignant titulaire"}
        </div>
        <div style={{ height: 75, background: '#ffffff', border: '2px solid #0284c7', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>
          (Visa &amp; Signature)
        </div>
      </div>
    </div>
  )
}

export default function DevoirsDocument({ devoirsList, classeNom, eleves = [], onClose }) {
  // Par défaut l'exemplaire de classe : c'est le tirage courant, et le
  // publipostage consomme trente feuilles qu'on ne lance pas par mégarde.
  const [nominatif, setNominatif] = useState(false)

  const list = devoirsList || []
  const laClasse = classeNom || 'la classe'
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  if (list.length === 0) {
    return (
      <DocumentPrintStudio type="pedagogie" documentTitle="CAHIER DE DEVOIRS DE MAISON" onClose={onClose}
        subTitlePill="📖 PROGRAMME PÉDAGOGIQUE • TRAVAUX AUTONOMES DU SOIR">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          Aucun devoir enregistré pour {laClasse}. Ajoutez-en un avant d’imprimer.
        </div>
      </DocumentPrintStudio>
    )
  }

  const destinataires = nominatif && eleves.length
    ? eleves.map(e => [e.prenom, e.nom].filter(Boolean).join(' '))
    : [null]

  return (
    <DocumentPrintStudio
      type="pedagogie"
      documentTitle="CAHIER DE DEVOIRS DE MAISON"
      subTitlePill="📖 PROGRAMME PÉDAGOGIQUE • TRAVAUX AUTONOMES DU SOIR"
      eleveInfo={{
        nom: nominatif && eleves.length ? `PUBLIPOSTAGE · ${eleves.length} ÉLÈVES` : `CLASSE DE ${laClasse.toUpperCase()}`,
        classe: laClasse,
        date: aujourdhui,
      }}
      onClose={onClose}
    >
      {/* Le choix du tirage ne s'imprime pas. */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18, padding: '10px 14px', background: '#f1f5f9', borderRadius: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>Tirage :</span>
        <button onClick={() => setNominatif(false)}
          style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            border: '2px solid ' + (!nominatif ? '#0284c7' : '#cbd5e1'),
            background: !nominatif ? '#0284c7' : '#fff', color: !nominatif ? '#fff' : '#64748b' }}>
          Un exemplaire pour la classe
        </button>
        <button onClick={() => setNominatif(true)} disabled={eleves.length === 0}
          style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800,
            cursor: eleves.length ? 'pointer' : 'not-allowed',
            border: '2px solid ' + (nominatif ? '#0284c7' : '#cbd5e1'),
            background: nominatif ? '#0284c7' : '#fff', color: nominatif ? '#fff' : '#64748b',
            opacity: eleves.length ? 1 : .5 }}>
          Un exemplaire par élève ({eleves.length})
        </button>
        {eleves.length === 0 && (
          <span style={{ fontSize: 11, color: '#64748b' }}>Aucun élève inscrit dans cette classe.</span>
        )}
      </div>

      {destinataires.map((nomEleve, iPage) => (
        <div key={iPage} style={iPage > 0 ? { breakBefore: 'page', pageBreakBefore: 'always', paddingTop: 24 } : undefined}>
          {/* Page de garde nominative : le nom de l'élève, en tête de sa
              feuille, pour que le cahier se rende et se signe sans confusion. */}
          {nomEleve && (
            <div style={{ background: '#0284c7', color: '#fff', borderRadius: 20, padding: '18px 24px', marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', opacity: .85 }}>DEVOIRS DE MAISON — {laClasse.toUpperCase()}</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{nomEleve}</div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: .9 }}>Remis le {aujourdhui}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {list.map((item, idx) => <CarteDevoir key={item.id || idx} item={item} />)}
          </div>

          <PiedDePage nominatif={Boolean(nomEleve)} />
        </div>
      ))}
    </DocumentPrintStudio>
  )
}
