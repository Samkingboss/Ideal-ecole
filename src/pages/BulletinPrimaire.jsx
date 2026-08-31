import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { NOM_ECOLE } from '../lib/ecole'

// Mock data pour la démonstration (Trimestre 2)
const studentData = {
  nom: "SANGARE",
  prenom: "Khalil",
  classe: "CP2 Bilingue",
  matricule: "24-25 A088",
  effectif: { garcons: 12, filles: 15, total: 27 },
  annee: "2026-2027",
  trimestreActuel: 2,
};

// Données globales pour le graphique de progression
const evolutionGlobale = [
  { trimestre: 'T1', eleve: 82, classe: 80 },
  { trimestre: 'T2', eleve: 86, classe: 81 },
];

// Programme Malien
const dataMalien = [
  { matiere: "Mathématiques", moyT1: 72, ecritT2: 86, oralT2: 90, moyT2: 88 },
  { matiere: "Lecture & Compréhension", moyT1: 90, ecritT2: 100, oralT2: 98, moyT2: 99 },
  { matiere: "Orthographe", moyT1: 85, ecritT2: 81, oralT2: 85, moyT2: 83 },
  { matiere: "Dictée & Rédaction", moyT1: 75, ecritT2: 60, oralT2: 64, moyT2: 62 },
  { matiere: "Éveil & Dessin", moyT1: 80, ecritT2: 85, oralT2: null, moyT2: 85 }
];

// Programme International
const dataInternational = [
  { matiere: "English Reading", moyT1: 80, ecritT2: 85, oralT2: 90, moyT2: 87 },
  { matiere: "Spelling & Grammar", moyT1: 95, ecritT2: 100, oralT2: null, moyT2: 100 },
  { matiere: "Science & Discovery", moyT1: 78, ecritT2: 80, oralT2: 82, moyT2: 81 },
];

const renderEvolution = (t1, t2) => {
  if (t1 == null || t2 == null) return <span style={{ color: '#64748b' }}>-</span>;
  const diff = t2 - t1;
  if (diff > 0) return <span style={{ color: '#047857', fontWeight: 900 }}>▲ +{diff}%</span>;
  if (diff < 0) return <span style={{ color: '#dc2626', fontWeight: 900 }}>▼ {diff}%</span>;
  return <span style={{ color: '#d97706', fontWeight: 900 }}>▶ =</span>;
};

