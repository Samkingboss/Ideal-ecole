import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const estMaternelle = nom => /^(ps|gs|petite section|grande section)$/i.test(String(nom || '').trim())

const sectionDe = nom => /^(ps|petite section)$/i.test(String(nom || '').trim()) ? 'PS' : 'GS'

const ageDe = date => {
  if (!date) return ''
  const naissance = new Date(`${date}T12:00:00`)
  if (Number.isNaN(naissance.getTime())) return ''
  const maintenant = new Date()
  let age = maintenant.getFullYear() - naissance.getFullYear()
  if (maintenant < new Date(maintenant.getFullYear(), naissance.getMonth(), naissance.getDate())) age -= 1
  return `${Math.max(0, age)} ans`
}

const anneeScolaire = () => {
  const maintenant = new Date()
  const debut = maintenant.getMonth() >= 7 ? maintenant.getFullYear() : maintenant.getFullYear() - 1
  return `${debut} - ${debut + 1}`
}

export default function BulletinMaternelleStudio({ user, eleves = [] }) {
  const iframeRef = useRef(null)
  const [bulletins, setBulletins] = useState([])
  const [etat, setEtat] = useState('chargement')
  const [message, setMessage] = useState('')

  const maternelle = useMemo(() => eleves.filter(e => estMaternelle(e.classes?.nom)), [eleves])

  useEffect(() => {
    let annule = false
    ;(async () => {
      if (!maternelle.length) { setBulletins([]); setEtat('pret'); return }
      const { data, error } = await supabase.rpc('lire_bulletins_maternelle', {
        p_eleve_ids: maternelle.map(e => e.id),
      })
      if (annule) return
      if (error) {
        console.error('lire_bulletins_maternelle', error)
        setMessage('La sauvegarde serveur des bulletins doit être installée avec le script SQL dédié.')
        setBulletins([])
      } else setBulletins(Array.isArray(data) ? data : [])
      setEtat('pret')
    })()
    return () => { annule = true }
  }, [maternelle])

  const donneesEleves = useMemo(() => {
    const effectifs = new Map()
    maternelle.forEach(e => effectifs.set(e.classe_id, (effectifs.get(e.classe_id) || 0) + 1))
    return maternelle.map(e => {
      const sauvegardes = bulletins.filter(b => String(b.eleve_id) === String(e.id))
      const donnees = Object.fromEntries(sauvegardes.map(b => [b.trimestre, b.donnees || {}]))
      return {
        id: e.id,
        name: `${e.prenom || ''} ${e.nom || ''}`.trim(),
        section: sectionDe(e.classes?.nom),
        academicYear: anneeScolaire(),
        age: ageDe(e.date_naissance),
        classSize: effectifs.get(e.classe_id) || 0,
        teacher: `${user?.prenom || ''} ${user?.nom || ''}`.trim(),
        headmaster: 'Direction IDEAL',
        photo: e.photo_url || '',
        evaluations: {
          t1: donnees.t1?.evaluations || {},
          t2: donnees.t2?.evaluations || {},
          t3: donnees.t3?.evaluations || {},
        },
        appreciations: {
          t1: donnees.t1?.appreciations || {},
          t2: donnees.t2?.appreciations || {},
          t3: donnees.t3?.appreciations || {},
        },
        badges: donnees.t1?.badges || donnees.t2?.badges || donnees.t3?.badges || [],
        totalHours: donnees.t1?.totalHours ?? donnees.t2?.totalHours ?? donnees.t3?.totalHours ?? 180,
        attendedHours: donnees.t1?.attendedHours ?? donnees.t2?.attendedHours ?? donnees.t3?.attendedHours ?? 180,
        missedHours: donnees.t1?.missedHours ?? donnees.t2?.missedHours ?? donnees.t3?.missedHours ?? 0,
      }
    })
  }, [maternelle, bulletins, user])

  const envoyer = useCallback(() => iframeRef.current?.contentWindow?.postMessage({
    type: 'ideal:bulletin:init', students: donneesEleves,
  }, window.location.origin), [donneesEleves])

  useEffect(() => {
    const recevoir = async event => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type === 'ideal:bulletin:ready') return envoyer()
      if (event.data?.type !== 'ideal:bulletin:save') return
      const { student, trimester } = event.data
      if (!maternelle.some(e => String(e.id) === String(student?.id))) return
      const donnees = {
        evaluations: student.evaluations?.[trimester] || {},
        appreciations: student.appreciations?.[trimester] || {},
        badges: student.badges || [],
        totalHours: Number(student.totalHours) || 0,
        attendedHours: Number(student.attendedHours) || 0,
        missedHours: Number(student.missedHours) || 0,
      }
      const { error } = await supabase.rpc('sauver_bulletin_maternelle', {
        p_eleve_id: student.id,
        p_trimestre: trimester,
        p_annee_scolaire: student.academicYear,
        p_donnees: donnees,
      })
      setMessage(error ? `Sauvegarde serveur impossible : ${error.message}` : 'Bulletin sauvegardé.')
      if (error) console.error('sauver_bulletin_maternelle', error)
    }
    window.addEventListener('message', recevoir)
    return () => window.removeEventListener('message', recevoir)
  }, [maternelle, envoyer])

  if (etat === 'chargement') return <div className="empty-state">Chargement des bulletins maternelle…</div>
  if (!maternelle.length) return <div className="empty-state">Aucun élève de Petite ou Grande Section dans vos classes affectées.</div>

  return <div style={{ minHeight: 'calc(100vh - 230px)', minWidth: 0 }}>
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ margin: 0, color: '#0d2a3b', fontSize: 20 }}>Évaluations et bulletins maternelle</h2>
      <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
        Évaluez les objectifs de Petite et Grande Section puis générez le bulletin, sans quitter IDEAL.
      </p>
    </div>
    {message && <div role="status" style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 10, background: message.includes('impossible') || message.includes('installée') ? '#fff7ed' : '#ecfdf5', color: '#0d2a3b', fontSize: 12, fontWeight: 800 }}>{message}</div>}
    <iframe
      ref={iframeRef}
      src="/bulletin-maternelle/index.html"
      title="Évaluation et bulletins maternelle"
      onLoad={envoyer}
      style={{ width: '100%', height: 'calc(100vh - 270px)', minHeight: 760, border: '1px solid var(--border)', borderRadius: 14, display: 'block', background: '#0f172a' }}
    />
  </div>
}
