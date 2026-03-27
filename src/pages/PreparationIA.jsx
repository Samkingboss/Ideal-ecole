import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── Constantes ─────────────────────────────────────────────────
const CRITERES = [
    { id: 'structure', label: 'Structure & organisation', max: 4 },
    { id: 'objectifs', label: 'Clarté des objectifs', max: 4 },
    { id: 'contenu', label: 'Qualité du contenu', max: 4 },
    { id: 'methodes', label: 'Méthodes & activités', max: 4 },
    { id: 'evaluation', label: 'Évaluation prévue', max: 4 },
]

const getBadge = (note) => {
    if (note >= 18) return { label: 'Excellent', color: '#16a34a', bg: 'rgba(22,163,74,.1)', icon: '🏆' }
    if (note >= 15) return { label: 'Très bien', color: '#2563eb', bg: 'rgba(37,99,235,.1)', icon: '⭐' }
    if (note >= 12) return { label: 'Bien', color: '#1AAFE0', bg: 'rgba(26,175,224,.1)', icon: '👍' }
    if (note >= 10) return { label: 'Assez bien', color: '#F7941D', bg: 'rgba(247,148,29,.1)', icon: '📝' }
    return { label: 'À améliorer', color: '#ED1C24', bg: 'rgba(237,28,36,.1)', icon: '⚠️' }
}

const verifierDelai = (dateStr, heureStr) => {
    if (!dateStr || !heureStr) return { ok: true, retardMinutes: 0 }
    const heureCours = new Date(`${dateStr}T${heureStr}:00`)
    const limiteEnvoi = new Date(heureCours.getTime() - 10 * 60 * 60 * 1000)
    const retardMs = new Date() - limiteEnvoi
    return { ok: retardMs <= 0, retardMinutes: Math.max(0, Math.floor(retardMs / 60000)) }
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
})

