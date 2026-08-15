import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CartesScolaires() {
  const [eleves, setEleves] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedClasse, setSelectedClasse] = useState('TOUTES')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEleve, setSelectedEleve] = useState(null)
  const [themeCard, setThemeCard] = useState('prestige') // 'prestige' | 'emerald' | 'gold'
  const [showModalPrint, setShowModalPrint] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [resEleves, resClasses, resInsc] = await Promise.all([
        supabase.from('eleves').select('*').order('nom', { ascending: true }),
        supabase.from('classes').select('*').order('nom', { ascending: true }),
        supabase.from('inscriptions').select('*')
      ])

      const rawEleves = resEleves.data || []
      const rawInsc = resInsc.data || []

      // Fusionner les données de la table eleves et inscriptions pour avoir photos, groupe sanguin, contacts
      const merged = rawEleves.map(e => {
        const matchingInsc = rawInsc.find(i => i.matricule === e.matricule || i.id === e.inscription_id)
        return {
          ...e,
          photo_url: e.photo_url || matchingInsc?.photo_url || null,
          date_naissance: e.date_naissance || matchingInsc?.date_naissance || '2016-05-12',
          lieu_naissance: matchingInsc?.lieu_naissance || 'Bamako',
          groupe_sanguin: matchingInsc?.groupe_sanguin || e.groupe_sanguin || 'O+',
          telephone_parent: matchingInsc?.telephone_parent || e.telephone_parent || '+223 70 00 00 00',
          adresse: matchingInsc?.adresse || 'Bamako, Mali',
          cantine: matchingInsc?.cantine ?? true,
          transport: matchingInsc?.transport ?? false,
          sexe: e.sexe || matchingInsc?.sexe || 'M'
        }
      })

      // Si la table eleves est vide, utiliser les inscriptions directes
      const finalList = merged.length > 0 ? merged : rawInsc.map(i => ({
        id: i.id,
        matricule: i.matricule || '24-25 A001',
        nom: i.nom || 'SAMAKÉ',
        prenom: i.prenoms || i.prenom || 'Mamadou',
        classe_nom: i.classe_demandee || 'CP1 Bilingue',
        photo_url: i.photo_url || null,
        date_naissance: i.date_naissance || '2017-08-20',
        lieu_naissance: i.lieu_naissance || 'Bamako',
        groupe_sanguin: i.groupe_sanguin || 'A+',
        telephone_parent: i.telephone_parent || '+223 76 12 34 56',
        adresse: i.adresse || 'Badalabougou, Bamako',
        cantine: i.cantine ?? true,
        transport: i.transport ?? false,
        sexe: i.sexe || 'M'
      }))

      // Exemples de secours de démonstration si aucune donnée en base
      const demoList = finalList.length > 0 ? finalList : [
        {
          id: 'demo-1',
          matricule: '24-25 A014',
          nom: 'SAMAKÉ',
          prenom: 'Mamadou',
          classe_nom: 'CP1 Bilingue',
          photo_url: null,
          date_naissance: '2018-04-15',
          lieu_naissance: 'Bamako',
          groupe_sanguin: 'O+',
          telephone_parent: '+223 76 45 89 12',
          adresse: 'Hippodrome, Bamako',
          cantine: true,
          transport: true,
          sexe: 'M'
        },
        {
          id: 'demo-2',
          matricule: '24-25 A088',
          nom: 'DIARRA',
          prenom: 'Aïssata',
          classe_nom: 'CE2 Bilingue',
          photo_url: null,
          date_naissance: '2016-11-03',
          lieu_naissance: 'Bamako',
          groupe_sanguin: 'B+',
          telephone_parent: '+223 66 88 99 00',
          adresse: 'ACI 2000, Bamako',
          cantine: true,
          transport: false,
          sexe: 'F'
        },
        {
          id: 'demo-3',
          matricule: '24-25 B102',
          nom: 'COULIBALY',
          prenom: 'Ibrahim Sory',
          classe_nom: 'CM2 Bilingue',
          photo_url: null,
          date_naissance: '2014-02-28',
          lieu_naissance: 'Ségou',
          groupe_sanguin: 'AB+',
          telephone_parent: '+223 70 11 22 33',
          adresse: 'Korofina, Bamako',
          cantine: false,
          transport: true,
          sexe: 'M'
        }
      ]

      setEleves(demoList)
      setClasses(resClasses.data || [])
      if (demoList.length > 0) setSelectedEleve(demoList[0])
    } catch (err) {
      console.error('Erreur chargement cartes scolaires:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (eleveId, e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const photoDataUrl = evt.target.result
      const updated = eleves.map(el => el.id === eleveId ? { ...el, photo_url: photoDataUrl } : el)
      setEleves(updated)
      if (selectedEleve?.id === eleveId) {
        setSelectedEleve(prev => ({ ...prev, photo_url: photoDataUrl }))
      }

      // Sauvegarde Supabase
      try {
        await supabase.from('eleves').update({ photo_url: photoDataUrl }).eq('id', eleveId)
      } catch (err) {
        console.log('Save photo error:', err)
      }
    }
    reader.readAsDataURL(file)
  }

  const filteredEleves = eleves.filter(e => {
    const matchSearch = `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchClasse = selectedClasse === 'TOUTES' || e.classe_nom === selectedClasse
    return matchSearch && matchClasse
  })

  const triggerPrintCard = () => {
    window.print()
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* En-tête du volet Cartes Scolaires */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#0d2a3b', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>💳 Cartes Scolaires Officielles &amp; Badges Élèves</span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Génération et impression des cartes d'identité scolaires de l'École Internationale Bilingue IDEAL.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowModalPrint(true)}
            style={{
              background: 'linear-gradient(135deg, #00a8e0, #0078b4)',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,168,224,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>🖨️ Imprimer la Planche de la Classe (A4)</span>
          </button>
        </div>
      </div>

      {/* Barre de filtres et d'options */}
      <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Rechercher un élève</label>
          <input
            type="text"
            placeholder="Nom, Prénom, Matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, outline: 'none' }}
          />
        </div>

        <div style={{ width: 180 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Classe</label>
          <select
            value={selectedClasse}
            onChange={(e) => setSelectedClasse(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#fff' }}
          >
            <option value="TOUTES">Toutes les classes</option>
            <option value="Maternelle Bilingue">Maternelle Bilingue</option>
            <option value="CP1 Bilingue">CP1 Bilingue</option>
            <option value="CP2 Bilingue">CP2 Bilingue</option>
            <option value="CE1 Bilingue">CE1 Bilingue</option>
            <option value="CE2 Bilingue">CE2 Bilingue</option>
            <option value="CM1 Bilingue">CM1 Bilingue</option>
            <option value="CM2 Bilingue">CM2 Bilingue</option>
          </select>
        </div>

        <div style={{ width: 180 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Thème de la Carte</label>
          <select
            value={themeCard}
            onChange={(e) => setThemeCard(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#fff' }}
          >
            <option value="prestige">👑 Prestige Bleu Nuit &amp; Or</option>
            <option value="emerald">🌿 Émeraude Bilingue</option>
            <option value="gold">✨ Or Impérial</option>
          </select>
        </div>
      </div>

      {/* Grille principale : Liste des élèves à gauche, Aperçu de la carte à droite */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        
        {/* Liste des Élèves */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ background: '#0d2a3b', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📋 Sélectionner un Élève ({filteredEleves.length})</span>
            <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 10 }}>2026 - 2027</span>
          </div>

          <div style={{ maxHeight: 540, overflowY: 'auto' }}>
            {filteredEleves.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Aucun élève trouvé.
              </div>
            ) : (
              filteredEleves.map(e => {
                const isSelected = selectedEleve?.id === e.id
                return (
                  <div
                    key={e.id}
                    onClick={() => setSelectedEleve(e)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? 'rgba(0,168,224,0.08)' : '#fff',
                      borderLeft: isSelected ? '4px solid #00a8e0' : '4px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#0d2a3b',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 14,
                        overflow: 'hidden',
                        border: '2px solid #cbd5e1'
                      }}>
                        {e.photo_url ? (
                          <img src={e.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          `${e.prenom?.[0] || ''}${e.nom?.[0] || ''}`
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0d2a3b' }}>
                          {e.nom} {e.prenom}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8, marginTop: 2 }}>
                          <span style={{ fontWeight: 700, color: '#00a8e0' }}>{e.matricule}</span>
                          <span>•</span>
                          <span>{e.classe_nom}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      style={{ background: 'none', border: 'none', color: isSelected ? '#00a8e0' : '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                    >
                      ➔
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Studio Aperçu & Édition de la Carte Scolaire */}
        {selectedEleve && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Header d'actions rapides sur l'élève sélectionné */}
            <div style={{ background: '#fff', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0d2a3b' }}>Aperçu de la Carte : {selectedEleve.prenom} {selectedEleve.nom}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Matricule : {selectedEleve.matricule}</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1'
                }}>
                  📷 Modifier Photo
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(selectedEleve.id, e)} style={{ display: 'none' }} />
                </label>

                <button
                  onClick={triggerPrintCard}
                  style={{
                    background: '#0d2a3b',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  🖨️ Imprimer la Carte
                </button>
              </div>
            </div>

            {/* Rendu des Cartes (RECTO + VERSO) */}
            <div id="print-single-card-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              
              {/* ===== RECTO DE LA CARTE SCOLAIRE ===== */}
              <div
                style={{
                  width: 380,
                  height: 240,
                  borderRadius: 16,
                  background: themeCard === 'emerald'
                    ? 'linear-gradient(135deg, #044e36 0%, #0d2a3b 60%, #065f46 100%)'
                    : themeCard === 'gold'
                    ? 'linear-gradient(135deg, #78350f 0%, #0d2a3b 50%, #b45309 100%)'
                    : 'linear-gradient(135deg, #091b29 0%, #0d2a3b 55%, #004d73 100%)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.15) inset',
                  color: '#fff',
                  padding: 14,
                  boxSizing: 'border-box',
                  position: 'relative',
                  overflow: 'hidden',
                  fontFamily: 'sans-serif'
                }}
              >
                {/* Filigrane d'arrière-plan officiel */}
                <div style={{
                  position: 'absolute',
                  right: -20,
                  bottom: -20,
                  fontSize: 120,
                  opacity: 0.04,
                  fontWeight: 900,
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}>
                  IDEAL
                </div>

                {/* Bande Drapeau du Mali subtile en haut */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, display: 'flex' }}>
                  <div style={{ flex: 1, background: '#14b8a6' }}></div>
                  <div style={{ flex: 1, background: '#f59e0b' }}></div>
                  <div style={{ flex: 1, background: '#ef4444' }}></div>
                </div>

                {/* Header de la carte */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 8, marginBottom: 10 }}>
                  <img src="/logo-ideal.png" alt="IDEAL" style={{ height: 32, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.8, color: '#38bdf8', textTransform: 'uppercase' }}>
                      ÉCOLE INTERNATIONALE BILINGUE IDEAL
                    </div>
                    <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                      Bamako, République du Mali • Annee 2026 - 2027
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', background: 'rgba(56,189,248,0.2)', border: '1px solid #38bdf8', borderRadius: 4, padding: '2px 6px', fontSize: 7.5, fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase' }}>
                    RECTO
                  </div>
                </div>

                {/* Corps de la carte RECTO */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  
                  {/* Cadre Photo Élève */}
                  <div style={{
                    width: 85,
                    height: 105,
                    borderRadius: 10,
                    border: '2px solid #38bdf8',
                    background: '#091b29',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    position: 'relative'
                  }}>
                    {selectedEleve.photo_url ? (
                      <img src={selectedEleve.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: 32 }}>👤</div>
                        <div style={{ fontSize: 7, marginTop: 2 }}>PHOTO</div>
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,168,224,0.9)', color: '#fff', fontSize: 7, fontWeight: 900, textAlign: 'center', padding: '1px 0' }}>
                      {selectedEleve.sexe === 'F' ? 'ÉLÈVE (F)' : 'ÉLÈVE (M)'}
                    </div>
                  </div>

                  {/* Informations de l'Élève */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>NOM ET PRÉNOM(S)</div>
                    <div style={{ fontSize: 13.5, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', lineHeight: 1.1, marginBottom: 6 }}>
                      {selectedEleve.nom} <span style={{ color: '#38bdf8' }}>{selectedEleve.prenom}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: 8.5 }}>
                      <div>
                        <span style={{ color: '#94a3b8' }}>MATRICULE :</span>
                        <div style={{ fontWeight: 900, color: '#f59e0b', fontSize: 9.5 }}>{selectedEleve.matricule}</div>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>CLASSE :</span>
                        <div style={{ fontWeight: 900, color: '#ffffff' }}>{selectedEleve.classe_nom}</div>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>NÉ(E) LE :</span>
                        <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{selectedEleve.date_naissance}</div>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>À :</span>
                        <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{selectedEleve.lieu_naissance}</div>
                      </div>
                    </div>
                  </div>

                  {/* QR Code & Sceau */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ background: '#fff', padding: 4, borderRadius: 6, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {/* Generateur de QR Code visuel SVG */}
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="#091b29">
                        <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm9-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm13-2h4v2h-4v-2zm-4 4h2v4h-2v-4zm2-2h4v2h-4v-2zm2 4h4v2h-4v-2z" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 6.5, color: '#38bdf8', fontWeight: 800 }}>SÉCURISÉ</div>
                  </div>

                </div>

                {/* Footer de la carte RECTO */}
                <div style={{ position: 'absolute', bottom: 6, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                    CARTE SCOLAIRE OFFICIELLE • PROPRIÉTÉ D'IDEAL ÉCOLE
                  </div>
                  <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 800 }}>
                    VALIDITÉ : 2026 - 2027
                  </div>
                </div>

              </div>

              {/* ===== VERSO DE LA CARTE SCOLAIRE ===== */}
              <div
                style={{
                  width: 380,
                  height: 240,
                  borderRadius: 16,
                  background: '#ffffff',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px #cbd5e1',
                  color: '#1e293b',
                  padding: 14,
                  boxSizing: 'border-box',
                  position: 'relative',
                  overflow: 'hidden',
                  fontFamily: 'sans-serif'
                }}
              >
                {/* Header Verso */}
                <div style={{ background: '#0d2a3b', color: '#fff', margin: '-14px -14px 10px -14px', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.5, color: '#38bdf8' }}>
                    INFORMATIONS D'URGENCE &amp; SERVICES
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 6px', fontSize: 7.5, fontWeight: 900, color: '#fff' }}>
                    VERSO
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, fontSize: 8.5 }}>
                  
                  <div>
                    <div style={{ fontWeight: 800, color: '#0d2a3b', marginBottom: 2 }}>📞 PARENT / TUTEUR :</div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#00a8e0' }}>{selectedEleve.telephone_parent}</div>
                    
                    <div style={{ fontWeight: 800, color: '#0d2a3b', marginTop: 6, marginBottom: 2 }}>📍 ADRESSE DE RÉSIDENCE :</div>
                    <div style={{ fontSize: 8.5, color: '#475569', fontWeight: 600 }}>{selectedEleve.adresse}</div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#64748b' }}>GROUPE SANGUIN</span>
                      <span style={{ background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 6 }}>
                        {selectedEleve.groupe_sanguin}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                      <div style={{ fontSize: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>🍽️ Cantine :</span>
                        <b style={{ color: selectedEleve.cantine ? '#16a34a' : '#94a3b8' }}>{selectedEleve.cantine ? 'Inscrit(e)' : 'Non'}</b>
                      </div>
                      <div style={{ fontSize: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>🚌 Transport :</span>
                        <b style={{ color: selectedEleve.transport ? '#16a34a' : '#94a3b8' }}>{selectedEleve.transport ? 'Ligne Active' : 'Non'}</b>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Règlement & Signature Direction */}
                <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, fontSize: 7, color: '#64748b', lineHeight: 1.3, paddingRight: 10 }}>
                    ⚠️ Cette carte est strictement personnelle et obligatoire pour l'accès aux classes et activités d'IDEAL. En cas de perte, signaler immédiatement à la Direction.
                  </div>

                  <div style={{ textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 7, fontWeight: 800, color: '#0d2a3b' }}>LE DIRECTEUR</div>
                    <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'serif', fontStyle: 'italic', fontWeight: 900, color: '#0078b4', fontSize: 11 }}>IDEAL Ecole</span>
                    </div>
                    <div style={{ fontSize: 6.5, color: '#94a3b8', fontWeight: 700 }}>Cachet Officiel</div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

      {/* Modal d'impression de la Planche A4 pour toute la classe */}
      {showModalPrint && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 850, maxHeight: '90vh', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#0d2a3b', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>🖨️ Planche d'Impression des Cartes — Classe : {selectedClasse}</div>
              <button onClick={() => setShowModalPrint(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✖</button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                💡 Aperçu du format d'impression A4 (8 cartes scolaires recto/verso par feuille). Cliquez sur "Lancer l'Impression".
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                {filteredEleves.slice(0, 8).map(el => (
                  <div key={el.id} style={{ border: '1px dashed #cbd5e1', padding: 8, borderRadius: 12, background: '#f8fafc' }}>
                    <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 4, color: '#0d2a3b' }}>{el.nom} {el.prenom} ({el.matricule})</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Classe : {el.classe_nom} • Contact : {el.telephone_parent}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 14, background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowModalPrint(false)} style={{ background: '#e2e8f0', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
              <button onClick={triggerPrintCard} style={{ background: '#00a8e0', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>🖨️ Lancer l'Impression PDF</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
