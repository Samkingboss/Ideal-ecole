import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';
import './BulletinPrimaire.css';

// Mock data pour la démonstration (Trimestre 2)
const studentData = {
  nom: "SANGARE",
  prenom: "Khalil",
  classe: "CP2",
  effectif: { garcons: 12, filles: 15, total: 27 },
  annee: "2024-2025",
  trimestreActuel: 2,
};

// Données globales pour le graphique de progression
const evolutionGlobale = [
  { trimestre: 'T1', eleve: 82, classe: 80 },
  { trimestre: 'T2', eleve: 86, classe: 81 },
  // T3 vide car nous sommes en T2
];

// Programme Malien
const dataMalien = [
  { matiere: "Mathématiques", moyT1: 72, ecritT2: 86, oralT2: 90, moyT2: 88 },
  { matiere: "Lecture", moyT1: 90, ecritT2: 100, oralT2: 98, moyT2: 99 },
  { matiere: "Orthographe", moyT1: 85, ecritT2: 81, oralT2: 85, moyT2: 83 },
  { matiere: "Dictée", moyT1: 75, ecritT2: 60, oralT2: 64, moyT2: 62 },
  { matiere: "Art/Dessin", moyT1: 80, ecritT2: 85, oralT2: null, moyT2: 85 }
];

// Programme International
const dataInternational = [
  { matiere: "Reading", moyT1: 80, ecritT2: 85, oralT2: 90, moyT2: 87 },
  { matiere: "Spelling", moyT1: 95, ecritT2: 100, oralT2: null, moyT2: 100 },
  { matiere: "Sciences", moyT1: 78, ecritT2: 80, oralT2: 82, moyT2: 81 },
];

const renderEvolution = (t1, t2) => {
  if (t1 == null || t2 == null) return <span className="evolution stable">-</span>;
  const diff = t2 - t1;
  if (diff > 0) return <span className="evolution up">▲ +{diff}%</span>;
  if (diff < 0) return <span className="evolution down">▼ {diff}%</span>;
  return <span className="evolution stable">▶ =</span>;
};

