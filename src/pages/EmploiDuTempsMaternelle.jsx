import { useState } from 'react'
import FichePreparation from './FichePreparation'
import { objectifsMaternelle } from '../lib/programmes/maternelle'

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

// Les cellules ne portent que les sept domaines du référentiel officiel.
// Cela évite que « sport », « musique » ou « lecture » deviennent, à tort,
// des matières sans objectifs associés dans les préparations.
const DOMAINES = {
  langage:   { fr: 'Langage & prélecture', en: 'Language & pre-reading', objectif: 'LANGAGE & PRÉLECTURE' },
  ecriture:  { fr: 'Écriture & motricité fine', en: 'Early writing & fine motor skills', objectif: 'ÉCRITURE & MOTRICITÉ FINE' },
  maths:     { fr: 'Mathématiques & logique', en: 'Early mathematics & logical thinking', objectif: 'MATHÉMATIQUES & LOGIQUE' },
  sciences:  { fr: 'Sciences & découverte du monde', en: 'Science & discovery of the world', objectif: 'SCIENCES & DÉCOUVERE DU MONDE' },
  arts:      { fr: 'Art & expression artistique', en: 'Art & creative expression', objectif: 'ART & EXPRESSION ARTISTIQUE' },
  motricite: { fr: 'Motricité globale', en: 'Gross motor skills', objectif: 'MOTRICITÉ GLOBALE' },
  civique:   { fr: 'Éducation civique & vivre ensemble', en: 'Civic education & living together', objectif: 'ÉDUCATION CIVIQUE & VIVRE ENSEMBLE' },
}

const PROGRAMME = {
  PS: [
    ['maths', 'langage', 'langage', 'sciences', 'langage'],
    ['ecriture', 'maths', 'ecriture', 'maths', 'arts'],
    ['sciences', 'ecriture', 'arts', 'arts', 'maths'],
    ['civique', 'sciences', 'sciences', 'motricite', 'civique'],
    ['arts', 'motricite', 'motricite', 'arts', 'motricite'],
  ],
  GS: [
    ['langage', 'langage', 'maths', 'maths', 'sciences'],
    ['maths', 'maths', 'ecriture', 'sciences', 'ecriture'],
    ['sciences', 'langage', 'sciences', 'ecriture', 'maths'],
    ['arts', 'motricite', 'civique', 'arts', 'arts'],
    ['motricite', 'motricite', 'arts', 'arts', 'motricite'],
  ],
}

const fonction = user => String(user?.fonction || '').toLowerCase()
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

const isoLocal = date => {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const trimestreDe = date => date.getMonth() >= 8 ? 't1' : date.getMonth() <= 2 ? 't2' : 't3'
const estObjectifAnglais = texte => /^(Mastered|Names?|Identifies|Writes?|Counts?|Recognizes|Performs?|Responds?|Draws?|Demonstrates|Washes|Throws|Eats|Flushes|Traces|Executes|Sorts|Conducts|Participates|Coordinates|Explores|Uses|Takes|Revises|Associates|Knows|Sings|Respects)\b/i.test(texte)

export default function EmploiDuTempsMaternelle({ user }) {
  const langue = langueDe(user)
  const [lundi, setLundi] = useState(lundiDe(new Date()))
  const [preparation, setPreparation] = useState(null)
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
              const domaineId=PROGRAMME[classe][programmeIndex][index]
              const domaine=DOMAINES[domaineId]
              const estAssistante=fonction(user).includes('assistante')
              const dateCours=isoLocal(date)
              const objectifs=objectifsMaternelle(classe,trimestreDe(date))
                .filter(o=>o.domaine.toUpperCase().includes(domaine.objectif))
                .filter(o=>langue==='en'?estObjectifAnglais(o.description):!estObjectifAnglais(o.description))
              return <td key={index}
                onClick={()=>!estAssistante&&setPreparation({
                  dateCours, objectifs,
                  creneau:{
                    groupe:classe,
                    matiere:domaine.fr,
                    sequence:programmeIndex+1,
                    heure_debut:creneau.debut.replace('h',':'),
                    duree_minutes:(Number(creneau.fin.slice(0,2))*60+Number(creneau.fin.slice(3)))-(Number(creneau.debut.slice(0,2))*60+Number(creneau.debut.slice(3))),
                  },
                })}
                title={estAssistante
                  ? (langue==='en'?'Timetable consultation':'Consultation de l’emploi du temps')
                  : (langue==='en'?'Open course preparation':'Ouvrir la préparation du cours')}
                style={{background:'#fff',border:'1px solid #d7dee7',borderRadius:14,padding:10,textAlign:'center',fontWeight:750,cursor:estAssistante?'default':'pointer',boxShadow:estAssistante?'none':'0 2px 8px rgba(15,47,66,.08)'}}>
                <div>{domaine[langue]}</div><small style={{display:'block',marginTop:4,color:classe==='PS'?'#c65d16':'#087eaf',fontWeight:900}}>{classe}{!estAssistante?' · ✎':''}</small>
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

    {preparation && <FichePreparation
      user={user}
      creneau={preparation.creneau}
      dateCours={preparation.dateCours}
      objectifsOfficiels={preparation.objectifs}
      onFerme={()=>setPreparation(null)}
    />}
  </>
}
