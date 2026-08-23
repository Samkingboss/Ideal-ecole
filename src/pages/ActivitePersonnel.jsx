import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CONFIG_DEFAUT, calculerPoints, preparationATemps } from '../lib/points'
import { agreger, messageLisible } from '../lib/chargement'

// Fiche d'activité du personnel — espace du directeur.
//
// Tout ce que la plateforme sait d'un employé, rassemblé sur un écran :
// pointage, absences, incidents qu'il a signalés, travail pédagogique déposé,
// points de la prime, sanctions.
//
// Deux principes gouvernent l'affichage, et ils comptent parce qu'il s'agit de
// juger des personnes :
//
//   1. On ne montre que ce qui est mesuré. Quand une source est vide, l'écran
//      dit « aucune donnée » et non « zéro ». Un enseignant qui n'a jamais été
//      pointé n'est pas un enseignant absent — c'est un enseignant qu'on n'a
//      pas pointé, et la nuance décide d'une prime.
//
//   2. Aucun jugement n'est calculé ici. L'écran compte des faits datés ; les
//      points viennent du moteur commun `lib/points.js`, celui-là même qui
//      alimente la prime que l'enseignant voit de son côté. Deux calculs
//      séparés finiraient par diverger, et personne ne saurait lequel croire.

const TYPES_SANCTION = {
  avertissement: 'Avertissement',
  blame: 'Blâme',
  mise_a_pied: 'Mise à pied',
  autre: 'Autre',
}

const ROLES = {
  directeur: 'Direction',
  responsable_administratif: 'Responsable administratif',
  professeur: 'Enseignant',
  conseiller_vie_scolaire: 'Conseiller de vie scolaire',
  surveillant: 'Surveillant',
  cuisiniere: 'Cuisine',
}

const tableAbsente = e =>
  Boolean(e) && (e.code === '42P01' || e.code === 'PGRST205' || /Could not find the table/i.test(e.message || ''))

const jour = d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

// Libellés des blocs de données, pour que le bandeau d'échec nomme en français
// ce qui manque plutôt qu'un nom de table.
const LIBELLE_BLOC = {
  equipe: 'équipe',
  config: 'barème des points',
  saisie_manuelle: 'saisies manuelles',
  personnel: 'fiches de rémunération',
  pointages: 'pointages',
  preparations: 'préparations',
  fins_de_cours: 'fiches de fin de cours',
  absences: 'absences',
  incidents: 'incidents de vie scolaire',
  affectations: 'affectations de matières',
  emploi_du_temps: 'emploi du temps',
  sanctions: 'registre des sanctions',
}

// Les points de la prime se calculent à partir de ces sources. Si l'une d'elles
// est en panne, le pourcentage obtenu serait un chiffre faux sur lequel se
// décide une rémunération : on ne l'affiche pas, on affiche « — ».
const SOURCES_POINTS = [
  'config', 'saisie_manuelle', 'pointages', 'preparations',
  'fins_de_cours', 'absences', 'incidents', 'affectations', 'emploi_du_temps',
]

