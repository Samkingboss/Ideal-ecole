import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pushNotification } from '../lib/notifications'

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
  const [horaires, setHoraires] = useState([])
  const [presences, setPresences] = useState([])
  const [etat, setEtat] = useState('chargement')
  const [message, setMessage] = useState('')

  const maternelle = useMemo(() => eleves.filter(e => estMaternelle(e.classes?.nom)), [eleves])

  useEffect(() => {
    let annule = false
    ;(async () => {
      if (!maternelle.length) { setBulletins([]); setEtat('pret'); return }
      const [bulletinsRes, horairesRes, presencesRes] = await Promise.all([
        supabase.rpc('lire_bulletins_maternelle', { p_eleve_ids: maternelle.map(e => e.id) }),
        supabase.rpc('lire_pilotage_heures_pedagogiques'),
        supabase.from('presences_eleves').select('eleve_id,date_jour,statut').in('eleve_id', maternelle.map(e => e.id)),
      ])
      const { data, error } = bulletinsRes
      if (annule) return
      if (error) {
        console.error('lire_bulletins_maternelle', error)
        setMessage('La sauvegarde serveur des bulletins doit être installée avec le script SQL dédié.')
        setBulletins([])
      } else setBulletins(Array.isArray(data) ? data : [])
      setHoraires(Array.isArray(horairesRes.data) ? horairesRes.data : [])
      setPresences(Array.isArray(presencesRes.data) ? presencesRes.data : [])
      setEtat('pret')
    })()
    return () => { annule = true }
  }, [maternelle])

  const langueCompte = user?.langue === 'en' || String(user?.fonction || '').includes('-en-') ? 'en' : 'fr'
  const sectionTitulaire = langueCompte === 'fr' ? 'GS' : 'PS'

  const donneesEleves = useMemo(() => {
    const effectifs = new Map()
    maternelle.forEach(e => effectifs.set(e.classe_id, (effectifs.get(e.classe_id) || 0) + 1))
    return maternelle.map(e => {
      const sauvegardes = bulletins.filter(b => String(b.eleve_id) === String(e.id))
      const donnees = Object.fromEntries(sauvegardes.map(b => [b.trimestre, b.donnees || {}]))
      const fusion = trimestre => {
        const d = donnees[trimestre] || {}, contributions = d.contributions || {}
        const langueTitulaire = section === 'GS' ? 'fr' : 'en'
        return { ...d, evaluations:{ ...(contributions.fr?.evaluations || d.evaluations || {}), ...(contributions.en?.evaluations || {}) }, appreciations:{ teacher_fr:contributions.fr?.appreciation || '', teacher_en:contributions.en?.appreciation || '', teacher:[contributions.fr?.appreciation,contributions.en?.appreciation].filter(Boolean).join(' / '), ...(d.appreciations || {}) }, badges:contributions[langueTitulaire]?.badges || d.badges || [] }
      }
      const section = sectionDe(e.classes?.nom)
      const lignesHeures = horaires.filter(h => String(h.classe_id) === String(e.classe_id))
      const semaines = tri => lignesHeures.reduce((max,h) => Math.max(max, Number(h[`semaines_${tri}`]) || 0), 0)
      const hebdo = lignesHeures.reduce((s,h) => s + Number(h.heures_hebdo || 0), 0)
      const totalParTri = { t1:hebdo*semaines('t1'), t2:hebdo*semaines('t2'), t3:hebdo*semaines('t3') }
      const absencesParTri = presences.filter(p => String(p.eleve_id) === String(e.id) && p.statut !== 'present').reduce((acc,p) => {
        const mois = Number(String(p.date_jour).slice(5,7))
        const tri = mois >= 9 && mois <= 12 ? 't1' : mois >= 1 && mois <= 3 ? 't2' : 't3'
        acc[tri] += 1; return acc
      }, {t1:0,t2:0,t3:0})
      const manquees = tri => Math.min(totalParTri[tri] || 0, absencesParTri[tri] * (hebdo / 5))
      return {
        id: e.id,
        name: `${e.prenom || ''} ${e.nom || ''}`.trim(),
        section,
        canPrint: section === sectionTitulaire,
        academicYear: anneeScolaire(),
        age: ageDe(e.date_naissance),
        classSize: effectifs.get(e.classe_id) || 0,
        teacher: `${user?.prenom || ''} ${user?.nom || ''}`.trim(),
        headmaster: 'Direction IDEAL',
        photo: e.photo_url || '',
        evaluations: {
          t1: fusion('t1').evaluations,
          t2: fusion('t2').evaluations,
          t3: fusion('t3').evaluations,
        },
        appreciations: {
          t1: fusion('t1').appreciations,
          t2: fusion('t2').appreciations,
          t3: fusion('t3').appreciations,
        },
        badges: fusion('t1').badges || fusion('t2').badges || fusion('t3').badges || [],
        hoursByTrimester: {
          t1:{ total:totalParTri.t1, missed:manquees('t1'), attended:Math.max(0,totalParTri.t1-manquees('t1')) },
          t2:{ total:totalParTri.t2, missed:manquees('t2'), attended:Math.max(0,totalParTri.t2-manquees('t2')) },
          t3:{ total:totalParTri.t3, missed:manquees('t3'), attended:Math.max(0,totalParTri.t3-manquees('t3')) },
        },
      }
    })
  }, [maternelle, bulletins, horaires, presences, user, sectionTitulaire])

  const envoyer = useCallback(() => iframeRef.current?.contentWindow?.postMessage({
    type: 'ideal:bulletin:init', students: donneesEleves, editorLanguage:langueCompte,
  }, window.location.origin), [donneesEleves, langueCompte])

  useEffect(() => {
    const recevoir = async event => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type === 'ideal:bulletin:ready') return envoyer()
      if (event.data?.type === 'ideal:bulletin:submit') {
        const { student, trimester } = event.data
        if (!maternelle.some(e => String(e.id) === String(student?.id))) return
        const { error } = await supabase.rpc('soumettre_bulletin_maternelle', {
          p_eleve_id:student.id, p_trimestre:trimester, p_annee_scolaire:student.academicYear,
        })
        if (error) {
          setMessage(`Soumission impossible : ${error.message}`)
          console.error('soumettre_bulletin_maternelle', error)
          return
        }
        const notifie = await pushNotification('directeur', {
          titre:'📘 Bulletin maternelle à signer',
          message:`${student.name} · ${student.section} · ${trimester.toUpperCase()}`,
          type:'bulletin_maternelle', tabTarget:'maternelle', ref:student.id,
        })
        setMessage(notifie ? 'Bulletin soumis à la Direction pour signature.' : 'Bulletin soumis, mais la notification Direction doit être vérifiée.')
        return
      }
      if (event.data?.type !== 'ideal:bulletin:save') return
      const { student, trimester } = event.data
      if (!maternelle.some(e => String(e.id) === String(student?.id))) return
      const donnees = {
        evaluations: event.data.evaluations || {},
        appreciation: event.data.appreciation || '',
        badges: student.badges || [],
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
