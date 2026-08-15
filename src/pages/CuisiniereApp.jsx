import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import NotificationCenter from './NotificationCenter'
import html2canvas from 'html2canvas'

const fcfa = n => (Math.round(Number(n) || 0)).toLocaleString('fr-FR') + ' F'

// Exemple officiel de menu hebdomadaire haute gastronomie
const SAMPLE_MENU_SEMAINE = {
  dates_semaine: "12 au 16 janvier 2026",
  Lundi: {
    entreeTitre: "Croq'Concombre",
    entreeDesc: "Fines rondelles de concombre bien fraîches et croquantes, légèrement assaisonnées avec une vinaigrette douce.",
    platTitre: "Arachide'Poulet Bonheur",
    platDesc: "Riz blanc bien moelleux accompagné d'une sauce arachide onctueuse, préparée avec des morceaux de poulet tendres et peu épicée.",
    dessertTitre: "Banana'Doux",
    dessertDesc: "Banane bien mûre, naturellement sucrée et facile à manger.",
    gouterTitre: "Beignet'Nuage",
    gouterDesc: "Beignet léger, doré et moelleux à l'intérieur, légèrement sucré."
  },
  Mardi: {
    entreeTitre: "Piemont'Douceur",
    entreeDesc: "Petits cubes de pommes de terre, carottes, œufs et légumes, mélangés à une mayonnaise légère spécialement dosée pour les enfants.",
    platTitre: "Yam'Œuf Énergie",
    platDesc: "Igname bien tendre cuit à l'eau, accompagné d'œufs brouillés moelleux et légèrement assaisonnés.",
    dessertTitre: "Soleil d'Orange",
    dessertDesc: "Quartiers d'orange juteux et riches en vitamine C.",
    gouterTitre: "Pop'Lait Douceur",
    gouterDesc: "Popcorn léger nappé d'un filet de lait sucré, facile à grignoter."
  },
  Mercredi: {
    entreeTitre: "Chou'Croque",
    entreeDesc: "Choux finement émincé, légèrement assaisonné avec une vinaigrette douce et quelques carottes râpées.",
    platTitre: "Riz'Poulet Festif",
    platDesc: "Riz sauté avec de petits légumes (carottes, petits pois), des œufs et des morceaux de poulet bien tendres.",
    dessertTitre: "Papaye Soleil",
    dessertDesc: "Morceaux de papaye bien mûre, sucrée et rafraîchissante.",
    gouterTitre: "Soleil'Douceur",
    gouterDesc: "Beignet bien doré, léger et moelleux, délicatement sucré."
  },
  Jeudi: {
    entreeTitre: "Niçoise'Plaisir",
    entreeDesc: "Une salade colorée et douce composée de pommes de terre, tomates, œufs, thon et légumes, assaisonnée légèrement pour convenir aux enfants.",
    platTitre: "Spag'Bolo Bonheur",
    platDesc: "Pâtes bien tendres nappées d'une sauce bolognaise douce à base de viande hachée et de tomates.",
    dessertTitre: "Pastèque Fraîcheur",
    dessertDesc: "Morceaux de pastèque bien juteux et rafraîchissants.",
    gouterTitre: "Mini'Sandwich Énergie",
    gouterDesc: "Petit sandwich moelleux garni de viande hachée légèrement assaisonnée, adapté aux petites mains."
  },
  Vendredi: {
    entreeTitre: "Avo'Douceur",
    entreeDesc: "Tranches d'avocat bien mûres, fondantes et légèrement citronnées pour garder toute leur fraîcheur.",
    platTitre: "Saka'Riz Énergie",
    platDesc: "Riz bien moelleux accompagné d'une sauce saka-saka (feuilles de manioc) cuisinée en version douce, peu épicée et adaptée aux enfants.",
    dessertTitre: "Soleil d'Orange",
    dessertDesc: "Quartiers d'orange juteux et riches en vitamine C.",
    gouterTitre: "Crevette'Croque",
    gouterDesc: "Chips légères et croustillantes, faciles à grignoter pour les petites mains."
  }
}