// ── Composant principal ────────────────────────────────────────
export default function PreparationIA({ user }) {
    const [vue, setVue] = useState('liste')
    const [preparations, setPreparations] = useState([])
    const [classes, setClasses] = useState([])
    const [form, setForm] = useState({
        classe_id: '',
        matiere: '',
        date_cours: new Date().toISOString().slice(0, 10),
        heure_cours: '08:00',
        fichier: null,
    })
    const [resultat, setResultat] = useState(null)
    const [loading, setLoading] = useState(false)
    const [erreur, setErreur] = useState('')
    const [delai, setDelai] = useState({ ok: true, retardMinutes: 0 })

    useEffect(() => { chargerDonnees() }, [])

    useEffect(() => {
        const check = () => setDelai(verifierDelai(form.date_cours, form.heure_cours))
        check()
        const timer = setInterval(check, 60000)
        return () => clearInterval(timer)
    }, [form.date_cours, form.heure_cours])

    const chargerDonnees = async () => {
        const [{ data: cl }, { data: prep }] = await Promise.all([
            supabase.from('classes').select('*').order('ordre'),
            supabase.from('preparations')
                .select('*, classes(nom)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(30),
        ])
        setClasses(cl || [])
        setPreparations(prep || [])
        if (cl?.length) setForm(f => ({ ...f, classe_id: cl[0].id }))
    }

    const soumettre = async () => {
        setErreur('')
        if (!form.fichier) { setErreur('Joignez un fichier PDF ou une image.'); return }
        if (!form.matiere.trim()) { setErreur('Indiquez la matière concernée.'); return }
        if (!form.classe_id) { setErreur('Sélectionnez une classe.'); return }

        const typesAcceptes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']
        if (!typesAcceptes.includes(form.fichier.type)) {
            setErreur('Type non supporté. Utilisez PDF, JPG ou PNG.')
            return
        }

        setLoading(true)
        try {
            // 1. Upload dans Supabase Storage
            const nomFichier = `${user.id}/${Date.now()}_${form.fichier.name.replace(/\s/g, '_')}`
            const { error: uploadErr } = await supabase.storage
                .from('documents')
                .upload(nomFichier, form.fichier, { upsert: false })
            if (uploadErr) throw new Error('Erreur upload : ' + uploadErr.message)

            const { data: { publicUrl } } = supabase.storage
                .from('documents').getPublicUrl(nomFichier)

            // 2. Conversion en base64
            const fileBase64 = await fileToBase64(form.fichier)
            const classe = classes.find(c => c.id === form.classe_id)

            // 3. Appel au serveur relais Netlify
            const response = await fetch('/.netlify/functions/analyze-prepa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileBase64,
                    fileType: form.fichier.type,
                    matiere: form.matiere,
                    classe: classe?.nom || '',
                    langue: user.langue || 'fr',
                }),
            })

            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data.error || 'Correction IA échouée.')

            const { analyse } = data
            const { ok: dansLesDelais, retardMinutes } = verifierDelai(form.date_cours, form.heure_cours)

            // 4. Sauvegarde dans Supabase
            await supabase.from('preparations').insert({
                user_id: user.id,
                classe_id: form.classe_id,
                matiere: form.matiere,
                date_cours: form.date_cours,
                heure_cours: form.heure_cours,
                url_doc: publicUrl,
                note_ia: analyse.total,
                commentaire_ia: analyse.commentaire_general,
                notes_criteres: analyse.notes,
                points_forts: analyse.points_forts,
                points_amelioration: analyse.points_amelioration,
                conseil: analyse.conseil_prioritaire,
                status: dansLesDelais ? 'valide' : 'retard',
                retard_minutes: retardMinutes,
            })

            setResultat({ ...analyse, classe: classe?.nom, matiere: form.matiere, dansLesDelais, retardMinutes })
            setVue('resultat')
            chargerDonnees()

        } catch (err) {
            setErreur('Erreur : ' + err.message)
        }
        setLoading(false)
    }

    // ── VUE RÉSULTAT ───────────────────────────────────────────
    if (vue === 'resultat' && resultat) {
        const badge = getBadge(resultat.total)
        return (
            <div style={{ padding: '1rem 1.2rem 3rem' }}>

                {!resultat.dansLesDelais && (
                    <div style={{ background: 'rgba(237,28,36,.08)', border: '1px solid rgba(237,28,36,.3)', borderRadius: 12, padding: '.8rem 1rem', marginBottom: '1rem', display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 20 }}>⏰</span>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#ED1C24' }}>Soumission hors délai</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                Retard de {resultat.retardMinutes} min par rapport à la limite H-10.
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ background: 'linear-gradient(135deg,#0d2a3b,#1565a0)', borderRadius: 18, padding: '2rem 1.5rem', marginBottom: '1rem', color: '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: 52 }}>{badge.icon}</div>
                    <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1 }}>{resultat.total}</div>
                    <div style={{ fontSize: 18, opacity: .6, marginBottom: 10 }}>/20</div>
                    <span style={{ background: badge.bg, color: badge.color, fontWeight: 700, fontSize: 14, padding: '5px 18px', borderRadius: 20, border: `1px solid ${badge.color}` }}>
                        {badge.label}
                    </span>
                    <div style={{ marginTop: 12, fontSize: 12, opacity: .5 }}>{resultat.matiere} — {resultat.classe}</div>
                </div>

                <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '1rem' }}>
                    <div style={{ background: '#0d2a3b', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Détail par critère
                    </div>
                    {CRITERES.map(crit => {
                        const note = resultat.notes?.[crit.id] ?? 0
                        const pct = (note / crit.max) * 100
                        const col = pct >= 75 ? '#8DC63F' : pct >= 50 ? '#F7941D' : '#ED1C24'
                        return (
                            <div key={crit.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{crit.label}</div>
                                    <div style={{ background: 'var(--bg)', borderRadius: 20, height: 6, marginTop: 5, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: pct + '%', background: col, borderRadius: 20, transition: 'width .6s' }} />
                                    </div>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: col, flexShrink: 0, minWidth: 36, textAlign: 'right' }}>
                                    {note}/{crit.max}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {resultat.points_forts?.length > 0 && (
                    <div style={{ background: 'rgba(141,198,63,.06)', border: '1px solid rgba(141,198,63,.3)', borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#8DC63F', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>✅ Points forts</div>
                        {resultat.points_forts.map((p, i) => (
                            <div key={i} style={{ fontSize: 13, padding: '5px 0', borderBottom: '1px solid rgba(141,198,63,.12)', display: 'flex', gap: 8 }}>
                                <span style={{ color: '#8DC63F', flexShrink: 0 }}>•</span><span>{p}</span>
                            </div>
                        ))}
                    </div>
                )}

                {resultat.points_amelioration?.length > 0 && (
                    <div style={{ background: 'rgba(247,148,29,.06)', border: '1px solid rgba(247,148,29,.3)', borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#F7941D', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>📝 À améliorer</div>
                        {resultat.points_amelioration.map((p, i) => (
                            <div key={i} style={{ fontSize: 13, padding: '5px 0', borderBottom: '1px solid rgba(247,148,29,.12)', display: 'flex', gap: 8 }}>
                                <span style={{ color: '#F7941D', flexShrink: 0 }}>•</span><span>{p}</span>
                            </div>
                        ))}
                    </div>
                )}

                {resultat.commentaire_general && (
                    <div style={{ background: 'rgba(26,175,224,.06)', border: '1px solid rgba(26,175,224,.2)', borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>💬 Commentaire</div>
                        <div style={{ fontSize: 13, lineHeight: 1.7 }}>{resultat.commentaire_general}</div>
                    </div>
                )}

                {resultat.conseil_prioritaire && (
                    <div style={{ background: 'linear-gradient(135deg,#0d2a3b,#1AAFE0)', borderRadius: 14, padding: '1rem', marginBottom: '1.5rem', color: '#fff' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, opacity: .7, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>🎯 Conseil prioritaire</div>
                        <div style={{ fontSize: 13, lineHeight: 1.7 }}>{resultat.conseil_prioritaire}</div>
                    </div>
                )}

                <button onClick={() => { setVue('liste'); setResultat(null); setForm(f => ({ ...f, fichier: null, matiere: '' })) }}
                    style={{ width: '100%', padding: '1rem', background: '#0d2a3b', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    ← Retour à mes préparations
                </button>
            </div>
        )
    }

    // ── VUE FORMULAIRE ─────────────────────────────────────────
    if (vue === 'formulaire') return (
        <div style={{ padding: '1rem 1.2rem 3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
                <button onClick={() => setVue('liste')} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>← Retour</button>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Soumettre une préparation</div>
            </div>

            {erreur && (
                <div style={{ background: 'rgba(237,28,36,.08)', border: '1px solid rgba(237,28,36,.2)', borderRadius: 10, padding: '.7rem 1rem', fontSize: 13, color: '#ED1C24', marginBottom: '1rem' }}>
                    {erreur}
                </div>
            )}

            <div style={{ background: delai.ok ? 'rgba(141,198,63,.08)' : 'rgba(237,28,36,.08)', border: `1px solid ${delai.ok ? 'rgba(141,198,63,.3)' : 'rgba(237,28,36,.3)'}`, borderRadius: 12, padding: '.8rem 1rem', marginBottom: '1rem', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 20 }}>{delai.ok ? '✅' : '⏰'}</span>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: delai.ok ? '#8DC63F' : '#ED1C24' }}>
                        {delai.ok ? 'Dans les délais' : 'Hors délai'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {delai.ok ? 'Soumission avant H-10 — préparation acceptée.' : `Retard de ${delai.retardMinutes} min — note pénalisée.`}
                    </div>
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Classe</label>
                <select className="form-select" value={form.classe_id} onChange={e => setForm({ ...form, classe_id: e.target.value })}>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
            </div>

            <div className="form-group">
                <label className="form-label">Matière</label>
                <input className="form-input" placeholder="Ex : Lecture, Mathématiques..." value={form.matiere} onChange={e => setForm({ ...form, matiere: e.target.value })} />
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Date du cours</label>
                    <input className="form-input" type="date" value={form.date_cours} onChange={e => setForm({ ...form, date_cours: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">Heure du cours</label>
                    <input className="form-input" type="time" value={form.heure_cours} onChange={e => setForm({ ...form, heure_cours: e.target.value })} />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Fichier de préparation</label>
                <div onClick={() => document.getElementById('prep-upload').click()}
                    style={{ border: '2px dashed var(--border)', borderRadius: 14, padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer', background: form.fichier ? 'rgba(141,198,63,.04)' : 'var(--bg)' }}>
                    {form.fichier ? (
                        <>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>{form.fichier.type === 'application/pdf' ? '📄' : '🖼️'}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#8DC63F' }}>{form.fichier.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{(form.fichier.size / 1024).toFixed(0)} KB — cliquez pour changer</div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Cliquez pour choisir un fichier</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>PDF, JPG, PNG acceptés</div>
                        </>
                    )}
                </div>
                <input id="prep-upload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                    onChange={e => setForm({ ...form, fichier: e.target.files[0] || null })} />
            </div>

            <button onClick={soumettre} disabled={loading}
                style={{ width: '100%', padding: '1rem', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', background: loading ? '#ccc' : 'linear-gradient(135deg,#0d2a3b,#1AAFE0)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {loading ? (
                    <>
                        <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        L'IA analyse votre préparation...
                    </>
                ) : <><span style={{ fontSize: 18 }}>✨</span> Envoyer pour correction IA</>}
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    )

    // ── VUE LISTE ──────────────────────────────────────────────
    return (
        <div style={{ padding: '1rem 1.2rem 3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>Mes préparations</div>
                <button onClick={() => setVue('formulaire')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    + Soumettre
                </button>
            </div>

            <div style={{ background: 'linear-gradient(135deg,#0d2a3b,#1565a0)', borderRadius: 14, padding: '1rem', marginBottom: '1rem', color: '#fff', display: 'flex', gap: 12 }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>🤖</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Correction automatique par IA</div>
                    <div style={{ fontSize: 11, opacity: .7, lineHeight: 1.5 }}>Soumettez vos préparations avant <b>H-10</b>. L'IA les note sur 20 et vous donne des conseils personnalisés.</div>
                </div>
            </div>

            {preparations.length > 0 && (() => {
                const notes = preparations.filter(p => p.note_ia !== null).map(p => p.note_ia)
                const moy = notes.length ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1) : '—'
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: '1rem' }}>
                        {[
                            { val: preparations.length, label: 'Soumissions', color: 'var(--accent)' },
                            { val: moy !== '—' ? moy + '/20' : '—', label: 'Moyenne', color: '#F7941D' },
                            { val: preparations.filter(p => p.status === 'valide').length, label: 'Dans les délais', color: '#8DC63F' },
                        ].map((s, i) => (
                            <div key={i} style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', padding: '.6rem', textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.val}</div>
                                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                )
            })()}

            {preparations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
                    <div style={{ fontSize: 48, marginBottom: '.5rem' }}>📚</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Aucune préparation soumise</div>
                    <button onClick={() => setVue('formulaire')} style={{ marginTop: '1rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Soumettre une préparation
                    </button>
                </div>
            ) : preparations.map(prep => {
                const badge = prep.note_ia !== null ? getBadge(prep.note_ia) : null
                const date = new Date(prep.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                return (
                    <div key={prep.id} style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', padding: '1rem', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 28, flexShrink: 0 }}>{prep.status === 'valide' ? '✅' : prep.status === 'retard' ? '⏰' : '⏳'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{prep.matiere}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                {prep.classes?.nom} · {date}
                                {prep.status === 'retard' && <span style={{ color: '#ED1C24', marginLeft: 6 }}>• Retard {prep.retard_minutes} min</span>}
                            </div>
                            {prep.commentaire_ia && (
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.4, paddingLeft: 8, borderLeft: '3px solid var(--accent)' }}>
                                    {prep.commentaire_ia.slice(0, 80)}...
                                </div>
                            )}
                        </div>
                        {badge && (
                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                <div style={{ fontSize: 20, fontWeight: 900, color: badge.color }}>{prep.note_ia}</div>
                                <div style={{ fontSize: 9, color: 'var(--muted)' }}>/20</div>
                                <span style={{ fontSize: 9, fontWeight: 700, background: badge.bg, color: badge.color, padding: '2px 6px', borderRadius: 20, display: 'block', marginTop: 4 }}>{badge.label}</span>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
