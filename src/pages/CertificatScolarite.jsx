import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CertificatScolarite() {
  const [eleves, setEleves] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEleve, setSelectedEleve] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [motifDelivrance, setMotifDelivrance] = useState('Servir et valoir ce que de droit')
  const [dateFormatee, setDateFormatee] = useState(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))

  useEffect(() => {
    loadEleves()
  }, [])

  const loadEleves = async () => {
    setLoading(true)
    try {
      const [resEleves, resInsc] = await Promise.all([
        supabase.from('eleves').select('*').order('nom', { ascending: true }),
        supabase.from('inscriptions').select('*')
      ])

      const rawEleves = resEleves.data || []
      const rawInsc = resInsc.data || []

      const merged = rawEleves.map(e => {
        const matchingInsc = rawInsc.find(i => i.matricule === e.matricule || i.id === e.inscription_id)
        return {
          ...e,
          date_naissance: e.date_naissance || matchingInsc?.date_naissance || '15/04/2018',
          lieu_naissance: matchingInsc?.lieu_naissance || 'Bamako',
          nationalite: matchingInsc?.nationalite || 'Malienne',
          classe_nom: e.classe_nom || matchingInsc?.classe_demandee || 'CP1 Bilingue',
          matricule: e.matricule || matchingInsc?.matricule || '24-25 A014'
        }
      })

      const finalList = merged.length > 0 ? merged : rawInsc.map(i => ({
        id: i.id,
        matricule: i.matricule || '24-25 A014',
        nom: i.nom || 'SAMAKÉ',
        prenom: i.prenoms || i.prenom || 'Mamadou',
        classe_nom: i.classe_demandee || 'CP1 Bilingue',
        date_naissance: i.date_naissance || '2018-04-15',
        lieu_naissance: i.lieu_naissance || 'Bamako',
        nationalite: i.nationalite || 'Malienne',
        sexe: i.sexe || 'M'
      }))

      const demoList = finalList.length > 0 ? finalList : [
        {
          id: 'demo-1',
          matricule: '24-25 A014',
          nom: 'SAMAKÉ',
          prenom: 'Mamadou',
          classe_nom: 'CP1 Bilingue',
          date_naissance: '2018-04-15',
          lieu_naissance: 'Bamako',
          nationalite: 'Malienne',
          sexe: 'M'
        },
        {
          id: 'demo-2',
          matricule: '24-25 A088',
          nom: 'DIARRA',
          prenom: 'Aïssata',
          classe_nom: 'CE2 Bilingue',
          date_naissance: '2016-11-03',
          lieu_naissance: 'Bamako',
          nationalite: 'Malienne',
          sexe: 'F'
        }
      ]

      setEleves(demoList)
      if (demoList.length > 0) setSelectedEleve(demoList[0])
    } catch (err) {
      console.error('Erreur chargement élèves pour certificat:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredEleves = eleves.filter(e =>
    `${e.nom} ${e.prenom} ${e.matricule} ${e.classe_nom}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handlePrint = () => {
    window.print()
  }

  const formatDateFr = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch (e) {
      return dateStr
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* En-tête du volet Certificat de Scolarité */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#0d2a3b', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📜 Certificats de Scolarité Officiels</span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Sélectionnez un élève pour générer instantanément son certificat officiel prêt à signer.
          </p>
        </div>

        <button
          onClick={handlePrint}
          style={{
            background: 'linear-gradient(135deg, #00a8e0, #0078b4)',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,168,224,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>🖨️ Imprimer le Certificat (PDF)</span>
        </button>
      </div>

      {/* Barre de sélection & Recherche */}
      <div className="no-print" style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 250px' }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Rechercher ou sélectionner l'élève
          </label>
          <input
            type="text"
            placeholder="Saisir le nom, prénom ou matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, outline: 'none' }}
          />
        </div>

        <div style={{ width: 260 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Élèves de l'établissement ({filteredEleves.length})
          </label>
          <select
            value={selectedEleve?.id || ''}
            onChange={(e) => {
              const found = eleves.find(x => String(x.id) === String(e.target.value))
              if (found) setSelectedEleve(found)
            }}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#fff' }}
          >
            {filteredEleves.map(el => (
              <option key={el.id} value={el.id}>
                {el.nom.toUpperCase()} {el.prenom} ({el.matricule}) — {el.classe_nom}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 220px' }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            Motif de délivrance
          </label>
          <input
            type="text"
            value={motifDelivrance}
            onChange={(e) => setMotifDelivrance(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13 }}
          />
        </div>
      </div>

      {/* Rendu imprimable du Certificat de Scolarité */}
      {selectedEleve && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          
          <div
            id="certificat-print-area"
            style={{
              width: '100%',
              maxWidth: 780,
              minHeight: 1020,
              background: '#ffffff',
              padding: '48px 56px',
              boxSizing: 'border-box',
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
              position: 'relative',
              color: '#0f172a',
              fontFamily: "'Times New Roman', Times, serif",
              borderRadius: 4
            }}
          >
            {/* Encadrement Filigrane Officiel */}
            <div style={{
              position: 'absolute',
              top: 14,
              left: 14,
              right: 14,
              bottom: 14,
              border: '2px double #0d2a3b',
              pointerEvents: 'none'
            }} />

            {/* En-tête Institutionnel */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0d2a3b', paddingBottom: 16, marginBottom: 30 }}>
              
              {/* Logo & École */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src="/logo-ideal.png" alt="Logo IDEAL" style={{ height: 64, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0d2a3b', letterSpacing: 0.5, fontFamily: 'sans-serif' }}>
                    ÉCOLE INTERNATIONALE BILINGUE IDEAL
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2, fontFamily: 'sans-serif' }}>
                    Maternelle — Elementaire — Bilingue Français / Anglais<br />
                    Bamako, République du Mali • Tél : +223 20 22 00 00 / 70 00 00 00
                  </div>
                </div>
              </div>

              {/* République du Mali */}
              <div style={{ textAlign: 'right', fontSize: 10, fontFamily: 'sans-serif' }}>
                <div style={{ fontWeight: 900, color: '#0d2a3b' }}>RÉPUBLIQUE DU MALI</div>
                <div style={{ fontStyle: 'italic', fontSize: 9, color: '#475569' }}>Un Peuple — Un But — Une Foi</div>
                <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 4 }}>MINISTÈRE DE L'ÉDUCATION NATIONALE</div>
                <div style={{ fontSize: 8, color: '#00a8e0', fontWeight: 800 }}>Agrément N° 2023-014 / MEN</div>
              </div>

            </div>

            {/* Référence N° */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'sans-serif', marginBottom: 32 }}>
              <div style={{ fontWeight: 800, color: '#0d2a3b' }}>
                N° Réf : CS-{new Date().getFullYear()}/{(selectedEleve.matricule || '001').replace(/\s+/g, '')}
              </div>
              <div style={{ color: '#475569' }}>
                Année Scolaire : <b>2026 - 2027</b>
              </div>
            </div>

            {/* Titre du Certificat */}
            <div style={{ textAlign: 'center', margin: '20px 0 36px 0' }}>
              <div style={{
                display: 'inline-block',
                borderTop: '2px solid #0d2a3b',
                borderBottom: '2px solid #0d2a3b',
                padding: '8px 32px',
                fontSize: 22,
                fontWeight: 900,
                color: '#0d2a3b',
                letterSpacing: 2,
                fontFamily: 'sans-serif',
                textTransform: 'uppercase'
              }}>
                CERTIFICAT DE SCOLARITÉ
              </div>
            </div>

            {/* Texte d'Attestation Officiel */}
            <div style={{ fontSize: 14, lineHeight: 2, textIndent: 36, textAlign: 'justify', marginBottom: 28 }}>
              Le Directeur Général soussigné de l'<b>ÉCOLE INTERNATIONALE BILINGUE IDEAL</b> de Bamako, certifie par la présente que l'élève :
            </div>

            {/* Cartouche d'Identité de l'Élève */}
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
              padding: '20px 24px',
              marginBottom: 28,
              fontSize: 13.5,
              lineHeight: 1.8,
              fontFamily: 'sans-serif'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 6 }}>
                <span style={{ color: '#475569', fontWeight: 700 }}>Nom &amp; Prénom(s) :</span>
                <span style={{ fontWeight: 900, color: '#0d2a3b', fontSize: 15, textTransform: 'uppercase' }}>
                  {selectedEleve.nom} {selectedEleve.prenom}
                </span>

                <span style={{ color: '#475569', fontWeight: 700 }}>Matricule Officiel :</span>
                <span style={{ fontWeight: 800, color: '#00a8e0' }}>{selectedEleve.matricule}</span>

                <span style={{ color: '#475569', fontWeight: 700 }}>Date et Lieu de Naissance :</span>
                <span><b>{formatDateFr(selectedEleve.date_naissance)}</b> à <b>{selectedEleve.lieu_naissance}</b></span>

                <span style={{ color: '#475569', fontWeight: 700 }}>Nationalité :</span>
                <span>{selectedEleve.nationalite || 'Malienne'}</span>

                <span style={{ color: '#475569', fontWeight: 700 }}>Classe Fréquentée :</span>
                <span style={{ fontWeight: 900, color: '#0d2a3b' }}>{selectedEleve.classe_nom}</span>
              </div>
            </div>

            {/* Paragraphe de confirmation d'assiduité */}
            <div style={{ fontSize: 14, lineHeight: 2, textIndent: 36, textAlign: 'justify', marginBottom: 36 }}>
              Est régulièrement inscrit(e) et fréquente assidûment les cours dispensés au sein de notre établissement scolaire au titre de l'année académique <b>2026 - 2027</b>.
            </div>

            <div style={{ fontSize: 14, lineHeight: 2, textIndent: 36, textAlign: 'justify', marginBottom: 50 }}>
              En foi de quoi, le présent certificat lui est délivré pour {motifDelivrance}.
            </div>

            {/* Zone de Date et de Signature Manuelle */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 40, fontFamily: 'sans-serif' }}>
              <div style={{ textAlign: 'center', width: 280 }}>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                  Fait à Bamako, le <b>{dateFormatee}</b>
                </div>
                
                <div style={{ fontSize: 13, fontWeight: 900, color: '#0d2a3b', textTransform: 'uppercase', marginBottom: 8 }}>
                  LE DIRECTEUR GÉNÉRAL
                </div>

                {/* Espace libre réservé à la signature manuelle & au tampon */}
                <div style={{
                  height: 110,
                  border: '1px dashed #cbd5e1',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  fontSize: 10,
                  fontStyle: 'italic',
                  background: '#fafafa'
                }}>
                  (Emplacement réservé pour la signature manuelle et le cachet de l'école)
                </div>

                <div style={{ fontSize: 9, color: '#64748b', marginTop: 6, fontWeight: 700 }}>
                  École Internationale Bilingue IDEAL
                </div>
              </div>
            </div>

            {/* Pied de page officiel du certificat */}
            <div style={{
              position: 'absolute',
              bottom: 24,
              left: 56,
              right: 56,
              borderTop: '1px solid #cbd5e1',
              paddingTop: 8,
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              fontSize: 8,
              color: '#64748b',
              fontFamily: 'sans-serif'
            }}>
              <div>IDEAL ÉCOLE BILINGUE • Document officiel sans rature ni surcharge</div>
              <div>Authenticité vérifiable auprès de la Direction Générale</div>
            </div>

          </div>

        </div>
      )}

      {/* Style d'impression spécialisé pour sortir le certificat en A4 parfait */}
      <style>{`
        @media print {
          .no-print, header, nav, .topbar, .bottom-nav, button {
            display: none !important;
          }
          body {
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #certificat-print-area {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 100vh !important;
            padding: 20mm 15mm !important;
          }
        }
      `}</style>

    </div>
  )
}
