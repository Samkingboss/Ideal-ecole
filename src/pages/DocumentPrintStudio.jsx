import React from 'react'

// Configuration officielle du Code Couleur par Provenance/Département
export const DEPARTMENT_THEMES = {
  restauration: {
    key: 'restauration',
    serviceTitle: 'SERVICE DE RESTAURATION',
    pillText: '👑 SERVICE DE RESTAURATION • NUTRITION GASTRONOMIQUE',
    primaryColor: '#d97706', // Or / Ambre
    secondaryColor: '#047857', // Vert Émeraude
    cardBg: '#fffbeb',
    badgeBg: '#047857',
    badgeText: '#ffffff',
    icon: '👩‍🍳',
    sealText: '🏅 CERTIFIÉ QUALITÉ & NUTRITION GASTRONOMIQUE'
  },
  pedagogie: {
    key: 'pedagogie',
    serviceTitle: 'SERVICE PÉDAGOGIQUE & ENSEIGNEMENT',
    pillText: '📖 CAHIER DE DEVOIRS DE MAISON & TRAVAUX AUTONOMES',
    primaryColor: '#0284c7', // Bleu Océan
    secondaryColor: '#4f46e5', // Indigo
    cardBg: '#e0f2fe',
    badgeBg: '#0284c7',
    badgeText: '#ffffff',
    icon: '📚',
    sealText: '🏅 SUIVI PÉDAGOGIQUE & SUCCÈS SCOLAIRE'
  },
  comptabilite: {
    key: 'comptabilite',
    serviceTitle: 'DIRECTION FINANCIÈRE & COMPTABILITÉ',
    pillText: '💸 RECOUVREMENT & AVIS D\'ÉCHÉANCE DE SCOLARITÉ',
    primaryColor: '#7e22ce', // Violet Impérial Luxe
    secondaryColor: '#b45309', // Ambre Doré
    cardBg: '#faf5ff',
    badgeBg: '#7e22ce',
    badgeText: '#ffffff',
    icon: '💰',
    sealText: '🏅 ACCRÉDITATION FINANCIÈRE & CONFORMITÉ DE CAISSE'
  },
  administration: {
    key: 'administration',
    serviceTitle: 'DIRECTION ADMINISTRATIVE & GENERAL MANAGEMENT',
    pillText: '📜 ATTESTATION OFFICIELLE & SCOLARITÉ',
    primaryColor: '#0f172a', // Bleu Nuit Prestige
    secondaryColor: '#ca8a04', // Doré Noblesse
    cardBg: '#f8fafc',
    badgeBg: '#0f172a',
    badgeText: '#ffffff',
    icon: '🏛️',
    sealText: '🏅 ACCRÉDITATION EXCELLENCE ACADÉMIQUE'
  },
  evaluation: {
    key: 'evaluation',
    serviceTitle: 'SERVICE D\'ÉVALUATION ACADÉMIQUE',
    pillText: '📊 RELEVÉ OFFICIEL D\'ÉVALUATION & BULLETINS',
    primaryColor: '#059669', // Vert Émeraude Académique
    secondaryColor: '#0f172a', // Marine
    cardBg: '#dcfce7',
    badgeBg: '#059669',
    badgeText: '#ffffff',
    icon: '📊',
    sealText: '🏅 EXCELLENCE ACADÉMIQUE BILINGUE ACCRÉDITÉE'
  }
}

/**
 * Composant de Document Universel Téléchargeable / Imprimable A4 avec Code Couleur par Provenance
 */
