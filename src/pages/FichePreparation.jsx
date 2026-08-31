import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { SEQUENCES, DUREE_SEQUENCE } from '../lib/sequences'
import { manuelsPour, avancement, leconParNumero, leconsDe, aDesUnites, pagesDe, situationDe, libelleUnite } from '../lib/programmes'
import { statutAuDepot, situationDepot, chargerDelai, ajouterHistorique, ACTIONS, evenementDepot } from '../lib/preparations'
import { notifierPreparation } from '../lib/notifications'
import { signature } from '../lib/identiteProfessionnelle'
import { messageEchecLisible } from '../lib/notifications'
import FrisePreparation from '../components/FrisePreparation'
import FichesCahiers from './FichesCahiers'
import { remarquesParSection, remarquesGenerales, nbCorrectionsOuvertes, cleEtape } from '../lib/remarques'
import { NOM_ECOLE } from '../lib/ecole'

// Fiche de préparation d'une notion.
//
// Une notion n'est plus enfermée dans 30 minutes : l'enseignant déclare
// combien de séquences elle demande (1 à 6). La fiche se déplie en autant de
// blocs de déroulement minutés, et chaque séquence est enregistrée comme une
// préparation distincte dans la table — elle compte donc dans les points.
//
// Les rubriques pédagogiques (objectif, prérequis, matériel, différenciation,
// évaluation, trace) sont communes à toutes les séquences de la même notion :
// on ne redéfinit pas l'objectif à chaque demi-heure. Seul le déroulement
// minuté est propre à chaque séquence.

export const RUBRIQUES = [
  { id: 'objectif', label: 'Objectif de la notion', obligatoire: true, lignes: 2,
    aide: "Ce que l'élève saura faire à la fin. Un verbe d'action : reconnaître, écrire, calculer…" },
  { id: 'prerequis', label: 'Prérequis', lignes: 2,
    aide: 'Ce qui doit déjà être acquis pour suivre cette notion.' },
  { id: 'materiel', label: 'Matériel et supports', lignes: 2,
    aide: 'Manuel, ardoises, images, objets à manipuler…' },
  { id: 'differenciation', label: 'Différenciation', lignes: 3,
    aide: "Ce que je prévois pour l'élève en difficulté, et pour celui qui va vite." },
  { id: 'evaluation', label: "Comment je vérifie que c'est acquis", obligatoire: true, lignes: 2,
    aide: "La question, l'exercice ou l'observation qui me le dira avant la fin de la notion." },
  { id: 'trace', label: 'Trace écrite et devoir', lignes: 2,
    aide: "Ce que l'élève garde dans son cahier, ce qu'il emporte à la maison." },
]

// Déroulement type d'une séquence de 30 minutes.
export const ETAPES = [
  { id: 'mise_en_route',  label: 'Mise en route',          minutes: 5,  aide: 'Rappel, mise en situation, annonce de l\u2019objectif.' },
  { id: 'decouverte',     label: 'Découverte / explication', minutes: 10, aide: 'Le cœur de la notion, montrée ou construite avec la classe.' },
  { id: 'pratique',       label: 'Pratique guidée',          minutes: 10, aide: 'Les élèves s\u2019exercent, je circule et je corrige.' },
  { id: 'cloture',        label: 'Clôture',                  minutes: 5,  aide: 'Ce qu\u2019on retient, vérification rapide.' },
]

// Options de durée proposées à l'enseignant.
const DUREES = [
  { nb: 1, label: '30 min' },
  { nb: 2, label: '1 h' },
  { nb: 3, label: '1 h 30' },
  { nb: 4, label: '2 h' },
  { nb: 6, label: '3 h' },
]

// ─── Usine à états vides ─────────────────────────────────────────────────────

const videSeq = () => ({
  etapes: Object.fromEntries(ETAPES.map(e => [e.id, { minutes: e.minutes, texte: '' }])),
})

const vide = (nb = 1) => ({
  ...Object.fromEntries(RUBRIQUES.map(r => [r.id, ''])),
  nb_sequences: nb,
  sequences: Array.from({ length: nb }, () => videSeq()),
  // Leçon du manuel visée par la fiche : { cle, lecon, unite, titre, page }.
  // Absent pour les matières sans manuel — la fiche reste alors libre.
  programme: null,
})

