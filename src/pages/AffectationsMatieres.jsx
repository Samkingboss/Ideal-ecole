import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DUREE_SEQUENCE } from '../lib/sequences'
import { journaliser } from '../lib/audit'

// Affectation des enseignants aux matières de l'emploi du temps.
//
// Le document officiel pose une règle stricte (§ 2.1) : une matière d'un
// groupe est assurée par un seul enseignant sur toute l'année. La table le
// garantit ; cet écran ne fait que désigner qui.
//
// Charges hebdomadaires visées par le document, pour que le directeur voie
// immédiatement s'il s'en écarte. Ce sont des repères, pas des plafonds
// imposés par le code : l'organisation peut évoluer.
const CHARGES_DOCUMENT = {
  Faty: 23, Ornella: 20, Michel: 20, Terfa: 19, Catherine: 18, Yacouba: 10, Samuel: 10,
}

const ORDRE_GROUPES = ['CP1', 'CP2', 'CE1-CE2', 'CM1-CM2']

const heuresLisibles = min => {
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

export default function AffectationsMatieres({ user }) {
  const [affectations, setAffectations] = useState([])
  const [volumes, setVolumes] = useState({})     // "groupe|matiere" -> minutes/semaine
  const [profs, setProfs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [groupeOuvert, setGroupeOuvert] = useState('CP1')

  useEffect(() => { charger() }, [])

  async function charger() {
    setChargement(true); setErreur(null)
    const [aff, edt, usr] = await Promise.all([
      supabase.from('affectations_matieres').select('*, users(prenom, nom)').order('groupe').order('matiere'),
      supabase.from('emploi_du_temps').select('groupe, matiere'),
      supabase.from('users').select('id, prenom, nom, role').eq('actif', true).in('role', ['professeur', 'directeur', 'responsable_administratif']),
    ])
    if (aff.error) {
      // 42P01 : le script SQL n'a pas encore été exécuté.
      setErreur(aff.error.code === '42P01'
        ? "L'emploi du temps n'est pas encore installé. Le script sql/emploi_du_temps.sql doit être exécuté une fois dans Supabase."
        : 'Chargement impossible : ' + aff.error.message)
      setChargement(false)
      return
    }
    const v = {}
    ;(edt.data || []).forEach(l => {
      const c = `${l.groupe}|${l.matiere}`
      v[c] = (v[c] || 0) + DUREE_SEQUENCE
    })
    setVolumes(v)
    setAffectations(aff.data || [])
    setProfs(usr.data || [])
    setChargement(false)
  }

  async function affecter(ligne, profId) {
    const avant = ligne.prof_id
    const { data, error } = await supabase
      .from('affectations_matieres')
      .update({ prof_id: profId || null })
      .eq('id', ligne.id)
      .select('*, users(prenom, nom)')
      .single()
    if (error) { alert("Affectation refusée : " + error.message); return }
    setAffectations(prev => prev.map(a => (a.id === data.id ? data : a)))
    journaliser({
      table: 'affectations_matieres', ligneId: ligne.id,
      champ: `${ligne.groupe} · ${ligne.matiere}`,
      avant: avant || '(non affectée)',
      apres: data.users ? `${data.users.prenom} ${data.users.nom}` : '(non affectée)',
      action: 'affectation matière',
    })
  }

  // Charge hebdomadaire réelle de chaque enseignant, cumulée sur les groupes.
  const charges = {}
  affectations.forEach(a => {
    if (!a.prof_id) return
    const min = volumes[`${a.groupe}|${a.matiere}`] || 0
    charges[a.prof_id] = (charges[a.prof_id] || 0) + min
  })

  const total = affectations.length
  const faites = affectations.filter(a => a.prof_id).length
  const minutesTotales = Object.values(volumes).reduce((s, m) => s + m, 0)
  const minutesAffectees = Object.values(charges).reduce((s, m) => s + m, 0)

  if (chargement) return <div className="empty-state"><p>Chargement de l'emploi du temps…</p></div>
  if (erreur) return (
    <div className="empty-state">
      <div className="empty-icon">🛠️</div>
      <p>{erreur}</p>
    </div>
  )

  return (
    <>
      <div className="section-head">
        <div className="section-title">Qui enseigne quoi</div>
        <span style={{ fontSize: 12, fontWeight: 800, color: faites === total ? 'var(--green)' : 'var(--amber)' }}>
          {faites} / {total} affectées
        </span>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--muted)' }}>
        {heuresLisibles(minutesAffectees)} couvertes sur {heuresLisibles(minutesTotales)} à assurer chaque semaine.
        Une matière n'a qu'un seul enseignant sur toute l'année.
      </div>

      {/* Charge de chaque enseignant, confrontée aux repères du document */}
      {Object.keys(charges).length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ background: '#0d2a3b', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
            Charge hebdomadaire
          </div>
          {profs.filter(p => charges[p.id]).map(p => {
            const vise = CHARGES_DOCUMENT[p.prenom]
            // L'écart se lit en heures et minutes comme le reste : « -14 h 30 »
            // et non « -14.5 h », qui oblige à convertir de tête.
            const ecartMin = vise != null ? charges[p.id] - vise * 60 : null
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.prenom} {p.nom}</div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{heuresLisibles(charges[p.id])}</div>
                {ecartMin !== null && (
                  <div style={{ fontSize: 11, width: 104, textAlign: 'right', color: ecartMin === 0 ? 'var(--green)' : 'var(--amber)' }}>
                    {ecartMin === 0
                      ? `conforme (${vise} h)`
                      : `${ecartMin > 0 ? '+' : '−'}${heuresLisibles(Math.abs(ecartMin))} / ${vise} h`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {ORDRE_GROUPES.map(groupe => {
        const lignes = affectations.filter(a => a.groupe === groupe)
        if (!lignes.length) return null
        const ouvert = groupeOuvert === groupe
        const faitesG = lignes.filter(a => a.prof_id).length
        return (
          <div key={groupe} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
            <div onClick={() => setGroupeOuvert(ouvert ? null : groupe)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer', background: ouvert ? 'rgba(26,175,224,.05)' : 'transparent' }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{groupe}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: faitesG === lignes.length ? 'var(--green)' : 'var(--muted)' }}>
                  {faitesG}/{lignes.length}
                </span>
                <span style={{ color: 'var(--muted)', transform: ouvert ? 'rotate(180deg)' : 'none', transition: '.2s' }}>⌄</span>
              </div>
            </div>
            {ouvert && lignes.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 130 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{l.matiere}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {heuresLisibles(volumes[`${l.groupe}|${l.matiere}`] || 0)} par semaine
                  </div>
                </div>
                <select
                  value={l.prof_id || ''}
                  onChange={e => affecter(l, e.target.value)}
                  style={{
                    minWidth: 170, padding: '7px 10px', borderRadius: 8, fontSize: 13,
                    border: '1.5px solid ' + (l.prof_id ? 'var(--green)' : 'var(--border)'),
                    background: 'var(--bg)',
                  }}>
                  <option value="">— à affecter —</option>
                  {profs.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                </select>
              </div>
            ))}
          </div>
        )
      })}

      {/* Le document nomme sept enseignants ; la base n'en connaît pas toujours
          autant. Le dire évite de chercher longtemps un nom absent de la liste. */}
      {(() => {
        const connus = profs.map(p => p.prenom.toLowerCase())
        const manquants = Object.keys(CHARGES_DOCUMENT).filter(n => !connus.includes(n.toLowerCase()))
        if (!manquants.length) return null
        return (
          <div style={{ background: 'rgba(247,148,29,.08)', border: '1px solid rgba(247,148,29,.35)', borderRadius: 12, padding: '12px 14px', fontSize: 12, marginTop: 6 }}>
            <b>{manquants.join(', ')}</b> {manquants.length > 1 ? 'sont nommés' : 'est nommé'} dans l'emploi du temps
            mais {manquants.length > 1 ? 'n\'ont' : 'n\'a'} pas de compte sur la plateforme.
            {' '}Créez-{manquants.length > 1 ? 'les' : 'le'} depuis l'onglet Équipe pour pouvoir {manquants.length > 1 ? 'les affecter' : 'l\'affecter'}.
          </div>
        )
      })()}
    </>
  )
}