// Menus de la semaine vides par défaut
const EMPTY_MENU_SEMAINE = {
  dates_semaine: "",
  Lundi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' },
  Mardi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' },
  Mercredi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' },
  Jeudi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' },
  Vendredi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' }
}

// Ingrédients du marché vides par défaut
const EMPTY_FICHE_MARCHE = {
  budget: 0,
  articles: []
}

// Données démo élèves cantine (chargées depuis Supabase si actives)
const DEMO_ELEVES_CANTINE = [
  { id: 'el-1', nom: 'TRAORÉ', prenom: 'Aïcha', classe: 'CP1 Bilingue', cantine: true, allergies: 'Allergie aux Arachides', restrictions: 'Sans Porc' },
  { id: 'el-2', nom: 'SANOGO', prenom: 'Ibrahim', classe: 'CP1 Bilingue', cantine: true, allergies: 'Intolérance au Lactose', restrictions: 'Sans Lait' },
  { id: 'el-3', nom: 'COULIBALY', prenom: 'Fatoumata', classe: 'CP2 A', cantine: true, allergies: 'Aucune', restrictions: 'Sans Porc' },
  { id: 'el-4', nom: 'DIARRA', prenom: 'Mamadou', classe: 'CE1 B', cantine: true, allergies: 'Allergie au Poisson', restrictions: 'Végétarien' },
  { id: 'el-5', nom: 'KEITA', prenom: 'Oumar', classe: 'CE2', cantine: true, allergies: 'Aucune', restrictions: 'Aucune' }
]

const getTodayString = () => new Date().toISOString().split('T')[0]