// Rétrocompatibilité : ancien format (etapes à plat) → nouveau (sequences[]).
const migrer = (contenu) => {
  if (!contenu) return vide()
  if (Array.isArray(contenu.sequences)) return contenu
  return {
    ...vide(),
    ...Object.fromEntries(RUBRIQUES.map(r => [r.id, contenu[r.id] || ''])),
    nb_sequences: 1,
    sequences: [{ etapes: contenu.etapes || videSeq().etapes }],
  }
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const horaireDe = seq => {
  const s = SEQUENCES.find(x => x.n === seq)
  if (!s) return null
  return `${String(Math.floor(s.debut / 60)).padStart(2, '0')}:${String(s.debut % 60).padStart(2, '0')}`
}

const heureAff = seq => (horaireDe(seq) || '').replace(':', 'h')
const horaireDuCreneau = (creneau, seq = creneau.sequence) =>
  seq === creneau.sequence && creneau.heure_debut
    ? creneau.heure_debut
    : horaireDe(seq)

const heureAffCreneau = (creneau, seq = creneau.sequence) =>
  (horaireDuCreneau(creneau, seq) || '').replace(':', 'h')

const dateLisible = iso =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

const identiteCreneau = creneau => creneau.id
  ? `edt:${creneau.id}`
  : `maternelle:${creneau.groupe}:${creneau.matiere}:${creneau.heure_debut}`

const cleBrouillon = (userId, dateCours, creneauCle) =>
  `ideal_brouillon_preparation:${userId}:${dateCours}:${creneauCle}`

const lireLocal = cle => {
  try { return JSON.parse(localStorage.getItem(cle) || 'null') }
  catch { return null }
}

/**
 * La phrase qui accompagne l'entrée de dépôt dans l'historique.
 *
 * Côté enseignant, le promoteur a arbitré « Déposée après l'échéance » plutôt
 * que « en retard » : le constat est le même, le ton n'est pas celui d'un
 * dispositif disciplinaire. « En retard » reste le terme de pilotage de la
 * direction.
 */
const commentaireDepot = (dateCours, heureCours, moment) => {
  const s = situationDepot(dateCours, heureCours, moment)
  if (!s.valide) return null
  if (s.aTemps) return 'Déposée avant le début du cours.'
  const h = Math.floor(s.retardMinutes / 60), m = s.retardMinutes % 60
  const delai = h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
  return `Déposée après l’échéance, ${delai} après le début du cours.`
}

// ─── Composant ───────────────────────────────────────────────────────────────

// Les remarques de la direction qui visent cette rubrique. Rien si aucune :
// une rubrique sans remarque doit rester une rubrique ordinaire.
function RemarquesDeSection({ remarques }) {
  if (!remarques || !remarques.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
      {remarques.map((r, k) => (
        <div key={k} style={{
          background: r.traitee ? 'var(--card)' : '#fffbeb',
          border: '1px solid ' + (r.traitee ? 'var(--border)' : '#f59e0b'),
          borderLeft: '3px solid ' + (r.traitee ? 'var(--border)' : '#b45309'),
          borderRadius: 8, padding: '8px 10px',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: r.traitee ? 'var(--muted)' : '#92400e' }}>
            {r.traitee ? '✓ Traitée' : '⚠ Correction demandée'}
            {' · '}{r.parNom || 'Direction'}{r.parFonction ? ` (${r.parFonction})` : ''}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--text)', lineHeight: 1.45,
                        marginTop: 3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {r.texte}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FichePreparation({
  user, creneau, dateCours,
  objectifsOfficiels = [],
  lectureSeule = false,
  onFerme, onEnregistre,
}) {
  const [fiche, setFiche]         = useState(vide())
  const [enCours, setEnCours]     = useState(false)
  const [message, setMessage]     = useState(null)
  const [etatBrouillon, setEtatBrouillon] = useState(null)
  const [conflitBrouillon, setConflitBrouillon] = useState(null)
  // existantes : liste des rows déjà en base pour cette notion (une par séquence)
  const [existantes, setExistantes] = useState([])
  // avancement du manuel avant ce cours (null tant qu'il n'est pas connu)
  const [avant, setAvant]         = useState(null)

  // La matière suit-elle un manuel ? Le couple (groupe, matière) suffit à le
  // dire — mais il peut en désigner plusieurs : l'anglais se travaille avec
  // Treasures et Phonics Pathways dans les mêmes heures.
  const manuels = manuelsPour(creneau.groupe, creneau.matiere)

  // Manuel visé par cette fiche. On reprend celui déjà enregistré quand la
  // fiche existe, sinon le premier ; l'enseignant peut en changer.
  const [cleManuel, setCleManuel] = useState(null)
  const manuel = manuels.find(m => m.cle === cleManuel) || manuels[0] || null

  // Le retour de la direction. Il vit dans `preparations.historique_statuts`,
  // seule source : aucune copie n'est faite pour l'affichage.
  const [statut, setStatut] = useState(null)
  const [historique, setHistorique] = useState([])
  const [fichesCahiersOuvertes, setFichesCahiersOuvertes] = useState(false)
  const creneauCle = identiteCreneau(creneau)
  const brouillonCle = cleBrouillon(user.id, dateCours, creneauCle)
  const ficheRef = useRef(fiche)
  const hydrateRef = useRef(false)
  const versionRef = useRef(null)
  const minuterieRef = useRef(null)

  useEffect(() => { ficheRef.current = fiche }, [fiche])

  const sauverLocal = useCallback((contenu = ficheRef.current) => {
    if (lectureSeule) return
    localStorage.setItem(brouillonCle, JSON.stringify({
      contenu, version: versionRef.current, updatedAt: new Date().toISOString(),
    }))
    setEtatBrouillon('Enregistré sur cet appareil · synchronisation en attente')
  }, [brouillonCle, lectureSeule])

  const sauverServeur = useCallback(async (contenu = ficheRef.current, version = versionRef.current) => {
    if (lectureSeule) return false
    const { data, error } = await supabase.rpc('sauver_brouillon_preparation', {
      p_date_cours: dateCours,
      p_creneau_cle: creneauCle,
      p_contenu: contenu,
      p_version_attendue: version,
    })
    if (error) {
      console.error('Autosave préparation refusé', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
        dateCours, creneauCle,
      })
      setEtatBrouillon(`Brouillon local conservé · serveur : ${error.code || 'ERREUR'} — ${error.message}`)
      return false
    }
    if (data?.conflit) {
      setConflitBrouillon({ contenu: data.contenu, version: data.version })
      setEtatBrouillon('Conflit détecté : aucune version n’a été écrasée')
      return false
    }
    versionRef.current = data.version
    localStorage.setItem(brouillonCle, JSON.stringify({
      contenu, version: data.version, updatedAt: data.updated_at,
    }))
    setEtatBrouillon('Brouillon enregistré sur cet appareil et sur le serveur ✓')
    return true
  }, [brouillonCle, creneauCle, dateCours, lectureSeule])

  // ── Chargement ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let annule = false
    hydrateRef.current = false
    ;(async () => {
      const [officiel, distant] = await Promise.all([
        supabase.from('preparations')
        // `status` et `historique_statuts` manquaient à cette liste. La
        // direction écrivait sa remarque dans l'historique, l'écran ne la
        // demandait jamais, et l'enseignante lisait « à corriger » sans savoir
        // quoi corriger. Le texte partait du serveur et personne ne l'appelait.
        .select('id, contenu, heure_depot, sequence, status, historique_statuts')
        .eq('user_id', user.id)
        .eq('date_cours', dateCours)
        .eq('sequence', creneau.sequence)
          .maybeSingle(),
        lectureSeule
          ? Promise.resolve({ data: null, error: null })
          : supabase.rpc('lire_brouillon_preparation', {
              p_date_cours: dateCours, p_creneau_cle: creneauCle,
            }),
      ])

      if (annule) return
      const data = officiel.data
      const local = lectureSeule ? null : lireLocal(brouillonCle)
      const serveur = distant.data
      versionRef.current = serveur?.version ?? local?.version ?? null

      // Une version serveur plus récente gagne. À version égale, le local
      // contient éventuellement les frappes faites depuis la dernière synchro.
      const repris = serveur && Number(serveur.version) > Number(local?.version ?? -1)
        ? serveur.contenu
        : local?.contenu || serveur?.contenu
      const contenu = migrer(repris || data?.contenu)
      setFiche(contenu)
      if (repris) setEtatBrouillon('Brouillon repris automatiquement ✓')
      hydrateRef.current = true

      if (!data) return
      setStatut(data.status || null)
      setHistorique(Array.isArray(data.historique_statuts) ? data.historique_statuts : [])
      if (contenu.programme?.cle) setCleManuel(contenu.programme.cle)

      const nb = contenu.nb_sequences || 1
      if (nb > 1) {
        const numeros = Array.from({ length: nb }, (_, i) => creneau.sequence + i)
        const { data: all } = await supabase
          .from('preparations')
          .select('id, sequence, status, historique_statuts')
          .eq('user_id', user.id)
          .eq('date_cours', dateCours)
          .in('sequence', numeros)
        if (!annule && all) setExistantes(all)
      } else {
        setExistantes([data])
      }
    })()
    return () => { annule = true }
  }, [user.id, dateCours, creneau.sequence, brouillonCle, creneauCle, lectureSeule])

  // Chaque changement est durable immédiatement en local, puis regroupé en
  // une seule écriture serveur après 1,5 s. Aucun flux de soumission ou de
  // notification n'est appelé ici.
  useEffect(() => {
    if (!hydrateRef.current || lectureSeule) return
    sauverLocal(fiche)
    clearTimeout(minuterieRef.current)
    minuterieRef.current = setTimeout(() => sauverServeur(fiche), 1500)
    return () => clearTimeout(minuterieRef.current)
  }, [fiche, lectureSeule, sauverLocal, sauverServeur])

  useEffect(() => {
    if (lectureSeule) return undefined
    const avantSortie = () => sauverLocal()
    const changementVisibilite = () => {
      if (document.visibilityState === 'hidden') sauverLocal()
    }
    const retourReseau = () => sauverServeur()
    const autreOnglet = event => {
      if (event.key !== brouillonCle || !event.newValue) return
      const autre = lireLocal(brouillonCle)
      if (autre && JSON.stringify(autre.contenu) !== JSON.stringify(ficheRef.current)) {
        setConflitBrouillon({ contenu: autre.contenu, version: autre.version })
        setEtatBrouillon('Conflit multi-onglets détecté : aucune version n’a été écrasée')
      }
    }
    window.addEventListener('pagehide', avantSortie)
    document.addEventListener('visibilitychange', changementVisibilite)
    window.addEventListener('online', retourReseau)
    window.addEventListener('storage', autreOnglet)
    return () => {
      window.removeEventListener('pagehide', avantSortie)
      document.removeEventListener('visibilitychange', changementVisibilite)
      window.removeEventListener('online', retourReseau)
      window.removeEventListener('storage', autreOnglet)
    }
  }, [brouillonCle, lectureSeule, sauverLocal, sauverServeur])

  // ── Position dans le manuel ────────────────────────────────────────────────
  //
  // On ne regarde que les cours antérieurs à celui-ci : la leçon proposée par
  // défaut est donc bien « la suivante à cette date », et une fiche déjà
  // enregistrée ne se propose pas à elle-même comme leçon suivante.
  useEffect(() => {
    if (!manuel) { setAvant(null); return }
    let annule = false
    ;(async () => {
      const { data } = await supabase
        .from('preparations')
        .select('date_cours, contenu')
        .eq('groupe', creneau.groupe)
        .eq('matiere', creneau.matiere)
        .lt('date_cours', dateCours)
      // On marque de quel manuel vient cette lecture : elle arrive après
      // coup, et l'enseignant a pu changer de livre entre-temps.
      if (!annule) setAvant({ cle: manuel.cle, ...avancement(manuel, Array.isArray(data) ? data : []) })
    })()
    return () => { annule = true }
  }, [manuel?.cle, creneau.groupe, creneau.matiere, dateCours])

  // Proposition par défaut : la leçon suivante du livre, tant que l'enseignant
  // n'a rien choisi lui-même. Il reste libre de revenir en arrière.
  useEffect(() => {
    if (!manuel || !avant || avant.cle !== manuel.cle) return
    if (fiche.programme) return
    if (avant.prochaine) choisirLecon(avant.prochaine.numero)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuel?.cle, avant, fiche.programme])

  // ── Mutateurs ──────────────────────────────────────────────────────────────

  // Choix de la leçon du manuel. On enregistre le titre et la page en même
  // temps que le numéro : une fiche imprimée doit rester lisible même si le
  // sommaire est corrigé plus tard.
  //
  // On ne pré-remplit délibérément pas l'objectif avec le titre de la leçon :
  // « Comptons » n'est pas un objectif, et un champ pré-rempli se valide sans
  // être pensé. L'enseignant écrit ce que l'élève saura faire.
  function choisirLecon(numero) {
    const l = leconParNumero(manuel, numero)
    setFiche(f => ({
      ...f,
      programme: l
        ? {
            cle: manuel.cle, lecon: l.numero, unite: l.unite || null,
            titre: l.titre, page: l.page, pageFin: l.pageFin || null,
            // Le tome fait partie de la référence : sans lui, la fiche
            // imprimée renvoie à deux pages du même numéro.
            ...(l.tome ? { tome: l.tome } : {}),
            // Une leçon de livre unique couvre plusieurs domaines à la fois —
            // texte, grammaire, conjugaison, orthographe. On les enregistre
            // avec elle : c'est le contenu que la séance doit couvrir, et il
            // doit figurer sur la fiche imprimée.
            ...(l.domaines ? { domaines: l.domaines } : {}),
            // Référence imprimée du livre (« 9.2 » chez Cambridge), pour que la
            // fiche imprimée cite le repère que la classe emploie.
            ...(l.code ? { code: l.code } : {}),
          }
        : null,
    }))
  }

  // Changement de manuel. La leçon déjà retenue appartenait à l'autre livre :
  // on la retire, et l'effet ci-dessus proposera la suite du nouveau dès que
  // son avancement sera lu.
  function changerManuel(cle) {
    setCleManuel(cle)
    setFiche(f => (f.programme && f.programme.cle === cle ? f : { ...f, programme: null }))
  }

  const majEtape = (seqIdx, id, champ, valeur) =>
    setFiche(f => {
      const sequences = (f.sequences || []).map((s, i) =>
        i !== seqIdx ? s : {
          ...s,
          etapes: { ...s.etapes, [id]: { ...s.etapes[id], [champ]: valeur } },
        }
      )
      return { ...f, sequences }
    })

  const changerNbSeq = nb =>
    setFiche(f => {
      const seqs = [...(f.sequences || [])]
      while (seqs.length < nb) seqs.push(videSeq())
      return { ...f, nb_sequences: nb, sequences: seqs.slice(0, nb) }
    })

  // ── Validation ─────────────────────────────────────────────────────────────

  const manquants = RUBRIQUES.filter(
    r => r.obligatoire && !String(fiche[r.id] || '').trim()
  )

  // Une matière à manuel se prépare sur une leçon du manuel : c'est la règle
  // posée par le directeur. Sans manuel, aucune contrainte de ce genre.
  const leconManquante = Boolean(manuel) && !fiche.programme

  // ── Enregistrement ─────────────────────────────────────────────────────────
  //
  // On insère (ou corrige) une ligne par séquence dans `preparations`.
  // Chaque ligne porte le même contenu partagé + _seq_index pour l'identifier.
  // Ainsi le moteur de points compte N préparations sans modification.

  async function enregistrer() {
    // La dernière frappe est sécurisée avant toute validation. Cette sauvegarde
    // reste un brouillon : elle n'écrit ni dans `preparations`, ni dans les
    // notifications. La soumission explicite continue juste après.
    sauverLocal(fiche)
    await sauverServeur(fiche)
    if (leconManquante) {
      setMessage({ type: 'err', texte: `Choisissez la leçon du manuel de ${creneau.matiere} que ce cours traite.` })
      return
    }
    if (manquants.length) {
      setMessage({
        type: 'err',
        texte: 'À renseigner : ' + manquants.map(m => m.label.toLowerCase()).join(', ') + '.',
      })
      return
    }
    setEnCours(true)
    setMessage(null)

    const nb       = fiche.nb_sequences || 1
    const maintenant = new Date().toISOString()

    // Le délai de dépôt est un paramètre d'établissement, lu en base. On le
    // charge avant la boucle : sans cet appel, `statutAuDepot` retomberait sur
    // la valeur par défaut et un réglage de l'administration resterait sans
    // effet. Un échec de lecture ne bloque pas le dépôt — la bibliothèque
    // retient alors la valeur par défaut et le prévient en console.
    await chargerDelai()

    for (let i = 0; i < nb; i++) {
      const seqNum = creneau.sequence + i
      const h = horaireDuCreneau(creneau, seqNum) ?? horaireDuCreneau(creneau) ?? '08:00'

      // Une échéance inconnue ne doit jamais devenir un dépôt à l'heure : la
      // source unique renvoie `null` plutôt que d'inventer un statut, et l'on
      // refuse d'enregistrer. Le cas ne devrait pas se produire — l'emploi du
      // temps fournit toujours date et créneau — mais une préparation dont la
      // ponctualité serait fabriquée alimenterait le suivi du personnel.
      const statut = statutAuDepot(dateCours, h, maintenant)
      if (!statut) {
        setEnCours(false)
        setMessage({
          type: 'err',
          texte: "Impossible d'enregistrer cette préparation : l'heure ou la date du cours est manquante.",
        })
        return
      }

      // Ce que l'enseignant peut faire évoluer à chaque enregistrement.
      const ligne = {
        user_id:    user.id,
        classe_id:  creneau.classe_id || null,
        date_cours: dateCours,
        heure_cours: h + ':00',
        matiere:    creneau.matiere,
        groupe:     creneau.groupe,
        sequence:   seqNum,
        contenu:    { ...fiche, _seq_index: i },
      }

      const ex = existantes.find(e => e.sequence === seqNum)

      // ── Resoumission après une demande de correction ────────────────────
      //
      // Sans cela, l'enseignante corrigeait et rien ne bougeait : la
      // préparation restait « à corriger » indéfiniment et la direction ne
      // savait pas que le travail avait été repris. La transition
      // `a_corriger → deposee | en_retard` existait déjà dans la nomenclature,
      // elle n'était simplement jouée par personne.
      //
      // Le statut retrouvé est celui du dépôt d'origine, pas un statut neuf :
      // une préparation déposée en retard le reste après correction — le
      // retard est un fait, pas une punition qu'on efface en corrigeant.
      // `evenementDepot` rend l'entrée du dépôt d'origine : c'est elle qui
      // porte le statut à retrouver.
      const statutDOrigine = evenementDepot(ex)?.statut || 'deposee'
      // `ex.status` et non l'état du composant : `statut` est masqué ici par
      // la constante locale du dépôt, et surtout la ligne en base fait
      // autorité sur ce que l'écran croit savoir.
      const majResoumission = (ex?.status === 'a_corriger')
        ? {
            status: statutDOrigine,
            historique_statuts: ajouterHistorique(ex.historique_statuts, {
              statut: statutDOrigine,
              action: ACTIONS.modification,
              commentaire: 'Préparation corrigée et resoumise à la direction.',
              utilisateur: user,
              contexte: { role: 'professeur', matiere: creneau.matiere },
            }),
          }
        : {}

      // Le dépôt est un événement, pas un état : il n'a lieu qu'une fois, à la
      // création. Une modification ultérieure ne le rejoue pas — elle ne
      // touche donc ni au statut, ni à l'instant du dépôt, ni à l'historique.
      //
      // Réécrire ces trois colonnes à chaque enregistrement produirait deux
      // dégâts : une préparation remise à l'heure puis corrigée après le cours
      // basculerait en retard, et `heure_depot` cesserait de correspondre au
      // `le` de l'entrée de dépôt, seule trace de la ponctualité réelle.
      const req = ex
        ? supabase.from('preparations').update({ ...ligne, ...majResoumission }).eq('id', ex.id)
        : supabase.from('preparations').insert({
            ...ligne,
            heure_depot: maintenant,
            // Statut déduit de la règle métier portée par la source unique :
            // déposée avant le début du cours — ou exactement à l'heure —
            // elle est `deposee` ; après, `en_retard`. L'heure du cours est
            // lue dans le fuseau de l'école, pas dans celui de l'appareil.
            status: statut,
            historique_statuts: ajouterHistorique([], {
              // Elle dépose au titre de la matière du créneau.
              contexte: { role: 'professeur', matiere: creneau.matiere },
              statut,
              action: ACTIONS.depot,
              commentaire: commentaireDepot(dateCours, h, maintenant),
              utilisateur: user,
              // Le même instant que `heure_depot`, à la milliseconde près.
              le: maintenant,
            }),
          })

      const { error } = await req
      if (error) {
        setEnCours(false)
        setMessage({ type: 'err', texte: `Erreur séquence ${i + 1} : ${error.message}` })
        return
      }
    }

    // Séquences qui ne font plus partie de la notion : l'enseignant a raccourci
    // sa durée après un premier enregistrement. Les laisser en base, ce serait
    // des préparations déposées qui ne préparent plus rien — et qui compteraient
    // pourtant dans les points.
    const enTrop = existantes.filter(
      e => e.sequence < creneau.sequence || e.sequence >= creneau.sequence + nb
    )
    if (enTrop.length) {
      const { data: nettoyage, error: erreurNettoyage } = await supabase.rpc(
        'nettoyer_sequences_preparation',
        {
          p_ids: enTrop.map(e => e.id),
          p_date_cours: dateCours,
          p_sequence_debut: creneau.sequence,
          p_nb_sequences: nb,
        }
      )
      if (erreurNettoyage || nettoyage?.restantes !== 0) {
        setEnCours(false)
        const detail = erreurNettoyage
          ? [erreurNettoyage.code, erreurNettoyage.message, erreurNettoyage.details].filter(Boolean).join(' — ')
          : `${nettoyage?.restantes ?? 'inconnu'} séquence(s) restante(s)`
        setMessage({ type: 'err', texte: `Préparation enregistrée, mais nettoyage incomplet : ${detail}` })
        return
      }
    }

    // On relit ce qui est réellement en base avant de rendre la main. Sans
    // cela, `existantes` reste sur l'état d'ouverture de la fiche : un second
    // enregistrement tenterait de réinsérer une ligne déjà créée et se heurtait
    // à la contrainte d'unicité du créneau. C'est aussi la seule façon de
    // vérifier que la suppression ci-dessus a bien eu lieu — un DELETE refusé
    // par RLS répond 204 sans rien supprimer.
    // On relit la plage complète qu'une notion peut occuper (6 séquences au
    // plus), pas seulement les nb séquences attendues : c'est ce qui permet de
    // voir une ligne qui aurait dû disparaître et qui est toujours là.
    const { data: apres } = await supabase
      .from('preparations')
      .select('id, sequence, status, historique_statuts')
      .eq('user_id', user.id)
      .eq('date_cours', dateCours)
      .gte('sequence', creneau.sequence)
      .lt('sequence', creneau.sequence + 6)
      .order('sequence')

    setExistantes(apres || [])

    const survivantes = (apres || []).filter(e => e.sequence >= creneau.sequence + nb)

    if (survivantes.length) {
      setEnCours(false)
      setMessage({ type: 'err', texte: `Enregistré, mais ${survivantes.length} séquence(s) de l'ancienne durée n'ont pas pu être supprimées. Signalez-le à la direction.` })
      return
    }

    // Les lignes officielles ont été relues et confirmées. C'est seulement à
    // cet instant que le brouillon peut disparaître. Un échec de suppression
    // conserve la copie locale afin de ne jamais perdre la saisie.
    const { error: erreurSuppressionBrouillon } = await supabase.rpc(
      'supprimer_brouillon_preparation',
      { p_date_cours: dateCours, p_creneau_cle: creneauCle }
    )
    if (!erreurSuppressionBrouillon) {
      clearTimeout(minuterieRef.current)
      localStorage.removeItem(brouillonCle)
      versionRef.current = null
      setEtatBrouillon(null)
      setConflitBrouillon(null)
    }

    // La soumission et l'enregistrement forment une seule action. Une fois les
    // lignes confirmées en base, la direction est prévenue et la notification
    // pointe vers la première séquence de cette préparation.
    //
    // Le libellé n'est plus décidé ici. « Mise à jour » ne distinguait pas une
    // simple retouche d'un retour après correction : la direction lisait le
    // même titre dans les deux cas. Le serveur tranche à partir de
    // l'historique — c'est lui qui sait combien de corrections ont été
    // demandées, et c'est la seule version que le client ne peut pas fausser.
    const premiere = (apres || []).find(e => e.sequence >= creneau.sequence && e.sequence < creneau.sequence + nb)
    const envoi = await notifierPreparation(premiere?.id)
    const transmise = !!envoi

    setEnCours(false)
    // Le message disait « la notification a échoué » sans dire pourquoi, et la
    // raison n'existait que dans une console que personne n'ouvre. Elle est
    // désormais affichée : c'est elle qui permet de corriger.
    const pourquoi = messageEchecLisible()
    const quoi = envoi && envoi.evenement === 'resoumission'
      ? 'Préparation corrigée et resoumise à la direction ✓'
      : (nb > 1 ? `${nb} séquences soumises à la direction ✓` : 'Préparation soumise à la direction ✓')
    setMessage(transmise
      ? { type: 'ok', texte: quoi }
      : { type: 'err', texte: 'Votre préparation est enregistrée. En revanche la direction n\'a pas été prévenue : '
          + (pourquoi || 'cause inconnue')
          + '. Signalez-le à la direction en citant ce message.' })
    onEnregistre && onEnregistre()
  }

  // ── Impression ─────────────────────────────────────────────────────────────

  function imprimer() {
    const w = window.open('', '_blank')
    if (!w) return
    const esc = s => String(s).replace(/</g, '&lt;').replace(/\n/g, '<br>')
    const bloc = (titre, texte) => texte
      ? `<div class="b"><div class="t">${titre}</div><div class="c">${esc(texte)}</div></div>` : ''
    const nb = fiche.nb_sequences || 1
    const seqs = fiche.sequences || [videSeq()]

    const blocsSeq = seqs.map((seq, idx) => {
      const total = ETAPES.reduce((s, e) => s + Number(seq.etapes?.[e.id]?.minutes || 0), 0)
      const seqNum = creneau.sequence + idx
      const h = horaireDuCreneau(creneau, seqNum) ?? ''
      return `
        <div class="seq-titre">
          ${nb > 1 ? `Séquence ${idx + 1}/${nb} · S${seqNum}${h ? ' · ' + h.replace(':', 'h') : ''}` : 'Déroulement'}
          <span class="total ${total === DUREE_SEQUENCE ? 'ok' : 'warn'}">${total} min sur ${DUREE_SEQUENCE}</span>
        </div>
        <table><thead><tr><th style="width:32%">Étape</th><th style="width:12%">Durée</th><th>Ce que je fais, ce que font les élèves</th></tr></thead><tbody>
        ${ETAPES.map(e =>
          `<tr><td><b>${e.label}</b></td><td>${seq.etapes?.[e.id]?.minutes ?? 0} min</td>
           <td>${esc(seq.etapes?.[e.id]?.texte || '')}</td></tr>`
        ).join('')}
        </tbody></table>`
    }).join('')

    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
      <title>Préparation ${creneau.matiere} — ${creneau.groupe}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#0d2a3b;padding:26px;max-width:760px;margin:auto}
        h1{font-size:17pt;margin:0 0 2px}
        .sub{color:#64748b;font-size:10pt;margin-bottom:16px}
        .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;border:1.5px solid #0d2a3b;border-radius:8px;padding:10px 14px;font-size:11pt;margin-bottom:18px}
        .b{margin-bottom:14px}
        .t{font-weight:800;font-size:10pt;color:#0d2a3b;border-left:4px solid #1AAFE0;padding-left:8px;margin-bottom:4px;text-transform:uppercase}
        .c{font-size:11pt;line-height:1.5;white-space:pre-wrap}
        .seq-titre{font-weight:800;font-size:10pt;color:#0d2a3b;background:#f0f9ff;border-left:4px solid #1AAFE0;padding:6px 10px;margin:18px 0 6px;display:flex;justify-content:space-between;text-transform:uppercase}
        .total{font-size:9pt;font-weight:400}.ok{color:#16a34a}.warn{color:#d97706}
        table{width:100%;border-collapse:collapse;font-size:11pt;margin-top:4px}
        th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#0d2a3b;color:#fff;font-size:9pt;text-transform:uppercase}
        .sig{margin-top:26px;display:flex;justify-content:space-between;font-size:10pt;color:#475569}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>Fiche de préparation</h1>
      <div class="sub">${NOM_ECOLE} · Bamako</div>
      <div class="meta">
        <div><b>Matière :</b> ${creneau.matiere}</div><div><b>Classe :</b> ${creneau.groupe}</div>
        <div><b>Date :</b> ${dateLisible(dateCours)}</div>
        <div><b>Durée :</b> ${nb} séquence${nb > 1 ? 's' : ''} × ${DUREE_SEQUENCE} min = ${nb * DUREE_SEQUENCE} min</div>
        <div><b>Enseignant :</b> ${esc(signature(user, { role: 'professeur', matiere: creneau.matiere }).nom)}</div>
        <div><b>Fonction :</b> ${esc(signature(user, { role: 'professeur', matiere: creneau.matiere }).fonction)}</div>
        ${fiche.programme ? `<div style="grid-column:1/-1"><b>Manuel :</b> ${esc(manuel?.titre || '')} — ${esc(fiche.programme.titre)} · ${situationDe(manuel, fiche.programme)}</div>` : ''}
        ${fiche.programme?.domaines?.length ? `<div style="grid-column:1/-1"><b>Cette leçon doit couvrir :</b><br>${fiche.programme.domaines.map(d => `${esc(d.nom)} : ${esc(d.contenu)}`).join('<br>')}</div>` : ''}
      </div>
      ${bloc('Objectif de la notion', fiche.objectif)}
      ${bloc('Prérequis', fiche.prerequis)}
      ${bloc('Matériel et supports', fiche.materiel)}
      ${blocsSeq}
      ${bloc('Différenciation', fiche.differenciation)}
      ${bloc("Comment je vérifie que c'est acquis", fiche.evaluation)}
      ${bloc('Trace écrite et devoir', fiche.trace)}
      <div class="sig"><div>${esc(signature(user, { role: 'professeur', matiere: creneau.matiere }).fonction)}<br><small>${esc(signature(user, { role: 'professeur', matiere: creneau.matiere }).nom)}</small></div><div>Visa de la direction</div></div>
      </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  // ── Téléchargement TXT ─────────────────────────────────────────────────────

  function telecharger() {
    const nb = fiche.nb_sequences || 1
    const seqs = fiche.sequences || [videSeq()]
    const l = []
    l.push(`FICHE DE PRÉPARATION — École IDEAL`, '')
    l.push(`Matière    : ${creneau.matiere}`, `Classe     : ${creneau.groupe}`)
    l.push(`Date       : ${dateLisible(dateCours)}`)
    l.push(`Durée      : ${nb} séquence${nb > 1 ? 's' : ''} × ${DUREE_SEQUENCE} min = ${nb * DUREE_SEQUENCE} min`)
    l.push(`Enseignant : ${[user.prenom, user.nom].filter(Boolean).join(' ')}`)
    if (fiche.programme) {
      l.push(`Manuel     : ${manuel?.titre || ''}`)
      l.push(`             ${fiche.programme.titre} · ${situationDe(manuel, fiche.programme)}`)
      ;(fiche.programme.domaines || []).forEach(d => l.push(`             ${d.nom} : ${d.contenu}`))
    }
    l.push('')
    RUBRIQUES.slice(0, 3).forEach(r => { if (fiche[r.id]) l.push(r.label.toUpperCase(), fiche[r.id], '') })
    seqs.forEach((seq, idx) => {
      const seqNum = creneau.sequence + idx
      l.push(nb > 1 ? `DÉROULEMENT — SÉQUENCE ${idx + 1}/${nb} (S${seqNum})` : 'DÉROULEMENT')
      ETAPES.forEach(e => l.push(
        `  ${e.label} (${seq.etapes?.[e.id]?.minutes ?? 0} min) : ${seq.etapes?.[e.id]?.texte || ''}`
      ))
      l.push('')
    })
    RUBRIQUES.slice(3).forEach(r => { if (fiche[r.id]) l.push(r.label.toUpperCase(), fiche[r.id], '') })
    const net = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([l.join('\n')], { type: 'text/plain;charset=utf-8' }))
    a.download = `preparation-${net(creneau.matiere)}-${net(creneau.groupe)}-${dateCours}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const nb   = fiche.nb_sequences || 1
  const seqs = fiche.sequences || [videSeq()]

  const champ = {
    width: '100%', marginTop: 4, padding: '8px 10px',
    borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 13, fontFamily: 'inherit',
  }

  const estDejaPreparee = existantes.length > 0

  // Une entrée de la liste déroulante. Un livre numéroté annonce sa leçon,
  // un livre qui ne l'est pas s'en tient à son titre et à ses pages.
  const optionLecon = l => (
    <option key={l.numero} value={l.numero}>
      {avant?.faits.includes(l.numero) ? '✓ ' : ''}
      {l.code ? `${l.code} ` : manuel.numerote === false ? '' : `${l.numero}. `}
      {l.titre} — {pagesDe(l, manuel)}
    </option>
  )

  const parSection = remarquesParSection(historique)
  const generales = remarquesGenerales(historique)
  const nbOuvertes = nbCorrectionsOuvertes(historique)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(6,16,24,.94)',
      zIndex: 9000, overflowY: 'auto', padding: '18px 12px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto', background: 'var(--bg)', borderRadius: 16, padding: '18px 16px' }}>

        {/* ── En-tête ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{creneau.matiere} — {creneau.groupe}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {dateLisible(dateCours)} · à partir de S{creneau.sequence}
              {horaireDuCreneau(creneau) ? ` · ${heureAffCreneau(creneau)}` : ''}
            </div>
          </div>
          <button className="btn-sm" onClick={onFerme}>Fermer</button>
        </div>

        {/* ── Retour de la direction ──────────────────────────────────────
            En tête, avant le formulaire : on lit ce qu'il faut corriger
            AVANT de corriger. Une remarque reléguée en bas de page serait lue
            après coup, ou pas du tout. */}
        {statut === 'a_corriger' && (
          <div style={{
            marginTop: 14, background: '#fffbeb', border: '1px solid #f59e0b',
            borderLeft: '4px solid #b45309', borderRadius: 12, padding: '12px 14px',
          }} role="status">
            <div style={{ fontSize: 13, fontWeight: 900, color: '#92400e' }}>
              ↩️ La direction demande une correction
            </div>
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 3 }}>
              {nbOuvertes > 0
                ? `${nbOuvertes} correction${nbOuvertes > 1 ? 's' : ''} demandée${nbOuvertes > 1 ? 's' : ''} — chacune est signalée sous la rubrique concernée.`
                : 'Corrigez les points ci-dessous, puis soumettez de nouveau.'}
            </div>
          </div>
        )}
        {statut === 'validee' && (
          <div style={{
            marginTop: 14, background: '#f0fdf4', border: '1px solid #16a34a',
            borderLeft: '4px solid #15803d', borderRadius: 12, padding: '12px 14px',
          }} role="status">
            <div style={{ fontSize: 13, fontWeight: 900, color: '#166534' }}>
              ✅ Préparation validée par la direction
            </div>
            <button type="button" className="btn-sm" onClick={() => setFichesCahiersOuvertes(true)} style={{ marginTop: 9, background: '#15803d', color: '#fff' }}>
              🗒️ Générer les fiches des élèves
            </button>
          </div>
        )}

        {generales.length > 0 && (
          <div style={{
            marginTop: 12, background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)',
                          textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>
              Remarque générale de la direction
            </div>
            {/* Distincte des remarques de rubrique : elle porte sur l'ensemble
                de la préparation, pas sur un champ. Les retours antérieurs à
                ce système s'affichent ici — leur rubrique n'est jamais
                devinée depuis leur texte. */}
            {generales.map((r, k) => (
              <div key={k} style={{ marginTop: k ? 8 : 0 }}>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 700 }}>
                  {r.parNom || 'Direction'}{r.parFonction ? ` (${r.parFonction})` : ''}
                </div>
                <div style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.45,
                              whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.texte}</div>
              </div>
            ))}
          </div>
        )}

        {historique.length > 0 && (
          <div style={{
            marginTop: 12, background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 14px',
          }}>
            <FrisePreparation historique={historique} titre="Suivi de cette préparation" contenu={fiche} />
          </div>
        )}

        {/* ── Leçon du manuel ── */}
        {manuel && (
          <div style={{
            marginTop: 14, background: 'var(--card)',
            border: '1px solid ' + (fiche.programme ? 'var(--border)' : 'var(--red)'),
            borderRadius: 12, padding: '10px 14px',
          }}>
            {/* Le titre du manuel n'est pas mis en majuscules : « Math CP — La
                méthode de Singapour » y devient illisible, à cause du tiret. */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>
              LEÇON DU MANUEL
              <span style={{ color: 'var(--red)' }}> *</span>
            </div>
            {manuels.length > 1 && !lectureSeule ? (
              // Deux livres se partagent les mêmes heures — Treasures pour la
              // lecture suivie, Phonics Pathways pour le décodage. On demande
              // lequel avant la leçon : chacun a son propre avancement.
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {manuels.map(m => (
                  <button
                    key={m.cle}
                    type="button"
                    onClick={() => changerManuel(m.cle)}
                    style={{
                      padding: '6px 10px', borderRadius: 999, fontSize: 12,
                      fontWeight: m.cle === manuel.cle ? 800 : 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid ' + (m.cle === manuel.cle ? 'var(--accent)' : 'var(--border)'),
                      background: m.cle === manuel.cle ? 'var(--accent)' : 'transparent',
                      color: m.cle === manuel.cle ? '#04121b' : 'var(--muted)',
                    }}>
                    {m.titre}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{manuel.titre}</div>
            )}

            {fiche.programme && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{fiche.programme.titre}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {situationDe(manuel, fiche.programme)}
                </div>

                {/* Livre unique : la leçon couvre plusieurs domaines dans la
                    même séance. On les met sous les yeux de l'enseignant au
                    moment où il prépare, sinon il en oublie. */}
                {fiche.programme.domaines?.length > 0 && (
                  <div style={{
                    marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8,
                    display: 'grid', gap: 4,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>
                      CETTE LEÇON DOIT COUVRIR
                    </div>
                    {fiche.programme.domaines.map((d, i) => (
                      <div key={i} style={{ fontSize: 12, lineHeight: 1.45 }}>
                        <span style={{ color: 'var(--muted)' }}>{d.nom} : </span>
                        <b>{d.contenu}</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!lectureSeule && (
              <>
                <select
                  value={fiche.programme?.lecon ?? ''}
                  onChange={e => choisirLecon(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
                    border: '1px solid var(--border)', background: 'var(--bg)',
                  }}>
                  <option value="">— choisir la leçon —</option>
                  {aDesUnites(manuel)
                    ? manuel.unites.map(u => (
                        <optgroup key={u.numero} label={u.numero ? `${libelleUnite(manuel)} ${u.numero} — ${u.titre}` : u.titre}>
                          {u.lecons.map(optionLecon)}
                        </optgroup>
                      ))
                    : leconsDe(manuel).map(optionLecon)}
                </select>

                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                  {avant === null
                    ? 'Lecture de l’avancement du manuel…'
                    : avant.courante
                      ? <>Déjà traité jusqu’à <b>{avant.courante.titre}</b> ({pagesDe(avant.courante, manuel)}). Les entrées cochées ✓ ont déjà été préparées ; vous pouvez y revenir.</>
                      : <>Premier cours du manuel : le programme commence à <b>{leconsDe(manuel)[0].titre}</b> ({pagesDe(leconsDe(manuel)[0], manuel)}).</>}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Sélecteur de durée ── */}
        {!lectureSeule && (
          <div style={{
            marginTop: 14, background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
              DURÉE DE LA NOTION
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DUREES.map(({ nb: n, label }) => (
                <button key={n} onClick={() => changerNbSeq(n)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', transition: 'all .15s',
                    border: `2px solid ${nb === n ? '#1AAFE0' : 'var(--border)'}`,
                    background: nb === n ? 'rgba(26,175,224,.12)' : 'transparent',
                    color: nb === n ? '#1AAFE0' : 'var(--muted)',
                  }}>
                  {label}
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 1 }}>
                    {n} séq.
                  </div>
                </button>
              ))}
            </div>
            {nb > 1 && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                ✅ Cette notion occupe {nb} séquences consécutives de {creneau.matiere} —
                chacune compte séparément dans vos points.
              </div>
            )}
          </div>
        )}

        {/* ── Bannière état ── */}
        {lectureSeule ? (
          <div style={{ background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.35)', borderRadius: 10, padding: '8px 12px', fontSize: 12, marginTop: 12 }}>
            Semaine archivée : cette fiche ne se modifie plus. Vous pouvez la relire,
            l'imprimer ou la télécharger.
          </div>
        ) : estDejaPreparee && (
          <div style={{ background: 'rgba(46,158,79,.10)', border: '1px solid rgba(46,158,79,.35)', borderRadius: 10, padding: '8px 12px', fontSize: 12, marginTop: 12 }}>
            Notion déjà préparée ({nb} séquence{nb > 1 ? 's' : ''}).
            Vos modifications corrigeront la fiche existante.
          </div>
        )}

        {objectifsOfficiels.length > 0 && !lectureSeule && (
          <label style={{ display: 'block', marginTop: 12, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            OBJECTIF PÉDAGOGIQUE OFFICIEL <span style={{ color: 'var(--red)' }}>*</span>
            <select
              value={objectifsOfficiels.some(o => o.description === fiche.objectif) ? fiche.objectif : ''}
              onChange={e => setFiche({ ...fiche, objectif: e.target.value })}
              style={{ ...champ, background: 'var(--bg)' }}>
              <option value="">— sélectionner l’objectif travaillé —</option>
              {objectifsOfficiels.map(o => <option key={o.id} value={o.description}>{o.description}</option>)}
            </select>
            <div style={{ marginTop: 5, fontSize: 10, lineHeight: 1.4, fontWeight: 500 }}>
              Objectifs du trimestre pour {creneau.groupe} · {creneau.matiere}
            </div>
          </label>
        )}

        {/* ── Rubriques communes — partie 1 (objectif, prérequis, matériel) ── */}
        {RUBRIQUES.slice(0, 3).map(r => (
          <label key={r.id} style={{ display: 'block', marginTop: 12, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            {r.label}
            {r.obligatoire && <span style={{ color: 'var(--red)' }}> *</span>}
            <textarea
              rows={r.lignes}
              value={fiche[r.id]}
              placeholder={r.aide}
              onChange={e => setFiche({ ...fiche, [r.id]: e.target.value })}
              readOnly={lectureSeule}
              style={champ}
            />
            {/* La remarque de la direction, sous le champ qu'elle vise. */}
            <RemarquesDeSection remarques={parSection.get(r.id) || []} />
          </label>
        ))}

        {/* ── Blocs de déroulement — un par séquence ── */}
        {seqs.map((seq, idx) => {
          const totalSeq = ETAPES.reduce((s, e) => s + Number(seq.etapes?.[e.id]?.minutes || 0), 0)
          const seqNum   = creneau.sequence + idx
          const h        = heureAffCreneau(creneau, seqNum)

          return (
            <div key={idx} style={{
              marginTop: 16,
              border: nb > 1 ? '1px solid var(--border)' : 'none',
              borderRadius: nb > 1 ? 12 : 0,
              padding: nb > 1 ? '10px 12px' : 0,
              background: nb > 1 ? 'var(--card)' : 'transparent',
            }}>
              {/* Titre du bloc */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>
                  {nb > 1
                    ? <>
                        <span style={{
                          background: '#1AAFE0', color: '#fff',
                          borderRadius: 5, padding: '1px 7px', marginRight: 8, fontSize: 10,
                        }}>
                          S{idx + 1}/{nb}
                        </span>
                        DÉROULEMENT · S{seqNum}{h ? ` · ${h}` : ''}
                      </>
                    : 'DÉROULEMENT'
                  }
                </span>
                <span style={{ color: totalSeq === DUREE_SEQUENCE ? 'var(--green)' : 'var(--amber)', fontVariantNumeric: 'tabular-nums' }}>
                  {totalSeq} / {DUREE_SEQUENCE} min
                </span>
              </div>

              {/* Étapes */}
              {ETAPES.map(e => (
                <div key={e.id} style={{
                  background: nb > 1 ? 'var(--bg)' : 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, padding: '8px 10px', marginTop: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{e.label}</div>
                    <input
                      type="number" min="0" max="30"
                      value={seq.etapes?.[e.id]?.minutes ?? 0}
                      onChange={ev => majEtape(idx, e.id, 'minutes',
                        Math.max(0, Math.min(30, Number(ev.target.value) || 0))
                      )}
                      readOnly={lectureSeule}
                      style={{
                        width: 58, padding: '4px 6px', borderRadius: 6,
                        border: '1px solid var(--border)', textAlign: 'center', fontWeight: 700,
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>min</span>
                  </div>
                  <textarea
                    rows={2}
                    value={seq.etapes?.[e.id]?.texte || ''}
                    placeholder={e.aide}
                    onChange={ev => majEtape(idx, e.id, 'texte', ev.target.value)}
                    readOnly={lectureSeule}
                    style={{ ...champ, marginTop: 6 }}
                  />
                  {/* La clé porte la séquence : `seqNum` est le numéro réel du
                      créneau, celui-là même qu'emploie la direction. */}
                  <RemarquesDeSection remarques={parSection.get(cleEtape(idx + 1, e.id)) || []} />
                </div>
              ))}
            </div>
          )
        })}

        {/* ── Rubriques communes — partie 2 (différenciation, évaluation, trace) ── */}
        {RUBRIQUES.slice(3).map(r => (
          <label key={r.id} style={{ display: 'block', marginTop: 12, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            {r.label}
            {r.obligatoire && <span style={{ color: 'var(--red)' }}> *</span>}
            <textarea
              rows={r.lignes}
              value={fiche[r.id]}
              placeholder={r.aide}
              onChange={e => setFiche({ ...fiche, [r.id]: e.target.value })}
              readOnly={lectureSeule}
              style={champ}
            />
            {/* La remarque de la direction, sous le champ qu'elle vise. */}
            <RemarquesDeSection remarques={parSection.get(r.id) || []} />
          </label>
        ))}

        {/* ── Message ── */}
        {!lectureSeule && etatBrouillon && (
          <div role="status" style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 10, fontSize: 12,
            background: conflitBrouillon ? '#fffbeb' : 'rgba(26,175,224,.10)',
            color: conflitBrouillon ? '#92400e' : 'var(--muted)',
          }}>
            {etatBrouillon}
            {conflitBrouillon && (
              <div style={{ display: 'flex', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                <button type="button" className="btn-sm" onClick={() => {
                  versionRef.current = conflitBrouillon.version
                  setFiche(migrer(conflitBrouillon.contenu))
                  setConflitBrouillon(null)
                  setEtatBrouillon('Version de l’autre onglet reprise')
                }}>Reprendre l’autre version</button>
                <button type="button" className="btn-sm" onClick={() => {
                  const version = conflitBrouillon.version
                  setConflitBrouillon(null)
                  versionRef.current = version
                  sauverLocal(ficheRef.current)
                  sauverServeur(ficheRef.current, version)
                }}>Conserver ma version</button>
              </div>
            )}
          </div>
        )}

        {message && (
          <div style={{
            marginTop: 12, padding: '9px 12px', borderRadius: 10,
            fontSize: 13, fontWeight: 600,
            background: message.type === 'ok' ? 'rgba(46,158,79,.10)' : 'rgba(220,53,69,.10)',
            color: message.type === 'ok' ? 'var(--green)' : 'var(--red)',
          }}>
            {message.texte}
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {!lectureSeule && (
            <button
              className="btn btn-primary"
              onClick={enregistrer}
              disabled={enCours}
              style={{ flex: 2, minWidth: 180, padding: 12, borderRadius: 12, fontWeight: 800 }}
            >
              {enCours
                ? 'Soumission…'
                : estDejaPreparee
                  ? 'Soumettre les modifications à la direction'
                  : nb > 1
                    ? `Soumettre les ${nb} séquences à la direction`
                    : 'Soumettre la préparation à la direction'
              }
            </button>
          )}
          <button className="btn-sm" onClick={imprimer} style={{ flex: 1, minWidth: 90 }}>🖨️ Imprimer</button>
          <button className="btn-sm" onClick={telecharger} style={{ flex: 1, minWidth: 110 }}>⬇️ Télécharger</button>
        </div>

      </div>
      {fichesCahiersOuvertes && <FichesCahiers
        preparation={{ status: statut, matiere: creneau.matiere, date_cours: dateCours, contenu: fiche }}
        creneau={creneau}
        user={user}
        onFerme={() => setFichesCahiersOuvertes(false)}
      />}
    </div>
  )
}
