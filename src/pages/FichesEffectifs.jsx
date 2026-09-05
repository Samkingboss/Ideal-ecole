import { useMemo, useState } from 'react'

const normaliserClasse = nom => {
  const brut = String(nom || '').trim()
  if (/^(maternelle\s*1|petite\s+section)$/i.test(brut)) return 'PS'
  if (/^(maternelle\s*2|grande\s+section)$/i.test(brut)) return 'GS'
  return brut.replace(/\s+bilingue\b/gi, '').replace(/\s{2,}/g, ' ').trim() || 'Non affecté'
}
const classeDe = (eleve, classes) => normaliserClasse(eleve.classe_nom || classes.find(c => String(c.id) === String(eleve.classe_id))?.nom)
const nomDe = eleve => `${eleve.nom || ''} ${eleve.prenom || ''}`.trim()
const genreDe = eleve => {
  const valeur = String(eleve.sexe || eleve.genre || '').trim().toLowerCase()
  if (['f', 'femme', 'féminin', 'feminin', 'fille'].includes(valeur)) return 'Fille'
  if (['m', 'homme', 'masculin', 'garçon', 'garcon'].includes(valeur)) return 'Garçon'
  return '—'
}
const ageDe = eleve => {
  const valeur = eleve.date_naissance
  if (!valeur) return '—'
  const texte = String(valeur).trim()
  const fr = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const naissance = fr ? new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1])) : new Date(texte)
  if (Number.isNaN(naissance.getTime())) return '—'
  const maintenant = new Date()
  let age = maintenant.getFullYear() - naissance.getFullYear()
  if (maintenant.getMonth() < naissance.getMonth() || (maintenant.getMonth() === naissance.getMonth() && maintenant.getDate() < naissance.getDate())) age -= 1
  return age >= 0 ? `${age} ans` : '—'
}

