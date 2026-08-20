import { useState } from 'react'

const JOURS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
const JOURS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const CRENEAUX = [
  { debut: '08h20', fin: '09h00', commun: true, fr: 'Rituels de classe', en: 'Classroom routines' },
  { debut: '09h00', fin: '09h30', pause: true, fr: 'Goûter et récréation', en: 'Snack and play break' },
  { debut: '09h30', fin: '10h25' },
  { debut: '10h25', fin: '11h15' },
  { debut: '11h15', fin: '12h00' },
  { debut: '12h00', fin: '14h00', pause: true, fr: 'Déjeuner, hygiène et temps calme', en: 'Lunch, hygiene and quiet time' },
  { debut: '14h00', fin: '14h45' },
  { debut: '14h45', fin: '15h10', pause: true, fr: 'Pause active et transition', en: 'Active break and transition' },
  { debut: '15h10', fin: '15h30' },
]

// Les deux grilles validées, avec les abréviations remplacées par des
// domaines d'apprentissage explicites et cohérents avec la maternelle.
const PROGRAMME = {
  PS: [
    ['Mathématiques et logique', 'Langage et prélecture', 'Langage et prélecture', 'Sciences et découverte', 'Langage et communication'],
    ['Motricité fine et graphisme', 'Mathématiques et logique', 'Écriture et motricité fine', 'Mathématiques et logique', 'Arts et expression'],
    ['Sciences et découverte', 'Écriture et motricité fine', 'Arts et expression', 'Arts et expression', 'Mathématiques et logique'],
    ['Vivre ensemble et citoyenneté', 'Sciences et découverte', 'Sciences et découverte', 'Expression corporelle', 'Vivre ensemble et citoyenneté'],
    ['Arts et musique', 'Sport', 'Motricité globale', 'Musique', 'Sport'],
  ],
  GS: [
    ['Langage et prélecture', 'Langage et lecture', 'Mathématiques et logique', 'Mathématiques et logique', 'Sciences et découverte'],
    ['Mathématiques et logique', 'Mathématiques et logique', 'Écriture et motricité fine', 'Sciences et découverte', 'Écriture et motricité fine'],
    ['Sciences et découverte', 'Lecture', 'Sciences et découverte', 'Écriture et graphisme', 'Mathématiques et logique'],
    ['Arts et expression', 'Expression corporelle', 'Vivre ensemble et citoyenneté', 'Arts et expression', 'Arts et expression'],
    ['Motricité globale', 'Sport', 'Musique', 'Musique', 'Sport'],
  ],
}

const TRADUCTIONS = {
  'Mathématiques et logique': 'Early mathematics and logical thinking',
  'Langage et prélecture': 'Language and pre-reading',
  'Langage et lecture': 'Language and early reading',
  'Langage et communication': 'Language and communication',
  'Sciences et découverte': 'Discovery science and exploration',
  'Motricité fine et graphisme': 'Fine motor skills and pre-writing',
  'Écriture et motricité fine': 'Early writing and fine motor skills',
  'Écriture et graphisme': 'Early writing and pre-writing patterns',
  'Arts et expression': 'Creative arts and expression',
  'Expression corporelle': 'Movement and body expression',
  'Vivre ensemble et citoyenneté': 'Personal, social and civic development',
  'Lecture': 'Early reading',
  'Arts et musique': 'Creative arts and music',
  'Motricité globale': 'Gross motor skills',
  'Musique': 'Music',
  'Sport': 'Physical education',
}

const fonction = user => String(user?.fonction || user?.poste_id || user?.custom_role || '').toLowerCase()
const langueDe = user => fonction(user).includes('-en-') || user?.langue === 'en' ? 'en' : 'fr'
const lundiDe = date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const jour = d.getDay() || 7
  d.setDate(d.getDate() - jour + 1)
  return d
}
const ajouterJours = (date, jours) => { const d = new Date(date); d.setDate(d.getDate() + jours); return d }
const semaineA = date => Math.abs(Math.round((lundiDe(date) - new Date('2026-09-07T00:00:00')) / 604800000)) % 2 === 0
const classeDuJour = (date, langue, index) => {
  const psFrancais = semaineA(date) ? index % 2 !== 0 : index % 2 === 0
  return (langue === 'fr') === psFrancais ? 'PS' : 'GS'
}

