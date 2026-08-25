import React, { useState, useEffect } from 'react'
import SuiviStock from './SuiviStock'
import { supabase } from '../lib/supabase'
import NotificationCenter from './NotificationCenter'
import DossierPersonnel from './DossierPersonnel'
import DemandesEnseignant from './DemandesEnseignant'
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

const DAY_LABELS_EN = {
  Lundi: 'Monday',
  Mardi: 'Tuesday',
  Mercredi: 'Wednesday',
  Jeudi: 'Thursday',
  Vendredi: 'Friday'
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

const lireDateMenu = valeur => {
  const texte = String(valeur || '').trim()
  const fr = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const iso = texte.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const date = fr
    ? new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]))
    : iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

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
  const dateDebut = lireDateMenu(debut)
  const dateFin = lireDateMenu(fin)

  if (dateDebut && dateFin) {
    const moisFin = dateFin.toLocaleDateString('fr-FR', { month: 'long' }).toUpperCase()
    const anneeFin = dateFin.getFullYear()
    const memeMois = dateDebut.getMonth() === dateFin.getMonth() && dateDebut.getFullYear() === anneeFin
    const debutLisible = memeMois
      ? String(dateDebut.getDate())
      : dateDebut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }).toUpperCase()
    return `MENU DE LA SEMAINE PROCHAINE · DU ${debutLisible} AU ${dateFin.getDate()} ${moisFin} ${anneeFin}`
  }

  if (menu?.dates_semaine && String(menu.dates_semaine).trim() && !menu?.date_debut) {
    const uppercaseDates = String(menu.dates_semaine).trim().toUpperCase()
    if (uppercaseDates.startsWith('MENU')) return uppercaseDates
    if (uppercaseDates.startsWith('DU')) return `MENU ${uppercaseDates}`
    return `MENU DU ${uppercaseDates}`
  }

  return `MENU DE LA SEMAINE PROCHAINE · DU ${debut} AU ${fin}`
}

// Les cinq élèves de démonstration qui vivaient ici ont été supprimés.
// Ils servaient d'état initial : quand la requête échouait, la cuisinière
// lisait leurs allergies fictives en croyant lire les vraies. Le code mort
// finit toujours par être réutilisé — celui-ci ne le sera pas.

// ═══════════════════════════════════════════════════════════════════════
// FICHE ALIMENTAIRE — décision D1, V2.1 §14
// ═══════════════════════════════════════════════════════════════════════
//
// Trois états, et un seul autorise le mot « Aucune ».
//
//   non_validee            → « FICHE NON VALIDÉE ». Personne n'a vérifié.
//   validee_sans_allergie  → « Aucune allergie », avec le nom du valideur
//                            et la date. C'est une affirmation, elle est
//                            donc signée.
//   validee_avec_allergies → la liste.
//
// L'absence d'information n'est pas une absence d'allergie. C'est cette
// confusion qui faisait afficher « ✅ Aucune allergie médicale » à des
// enfants dont personne n'avait jamais lu la fiche.
export const etatFiche = (el) => {
  const statut = el?.fiche_alim_statut || 'non_validee'
  if (statut === 'validee_avec_allergies') return { etat: 'avec',      libelle: 'Fiche validée' }
  if (statut === 'validee_sans_allergie')  return { etat: 'sans',      libelle: 'Aucune allergie — validée' }
  return { etat: 'non_validee', libelle: 'FICHE NON VALIDÉE' }
}

const libelleAllergene = (code, referentiel) =>
  referentiel.find(a => a.code === code)?.libelle || code

// Rend la fiche d'un élève sans jamais transformer un silence en réponse.
export function FicheAlimentaire({ el, referentiel, compact = false }) {
  const { etat } = etatFiche(el)
  const codes = [...(el.allergies_connues || []), ...(el.restrictions_alimentaires || [])]

  if (etat === 'non_validee') return (
    <span style={{ color: '#b45309', fontWeight: 800, fontSize: compact ? 10 : 11,
                   background: '#fef3c7', padding: '2px 7px', borderRadius: 5,
                   border: '1px solid #fcd34d' }}>
      ⚠️ FICHE NON VALIDÉE
    </span>
  )

  if (etat === 'sans') return (
    <span style={{ color: '#16a34a', fontWeight: 700, fontSize: compact ? 10 : 11 }}>
      ✅ Aucune allergie
      {!compact && el.fiche_alim_validee_le && (
        <span style={{ color: '#64748b', fontWeight: 400, display: 'block', fontSize: 10 }}>
          validée le {new Date(el.fiche_alim_validee_le).toLocaleDateString('fr-FR')}
        </span>
      )}
    </span>
  )

  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {codes.map(c => (
        <span key={c} style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 800,
                               fontSize: compact ? 9 : 10, padding: '2px 7px', borderRadius: 5,
                               border: '1px solid #fca5a5' }}>
          ⚠️ {libelleAllergene(c, referentiel)}
        </span>
      ))}
      {el.notes_alimentaires && !compact && (
        <span style={{ color: '#b45309', fontSize: 10, display: 'block', width: '100%' }}>
          Note : {el.notes_alimentaires}
        </span>
      )}
    </span>
  )
}