export default function BulletinPrimaire() {
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
    <div style={{ padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Bouton d'impression en haut */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#0d2a3b', fontWeight: 900 }}>📊 Bulletin Trimestriel Officiel</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Relevé de notes et bilan académique de l'élève aux standards d’{NOM_ECOLE}.</p>
        </div>
        <button
          onClick={() => window.print()}
          style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 6px 18px rgba(217,119,6,0.3)' }}
        >
          🖨️ Imprimer le Bulletin (A4)
        </button>
      </div>

      {/* SUPPORT A4 DU BULLETIN BULLETIN PRINTABLE */}
      <div
        id="bulletin-print-area"
        style={{
          width: 820,
          maxWidth: '100%',
          margin: '0 auto',
          background: 'linear-gradient(180deg, #fffdfa 0%, #faf8f5 100%)',
          padding: '3rem 2.8rem',
          boxSizing: 'border-box',
          borderRadius: 32,
          boxShadow: '0 25px 60px rgba(0,0,0,0.12)',
          border: '3px double #d97706',
          position: 'relative',
          color: '#0f172a'
        }}
      >
        {/* Filigrane officiel couronne impériale */}
        <div style={{ position: 'absolute', top: -40, right: -40, fontSize: 280, opacity: 0.03, pointerEvents: 'none' }}>👑</div>

        {/* EN-TÊTE ÉLÉGANT LUXE : LOGO À GAUCHE SANS CERCLE & NOM ÉCOLE GRAND & TITRE DE DOCUMENT */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 24, borderBottom: '2px solid rgba(217,119,6,0.3)', paddingBottom: 24, marginBottom: 24 }}>
          <img src="/logo-ideal.png" alt="IDEAL" style={{ height: 95, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.08))' }} />

          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#d97706', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {NOM_ECOLE.toUpperCase()}
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a', letterSpacing: '1.5px', marginTop: 2 }}>
              BULLETIN TRIMESTRIEL D'ÉVALUATION
            </div>
          </div>
        </div>

        {/* BARRE BLEU FONCÉ : TRIMESTRE 2 ET ANNÉE SCOLAIRE */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-block', background: '#0f172a', color: '#ffffff', padding: '14px 44px', borderRadius: 36, border: '2.5px solid #d97706', boxShadow: '0 6px 20px rgba(15,23,42,0.25)' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', letterSpacing: '2px', textTransform: 'uppercase' }}>
              📊 RELEVÉ OFFICIEL • 2ÈME TRIMESTRE (2026 - 2027)
            </div>
          </div>
        </div>

        {/* FICHE ÉLÈVE EN FOND PASTEL DORE SANS BORDURES */}
        <div style={{ background: '#fffbeb', borderRadius: 24, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', display: 'block' }}>ÉLÈVE</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>{studentData.nom} {studentData.prenom}</span>
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', display: 'block' }}>MATRICULE</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#d97706' }}>{studentData.matricule}</span>
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', display: 'block' }}>CLASSE</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#047857' }}>{studentData.classe}</span>
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#b45309', textTransform: 'uppercase', display: 'block' }}>EFFECTIF DE CLASSE</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#0284c7' }}>{studentData.effectif.total} Élèves</span>
            </div>
          </div>
        </div>

        {/* PROGRAMME MALIEN (FOND VERT MENTHE SOFT SANS BORDURES) */}
        <div style={{ background: '#dcfce7', borderRadius: 24, padding: '22px', marginBottom: 24 }}>
          <div style={{ background: '#047857', color: '#ffffff', padding: '10px 18px', borderRadius: 14, fontWeight: 900, fontSize: 15, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>
            🇲🇱 PROGRAMME NATIONAL MALIEN
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#ffffff', borderRadius: 14, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: 12, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 14px' }}>Matières</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Moy. T1</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Écrit T2</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Oral T2</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Moyenne T2</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Évolution</th>
              </tr>
            </thead>
            <tbody>
              {dataMalien.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{item.matiere}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>{item.moyT1}%</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{item.ecritT2 ? `${item.ecritT2}%` : '-'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{item.oralT2 ? `${item.oralT2}%` : '-'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 900, color: '#047857', fontSize: 14 }}>{item.moyT2}%</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>{renderEvolution(item.moyT1, item.moyT2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PROGRAMME INTERNATIONAL (FOND BLEU SOFT SANS BORDURES) */}
        <div style={{ background: '#e0f2fe', borderRadius: 24, padding: '22px', marginBottom: 24 }}>
          <div style={{ background: '#0284c7', color: '#ffffff', padding: '10px 18px', borderRadius: 14, fontWeight: 900, fontSize: 15, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>
            🇬🇧 PROGRAMME INTERNATIONAL BILINGUE
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#ffffff', borderRadius: 14, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: 12, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 14px' }}>International Subjects</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Moy. T1</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Written T2</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Oral T2</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Moyenne T2</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {dataInternational.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{item.matiere}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>{item.moyT1}%</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{item.ecritT2 ? `${item.ecritT2}%` : '-'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{item.oralT2 ? `${item.oralT2}%` : '-'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 900, color: '#0284c7', fontSize: 14 }}>{item.moyT2}%</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>{renderEvolution(item.moyT1, item.moyT2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BLOC SIGNATURES & EVALUATION DU DIRECTEUR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 }}>
          <div style={{ background: '#ffffff', border: '2px solid #0f172a', borderRadius: 16, padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', marginBottom: 8 }}>L'ENSEIGNANT TITULAIRE</div>
            <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>(Visa &amp; Signature)</div>
          </div>
          <div style={{ background: '#ffffff', border: '2px solid #0f172a', borderRadius: 16, padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', marginBottom: 8 }}>LE DIRECTEUR GÉNÉRAL</div>
            <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>(Signature &amp; Cachet)</div>
          </div>
          <div style={{ background: '#ffffff', border: '2px solid #0f172a', borderRadius: 16, padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', marginBottom: 8 }}>LES PARENTS D'ÉLÈVE</div>
            <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>(Signature &amp; Date)</div>
          </div>
        </div>

        {/* FOOTER GARANTIE */}
        <div style={{ borderTop: '2px solid rgba(217,119,6,0.3)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 900, color: '#b45309' }}>
            🏅 EXCELLENCE ACADÉMIQUE BILINGUE ACCRÉDITÉE
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
            {NOM_ECOLE.toUpperCase()} — Bamako, Mali
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print, header, nav, .topbar, .bottom-nav, button {
            display: none !important;
          }
          body {
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #bulletin-print-area {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 10mm !important;
          }
        }
      `}</style>
    </div>
  );
}
