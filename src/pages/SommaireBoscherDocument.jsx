import React from 'react'
import html2canvas from 'html2canvas'
import DocumentPrintStudio from './DocumentPrintStudio'

export default function SommaireBoscherDocument({ onClose = null }) {
  const handleExportJpeg = async () => {
    const elem = document.getElementById('sommaire-boscher-print-area')
    if (!elem) return
    try {
      const canvas = await html2canvas(elem, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#fffdfa',
        logging: false
      })
      const dataUrl = canvas.toDataURL('image/jpeg', 0.98)
      const link = document.createElement('a')
      link.download = 'Sommaire_Officiel_Methode_Boscher.jpg'
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error(err)
      alert('Erreur lors du téléchargement : ' + err.message)
    }
  }

  return (
    <DocumentPrintStudio
      type="pedagogie"
      documentTitle="MÉTHODE BOSCHER — SOMMAIRE OFFICIEL PAGINÉ"
      subTitlePill="📖 PROGRAMME DE LECTURE SYLLABIQUE (PAGES 4 À 72 DU MANUEL)"
      onClose={onClose}
      onPrint={handleExportJpeg}
    >
      {/* BOUTON SPÉCIAL TÉLÉCHARGEMENT JPEG HD EN EN-TÊTE DU MODAL */}
      <div className="no-print" style={{ marginBottom: 20, textAlign: 'center' }}>
        <button
          onClick={handleExportJpeg}
          style={{
            background: 'linear-gradient(135deg, #047857, #0284c7)',
            color: '#ffffff',
            border: 'none',
            padding: '12px 26px',
            borderRadius: 14,
            fontWeight: 900,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(4,120,87,0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          📸 Télécharger la Fiche Sommaire Boscher (JPEG HD)
        </button>
      </div>

      <div id="sommaire-boscher-print-area" style={{ background: '#fffdfa', padding: '24px 18px', borderRadius: 20 }}>
        {/* BANDEAU EN-TÊTE PÉDAGOGIQUE */}
        <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '2px double #d97706' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#d97706', letterSpacing: '2px', textTransform: 'uppercase' }}>
            ÉCOLE INTERNATIONALE BILINGUE IDEAL
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
            MÉTHODE BOSCHER — LA JOURNÉE DES TOUT PETITS
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#047857' }}>
            Sommaire Officiel et Référentiel de la Pagination Imprimée (Pages 4 à 72)
          </div>
        </div>

        {/* --- PARTIE LIMINAIRE --- */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: '#0f172a', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 900, marginBottom: 10 }}>
            🏛️ PARTIE LIMINAIRE (Pages 1 à 3 du manuel)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
            <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Pages 1 - 2 :</span> Page de titre et crédits d'édition (Éditions Belin)
            </div>
            <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Page 3 :</span> Préface &amp; Conseils Pédagogiques aux enseignants et aux parents
            </div>
          </div>
        </div>

        {/* --- PREMIÈRE PARTIE : L'APPRENTISSAGE SYLLABIQUE --- */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ background: '#047857', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 900, marginBottom: 12 }}>
            🔤 PREMIÈRE PARTIE : L'Apprentissage Syllabique (Pages 4 à 57 du livre)
          </div>

          {/* Phase 1 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#047857', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
              🔹 Phase 1 : Les Voyelles &amp; Premières Consonnes (Pages 4 à 13)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 6 }}>
              {[
                { p: 'Page 4', t: 'Les voyelles  i  et  u' },
                { p: 'Page 5', t: 'Les voyelles  o  et  a' },
                { p: 'Page 6', t: 'Les voyelles  e ,  é ,  è ,  ê' },
                { p: 'Page 7', t: 'Révision des voyelles et la consonne  p' },
                { p: 'Page 8', t: 'La consonne  t' },
                { p: 'Page 9', t: 'La consonne  r' },
                { p: 'Page 10', t: 'La consonne  n' },
                { p: 'Page 11', t: 'La consonne  m' },
                { p: 'Page 12', t: 'La consonne  l' },
                { p: 'Page 13', t: 'La consonne  c / k' }
              ].map((item, idx) => (
                <div key={idx} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 10px', borderRadius: 6, fontSize: 12, display: 'flex', gap: 8 }}>
                  <span style={{ fontWeight: 900, color: '#047857', minWidth: 55 }}>{item.p} :</span>
                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 2 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#0284c7', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
              🔹 Phase 2 : Consonnes Simples &amp; Sons de Base (Pages 14 à 26)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 6 }}>
              {[
                { p: 'Page 14', t: 'La consonne  d' },
                { p: 'Page 15', t: 'La consonne  v' },
                { p: 'Page 16', t: 'La consonne  s' },
                { p: 'Page 17', t: 'La consonne  b' },
                { p: 'Page 18', t: 'La consonne  f' },
                { p: 'Page 19', t: 'La consonne  j' },
                { p: 'Page 20', t: 'La consonne  g' },
                { p: 'Page 21', t: 'Le son  ch' },
                { p: 'Page 22', t: 'Le son  ou' },
                { p: 'Page 23', t: 'Le son  on' },
                { p: 'Page 24', t: 'Le son  oi' },
                { p: 'Page 25', t: 'Les sons  an  et  en' },
                { p: 'Page 26', t: 'Le son  in' }
              ].map((item, idx) => (
                <div key={idx} style={{ background: '#e0f2fe', border: '1px solid #bae6fd', padding: '6px 10px', borderRadius: 6, fontSize: 12, display: 'flex', gap: 8 }}>
                  <span style={{ fontWeight: 900, color: '#0284c7', minWidth: 55 }}>{item.p} :</span>
                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 3 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#7e22ce', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
              🔹 Phase 3 : Sons Complexes &amp; Combinatoires (Pages 27 à 41)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 6 }}>
              {[
                { p: 'Page 27', t: 'Le son  eu / œu' },
                { p: 'Page 28', t: 'Révision des sons complexes (in, oi, eu, un, on, an)' },
                { p: 'Page 29', t: 'Consonnes suivies de  r  (br, cr, dr, fr, gr, pr, tr)' },
                { p: 'Page 30', t: 'Consonnes suivies de  l  (bl, cl, fl, gl, pl)' },
                { p: 'Page 31', t: 'Assemblages  cl ,  cr ,  pl ,  fr' },
                { p: 'Page 32', t: 'Inversions des voyelles avec  r  (ar, er, ir, or, ur)' },
                { p: 'Page 33', t: 'Inversions des voyelles avec  l  (al, el, il, ol, ul)' },
                { p: 'Page 34', t: 'Inversions avec  c  (ac, oc, ic, uc)' },
                { p: 'Page 35', t: 'Assemblages  our ,  eur ,  oir' },
                { p: 'Page 36', t: 'Le son  ill' },
                { p: 'Page 37', t: 'Les sons  ail ,  eil ,  euil ,  eille' },
                { p: 'Page 38', t: 'Le son  eau / au' },
                { p: 'Page 39', t: 'Les sons  ien  et  oin' },
                { p: 'Page 40', t: 'Le son  gn' },
                { p: 'Page 41', t: 'Synthèse et assemblage des sons complexes' }
              ].map((item, idx) => (
                <div key={idx} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', padding: '6px 10px', borderRadius: 6, fontSize: 12, display: 'flex', gap: 8 }}>
                  <span style={{ fontWeight: 900, color: '#7e22ce', minWidth: 55 }}>{item.p} :</span>
                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 4 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#b45309', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
              🔹 Phase 4 : Règles Orthographiques &amp; Grammaire (Pages 42 à 57)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 6 }}>
              {[
                { p: 'Page 42', t: 'Terminaisons  ec ,  el ,  er ,  es' },
                { p: 'Page 43', t: 'La consonne  z  et la valeur du  s' },
                { p: 'Page 44', t: 'Les sons  ai ,  ei ,  air' },
                { p: 'Page 45', t: 'Le son  et ,  est' },
                { p: 'Page 46', t: 'Terminaisons en  é ,  er ,  et ,  ez / ier' },
                { p: 'Page 47', t: 'Le son  in  écrit  ain  et  ein' },
                { p: 'Page 48', t: 'Le son  y / yn / en' },
                { p: 'Page 49', t: 'Le son  y  décomposé (ay, oy, uy)' },
                { p: 'Page 50', t: 'Valeur du  s  entre voyelles (s = z) & c / g doux' },
                { p: 'Page 51', t: 'Le son  k  écrit  qu ,  c ,  k' },
                { p: 'Page 52', t: 'Le  g  dur écrit  gu' },
                { p: 'Page 53', t: 'Le son  f  écrit  ph  & la cédille  ç' },
                { p: 'Page 54', t: 'La règle du  m  devant  p  et  b' },
                { p: 'Page 55', t: 'Les assemblages  sp ,  st ,  str ,  scr' },
                { p: 'Page 56', t: 'Les lettres finales muettes' },
                { p: 'Page 57', t: 'Le Singulier et le Pluriel (marque du -s)' }
              ].map((item, idx) => (
                <div key={idx} style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 10px', borderRadius: 6, fontSize: 12, display: 'flex', gap: 8 }}>
                  <span style={{ fontWeight: 900, color: '#b45309', minWidth: 55 }}>{item.p} :</span>
                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- DEUXIÈME PARTIE : L'ALPHABET --- */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: '#0284c7', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 900, marginBottom: 8 }}>
            📝 DEUXIÈME PARTIE : L'Alphabet (Page 58 du livre)
          </div>
          <div style={{ background: '#e0f2fe', border: '1px solid #bae6fd', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
            <span style={{ fontWeight: 900, color: '#0284c7' }}>Page 58 :</span> Planche générale de l'alphabet (Minuscules &amp; Majuscules d'imprimerie et cursives)
          </div>
        </div>

        {/* --- TROISIÈME PARTIE : MORCEAUX CHOISIS --- */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: '#7e22ce', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 900, marginBottom: 10 }}>
            📖 TROISIÈME PARTIE : Morceaux Choisis &amp; Lectures (Pages 59 à 72)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 6 }}>
            {[
              { p: 'Page 59', t: 'La petite Poule rouge' },
              { p: 'Page 60', t: 'Ma Sœur la pluie' },
              { p: 'Page 61', t: 'Le petit Poucet' },
              { p: 'Page 62', t: 'Les lapins' },
              { p: 'Page 63', t: 'La Bique, le Loup et les Biquets' },
              { p: 'Page 64', t: 'Les chats de mon grand-père' },
              { p: 'Page 65', t: 'La pêche d\'Isengrin' },
              { p: 'Page 66', t: 'Au printemps' },
              { p: 'Page 67', t: 'La chèvre de M. Seguin' },
              { p: 'Page 68', t: 'Je suis le vent' },
              { p: 'Page 69', t: 'Le petit sapin' },
              { p: 'Page 70', t: 'Zette' },
              { p: 'Page 71', t: 'Jean et Jeanne à la pêche' },
              { p: 'Page 72', t: 'La Ronde' }
            ].map((item, idx) => (
              <div key={idx} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', padding: '6px 10px', borderRadius: 6, fontSize: 12, display: 'flex', gap: 8 }}>
                <span style={{ fontWeight: 900, color: '#7e22ce', minWidth: 55 }}>{item.p} :</span>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DocumentPrintStudio>
  )
}
