import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import NotificationCenter from './NotificationCenter'

const fcfa = n => (Math.round(Number(n) || 0)).toLocaleString('fr-FR') + ' F'

// Menus de démonstration par défaut
const DEFAULT_MENU_SEMAINE = {
  Lundi: {
    entree: 'Salade fraîche de concombres et tomates au sésame',
    plat: 'Riz gras au poulet braisé et petits légumes',
    dessert: 'Mangue fraîche découpée',
    boisson: 'Jus de Bissap maison',
    substitution: 'Poulet grillé nature sans arachide ni sésame'
  },
  Mardi: {
    entree: 'Soupe légère de légumes de saison',
    plat: 'Ragoût de bœuf à la malienne & patates douces',
    dessert: 'Bananes locales',
    boisson: 'Eau minérale fraîche',
    substitution: 'Portion végétale sans viande pour végétariens'
  },
  Mercredi: {
    entree: 'Œufs durs mimosa sur lit de laitue',
    plat: 'Capitaine grillé au four & Alloco (Bananes plantains)',
    dessert: 'Compote de pommes faites maison',
    boisson: 'Jus de Bouye (Pain de singe)',
    substitution: 'Blanc de dinde sans poisson pour allergiques'
  },
  Jeudi: {
    entree: 'Carottes râpées à la vinaigrette douce',
    plat: 'Tchep au poulet et légumes variés',
    dessert: 'Oranges tranchées',
    boisson: 'Jus de Gingembre doux',
    substitution: 'Riz blanc nature et poulet à la vapeur'
  },
  Vendredi: {
    entree: 'Beignets de mérou croustillants',
    plat: 'Couscous de mil au poulet fermier et sauce blé',
    dessert: 'Salade de fruits de saison',
    boisson: 'Eau de coco naturelle',
    substitution: 'Plat sans gluten pour étudiants cœliaques'
  }
}

// Ingrédients du marché par défaut
const DEFAULT_FICHE_MARCHE = {
  budget: 150000,
  articles: [
    { id: 1, nom: 'Poulet fermier frais', quantite: '15 Kg', pu: 2500, achete: true },
    { id: 2, nom: 'Riz parfumé de baguinéda (Sac 50kg)', quantite: '1 Sac', pu: 22500, achete: true },
    { id: 3, nom: 'Huile de tournesol (Bidon 5L)', quantite: '2 Bidons', pu: 8500, achete: true },
    { id: 4, nom: 'Oignons rouges & Ail', quantite: '10 Kg', pu: 600, achete: true },
    { id: 5, nom: 'Tomates fraîches & Piments doux', quantite: '8 Kg', pu: 750, achete: false },
    { id: 6, nom: 'Bananes plantains (Alloco)', quantite: '3 Régimes', pu: 4500, achete: false },
    { id: 7, nom: 'Mangues & Fruits de saison', quantite: '20 Kg', pu: 500, achete: false },
    { id: 8, nom: 'Fleurs de Hibiscus (Bissap)', quantite: '2 Kg', pu: 1500, achete: true }
  ]
}

// Données démo élèves cantine
const DEMO_ELEVES_CANTINE = [
  { id: 'el-1', nom: 'TRAORÉ', prenom: 'Aïcha', classe: 'CP1 Bilingue', cantine: true, allergies: 'Allergie sévère aux Arachides', restrictions: 'Sans Porc' },
  { id: 'el-2', nom: 'SANOGO', prenom: 'Ibrahim', classe: 'CP1 Bilingue', cantine: true, allergies: 'Intolérance au Lactose', restrictions: 'Régime sans produits laitiers' },
  { id: 'el-3', nom: 'COULIBALY', prenom: 'Fatoumata', classe: 'CP2 A', cantine: true, allergies: 'Aucune', restrictions: 'Sans Porc' },
  { id: 'el-4', nom: 'DIARRA', prenom: 'Mamadou', classe: 'CE1 B', cantine: true, allergies: 'Allergie aux Poissons et Crustacés', restrictions: 'Végétarien strict' },
  { id: 'el-5', nom: 'KEITA', prenom: 'Oumar', classe: 'CE2', cantine: true, allergies: 'Aucune', restrictions: 'Aucune' },
  { id: 'el-6', nom: 'SISSOKO', prenom: 'Aminata', classe: 'CM1', cantine: true, allergies: 'Allergie au Gluten', restrictions: 'Sans Gluten' },
  { id: 'el-7', nom: 'KONATÉ', prenom: 'Sékou', classe: 'CM2 Bilingue', cantine: true, allergies: 'Allergie aux Œufs', restrictions: 'Sans Porc' }
]

const getTodayString = () => new Date().toISOString().split('T')[0]

