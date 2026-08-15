import React from 'react'
import DocumentPrintStudio from './DocumentPrintStudio'

const fcfa = n => (Math.round(Number(n) || 0)).toLocaleString('fr-FR') + ' F'

export default function RecouvrementDocument({ relanceInfo, onClose }) {
  const info = relanceInfo || {
    eleveNom: 'TRAORÉ Aïcha',
    matricule: '24-25 A014',
    classe: 'CP1 Bilingue',
    parentNom: 'M. TRAORÉ Ousmane',
    telephone: '+223 70 11 22 33',
    tranche: '2ème Tranche de Scolarité 2026 - 2027',
    montantDu: 150000,
    dateEcheance: '15 Février 2026',
    dateDelivrance: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <DocumentPrintStudio
      type="comptabilite"
      documentTitle="AVIS DE RECOUVREMENT DE SCOLARITÉ"
      subTitlePill="💸 RAPPEL DE PAIEMENT & RELANCE DE COMPTABILITÉ"
      eleveInfo={{
        nom: info.eleveNom,
        matricule: info.matricule,
        classe: info.classe,
        date: info.dateDelivrance
      }}
      onClose={onClose}
    >
      {/* BLOC PRINCIPAL RECOUVREMENT EN VIOLET IMPÉRIAL LUXE SANS BORDURES */}
      <div style={{ background: '#faf5ff', borderRadius: 24, padding: '24px', marginBottom: 24 }}>
        <div style={{ background: '#7e22ce', color: '#ffffff', padding: '10px 20px', borderRadius: 14, textAlign: 'center', fontWeight: 900, fontSize: 16, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 20, boxShadow: '0 4px 12px rgba(126,34,206,0.2)' }}>
          ÉCHÉANCE &amp; SITUATION FINANCIÈRE DE L'ÉLÈVE
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#7e22ce', textTransform: 'uppercase', display: 'block' }}>DESTINATAIRE (PARENT / TUTEUR)</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{info.parentNom}</span>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Tél : {info.telephone}</div>
          </div>

          <div>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#7e22ce', textTransform: 'uppercase', display: 'block' }}>DÉSIGNATION DES FRAIS</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#b45309' }}>{info.tranche}</span>
          </div>

          <div>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#7e22ce', textTransform: 'uppercase', display: 'block' }}>DATE LIMITE D'ÉCHÉANCE</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#dc2626' }}>{info.dateEcheance}</span>
          </div>

          <div style={{ background: '#faf5ff', padding: '12px 16px', borderRadius: 12, border: '2px solid #7e22ce' }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#7e22ce', textTransform: 'uppercase', display: 'block' }}>MONTANT RESTANT À RÉGLER</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#7e22ce' }}>{fcfa(info.montantDu)}</span>
          </div>
        </div>
      </div>

      {/* TEXTE EXPLICATIF CORDIAL */}
      <div style={{ background: '#ffffff', borderRadius: 20, padding: '22px', border: '1px solid #e9d5ff', marginBottom: 24, fontSize: 14, lineHeight: 1.8, color: '#334155' }}>
        Chers Parents,
        <br />
        Sauf erreur ou omission de notre part, le compte de votre enfant présente à ce jour un solde en attente de règlement concernant la <b>{info.tranche}</b>. Nous vous prions de bien vouloir procéder à la régularisation de la somme de <b style={{ color: '#7e22ce', fontSize: 17 }}>{fcfa(info.montantDu)}</b> avant le <b>{info.dateEcheance}</b> auprès de la Caisse Principale de l'Établissement.
        <br /><br />
        <i>Nous vous remercions pour votre précieuse collaboration et restons à votre entière disposition pour tout renseignement complémentaire.</i>
      </div>

      {/* BLOC SIGNATURE COMPTABILITÉ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 10 }}>
        <div style={{ textAlign: 'center', width: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#7e22ce', textTransform: 'uppercase', marginBottom: 6 }}>
            LA DIRECTION FINANCIÈRE
          </div>
          <div style={{ height: 80, background: '#ffffff', border: '2px solid #7e22ce', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>
            (Cachet &amp; Signature Caisse)
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg, #7e22ce, #6b21a8)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(126,34,206,0.3)', margin: '0 auto 4px auto', border: '3px solid #ffffff' }}>
            <div style={{ fontSize: 18 }}>💰</div>
            <div style={{ fontSize: 7, fontWeight: 900 }}>COMPTABILITÉ</div>
          </div>
        </div>
      </div>
    </DocumentPrintStudio>
  )
}
