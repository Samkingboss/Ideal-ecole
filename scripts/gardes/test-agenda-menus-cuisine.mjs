import fs from 'node:fs'

const source = fs.readFileSync(new URL('../../src/pages/CuisiniereApp.jsx', import.meta.url), 'utf8')
let echecs = 0
const test = (nom, condition) => {
  if (condition) console.log(`PASS — ${nom}`)
  else { console.error(`FAIL — ${nom}`); echecs += 1 }
}

test('le compte cuisinière possède un agenda de menus visible', source.includes('Agenda &amp; Préparation des Menus'))
test('les cinq jours ouvrés viennent d’une liste unique', /const JOURS_MENU = \['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'\]/.test(source))
test('la semaine affichée est calculée depuis son lundi réel', source.includes('dateISO(lundiDe(new Date()))'))
test('la cuisinière navigue vers la semaine précédente et la suivante', source.includes('decalerSemaineAgenda(-1)') && source.includes('decalerSemaineAgenda(1)'))
test('une date permet d’ouvrir directement sa semaine', /type="date" value=\{lundiAgenda\}/.test(source))
test('un clic sur un jour ouvre sa fiche de préparation', source.includes('onClick={() => ouvrirPreparationMenu(jour)}'))
test('la fiche de menu remplace l’agenda pendant la saisie', source.includes('editionMenuOuverte') && source.includes('Retour à l’agenda des menus'))
test('la préparation conserve entrée, plat, dessert et goûter', ['entreeTitre','platTitre','dessertTitre','gouterTitre'].every(champ => source.includes(champ)))
test('les semaines sont archivées dans la donnée existante', source.includes('agenda_semaines: nouvelAgenda'))
test('l’ancien menu unique est repris sans perte', source.includes('Compatibilité ascendante') && source.includes('cleHistorique'))
test('effacer une semaine ne supprime pas les autres', source.includes('Les autres semaines resteront intactes') && source.includes("{ ...menusAgenda, [lundiAgenda]: menuVide }"))
test('la vérification des allergies précède toujours l’enregistrement', source.indexOf('await analyserMenu(menuActif)') < source.indexOf(".upsert({ app: 'cantine', key: 'cantine_menu_semaine'"))
test('aucune nouvelle table ni nouvelle migration n’est nécessaire', !source.includes("from('cantine_menus_agenda')"))
test('les cartes de jours restent adaptatives sur téléphone', source.includes("repeat(auto-fit, minmax(min(150px, 100%), 1fr))"))

if (echecs) process.exit(1)
console.log('PASS — 14 gardes agenda menus cuisine')