export default function CuisiniereApp({ user, onLogout, initialTab = 'eleves' }) {
  const [tab, setTab] = useState(initialTab)
  const [rhTab, setRhTab] = useState('dossier')
  // Plus de données de démonstration en état initial. Elles restaient à
  // l'écran quand la requête échouait, et cinq enfants fictifs avec des
  // allergies fictives s'affichaient à la place des vrais. [INV-UI-03]
  const [eleves, setEleves] = useState([])
  const [erreurChargement, setErreurChargement] = useState('')
  const [allergenes, setAllergenes] = useState([])
  const [effectifJour, setEffectifJour] = useState(null)
  const [analyseMenu, setAnalyseMenu] = useState(null)
  const [menuSemaine, setMenuSemaine] = useState(EMPTY_MENU_SEMAINE)
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
  // Bloc d'ajout dépliable en bas de la liste, à la manière d'un formulaire
  // en ligne : on ne quitte pas la page pour ajouter un aliment.
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [newArticle, setNewArticle] = useState({ nom: '', quantite: '', pu: 0, en_stock: false })

  // La fiche du marché reste une saisie libre : on tape l'aliment, la quantité
  // et le prix unitaire, le montant se calcule. Le seul lien avec le
  // garde-manger est la case « je l'ai déjà », qui sort la ligne du budget
  // sans la retirer de la fiche.

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadPointageForDate(datePointage)
  }, [datePointage])

  const loadData = async () => {
    try {
      setLoading(true)
      setErreurChargement('')

      // ── Élèves et fiches alimentaires ────────────────────────────────
      //
      // L'erreur était ici purement et simplement ignorée : seul `data`
      // était déstructuré, et une garde `length > 0` laissait l'écran sur
      // cinq enfants fictifs quand la requête échouait. La cuisinière
      // pouvait donc lire des allergies inventées en croyant lire les
      // vraies. C'est corrigé : l'échec se voit.
      const { data: dataEleves, error: errEleves } = await supabase
        .from('eleves')
        .select('*, classes(nom)')
        .eq('actif', true)

      if (errEleves) throw errEleves

      // Aucune normalisation vers « Aucune ». D1 : une fiche non validée
      // n'est pas une fiche sans allergie, et le silence ne doit jamais
      // ressembler à une réponse.
      const listeEleves = Array.isArray(dataEleves) ? dataEleves : []
      setEleves(listeEleves.map(e => ({
        ...e,
        classeNom: e.classes?.nom || '—',
        allergies_connues: Array.isArray(e.allergies_connues) ? e.allergies_connues : [],
        restrictions_alimentaires: Array.isArray(e.restrictions_alimentaires) ? e.restrictions_alimentaires : [],
      })))

      // Référentiel des allergènes, pour afficher des libellés lisibles
      // plutôt que des codes.
      const { data: dataAllerg } = await supabase
        .from('allergenes').select('code, libelle, ordre').eq('actif', true).order('ordre')
      setAllergenes(Array.isArray(dataAllerg) ? dataAllerg : [])

      // Effectif du jour — V2.1 §14 : les présences alimentent la cantine.
      const { data: eff } = await supabase.rpc('effectif_cantine_du_jour', { p_date: datePointage })
      setEffectifJour(eff || null)

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
      // Chargement, erreur et vide sont trois états distincts. Les
      // confondre, c'est présenter une panne comme une absence de données —
      // et en cuisine, une absence de données se lit « aucune allergie ».
      console.warn('Erreur chargement Supabase cantine :', e)
      setErreurChargement(e?.message || 'Erreur inattendue')
      setEleves([])
    } finally {
      setLoading(false)
    }
  }

  // Télécharger l'affiche complète du menu de la semaine au format JPEG HD pour la chaîne WhatsApp
  const exportMenuJpeg = async () => {
    const posterElem = document.getElementById('menu-whatsapp-poster')
    if (!posterElem) return
    setMsg('⏳ Génération de l’affiche A4 HD en cours...')
    const stylesAvant = {
      width: posterElem.style.width,
      maxWidth: posterElem.style.maxWidth,
      height: posterElem.style.height,
      minHeight: posterElem.style.minHeight,
      borderRadius: posterElem.style.borderRadius,
    }
    try {
      // Dimensions CSS d'une feuille A4 portrait à 96 dpi. html2canvas les
      // multiplie ensuite par 3 pour produire un JPEG net de 2382 × 3369 pixels.
      Object.assign(posterElem.style, {
        width: '794px', maxWidth: 'none', height: '1123px', minHeight: '1123px', borderRadius: '28px'
      })
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (posterElem.scrollHeight > 1123) {
        throw new Error('Le contenu dépasse une page A4. Raccourcissez légèrement les descriptions des plats.')
      }
      const canvas = await html2canvas(posterElem, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#fffdfa',
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 794,
      })
      const dataUrl = canvas.toDataURL('image/jpeg', 0.98)
      const link = document.createElement('a')
      link.download = `Menu_Service_Restauration_IDEAL_${getTodayString()}.jpg`
      link.href = dataUrl
      link.click()
      setMsg('📸 Affiche A4 HD téléchargée avec succès ! Prête pour l’envoi du vendredi aux familles.')
      setTimeout(() => setMsg(''), 4000)
    } catch (err) {
      console.error(err)
      alert('Erreur lors de la création du JPEG : ' + err.message)
    } finally {
      Object.assign(posterElem.style, stylesAvant)
    }
  }

  // Charger le pointage d'une date spécifique
  const loadPointageForDate = async (dt) => {
    try {
      const key = `cantine_pointage_${dt}`
      // `app` fait partie de la clé primaire : sans elle, la lecture peut
      // tomber sur une autre ligne portant la même clé.
      const { data } = await supabase.from('app_state').select('value')
        .eq('app', 'cantine').eq('key', key).maybeSingle()
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

  // Sauvegarder le pointage du jour dans Supabase.
  //
  // ── Ce qui ne marchait pas ─────────────────────────────────────────────
  //
  // L'upsert omettait `app`, colonne de la clé primaire et NOT NULL. Chaque
  // enregistrement partait en 400 (23502) et AUCUN pointage n'a jamais été
  // écrit — vérifié en base : la table n'en contient pas une seule ligne.
  //
  // Rien ne le disait. Le client Supabase ne lève pas d'exception : il rend
  // `{ error }`. Le `try/catch` ne se déclenchait donc jamais, et même le
  // `console.error` restait muet. La cuisinière cochait ses repas, l'écran
  // les affichait, et tout disparaissait au rechargement.
  const savePointage = async (updatedPt) => {
    setPointage(updatedPt)
    const key = `cantine_pointage_${datePointage}`
    const { error } = await supabase.from('app_state').upsert({
      app: 'cantine', key, value: updatedPt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'app,key' })
    // Un pointage perdu en silence est pire que pas de pointage : la
    // cuisinière croit avoir enregistré, et les effectifs du lendemain sont
    // faux sans que personne sache pourquoi.
    if (error) {
      setErreurChargement(
        `Le pointage du ${datePointage} n'a pas été enregistré : ${error.message}. `
        + `Ne quittez pas cet écran, signalez-le à la direction.`)
      return false
    }
    setErreurChargement('')
    return true
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
  // ═══════════════════════════════════════════════════════════════════
  // COMPARAISON MENU / RESTRICTIONS — V2.1 §14
  // ═══════════════════════════════════════════════════════════════════
  //
  // « Lors de la création d'un menu, le système compare les ingrédients aux
  // restrictions alimentaires des enfants concernés. Une incompatibilité
  // produit une alerte AVANT validation et permet de prévoir une
  // alternative. »
  //
  // Les plats n'ont pas d'ingrédients structurés : ce sont des phrases. Le
  // balayage se fait donc sur les motifs du référentiel, ce qui rend le §14
  // applicable sans imposer à la cuisinière de ressaisir ses recettes.
  //
  // Conséquence assumée : cette analyse ne peut jamais conclure
  // « compatible ». Elle dit ce qu'elle a trouvé, et dit aussi ce qu'elle ne
  // peut pas garantir. Une fiche non validée remonte comme telle.
  const platsDuMenu = (menu) => {
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
    const parties = [['entree', 'Entrée'], ['plat', 'Plat'], ['dessert', 'Dessert'], ['gouter', 'Goûter']]
    const out = []
    for (const j of jours) {
      const d = menu?.[j]
      if (!d) continue
      for (const [cle, libelle] of parties) {
        const titre = d[`${cle}Titre`] || ''
        const desc = d[`${cle}Desc`] || ''
        if (!titre && !desc) continue
        out.push({ jour: j, plat: `${libelle} — ${titre}`.trim(), texte: `${titre} ${desc}` })
      }
    }
    return out
  }

  const analyserMenu = async (menu = menuSemaine) => {
    const plats = platsDuMenu(menu)
    if (plats.length === 0) return { plats: 0, conflits: [], nonValidees: [], indeterminees: [], erreur: null }

    const { data, error } = await supabase.rpc('analyser_menu_alimentaire', { p_plats: plats })
    if (error) {
      // Une analyse qui échoue n'est pas une analyse rassurante. On le dit.
      return { plats: plats.length, conflits: [], nonValidees: [], indeterminees: [], erreur: error.message }
    }
    const lignes = Array.isArray(data) ? data : []

    // Dédoublonnage : un plat qui contient plusieurs motifs du même
    // allergène — « bolognaise » et « viande hachée » — décrit un seul
    // conflit. Un compteur qui annonce trois alertes là où il y en a une
    // apprend à ne plus le croire.
    const vus = new Set()
    const conflits = lignes.filter(l => {
      if (l.niveau !== 'conflit') return false
      const cle = `${l.eleve_id}|${l.jour}|${l.plat}|${l.allergene}`
      if (vus.has(cle)) return false
      vus.add(cle); return true
    })

    return {
      plats: plats.length,
      conflits,
      nonValidees:   lignes.filter(l => l.niveau === 'fiche_non_validee'),
      indeterminees: lignes.filter(l => l.niveau === 'cantine_indeterminee'),
      erreur: null,
    }
  }

  const saveMenuSemaine = async (updatedMenu = menuSemaine, options = {}) => {
    setMenuSemaine(updatedMenu)

    // L'analyse précède l'enregistrement — c'est la lettre du §14 : l'alerte
    // vient AVANT la validation, pas après. `sansAnalyse` sert aux champs de
    // date, qui écrivent à la frappe et ne changent aucun plat.
    if (!options.sansAnalyse) {
      const a = await analyserMenu(updatedMenu)
      setAnalyseMenu(a)

      if (a.erreur) {
        alert("⚠️ La vérification des allergies n'a pas pu être effectuée :\n\n" + a.erreur +
              "\n\nLe menu n'a pas été enregistré. Sans cette vérification, rien ne garantit " +
              "qu'il convient à tous les enfants.")
        return false
      }

      if (a.conflits.length > 0) {
        const parEleve = {}
        for (const c of a.conflits) {
          const k = `${c.prenom} ${c.nom} (${c.classe})`
          parEleve[k] = parEleve[k] || []
          parEleve[k].push(`${c.jour} · ${c.plat} → ${c.allergene}`)
        }
        const detail = Object.entries(parEleve)
          .map(([e, l]) => `• ${e}\n    ${l.join('\n    ')}`).join('\n')

        const ok = window.confirm(
          `⛔ MENU INCOMPATIBLE — ${a.conflits.length} alerte(s) sur ${Object.keys(parEleve).length} enfant(s)\n\n` +
          detail +
          `\n\nPrévoyez une alternative pour ces enfants, ou modifiez le plat.\n\n` +
          `Enregistrer quand même ? L'alerte restera affichée.`
        )
        if (!ok) return false
      }
    }

    try {
      // `app` fait partie de la clé primaire et ne peut être nulle : sans elle
      // l'écriture partait en 400 et la cantine ne quittait jamais l'appareil.
      // Le client Supabase ne lève pas d'exception : il rend `{ error }`. Le
      // `catch` ci-dessous ne se déclenchait donc jamais sur un refus du
      // serveur, et « ✅ Menu enregistré » s'affichait quand même.
      const { error } = await supabase.from('app_state').upsert({ app: 'cantine', key: 'cantine_menu_semaine', value: updatedMenu, updated_at: new Date().toISOString() }, { onConflict: 'app,key' })
      if (error) {
        alert("Le menu n'a pas été enregistré : " + error.message
          + "\n\nIl reste affiché sur cet appareil. Signalez-le à la direction.")
        return false
      }
      setMsg('✅ Menu de la semaine enregistré.')
      setTimeout(() => setMsg(''), 4000)
      return true
    } catch (e) {
      alert('Erreur enregistrement menu: ' + e.message)
      return false
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
      const { error } = await supabase.from('app_state').upsert({ app: 'cantine', key: 'cantine_fiche_marche', value: updatedMarche, updated_at: new Date().toISOString() }, { onConflict: 'app,key' })
      if (error) throw error
      return true
    } catch (e) {
      console.error(e)
      setMsg(`Enregistrement impossible : ${e.message}`)
      return false
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
    setAjoutOuvert(true)   // le bloc reste ouvert, prêt pour l'aliment suivant
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

    const ficheEnregistree = await saveFicheMarche(updatedMarche)
    if (!ficheEnregistree) return

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

      const { data: stateJustifs, error: lectureError } = await supabase.from('app_state').select('value').eq('app', 'cantine').eq('key', 'cantine_justificatifs_historique').maybeSingle()
      if (lectureError) throw lectureError
      const currentList = (stateJustifs && Array.isArray(stateJustifs.value)) ? stateJustifs.value : []
      const filteredList = currentList.filter(j => j.date_du_jour !== justificatifEntry.date_du_jour || j.type_periode !== justificatifEntry.type_periode)
      const newList = [justificatifEntry, ...filteredList]

      const { error: transmissionError } = await supabase.from('app_state').upsert({
        app: 'cantine',
        key: 'cantine_justificatifs_historique',
        value: newList,
        updated_at: new Date().toISOString()
      }, { onConflict: 'app,key' })
      if (transmissionError) throw transmissionError

      setMsg('📜 Fiche du marché validée, signée par la cuisinière et enregistrée dans les justificatifs du Responsable Administratif !')
      setTimeout(() => setMsg(''), 5000)
    } catch (e) {
      console.error('Erreur transmission justificatif:', e)
      setMsg(`⚠️ La fiche est signée, mais sa transmission a échoué : ${e.message}`)
    }
  }

  // Mettre à jour les allergies d'un élève
  // Validation de la fiche alimentaire — le maillon humain qu'exige D1.
  //
  // L'ancienne version écrivait dans `eleves.allergies` et
  // `eleves.restrictions`, colonnes qui n'ont jamais existé. Le `catch` était
  // vide : chaque enregistrement échouait en silence depuis toujours, et la
  // cuisinière croyait avoir sauvegardé.
  const saveEleveAllergie = async () => {
    if (!editEleveModal) return
    const m = editEleveModal
    const aQuelqueChose = (m.allergies_connues || []).length > 0
                       || (m.restrictions_alimentaires || []).length > 0

    // Le statut découle de la saisie : on ne peut pas déclarer « sans
    // allergie » tout en cochant des allergènes, ni l'inverse.
    const statut = m.fiche_alim_statut === 'non_validee'
      ? 'non_validee'
      : (aQuelqueChose ? 'validee_avec_allergies' : 'validee_sans_allergie')

    const { error } = await supabase.rpc('valider_fiche_alimentaire', {
      p_eleve_id:     m.id,
      p_statut:       statut,
      p_allergies:    m.allergies_connues || [],
      p_restrictions: m.restrictions_alimentaires || [],
      p_notes:        m.notes_alimentaires || null,
      p_valide_par:   statut === 'non_validee' ? null : (user?.id || null),
      p_cantine:      m.cantine ?? null,
    })

    // Un échec ne doit plus être silencieux : une fiche qu'on croit
    // enregistrée et qui ne l'est pas est exactement le scénario à éviter.
    if (error) {
      alert("❌ La fiche n'a pas été enregistrée :\n\n" + error.message)
      return
    }

    setEditEleveModal(null)
    setMsg(statut === 'non_validee'
      ? 'Fiche laissée non validée.'
      : '✅ Fiche alimentaire validée et enregistrée.')
    setTimeout(() => setMsg(''), 4000)
    await loadData()
  }

  // Filtrage des élèves
  // `cantine` a trois états : TRUE inscrit, FALSE non inscrit, NULL inconnu.
  // On inclut l'inconnu — mieux vaut un couvert de trop qu'un enfant oublié —
  // mais on le compte à part pour ne pas le présenter comme une certitude.
  const elevesInscrits = eleves.filter(e => e.cantine !== false)
  const nbCantineIndeterminee = eleves.filter(e => e.cantine === null || e.cantine === undefined).length
  const nbFichesNonValidees = elevesInscrits.filter(e => !e.fiche_alim_statut || e.fiche_alim_statut === 'non_validee').length
  const elevesFiltres = elevesInscrits.filter(e => {
    const matchSearch = `${e.nom} ${e.prenom} ${e.classe}`.toLowerCase().includes(searchEleve.toLowerCase())
    const matchClasse = filterClasse === 'ALL' || e.classe === filterClasse
    return matchSearch && matchClasse
  })

  const classesUniques = Array.from(new Set(elevesInscrits.map(e => e.classe || 'CP1'))).sort()
  const nbAllergies = elevesInscrits.filter(e => etatFiche(e).etat === 'avec').length

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
          borderRadius: 18,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          alignSelf: 'start',
          boxShadow: '0 8px 24px rgba(0,0,0,0.04)'
        }}
      >
        {/* En-tête Cadre simple avec juste le jour dedans (SANS POINTILLÉS ET SANS TIRETS) */}
        <div style={{ background: scheme.headerBg, color: scheme.headerText, padding: '6px 12px', borderRadius: 11, textAlign: 'center', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: '1.3px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {DAY_LABELS_EN[j] || j}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 9, alignItems: 'start' }}>

        {/* ENTRÉE DU CHEF */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, lineHeight: 1.25, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>🥗</span> ENTRÉE DU CHEF
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.2, fontWeight: 900, color: '#0f172a' }}>
            “{item.entreeTitre || item.entree || 'Entrée fraîche'}”
          </div>
          <div style={{ fontSize: 10.5, color: '#475569', fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>
            <span style={{ color: '#d97706' }}>✦</span> {item.entreeDesc || 'Composition fraîcheur préparée le matin.'}
          </div>
        </div>

        {/* PLAT PRINCIPAL CHAUD (FOND BLANC ÉLÉGANT) */}
        <div style={{ background: 'rgba(255,255,255,0.85)', padding: '7px 9px', borderRadius: 11, border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, lineHeight: 1.25, fontWeight: 900, color: '#047857', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>🍲</span> PLAT PRINCIPAL CHAUD
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.2, fontWeight: 900, color: '#064e3b' }}>
            “{item.platTitre || item.plat || 'Plat du Chef'}”
          </div>
          <div style={{ fontSize: 10.5, color: '#334155', fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>
            <span style={{ color: '#047857' }}>✦</span> {item.platDesc || 'Recette gourmande adaptée à la nutrition infantile.'}
          </div>
        </div>

        {/* DESSERT & FRUITS */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, lineHeight: 1.25, fontWeight: 900, color: '#d97706', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>🍎</span> DESSERT &amp; FRUITS
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.2, fontWeight: 900, color: '#0f172a' }}>
            “{item.dessertTitre || item.dessert || 'Dessert du jour'}”
          </div>
          <div style={{ fontSize: 10.5, color: '#475569', fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>
            <span style={{ color: '#d97706' }}>✦</span> {item.dessertDesc || 'Sélection de fruits mûrs et naturels.'}
          </div>
        </div>

        {/* GOÛTER & COLLATION */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, lineHeight: 1.25, fontWeight: 900, color: '#e11d48', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>🍪</span> GOÛTER &amp; COLLATION
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.2, fontWeight: 900, color: '#0f172a' }}>
            “{item.gouterTitre || item.boisson || 'Collation douce'}”
          </div>
          <div style={{ fontSize: 10.5, color: '#475569', fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>
            <span style={{ color: '#e11d48' }}>✦</span> {item.gouterDesc || 'Collation légère adaptée aux petites mains.'}
          </div>
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
          <button
            className={`top-nav-item ${tab === 'rh' ? 'active' : ''}`}
            onClick={() => setTab('rh')}
            style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: 12, fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>💼 7. Mon espace RH</span>
          </button>
      </div>

      {/* Main Content */}
      {/* `maxWidth: 1380` était écrit en dur ici et l'emportait sur la feuille
          de style : sur un téléphone de 375 px, la colonne s'autorisait à
          grandir jusqu'à la largeur de son contenu et débordait de l'écran.
          `min(1380px, 100%)` garde le confort sur grand écran sans jamais
          dépasser la largeur disponible. */}
      <div className="page-content ux-page" style={{ padding: '1.5rem 1.2rem calc(130px + env(safe-area-inset-bottom))', maxWidth: 'min(1380px, 100%)', margin: '0 auto' }}>
        {msg && <div className="error-msg" style={{ background: 'rgba(123,193,66,0.15)', borderColor: '#7bc142', color: '#275204', marginBottom: 16, borderRadius: 12, padding: '12px 16px', fontWeight: 700 }} onClick={() => setMsg('')}>{msg}</div>}

        {/* ════════════════ SESSION 1 : ÉLÈVES INSCRITS & ALLERGIES ════════════════ */}
        {tab === 'eleves' && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0d2a3b', margin: '0 0 4px 0' }}>🥗 Session 1 : Élèves Inscrits à la Cantine</h1>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Liste officielle du service de restauration et précisions médicales sur les allergies &amp; régimes spéciaux.</p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '8px 14px', borderRadius: 12, fontSize: 12, fontWeight: 800, color: '#991b1b' }}>
                  🚨 {nbAllergies} avec allergies
                </div>
                {/* Ce compteur est le plus important de l'écran : il dit
                    combien d'enfants mangent ici sans que personne n'ait
                    vérifié ce qu'ils peuvent manger. */}
                {nbFichesNonValidees > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '8px 14px', borderRadius: 12, fontSize: 12, fontWeight: 800, color: '#92400e' }}>
                    ⚠️ {nbFichesNonValidees} fiche(s) NON VALIDÉE(S)
                  </div>
                )}
                {nbCantineIndeterminee > 0 && (
                  <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    {nbCantineIndeterminee} inscription(s) cantine non déterminée(s)
                  </div>
                )}
              </div>
            </div>

            {/* Chargement, erreur et vide sont trois écrans distincts.
                Les confondre revient à présenter une panne comme une
                absence d'allergie. */}
            {loading && (
              <div style={{ padding: 28, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                Chargement des fiches alimentaires…
              </div>
            )}

            {!loading && erreurChargement && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderLeft: '5px solid #dc2626',
                            padding: '16px 18px', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ fontWeight: 900, color: '#991b1b', fontSize: 14, marginBottom: 5 }}>
                  ⛔ Les fiches alimentaires n'ont pas pu être chargées
                </div>
                <div style={{ fontSize: 12.5, color: '#7f1d1d' }}>
                  N'utilisez pas cet écran pour préparer le service : la liste affichée est vide
                  parce que la connexion a échoué, pas parce qu'aucun enfant n'a d'allergie.
                </div>
                <button className="btn-sm" style={{ marginTop: 10 }} onClick={loadData}>Réessayer</button>
              </div>
            )}

            {!loading && !erreurChargement && eleves.length === 0 && (
              <div style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>
                Aucun élève actif enregistré.
              </div>
            )}

            {/* Effectif du jour — V2.1 §14 : les présences alimentent la cantine. */}
            {effectifJour && (
              <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex',
                                             gap: 22, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
                <b style={{ color: '#0d2a3b' }}>📊 Effectif du {new Date(effectifJour.date).toLocaleDateString('fr-FR')}</b>
                <span>Inscrits cantine : <b>{effectifJour.inscrits_cantine}</b></span>
                <span>Présents et inscrits : <b>{effectifJour.presents_et_cantine}</b></span>
                <span style={{ color: effectifJour.presences_saisies === 0 ? '#b45309' : '#64748b' }}>
                  {effectifJour.source_presences}
                </span>
              </div>
            )}

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
                const aAllergie = etatFiche(el).etat === 'avec'
                const aRestriction = etatFiche(el).etat === 'avec' && (el.restrictions_alimentaires || []).length > 0

                return (
                  <div key={el.id} className="card" style={{ padding: '16px', borderLeft: aAllergie ? '5px solid #ef4444' : aRestriction ? '5px solid #f59e0b' : '5px solid #10b981', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#0d2a3b' }}>
                          {(el.nom || '').toUpperCase()} {el.prenom}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                          🏫 Classe : {el.classeNom || el.classe || '—'}
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
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
                        <span style={{ fontWeight: 800, color: '#475569', minWidth: 90 }}>🛑 Fiche :</span>
                        <FicheAlimentaire el={el} referentiel={allergenes} />
                      </div>

                      {el.declaration_alim_parent && (
                        <div style={{ fontSize: 10.5, color: '#64748b', fontStyle: 'italic',
                                      background: '#f8fafc', padding: '5px 8px', borderRadius: 5 }}>
                          Déclaré par le parent, non validé : « {el.declaration_alim_parent} »
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                        <span style={{ fontWeight: 800, color: '#475569', minWidth: 90 }}>🍽️ Cantine :</span>
                        {el.cantine === true
                          ? <span style={{ color: '#16a34a', fontWeight: 700 }}>Inscrit</span>
                          : el.cantine === false
                          ? <span style={{ color: '#64748b' }}>Non inscrit</span>
                          : <span style={{ color: '#b45309', fontWeight: 700 }}>⚠️ Non déterminé</span>}
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
                      const aAllergie = etatFiche(el).etat === 'avec'

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
                              <FicheAlimentaire el={el} referentiel={allergenes} compact />
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
                    onChange={e => saveMenuSemaine({ ...menuSemaine, date_debut: e.target.value }, { sansAnalyse: true })}
                    placeholder="Ex: 12/01/2026"
                    style={{ fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 800 }}>Date de Fin (Vendredi)</label>
                  <input
                    className="form-input"
                    value={menuSemaine.date_fin || '16/01/2026'}
                    onChange={e => saveMenuSemaine({ ...menuSemaine, date_fin: e.target.value }, { sansAnalyse: true })}
                    placeholder="Ex: 16/01/2026"
                    style={{ fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 800 }}>Intitulé complet de la période</label>
                  <input
                    className="form-input"
                    value={menuSemaine.dates_semaine || '12 au 16 janvier 2026'}
                    onChange={e => saveMenuSemaine({ ...menuSemaine, dates_semaine: e.target.value }, { sansAnalyse: true })}
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
                    onChange={e => saveMenuSemaine({ ...menuSemaine, date_debut: e.target.value }, { sansAnalyse: true })}
                    placeholder="12/01/2026"
                    style={{ width: 110, fontWeight: 800, color: '#0d2a3b', textAlign: 'center', padding: '6px 8px' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>Au</span>
                  <input
                    className="form-input"
                    value={menuSemaine.date_fin || '16/01/2026'}
                    onChange={e => saveMenuSemaine({ ...menuSemaine, date_fin: e.target.value }, { sansAnalyse: true })}
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
                maxWidth: 794,
                minHeight: 1123,
                margin: '0 auto',
                padding: '14px 18px 12px',
                background: 'linear-gradient(180deg, #fffdfa 0%, #faf8f5 100%)',
                color: '#0f172a',
                borderRadius: 28,
                boxShadow: '0 25px 60px rgba(0,0,0,0.12)',
                border: '3px double #d97706',
                position: 'relative',
                overflow: 'hidden',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Filigrane de sécurité couronne impériale */}
              <div style={{ position: 'absolute', top: -40, right: -40, fontSize: 220, opacity: 0.03, pointerEvents: 'none' }}>👑</div>

              {/* EN-TÊTE ÉLÉGANT LUXE */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, borderBottom: '2px solid rgba(217,119,6,0.3)', padding: '5px 8px 10px', marginBottom: 5, textAlign: 'left' }}>
                <img src="/logo-ideal.png" alt="IDEAL" style={{ height: 48, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.08))' }} />

                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#d97706', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    IDEAL ÉCOLE INTERNATIONALE BILINGUE
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 900, color: '#0f172a', letterSpacing: '1.2px', marginTop: 5 }}>
                    SERVICE DE RESTAURATION
                  </div>
                </div>
              </div>

              {/* PÉRIODE TOUJOURS VISIBLE DANS L'IMAGE EXPORTÉE */}
              <div style={{ textAlign: 'center', marginBottom: 6 }}>
                <div style={{ display: 'block', background: '#174e72', color: '#ffffff', padding: '8px 18px', borderRadius: 14, border: '2px solid #d97706', boxShadow: '0 4px 12px rgba(23,78,114,.2)', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 15, lineHeight: 1.25, fontWeight: 900, color: '#ffffff', letterSpacing: '.8px', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
                    {getPosterMenuDateTitle(menuSemaine)}
                  </div>
                </div>
              </div>

              <div style={{ background: 'linear-gradient(90deg,#fff7e8,#fffdf7,#eef8f1)', borderRadius: 13, padding: '6px 16px', marginBottom: 7, textAlign: 'center', border: '1px solid #f3d7ab' }}>
                <div style={{ fontSize: 13, lineHeight: 1.35, color: '#17364d', fontWeight: 800 }}>
                  🌟 Chers parents, découvrez en avant-première le menu de la semaine prochaine !
                </div>
                <div style={{ marginTop: 2, fontSize: 11, color: '#667784', fontWeight: 700 }}>
                  Nous souhaitons à tous nos élèves une semaine pleine d’énergie et une excellente dégustation. 😋
                </div>
              </div>

              {/* DISPOSITION RESPONSIVE DES JOURS */}
              <div style={{ display: 'grid', gridTemplateRows: 'auto auto', alignContent: 'space-evenly', gap: 14, marginBottom: 10, flex: 1, minHeight: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}>
                  {['Lundi', 'Mardi', 'Mercredi'].map(j => renderDayCard(j))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}>
                  {['Jeudi', 'Vendredi'].map(j => renderDayCard(j))}
                </div>
              </div>

              {/* PIED DE PAGE HAUTE QUALITÉ AVEC SCEAU DE GARANTIE */}
              <div style={{ borderTop: '2px solid rgba(217,119,6,0.3)', paddingTop: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 900, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>🍽️</span> PRÉPARÉ AVEC SOIN POUR NOS ÉLÈVES
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

        {tab === 'rh' && (
          <section>
            <div className="card" style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0d2a3b' }}>💼 Mon espace Ressources Humaines</h1>
                  <p style={{ margin: '5px 0 0', fontSize: 13, color: '#64748b' }}>Dossier administratif, demandes, congés et justificatifs du personnel de cuisine.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    onClick={() => setRhTab('dossier')}
                    style={{ background: rhTab === 'dossier' ? '#0d2a3b' : '#f1f5f9', color: rhTab === 'dossier' ? '#fff' : '#334155', borderRadius: 20, fontWeight: 800 }}
                  >
                    📂 Mon dossier RH
                  </button>
                  <button
                    className="btn"
                    onClick={() => setRhTab('demandes')}
                    style={{ background: rhTab === 'demandes' ? '#0d2a3b' : '#f1f5f9', color: rhTab === 'demandes' ? '#fff' : '#334155', borderRadius: 20, fontWeight: 800 }}
                  >
                    📩 Demandes &amp; justificatifs
                  </button>
                </div>
              </div>
            </div>

            {rhTab === 'dossier' && <DossierPersonnel user={user} profInfo={user} roleLabel="Personnel de cuisine" />}
            {rhTab === 'demandes' && <DemandesEnseignant user={user} portalLabel="Portail du personnel de cuisine" personnelLabel="Collègue" />}
          </section>
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

              {/* ── Saisie à l'écran : une carte par aliment, empilées ──
                  Chaque champ occupe toute la largeur : sur un téléphone, on
                  lit le nom, la quantité et le prix sans faire défiler de
                  côté, et le total de la ligne s'affiche sous les champs. */}
              <div className="ecran-seul">
                {ficheMarche.articles.map((art, idx) => {
                  const qty = parseFloat(art.quantite) || 1
                  const totalArt = art.en_stock ? 0 : Number(art.pu) * qty
                  return (
                    <div key={art.id || idx} style={{
                      border: '1px solid ' + (art.en_stock ? '#cbd5e1' : art.achete ? '#86efac' : 'var(--border)'),
                      background: art.en_stock ? 'rgba(100,116,139,.05)' : art.achete ? 'rgba(16,185,129,.04)' : '#fff',
                      borderRadius: 14, padding: '12px 14px', marginBottom: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)', minWidth: 20 }}>{idx + 1}.</span>
                        <input
                          className="form-input"
                          value={art.nom || ''}
                          onChange={e => updateArticleField(art.id, 'nom', e.target.value)}
                          placeholder="Nom de l'aliment"
                          style={{ flex: 1, fontWeight: 800, fontSize: 15 }}
                        />
                        <button onClick={() => deleteArticle(art.id)} title="Supprimer"
                          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer' }}>🗑️</button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)' }}>
                          QUANTITÉ
                          <input className="form-input" value={art.quantite || ''}
                            onChange={e => updateArticleField(art.id, 'quantite', e.target.value)}
                            placeholder="ex : 8 kg" style={{ marginTop: 2, fontWeight: 700 }} />
                        </label>
                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)' }}>
                          PRIX UNITAIRE
                          <input type="number" className="form-input" value={art.pu || ''}
                            onChange={e => updateArticleField(art.id, 'pu', Number(e.target.value) || 0)}
                            placeholder="FCFA" style={{ marginTop: 2, fontWeight: 700 }} />
                        </label>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {!art.en_stock && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              <input type="checkbox" checked={!!art.achete} onChange={() => toggleArticleAchete(art.id)} style={{ width: 16, height: 16 }} />
                              Payé
                            </label>
                          )}
                          <button onClick={() => toggleArticleEnStock(art.id)}
                            style={{
                              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                              border: '1px solid ' + (art.en_stock ? '#64748b' : 'var(--border)'),
                              background: art.en_stock ? '#64748b' : '#fff', color: art.en_stock ? '#fff' : '#64748b',
                            }}>
                            🥫 {art.en_stock ? 'Déjà en stock' : 'Je l’ai déjà'}
                          </button>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: art.en_stock ? '#64748b' : '#16a34a' }}>
                          {art.en_stock ? 'non acheté' : fcfa(totalArt)}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Le bloc d'ajout se déplie en bas de la liste : on saisit, on
                    valide, l'aliment rejoint la pile et le bloc se rouvre vide
                    pour le suivant. */}
                {!ajoutOuvert ? (
                  <button onClick={() => setAjoutOuvert(true)}
                    style={{ width: '100%', padding: '14px', borderRadius: 14, border: '2px dashed var(--accent)', background: 'rgba(0,168,224,.04)', color: 'var(--accent)', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
                    ➕ Ajouter un aliment
                  </button>
                ) : (
                  <div style={{ border: '2px solid var(--accent)', borderRadius: 14, padding: '14px', background: 'rgba(0,168,224,.03)' }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', marginBottom: 10 }}>NOUVEL ALIMENT</div>

                    <input className="form-input" autoFocus placeholder="Nom de l'aliment — ex : Poulet"
                      value={newArticle.nom} onChange={e => setNewArticle({ ...newArticle, nom: e.target.value })}
                      style={{ fontWeight: 700, marginBottom: 8 }} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)' }}>
                        QUANTITÉ
                        <input className="form-input" placeholder="ex : 8 kg" value={newArticle.quantite}
                          onChange={e => setNewArticle({ ...newArticle, quantite: e.target.value })} style={{ marginTop: 2 }} />
                      </label>
                      <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)' }}>
                        PRIX UNITAIRE
                        <input type="number" className="form-input" placeholder="FCFA" value={newArticle.pu}
                          onChange={e => setNewArticle({ ...newArticle, pu: e.target.value })} style={{ marginTop: 2 }} />
                      </label>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      <input type="checkbox" checked={Boolean(newArticle.en_stock)}
                        onChange={e => setNewArticle({ ...newArticle, en_stock: e.target.checked })} style={{ width: 16, height: 16 }} />
                      🥫 Je l’ai déjà — ne pas acheter
                    </label>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={handleAddArticle}
                        style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>
                        Ajouter à la fiche
                      </button>
                      <button onClick={() => { setAjoutOuvert(false); setNewArticle({ nom: '', quantite: '', pu: 0, en_stock: false }) }}
                        style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {ficheMarche.articles.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '14px', borderRadius: 14, background: 'rgba(0,168,224,.08)', border: '1px solid rgba(0,168,224,.3)' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#0d2a3b' }}>TOTAL DU MARCHÉ</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>{fcfa(totalDepense)}</div>
                  </div>
                )}
              </div>

              {/* Le tableau reste le document imprimé — c'est lui qui part au
                  responsable administratif. À l'écran, sur un téléphone, ses
                  six colonnes deviennent illisibles : le total et les actions
                  sortent du cadre. On le réserve donc à l'impression et on
                  empile des cartes à l'écran. */}
              <div className="impression-seule" style={{ overflowX: 'auto' }}>
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
            
            {/* La déclaration du parent, telle qu'il l'a écrite. Elle sert
                à instruire, jamais à faire foi : « RAS » n'est pas une
                absence d'allergie constatée (D1). */}
            {editEleveModal.declaration_alim_parent ? (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3px solid #94a3b8',
                            padding: '10px 12px', borderRadius: 6, marginBottom: 14, fontSize: 12.5 }}>
                <div style={{ fontWeight: 800, color: '#475569', fontSize: 10.5, letterSpacing: .5, marginBottom: 4 }}>
                  DÉCLARÉ PAR LE PARENT À L'INSCRIPTION — NON VALIDÉ
                </div>
                <div style={{ fontStyle: 'italic', color: '#334155', whiteSpace: 'pre-line' }}>
                  {editEleveModal.declaration_alim_parent}
                </div>
              </div>
            ) : (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '10px 12px',
                            borderRadius: 6, marginBottom: 14, fontSize: 12.5, color: '#92400e' }}>
                Aucune déclaration du parent n'est rattachée à cet élève.
                L'absence de déclaration n'est pas une absence d'allergie.
              </div>
            )}

            <div className="form-group">
              <label className="form-label">🛑 Allergies constatées</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allergenes.map(a => {
                  const coche = (editEleveModal.allergies_connues || []).includes(a.code)
                  return (
                    <button key={a.code} type="button"
                      onClick={() => setEditEleveModal({ ...editEleveModal,
                        allergies_connues: coche
                          ? editEleveModal.allergies_connues.filter(c => c !== a.code)
                          : [...(editEleveModal.allergies_connues || []), a.code] })}
                      style={{ padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                               cursor: 'pointer',
                               border: coche ? '1px solid #dc2626' : '1px solid #cbd5e1',
                               background: coche ? '#fee2e2' : '#fff',
                               color: coche ? '#b91c1c' : '#64748b' }}>
                      {coche ? '⚠️ ' : ''}{a.libelle}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">🍽️ Restrictions et régimes</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allergenes.map(a => {
                  const coche = (editEleveModal.restrictions_alimentaires || []).includes(a.code)
                  return (
                    <button key={a.code} type="button"
                      onClick={() => setEditEleveModal({ ...editEleveModal,
                        restrictions_alimentaires: coche
                          ? editEleveModal.restrictions_alimentaires.filter(c => c !== a.code)
                          : [...(editEleveModal.restrictions_alimentaires || []), a.code] })}
                      style={{ padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                               cursor: 'pointer',
                               border: coche ? '1px solid #d97706' : '1px solid #cbd5e1',
                               background: coche ? '#fef3c7' : '#fff',
                               color: coche ? '#b45309' : '#64748b' }}>
                      {coche ? 'ℹ️ ' : ''}{a.libelle}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Le référentiel ne peut pas tout prévoir. Ce champ existe pour
                qu'aucune allergie ne soit perdue faute de terme. */}
            <div className="form-group">
              <label className="form-label">📝 Précisions (cas non listé, gravité, conduite à tenir)</label>
              <textarea className="form-input" rows={2}
                value={editEleveModal.notes_alimentaires || ''}
                onChange={e => setEditEleveModal({ ...editEleveModal, notes_alimentaires: e.target.value })}
                placeholder="Ce que le référentiel ne couvre pas..." />
            </div>

            <div className="form-group">
              <label className="form-label">🍽️ Inscription cantine</label>
              <select className="form-select"
                value={editEleveModal.cantine === true ? 'oui' : editEleveModal.cantine === false ? 'non' : 'inconnu'}
                onChange={e => setEditEleveModal({ ...editEleveModal,
                  cantine: e.target.value === 'oui' ? true : e.target.value === 'non' ? false : null })}>
                <option value="inconnu">⚠️ Non déterminé</option>
                <option value="oui">Inscrit à la cantine</option>
                <option value="non">Non inscrit</option>
              </select>
            </div>

            <div style={{ background: '#f1f5f9', padding: '10px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={editEleveModal.fiche_alim_statut !== 'non_validee'}
                  onChange={e => setEditEleveModal({ ...editEleveModal,
                    fiche_alim_statut: e.target.checked ? 'validee_sans_allergie' : 'non_validee' })}
                  style={{ marginTop: 3 }} />
                <span>
                  <b>Je valide cette fiche.</b> Tant qu'elle n'est pas validée, la cuisine
                  affiche « FICHE NON VALIDÉE » — jamais « aucune allergie ».
                  <span style={{ display: 'block', color: '#64748b', marginTop: 3 }}>
                    Validée par {user?.prenom} {user?.nom}, le {new Date().toLocaleDateString('fr-FR')}.
                  </span>
                </span>
              </label>
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
