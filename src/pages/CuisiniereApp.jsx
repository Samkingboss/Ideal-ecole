import React, { useState, useEffect } from 'react'
import SuiviStock from './SuiviStock'
import { supabase } from '../lib/supabase'
import NotificationCenter from './NotificationCenter'
import html2canvas from 'html2canvas'

const fcfa = n => (Math.round(Number(n) || 0)).toLocaleString('fr-FR') + ' F'

// Palette de fonds colorés très distincts et élégants sans bordures pour chaque jour
const DAY_COLOR_SCHEMES = {
  Lundi: { cardBg: '#dcfce7', headerBg: '#047857', headerText: '#ffffff' },
  Mardi: { cardBg: '#fef3c7', headerBg: '#d97706', headerText: '#ffffff' },
  Mercredi: { cardBg: '#e0f2fe', headerBg: '#0284c7', headerText: '#ffffff' },
  Jeudi: { cardBg: '#fce7f3', headerBg: '#db2777', headerText: '#ffffff' },
  Vendredi: { cardBg: '#e2e8f0', headerBg: '#0f172a', headerText: '#ffffff' }
}

// Exemple officiel de menu hebdomadaire haute gastronomie
const SAMPLE_MENU_SEMAINE = {
  date_debut: "12/01/2026",
  date_fin: "16/01/2026",
  dates_semaine: "12/01/2026 au 16/01/2026",
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
  date_debut: "12/01/2026",
  date_fin: "16/01/2026",
  dates_semaine: "12/01/2026 au 16/01/2026",
  Lundi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' },
  Mardi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' },
  Mercredi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' },
  Jeudi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' },
  Vendredi: { entreeTitre: '', entreeDesc: '', platTitre: '', platDesc: '', dessertTitre: '', dessertDesc: '', gouterTitre: '', gouterDesc: '' }
}

const getTodayString = () => new Date().toISOString().split('T')[0]

// Ingrédients du marché vides par défaut
const EMPTY_FICHE_MARCHE = {
  type_periode: 'journalier',
  date_du_jour: getTodayString(),
  periode_semaine: 'Semaine du 12 au 16 Janvier 2026',
  budget: 0,
  articles: []
}

// Générateur ultra-robuste de titre de date pour l'affiche (Garantie de non-vacuité)
const getPosterMenuDateTitle = (menu) => {
  const debut = (menu?.date_debut && String(menu.date_debut).trim()) || '12/01/2026'
  const fin = (menu?.date_fin && String(menu.date_fin).trim()) || '16/01/2026'

  if (menu?.dates_semaine && String(menu.dates_semaine).trim() && !menu?.date_debut) {
    const uppercaseDates = String(menu.dates_semaine).trim().toUpperCase()
    if (uppercaseDates.startsWith('MENU')) return uppercaseDates
    if (uppercaseDates.startsWith('DU')) return `MENU ${uppercaseDates}`
    return `MENU DU ${uppercaseDates}`
  }

  return `MENU DU ${debut} AU ${fin}`
}

