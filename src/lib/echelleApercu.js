// L'aperçu d'une feuille A4 à l'écran.
//
// On ne redessine pas le document plus petit : on le met à l'échelle. Le
// papier reste du A4 — c'est ce qui sortira de l'imprimante — mais son aperçu
// tient dans l'écran. `zoom` serait plus court ; `transform` est le seul des
// deux que Firefox et Safari traitent pareil, et le tirage annule la
// transformation de toute façon.
//
// Ce crochet vivait dans `DocumentPrintStudio`. Le certificat de scolarité en
// avait besoin à son tour : sur un téléphone, sa feuille de 760 px forçait un
// défilement horizontal. Deux copies auraient divergé.

import { useEffect, useRef, useState } from 'react'

export const A4_PX = 210 * 96 / 25.4   // 210 mm à 96 dpi ≈ 794 px

/**
 * `cadre`  — à poser sur le conteneur qui donne la largeur disponible.
 * `docRef` — à poser sur le document à sa taille réelle.
 *
 * Rend `echelle` (jamais > 1 : on ne grossit pas un A4) et `hauteurDoc`, la
 * hauteur réelle du document. Le conteneur doit reprendre `hauteurDoc *
 * echelle` : `transform` ne change pas la place occupée dans le flux, et sans
 * cela l'aperçu laisserait sous lui un vide de la hauteur pleine.
 */
export const useEchelleFeuille = (largeurReference = A4_PX) => {
  const cadre  = useRef(null)
  const docRef = useRef(null)
  const [echelle, setEchelle] = useState(1)
  const [hauteurDoc, setHauteurDoc] = useState(0)

  useEffect(() => {
    const zone = cadre.current
    if (!zone) return
    const mesurer = () => {
      const dispo = zone.clientWidth
      if (dispo) setEchelle(Math.min(1, dispo / largeurReference))
      if (docRef.current) setHauteurDoc(docRef.current.scrollHeight)
    }
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(zone)
    if (docRef.current) ro.observe(docRef.current)
    window.addEventListener('orientationchange', mesurer)
    return () => { ro.disconnect(); window.removeEventListener('orientationchange', mesurer) }
  })

  return { cadre, docRef, echelle, hauteurDoc }
}