export default function DocumentPrintStudio({
  type = 'pedagogie',
  documentTitle = 'DOCUMENT OFFICIEL',
  subTitlePill = null,
  eleveInfo = null,
  children,
  onClose = null,
  onPrint = null
}) {
  const theme = DEPARTMENT_THEMES[type] || DEPARTMENT_THEMES.administration

  // Impression dans une fenêtre dédiée.
  //
  // `window.print()` imprimait la page entière : l'enseignant recevait ses
  // devoirs mélangés à la barre de navigation, aux onglets de session et au
  // formulaire de saisie, le tout serré dans une colonne large comme un
  // téléphone. La feuille de style d'impression ne masquait qu'une poignée de
  // classes, et le modal, plafonné à 92 % de la hauteur d'écran avec
  // défilement, tronquait par-dessus tout ce qui dépassait.
  //
  // On recopie donc le seul document dans une fenêtre neuve. Les styles sont
  // en ligne, ils suivent ; les images ont des adresses absolues, elles se
  // chargent. Rien de l'application n'entre dans la page imprimée, et la
  // largeur est celle du papier, pas celle de l'écran.
  const handleTriggerPrint = () => {
    if (onPrint) { onPrint(); return }

    const doc = document.getElementById('official-department-document')
    if (!doc) { window.print(); return }

    const w = window.open('', '_blank')
    if (!w) { window.print(); return }   // fenêtre bloquée : on retombe sur l'ancien comportement

    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
      <title>${documentTitle}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #fff; }
        /* Le cadre d'écran — coins arrondis, ombre portée, double filet — n'a
           pas de sens sur du papier : il mange la marge utile. */
        #official-department-document {
          width: 100% !important; max-width: none !important; margin: 0 !important;
          border: none !important; border-radius: 0 !important; box-shadow: none !important;
          padding: 0 !important; background: #fff !important;
        }
        img { max-width: 100% !important; }
        .no-print { display: none !important; }
      </style></head><body>${doc.outerHTML}</body></html>`)
    w.document.close()

    // Laisser les images arriver avant d'ouvrir la boîte d'impression, sans
    // quoi les exercices photographiés sortent en cadres vides.
    const lancer = () => { w.focus(); w.print() }
    const images = [...w.document.images]
    if (images.length === 0) { setTimeout(lancer, 200); return }
    let restantes = images.length
    const fini = () => { if (--restantes <= 0) setTimeout(lancer, 100) }
    images.forEach(img => (img.complete ? fini() : (img.onload = fini, img.onerror = fini)))
    setTimeout(lancer, 4000)   // filet de sécurité si une image ne répond jamais
  }

  return (
    <div className="print-modal-container" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Barre de contrôle supérieure (Masquée à l'impression) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '14px 24px', borderRadius: 16, border: `2px solid ${theme.primaryColor}`, marginBottom: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{theme.icon}</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: theme.primaryColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
              PROVENANCE : {theme.name}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
              {documentTitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleTriggerPrint}
            style={{
              background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
              color: '#ffffff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 10,
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: `0 4px 14px ${theme.primaryColor}55`,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>🖨️ Imprimer / Télécharger PDF (A4)</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: '#64748b', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
            >
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* SUPPORT D'IMPRESSION MASTER TEMPLATE (PAGE A4 RENDUE AVEC CODE COULEUR PAR PROVENANCE) */}
      <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 0' }}>
        <div
          id="official-department-document"
          style={{
            width: 820,
            maxWidth: '100%',
            margin: '0 auto',
            background: 'linear-gradient(180deg, #fffdfa 0%, #faf8f5 100%)',
            padding: '2.5rem 1.8rem',
            boxSizing: 'border-box',
            borderRadius: 32,
            boxShadow: '0 25px 60px rgba(0,0,0,0.12)',
            border: `3px double ${theme.primaryColor}`,
            position: 'relative',
            color: '#0f172a'
          }}
        >
        {/* Filigrane de sécurité couronne impériale */}
        <div style={{ position: 'absolute', top: -40, right: -40, fontSize: 280, opacity: 0.03, pointerEvents: 'none' }}>👑</div>

        {/* EN-TÊTE ÉLÉGANT LUXE : LOGO À GAUCHE SANS CERCLE & NOM ÉCOLE GRAND & TITRE DE DOCUMENT */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 24, borderBottom: `2px solid ${theme.primaryColor}55`, paddingBottom: 24, marginBottom: 24 }}>
          <img src="/logo-ideal.png" alt="IDEAL" style={{ height: 95, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.08))' }} />

          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: theme.primaryColor, letterSpacing: '1px', textTransform: 'uppercase' }}>
              ÉCOLE INTERNATIONALE BILINGUE IDEAL
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a', letterSpacing: '1.5px', marginTop: 2 }}>
              {documentTitle}
            </div>
          </div>
        </div>

        {/* BARRE BLEU FONCÉ DE PROVENANCE & PERIODE */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-block', background: '#0f172a', color: '#ffffff', padding: '14px 44px', borderRadius: 36, border: `2.5px solid ${theme.primaryColor}`, boxShadow: '0 6px 20px rgba(15,23,42,0.25)' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', letterSpacing: '2px', textTransform: 'uppercase' }}>
              {subTitlePill || theme.pillText}
            </div>
          </div>
        </div>

        {/* FICHE ÉLÈVE / CONCERNÉ SI DISPONIBLE */}
        {eleveInfo && (
          <div style={{ background: theme.cardBg, borderRadius: 24, padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {eleveInfo.nom && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: theme.primaryColor, textTransform: 'uppercase', display: 'block' }}>ÉLÈVE / CONCERNÉ</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>{eleveInfo.nom}</span>
                </div>
              )}
              {eleveInfo.matricule && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: theme.primaryColor, textTransform: 'uppercase', display: 'block' }}>MATRICULE</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: theme.primaryColor }}>{eleveInfo.matricule}</span>
                </div>
              )}
              {eleveInfo.classe && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: theme.primaryColor, textTransform: 'uppercase', display: 'block' }}>CLASSE</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: theme.secondaryColor }}>{eleveInfo.classe}</span>
                </div>
              )}
              {eleveInfo.date && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 900, color: theme.primaryColor, textTransform: 'uppercase', display: 'block' }}>DATE DE DÉLIVRANCE</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{eleveInfo.date}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CORPS DE CONTENU DU DOCUMENT (DEVOIRS, RECOUVREMENT, REÇUS, BULLETINS ETC) */}
        <div style={{ marginBottom: 32 }}>
          {children}
        </div>

        {/* PIED DE PAGE ET SCEAU DE PROVENANCE OFFICIELLE */}
        <div style={{ borderTop: `2px solid ${theme.primaryColor}44`, paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ background: theme.cardBg, border: `1.5px solid ${theme.primaryColor}`, borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 900, color: theme.primaryColor, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{theme.icon}</span> {theme.sealText}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
            {theme.serviceTitle} — ÉCOLE INTERNATIONALE BILINGUE IDEAL
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}
