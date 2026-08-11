import { useState, useEffect } from 'react'
import { journaliser } from '../lib/audit'

// Fiche de checking de fin de cours.
// L'enseignant note la compréhension de chaque élève sur 100 juste après la
// leçon. Ces notes alimentent le rapport hebdomadaire du conseiller de vie
// scolaire : prouesse de la semaine et point à améliorer.

const aujourdhui = () => new Date().toISOString().slice(0, 10)

// Les tout-petits ne sont pas notés en pourcentage devant les parents : on
// garde la note sur 100 en base, mais on l'affiche avec le vocabulaire déjà
// employé dans le reste de l'application.
export function libelleNote(v, maternelle) {
  if (v === null || v === undefined || v === '') return '—'
  if (!maternelle) return v + '/100'
  return v >= 87 ? 'Bien acquis' : v >= 62 ? 'Acquis' : v >= 37 ? 'En cours' : 'Début'
}

export function couleurNote(v) {
  if (v === null || v === undefined || v === '') return 'var(--muted)'
  return v >= 75 ? 'var(--green)' : v >= 50 ? 'var(--amber)' : 'var(--red)'
}

export default function FinDeCours({ user, selectedClasse, classEleves, programmeData, supabase }) {
  const [date, setDate] = useState(aujourdhui())
  const [matiere, setMatiere] = useState('')
  const [lecon, setLecon] = useState('')
  const [notes, setNotes] = useState({})            // eleve_id -> note
  const [observations, setObservations] = useState({})
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState(null)      // { type, texte }
  const [tableManquante, setTableManquante] = useState(false)

  const maternelle = selectedClasse?.nom === 'Petite Section' || selectedClasse?.nom === 'Grande Section'

  // Recharger la saisie existante : revenir sur un cours déjà noté doit
  // montrer les notes déjà données, pas une fiche vierge.
  useEffect(() => {
    let annule = false
    async function charger() {
      if (!selectedClasse) return
      // La requête part même sans matière : c'est elle qui détecte si la table
      // existe. Sans cela, l'écran « table absente » masquerait le champ
      // matière, et plus rien ne pourrait relancer la vérification — le
      // professeur resterait bloqué même une fois le script SQL exécuté.
      let req = supabase
        .from('comprehensions')
        .select('eleve_id, note, observation, lecon')
        .eq('classe_id', selectedClasse.id)
        .eq('date_cours', date)
      if (matiere) req = req.eq('matiere', matiere)

      const { data, error } = await req
      if (annule) return
      if (error) {
        // 42P01 = table absente : le script SQL n'a pas encore été exécuté.
        if (error.code === '42P01') setTableManquante(true)
        return
      }
      setTableManquante(false)
      if (!matiere) { setNotes({}); setObservations({}); return }
      const n = {}, o = {}
      ;(data || []).forEach(r => { n[r.eleve_id] = r.note; if (r.observation) o[r.eleve_id] = r.observation })
      setNotes(n); setObservations(o)
      if (data && data.length && data[0].lecon) setLecon(data[0].lecon)
    }
    charger()
    return () => { annule = true }
  }, [selectedClasse?.id, date, matiere, supabase])

  const notees = classEleves.filter(e => notes[e.id] !== undefined && notes[e.id] !== '')
  const moyenne = notees.length
    ? Math.round(notees.reduce((s, e) => s + Number(notes[e.id]), 0) / notees.length)
    : null

  function majNote(id, valeur) {
    if (valeur === '') { const c = { ...notes }; delete c[id]; setNotes(c); return }
    const v = Math.max(0, Math.min(100, parseInt(valeur, 10) || 0))
    setNotes({ ...notes, [id]: v })
  }

  async function enregistrer() {
    if (!matiere.trim()) return setMessage({ type: 'err', texte: 'Indiquez la matière du cours.' })
    if (notees.length === 0) return setMessage({ type: 'err', texte: 'Aucune note saisie.' })

    setEnCours(true); setMessage(null)
    const lignes = notees.map(e => ({
      eleve_id: e.id,
      classe_id: selectedClasse.id,
      prof_id: user.id,
      date_cours: date,
      matiere: matiere.trim(),
      lecon: lecon.trim() || null,
      note: Number(notes[e.id]),
      observation: (observations[e.id] || '').trim() || null,
      saisi_par: [user.prenom, user.nom].filter(Boolean).join(' '),
    }))

    const { error } = await supabase
      .from('comprehensions')
      .upsert(lignes, { onConflict: 'eleve_id,date_cours,matiere' })

    setEnCours(false)
    if (error) {
      // Ne jamais laisser croire que c'est enregistré quand ça ne l'est pas.
      setMessage({ type: 'err', texte: 'Enregistrement refusé : ' + error.message })
      return
    }
    setMessage({ type: 'ok', texte: `${lignes.length} note(s) enregistrée(s) pour ${matiere}.` })
    journaliser({
      table: 'comprehensions',
      ligneId: selectedClasse.id,
      champ: 'fin_de_cours',
      apres: `${matiere} · ${date} — ${lignes.length} élève(s), moyenne ${moyenne}/100`,
      action: 'saisie',
    })
  }

  if (!selectedClasse) {
    return <div className="empty-state"><div className="empty-icon">🏫</div><p>Choisissez d'abord une classe.</p></div>
  }

  if (tableManquante) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🛠️</div>
        <p>La fiche de fin de cours n'est pas encore active.</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          Le script <code>sql/comprehensions.sql</code> doit être exécuté une fois dans Supabase.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="section-head">
        <div className="section-title">Fin de cours — {selectedClasse.nom}</div>
        {moyenne !== null && (
          <span style={{ fontSize: 12, fontWeight: 800, color: couleurNote(moyenne) }}>
            Moyenne {libelleNote(moyenne, maternelle)}
          </span>
        )}
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            Date du cours
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            Matière
            <input list="fdc-matieres" value={matiere} onChange={e => setMatiere(e.target.value)} placeholder="Ex : Mathématiques"
              style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
            <datalist id="fdc-matieres">
              {(programmeData || []).map(m => <option key={m.id} value={m.nom} />)}
            </datalist>
          </label>
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginTop: 10 }}>
          Leçon du jour (facultatif)
          <input value={lecon} onChange={e => setLecon(e.target.value)} placeholder="Ex : L'addition à deux chiffres"
            style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
        </label>
      </div>

      {!matiere.trim() ? (
        <div className="empty-state"><div className="empty-icon">📘</div><p>Indiquez la matière pour noter la classe.</p></div>
      ) : (
        <>
          <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ background: '#0d2a3b', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
              Compréhension sur 100 — {notees.length}/{classEleves.length} noté(s)
            </div>
            {classEleves.map(el => {
              const v = notes[el.id]
              const c = couleurNote(v === undefined ? null : v)
              return (
                <div key={el.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar av-blue" style={{ width: 30, height: 30, fontSize: 10, flexShrink: 0 }}>
                      {(el.prenom[0] || '') + (el.nom[0] || '')}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{el.prenom} {el.nom}</div>
                    <input type="number" min="0" max="100" value={v === undefined ? '' : v}
                      onChange={e => majNote(el.id, e.target.value)} placeholder="—"
                      style={{ width: 64, padding: '6px 8px', borderRadius: 8, border: '2px solid ' + c, fontSize: 14, fontWeight: 800, textAlign: 'center', color: c }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: c, width: 78, textAlign: 'right' }}>
                      {libelleNote(v === undefined ? null : v, maternelle)}
                    </span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={v === undefined ? 0 : v}
                    onChange={e => majNote(el.id, e.target.value)}
                    style={{ width: '100%', marginTop: 6, accentColor: c }} />
                  {v !== undefined && v < 50 && (
                    <input value={observations[el.id] || ''} onChange={e => setObservations({ ...observations, [el.id]: e.target.value })}
                      placeholder="Ce qui a bloqué (repris dans le rapport aux parents)"
                      style={{ width: '100%', marginTop: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                  )}
                </div>
              )
            })}
          </div>

          {message && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: message.type === 'ok' ? 'rgba(46,158,79,.10)' : 'rgba(220,53,69,.10)',
              color: message.type === 'ok' ? 'var(--green)' : 'var(--red)',
            }}>{message.texte}</div>
          )}

          <button className="btn-primary" onClick={enregistrer} disabled={enCours}
            style={{ width: '100%', marginTop: 12, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 800 }}>
            {enCours ? 'Enregistrement…' : '💾 Enregistrer la fiche'}
          </button>
        </>
      )}
    </>
  )
}
