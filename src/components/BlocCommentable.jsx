import { useState } from 'react'

// Une rubrique de préparation, et les remarques qui la concernent.
//
// Le même bloc sert des deux côtés : la direction peut y ajouter une remarque,
// l'enseignante la lit au même endroit. Un seul composant, donc un seul
// alignement possible entre ce qui est écrit et ce qui est lu.
//
// La remarque s'affiche SOUS le contenu qu'elle vise, jamais en note de bas de
// page ni dans un panneau latéral : c'est ce rattachement visuel qui remplace
// la phrase « au niveau de la découverte… » que l'enseignante devait décoder.

const dateCourte = iso => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('fr-FR',
      { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function BlocCommentable({
  label,
  remarques = [],
  onAjouter = null,       // absent : lecture seule
  children,
  compact = false,
}) {
  const [ouvert, setOuvert] = useState(false)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const aDesRemarques = remarques.length > 0
  const ouvertes = remarques.filter(r => !r.traitee).length

  const enregistrer = async () => {
    const propre = texte.trim()
    if (!propre || envoi) return
    setEnvoi(true)
    try {
      await onAjouter(propre)
      setTexte('')
      setOuvert(false)
    } finally { setEnvoi(false) }
  }

  return (
    <div style={{
      border: '1px solid ' + (ouvertes ? '#f59e0b' : 'var(--border)'),
      borderLeft: ouvertes ? '4px solid #b45309' : '1px solid var(--border)',
      borderRadius: 13, padding: compact ? '11px 12px' : '13px 14px',
      background: 'var(--bg)',
      // Sans lui, un mot long dans une remarque pousse la colonne hors de
      // l'écran sur un téléphone.
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {label}
        </div>
        {ouvertes > 0 && (
          <span style={{ fontSize: 10, fontWeight: 800, color: '#b45309', background: '#fffbeb',
                         border: '1px solid #fde68a', borderRadius: 20, padding: '2px 8px', flex: 'none' }}>
            ⚠ correction demandée
          </span>
        )}
      </div>

      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, fontSize: 13, marginTop: 5, overflowWrap: 'anywhere' }}>
        {children}
      </div>

      {/* Les remarques, sous le contenu qu'elles visent. */}
      {aDesRemarques && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
          {remarques.map((r, k) => (
            <div key={k} style={{
              background: r.traitee ? 'var(--card)' : '#fffbeb',
              border: '1px solid ' + (r.traitee ? 'var(--border)' : '#fde68a'),
              borderRadius: 9, padding: '9px 11px',
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: r.traitee ? 'var(--muted)' : '#92400e' }}>
                {r.traitee ? '✓ Traitée · ' : '⚠ Correction demandée · '}
                {r.parNom || 'Direction'}{r.parFonction ? ` (${r.parFonction})` : ''}
                {r.le ? ` · ${dateCourte(r.le)}` : ''}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {r.texte}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* L'ajout, seulement pour qui en a le droit. */}
      {onAjouter && !ouvert && (
        <button onClick={() => setOuvert(true)} style={{
          marginTop: 9, background: 'none', border: '1px dashed var(--border)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700,
          color: 'var(--muted)', cursor: 'pointer', width: '100%',
          // Pleine largeur et 36 px de haut : utilisable au pouce.
          minHeight: 36,
        }}>+ Ajouter une remarque</button>
      )}

      {onAjouter && ouvert && (
        <div style={{ marginTop: 9 }}>
          <textarea
            className="form-input"
            rows={3}
            autoFocus
            value={texte}
            onChange={e => setTexte(e.target.value)}
            placeholder={`Ce qui doit être corrigé dans « ${label} »…`}
            style={{ width: '100%', fontSize: 13 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
            <button className="btn-sm" onClick={enregistrer} disabled={!texte.trim() || envoi}
              style={{ background: '#b45309', color: '#fff', flex: '1 1 140px', minHeight: 36 }}>
              {envoi ? 'Enregistrement…' : 'Enregistrer la remarque'}
            </button>
            <button className="btn-sm" onClick={() => { setOuvert(false); setTexte('') }}
              style={{ flex: '1 1 100px', minHeight: 36 }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