export default function BulletinPrimaire() {
  
  // Formatage des données pour les graphiques en barres
  const formatBarData = (data) => {
    return data.map(item => ({
      name: item.matiere,
      T1: item.moyT1,
      T2: item.moyT2
    }));
  };

  const moyBlocMalienT1 = Math.round(dataMalien.reduce((acc, curr) => acc + curr.moyT1, 0) / dataMalien.length);
  const moyBlocMalienT2 = Math.round(dataMalien.reduce((acc, curr) => acc + curr.moyT2, 0) / dataMalien.length);

  return (
    <div className="bulletin-container">
      
      {/* 1. HEADER */}
      <header className="bulletin-header">
        <div className="school-info">
          <h1>IDEAL École Principale</h1>
          <p>Année Scolaire {studentData.annee}</p>
          <p>BULLETIN TRIMESTRIEL - TRIMESTRE {studentData.trimestreActuel}</p>
        </div>
        <div className="student-info">
          <div className="student-class">{studentData.classe}</div>
          <h2 className="student-name">{studentData.nom} {studentData.prenom}</h2>
          <p style={{fontSize: '12px', margin:0, color:'#666'}}>Effectif C: {studentData.effectif.total}</p>
        </div>
      </header>

      {/* 2. SYNTHESE GLOBALE (T1 vs T2) */}
      <section className="global-synthesis">
        <div className="moyennes-globales">
          <div className="moyenne-badge">
            <span className="badge-label">Moyenne T1</span>
            <span className="badge-value">82%</span>
          </div>
          <div className="moyenne-badge current">
            <span className="badge-label">Moyenne T2 (Actuel)</span>
            <span className="badge-value">86%</span>
            <div style={{fontSize:'12px', marginTop:'5px'}}>{renderEvolution(82, 86)}</div>
          </div>
        </div>
        <div className="chart-global">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolutionGlobale} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaeaea" />
              <XAxis dataKey="trimestre" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[50, 100]} fontSize={12} tickLine={false} axisLine={false} hide />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend iconType="circle" wrapperStyle={{fontSize: '11px'}} />
              <Line type="monotone" dataKey="eleve" name="Élève" stroke="#FCA311" strokeWidth={3} dot={{r: 4}} />
              <Line type="monotone" dataKey="classe" name="Classe" stroke="#14213D" strokeWidth={2} dot={{r: 3}} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 3. PROGRAMME MALIEN (Avec historique T1 et détail T2) */}
      <section className="programme-section malien">
        <div className="programme-title">Programme National Malien</div>
        
        <table className="bulletin-table">
          <thead>
            <tr>
              <th rowSpan="2" style={{width: '25%'}}>Matières</th>
              <th>Historique</th>
              <th colSpan="3">Trimestre 2 (Actuel)</th>
              <th rowSpan="2">Évolution<br/>(T2 vs T1)</th>
            </tr>
            <tr>
              <th style={{fontSize:'12px', color:'#666'}}>Moy. T1</th>
              <th>Écrit</th>
              <th>Oral</th>
              <th>Moy. T2</th>
            </tr>
          </thead>
          <tbody>
            {dataMalien.map((item, idx) => (
              <tr key={idx}>
                <td className="subject-name">{item.matiere}</td>
                <td style={{color: '#666'}}>{item.moyT1}%</td>
                <td className="current-term">{item.ecritT2 ? `${item.ecritT2}%` : '-'}</td>
                <td className="current-term">{item.oralT2 ? `${item.oralT2}%` : '-'}</td>
                <td className="current-term">{item.moyT2}%</td>
                <td>{renderEvolution(item.moyT1, item.moyT2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="table-footer">
              <td className="subject-name">Moyenne du Programme</td>
              <td>{moyBlocMalienT1}%</td>
              <td colSpan="2"></td>
              <td className="current-term">{moyBlocMalienT2}%</td>
              <td>{renderEvolution(moyBlocMalienT1, moyBlocMalienT2)}</td>
            </tr>
          </tfoot>
        </table>

        <div style={{height: '140px', width: '100%', marginTop: '15px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatBarData(dataMalien)} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={11} interval={0} tick={{fill: '#666'}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0, 100]} fontSize={11} hide />
              <Tooltip formatter={(value) => `${value}%`}/>
              <Legend iconType="circle" wrapperStyle={{fontSize: '11px'}}/>
              <Bar dataKey="T1" fill="#e9ecef" radius={[3, 3, 0, 0]} barSize={12} />
              <Bar dataKey="T2" name="T2 (Actuel)" fill="#FCA311" radius={[3, 3, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 4. PROGRAMME INTERNATIONAL */}
      <section className="programme-section international">
        <div className="programme-title">Programme International</div>
        <table className="bulletin-table">
          <thead>
            <tr>
              <th rowSpan="2" style={{width: '25%'}}>Subjects</th>
              <th>Historique</th>
              <th colSpan="3">Trimestre 2 (Actuel)</th>
              <th rowSpan="2">Évolution<br/>(T2 vs T1)</th>
            </tr>
            <tr>
              <th style={{fontSize:'12px', color:'#666'}}>Moy. T1</th>
              <th>Écrit</th>
              <th>Oral</th>
              <th>Moy. T2</th>
            </tr>
          </thead>
          <tbody>
            {dataInternational.map((item, idx) => (
              <tr key={idx}>
                <td className="subject-name">{item.matiere}</td>
                <td style={{color: '#666'}}>{item.moyT1}%</td>
                <td className="current-term">{item.ecritT2 ? `${item.ecritT2}%` : '-'}</td>
                <td className="current-term">{item.oralT2 ? `${item.oralT2}%` : '-'}</td>
                <td className="current-term">{item.moyT2}%</td>
                <td>{renderEvolution(item.moyT1, item.moyT2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div style={{height: '140px', width: '100%', marginTop: '15px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatBarData(dataInternational)} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={11} interval={0} tick={{fill: '#666'}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0, 100]} fontSize={11} hide />
              <Tooltip formatter={(value) => `${value}%`}/>
              <Legend iconType="circle" wrapperStyle={{fontSize: '11px'}}/>
              <Bar dataKey="T1" fill="#e9ecef" radius={[3, 3, 0, 0]} barSize={12} />
              <Bar dataKey="T2" name="T2 (Actuel)" fill="#00A6FB" radius={[3, 3, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 5. FOOTER & SIGNATURES */}
      <section className="bulletin-footer">
        <div className="signature-box">
          <div className="signature-title">L'Enseignant</div>
          <div>___________________</div>
        </div>
        <div className="signature-box">
          <div className="signature-title">Le Directeur</div>
          <div>___________________</div>
        </div>
        <div className="signature-box">
          <div className="signature-title">Les Parents</div>
          <div>___________________</div>
        </div>
      </section>

      {/* Print Button (will be hidden on print via CSS but useful for testing) */}
      <div style={{textAlign: 'center', marginTop: '30px'}} className="print-hide">
        <button 
          onClick={() => window.print()} 
          style={{padding: '10px 20px', background: '#14213D', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
          🖨️ Imprimer ce bulletin
        </button>
      </div>

    </div>
  );
}