export default function CuisiniereApp({ user, onLogout }) {
  const [tab, setTab] = useState('eleves')
  const [eleves, setEleves] = useState(DEMO_ELEVES_CANTINE)
  const [menuSemaine, setMenuSemaine] = useState(DEFAULT_MENU_SEMAINE)
  const [ficheMarche, setFicheMarche] = useState(DEFAULT_FICHE_MARCHE)
  const [jourSelectionne, setJourSelectionne] = useState('Lundi')
  const [searchEleve, setSearchEleve] = useState('')
  const [filterClasse, setFilterClasse] = useState('ALL')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Pointage Repas (Matin, Midi, Goûter)
  const [datePointage, setDatePointage] = useState(getTodayString())
  const [pointage, setPointage] = useState({
    // 'el-1': { matin: true, midi: true, gouter: false }
  })

  // Modals & Édition
  const [editEleveModal, setEditEleveModal] = useState(null)
  const [newArticleModal, setNewArticleModal] = useState(false)
  const [newArticle, setNewArticle] = useState({ nom: '', quantite: '', pu: 0 })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadPointageForDate(datePointage)
  }, [datePointage])

  const loadData = async () => {
    try {
      setLoading(true)
      // Charger les élèves depuis Supabase
      const { data: dataEleves } = await supabase.from('eleves').select('*').eq('actif', true)
      if (dataEleves && dataEleves.length > 0) {
        const cantineList = dataEleves.map(e => ({
          ...e,
          cantine: e.cantine !== false,
          allergies: e.allergies || (e.id === 'el-1' ? 'Allergie aux Arachides' : 'Aucune'),
          restrictions: e.restrictions || 'Sans Porc'
        }))
        setEleves(cantineList)
      }

      // Charger le menu de la semaine
      const { data: stateMenu } = await supabase.from('app_state').select('value').eq('key', 'cantine_menu_semaine').single()
      if (stateMenu && stateMenu.value) setMenuSemaine(stateMenu.value)

      // Charger la fiche du marché
      const { data: stateMarche } = await supabase.from('app_state').select('value').eq('key', 'cantine_fiche_marche').single()
      if (stateMarche && stateMarche.value) setFicheMarche(stateMarche.value)

    } catch (e) {
      console.warn('Utilisation des données locales de cantine :', e)
    } finally {
      setLoading(false)
    }
  }

  // Charger le pointage d'une date spécifique
  const loadPointageForDate = async (dt) => {
    try {
      const key = `cantine_pointage_${dt}`
      const { data } = await supabase.from('app_state').select('value').eq('key', key).single()
      if (data && data.value) {
        setPointage(data.value)
      } else {
        // Pointage par défaut si aucun enregistrement (Midi coché par défaut)
        const defaultPt = {}
        DEMO_ELEVES_CANTINE.forEach(e => {
          defaultPt[e.id] = { matin: false, midi: true, gouter: false }
        })
        setPointage(defaultPt)
      }
    } catch (e) {
      const defaultPt = {}
      eleves.forEach(e => {
        defaultPt[e.id] = { matin: false, midi: true, gouter: false }
      })
      setPointage(defaultPt)
    }
  }

  // Sauvegarder le pointage du jour dans Supabase
  const savePointage = async (updatedPt) => {
    setPointage(updatedPt)
    try {
      const key = `cantine_pointage_${datePointage}`
      await supabase.from('app_state').upsert({ key, value: updatedPt, updated_at: new Date().toISOString() })
    } catch (e) {
      console.error('Erreur sauvegarde pointage:', e)
    }
  }

  // Toggle du repas (matin, midi, gouter) pour un élève
  const toggleRepas = (eleveId, repasKey) => {
    const current = pointage[eleveId] || { matin: false, midi: false, gouter: false }
    const updated = {
      ...pointage,
      [eleveId]: {
        ...current,
        [repasKey]: !current[repasKey]
      }
    }
    savePointage(updated)
  }

  // Action rapide : Cocher / Décocher tout un repas pour la sélection affichée
  const toggleAllRepasForMeal = (repasKey, value) => {
    const updated = { ...pointage }
    elevesFiltres.forEach(e => {
      const current = updated[e.id] || { matin: false, midi: false, gouter: false }
      updated[e.id] = { ...current, [repasKey]: value }
    })
    savePointage(updated)
    setMsg(`✅ Repas ${repasKey.toUpperCase()} mis à jour pour ${elevesFiltres.length} élève(s).`)
    setTimeout(() => setMsg(''), 3000)
  }

  // Sauvegarder le menu de la semaine
  const saveMenuSemaine = async () => {
    try {
      await supabase.from('app_state').upsert({ key: 'cantine_menu_semaine', value: menuSemaine, updated_at: new Date().toISOString() })
      setMsg('✅ Menu de la semaine enregistré et publié avec succès !')
      setTimeout(() => setMsg(''), 4000)
    } catch (e) {
      alert('Erreur enregistrement menu: ' + e.message)
    }
  }

  // Sauvegarder la fiche du marché
  const saveFicheMarche = async (updatedMarche) => {
    setFicheMarche(updatedMarche)
    try {
      await supabase.from('app_state').upsert({ key: 'cantine_fiche_marche', value: updatedMarche, updated_at: new Date().toISOString() })
    } catch (e) {
      console.error(e)
    }
  }

  // Ajouter un article au marché
  const handleAddArticle = () => {
    if (!newArticle.nom.trim()) return
    const article = {
      id: Date.now(),
      nom: newArticle.nom,
      quantite: newArticle.quantite || '1 Unité',
      pu: Number(newArticle.pu) || 0,
      achete: false
    }
    const updated = { ...ficheMarche, articles: [...ficheMarche.articles, article] }
    saveFicheMarche(updated)
    setNewArticle({ nom: '', quantite: '', pu: 0 })
    setNewArticleModal(false)
    setMsg('🛒 Aliment ajouté à la fiche du marché !')
    setTimeout(() => setMsg(''), 3000)
  }

  // Toggle statut acheté
  const toggleArticleAchete = (id) => {
    const updatedArticles = ficheMarche.articles.map(a => a.id === id ? { ...a, achete: !a.achete } : a)
    saveFicheMarche({ ...ficheMarche, articles: updatedArticles })
  }

  // Supprimer un article
  const deleteArticle = (id) => {
    if (!confirm('Supprimer cet aliment du marché ?')) return
    const updatedArticles = ficheMarche.articles.filter(a => a.id !== id)
    saveFicheMarche({ ...ficheMarche, articles: updatedArticles })
  }

  // Mettre à jour les allergies d'un élève
  const saveEleveAllergie = async () => {
    if (!editEleveModal) return
    const updatedEleves = eleves.map(e => e.id === editEleveModal.id ? editEleveModal : e)
    setEleves(updatedEleves)
    try {
      await supabase.from('eleves').update({ allergies: editEleveModal.allergies, restrictions: editEleveModal.restrictions }).eq('id', editEleveModal.id)
    } catch (e) {}
    setEditEleveModal(null)
    setMsg('✅ Restrictions alimentaires mises à jour !')
    setTimeout(() => setMsg(''), 3000)
  }

  // Filtrage des élèves
  const elevesInscrits = eleves.filter(e => e.cantine !== false)
  const elevesFiltres = elevesInscrits.filter(e => {
    const matchSearch = `${e.nom} ${e.prenom} ${e.classe}`.toLowerCase().includes(searchEleve.toLowerCase())
    const matchClasse = filterClasse === 'ALL' || e.classe === filterClasse
    return matchSearch && matchClasse
  })

  const classesUniques = Array.from(new Set(elevesInscrits.map(e => e.classe || 'CP1'))).sort()
  const nbAllergies = elevesInscrits.filter(e => e.allergies && e.allergies.toLowerCase() !== 'aucune').length
  const totalDepense = ficheMarche.articles.reduce((s, a) => s + (Number(a.pu) * (parseInt(a.quantite) || 1)), 0)
  const resteBudget = ficheMarche.budget - totalDepense

  // Décompte du pointage repas
  const countMatin = elevesInscrits.filter(e => pointage[e.id]?.matin).length
  const countMidi = elevesInscrits.filter(e => pointage[e.id]?.midi).length
  const countGouter = elevesInscrits.filter(e => pointage[e.id]?.gouter).length

  return (
    <div className="app-shell" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Topbar Cuisinière */}
      <div className="topbar" style={{ background: 'linear-gradient(135deg, #0d2a3b, #155e75)', borderBottom: '3px solid #7bc142' }}>
        <div className="topbar-brand">
          <div>
            <div className="topbar-logo" style={{ color: '#7bc142' }}>IDEAL</div>
            <div className="topbar-sub" style={{ color: '#e2e8f0' }}>ESPACE CUISINE &amp; CANTINE IMPÉRIALE</div>
          </div>
        </div>
        <div className="topbar-user" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationCenter user={user} role="cuisiniere" onNavigateTab={setTab} />
          <span className="role-badge" style={{ background: 'linear-gradient(135deg, #7bc142, #5a9a2e)', color: '#0d2a3b', fontWeight: 900 }}>
            👩‍🍳 Chef Cuisinière
          </span>
          <button className="btn-logout" onClick={onLogout}>Déconnexion</button>
        </div>
      </div>

      {/* Barre de navigation des SESSIONS CUISINIÈRE */}
      <div style={{ display: 'flex', alignItems: 'center', position: 'sticky', top: 51, zIndex: 99, background: '#ffffff', borderBottom: '2px solid var(--border)', padding: '6px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: 8, flex: 1, overflowX: 'auto' }}>
          <button
            className={`top-nav-item ${tab === 'eleves' ? 'active' : ''}`}
            onClick={() => setTab('eleves')}
            style={{ padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            🥗 1. Élèves Cantine &amp; Allergies ({elevesInscrits.length})
          </button>
          <button
            className={`top-nav-item ${tab === 'checking' ? 'active' : ''}`}
            onClick={() => setTab('checking')}
            style={{ padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: tab==='checking' ? '#0d2a3b' : '', color: tab==='checking' ? '#7bc142' : '' }}
          >
            📋 2. Checking Repas (Matin, Midi, Goûter)
          </button>
          <button
            className={`top-nav-item ${tab === 'preparation' ? 'active' : ''}`}
            onClick={() => setTab('preparation')}
            style={{ padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            🍳 3. Préparation du Menu
          </button>
          <button
            className={`top-nav-item ${tab === 'menu_jour' ? 'active' : ''}`}
            onClick={() => setTab('menu_jour')}
            style={{ padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            🍲 4. Menu du Jour
          </button>
          <button
            className={`top-nav-item ${tab === 'marche' ? 'active' : ''}`}
            onClick={() => setTab('marche')}
            style={{ padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            🛒 5. Fiche du Marché
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="page-content" style={{ padding: '1.5rem 1.2rem 40px', maxWidth: 1100, margin: '0 auto' }}>
        {msg && <div className="error-msg" style={{ background: 'rgba(123,193,66,0.15)', borderColor: '#7bc142', color: '#275204', marginBottom: 16, borderRadius: 12, padding: '12px 16px', fontWeight: 700 }} onClick={() => setMsg('')}>{msg}</div>}

        {/* ════════════════ SESSION 1 : ÉLÈVES INSCRITS & ALLERGIES ════════════════ */}
        {tab === 'eleves' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>🥗 Session 1 : Élèves Inscrits à la Cantine</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Liste officielle du service de restauration et précisions médicales sur les allergies &amp; régimes spéciaux.</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '8px 14px', borderRadius: 12, fontSize: 12, fontWeight: 800, color: '#991b1b' }}>
                  🚨 {nbAllergies} Élève(s) avec Allergies
                </div>
              </div>
            </div>

            {/* Barre de Recherche & Filtres */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="form-input"
                placeholder="🔍 Rechercher un élève par nom, prénom ou classe..."
                value={searchEleve}
                onChange={e => setSearchEleve(e.target.value)}
                style={{ flex: 1, minWidth: 240 }}
              />
              <select className="form-select" value={filterClasse} onChange={e => setFilterClasse(e.target.value)} style={{ width: 180 }}>
                <option value="ALL">🏫 Toutes les classes</option>
                {classesUniques.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Liste des cartes Élèves avec Badges Allergies */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {elevesFiltres.map(el => {
                const aAllergie = el.allergies && el.allergies.toLowerCase() !== 'aucune'
                const aRestriction = el.restrictions && el.restrictions.toLowerCase() !== 'aucune'

                return (
                  <div key={el.id} className="card" style={{ padding: '16px', borderLeft: aAllergie ? '5px solid #ef4444' : aRestriction ? '5px solid #f59e0b' : '5px solid #10b981', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#0d2a3b' }}>
                          {(el.nom || '').toUpperCase()} {el.prenom}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                          🏫 Classe : {el.classe || 'CP1'}
                        </div>
                      </div>
                      <button
                        className="btn-sm"
                        style={{ background: 'rgba(0,168,224,0.1)', color: 'var(--accent)', border: 'none', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}
                        onClick={() => setEditEleveModal({ ...el })}
                      >
                        ✏️ Éditer Fiche
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ fontWeight: 800, color: '#475569', minWidth: 90 }}>🛑 Allergies :</span>
                        {aAllergie ? (
                          <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
                            ⚠️ {el.allergies}
                          </span>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 11 }}>✅ Aucune allergie médicale</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ fontWeight: 800, color: '#475569', minWidth: 90 }}>🍽️ Régime / Porc :</span>
                        {aRestriction ? (
                          <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11 }}>
                            ℹ️ {el.restrictions}
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: 11 }}>Standard</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {elevesFiltres.length === 0 && (
                <div className="card" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Aucun élève trouvé pour cette recherche.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ SESSION 2 : CHECKING REPAS (MATIN, MIDI, GOÛTER) ════════════════ */}
        {tab === 'checking' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>📋 Session 2 : Checking &amp; Pointage des Repas Servis</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Émargement en direct des élèves ayant pris leur repas le matin, le midi et au goûter.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: '#0d2a3b' }}>📅 Date :</label>
                <input
                  type="date"
                  className="form-input"
                  value={datePointage}
                  onChange={e => setDatePointage(e.target.value)}
                  style={{ width: 160, fontWeight: 800 }}
                />
                <button
                  className="btn-sm"
                  onClick={() => window.print()}
                  style={{ background: '#0d2a3b', color: '#fff', padding: '9px 16px', borderRadius: 10, fontWeight: 800 }}
                >
                  🖨️ Imprimer la Liste
                </button>
              </div>
            </div>

            {/* KPI Cards Pointage */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="card" style={{ padding: '16px', background: 'rgba(245,158,11,0.08)', border: '1.5px solid #f59e0b', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#b45309' }}>🌅 PETIT-DÉJEUNER (MATIN)</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#b45309', margin: '4px 0' }}>{countMatin} / {elevesInscrits.length}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn-sm" style={{ background: '#f59e0b', color: '#fff', fontSize: 10, padding: '3px 8px', border: 'none', borderRadius: 6, fontWeight: 800 }} onClick={() => toggleAllRepasForMeal('matin', true)}>+ Cocher Tous</button>
                  <button className="btn-sm" style={{ background: 'none', border: '1px solid #b45309', color: '#b45309', fontSize: 10, padding: '3px 8px', borderRadius: 6 }} onClick={() => toggleAllRepasForMeal('matin', false)}>Décocher</button>
                </div>
              </div>

              <div className="card" style={{ padding: '16px', background: 'rgba(16,185,129,0.08)', border: '1.5px solid #10b981', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#047857' }}>☀️ DÉJEUNER (MIDI)</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#047857', margin: '4px 0' }}>{countMidi} / {elevesInscrits.length}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn-sm" style={{ background: '#10b981', color: '#fff', fontSize: 10, padding: '3px 8px', border: 'none', borderRadius: 6, fontWeight: 800 }} onClick={() => toggleAllRepasForMeal('midi', true)}>+ Cocher Tous</button>
                  <button className="btn-sm" style={{ background: 'none', border: '1px solid #047857', color: '#047857', fontSize: 10, padding: '3px 8px', borderRadius: 6 }} onClick={() => toggleAllRepasForMeal('midi', false)}>Décocher</button>
                </div>
              </div>

              <div className="card" style={{ padding: '16px', background: 'rgba(236,72,153,0.08)', border: '1.5px solid #ec4899', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#be185d' }}>🍎 GOÛTER (APRÈS-MIDI)</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#be185d', margin: '4px 0' }}>{countGouter} / {elevesInscrits.length}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn-sm" style={{ background: '#ec4899', color: '#fff', fontSize: 10, padding: '3px 8px', border: 'none', borderRadius: 6, fontWeight: 800 }} onClick={() => toggleAllRepasForMeal('gouter', true)}>+ Cocher Tous</button>
                  <button className="btn-sm" style={{ background: 'none', border: '1px solid #be185d', color: '#be185d', fontSize: 10, padding: '3px 8px', borderRadius: 6 }} onClick={() => toggleAllRepasForMeal('gouter', false)}>Décocher</button>
                </div>
              </div>
            </div>

            {/* Barre de Recherche & Filtre par classe */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="form-input"
                placeholder="🔍 Filtrer les élèves par nom..."
                value={searchEleve}
                onChange={e => setSearchEleve(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <select className="form-select" value={filterClasse} onChange={e => setFilterClasse(e.target.value)} style={{ width: 180 }}>
                <option value="ALL">🏫 Toutes les classes</option>
                {classesUniques.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Tableau de Checking des Repas */}
            <div className="card" style={{ padding: '1.2rem', borderRadius: 16 }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: '#0d2a3b' }}>
                📋 Feuille d'Émargement des Repas ({new Date(datePointage).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })})
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)', fontSize: 12, textTransform: 'uppercase', color: '#64748b' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Élève</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Classe</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>🌅 Matin (Petit-Dég)</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>☀️ Midi (Déjeuner)</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>🍎 Goûter (Après-midi)</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Allergies / Régime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elevesFiltres.map(el => {
                      const pt = pointage[el.id] || { matin: false, midi: false, gouter: false }
                      const aAllergie = el.allergies && el.allergies.toLowerCase() !== 'aucune'

                      return (
                        <tr key={el.id} style={{ borderBottom: '1px solid var(--border)', background: aAllergie ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0d2a3b' }}>
                            {(el.nom || '').toUpperCase()} {el.prenom}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--accent)' }}>{el.classe}</td>
                          
                          {/* MATIN */}
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <button
                              onClick={() => toggleRepas(el.id, 'matin')}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 20,
                                fontWeight: 800,
                                fontSize: 12,
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: pt.matin ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#e2e8f0',
                                color: pt.matin ? '#fff' : '#64748b',
                                boxShadow: pt.matin ? '0 2px 8px rgba(245,158,11,0.3)' : 'none'
                              }}
                            >
                              {pt.matin ? '🟢 Mangé' : '⚪ Absant'}
                            </button>
                          </td>

                          {/* MIDI */}
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <button
                              onClick={() => toggleRepas(el.id, 'midi')}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 20,
                                fontWeight: 800,
                                fontSize: 12,
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: pt.midi ? 'linear-gradient(135deg, #10b981, #059669)' : '#e2e8f0',
                                color: pt.midi ? '#fff' : '#64748b',
                                boxShadow: pt.midi ? '0 2px 8px rgba(16,185,129,0.3)' : 'none'
                              }}
                            >
                              {pt.midi ? '🟢 Mangé' : '⚪ Absent'}
                            </button>
                          </td>

                          {/* GOÛTER */}
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <button
                              onClick={() => toggleRepas(el.id, 'gouter')}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 20,
                                fontWeight: 800,
                                fontSize: 12,
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: pt.gouter ? 'linear-gradient(135deg, #ec4899, #db2777)' : '#e2e8f0',
                                color: pt.gouter ? '#fff' : '#64748b',
                                boxShadow: pt.gouter ? '0 2px 8px rgba(236,72,153,0.3)' : 'none'
                              }}
                            >
                              {pt.gouter ? '🟢 Servis' : '⚪ Non'}
                            </button>
                          </td>

                          <td style={{ padding: '10px 12px', fontSize: 11 }}>
                            {aAllergie ? (
                              <span style={{ color: '#dc2626', fontWeight: 800 }}>⚠️ {el.allergies}</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Standard ({el.restrictions || 'Aucune'})</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ SESSION 3 : PRÉPARATION DU MENU ════════════════ */}
        {tab === 'preparation' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>🍳 Session 3 : Préparation du Menu de la Semaine</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Conception et équilibre nutritionnel des repas servis du Lundi au Vendredi.</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={saveMenuSemaine}
                style={{ background: 'linear-gradient(135deg, #7bc142, #5a9a2e)', color: '#0d2a3b', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 900, boxShadow: '0 4px 14px rgba(123,193,66,0.3)' }}
              >
                💾 Enregistrer &amp; Publier les Menus
              </button>
            </div>

            {/* Selecteur de Jour */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
              {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map(j => (
                <button
                  key={j}
                  className={`btn-sm ${jourSelectionne === j ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setJourSelectionne(j)}
                  style={{ flex: 1, padding: '12px', fontSize: 14, fontWeight: 800, borderRadius: 12, textAlign: 'center' }}
                >
                  📅 {j}
                </button>
              ))}
            </div>

            {/* Formulaire du Jour Sélectionné */}
            <div className="card" style={{ padding: '24px', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid var(--border)', paddingBottom: 14, marginBottom: 20 }}>
                <div style={{ fontSize: 28 }}>🍽️</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0d2a3b' }}>Composition du Repas du {jourSelectionne}</h3>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Remplissez les différentes composantes du menu de ce jour.</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: '#0d2a3b' }}>🥗 Entrée / Salade</label>
                  <input
                    className="form-input"
                    value={menuSemaine[jourSelectionne]?.entree || ''}
                    onChange={e => setMenuSemaine({
                      ...menuSemaine,
                      [jourSelectionne]: { ...menuSemaine[jourSelectionne], entree: e.target.value }
                    })}
                    placeholder="Ex: Salade de concombres et tomates"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: '#0d2a3b' }}>🍲 Plat Principal (Chaud)</label>
                  <input
                    className="form-input"
                    value={menuSemaine[jourSelectionne]?.plat || ''}
                    onChange={e => setMenuSemaine({
                      ...menuSemaine,
                      [jourSelectionne]: { ...menuSemaine[jourSelectionne], plat: e.target.value }
                    })}
                    placeholder="Ex: Riz gras au poulet braisé"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: '#0d2a3b' }}>🍎 Dessert / Fruit</label>
                  <input
                    className="form-input"
                    value={menuSemaine[jourSelectionne]?.dessert || ''}
                    onChange={e => setMenuSemaine({
                      ...menuSemaine,
                      [jourSelectionne]: { ...menuSemaine[jourSelectionne], dessert: e.target.value }
                    })}
                    placeholder="Ex: Mangue fraîche découpée"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 800, color: '#0d2a3b' }}>🥤 Boisson / Rafraîchissement</label>
                  <input
                    className="form-input"
                    value={menuSemaine[jourSelectionne]?.boisson || ''}
                    onChange={e => setMenuSemaine({
                      ...menuSemaine,
                      [jourSelectionne]: { ...menuSemaine[jourSelectionne], boisson: e.target.value }
                    })}
                    placeholder="Ex: Jus de Bissap naturel"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#dc2626' }}>⚠️ Option de Substitution (Allergies &amp; Régimes)</label>
                <input
                  className="form-input"
                  value={menuSemaine[jourSelectionne]?.substitution || ''}
                  onChange={e => setMenuSemaine({
                    ...menuSemaine,
                    [jourSelectionne]: { ...menuSemaine[jourSelectionne], substitution: e.target.value }
                  })}
                  placeholder="Ex: Poulet grillé nature sans arachides pour enfants allergiques"
                  style={{ borderColor: '#fca5a5', background: '#fef2f2' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ SESSION 4 : MENU DU JOUR ════════════════ */}
        {tab === 'menu_jour' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>🍲 Session 4 : Menu du Jour (Affiche Officielle)</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Détail et composition du repas servi aujourd'hui à la réfection des élèves.</p>
              </div>
              <button
                className="btn-sm"
                onClick={() => window.print()}
                style={{ background: '#0d2a3b', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 800 }}
              >
                🖨️ Imprimer la Fiche du Jour
              </button>
            </div>

            {/* Affiche Grand Format du Menu */}
            <div className="card" style={{ padding: '2rem', background: 'linear-gradient(135deg, #0d2a3b 0%, #0f3854 100%)', color: '#fff', borderRadius: 20, boxShadow: '0 15px 35px rgba(13,42,59,0.3)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 180, opacity: 0.05, pointerEvents: 'none' }}>🍲</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src="/logo-ideal.png" alt="IDEAL" style={{ height: 40, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.5px', color: '#7bc142' }}>CANTINE IMPÉRIALE IDEAL</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Menu officiel du {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
                <div style={{ background: '#7bc142', color: '#0d2a3b', padding: '6px 14px', borderRadius: 20, fontWeight: 900, fontSize: 13 }}>
                  180 Portions Servies
                </div>
              </div>

              {/* Contenu du Menu */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 24 }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 6 }}>🥗 ENTRÉE</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{menuSemaine[jourSelectionne]?.entree || 'Salade fraîche du chef'}</div>
                </div>

                <div style={{ background: 'rgba(123,193,66,0.12)', borderRadius: 14, padding: '16px', border: '1px solid #7bc142' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#7bc142', textTransform: 'uppercase', marginBottom: 6 }}>🍲 PLAT PRINCIPAL</div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{menuSemaine[jourSelectionne]?.plat || 'Plat chaud de saison'}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 6 }}>🍎 DESSERT</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{menuSemaine[jourSelectionne]?.dessert || 'Fruits locaux frais'}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#ec4899', textTransform: 'uppercase', marginBottom: 6 }}>🥤 BOISSON</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{menuSemaine[jourSelectionne]?.boisson || 'Jus naturel maison'}</div>
                </div>
              </div>

              {/* Substitution Consigne Cuisinière */}
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 12, padding: '14px', fontSize: 13 }}>
                <span style={{ fontWeight: 900, color: '#fca5a5' }}>⚠️ REPAS DE SUBSTITUTION (ALLERGIES) :</span>
                <div style={{ marginTop: 4, fontWeight: 700 }}>{menuSemaine[jourSelectionne]?.substitution || 'Portion spécifique préparée sans arachide ni produits laitiers.'}</div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ SESSION 5 : FICHE DU MARCHÉ (BUDGET & PRIX) ════════════════ */}
        {tab === 'marche' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>🛒 Session 5 : Fiche du Marché &amp; Budget Cantine</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Gestion des achats de la cuisine, suivi du budget alloué et décompte des prix alimentaires.</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setNewArticleModal(true)}
                  style={{ background: 'linear-gradient(135deg, #00a8e0, #0078b4)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800 }}
                >
                  + Ajouter un Aliment
                </button>
                <button
                  className="btn-sm"
                  onClick={() => window.print()}
                  style={{ background: '#0d2a3b', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 800 }}
                >
                  🖨️ Imprimer la Fiche
                </button>
              </div>
            </div>

            {/* KPI Cards Budget */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="card" style={{ padding: '18px', background: 'rgba(0,168,224,0.06)', border: '1.5px solid #00a8e0', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>💵 BUDGET ALLOUÉ</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#0d2a3b', margin: '4px 0' }}>{fcfa(ficheMarche.budget)}</div>
                <button
                  className="btn-sm"
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => {
                    const b = prompt('Modifier le budget total du marché (FCFA) :', ficheMarche.budget)
                    if (b !== null) saveFicheMarche({ ...ficheMarche, budget: Number(b) || 0 })
                  }}
                >
                  ✏️ Ajuster le Budget
                </button>
              </div>

              <div className="card" style={{ padding: '18px', background: 'rgba(239,68,68,0.06)', border: '1.5px solid #ef4444', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626' }}>🛒 TOTAL DÉPENSÉ (ACHATS)</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', margin: '4px 0' }}>{fcfa(totalDepense)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{ficheMarche.articles.length} articles répertoriés</div>
              </div>

              <div className="card" style={{ padding: '18px', background: resteBudget >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.08)', border: resteBudget >= 0 ? '1.5px solid #10b981' : '1.5px solid #ef4444', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: resteBudget >= 0 ? '#16a34a' : '#dc2626' }}>
                  {resteBudget >= 0 ? '💰 SOLDE DISPONIBLE' : '⚠️ DÉPASSEMENT BUDGET'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: resteBudget >= 0 ? '#16a34a' : '#dc2626', margin: '4px 0' }}>
                  {fcfa(resteBudget)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{resteBudget >= 0 ? 'Budget respecté' : 'Veuillez réajuster les quantités'}</div>
              </div>
            </div>

            {/* Tableau des Ingrédients du Marché */}
            <div className="card" style={{ padding: '1.2rem', borderRadius: 16 }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: '#0d2a3b' }}>🛒 Liste des Achats Alimentaires</h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)', fontSize: 12, textTransform: 'uppercase', color: '#64748b' }}>
                      <th style={{ textAlign: 'center', padding: '10px 8px', width: 40 }}>Acheté</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Aliment / Ingrédient</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>Quantité</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Prix Unitaire (P.U)</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Prix Total (FCFA)</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', width: 80 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficheMarche.articles.map(art => {
                      const totalArt = Number(art.pu) * (parseInt(art.quantite) || 1)
                      return (
                        <tr key={art.id} style={{ borderBottom: '1px solid var(--border)', background: art.achete ? 'rgba(16,185,129,0.03)' : 'transparent' }}>
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                            <input
                              type="checkbox"
                              checked={art.achete}
                              onChange={() => toggleArticleAchete(art.id)}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, textDecoration: art.achete ? 'line-through' : 'none', color: art.achete ? '#94a3b8' : '#0d2a3b' }}>
                            {art.nom}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600 }}>{art.quantite}</td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b' }}>{fcfa(art.pu)}</td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 900, color: '#16a34a' }}>{fcfa(totalArt)}</td>
                          <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                            <button
                              aria-label="Supprimer"
                              onClick={() => deleteArticle(art.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 16, cursor: 'pointer' }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'rgba(0,168,224,0.06)', fontWeight: 900, fontSize: 14 }}>
                      <td colSpan={4} style={{ padding: '14px 12px', textAlign: 'right' }}>TOTAL GÉNÉRAL :</td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', color: '#dc2626', fontSize: 16 }}>{fcfa(totalDepense)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL ÉDITER ALLERGIE ÉLÈVE */}
      {editEleveModal && (
        <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setEditEleveModal(null)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">Précisions Alimentaires : {editEleveModal.nom} {editEleveModal.prenom}</div>
            
            <div className="form-group">
              <label className="form-label">🛑 Allergies Médicales (ex: Arachides, Lactose, Gluten)</label>
              <input
                className="form-input"
                value={editEleveModal.allergies || ''}
                onChange={e => setEditEleveModal({ ...editEleveModal, allergies: e.target.value })}
                placeholder="Renseigner les allergies médicales..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">🍽️ Restrictions Alimentaires &amp; Régimes (ex: Sans Porc, Végétarien)</label>
              <input
                className="form-input"
                value={editEleveModal.restrictions || ''}
                onChange={e => setEditEleveModal({ ...editEleveModal, restrictions: e.target.value })}
                placeholder="Renseigner le régime alimentaire..."
              />
            </div>

            <button className="btn btn-primary" onClick={saveEleveAllergie}>
              Enregistrer
            </button>
            <button className="btn-cancel" onClick={() => setEditEleveModal(null)}>Annuler</button>
          </div>
        </div>
      )}

      {/* MODAL AJOUT ARTICLE MARCHÉ */}
      {newArticleModal && (
        <div className="modal-overlay" onClick={e => e.target.className === 'modal-overlay' && setNewArticleModal(false)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">🛒 Ajouter un Aliment / Ingrédient au Marché</div>

            <div className="form-group">
              <label className="form-label">Nom de l'aliment / Ingrédient</label>
              <input
                className="form-input"
                value={newArticle.nom}
                onChange={e => setNewArticle({ ...newArticle, nom: e.target.value })}
                placeholder="Ex: Poulet fermier, Sac de Riz, Huile..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Quantité (ex: 15 Kg, 2 Bidons, 1 Sac)</label>
              <input
                className="form-input"
                value={newArticle.quantite}
                onChange={e => setNewArticle({ ...newArticle, quantite: e.target.value })}
                placeholder="Ex: 10 Kg"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Prix Unitaire (FCFA)</label>
              <input
                type="number"
                className="form-input"
                value={newArticle.pu}
                onChange={e => setNewArticle({ ...newArticle, pu: e.target.value })}
                placeholder="Ex: 2500"
              />
            </div>

            <button className="btn btn-primary" onClick={handleAddArticle}>
              Ajouter au Marché
            </button>
            <button className="btn-cancel" onClick={() => setNewArticleModal(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