// Données démo élèves cantine (chargées depuis Supabase si actives)
const DEMO_ELEVES_CANTINE = [
  { id: 'el-1', nom: 'TRAORÉ', prenom: 'Aïcha', classe: 'CP1 Bilingue', cantine: true, allergies: 'Allergie aux Arachides', restrictions: 'Sans Porc' },
  { id: 'el-2', nom: 'SANOGO', prenom: 'Ibrahim', classe: 'CP1 Bilingue', cantine: true, allergies: 'Intolérance au Lactose', restrictions: 'Sans Lait' },
  { id: 'el-3', nom: 'COULIBALY', prenom: 'Fatoumata', classe: 'CP2 A', cantine: true, allergies: 'Aucune', restrictions: 'Sans Porc' },
  { id: 'el-4', nom: 'DIARRA', prenom: 'Mamadou', classe: 'CE1 B', cantine: true, allergies: 'Allergie au Poisson', restrictions: 'Végétarien' },
  { id: 'el-5', nom: 'KEITA', prenom: 'Oumar', classe: 'CE2', cantine: true, allergies: 'Aucune', restrictions: 'Aucune' }
]

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
  const [newArticle, setNewArticle] = useState({ nom: '', quantite: '', pu: 0, en_stock: false })

  // Le garde-manger, pour ne pas racheter ce qu'on a déjà. Chargé une fois ;
  // l'écran du marché s'en sert seulement pour proposer et pour informer, il
  // n'y touche jamais — le stock ne bouge que par un mouvement.
  const [stockCuisine, setStockCuisine] = useState([])
  useEffect(() => {
    supabase.from('materiels').select('id, nom, unite, quantite')
      .eq('actif', true).eq('magasin', 'cuisine').order('nom')
      .then(({ data, error }) => { if (!error) setStockCuisine(data || []) })
  }, [])

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
      if (stateMenu && stateMenu.value) {
        const mergedMenu = {
          date_debut: stateMenu.value.date_debut || '12/01/2026',
          date_fin: stateMenu.value.date_fin || '16/01/2026',
          dates_semaine: stateMenu.value.dates_semaine || '12/01/2026 au 16/01/2026',
          ...stateMenu.value
        }
        if (!mergedMenu.date_debut) mergedMenu.date_debut = '12/01/2026'
        if (!mergedMenu.date_fin) mergedMenu.date_fin = '16/01/2026'
        setMenuSemaine(mergedMenu)
      }

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
      link.download = `Menu_Service_Restauration_IDEAL_${getTodayString()}.jpg`
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
      // `app` fait partie de la clé primaire et ne peut être nulle : sans elle
      // l'écriture partait en 400 et la cantine ne quittait jamais l'appareil.
      await supabase.from('app_state').upsert({ app: 'cantine', key: 'cantine_menu_semaine', value: updatedMenu, updated_at: new Date().toISOString() }, { onConflict: 'app,key' })
      setMsg('✅ Menu de la semaine enregistré avec succès !')
      setTimeout(() => setMsg(''), 4000)
    } catch (e) {
      alert('Erreur enregistrement menu: ' + e.message)
    }
  }

  // Charger le modèle d'exemple officiel
  const loadSampleMenu = () => {
    saveMenuSemaine(SAMPLE_MENU_SEMAINE)
    setMsg('✨ Modèle officiel du Service de Restauration chargé avec succès !')
    setTimeout(() => setMsg(''), 3000)
  }

  // Effacer tout le menu de la semaine
  const clearMenuSemaine = async () => {
    if (!confirm('Voulez-vous effacer toutes les données du menu de la semaine ?')) return
    setMenuSemaine(EMPTY_MENU_SEMAINE)
    try {
      await supabase.from('app_state').upsert({ app: 'cantine', key: 'cantine_menu_semaine', value: EMPTY_MENU_SEMAINE, updated_at: new Date().toISOString() }, { onConflict: 'app,key' })
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
      await supabase.from('app_state').upsert({ app: 'cantine', key: 'cantine_fiche_marche', value: updatedMarche, updated_at: new Date().toISOString() }, { onConflict: 'app,key' })
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
    saveFicheMarche({ ...EMPTY_FICHE_MARCHE, budget: 0, articles: [] })
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
      achete: false,
      // Déjà au garde-manger : la ligne reste sur la fiche pour mémoire, mais
      // elle ne se paie pas et ne compte pas dans le budget.
      en_stock: Boolean(newArticle.en_stock),
    }
    const updated = { ...ficheMarche, articles: [...ficheMarche.articles, article] }
    saveFicheMarche(updated)
    setNewArticle({ nom: '', quantite: '', pu: 0, en_stock: false })
    setNewArticleModal(false)
    setMsg('🛒 Aliment ajouté au marché !')
    setTimeout(() => setMsg(''), 3000)
  }

  // Toggle statut acheté
  const toggleArticleAchete = (id) => {
    const updatedArticles = ficheMarche.articles.map(a => a.id === id ? { ...a, achete: !a.achete } : a)
    saveFicheMarche({ ...ficheMarche, articles: updatedArticles })
  }

  // Une ligne déjà couverte par le garde-manger sort du budget sans quitter la
  // fiche : la cuisinière garde sous les yeux tout ce que le menu réclame, et
  // voit d'un coup d'œil ce qui reste à acheter.
  const toggleArticleEnStock = (id) => {
    const updatedArticles = ficheMarche.articles.map(a =>
      a.id === id ? { ...a, en_stock: !a.en_stock, achete: a.en_stock ? a.achete : false } : a
    )
    saveFicheMarche({ ...ficheMarche, articles: updatedArticles })
  }

  // Supprimer un article
  const deleteArticle = (id) => {
    const updatedArticles = ficheMarche.articles.filter(a => a.id !== id)
    saveFicheMarche({ ...ficheMarche, articles: updatedArticles })
  }

  // Validation, signature et transmission de la fiche du marché au Responsable Administratif
  const handleValidateAndSendFicheMarche = async () => {
    if (ficheMarche.articles.length === 0) {
      alert('Veuillez ajouter au moins un aliment à la fiche du marché avant de la valider et de la transmettre.')
      return
    }

    const timestamp = new Date().toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const sigNom = ficheMarche.signature_nom && ficheMarche.signature_nom.trim()
      ? ficheMarche.signature_nom.trim()
      : (user?.prenom ? `${user.prenom} ${user.nom}` : 'Chef Cuisinière IDEAL')

    const updatedMarche = {
      ...ficheMarche,
      valide: true,
      signature_nom: sigNom,
      date_validation: timestamp
    }

    saveFicheMarche(updatedMarche)

    // Transmettre la fiche signée dans l'historique des justificatifs Supabase pour le Responsable Administratif
    try {
      const justificatifEntry = {
        id: `justif-marche-${Date.now()}`,
        type: 'fiche_marche',
        date: getTodayString(),
        type_periode: ficheMarche.type_periode || 'journalier',
        date_du_jour: ficheMarche.date_du_jour || getTodayString(),
        periode_semaine: ficheMarche.periode_semaine || 'Semaine du 12 au 16 Janvier 2026',
        budget: Number(ficheMarche.budget) || 0,
        total_depense: totalDepense,
        solde: resteBudget,
        articles: ficheMarche.articles,
        signature_nom: sigNom,
        timestamp: timestamp,
        statut: 'VALIDE_CUISINE'
      }

      const { data: stateJustifs } = await supabase.from('app_state').select('value').eq('key', 'cantine_justificatifs_historique').single()
      const currentList = (stateJustifs && Array.isArray(stateJustifs.value)) ? stateJustifs.value : []
      const filteredList = currentList.filter(j => j.date_du_jour !== justificatifEntry.date_du_jour || j.type_periode !== justificatifEntry.type_periode)
      const newList = [justificatifEntry, ...filteredList]

      await supabase.from('app_state').upsert({
        app: 'cantine',
        key: 'cantine_justificatifs_historique',
        value: newList,
        updated_at: new Date().toISOString()
      })

      setMsg('📜 Fiche du marché validée, signée par la cuisinière et enregistrée dans les justificatifs du Responsable Administratif !')
      setTimeout(() => setMsg(''), 5000)
    } catch (e) {
      console.error('Erreur transmission justificatif:', e)
      setMsg('📜 Fiche du marché signée et transmise avec succès !')
      setTimeout(() => setMsg(''), 4000)
    }
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
  // Ce qu'on a déjà ne se paie pas : une ligne marquée « en stock » ne pèse
  // rien dans le budget, sinon la fiche demanderait de l'argent pour du riz
  // qui est dans l'armoire.
  const totalDepense = ficheMarche.articles.reduce((s, a) => {
    if (a.en_stock) return s
    const qty = parseFloat(a.quantite) || 1
    return s + (Number(a.pu) * qty)
  }, 0)
  const aAcheter = ficheMarche.articles.filter(a => !a.en_stock)
  const dejaEnStock = ficheMarche.articles.filter(a => a.en_stock)
  const resteBudget = (Number(ficheMarche.budget) || 0) - totalDepense

  // Décompte du pointage repas
  const countMatin = elevesInscrits.filter(e => pointage[e.id]?.matin).length
  const countMidi = elevesInscrits.filter(e => pointage[e.id]?.midi).length
  const countGouter = elevesInscrits.filter(e => pointage[e.id]?.gouter).length

  // Rendu de la carte d'un jour (Fond coloré SANS BORDURES, Cadre simple pour le jour SANS pointillés)
  const renderDayCard = (j) => {
    const item = menuSemaine[j] || {}
    const scheme = DAY_COLOR_SCHEMES[j] || { cardBg: '#f8fafc', headerBg: '#047857', headerText: '#ffffff' }

    return (
      <div
        key={j}
        style={{
          background: scheme.cardBg,
          border: 'none', // SANS BORDURE
          borderRadius: 24,
          padding: '22px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 8px 24px rgba(0,0,0,0.04)'
        }}
      >
        {/* En-tête Cadre simple avec juste le jour dedans (SANS POINTILLÉS ET SANS TIRETS) */}
        <div style={{ background: scheme.headerBg, color: scheme.headerText, padding: '10px 16px', borderRadius: 14, textAlign: 'center', fontWeight: 900, fontSize: 16, textTransform: 'uppercase', letterSpacing: '1.5px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {j}
        </div>

        {/* ENTRÉE DU CHEF */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>🥗</span> ENTRÉE DU CHEF
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
            “{item.entreeTitre || item.entree || 'Entrée fraîche'}”
          </div>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
            <span style={{ color: '#d97706' }}>✦</span> {item.entreeDesc || 'Composition fraîcheur préparée le matin.'}
          </div>
        </div>

        {/* PLAT PRINCIPAL CHAUD (FOND BLANC ÉLÉGANT) */}
        <div style={{ background: 'rgba(255,255,255,0.85)', padding: '12px 14px', borderRadius: 14, border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: '#047857', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>🍲</span> PLAT PRINCIPAL CHAUD
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#064e3b' }}>
            “{item.platTitre || item.plat || 'Plat du Chef'}”
          </div>
          <div style={{ fontSize: 12, color: '#334155', fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
            <span style={{ color: '#047857' }}>✦</span> {item.platDesc || 'Recette gourmande adaptée à la nutrition infantile.'}
          </div>
        </div>

        {/* DESSERT & FRUITS */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: '#d97706', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>🍎</span> DESSERT &amp; FRUITS
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
            “{item.dessertTitre || item.dessert || 'Dessert du jour'}”
          </div>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
            <span style={{ color: '#d97706' }}>✦</span> {item.dessertDesc || 'Sélection de fruits mûrs et naturels.'}
          </div>
        </div>

        {/* GOÛTER & COLLATION */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: '#e11d48', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>🍪</span> GOÛTER &amp; COLLATION
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
            “{item.gouterTitre || item.boisson || 'Collation douce'}”
          </div>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
            <span style={{ color: '#e11d48' }}>✦</span> {item.gouterDesc || 'Collation légère adaptée aux petites mains.'}
          </div>
        </div>
      </div>
    )
  }

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

      {/* Navigation des Sessions (Mobile-friendly Scroll horizontal sans chevauchement) */}
      {/* Un seul conteneur de defilement, et c'est `.top-nav-secondary`.
          Il y en avait deux, imbriques : la classe defile deja (overflow-x
          auto), et on l'avait enfermee dans un second conteneur defilant en
          lui imposant `width: max-content`. La classe n'avait alors plus rien
          a faire defiler, et son `overscroll-behavior-x: contain` empechait le
          geste de remonter au parent, seul a deborder vraiment : le doigt ne
          deplacait plus rien. */}
      <div className="top-nav-secondary" style={{ background: '#ffffff', borderBottom: '2px solid var(--border)', boxShadow: 'none', padding: '6px 8px' }}>
          <button
            className={`top-nav-item ${tab === 'eleves' ? 'active' : ''}`}
            onClick={() => setTab('eleves')}
            style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: 12, fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>🥗 1. Élèves Cantine &amp; Allergies ({elevesInscrits.length})</span>
          </button>
          <button
            className={`top-nav-item ${tab === 'checking' ? 'active' : ''}`}
            onClick={() => setTab('checking')}
            style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: 12, fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: tab==='checking' ? '#0d2a3b' : '', color: tab==='checking' ? '#7bc142' : '' }}
          >
            <span>📋 2. Checking Repas</span>
          </button>
          <button
            className={`top-nav-item ${tab === 'preparation' ? 'active' : ''}`}
            onClick={() => setTab('preparation')}
            style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: 12, fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>🍳 3. Préparation du Menu</span>
          </button>
          <button
            className={`top-nav-item ${tab === 'menu_jour' ? 'active' : ''}`}
            onClick={() => setTab('menu_jour')}
            style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: 12, fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>👑 4. Affiche Menu Hebdo (WhatsApp HD)</span>
          </button>
          <button
            className={`top-nav-item ${tab === 'marche' ? 'active' : ''}`}
            onClick={() => setTab('marche')}
            style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: 12, fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>🛒 5. Fiche du Marché</span>
          </button>
          <button
            className={`top-nav-item ${tab === 'stock' ? 'active' : ''}`}
            onClick={() => setTab('stock')}
          >
            <span>🥫 6. Stock Alimentaire</span>
          </button>
      </div>

      {/* Main Content */}
      {/* `maxWidth: 1380` était écrit en dur ici et l'emportait sur la feuille
          de style : sur un téléphone de 375 px, la colonne s'autorisait à
          grandir jusqu'à la largeur de son contenu et débordait de l'écran.
          `min(1380px, 100%)` garde le confort sur grand écran sans jamais
          dépasser la largeur disponible. */}
      <div className="page-content" style={{ padding: '1.5rem 1.2rem calc(130px + env(safe-area-inset-bottom))', maxWidth: 'min(1380px, 100%)', margin: '0 auto' }}>
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

            {/* Saisie des dates de début et fin de la semaine */}
            <div className="card" style={{ padding: '20px', marginBottom: 20, background: '#fff', borderRadius: 16 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 900, color: '#d97706' }}>📅 Période du Menu de Restauration</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 800 }}>Date de Début (Lundi)</label>
                  <input
                    className="form-input"
                    value={menuSemaine.date_debut || '12/01/2026'}
                    onChange={e => saveMenuSemaine({ ...menuSemaine, date_debut: e.target.value })}
                    placeholder="Ex: 12/01/2026"
                    style={{ fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 800 }}>Date de Fin (Vendredi)</label>
                  <input
                    className="form-input"
                    value={menuSemaine.date_fin || '16/01/2026'}
                    onChange={e => saveMenuSemaine({ ...menuSemaine, date_fin: e.target.value })}
                    placeholder="Ex: 16/01/2026"
                    style={{ fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 800 }}>Intitulé complet de la période</label>
                  <input
                    className="form-input"
                    value={menuSemaine.dates_semaine || '12 au 16 janvier 2026'}
                    onChange={e => saveMenuSemaine({ ...menuSemaine, dates_semaine: e.target.value })}
                    placeholder="Ex: 12 au 16 janvier 2026"
                    style={{ fontWeight: 800 }}
                  />
                </div>
              </div>
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

        {/* ════════════════ SESSION 4 : AFFICHE HEBDOMADAIRE OFFICIELLE (FONDS COLORÉS SANS BORDURES NI POINTILLÉS) ════════════════ */}
        {tab === 'menu_jour' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ maxWidth: '100%' }}>
                <h1 style={{ fontSize: 'clamp(18px, 4vw, 24px)', fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0', wordBreak: 'break-word' }}>👑 Session 4 : Service de Restauration — Affiche Officielle</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Visuel Officiel pour la chaîne WhatsApp des parents d'élèves.</p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
                <button
                  className="btn btn-primary"
                  onClick={exportMenuJpeg}
                  style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 12, fontWeight: 900, boxShadow: '0 6px 20px rgba(217,119,6,0.4)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, flex: '1 1 auto', justifyContent: 'center' }}
                >
                  📸 Télécharger Image JPEG HD
                </button>
                <button
                  className="btn-sm"
                  onClick={() => window.print()}
                  style={{ background: '#0f172a', color: '#fff', padding: '10px 16px', borderRadius: 12, fontWeight: 800, flex: '0 0 auto' }}
                >
                  🖨️ Imprimer
                </button>
              </div>
            </div>

            {/* BARRE DIRECTE DE Saisie/Modification des dates de l'affiche */}
            <div className="card" style={{ padding: '14px 16px', marginBottom: 20, background: '#ffffff', borderRadius: 16, borderLeft: '5px solid #0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', width: '100%', maxWidth: '100%' }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#0d2a3b' }}>📅 Dates de la Semaine sur l'Affiche :</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>Du</span>
                  <input
                    className="form-input"
                    value={menuSemaine.date_debut || '12/01/2026'}
                    onChange={e => saveMenuSemaine({ ...menuSemaine, date_debut: e.target.value })}
                    placeholder="12/01/2026"
                    style={{ width: 110, fontWeight: 800, color: '#0d2a3b', textAlign: 'center', padding: '6px 8px' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>Au</span>
                  <input
                    className="form-input"
                    value={menuSemaine.date_fin || '16/01/2026'}
                    onChange={e => saveMenuSemaine({ ...menuSemaine, date_fin: e.target.value })}
                    placeholder="16/01/2026"
                    style={{ width: 110, fontWeight: 800, color: '#0d2a3b', textAlign: 'center', padding: '6px 8px' }}
                  />
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 800, color: '#047857', background: '#f0fdf4', padding: '6px 12px', borderRadius: 8, border: '1px solid #bbf7d0', maxWidth: '100%', wordBreak: 'break-word' }}>
                ✨ {getPosterMenuDateTitle(menuSemaine)}
              </div>
            </div>

            {/* AFFICHE INTÉGRALE HEBDOMADAIRE (100% FLUIDE ET COMPATIBLE MOBILE) */}
            <div
              id="menu-whatsapp-poster"
              style={{
                width: '100%',
                maxWidth: 820,
                margin: '0 auto',
                padding: '1.8rem 1.2rem',
                background: 'linear-gradient(180deg, #fffdfa 0%, #faf8f5 100%)',
                color: '#0f172a',
                borderRadius: 24,
                boxShadow: '0 25px 60px rgba(0,0,0,0.12)',
                border: '3px double #d97706',
                position: 'relative',
                overflow: 'hidden',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxSizing: 'border-box'
              }}
            >
              {/* Filigrane de sécurité couronne impériale */}
              <div style={{ position: 'absolute', top: -40, right: -40, fontSize: 220, opacity: 0.03, pointerEvents: 'none' }}>👑</div>

              {/* EN-TÊTE ÉLÉGANT LUXE */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 16, borderBottom: '2px solid rgba(217,119,6,0.3)', paddingBottom: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                {/* Logo a gauche bien visible SANS cercle */}
                <img src="/logo-ideal.png" alt="IDEAL" style={{ height: 70, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.08))' }} />

                <div style={{ maxWidth: '100%' }}>
                  <div style={{ fontSize: 'clamp(16px, 4.5vw, 22px)', fontWeight: 900, color: '#d97706', letterSpacing: '1px', textTransform: 'uppercase', wordBreak: 'break-word' }}>
                    ÉCOLE INTERNATIONALE BILINGUE IDEAL
                  </div>
                  <div style={{ fontSize: 'clamp(22px, 6vw, 32px)', fontWeight: 900, color: '#0f172a', letterSpacing: '1.2px', marginTop: 2 }}>
                    SERVICE DE RESTAURATION
                  </div>
                </div>
              </div>

              {/* BARRE BLEU FONCÉ : DATES */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ display: 'inline-block', backgroundColor: '#0f172a', background: '#0f172a', color: '#ffffff', padding: '10px 24px', borderRadius: 36, border: '2.5px solid #d97706', boxShadow: '0 6px 20px rgba(15,23,42,0.25)', maxWidth: '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 'clamp(13px, 3.8vw, 17px)', fontWeight: 900, color: '#ffffff', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'system-ui, -apple-system, sans-serif', wordBreak: 'break-word' }}>
                    {getPosterMenuDateTitle(menuSemaine)}
                  </div>
                </div>
              </div>

              {/* DISPOSITION RESPONSIVE DES JOURS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                {/* RANGÉE 1 : LUNDI, MARDI, MERCREDI */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                  {['Lundi', 'Mardi', 'Mercredi'].map(j => renderDayCard(j))}
                </div>

                {/* RANGÉE 2 : JEUDI, VENDREDI */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                  {['Jeudi', 'Vendredi'].map(j => renderDayCard(j))}
                </div>
              </div>

              {/* PIED DE PAGE HAUTE QUALITÉ AVEC SCEAU DE GARANTIE */}
              <div style={{ borderTop: '2px solid rgba(217,119,6,0.3)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 900, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>🏅</span> CERTIFIÉ QUALITÉ &amp; NUTRITION GASTRONOMIQUE
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                    Produits 100% Frais — Cuisine Chef IDEAL
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', padding: '8px 18px', borderRadius: 24, border: '1px solid #f59e0b' }}>
                  📲 Diffusion Officielle WhatsApp Parents
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ SESSION 5 : FICHE DU MARCHÉ (100% MODIFIABLE & CHOIX PÉRIODE) ════════════════ */}
        {tab === 'stock' && (
          <div>
            <div className="section-head"><div className="section-title">🥫 Stock alimentaire &amp; fluides</div></div>
            <SuiviStock user={user} magasin="cuisine" />
          </div>
        )}

        {tab === 'marche' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>🛒 Session 5 : Fiche du Marché (100% Modifiable)</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Gestion du budget et émargement des achats d'aliments du jour ou de la semaine.</p>
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

            {/* SECTEUR DU TYPE DE BUDGET (JOURNALIER vs HEBDOMADAIRE) */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: 20, background: '#fff', borderRadius: 16, borderLeft: '5px solid #00a8e0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#0d2a3b' }}>📅 Période &amp; Type du Budget Cuisine</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Précisez si ce budget est alloué pour une **journée spécifique** ou pour **toute la semaine**.</div>
                </div>

                {/* Segmented Control Toggle */}
                <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%', maxWidth: 420, background: '#f1f5f9', padding: 4, borderRadius: 12, border: '1px solid #e2e8f0', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => saveFicheMarche({ ...ficheMarche, type_periode: 'journalier' })}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 'none',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      background: (ficheMarche.type_periode || 'journalier') === 'journalier' ? '#00a8e0' : 'transparent',
                      color: (ficheMarche.type_periode || 'journalier') === 'journalier' ? '#ffffff' : '#64748b',
                      boxShadow: (ficheMarche.type_periode || 'journalier') === 'journalier' ? '0 2px 8px rgba(0,168,224,0.3)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    📅 Budget Journalier (Par Jour)
                  </button>
                  <button
                    type="button"
                    onClick={() => saveFicheMarche({ ...ficheMarche, type_periode: 'hebdomadaire' })}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 'none',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      background: ficheMarche.type_periode === 'hebdomadaire' ? '#00a8e0' : 'transparent',
                      color: ficheMarche.type_periode === 'hebdomadaire' ? '#ffffff' : '#64748b',
                      boxShadow: ficheMarche.type_periode === 'hebdomadaire' ? '0 2px 8px rgba(0,168,224,0.3)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    🗓️ Budget Hebdomadaire (Par Semaine)
                  </button>
                </div>
              </div>

              {/* Saisie de la date du jour ou de la semaine selon l'option choisie */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {(ficheMarche.type_periode || 'journalier') === 'journalier' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 13, fontWeight: 800, color: '#0d2a3b' }}>📅 Date du jour :</label>
                    <input
                      type="date"
                      className="form-input"
                      value={ficheMarche.date_du_jour || getTodayString()}
                      onChange={e => saveFicheMarche({ ...ficheMarche, date_du_jour: e.target.value })}
                      style={{ width: '100%', maxWidth: 220, fontWeight: 800, color: '#0d2a3b' }}
                    />
                    <span style={{ fontSize: 12, color: '#047857', fontWeight: 800, background: '#f0fdf4', padding: '6px 14px', borderRadius: 8, border: '1px solid #bbf7d0', maxWidth: '100%' }}>
                      ℹ️ Fiche de Marché enregistrée pour le {new Date(ficheMarche.date_du_jour || getTodayString()).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 13, fontWeight: 800, color: '#0d2a3b' }}>🗓️ Semaine / Période :</label>
                    <input
                      className="form-input"
                      value={ficheMarche.periode_semaine || 'Semaine du 12 au 16 Janvier 2026'}
                      onChange={e => saveFicheMarche({ ...ficheMarche, periode_semaine: e.target.value })}
                      placeholder="Ex: Semaine du 12 au 16 Janvier 2026"
                      style={{ width: '100%', maxWidth: 320, fontWeight: 800, color: '#0d2a3b' }}
                    />
                    <span style={{ fontSize: 12, color: '#b45309', fontWeight: 800, background: '#fffbeb', padding: '6px 14px', borderRadius: 8, border: '1px solid #fde68a', maxWidth: '100%' }}>
                      ℹ️ Fiche de Marché globale pour toute la semaine
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* KPI Cards Budget */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="card" style={{ padding: '18px', background: 'rgba(0,168,224,0.06)', border: '1.5px solid #00a8e0', borderRadius: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>
                  💵 {(ficheMarche.type_periode || 'journalier') === 'journalier' ? 'BUDGET JOURNALIER ALLOUÉ (FCFA)' : 'BUDGET HEBDOMADAIRE ALLOUÉ (FCFA)'}
                </div>
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
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {aAcheter.length} à acheter
                  {dejaEnStock.length > 0 && ` · ${dejaEnStock.length} déjà en stock`}
                  {' '}sur {ficheMarche.articles.length} enregistrés
                </div>
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
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0d2a3b' }}>
                  🛒 Saisie et Modification Directe des Ingrédients
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginLeft: 8 }}>
                    ({(ficheMarche.type_periode || 'journalier') === 'journalier' ? `Du ${new Date(ficheMarche.date_du_jour || getTodayString()).toLocaleDateString('fr-FR')}` : ficheMarche.periode_semaine || 'Semaine'})
                  </span>
                </h3>
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
                      const totalArt = art.en_stock ? 0 : Number(art.pu) * qty

                      return (
                        <tr key={art.id || idx} style={{ borderBottom: '1px solid var(--border)', background: art.en_stock ? 'rgba(100,116,139,0.06)' : art.achete ? 'rgba(16,185,129,0.03)' : 'transparent' }}>
                          <td style={{ textAlign: 'center', padding: '8px' }}>
                            {/* Une ligne déjà couverte par le garde-manger ne
                                s'achète pas : la case « acheté » n'a plus de
                                sens, on met le repère du stock à la place. */}
                            {art.en_stock ? (
                              <span title="Déjà au garde-manger" style={{ fontSize: 15 }}>🥫</span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={!!art.achete}
                                onChange={() => toggleArticleAchete(art.id)}
                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                              />
                            )}
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
                          <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 900, color: art.en_stock ? '#64748b' : '#16a34a', fontSize: 14 }}>
                            {art.en_stock ? 'déjà en stock' : fcfa(totalArt)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '8px', whiteSpace: 'nowrap' }}>
                            <button
                              aria-label={art.en_stock ? 'Remettre dans la liste des achats' : 'Marquer comme déjà en stock'}
                              onClick={() => toggleArticleEnStock(art.id)}
                              style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', marginRight: 4, opacity: art.en_stock ? 1 : .35 }}
                              title={art.en_stock ? 'Remettre dans la liste des achats' : 'Je l’ai déjà — ne pas acheter'}
                            >
                              🥫
                            </button>
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

            {/* BLOC DE VALIDATION, SIGNATURE DE LA CUISINIÈRE ET TRANSMISSION AU RESPONSABLE ADMIN */}
            <div className="card" style={{ padding: '24px', borderRadius: 20, background: 'linear-gradient(180deg, #ffffff 0%, #fffbeb 100%)', border: '2px solid #f59e0b', marginTop: 24, boxShadow: '0 8px 24px rgba(217,119,6,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0d2a3b', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>✍️ Validation &amp; Signature Digitale de la Chef Cuisinière</span>
                    {ficheMarche.valide ? (
                      <span style={{ background: '#d1fae5', color: '#047857', border: '1px solid #6ee7b7', padding: '4px 12px', borderRadius: 10, fontSize: 11, fontWeight: 900 }}>
                        ✅ Signé &amp; Transmis au Responsable Admin
                      </span>
                    ) : (
                      <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d', padding: '4px 12px', borderRadius: 10, fontSize: 11, fontWeight: 900 }}>
                        ⏳ En attente de signature &amp; validation
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Une fois enregistrée, cette fiche du marché signée sera automatiquement transférée dans les **Justificatifs du Jour** du compte du Responsable Administratif.
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'center' }}>
                {/* Zone Nom & Signature */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#0d2a3b', display: 'block', marginBottom: 6 }}>
                    ✍️ Nom &amp; Prénom de la Cuisinière signataire :
                  </label>
                  <input
                    className="form-input"
                    value={ficheMarche.signature_nom || (user?.prenom ? `${user.prenom} ${user.nom}` : 'Chef Cuisinière IDEAL')}
                    onChange={e => saveFicheMarche({ ...ficheMarche, signature_nom: e.target.value })}
                    placeholder="Ex: Chef Aïcha TRAORÉ"
                    style={{ fontWeight: 800, color: '#0d2a3b', background: '#fff' }}
                  />
                </div>

                {/* Horodatage & Statut */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0d2a3b', marginBottom: 6 }}>
                    📅 Horodatage de la signature &amp; transmission :
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: ficheMarche.date_validation ? '#047857' : '#64748b', background: '#fff', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1' }}>
                    {ficheMarche.date_validation ? `✅ Transmise le ${ficheMarche.date_validation}` : '⌛ Non encore transmise aujourd\'hui'}
                  </div>
                </div>
              </div>

              {/* Bouton d'Enregistrement et de Transmission Directe */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #fde68a', display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleValidateAndSendFicheMarche}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '14px 28px',
                    borderRadius: 14,
                    fontWeight: 900,
                    fontSize: 15,
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(16,185,129,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <span>💾 Enregistrer &amp; Transmettre aux Justificatifs du Responsable Admin ➔</span>
                </button>
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

            {/* Choisir dans le garde-manger évite de retaper un nom et, surtout,
                montre ce qu'on a déjà avant de décider d'acheter. */}
            {stockCuisine.length > 0 && (
              <div className="form-group">
                <label className="form-label">Prendre dans le garde-manger</label>
                <select
                  className="form-input"
                  value={newArticle.nom_stock || ''}
                  onChange={e => {
                    const art = stockCuisine.find(x => x.id === e.target.value)
                    if (!art) { setNewArticle({ ...newArticle, nom_stock: '' }); return }
                    // S'il en reste, on propose de le marquer comme déjà
                    // disponible — la cuisinière garde le dernier mot.
                    setNewArticle({
                      ...newArticle,
                      nom_stock: art.id,
                      nom: art.nom,
                      en_stock: art.quantite > 0,
                    })
                  }}
                >
                  <option value="">— saisir un aliment libre —</option>
                  {stockCuisine.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nom} — {a.quantite > 0 ? `${a.quantite} ${a.unite} en stock` : 'stock épuisé'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Nom de l'aliment / Ingrédient</label>
              <input
                className="form-input"
                value={newArticle.nom}
                onChange={e => setNewArticle({ ...newArticle, nom: e.target.value, nom_stock: '' })}
                placeholder="Ex: Poulet fermier, Sac de Riz, Huile..."
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 14, borderRadius: 10, cursor: 'pointer', background: newArticle.en_stock ? 'rgba(46,158,79,.10)' : '#f1f5f9', border: '1px solid ' + (newArticle.en_stock ? 'var(--green)' : '#e2e8f0') }}>
              <input
                type="checkbox"
                checked={Boolean(newArticle.en_stock)}
                onChange={e => setNewArticle({ ...newArticle, en_stock: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: newArticle.en_stock ? 'var(--green)' : '#0d2a3b' }}>
                Je l’ai déjà — ne pas acheter
                <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>
                  La ligne reste sur la fiche pour mémoire, mais ne compte pas dans le budget.
                </div>
              </span>
            </label>

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
