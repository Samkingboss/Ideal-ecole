import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SEQUENCES, DUREE_SEQUENCE, sequenceDansGrille, semainePaire } from '../lib/sequences'
import FichePreparation from './FichePreparation'
import { statutDe, libelleStatut } from '../lib/preparations'
import EmploiDuTempsMaternelle from './EmploiDuTempsMaternelle'

// Emploi du temps personnel de l'enseignant, en page d'accueil.
//
// Il est construit à partir de ce que la direction a affecté : une matière
// d'un groupe revient à un seul enseignant sur l'année. On croise donc les
// affectations de l'enseignant avec la grille officielle des classes.
//
// L'alternance du § 1.3 est prise en compte : en semaine paire, les blocs du
// matin et de l'après-midi sont permutés. La grille affichée est donc celle
// de la semaine réellement en cours, pas une grille théorique.

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

const horaire = s => {
  const h = Math.floor(s.debut / 60), m = s.debut % 60
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

const heuresLisibles = min => {
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

// Lundi = 1 … Vendredi = 5 ; samedi et dimanche renvoient null.
const jourOuvre = d => {
  const j = d.getDay()
  return j >= 1 && j <= 5 ? j : null
}

/** Date ISO du jour `j` (1 = lundi) de la semaine contenant `ref`. */
function dateDuJour(ref, j) {
  const d = new Date(ref)
  const decalage = (d.getDay() === 0 ? 7 : d.getDay()) - j
  d.setDate(d.getDate() - decalage)
  return d.toISOString().slice(0, 10)
}

/** Lundi de la semaine contenant `d`, à minuit. */
function lundiDe(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() === 0 ? 7 : x.getDay()) - 1))
  return x
}

const enJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const jourMois = iso =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

const estCompteMaternelle = user => /^(maitresse|assistante)-/.test(String(user?.fonction || user?.poste_id || '').toLowerCase())

export default function MonEmploiDuTemps({ user }) {
  return estCompteMaternelle(user)
    ? <EmploiDuTempsMaternelle user={user} />
    : <EmploiDuTempsStandard user={user} />
}