const libelle = (matiere, langue) => langue === 'en' ? (TRADUCTIONS[matiere] || matiere) : matiere

export default function EmploiDuTempsMaternelle({ user }) {
  const langue = langueDe(user)
  const [lundi, setLundi] = useState(lundiDe(new Date()))
  const jours = langue === 'en' ? JOURS_EN : JOURS_FR
  const typeSemaine = semaineA(lundi) ? 'A' : 'B'

  return <>
    <div className="section-head">
      <div>
        <div className="section-title">{langue === 'en' ? 'My kindergarten timetable' : 'Mon emploi du temps maternelle'}</div>
        <div style={{fontSize:12,color:'var(--muted)'}}>
          {langue === 'en' ? `Two-week rotation · Week ${typeSemaine}` : `Rotation équilibrée sur deux semaines · Semaine ${typeSemaine}`}
        </div>
      </div>
    </div>

    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
      <button className="btn-sm" onClick={()=>setLundi(ajouterJours(lundi,-7))}>◀</button>
      <div style={{flex:1,textAlign:'center',fontWeight:800}}>
        {lundi.toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR',{day:'numeric',month:'long'})}
        {' — '}
        {ajouterJours(lundi,4).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR',{day:'numeric',month:'long',year:'numeric'})}
      </div>
      <button className="btn-sm" onClick={()=>setLundi(ajouterJours(lundi,7))}>▶</button>
      <button className="btn-sm" onClick={()=>setLundi(lundiDe(new Date()))}>{langue === 'en' ? 'Today' : "Aujourd’hui"}</button>
    </div>

    <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
      <table style={{borderCollapse:'separate',borderSpacing:5,width:'100%',minWidth:850,fontSize:12}}>
        <thead><tr>
          <th style={{background:'#294f7f',color:'#fff',borderRadius:10,padding:10}}>HORAIRES</th>
          {jours.map((jour,index)=>{
            const date=ajouterJours(lundi,index), classe=classeDuJour(date,langue,index)
            return <th key={jour} style={{background:classe==='PS'?'#ff914d':'#36afe7',color:'#fff',borderRadius:10,padding:10}}>
              <div>{jour.toUpperCase()}</div><small>{classe} · {langue==='en'?'ENGLISH':'FRANÇAIS'}</small>
            </th>
          })}
        </tr></thead>
        <tbody>{CRENEAUX.map((creneau,ligne)=>{
          const programmeIndex=[null,null,0,1,2,null,3,null,4][ligne]
          return <tr key={creneau.debut}>
            <td style={{background:'#e8eef5',border:'1px solid #b8c6d5',borderRadius:10,padding:10,textAlign:'center',fontWeight:800,whiteSpace:'nowrap'}}>{creneau.debut} – {creneau.fin}</td>
            {creneau.commun||creneau.pause ? <td colSpan="5" style={{background:creneau.pause?'#ffe066':'#fff',border:'1px solid #d7dee7',borderRadius:14,padding:11,textAlign:'center',fontWeight:800}}>{langue==='en'?creneau.en:creneau.fr}</td> : jours.map((_,index)=>{
              const date=ajouterJours(lundi,index), classe=classeDuJour(date,langue,index)
              const matiere=PROGRAMME[classe][programmeIndex][index]
              return <td key={index} style={{background:'#fff',border:'1px solid #d7dee7',borderRadius:14,padding:10,textAlign:'center',fontWeight:750}}>
                <div>{libelle(matiere,langue)}</div><small style={{display:'block',marginTop:4,color:classe==='PS'?'#c65d16':'#087eaf',fontWeight:900}}>{classe}</small>
              </td>
            })}
          </tr>
        })}</tbody>
      </table>
    </div>

    <div style={{marginTop:12,padding:'10px 13px',borderRadius:12,background:'#f0f9ff',border:'1px solid #bae6fd',fontSize:12,color:'#334155'}}>
      {langue === 'en'
        ? 'PS and GS alternate French and English daily. The pattern reverses the following week, giving each class five days in each language over two weeks.'
        : 'La PS et la GS alternent chaque jour entre le français et l’anglais. La rotation s’inverse la semaine suivante : chaque classe bénéficie ainsi de cinq journées dans chaque langue sur deux semaines.'}
    </div>
  </>
}
