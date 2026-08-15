import React from 'react'
import DocumentPrintStudio from './DocumentPrintStudio'

export default function DevoirsDocument({ devoirsList, classeNom, onClose }) {
  const list = devoirsList || [
    { id: 1, matiere: 'Mathématiques', titre: 'Exercices de Calcul & Problèmes', consignes: 'Résoudre les exercices 1, 2 et 3 de la page 45 dans le cahier de devoirs du soir.', aRendrePour: 'Lundi 19 Janvier 2026' },
    { id: 2, matiere: 'Lecture & Français', titre: 'Lecture accompagnée', consignes: 'Lire attentivement le chapitre 3 du manuel de français et répondre aux 4 questions au crayon à papier.', aRendrePour: 'Mardi 20 Janvier 2026' },
    { id: 3, matiere: 'English Reading', titre: 'Vocabulary & Spelling', consignes: 'Learn the 10 new vocabulary words on page 28 and write 3 simple sentences.', aRendrePour: 'Jeudi 22 Janvier 2026' }
  ]

  return (
    <DocumentPrintStudio
      type="pedagogie"
      documentTitle="CAHIER DE DEVOIRS DE MAISON"
      subTitlePill="📖 PROGRAMME PÉDAGOGIQUE • TRAVAUX AUTONOMES DU SOIR"
      eleveInfo={{
        nom: `CLASSE DE ${classeNom || 'CP1 BILINGUE'}`,
        classe: classeNom || 'CP1 Bilingue',
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      }}
      onClose={onClose}
    >
      {/* GRILLE DE DEVOIRS EN FONDS PASTEL BLEU OCÉAN SANS BORDURES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {list.map((item, idx) => (
          <div key={item.id || idx} style={{ background: '#e0f2fe', borderRadius: 24, padding: '22px 24px', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ background: '#0284c7', color: '#ffffff', padding: '8px 16px', borderRadius: 12, fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '1px' }}>
                📖 {item.matiere}
              </div>
              <div style={{ background: '#ffffff', border: '1.5px solid #0284c7', color: '#0284c7', padding: '6px 14px', borderRadius: 10, fontWeight: 800, fontSize: 12 }}>
                ⏰ À rendre pour le : <b>{item.aRendrePour || 'Semaine en cours'}</b>
              </div>
            </div>

            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>
              {item.titre}
            </div>

            <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.7, color: '#334155', fontWeight: 600 }}>
              <span style={{ color: '#0284c7', fontWeight: 900 }}>✦ Consignes &amp; Travail à réaliser : </span>
              {item.consignes}
            </div>
          </div>
        ))}
      </div>

      {/* CONSEIL ET SIGNATURE ENSEIGNANT */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28, paddingTop: 10 }}>
        <div style={{ background: '#ffffff', borderRadius: 16, padding: '14px 20px', border: '1px solid #bae6fd', flex: 1, marginRight: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#0284c7' }}>💡 RECOMMANDATION AUX PARENTS :</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Veuillez accompagner votre enfant durant 20 minutes chaque soir et signer son cahier une fois les exercices terminés.
          </div>
        </div>

        <div style={{ textAlign: 'center', width: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
            L'ENSEIGNANT TITULAIRE
          </div>
          <div style={{ height: 75, background: '#ffffff', border: '2px solid #0284c7', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>
            (Visa &amp; Signature)
          </div>
        </div>
      </div>
    </DocumentPrintStudio>
  )
}