function EmploiDuTempsStandard({ user }) {
  const [creneaux, setCreneaux] = useState([])   // { jour, sequence, matiere, groupe }
  const [preparees, setPreparees] = useState(new Map())  // "date|sequence" → statut
  const [ouverte, setOuverte] = useState(null)   // { creneau, dateCours }
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const aujourdhui = new Date()
  const lundiCourant = lundiDe(aujourdhui)
  // Semaine affichée. L'enseignant navigue : sa grille est son agenda.
  const [lundi, setLundi] = useState(lundiCourant)

  const dateISO = dateDuJour(lundi, 1)
  const paire = semainePaire(dateISO)

  // Décalage en semaines par rapport à aujourd'hui : 0 = en cours,
  // négatif = archive, positif = à venir.
  const decalage = Math.round((lundi - lundiCourant) / (7 * 86400000))
  const archive = decalage < 0
  const jourActuel = decalage === 0 ? jourOuvre(aujourdhui) : null

  useEffect(() => { charger() }, [user?.id])
  useEffect(() => { if (!chargement) chargerPreparations() }, [lundi])

  async function charger() {
    setChargement(true); setErreur(null)
    const { data: aff, error: e1 } = await supabase
      .from('affectations_matieres').select('groupe, matiere').eq('prof_id', user.id)
    if (e1) {
      setErreur(e1.code === '42P01'
        ? "L'emploi du temps n'est pas encore installé sur la plateforme."
        : 'Chargement impossible : ' + e1.message)
      setChargement(false); return
    }
    if (!aff || aff.length === 0) { setCreneaux([]); setChargement(false); return }

    const groupes = [...new Set(aff.map(a => a.groupe))]
    const { data: edt, error: e2 } = await supabase
      .from('emploi_du_temps').select('groupe, jour, sequence, matiere').in('groupe', groupes)
    if (e2) { setErreur('Chargement impossible : ' + e2.message); setChargement(false); return }

    // On ne garde que les créneaux dont la matière lui a été confiée.
    const miennes = new Set(aff.map(a => `${a.groupe}|${a.matiere}`))
    setCreneaux((edt || []).filter(c => miennes.has(`${c.groupe}|${c.matiere}`)))
    await chargerPreparations()
    setChargement(false)
  }

  // Séances déjà préparées pour la semaine affichée. La pastille verte suit
  // la semaine : préparer lundi dernier ne dispense pas de préparer ce lundi.
  async function chargerPreparations() {
    const debut = dateDuJour(lundi, 1)
    const fin = dateDuJour(lundi, 5)
    const { data } = await supabase.from('preparations')
      .select('date_cours, sequence, status')
      .eq('user_id', user.id).gte('date_cours', debut).lte('date_cours', fin)
    // On retient le statut, pas seulement l'existence. Une séance déposée en
    // retard ou renvoyée pour correction se voyait jusqu'ici exactement comme
    // une séance prête : la pastille était verte dans les trois cas.
    setPreparees(new Map((Array.isArray(data) ? data : [])
      .filter(p => p.sequence != null)
      .map(p => [`${p.date_cours}|${p.sequence}`, p.status])))
  }

  // Case affichée pour un jour et une séquence, en tenant compte de la
  // permutation des blocs en semaine paire.
  const caseDe = (jour, seq) => {
    const cible = sequenceDansGrille(seq, dateISO)
    return creneaux.find(c => c.jour === jour && c.sequence === cible) || null
  }

  const minutesSemaine = creneaux.length * DUREE_SEQUENCE

  // Séances réellement données cette semaine : une par jour et par créneau
  // occupé. `sequence` est ici l'horaire RÉEL de la semaine affichée, pas la
  // case de la grille — les deux diffèrent de six en semaine paire, où les
  // blocs sont permutés. C'est cet horaire réel qu'on enregistre avec la
  // préparation, sinon la pastille ne retrouverait jamais sa séance.
  const seances = []
  for (let jour = 1; jour <= 5; jour++) {
    for (const s of SEQUENCES) {
      const c = caseDe(jour, s.n)
      if (c) seances.push({ ...c, jour, sequence: s.n, date: dateDuJour(lundi, jour) })
    }
  }
  const estPrete = se => preparees.has(`${se.date}|${se.sequence}`)
  const statutSeance = se => preparees.get(`${se.date}|${se.sequence}`) || null
  const pretes = seances.filter(estPrete).length

  // Séquence en cours, pour se repérer d'un coup d'œil dans la journée.
  const minutesMaintenant = aujourdhui.getHours() * 60 + aujourdhui.getMinutes()
  const seqEnCours = jourActuel
    ? (SEQUENCES.find(s => minutesMaintenant >= s.debut && minutesMaintenant < s.debut + DUREE_SEQUENCE) || null)
    : null

  if (chargement) return <div className="empty-state"><p>Chargement de votre emploi du temps…</p></div>

  if (erreur) return (
    <div className="empty-state"><div className="empty-icon">🛠️</div><p>{erreur}</p></div>
  )

  if (creneaux.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">🗓️</div>
      <p>Aucune matière ne vous est encore affectée.</p>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
        La direction attribue les matières depuis son espace ; votre emploi du temps apparaîtra ici automatiquement.
      </p>
    </div>
  )

  return (
    <>
      <div className="section-head">
        <div className="section-title">Mon emploi du temps</div>
        <span style={{ fontSize: 12, fontWeight: 800, color: pretes === creneaux.length ? 'var(--green)' : 'var(--accent)' }}>
          {pretes}/{creneaux.length} préparées · {heuresLisibles(minutesSemaine)}
        </span>
      </div>

      {/* Navigation d'agenda : semaines écoulées, semaine en cours, semaines
          à venir. Préparer d'avance est le fonctionnement normal. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button className="btn-sm" onClick={() => setLundi(enJours(lundi, -7))} aria-label="Semaine précédente">◀</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            {jourMois(dateDuJour(lundi, 1))} — {jourMois(dateDuJour(lundi, 5))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {decalage === 0 ? 'Semaine en cours'
              : decalage === 1 ? 'Semaine à venir'
              : decalage === -1 ? 'Semaine dernière'
              : decalage < 0 ? `Il y a ${-decalage} semaines`
              : `Dans ${decalage} semaines`}
          </div>
        </div>
        <button className="btn-sm" onClick={() => setLundi(enJours(lundi, 7))} aria-label="Semaine suivante">▶</button>
        {decalage !== 0 && (
          <button className="btn-sm" onClick={() => setLundi(lundiCourant)} title="Revenir à la semaine en cours">Aujourd’hui</button>
        )}
      </div>

      <div style={{
        background: archive ? 'rgba(100,116,139,.10)' : (paire ? 'rgba(247,148,29,.10)' : 'rgba(26,175,224,.10)'),
        border: '1px solid ' + (archive ? 'rgba(100,116,139,.35)' : (paire ? 'rgba(247,148,29,.35)' : 'rgba(26,175,224,.35)')),
        borderRadius: 12, padding: '9px 13px', fontSize: 12, marginBottom: 12,
      }}>
        {archive
          ? <><b>Semaine archivée</b> — consultable et imprimable, elle ne se modifie plus.</>
          : <><b>Semaine {paire ? 'paire' : 'impaire'}</b> — {paire
              ? 'les blocs du matin et de l’après-midi sont permutés cette semaine.'
              : 'grille normale, telle qu’écrite dans le document.'}</>}
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ background: '#0d2a3b', color: '#fff', padding: '8px 6px', fontSize: 10, position: 'sticky', left: 0, zIndex: 2 }}>Horaire</th>
              {JOURS.map((j, i) => (
                <th key={j} style={{
                  background: i + 1 === jourActuel ? 'var(--accent)' : '#0d2a3b',
                  color: '#fff', padding: '8px 6px', fontSize: 11, minWidth: 92,
                }}>{j}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEQUENCES.map(s => {
              const enCours = seqEnCours && seqEnCours.n === s.n
              return (
                <tr key={s.n}>
                  <td style={{
                    background: enCours ? 'rgba(26,175,224,.18)' : 'var(--bg)',
                    border: '1px solid var(--border)', padding: '6px', textAlign: 'center',
                    fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1,
                  }}>
                    <div style={{ fontSize: 11 }}>{horaire(s)}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted)' }}>S{s.n}</div>
                  </td>
                  {JOURS.map((_, i) => {
                    const jour = i + 1
                    const se = seances.find(x => x.jour === jour && x.sequence === s.n) || null
                    const c = se
                    const cetteCase = enCours && jour === jourActuel
                    const prete = se && estPrete(se)
                    // La pastille prend la couleur et l'icône du statut, tirées
                    // de la source unique : une séance déposée en retard ne se
                    // signale plus comme une séance prête.
                    const st = prete ? statutDe(statutSeance(se)) : null
                    return (
                      <td key={i}
                        onClick={se ? () => setOuverte({ creneau: se, dateCours: se.date, lectureSeule: archive }) : undefined}
                        title={se
                          ? (archive ? 'Semaine archivée — consultation seule'
                             : prete ? `${libelleStatut(statutSeance(se))} — cliquez pour revoir la fiche`
                             : 'Cliquez pour préparer cette séance')
                          : undefined}
                        style={{
                          border: '1px solid var(--border)', padding: '6px', textAlign: 'center',
                          position: 'relative', cursor: c ? 'pointer' : 'default',
                          background: cetteCase ? 'var(--accent)' : (c ? 'rgba(26,175,224,.06)' : 'transparent'),
                          color: cetteCase ? '#fff' : 'inherit',
                        }}>
                        {c ? (
                          <>
                            <div style={{ fontWeight: 700 }}>{c.matiere}</div>
                            <div style={{ fontSize: 10, opacity: .75 }}>{c.groupe}</div>
                            {/* Pastille de statut. La couleur ne fait jamais
                                foi seule : l'icône la double, pour qui ne
                                distingue pas le vert de l'ambre. */}
                            {prete && (
                              <span aria-label={libelleStatut(statutSeance(se))} style={{
                                position: 'absolute', right: 4, bottom: 3, width: 13, height: 13,
                                borderRadius: '50%', background: st.couleur, color: '#fff',
                                fontSize: 9, lineHeight: '13px', fontWeight: 800,
                                boxShadow: '0 0 0 1.5px #fff',
                              }}>{st.icone}</span>
                            )}
                          </>
                        ) : <span style={{ color: 'var(--muted)', opacity: .4 }}>—</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
        Cliquez sur une séance pour préparer votre cours. La pastille verte signale
        celles qui sont déjà prêtes cette semaine. Les cases vides sont vos heures libres :
        récréations (10h00, 15h00) et déjeuner (12h00) n’y figurent pas, ce ne sont pas
        des heures d’enseignement.
      </div>

      {ouverte && (
        <FichePreparation
          user={user}
          creneau={ouverte.creneau}
          dateCours={ouverte.dateCours}
          lectureSeule={ouverte.lectureSeule}
          onFerme={() => setOuverte(null)}
          onEnregistre={chargerPreparations}
        />
      )}
    </>
  )
}