export default function FichesEffectifs({ eleves = [], classes = [], onCertificat, onCarte, apercuImpression = false }) {
  const [recherche, setRecherche] = useState('')
  const [classe, setClasse] = useState('toutes')
  const lignes = useMemo(() => eleves.map(e => ({ ...e, classeAffichee: classeDe(e, classes) }))
    .sort((a, b) => a.classeAffichee.localeCompare(b.classeAffichee, 'fr') || nomDe(a).localeCompare(nomDe(b), 'fr')), [eleves, classes])
  const nomsClasses = useMemo(() => [...new Set(lignes.map(e => e.classeAffichee))].sort((a, b) => a.localeCompare(b, 'fr')), [lignes])
  const effectifs = nomsClasses.map(nom => ({ nom, total: lignes.filter(e => e.classeAffichee === nom).length }))
  const maximum = effectifs.reduce((max, item) => item.total > (max?.total || 0) ? item : max, null)?.total || 0
  const visibles = lignes.filter(e => (classe === 'toutes' || e.classeAffichee === classe)
    && `${nomDe(e)} ${e.matricule || ''} ${e.classeAffichee}`.toLowerCase().includes(recherche.trim().toLowerCase()))

  return <section className={`effectifs-module ${apercuImpression ? 'print-preview' : ''}`}>
    <style>{`
      .effectifs-module{--blue:#174e72;--orange:#f28c28;color:#17364d}.effectifs-hero{background:linear-gradient(120deg,#123d5a,#174e72);color:#fff;border-radius:18px;padding:22px;box-shadow:0 12px 28px rgba(23,78,114,.2)}.effectifs-topline{display:flex;justify-content:space-between;align-items:center;gap:24px}
      .effectifs-brand{display:flex;align-items:center;gap:13px}.effectifs-logo{width:62px;height:53px;object-fit:contain;background:#fff;border-radius:10px;padding:4px;box-sizing:border-box}.effectifs-school{font-size:18px;font-weight:950;letter-spacing:.5px}.effectifs-school-sub{font-size:9px;font-weight:800;letter-spacing:1px;opacity:.78;margin-top:2px;white-space:nowrap}.effectifs-address{font-size:9px;opacity:.7;margin-top:3px}.effectifs-heading{margin-top:12px}.effectifs-description{margin:0;max-width:none;font-size:12px;line-height:1.5;opacity:.82;white-space:nowrap}.effectifs-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;min-width:min(100%,390px)}.effectifs-stat{background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.18);padding:10px 12px;border-radius:13px;min-width:0;overflow-wrap:anywhere}.effectifs-stat strong{font-size:22px;display:block;line-height:1.1}.effectifs-stat span{font-size:9px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;opacity:.82;display:block;line-height:1.25;white-space:normal;hyphens:auto}
      .effectifs-tools{display:grid;grid-template-columns:minmax(220px,1fr) minmax(180px,260px) auto;gap:10px;margin:16px 0}.effectifs-input{width:100%;box-sizing:border-box;border:1px solid #d6e0e7;border-radius:11px;background:#fff;padding:11px 13px;font:inherit;color:#17364d;outline:none}.effectifs-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(23,78,114,.1)}.effectifs-print{border:0;border-radius:11px;background:var(--orange);color:#fff;padding:0 18px;font-weight:850;cursor:pointer}
      .effectifs-classes{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px;margin-bottom:16px}.effectifs-classe{background:#fff;border:1px solid #dde5eb;border-radius:12px;padding:11px 13px;cursor:pointer;text-align:left;color:#17364d}.effectifs-classe.active{border-color:var(--orange);box-shadow:inset 0 0 0 1px var(--orange);background:#fffaf5}.effectifs-classe strong{font-size:18px;display:block}.effectifs-classe span{font-size:11px;color:#70808d;font-weight:750}
      .effectifs-table-wrap{background:#fff;border:1px solid #dce5eb;border-radius:16px;overflow:auto}.effectifs-table{width:100%;border-collapse:collapse;font-size:13px;min-width:720px}.effectifs-table th{background:#f2f6f8;padding:11px 14px;text-align:left;font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:#647784;border-bottom:2px solid #dce5eb}.effectifs-table td{padding:12px 14px;border-bottom:1px solid #e7edf1}.effectifs-table tbody tr:last-child td{border-bottom:0}.effectifs-name{font-weight:850}.effectifs-matricule{font-size:11px;color:#7a8994;margin-top:2px}.effectifs-chip{display:inline-block;background:#eaf2f6;color:#174e72;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800}.effectifs-action{border:0;border-radius:8px;padding:7px 9px;margin-left:5px;color:#fff;font-weight:800;cursor:pointer;font-size:11px}.effectifs-empty{text-align:center;padding:34px!important;color:#768692}
      .effectifs-module.print-preview{width:794px;min-height:1123px;background:#fff;padding:48px;box-sizing:border-box;box-shadow:0 18px 55px rgba(20,45,65,.2);margin:auto}.print-preview .effectifs-hero{box-shadow:none;border-radius:0;padding:11px 16px}.print-preview .effectifs-topline{gap:14px}.print-preview .effectifs-brand{gap:10px}.print-preview .effectifs-logo{width:50px;height:44px}.print-preview .effectifs-school{font-size:16px}.print-preview .effectifs-heading{margin-top:7px}.print-preview .effectifs-description{line-height:1.3}.print-preview .effectifs-stats{min-width:350px}.print-preview .effectifs-stat{padding:6px 9px}.print-preview .effectifs-stat strong{font-size:18px}.print-preview .effectifs-tools,.print-preview .effectifs-classes,.print-preview .effectifs-actions{display:none!important}.print-preview .effectifs-table-wrap{border-radius:0}.print-preview .effectifs-table{min-width:0;font-size:11px}.print-preview .effectifs-table th,.print-preview .effectifs-table td{padding:7px 8px}
      @media(max-width:760px){.effectifs-topline{align-items:flex-start;flex-direction:column}.effectifs-stats{width:100%;min-width:0;gap:8px}.effectifs-stat{padding:9px 10px}.effectifs-stat strong{font-size:20px}.effectifs-stat span{letter-spacing:.3px}.effectifs-description{white-space:normal}.effectifs-tools{grid-template-columns:1fr}.effectifs-print{min-height:42px}}
      @media print{
        html,body,#root,.app-shell,.page-content{background:#fff!important}
        body *{visibility:hidden!important}
        .effectifs-module,.effectifs-module *{visibility:visible!important}
        .effectifs-module{position:static!important;inset:auto!important;width:auto!important;min-height:0!important;margin:0!important;padding:0!important;background:#fff!important;box-shadow:none!important;overflow:visible!important;box-sizing:border-box}
        .effectifs-module::before,.effectifs-module::after,.effectifs-table-wrap::before,.effectifs-table-wrap::after{display:none!important;content:none!important}
        .effectifs-hero{box-shadow:none;border-radius:0;padding:11px 16px}
        .effectifs-topline{gap:14px}.effectifs-brand{gap:10px}.effectifs-logo{width:50px;height:44px}.effectifs-school{font-size:16px}.effectifs-heading{margin-top:7px}.effectifs-description{white-space:nowrap;line-height:1.3}.effectifs-stats{min-width:350px}.effectifs-stat{padding:6px 9px}.effectifs-stat strong{font-size:18px}
        .effectifs-tools,.effectifs-classes,.effectifs-actions{display:none!important}
        .effectifs-table-wrap{display:block!important;width:100%!important;overflow:visible!important;background:#fff!important;border:0!important;border-radius:0!important;box-shadow:none!important}
        .effectifs-table{width:100%!important;min-width:0!important;background:#fff!important;font-size:11px;table-layout:auto}
        .effectifs-table thead{display:table-header-group}
        .effectifs-table tbody{background:#fff!important}
        .effectifs-table tr{break-inside:avoid;page-break-inside:avoid;background:#fff!important}
        .effectifs-table th,.effectifs-table td{padding:7px 8px}
        @page{size:A4 portrait;margin:12mm}
      }
    `}</style>
    <div className="effectifs-hero">
      <div className="effectifs-topline"><div className="effectifs-brand"><img className="effectifs-logo" src="/logo-ideal-symbole.png" alt="Logo IDEAL"/><div><div className="effectifs-school">IDEAL</div><div className="effectifs-school-sub">ÉCOLE INTERNATIONALE BILINGUE</div><div className="effectifs-address">Faladié Sema — Bamako, Mali</div></div></div><div className="effectifs-stats"><div className="effectifs-stat"><strong>{lignes.length}</strong><span>Élèves actifs</span></div><div className="effectifs-stat"><strong>{nomsClasses.length}</strong><span>Classes occupées</span></div><div className="effectifs-stat"><strong>{maximum}</strong><span>Effectif maximal</span></div></div></div>
      <div className="effectifs-heading"><div style={{ color:'#f7ad61',fontSize:11,fontWeight:900,letterSpacing:1.4 }}>REGISTRE SCOLAIRE 2026 — 2027</div><h2 style={{margin:'5px 0 4px',fontSize:22}}>Fiches &amp; Effectifs</h2><p className="effectifs-description">Vue officielle des élèves actifs, classés par niveau et prêts pour l’édition de leurs documents.</p></div>
    </div>
    <div className="effectifs-tools"><input className="effectifs-input" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un élève ou un matricule…"/><select className="effectifs-input" value={classe} onChange={e => setClasse(e.target.value)}><option value="toutes">Toutes les classes</option>{nomsClasses.map(n => <option key={n}>{n}</option>)}</select><button className="effectifs-print" onClick={() => window.print()}>🖨️ Imprimer la liste</button></div>
    <div className="effectifs-classes"><button className={`effectifs-classe ${classe === 'toutes' ? 'active' : ''}`} onClick={() => setClasse('toutes')}><strong>{lignes.length}</strong><span>Toutes les classes</span></button>{effectifs.map(item => <button key={item.nom} className={`effectifs-classe ${classe === item.nom ? 'active' : ''}`} onClick={() => setClasse(item.nom)}><strong>{item.total}</strong><span>{item.nom}</span></button>)}</div>
    <div className="effectifs-table-wrap"><table className="effectifs-table"><thead><tr><th>#</th><th>Élève</th><th>Classe</th><th>Genre</th><th>Âge</th><th>Statut</th><th className="effectifs-actions" style={{textAlign:'right'}}>Documents</th></tr></thead><tbody>{visibles.map((e, i) => <tr key={`${e.id}-${e.matricule || i}`}><td style={{color:'#8b98a2',fontWeight:800}}>{String(i + 1).padStart(2,'0')}</td><td><div className="effectifs-name">{nomDe(e) || 'Nom non renseigné'}</div><div className="effectifs-matricule">{e.matricule || 'Matricule non attribué'}</div></td><td><span className="effectifs-chip">{e.classeAffichee}</span></td><td>{genreDe(e)}</td><td style={{whiteSpace:'nowrap'}}>{ageDe(e)}</td><td style={{color:'#16825d',fontWeight:800}}>● Actif</td><td className="effectifs-actions" style={{textAlign:'right',whiteSpace:'nowrap'}}><button className="effectifs-action" style={{background:'#174e72'}} onClick={() => onCertificat?.(e)}>📜 Certificat</button><button className="effectifs-action" style={{background:'#16825d'}} onClick={() => onCarte?.(e)}>💳 Carte</button></td></tr>)}{!visibles.length && <tr><td className="effectifs-empty" colSpan="7">Aucun élève ne correspond à cette recherche.</td></tr>}</tbody></table></div>
  </section>
}
