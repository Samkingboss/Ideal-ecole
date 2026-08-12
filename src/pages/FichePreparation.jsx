import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SEQUENCES, DUREE_SEQUENCE } from '../lib/sequences'

// Fiche de préparation d'une séance.
//
// Structure reprise du plan de séance international (objectif → prérequis →
// déroulement en temps → différenciation → vérification), resserrée sur une
// séquence de 30 minutes : au-delà de six ou sept champs, une fiche cesse
// d'être remplie honnêtement et devient une formalité.
//
// Le déroulement est minuté et sa somme est contrôlée : c'est le champ qui
// distingue une vraie préparation d'une intention.

export const RUBRIQUES = [
  { id: 'objectif', label: "Objectif de la séance", obligatoire: true, lignes: 2,
    aide: "Ce que l'élève saura faire à la fin. Un verbe d'action : reconnaître, écrire, calculer…" },
  { id: 'prerequis', label: 'Prérequis', lignes: 2,
    aide: 'Ce qui doit déjà être acquis pour suivre cette séance.' },
  { id: 'materiel', label: 'Matériel et supports', lignes: 2,
    aide: 'Manuel, ardoises, images, objets à manipuler…' },
  { id: 'differenciation', label: 'Différenciation', lignes: 3,
    aide: "Ce que je prévois pour l'élève en difficulté, et pour celui qui va vite." },
  { id: 'evaluation', label: "Comment je vérifie que c'est acquis", obligatoire: true, lignes: 2,
    aide: "La question, l'exercice ou l'observation qui me le dira avant la fin de la séance." },
  { id: 'trace', label: 'Trace écrite et devoir', lignes: 2,
    aide: "Ce que l'élève garde dans son cahier, ce qu'il emporte à la maison." },
]

// Déroulement type d'une séquence de 30 minutes.
export const ETAPES = [
  { id: 'mise_en_route', label: 'Mise en route', minutes: 5, aide: 'Rappel, mise en situation, annonce de l’objectif.' },
  { id: 'decouverte', label: 'Découverte / explication', minutes: 10, aide: 'Le cœur de la notion, montrée ou construite avec la classe.' },
  { id: 'pratique', label: 'Pratique guidée', minutes: 10, aide: 'Les élèves s’exercent, je circule et je corrige.' },
  { id: 'cloture', label: 'Clôture', minutes: 5, aide: 'Ce qu’on retient, vérification rapide.' },
]

const vide = () => ({
  ...Object.fromEntries(RUBRIQUES.map(r => [r.id, ''])),
  etapes: Object.fromEntries(ETAPES.map(e => [e.id, { minutes: e.minutes, texte: '' }])),
})

const horaireDe = seq => {
  const s = SEQUENCES.find(x => x.n === seq)
  if (!s) return '08:00'
  return `${String(Math.floor(s.debut / 60)).padStart(2, '0')}:${String(s.debut % 60).padStart(2, '0')}`
}