export default function CuisiniereApp({ user, onLogout }) {
  const [tab, setTab] = useState('eleves')
  const [eleves, setEleves] = useState(DEMO_ELEVES_CANTINE)
  const [menuSemaine, setMenuSemaine] = useState(SAMPLE_MENU_SEMAINE)
  const [ficheMarche, setFicheMarche] = useState(EMPTY_FICHE_MARCHE)
  const [jourSelectionne, setJourSelectionne] = useState('Lundi')
  const [searchEleve, setSearchEleve] = useState('')
  const [filterClasse, setFilterClasse] = useState('ALL')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Pointage Repas (Matin, Midi, Goûter)
  const [datePointage, setDatePointage] = useState(getTodayString())
  const [pointage, setPointage] = useState({})

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
          allergies: e.allergies || 'Aucune',
          restrictions: e.restrictions || 'Aucune'
        }))
        setEleves(cantineList)
      }

      // Charger le menu de la semaine depuis Supabase
      const { data: stateMenu } = await supabase.from('app_state').select('value').eq('key', 'cantine_menu_semaine').single()
      if (stateMenu && stateMenu.value) setMenuSemaine(stateMenu.value)

      // Charger la fiche du marché depuis Supabase
      const { data: stateMarche } = await supabase.from('app_state').select('value').eq('key', 'cantine_fiche_marche').single()
      if (stateMarche && stateMarche.value) setFicheMarche(stateMarche.value)

    } catch (e) {
      console.warn('Erreur chargement Supabase cantine :', e)
    } finally {
      setLoading(false)
    }
  }

  // Télécharger l'affiche complète du menu de la semaine au format JPEG HD pour la chaîne WhatsApp
  const exportMenuJpeg = async () => {
    const posterElem = document.getElementById('menu-whatsapp-poster')
    if (!posterElem) return
    setMsg('⏳ Génération du visuel de restauration Ultra-Premium HD en cours...')
    try {
      const canvas = await html2canvas(posterElem, {
        scale: 3, // Ultra Retina Quality 3x pour un rendu presse/magazine sur WhatsApp
        useCORS: true,
        backgroundColor: '#fffdfa',
        logging: false
      })
      const dataUrl = canvas.toDataURL('image/jpeg', 0.98)
      const link = document.createElement('a')
      link.download = `Menu_Hebdomadaire_UltraPremium_IDEAL_${getTodayString()}.jpg`
      link.href = dataUrl
      link.click()
      setMsg('📸 Affiche Ultra-Premium JPEG téléchargée avec succès ! Prête pour diffusion WhatsApp.')
      setTimeout(() => setMsg(''), 4000)
    } catch (err) {
      console.error(err)
      alert('Erreur lors de la création du JPEG : ' + err.message)
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
        const defaultPt = {}
        eleves.forEach(e => {
          defaultPt[e.id] = { matin: false, midi: false, gouter: false }
        })
        setPointage(defaultPt)
      }
    } catch (e) {
      const defaultPt = {}
      eleves.forEach(e => {
        defaultPt[e.id] = { matin: false, midi: false, gouter: false }
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
  const saveMenuSemaine = async (updatedMenu = menuSemaine) => {
    setMenuSemaine(updatedMenu)
    try {
      await supabase.from('app_state').upsert({ key: 'cantine_menu_semaine', value: updatedMenu, updated_at: new Date().toISOString() })
      setMsg('✅ Menu de la semaine enregistré avec succès !')
      setTimeout(() => setMsg(''), 4000)
    } catch (e) {
      alert('Erreur enregistrement menu: ' + e.message)
    }
  }

  // Charger le modèle d'exemple officiel
  const loadSampleMenu = () => {
    saveMenuSemaine(SAMPLE_MENU_SEMAINE)
    setMsg('✨ Modèle officiel de menu chargé avec succès !')
    setTimeout(() => setMsg(''), 3000)
  }

  // Effacer tout le menu de la semaine
  const clearMenuSemaine = async () => {
    if (!confirm('Voulez-vous effacer toutes les données du menu de la semaine ?')) return
    setMenuSemaine(EMPTY_MENU_SEMAINE)
    try {
      await supabase.from('app_state').upsert({ key: 'cantine_menu_semaine', value: EMPTY_MENU_SEMAINE, updated_at: new Date().toISOString() })
      setMsg('🗑️ Les menus de la semaine ont été entièrement effacés.')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      console.error(e)
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

  // Modification directe d'un champ d'aliment (Nom, Quantité, Prix unitaire)
  const updateArticleField = (id, field, value) => {
    const updatedArticles = ficheMarche.articles.map(a => a.id === id ? { ...a, [field]: value } : a)
    saveFicheMarche({ ...ficheMarche, articles: updatedArticles })
  }

  // Effacer toutes les données de la fiche du marché
  const clearFicheMarche = () => {
    if (!confirm('Voulez-vous réinitialiser et effacer TOUS les articles du marché ?')) return
    saveFicheMarche({ budget: 0, articles: [] })
    setMsg('🗑️ La fiche du marché a été réinitialisée et vidée.')
    setTimeout(() => setMsg(''), 3000)
  }

  // Ajouter un article au marché
  const handleAddArticle = () => {
    if (!newArticle.nom.trim()) return
    const article = {
      id: Date.now(),
      nom: newArticle.nom,
      quantite: newArticle.quantite || '1',
      pu: Number(newArticle.pu) || 0,
      achete: false
    }
    const updated = { ...ficheMarche, articles: [...ficheMarche.articles, article] }
    saveFicheMarche(updated)
    setNewArticle({ nom: '', quantite: '', pu: 0 })
    setNewArticleModal(false)
    setMsg('🛒 Aliment ajouté au marché !')
    setTimeout(() => setMsg(''), 3000)
  }

  // Toggle statut acheté
  const toggleArticleAchete = (id) => {
    const updatedArticles = ficheMarche.articles.map(a => a.id === id ? { ...a, achete: !a.achete } : a)
    saveFicheMarche({ ...ficheMarche, articles: updatedArticles })
  }

  // Supprimer un article
  const deleteArticle = (id) => {
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

  // Calcul dynamique du marché
  const totalDepense = ficheMarche.articles.reduce((s, a) => {
    const qty = parseFloat(a.quantite) || 1
    return s + (Number(a.pu) * qty)
  }, 0)
  const resteBudget = (Number(ficheMarche.budget) || 0) - totalDepense

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

      {/* Navigation des Sessions */}
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
            👑 4. Affiche Menu Hebdo (WhatsApp HD)
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
      <div className="page-content" style={{ padding: '1.5rem 1.2rem 40px', maxWidth: 1320, margin: '0 auto' }}>
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
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Aucun élève trouvé.</div>
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
                  🖨️ Imprimer
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
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>🌅 Matin</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>☀️ Midi</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px' }}>🍎 Goûter</th>
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
                                color: pt.matin ? '#fff' : '#64748b'
                              }}
                            >
                              {pt.matin ? '🟢 Mangé' : '⚪ Absent'}
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
                                color: pt.midi ? '#fff' : '#64748b'
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
                                color: pt.gouter ? '#fff' : '#64748b'
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

        {/* ════════════════ SESSION 3 : PRÉPARATION ET SAISIE DU MENU DE LA SEMAINE ════════════════ */}
        {tab === 'preparation' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>🍳 Session 3 : Saisie &amp; Élaboration du Menu de la Semaine</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Saisissez les titres poétiques et les descriptions appétissantes pour chaque jour de la semaine.</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-sm"
                  onClick={loadSampleMenu}
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid #f59e0b', padding: '10px 16px', borderRadius: 10, fontWeight: 800 }}
                >
                  ✨ Charger l'Exemple Officiel (12 au 16 Janvier)
                </button>
                <button
                  className="btn-sm"
                  onClick={clearMenuSemaine}
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '10px 16px', borderRadius: 10, fontWeight: 800 }}
                >
                  🗑️ Effacer Tout
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => saveMenuSemaine()}
                  style={{ background: 'linear-gradient(135deg, #7bc142, #5a9a2e)', color: '#0d2a3b', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 900, boxShadow: '0 4px 14px rgba(123,193,66,0.3)' }}
                >
                  💾 Enregistrer &amp; Publier
                </button>
              </div>
            </div>

            {/* Saisie de la date de la semaine */}
            <div className="card" style={{ padding: '16px', marginBottom: 20, background: '#fff' }}>
              <label className="form-label" style={{ fontWeight: 900, color: '#d97706', fontSize: 14 }}>📅 Période de la Semaine (Affiche Officielle)</label>
              <input
                className="form-input"
                value={menuSemaine.dates_semaine || ''}
                onChange={e => setMenuSemaine({ ...menuSemaine, dates_semaine: e.target.value })}
                placeholder="Ex: 12 au 16 janvier 2026"
                style={{ fontSize: 16, fontWeight: 800, color: '#0d2a3b' }}
              />
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
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0d2a3b' }}>Composition des Plats du {jourSelectionne}</h3>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Renseignez le titre gourmand et la description détaillée.</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {/* ENTRÉE */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 900, color: '#0284c7', marginBottom: 10, fontSize: 14 }}>🥗 ENTRÉE</div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Titre du plat (ex: “Croq'Concombre”)</label>
                    <input
                      className="form-input"
                      value={menuSemaine[jourSelectionne]?.entreeTitre || ''}
                      onChange={e => setMenuSemaine({
                        ...menuSemaine,
                        [jourSelectionne]: { ...menuSemaine[jourSelectionne], entreeTitre: e.target.value }
                      })}
                      placeholder="Ex: “Croq'Concombre”"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Description gourmande</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={menuSemaine[jourSelectionne]?.entreeDesc || ''}
                      onChange={e => setMenuSemaine({
                        ...menuSemaine,
                        [jourSelectionne]: { ...menuSemaine[jourSelectionne], entreeDesc: e.target.value }
                      })}
                      placeholder="Fines rondelles de concombre bien fraîches..."
                    />
                  </div>
                </div>

                {/* PLAT PRINCIPAL */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1.5px solid #7bc142' }}>
                  <div style={{ fontWeight: 900, color: '#7bc142', marginBottom: 10, fontSize: 14 }}>🍲 PLAT PRINCIPAL</div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Titre du plat (ex: “Arachide'Poulet Bonheur”)</label>
                    <input
                      className="form-input"
                      value={menuSemaine[jourSelectionne]?.platTitre || ''}
                      onChange={e => setMenuSemaine({
                        ...menuSemaine,
                        [jourSelectionne]: { ...menuSemaine[jourSelectionne], platTitre: e.target.value }
                      })}
                      placeholder="Ex: “Arachide'Poulet Bonheur”"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Description gourmande</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={menuSemaine[jourSelectionne]?.platDesc || ''}
                      onChange={e => setMenuSemaine({
                        ...menuSemaine,
                        [jourSelectionne]: { ...menuSemaine[jourSelectionne], platDesc: e.target.value }
                      })}
                      placeholder="Riz blanc bien moelleux accompagné d'une sauce..."
                    />
                  </div>
                </div>

                {/* DESSERT */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 900, color: '#d97706', marginBottom: 10, fontSize: 14 }}>🍎 DESSERT</div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Titre (ex: “Banana'Doux”)</label>
                    <input
                      className="form-input"
                      value={menuSemaine[jourSelectionne]?.dessertTitre || ''}
                      onChange={e => setMenuSemaine({
                        ...menuSemaine,
                        [jourSelectionne]: { ...menuSemaine[jourSelectionne], dessertTitre: e.target.value }
                      })}
                      placeholder="Ex: “Banana'Doux”"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Description</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={menuSemaine[jourSelectionne]?.dessertDesc || ''}
                      onChange={e => setMenuSemaine({
                        ...menuSemaine,
                        [jourSelectionne]: { ...menuSemaine[jourSelectionne], dessertDesc: e.target.value }
                      })}
                      placeholder="Banane bien mûre, naturellement sucrée..."
                    />
                  </div>
                </div>

                {/* GOÛTER / COLLATION */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 900, color: '#e11d48', marginBottom: 10, fontSize: 14 }}>🍪 GOÛTER / COLLATION</div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11 }}>Titre (ex: “Beignet'Nuage”)</label>
                    <input
                      className="form-input"
                      value={menuSemaine[jourSelectionne]?.gouterTitre || ''}
                      onChange={e => setMenuSemaine({
                        ...menuSemaine,
                        [jourSelectionne]: { ...menuSemaine[jourSelectionne], gouterTitre: e.target.value }
                      })}
                      placeholder="Ex: “Beignet'Nuage”"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Description</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={menuSemaine[jourSelectionne]?.gouterDesc || ''}
                      onChange={e => setMenuSemaine({
                        ...menuSemaine,
                        [jourSelectionne]: { ...menuSemaine[jourSelectionne], gouterDesc: e.target.value }
                      })}
                      placeholder="Beignet léger, doré et moelleux à l'intérieur..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ SESSION 4 : AFFICHE HEBDOMADAIRE ULTRA-PREMIUM HAUTE GASTRONOMIE ════════════════ */}
        {tab === 'menu_jour' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>👑 Session 4 : Affiche Gastronomique du Menu de la Semaine</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Visuel Ultra-Premium d'exception conçu pour la publication officielle sur la chaîne WhatsApp de l'école.</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-primary"
                  onClick={exportMenuJpeg}
                  style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', border: 'none', padding: '13px 26px', borderRadius: 14, fontWeight: 900, boxShadow: '0 6px 20px rgba(217,119,6,0.4)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  📸 Télécharger Image JPEG HD (WhatsApp Retina 3x)
                </button>
                <button
                  className="btn-sm"
                  onClick={() => window.print()}
                  style={{ background: '#0f172a', color: '#fff', padding: '10px 18px', borderRadius: 12, fontWeight: 800 }}
                >
                  🖨️ Imprimer Affiche
                </button>
              </div>
            </div>

            {/* AFFICHE INTÉGRALE HEBDOMADAIRE ULTRA-PREMIUM GASTRONOMIE IMPÉRIALE */}
            <div
              id="menu-whatsapp-poster"
              style={{
                padding: '3rem 2.5rem',
                background: 'linear-gradient(180deg, #fffdfa 0%, #faf8f5 100%)',
                color: '#0f172a',
                borderRadius: 32,
                boxShadow: '0 25px 60px rgba(0,0,0,0.12)',
                border: '3px double #d97706',
                position: 'relative',
                overflow: 'hidden',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              {/* Filigrane de fond couronne impériale */}
              <div style={{ position: 'absolute', top: -40, right: -40, fontSize: 260, opacity: 0.03, pointerEvents: 'none' }}>👑</div>

              {/* EN-TÊTE ÉLÉGANT LUXE : LOGO OFFICIEL & BANNIÈRE SEMAINE */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid rgba(217,119,6,0.3)', paddingBottom: 24, marginBottom: 32, position: 'relative' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', border: '2px solid #d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                    <img src="/logo-ideal.png" alt="IDEAL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#d97706', letterSpacing: '3px', textTransform: 'uppercase' }}>
                      🌿 ÉCOLE INTERNATIONALE BILINGUE IDEAL
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '0.5px', marginTop: 2 }}>
                      RESTAURATION GASTRONOMIQUE IMPÉRIALE
                    </div>
                  </div>
                </div>

                {/* Pill Badge Semaine Doré */}
                <div style={{ display: 'inline-block', marginTop: 10, background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#fff', padding: '10px 28px', borderRadius: 30, boxShadow: '0 4px 16px rgba(15,23,42,0.2)' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    🍽️ MENU DE LA SEMAINE DU {menuSemaine.dates_semaine || '12 AU 16 JANVIER 2026'}
                  </div>
                </div>
              </div>

              {/* GRILLE DES 5 JOURS GASTRONOMIQUES (LUNDI AU VENDREDI) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, marginBottom: 32 }}>
                {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map(j => {
                  const item = menuSemaine[j] || {}
                  return (
                    <div
                      key={j}
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid rgba(217,119,6,0.25)',
                        borderRadius: 22,
                        padding: '18px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
                        transition: 'transform 0.2s'
                      }}
                    >
                      {/* Ruban de Titre du Jour */}
                      <div style={{ background: 'linear-gradient(135deg, #065f46, #047857)', color: '#fff', padding: '8px 12px', borderRadius: 12, textAlign: 'center', fontWeight: 900, fontSize: 15, textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 10px rgba(4,120,87,0.25)', border: '1px solid #10b981' }}>
                        📅 {j}
                      </div>

                      {/* ENTRÉE */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', marginBottom: 4 }}>
                          <span>🥗</span> ENTRÉE DU CHEF
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                          “{item.entreeTitre || item.entree || 'Entrée fraîche' }”
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
                          <span style={{ color: '#d97706' }}>✦</span> {item.entreeDesc || 'Composition fraîcheur préparée le matin.'}
                        </div>
                      </div>

                      {/* PLAT PRINCIPAL (EN EVIDENCE AVEC FOND VERT EMERAUDE DOUX) */}
                      <div style={{ background: 'rgba(16,185,129,0.08)', padding: '10px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: '#047857', textTransform: 'uppercase', marginBottom: 4 }}>
                          <span>🍲</span> PLAT PRINCIPAL CHAUD
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#064e3b' }}>
                          “{item.platTitre || item.plat || 'Plat du Chef'}”
                        </div>
                        <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
                          <span style={{ color: '#047857' }}>✦</span> {item.platDesc || 'Recette gourmande adaptée à la nutrition infantile.'}
                        </div>
                      </div>

                      {/* DESSERT */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: '#d97706', textTransform: 'uppercase', marginBottom: 4 }}>
                          <span>🍎</span> DESSERT &amp; FRUITS
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                          “{item.dessertTitre || item.dessert || 'Dessert du jour'}”
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
                          <span style={{ color: '#d97706' }}>✦</span> {item.dessertDesc || 'Selection de fruits mûrs et naturels.'}
                        </div>
                      </div>

                      {/* GOÛTER / COLLATION */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: '#e11d48', textTransform: 'uppercase', marginBottom: 4 }}>
                          <span>🍪</span> GOÛTER &amp; COLLATION
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                          “{item.gouterTitre || item.boisson || 'Collation douce'}”
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
                          <span style={{ color: '#e11d48' }}>✦</span> {item.gouterDesc || 'Collation légère adaptée aux besoins de l\'après-midi.'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* PIED DE PAGE HAUTE QUALITÉ AVEC SCEAU DE GARANTIE */}
              <div style={{ borderTop: '2px solid rgba(217,119,6,0.3)', paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 900, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🏅</span> CERTIFIÉ QUALITÉ &amp; NUTRITION GASTRONOMIQUE
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                    Produits 100% Frais &amp; Équilibrés — Cuisine Chef IDEAL
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', padding: '8px 18px', borderRadius: 20, border: '1px solid #f59e0b' }}>
                  📲 Diffusion Officielle WhatsApp Parents
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ SESSION 5 : FICHE DU MARCHÉ (100% MODIFIABLE) ════════════════ */}
        {tab === 'marche' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>🛒 Session 5 : Fiche du Marché (100% Modifiable)</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Saisissez et modifiez librement les aliments, leurs quantités et les prix unitaires du jour.</p>
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
                  onClick={clearFicheMarche}
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '10px 16px', borderRadius: 10, fontWeight: 800 }}
                >
                  🗑️ Vider le Marché
                </button>
                <button
                  className="btn-sm"
                  onClick={() => window.print()}
                  style={{ background: '#0d2a3b', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 800 }}
                >
                  🖨️ Imprimer
                </button>
              </div>
            </div>

            {/* KPI Cards Budget */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="card" style={{ padding: '18px', background: 'rgba(0,168,224,0.06)', border: '1.5px solid #00a8e0', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>💵 BUDGET ALLOUÉ (FCFA)</div>
                <input
                  type="number"
                  className="form-input"
                  value={ficheMarche.budget || ''}
                  onChange={e => saveFicheMarche({ ...ficheMarche, budget: Number(e.target.value) || 0 })}
                  placeholder="Saisir budget (ex: 150000)"
                  style={{ fontSize: 20, fontWeight: 900, color: '#0d2a3b', background: '#fff', padding: '8px 12px' }}
                />
              </div>

              <div className="card" style={{ padding: '18px', background: 'rgba(239,68,68,0.06)', border: '1.5px solid #ef4444', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626' }}>🛒 TOTAL DÉPENSÉ (ACHATS)</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', margin: '4px 0' }}>{fcfa(totalDepense)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{ficheMarche.articles.length} aliments enregistrés</div>
              </div>

              <div className="card" style={{ padding: '18px', background: resteBudget >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.08)', border: resteBudget >= 0 ? '1.5px solid #10b981' : '1.5px solid #ef4444', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: resteBudget >= 0 ? '#16a34a' : '#dc2626' }}>
                  {resteBudget >= 0 ? '💰 SOLDE DISPONIBLE' : '⚠️ DÉPASSEMENT BUDGET'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: resteBudget >= 0 ? '#16a34a' : '#dc2626', margin: '4px 0' }}>
                  {fcfa(resteBudget)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{resteBudget >= 0 ? 'Budget respecté' : 'Veuillez réajuster les montants'}</div>
              </div>
            </div>

            {/* Tableau Interactif Modifiable du Marché */}
            <div className="card" style={{ padding: '1.2rem', borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0d2a3b' }}>🛒 Saisie et Modification Directe des Ingrédients</h3>
                <span style={{ fontSize: 11, color: '#64748b' }}>✏️ Cliquez directement dans les cases pour modifier les noms, quantités et prix.</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)', fontSize: 12, textTransform: 'uppercase', color: '#64748b' }}>
                      <th style={{ textAlign: 'center', padding: '10px 8px', width: 50 }}>Payé</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Aliment / Ingrédient à payer</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', width: 140 }}>Quantité</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', width: 160 }}>Prix Unitaire (P.U FCFA)</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', width: 160 }}>Prix Total (FCFA)</th>
                      <th style={{ textAlign: 'center', padding: '10px 8px', width: 60 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficheMarche.articles.map((art, idx) => {
                      const qty = parseFloat(art.quantite) || 1
                      const totalArt = Number(art.pu) * qty

                      return (
                        <tr key={art.id || idx} style={{ borderBottom: '1px solid var(--border)', background: art.achete ? 'rgba(16,185,129,0.03)' : 'transparent' }}>
                          <td style={{ textAlign: 'center', padding: '8px' }}>
                            <input
                              type="checkbox"
                              checked={!!art.achete}
                              onChange={() => toggleArticleAchete(art.id)}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              className="form-input"
                              value={art.nom || ''}
                              onChange={e => updateArticleField(art.id, 'nom', e.target.value)}
                              placeholder="Nom de l'aliment à payer..."
                              style={{ fontWeight: 700, textDecoration: art.achete ? 'line-through' : 'none', color: art.achete ? '#94a3b8' : '#0d2a3b' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              className="form-input"
                              value={art.quantite || ''}
                              onChange={e => updateArticleField(art.id, 'quantite', e.target.value)}
                              placeholder="ex: 15 Kg"
                              style={{ textAlign: 'center', fontWeight: 700 }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number"
                              className="form-input"
                              value={art.pu || ''}
                              onChange={e => updateArticleField(art.id, 'pu', Number(e.target.value) || 0)}
                              placeholder="P.U (FCFA)"
                              style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}
                            />
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 900, color: '#16a34a', fontSize: 14 }}>
                            {fcfa(totalArt)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '8px' }}>
                            <button
                              aria-label="Supprimer cet aliment"
                              onClick={() => deleteArticle(art.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 16, cursor: 'pointer' }}
                              title="Supprimer cet aliment"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      )
                    })}

                    {ficheMarche.articles.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                          <div style={{ fontSize: 36, marginBottom: 6 }}>🛒</div>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>Aucun aliment répertorié pour le moment.</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>Cliquez ci-dessous sur "+ Ajouter un Aliment" pour commencer les achats du jour.</div>
                          <button
                            className="btn btn-primary"
                            onClick={() => setNewArticleModal(true)}
                            style={{ marginTop: 12, background: 'linear-gradient(135deg, #00a8e0, #0078b4)', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 800 }}
                          >
                            + Ajouter le premier aliment
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {ficheMarche.articles.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'rgba(0,168,224,0.06)', fontWeight: 900, fontSize: 14 }}>
                        <td colSpan={4} style={{ padding: '14px 12px', textAlign: 'right' }}>TOTAL GÉNÉRAL DU MARCHÉ :</td>
                        <td style={{ padding: '14px 12px', textAlign: 'right', color: '#dc2626', fontSize: 16 }}>{fcfa(totalDepense)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
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
            <div className="modal-title">🛒 Ajouter un Aliment / Ingrédient à Payer</div>

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
              <label className="form-label">Prix Unitaire (P.U FCFA)</label>
              <input
                type="number"
                className="form-input"
                value={newArticle.pu}
                onChange={e => setNewArticle({ ...newArticle, pu: e.target.value })}
                placeholder="Ex: 2500"
              />
            </div>

            <button className="btn btn-primary" onClick={handleAddArticle}>
              Ajouter à la Fiche du Marché
            </button>
            <button className="btn-cancel" onClick={() => setNewArticleModal(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
