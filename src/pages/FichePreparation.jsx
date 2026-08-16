import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { SEQUENCES, DUREE_SEQUENCE } from '../lib/sequences'
import { manuelPour, avancement, leconParNumero, leconsDe, aDesUnites, pagesDe, situationDe } from '../lib/programmes'

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

const dateLisible = iso =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

// ─── Composant ───────────────────────────────────────────────────────────────

export default function FichePreparation({
  user, creneau, dateCours,
  lectureSeule = false,
  onFerme, onEnregistre,
}) {
  const [fiche, setFiche]         = useState(vide())
  const [enCours, setEnCours]     = useState(false)
  const [message, setMessage]     = useState(null)
  // existantes : liste des rows déjà en base pour cette notion (une par séquence)
  const [existantes, setExistantes] = useState([])
  // avancement du manuel avant ce cours (null tant qu'il n'est pas connu)
  const [avant, setAvant]         = useState(null)

  // La matière suit-elle un manuel ? Le couple (groupe, matière) suffit à le dire.
  const manuel = manuelPour(creneau.groupe, creneau.matiere)

  // ── Chargement ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let annule = false
    ;(async () => {
      const { data, error } = await supabase
        .from('preparations')
        .select('id, contenu, heure_depot, sequence')
        .eq('user_id', user.id)
        .eq('date_cours', dateCours)
        .eq('sequence', creneau.sequence)
        .maybeSingle()

      if (annule || error) return
      if (!data) return

      const contenu = migrer(data.contenu)
      setFiche(contenu)

      const nb = contenu.nb_sequences || 1
      if (nb > 1) {
        const numeros = Array.from({ length: nb }, (_, i) => creneau.sequence + i)
        const { data: all } = await supabase
          .from('preparations')
          .select('id, sequence')
          .eq('user_id', user.id)
          .eq('date_cours', dateCours)
          .in('sequence', numeros)
        if (!annule && all) setExistantes(all)
      } else {
        setExistantes([data])
      }
    })()
    return () => { annule = true }
  }, [user.id, dateCours, creneau.sequence])

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
      if (!annule) setAvant(avancement(manuel, data || []))
    })()
    return () => { annule = true }
  }, [manuel?.cle, creneau.groupe, creneau.matiere, dateCours])

  // Proposition par défaut : la leçon suivante du livre, tant que l'enseignant
  // n'a rien choisi lui-même. Il reste libre de revenir en arrière.
  useEffect(() => {
    if (!manuel || !avant || fiche.programme) return
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
            // Référence imprimée du livre (« 9.2 » chez Cambridge), pour que la
            // fiche imprimée cite le repère que la classe emploie.
            ...(l.code ? { code: l.code } : {}),
          }
        : null,
    }))
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

    for (let i = 0; i < nb; i++) {
      const seqNum = creneau.sequence + i
      const h = horaireDe(seqNum) ?? horaireDe(creneau.sequence) ?? '08:00'

      const ligne = {
        user_id:    user.id,
        classe_id:  creneau.classe_id || null,
        date_cours: dateCours,
        heure_cours: h + ':00',
        matiere:    creneau.matiere,
        groupe:     creneau.groupe,
        sequence:   seqNum,
        contenu:    { ...fiche, _seq_index: i },
        heure_depot: maintenant,
        status:     'depose',
      }

      const ex  = existantes.find(e => e.sequence === seqNum)
      const req = ex
        ? supabase.from('preparations').update(ligne).eq('id', ex.id)
        : supabase.from('preparations').insert(ligne)

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
      await supabase.from('preparations').delete().in('id', enTrop.map(e => e.id))
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
      .select('id, sequence')
      .eq('user_id', user.id)
      .eq('date_cours', dateCours)
      .gte('sequence', creneau.sequence)
      .lt('sequence', creneau.sequence + 6)
      .order('sequence')

    setExistantes(apres || [])

    const survivantes = (apres || []).filter(e => e.sequence >= creneau.sequence + nb)

    setEnCours(false)
    setMessage(survivantes.length
      ? { type: 'err', texte: `Enregistré, mais ${survivantes.length} séquence(s) de l'ancienne durée n'ont pas pu être supprimées. Signalez-le à la direction.` }
      : { type: 'ok', texte: nb > 1 ? `${nb} séquences enregistrées ✓` : 'Préparation enregistrée ✓' })
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
      const h = horaireDe(seqNum) ?? ''
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
      <div class="sub">École Internationale Bilingue IDEAL · Bamako</div>
      <div class="meta">
        <div><b>Matière :</b> ${creneau.matiere}</div><div><b>Classe :</b> ${creneau.groupe}</div>
        <div><b>Date :</b> ${dateLisible(dateCours)}</div>
        <div><b>Durée :</b> ${nb} séquence${nb > 1 ? 's' : ''} × ${DUREE_SEQUENCE} min = ${nb * DUREE_SEQUENCE} min</div>
        <div><b>Enseignant :</b> ${[user.prenom, user.nom].filter(Boolean).join(' ')}</div>
        ${fiche.programme ? `<div style="grid-column:1/-1"><b>Manuel :</b> ${esc(manuel?.titre || '')} — ${esc(fiche.programme.titre)} · ${situationDe(manuel, fiche.programme)}</div>` : ''}
      </div>
      ${bloc('Objectif de la notion', fiche.objectif)}
      ${bloc('Prérequis', fiche.prerequis)}
      ${bloc('Matériel et supports', fiche.materiel)}
      ${blocsSeq}
      ${bloc('Différenciation', fiche.differenciation)}
      ${bloc("Comment je vérifie que c'est acquis", fiche.evaluation)}
      ${bloc('Trace écrite et devoir', fiche.trace)}
      <div class="sig"><div>Signature de l'enseignant</div><div>Visa de la direction</div></div>
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
      {l.titre} — {pagesDe(l)}
    </option>
  )

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
              {horaireDe(creneau.sequence) ? ` · ${heureAff(creneau.sequence)}` : ''}
            </div>
          </div>
          <button className="btn-sm" onClick={onFerme}>Fermer</button>
        </div>

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
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{manuel.titre}</div>

            {fiche.programme && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{fiche.programme.titre}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {situationDe(manuel, fiche.programme)}
                </div>
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
                        <optgroup key={u.numero} label={`Unité ${u.numero} — ${u.titre}`}>
                          {u.lecons.map(optionLecon)}
                        </optgroup>
                      ))
                    : leconsDe(manuel).map(optionLecon)}
                </select>

                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                  {avant === null
                    ? 'Lecture de l’avancement du manuel…'
                    : avant.courante
                      ? <>Déjà traité jusqu’à <b>{avant.courante.titre}</b> ({pagesDe(avant.courante)}). Les entrées cochées ✓ ont déjà été préparées ; vous pouvez y revenir.</>
                      : <>Premier cours du manuel : le programme commence à <b>{leconsDe(manuel)[0].titre}</b> ({pagesDe(leconsDe(manuel)[0])}).</>}
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
          </label>
        ))}

        {/* ── Blocs de déroulement — un par séquence ── */}
        {seqs.map((seq, idx) => {
          const totalSeq = ETAPES.reduce((s, e) => s + Number(seq.etapes?.[e.id]?.minutes || 0), 0)
          const seqNum   = creneau.sequence + idx
          const h        = heureAff(seqNum)

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
          </label>
        ))}

        {/* ── Message ── */}
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
                ? 'Enregistrement…'
                : estDejaPreparee
                  ? 'Enregistrer les modifications'
                  : nb > 1
                    ? `Valider les ${nb} séquences`
                    : 'Valider la préparation'
              }
            </button>
          )}
          <button className="btn-sm" onClick={imprimer} style={{ flex: 1, minWidth: 90 }}>🖨️ Imprimer</button>
          <button className="btn-sm" onClick={telecharger} style={{ flex: 1, minWidth: 110 }}>⬇️ Télécharger</button>
        </div>

      </div>
    </div>
  )
}