const dateLisible = iso =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default function FichePreparation({ user, creneau, dateCours, onFerme, onEnregistre }) {
  const [fiche, setFiche] = useState(vide())
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState(null)
  const [existante, setExistante] = useState(null)

  const heure = horaireDe(creneau.sequence)

  useEffect(() => {
    let annule = false
    ;(async () => {
      const { data, error } = await supabase.from('preparations')
        .select('id, contenu, heure_depot')
        .eq('user_id', user.id).eq('date_cours', dateCours).eq('sequence', creneau.sequence)
        .maybeSingle()
      if (annule || error) return
      if (data) {
        setExistante(data)
        if (data.contenu) setFiche({ ...vide(), ...data.contenu })
      }
    })()
    return () => { annule = true }
  }, [user.id, dateCours, creneau.sequence])

  const majEtape = (id, champ, valeur) => setFiche(f => ({
    ...f, etapes: { ...f.etapes, [id]: { ...f.etapes[id], [champ]: valeur } },
  }))

  const totalMinutes = ETAPES.reduce((s, e) => s + Number(fiche.etapes[e.id]?.minutes || 0), 0)
  const manquants = RUBRIQUES.filter(r => r.obligatoire && !String(fiche[r.id] || '').trim())

  async function enregistrer() {
    if (manquants.length) {
      setMessage({ type: 'err', texte: 'À renseigner : ' + manquants.map(m => m.label.toLowerCase()).join(', ') + '.' })
      return
    }
    setEnCours(true); setMessage(null)

    const ligne = {
      user_id: user.id,
      classe_id: creneau.classe_id || null,
      date_cours: dateCours,
      heure_cours: heure + ':00',
      matiere: creneau.matiere,
      groupe: creneau.groupe,
      sequence: creneau.sequence,
      contenu: fiche,
      heure_depot: new Date().toISOString(),
      status: 'depose',
    }
    // On corrige la fiche existante plutôt que d'en créer une seconde, qui
    // compterait deux fois dans les points.
    const req = existante
      ? supabase.from('preparations').update(ligne).eq('id', existante.id)
      : supabase.from('preparations').insert(ligne)
    const { error } = await req
    setEnCours(false)
    if (error) { setMessage({ type: 'err', texte: 'Enregistrement refusé : ' + error.message }); return }
    setMessage({ type: 'ok', texte: 'Préparation enregistrée.' })
    onEnregistre && onEnregistre()
  }

  function imprimer() {
    const w = window.open('', '_blank')
    if (!w) return
    const bloc = (titre, texte) => texte
      ? `<div class="b"><div class="t">${titre}</div><div class="c">${String(texte).replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div></div>` : ''
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
        table{width:100%;border-collapse:collapse;font-size:11pt;margin-top:4px}
        th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#0d2a3b;color:#fff;font-size:9pt;text-transform:uppercase}
        .sig{margin-top:26px;display:flex;justify-content:space-between;font-size:10pt;color:#475569}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>Fiche de préparation</h1>
      <div class="sub">École Internationale Bilingue IDEAL · Bamako</div>
      <div class="meta">
        <div><b>Matière :</b> ${creneau.matiere}</div><div><b>Classe :</b> ${creneau.groupe}</div>
        <div><b>Date :</b> ${dateLisible(dateCours)}</div><div><b>Séquence :</b> S${creneau.sequence} — ${heure} (${DUREE_SEQUENCE} min)</div>
        <div><b>Enseignant :</b> ${[user.prenom, user.nom].filter(Boolean).join(' ')}</div>
      </div>
      ${bloc("Objectif de la séance", fiche.objectif)}
      ${bloc('Prérequis', fiche.prerequis)}
      ${bloc('Matériel et supports', fiche.materiel)}
      <div class="b"><div class="t">Déroulement</div>
        <table><thead><tr><th style="width:32%">Étape</th><th style="width:12%">Durée</th><th>Ce que je fais, ce que font les élèves</th></tr></thead><tbody>
        ${ETAPES.map(e => `<tr><td><b>${e.label}</b></td><td>${fiche.etapes[e.id]?.minutes || 0} min</td>
           <td>${String(fiche.etapes[e.id]?.texte || '').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</td></tr>`).join('')}
        </tbody></table></div>
      ${bloc('Différenciation', fiche.differenciation)}
      ${bloc("Comment je vérifie que c'est acquis", fiche.evaluation)}
      ${bloc('Trace écrite et devoir', fiche.trace)}
      <div class="sig"><div>Signature de l'enseignant</div><div>Visa de la direction</div></div>
      </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  function telecharger() {
    const l = []
    l.push(`FICHE DE PRÉPARATION — École IDEAL`, '')
    l.push(`Matière   : ${creneau.matiere}`, `Classe    : ${creneau.groupe}`)
    l.push(`Date      : ${dateLisible(dateCours)}`, `Séquence  : S${creneau.sequence} — ${heure} (${DUREE_SEQUENCE} min)`)
    l.push(`Enseignant: ${[user.prenom, user.nom].filter(Boolean).join(' ')}`, '')
    RUBRIQUES.slice(0, 3).forEach(r => { if (fiche[r.id]) l.push(r.label.toUpperCase(), fiche[r.id], '') })
    l.push('DÉROULEMENT')
    ETAPES.forEach(e => l.push(`  ${e.label} (${fiche.etapes[e.id]?.minutes || 0} min) : ${fiche.etapes[e.id]?.texte || ''}`))
    l.push('')
    RUBRIQUES.slice(3).forEach(r => { if (fiche[r.id]) l.push(r.label.toUpperCase(), fiche[r.id], '') })
    const net = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([l.join('\n')], { type: 'text/plain;charset=utf-8' }))
    a.download = `preparation-${net(creneau.matiere)}-${net(creneau.groupe)}-${dateCours}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  const champ = { width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,24,.94)', zIndex: 9000, overflowY: 'auto', padding: '18px 12px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', background: 'var(--bg)', borderRadius: 16, padding: '18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{creneau.matiere} — {creneau.groupe}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {dateLisible(dateCours)} · S{creneau.sequence} à {heure.replace(':', 'h')} ({DUREE_SEQUENCE} min)
            </div>
          </div>
          <button className="btn-sm" onClick={onFerme}>Fermer</button>
        </div>

        {existante && (
          <div style={{ background: 'rgba(46,158,79,.10)', border: '1px solid rgba(46,158,79,.35)', borderRadius: 10, padding: '8px 12px', fontSize: 12, marginTop: 12 }}>
            Séance déjà préparée. Vos modifications corrigeront la fiche existante.
          </div>
        )}

        {RUBRIQUES.slice(0, 3).map(r => (
          <label key={r.id} style={{ display: 'block', marginTop: 12, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            {r.label}{r.obligatoire && <span style={{ color: 'var(--red)' }}> *</span>}
            <textarea rows={r.lignes} value={fiche[r.id]} placeholder={r.aide}
              onChange={e => setFiche({ ...fiche, [r.id]: e.target.value })} style={champ} />
          </label>
        ))}

        <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>DÉROULEMENT</span>
          <span style={{ color: totalMinutes === DUREE_SEQUENCE ? 'var(--green)' : 'var(--amber)' }}>
            {totalMinutes} min sur {DUREE_SEQUENCE}
          </span>
        </div>
        {ETAPES.map(e => (
          <div key={e.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{e.label}</div>
              <input type="number" min="0" max="30" value={fiche.etapes[e.id]?.minutes ?? 0}
                onChange={ev => majEtape(e.id, 'minutes', Math.max(0, Math.min(30, Number(ev.target.value) || 0)))}
                style={{ width: 58, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', textAlign: 'center', fontWeight: 700 }} />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>min</span>
            </div>
            <textarea rows={2} value={fiche.etapes[e.id]?.texte || ''} placeholder={e.aide}
              onChange={ev => majEtape(e.id, 'texte', ev.target.value)} style={{ ...champ, marginTop: 6 }} />
          </div>
        ))}

        {RUBRIQUES.slice(3).map(r => (
          <label key={r.id} style={{ display: 'block', marginTop: 12, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
            {r.label}{r.obligatoire && <span style={{ color: 'var(--red)' }}> *</span>}
            <textarea rows={r.lignes} value={fiche[r.id]} placeholder={r.aide}
              onChange={e => setFiche({ ...fiche, [r.id]: e.target.value })} style={champ} />
          </label>
        ))}

        {message && (
          <div style={{
            marginTop: 12, padding: '9px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: message.type === 'ok' ? 'rgba(46,158,79,.10)' : 'rgba(220,53,69,.10)',
            color: message.type === 'ok' ? 'var(--green)' : 'var(--red)',
          }}>{message.texte}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={enregistrer} disabled={enCours}
            style={{ flex: 2, minWidth: 180, padding: 12, borderRadius: 12, fontWeight: 800 }}>
            {enCours ? 'Enregistrement…' : (existante ? 'Enregistrer les modifications' : 'Valider la préparation')}
          </button>
          <button className="btn-sm" onClick={imprimer} style={{ flex: 1, minWidth: 90 }}>🖨️ Imprimer</button>
          <button className="btn-sm" onClick={telecharger} style={{ flex: 1, minWidth: 110 }}>⬇️ Télécharger</button>
        </div>
      </div>
    </div>
  )
}