export default function ActivitePersonnel({ user }) {
  const [equipe, setEquipe] = useState([])
  const [donnees, setDonnees] = useState(null)
  const [config, setConfig] = useState(CONFIG_DEFAUT)
  const [sanctions, setSanctions] = useState([])
  const [sanctionsInstallees, setSanctionsInstallees] = useState(true)
  // Fiche RH par employé — `rh/personnel`, indexée par identifiant. C'est
  // aussi ce que lit l'écran de la prime : une seule source pour le salaire.
  const [personnel, setPersonnel] = useState({})
  const [ouvert, setOuvert] = useState(null)      // id de l'employé déplié
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  // Douze requêtes en parallèle : l'échec de l'une ne doit ni faire tomber la
  // page, ni se rendre en zéro. On retient lesquelles ont échoué, pour que
  // chaque compteur concerné affiche « — » et que le bandeau le dise.
  const [enEchec, setEnEchec] = useState([])
  const [messagesEchec, setMessagesEchec] = useState([])
  const [sanctionsEnEchec, setSanctionsEnEchec] = useState(false)

  useEffect(() => { charger() }, [])

  async function charger() {
    setChargement(true); setErreur(null)
    const [usr, cfg, man, pers, perf, prep, comp, abs, disc, aff, edt, sanc] = await Promise.all([
      supabase.from('users').select('id, prenom, nom, role, actif').order('role').order('nom'),
      supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'points_config').maybeSingle(),
      supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'saisie_manuelle').maybeSingle(),
      supabase.from('app_state').select('value').eq('app', 'rh').eq('key', 'personnel').maybeSingle(),
      supabase.from('performances').select('prof_id, date_jour, heure_arrivee, heure_depart'),
      supabase.from('preparations').select('user_id, date_cours, heure_cours, heure_depot, matiere, groupe, status, historique_statuts'),
      supabase.from('comprehensions').select('prof_id, date_cours, matiere'),
      supabase.from('absences_enseignants').select('prof_id, date_absence, justifiee, motif'),
      supabase.from('disciplines').select('prof_id, gravite, statut, created_at'),
      supabase.from('affectations_matieres').select('prof_id, groupe, matiere'),
      supabase.from('emploi_du_temps').select('groupe, matiere'),
      supabase.from('sanctions_personnel').select('*').order('date_effet', { ascending: false }),
    ])

    // Sans l'équipe il n'y a pas d'écran du tout : c'est le seul échec fatal.
    if (usr.error) {
      setErreur(messageLisible(usr.error))
      setChargement(false)
      return
    }

    // Le registre des sanctions peut ne pas être installé : la fiche reste
    // lisible sans lui, elle le signale simplement. Une table absente et une
    // requête refusée ne sont pas la même chose — la première est un état
    // connu du déploiement, la seconde une panne.
    const sanctionsAbsentes = tableAbsente(sanc.error)
    const sanctionsCassees = Boolean(sanc.error) && !sanctionsAbsentes
    setSanctionsInstallees(!sanctionsAbsentes)
    setSanctionsEnEchec(sanctionsCassees)
    setSanctions(Array.isArray(sanc.data) ? sanc.data : [])

    // Chaque bloc est nommé : une source en panne se signale par son nom, et
    // les onze autres continuent de s'afficher. Signaler par bloc, jamais par
    // page — tout perdre parce que l'une échoue remplacerait une panne
    // discrète par une panne totale.
    const parBloc = {
      config: cfg,
      saisie_manuelle: man,
      personnel: pers,
      pointages: perf,
      preparations: prep,
      fins_de_cours: comp,
      absences: abs,
      incidents: disc,
      affectations: aff,
      emploi_du_temps: edt,
      ...(sanctionsCassees ? { sanctions: sanc } : {}),
    }
    const bilan = agreger(parBloc)
    setEnEchec(bilan.blocsEnEchec)
    setMessagesEchec(
      bilan.blocsEnEchec.map(cle => `${LIBELLE_BLOC[cle] || cle} : ${messageLisible(parBloc[cle].error)}`)
    )

    const liste = r => (Array.isArray(r?.data) ? r.data : [])

    setPersonnel(pers.error ? {} : (pers.data?.value || {}))

    const configuration = cfg.data?.value ? { ...CONFIG_DEFAUT, ...cfg.data.value } : CONFIG_DEFAUT
    setConfig(configuration)

    // Charge hebdomadaire réelle de chaque enseignant : 30 min par créneau des
    // matières qui lui sont confiées. Elle sert à proratiser les cibles.
    const creneaux = {}
    liste(edt).forEach(c => { creneaux[`${c.groupe}|${c.matiere}`] = (creneaux[`${c.groupe}|${c.matiere}`] || 0) + 1 })
    const heuresParProf = {}
    liste(aff).forEach(a => {
      if (!a.prof_id) return
      const n = creneaux[`${a.groupe}|${a.matiere}`] || 0
      heuresParProf[a.prof_id] = (heuresParProf[a.prof_id] || 0) + (n * 30) / 60
    })

    setDonnees({
      performances: liste(perf),
      preparations: liste(prep),
      comprehensions: liste(comp),
      absencesEnseignants: liste(abs),
      disciplines: liste(disc),
      rapports: [],
      saisieManuelle: man.error ? {} : (man.data?.value || {}),
      heuresParProf,
    })
    setEquipe(liste(usr).filter(u => u.actif !== false))
    setChargement(false)
  }

  // ── Agrégation par personne ────────────────────────────────────────────
  //
  // Chaque compteur porte aussi le fait de savoir s'il repose sur quelque
  // chose : `null` veut dire « rien de mesuré », et ne s'affiche pas comme un
  // zéro. C'est la différence entre un enseignant sans incident et un
  // enseignant dont on n'a rien noté.

  function activiteDe(u) {
    const d = donnees
    const limite = config.heureLimiteArrivee || '08:00'

    const jours = d.performances.filter(p => p.prof_id === u.id)
    const pointes = jours.length
    const alHeure = jours.filter(p => p.heure_arrivee && String(p.heure_arrivee).slice(0, 5) <= limite).length
    const enRetard = jours.filter(p => p.heure_arrivee && String(p.heure_arrivee).slice(0, 5) > limite).length
    const sansHeure = jours.filter(p => !p.heure_arrivee).length

    const absences = d.absencesEnseignants.filter(a => a.prof_id === u.id)
    const preps = d.preparations.filter(p => p.user_id === u.id)
    const incidents = d.disciplines.filter(x => x.prof_id === u.id)
    const sanc = sanctions.filter(s => s.employe_id === u.id)

    // Les points n'ont de sens que pour qui est évalué sur eux — et que si
    // toutes les sources du calcul ont répondu. Calculer sur des listes vides
    // par échec produirait un « 0 % » indiscernable d'un vrai zéro, sur un
    // chiffre qui décide d'une prime.
    const pointsFiables = !SOURCES_POINTS.some(k => enEchec.includes(k))
    const calc = (u.role === 'professeur' && pointsFiables)
      ? calculerPoints(config, d, u.id, `${u.prenom} ${u.nom}`)
      : null

    return {
      pointes: pointes || null,
      alHeure, enRetard, sansHeure,
      heures: d.heuresParProf[u.id] || null,
      absJustifiees: absences.filter(a => a.justifiee).length,
      absInjustifiees: absences.filter(a => !a.justifiee).length,
      absTotal: absences.length,
      absences,
      preparations: preps.length || null,
      prepsATemps: preps.filter(preparationATemps).length,
      finsDeCours: d.comprehensions.filter(c => c.prof_id === u.id).length,
      incidents: incidents.length,
      incidentsGraves: incidents.filter(i => i.gravite && i.gravite !== 'mineure').length,
      sanctions: sanc,
      sanctionsActives: sanc.filter(s => !s.levee_le).length,
      calc,
      // Un enseignant dont on ne peut pas calculer les points n'est pas un
      // enseignant à 0 % : l'écran doit le dire.
      pointsIndisponibles: u.role === 'professeur' && !pointsFiables,
    }
  }

  // ── Salaire mensuel ────────────────────────────────────────────────────
  //
  // Il plafonne l'avance sur salaire qu'un employé peut demander — la moitié,
  // règle posée par le directeur. Tant qu'il n'est pas renseigné, la plateforme
  // ne peut pas vérifier ce plafond et le dit franchement plutôt que de laisser
  // croire à un contrôle qui n'a pas lieu.
  async function definirSalaire(u) {
    const actuel = personnel[u.id]?.salaire
    const saisi = prompt(
      `Salaire mensuel de ${u.prenom} ${u.nom}, en FCFA.\nIl sert à plafonner ses avances : la moitié au maximum.`,
      actuel ? String(actuel) : ''
    )
    if (saisi === null) return
    const n = parseInt(String(saisi).replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(n) || n <= 0) { alert('Indiquez un montant supérieur à zéro.'); return }

    const maj = { ...personnel, [u.id]: { ...(personnel[u.id] || {}), salaire: n } }
    const { error } = await supabase.from('app_state').upsert({
      app: 'rh', key: 'personnel', value: maj, updated_at: new Date().toISOString(),
    }, { onConflict: 'app,key' })
    if (error) { alert("Salaire non enregistré : " + error.message); return }
    setPersonnel(maj)
  }

  // ── Saisie d'une sanction ──────────────────────────────────────────────

  async function ajouterSanction(u) {
    const type = prompt(
      `Sanction pour ${u.prenom} ${u.nom}.\nType : avertissement, blame, mise_a_pied ou autre`,
      'avertissement'
    )
    if (!type) return
    if (!TYPES_SANCTION[type]) { alert('Type inconnu. Attendu : avertissement, blame, mise_a_pied ou autre.'); return }

    const motif = prompt('Motif — il sera conservé tel quel dans le dossier :', '')
    if (!motif || !motif.trim()) { alert('Une sanction sans motif écrit n’est pas enregistrable.'); return }

    const dateEffet = prompt('Date d’effet (AAAA-MM-JJ) :', new Date().toISOString().slice(0, 10))
    if (!dateEffet) return

    const { error } = await supabase.from('sanctions_personnel').insert({
      employe_id: u.id, type, motif: motif.trim(), date_effet: dateEffet, prononcee_par: user.id,
    })
    if (error) { alert("Sanction non enregistrée : " + error.message); return }
    charger()
  }

  async function leverSanction(s) {
    const motif = prompt('Motif de la levée :', '')
    if (!motif || !motif.trim()) { alert('Une levée se justifie autant que la sanction.'); return }
    const { error } = await supabase.from('sanctions_personnel')
      .update({ levee_le: new Date().toISOString().slice(0, 10), levee_motif: motif.trim() })
      .eq('id', s.id)
    if (error) { alert('Levée non enregistrée : ' + error.message); return }
    charger()
  }

  // ── Rendu ──────────────────────────────────────────────────────────────

  if (chargement) return <div className="empty-state"><p>Rassemblement des données…</p></div>
  if (erreur) return (
    <div className="empty-state">
      <div className="empty-icon">🛠️</div>
      <p>{erreur}</p>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
        Aucune donnée n’a pu être chargée. Rien de ce qui suit ne serait fiable.
      </p>
      <button onClick={charger}
        style={{ marginTop: 10, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
        Réessayer
      </button>
    </div>
  )

  const carte = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }
  const bandeau = { background: '#0d2a3b', color: '#fff', padding: '7px 14px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .3 }

  // Un compteur. Trois rendus distincts, jamais deux :
  //   `echec`           la source a échoué — on ne saura pas (tiret rouge)
  //   `valeur === null` rien de mesuré — c'est une réponse (tiret discret)
  //   sinon             la valeur mesurée, zéro compris
  const compteur = (label, valeur, teinte, precision, echec) => (
    <div title={echec ? 'Chargement échoué — valeur inconnue' : undefined}
      style={{ minWidth: 92, flex: 1, padding: '8px 10px', background: 'var(--bg)', borderRadius: 10, border: `1px solid ${echec ? 'var(--red)' : 'var(--border)'}` }}>
      <div style={{ fontSize: 17, fontWeight: 900, color: echec ? 'var(--red)' : valeur === null ? 'var(--border)' : (teinte || 'var(--text)'), lineHeight: 1.1 }}>
        {echec || valeur === null ? '—' : valeur}
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginTop: 2 }}>{label}</div>
      {(echec ? 'source indisponible' : precision) && (
        <div style={{ fontSize: 9, color: echec ? 'var(--red)' : 'var(--muted)', marginTop: 1 }}>
          {echec ? 'source indisponible' : precision}
        </div>
      )}
    </div>
  )

  const echoue = cle => enEchec.includes(cle)

  return (
    <>
      <div className="section-head">
        <div className="section-title">Activité du personnel</div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{equipe.length} personnes</span>
      </div>

      {/* Rendre la panne observable. Sans ce bandeau, un refus RLS sur les
          pointages se lisait « rien de mesuré » — c'est-à-dire un fait, alors
          que c'est une ignorance. */}
      {enEchec.length > 0 && (
        <div style={{ background: 'rgba(220,38,38,.06)', border: '1px solid var(--red)', borderLeft: '4px solid var(--red)', borderRadius: 12, padding: '11px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: 'var(--red)' }}>
            {enEchec.length} source{enEchec.length > 1 ? 's' : ''} de données indisponible{enEchec.length > 1 ? 's' : ''}
          </div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11, color: 'var(--red)', lineHeight: 1.6 }}>
            {messagesEchec.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            Les compteurs concernés affichent «&nbsp;—&nbsp;» et non un chiffre. Le reste de la fiche est à jour.
          </div>
          <button onClick={charger}
            style={{ marginTop: 8, padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      )}

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        Un tiret signifie <b>rien de mesuré</b>, et non zéro : une journée sans pointage n’est pas une
        absence, c’est une journée qu’on n’a pas relevée. Les points sont ceux du moteur de la prime,
        pas un second calcul.
        {!sanctionsInstallees && (
          <div style={{ color: 'var(--amber)', marginTop: 6 }}>
            Le registre des sanctions n’est pas installé — le script <b>sql/stock_et_sanctions.sql</b> doit
            être exécuté une fois dans Supabase. Le reste de la fiche fonctionne sans lui.
          </div>
        )}
      </div>

      {equipe.map(u => {
        const a = activiteDe(u)
        const estOuvert = ouvert === u.id
        return (
          <div key={u.id} style={carte}>
            <div onClick={() => setOuvert(estOuvert ? null : u.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer', background: estOuvert ? 'rgba(26,175,224,.05)' : 'transparent' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{u.prenom} {u.nom}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {ROLES[u.role] || u.role}
                  {a.heures ? ` · ${a.heures} h/semaine` : ''}
                </div>
              </div>
              {a.sanctionsActives > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--red)', borderRadius: 6, padding: '2px 7px' }}>
                  {a.sanctionsActives} sanction{a.sanctionsActives > 1 ? 's' : ''}
                </span>
              )}
              {a.calc && (
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--accent)' }}>{a.calc.pourcentage} %</span>
              )}
              {a.pointsIndisponibles && (
                <span title="Points incalculables — une source du barème est indisponible"
                  style={{ fontSize: 13, fontWeight: 900, color: 'var(--red)' }}>— %</span>
              )}
              <span style={{ color: 'var(--muted)', transform: estOuvert ? 'rotate(180deg)' : 'none', transition: '.2s' }}>⌄</span>
            </div>

            {estOuvert && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>

                {/* Rémunération */}
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Rémunération</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>
                    {/* « non renseigné » affirme que la case est vide. Si la
                        fiche RH n'a pas pu être lue, on ne sait pas : le dire. */}
                    {echoue('personnel')
                      ? <span style={{ color: 'var(--red)', fontSize: 13 }}>— salaire inconnu, chargement échoué</span>
                      : personnel[u.id]?.salaire
                        ? `${personnel[u.id].salaire.toLocaleString('fr-FR')} F / mois`
                        : <span style={{ color: 'var(--amber)', fontSize: 13 }}>salaire non renseigné</span>}
                  </div>
                  {!echoue('personnel') && personnel[u.id]?.salaire && (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      avance plafonnée à {Math.floor(personnel[u.id].salaire / 2).toLocaleString('fr-FR')} F
                    </div>
                  )}
                  {/* La fiche RH est un objet unique réécrit en entier. Si sa
                      lecture a échoué, enregistrer écraserait les salaires de
                      tous les autres employés par un objet vide. On ferme la
                      saisie tant qu'on n'a pas relu la fiche. */}
                  <button onClick={() => definirSalaire(u)} disabled={echoue('personnel')}
                    title={echoue('personnel') ? 'Fiche de rémunération non chargée — modifier écraserait les autres salaires' : undefined}
                    style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 11, fontWeight: 700, cursor: echoue('personnel') ? 'not-allowed' : 'pointer', opacity: echoue('personnel') ? .5 : 1 }}>
                    {personnel[u.id]?.salaire ? 'Modifier' : 'Renseigner'}
                  </button>
                </div>

                {/* Présence */}
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Présence</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {compteur('jours pointés', a.pointes, undefined, undefined, echoue('pointages'))}
                  {compteur('à l’heure', a.pointes === null ? null : a.alHeure, 'var(--green)', `avant ${config.heureLimiteArrivee || '08:00'}`, echoue('pointages'))}
                  {compteur('en retard', a.pointes === null ? null : a.enRetard, a.enRetard ? 'var(--amber)' : undefined, undefined, echoue('pointages'))}
                  {compteur('sans heure relevée', a.pointes === null ? null : a.sansHeure, a.sansHeure ? 'var(--red)' : undefined, 'ne rapporte rien', echoue('pointages'))}
                </div>

                {/* Absences */}
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', margin: '12px 0 6px' }}>Absences</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {compteur('justifiées', a.absTotal ? a.absJustifiees : null, 'var(--green)', 'pièce validée', echoue('absences'))}
                  {compteur('injustifiées', a.absTotal ? a.absInjustifiees : null, a.absInjustifiees ? 'var(--red)' : undefined, undefined, echoue('absences'))}
                </div>
                {a.absences.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    {a.absences.slice(0, 6).map(x => `${jour(x.date_absence)}${x.justifiee ? '' : ' (injustifiée)'}`).join(' · ')}
                  </div>
                )}

                {/* Travail pédagogique */}
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', margin: '12px 0 6px' }}>Travail pédagogique</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {compteur('préparations', a.preparations, undefined, undefined, echoue('preparations'))}
                  {/* « la veille au plus tard » énonçait une règle qui n'a
                      jamais été celle du calcul : la ponctualité se mesure au
                      début du cours, et c'est la règle arbitrée par le
                      promoteur — `heures_avant_cours` vaut 0. Le compteur
                      annonçait donc un critère plus sévère que celui qu'il
                      appliquait, sur un indicateur que les enseignants lisent. */}
                  {compteur('déposées à temps', a.preparations === null ? null : a.prepsATemps, 'var(--green)', 'avant le début du cours', echoue('preparations'))}
                  {compteur('fiches de fin de cours', a.finsDeCours || null, undefined, undefined, echoue('fins_de_cours'))}
                </div>

                {/* Vie scolaire */}
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', margin: '12px 0 6px' }}>Vie scolaire</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {compteur('incidents signalés', a.incidents || null, undefined, 'élèves', echoue('incidents'))}
                  {compteur('dont graves', a.incidents ? a.incidentsGraves : null, a.incidentsGraves ? 'var(--amber)' : undefined, undefined, echoue('incidents'))}
                </div>

                {/* Points de la prime */}
                {a.calc && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', margin: '12px 0 6px' }}>
                      Points de la prime · {a.calc.total} / {a.calc.max}
                    </div>
                    {(a.calc.parTrimestre || []).map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0' }}>
                        <span style={{ width: 92, color: 'var(--muted)' }}>{t.label || t.id}</span>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.round((t.pondere / (t.pondereMax || 1)) * 100))}%`, height: '100%', background: 'var(--accent)' }} />
                        </div>
                        <span style={{ fontWeight: 800, width: 62, textAlign: 'right' }}>{t.pondere} / {t.pondereMax}</span>
                        {t.absencesNonJustifiees > 0 && (
                          <span title="absences non justifiées sur le trimestre" style={{ fontSize: 10, color: 'var(--red)', fontWeight: 800 }}>
                            {t.absencesNonJustifiees} abs.
                          </span>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Points indisponibles */}
                {a.pointsIndisponibles && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', margin: '12px 0 6px' }}>
                      Points de la prime · —
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--red)', lineHeight: 1.6 }}>
                      Le calcul n’a pas pu être fait : une des sources du barème est indisponible.
                      Aucun pourcentage n’est affiché plutôt qu’un chiffre faux. Voir le bandeau en haut de page.
                    </div>
                  </>
                )}

                {/* Sanctions */}
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', margin: '12px 0 6px' }}>Sanctions</div>
                {sanctionsEnEchec ? (
                  <div style={{ fontSize: 11, color: 'var(--red)' }}>
                    Registre des sanctions illisible — on ne sait pas si ce dossier en comporte.
                  </div>
                ) : !sanctionsInstallees ? (
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Registre non installé.</div>
                ) : a.sanctions.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Aucune sanction au dossier.</div>
                ) : a.sanctions.map(s => (
                  <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: s.levee_le ? 'var(--muted)' : 'var(--red)' }}>
                        {TYPES_SANCTION[s.type] || s.type} · {jour(s.date_effet)}
                        {s.levee_le && <span style={{ fontWeight: 600 }}> — levée le {jour(s.levee_le)}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.motif}</div>
                      {s.levee_motif && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Levée : {s.levee_motif}</div>}
                    </div>
                    {!s.levee_le && (
                      <button onClick={() => leverSanction(s)}
                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Lever
                      </button>
                    )}
                  </div>
                ))}
                {sanctionsInstallees && (
                  <button onClick={() => ajouterSanction(u)}
                    style={{ marginTop: 8, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    + Consigner une sanction
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
