import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('public/inscription.html', 'utf8')
const test = (nom, condition) => { assert.ok(condition, nom); console.log(`PASS — ${nom}`) }

test('le cadre de rognage est agrandi sur tablette', /max-width:720px; height:min\(75vh, 640px\)/.test(source))
test('le cadrage officiel est un portrait 4:5', /aspectRatio:\s*4\s*\/\s*5/.test(source))
test('la photo exportée conserve le ratio 4:5', /width:\s*480,[\s\S]{0,100}height:\s*600/.test(source))
test('la qualité de sortie est suffisante pour les documents', /imageSmoothingQuality:\s*'high'/.test(source) && /toDataURL\('image\/jpeg',\s*0\.86\)/.test(source))
test('une consigne demande de conserver tête et épaules', /tête entière et les épaules/.test(source))
test('le PDF contient la photo sans la déformer', /Math\.min\(PHOTO_W \/ ph\.width, PHOTO_H \/ ph\.height\)/.test(source))
