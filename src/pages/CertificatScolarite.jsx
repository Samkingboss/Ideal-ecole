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
        <div style={{ display: 'flex', just          <div
            id="certificat-print-area"
            style={{
              width: 680,
              minHeight: 960,
              background: 'radial-gradient(circle at 50% 35%, #ffffff 0%, #edf7fc 55%, #e0f2fe 100%)',
              padding: '0 0 40px 0',
              boxSizing: 'border-box',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.18)',
              position: 'relative',
              color: '#0f172a',
              fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
              borderRadius: 16,
              overflow: 'hidden',
              border: '1.5px solid #cbd5e1'
            }}
          >
            {/* Liseré Doré & Bleu Double Intérieur */}
            <div style={{ position: 'absolute', top: 50, left: 16, right: 16, bottom: 16, border: '1.5px solid #0b5c8a', pointerEvents: 'none', borderRadius: 8, opacity: 0.3 }} />

            {/* Bandeau Supérieur Bleu Océan (#0b5c8a) avec Chevrons Géométriques */}
            <div style={{ background: '#0b5c8a', height: 75, padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              
              {/* Logo & École à Gauche */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 3 }}>
                <img src="/logo-ideal.png" alt="IDEAL" style={{ height: 44, filter: 'brightness(0) invert(1)' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    ÉCOLE INTERNATIONALE BILINGUE IDEAL
                  </div>
                  <div style={{ fontSize: 8.5, color: '#38bdf8', fontWeight: 700 }}>
                    Maternelle — Élémentaire • Bamako, Mali
                  </div>
                </div>
              </div>

              {/* Chevrons Géométriques en Haut à Droite (45 Degrés) */}
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 220, display: 'flex', zIndex: 2 }}>
                <svg width="220" height="75" viewBox="0 0 220 75" fill="none">
                  <polygon points="40,0 90,0 50,75 0,75" fill="#f59e0b" />
                  <polygon points="90,0 150,0 110,75 50,75" fill="#38bdf8" opacity="0.9" />
                  <polygon points="150,0 220,0 180,75 110,75" fill="#0369a1" />
                </svg>
              </div>

            </div>

            {/* Corps du Document sur Fond Dégradé */}
            <div style={{ padding: '36px 48px 24px 48px', position: 'relative', zIndex: 3 }}>
              
              {/* Grand Titre "CERTIFICAT DE SCOLARITÉ" */}
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#0b5c8a', letterSpacing: 2, textTransform: 'uppercase' }}>
                  CERTIFICAT
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0b5c8a', letterSpacing: 3, textTransform: 'uppercase', marginTop: 2 }}>
                  DE SCOLARITÉ / OF SCHOOL ENROLLMENT
                </div>
                <div style={{ fontSize: 11, fontStyle: 'italic', color: '#64748b', marginTop: 12 }}>
                  Le présent certificat est délivré à / This certificate is issued to :
                </div>
              </div>

              {/* NOM ET PRÉNOM EN TYPOGRAPHIE CALLIGRAPHIQUE ÉLÉGANTE */}
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 34, fontWeight: 700, color: '#0b5c8a', fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: 'italic', letterSpacing: 0.5 }}>
                  {selectedEleve.nom.toUpperCase()} {selectedEleve.prenom}
                </div>
                <div style={{ width: 280, height: 1.5, background: 'linear-gradient(90deg, transparent, #0b5c8a, transparent)', margin: '8px auto 0 auto' }} />
              </div>

              {/* Cartouche d'Informations de l'Élève */}
              <div style={{ maxWidth: 500, margin: '0 auto 32px auto', background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(4px)', padding: '20px 28px', borderRadius: 12, border: '1px solid #bae6fd', boxShadow: '0 4px 14px rgba(11,92,138,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '10px 16px', fontSize: 13.5, lineHeight: 1.6 }}>
                  
                  <div style={{ fontWeight: 800, color: '#0b5c8a' }}>Matricule / Student ID :</div>
                  <div style={{ fontWeight: 900, color: '#0369a1' }}>{selectedEleve.matricule}</div>

                  <div style={{ fontWeight: 800, color: '#0b5c8a' }}>Classe / Grade Level :</div>
                  <div style={{ fontWeight: 900, color: '#0b5c8a' }}>{selectedEleve.classe_nom}</div>

                  <div style={{ fontWeight: 800, color: '#0b5c8a' }}>Date &amp; Lieu de Naissance :</div>
                  <div style={{ color: '#334155', fontWeight: 700 }}>{formatDateFr(selectedEleve.date_naissance)} à {selectedEleve.lieu_naissance}</div>

                  <div style={{ fontWeight: 800, color: '#0b5c8a' }}>Année Scolaire :</div>
                  <div style={{ fontWeight: 900, color: '#0b5c8a' }}>2026 - 2027</div>

                </div>
              </div>

              {/* Texte d'attestation officiel */}
              <div style={{ textAlign: 'center', fontSize: 13, lineHeight: 1.8, color: '#334155', maxWidth: 540, margin: '0 auto 40px auto' }}>
                Le Directeur Général soussigné certifie que l'élève désigné(e) ci-dessus est régulièrement inscrit(e) et fréquente assidûment les cours dispensés au sein de notre établissement pour l'année académique en cours.
                <br />
                <span style={{ fontSize: 12, fontStyle: 'italic', color: '#64748b' }}>En foi de quoi, le présent certificat lui est délivré pour {motifDelivrance}.</span>
              </div>

              {/* Alignement Bas de Page : Date à Gauche, Médaillon au Centre, Signature à Droite */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 10 }}>
                
                {/* Date à gauche */}
                <div style={{ textAlign: 'center', minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#0b5c8a', borderBottom: '1px solid #0b5c8a', paddingBottom: 4 }}>
                    {dateFormatee}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginTop: 4 }}>
                    DATE DE DÉLIVRANCE
                  </div>
                </div>

                {/* Sceau Médaillon Doré au Centre */}
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: '3px solid #ffffff', boxShadow: '0 6px 16px rgba(217,119,6,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff', textAlign: 'center' }}>
                  <div style={{ fontSize: 14 }}>★</div>
                  <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: 0.5 }}>IDEAL</div>
                  <div style={{ fontSize: 6, fontWeight: 800 }}>SEAL</div>
                </div>

                {/* Signature à droite */}
                <div style={{ textAlign: 'center', width: 220 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#0b5c8a', textTransform: 'uppercase', marginBottom: 6 }}>
                    LE DIRECTEUR GÉNÉRAL
                  </div>
                  <div style={{
                    height: 85,
                    border: '1.5px dashed #0b5c8a',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    fontSize: 9,
                    fontStyle: 'italic',
                    background: 'rgba(255,255,255,0.85)'
                  }}>
                    (Signature manuelle &amp; Cachet)
                  </div>
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
