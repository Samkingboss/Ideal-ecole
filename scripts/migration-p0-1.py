#!/usr/bin/env python3
"""Migration P0-1 — les élèves et les devoirs quittent app_state.

app_state héberge aujourd'hui 12 élèves et 13 devoirs sous forme de blocs
JSON, pendant que les tables `eleves` et `devoirs` restent vides. Ce script
rétablit la source unique exigée par la règle R1 du cahier des charges V2.1.

Il est *idempotent* : relancé, il ne recrée pas ce qu'il a déjà écrit. Il ne
supprime jamais rien — app_state reste intact, en copie de sécurité, pendant
toute la phase de validation.

    python3 scripts/migration-p0-1.py            # simulation, n'écrit rien
    python3 scripts/migration-p0-1.py --executer # écrit réellement

Décisions du promoteur appliquées ici (17 août 2026) :
  · les trois identités « brielle » restent distinctes, aucune fusion ;
  · PS = Petite Section, GS = Grande Section ;
  · les données migrées ne sont pas retirées d'app_state.
"""

import base64, json, mimetypes, os, sys, urllib.error, urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXECUTER = '--executer' in sys.argv

# ── Connexion ───────────────────────────────────────────────────────────────

def env(nom):
    for ligne in open(os.path.join(RACINE, '.env.local'), encoding='utf-8'):
        if ligne.startswith(nom + '='):
            return ligne.split('=', 1)[1].strip()
    raise SystemExit(f'{nom} introuvable dans .env.local')

URL = env('VITE_SUPABASE_URL')
CLE = env('VITE_SUPABASE_ANON_KEY')
ENTETES = {'apikey': CLE, 'Authorization': 'Bearer ' + CLE, 'Content-Type': 'application/json'}


def appel(methode, chemin, corps=None, entetes=None, brut=None):
    req = urllib.request.Request(URL + chemin, method=methode)
    for k, v in {**ENTETES, **(entetes or {})}.items():
        req.add_header(k, v)
    donnees = brut if brut is not None else (json.dumps(corps).encode() if corps is not None else None)
    try:
        with urllib.request.urlopen(req, donnees) as r:
            texte = r.read().decode()
            return json.loads(texte) if texte.strip() else None
    except urllib.error.HTTPError as e:
        raise SystemExit(f'{methode} {chemin} → {e.code} {e.read().decode()[:300]}')


def lire(chemin):
    return appel('GET', '/rest/v1/' + chemin)


def ecrire(chemin, corps):
    if not EXECUTER:
        return [{'id': 'SIMULATION'}]
    return appel('POST', '/rest/v1/' + chemin, corps, {'Prefer': 'return=representation'})


# ── Correspondance des classes ──────────────────────────────────────────────
# Les devoirs désignent la maternelle par ses initiales, la table `classes` par
# son nom complet. Correspondance confirmée par le promoteur le 17 août 2026.

ABREVIATIONS = {'PS': 'Petite Section', 'GS': 'Grande Section'}


def nom_de_classe(brut):
    b = (brut or '').strip()
    return ABREVIATIONS.get(b.upper(), b)


def _date_iso(jjmmaaaa):
    """« 13/08/2026 » → « 2026-08-13 ». Renvoie None si la forme est autre."""
    morceaux = (jjmmaaaa or '').split('/')
    if len(morceaux) != 3:
        return None
    j, m, a = morceaux
    return f'{a}-{m.zfill(2)}-{j.zfill(2)}'


def couper_nom(complet):
    """Dernier mot = nom de famille, le reste = prénom.

    « Adjo brielle MOGADZI » donne « Adjo brielle » et « MOGADZI ». Couper au
    premier mot aurait produit « Adjo » / « brielle MOGADZI », ce qui est faux.
    Les doubles espaces des données de test sont normalisés.
    """
    mots = (complet or '').split()
    if not mots:
        return '', ''
    if len(mots) == 1:
        return mots[0], ''
    return ' '.join(mots[:-1]), mots[-1]


# ── Lecture de la source ────────────────────────────────────────────────────

etat = {(r['app'], r['key']): r['value'] for r in lire('app_state?select=app,key,value')}
eleves_src = etat.get(('pedago', 'ideal_students'), [])
devoirs_src = etat.get(('pedago', 'ideal_homeworks'), [])
classes = {c['nom']: c['id'] for c in lire('classes?select=id,nom')}

print(f"Source   : {len(eleves_src)} élèves, {len(devoirs_src)} devoirs dans app_state")
print(f"Classes  : {', '.join(sorted(classes))}")
print(f"Mode     : {'ÉCRITURE RÉELLE' if EXECUTER else 'SIMULATION (aucune écriture)'}\n")

# ── 1. Les élèves ───────────────────────────────────────────────────────────

print('── 1. Élèves ───────────────────────────────────────────────')
existants = {(e['prenom'], e['nom'], e['classe_id']): e['id'] for e in lire('eleves?select=id,prenom,nom,classe_id')}
correspondance = {}          # ancienne référence app_state → nouvel identifiant
anomalies = []

for e in eleves_src:
    prenom, nom = couper_nom(e.get('name'))
    classe = nom_de_classe(e.get('grade'))
    cid = classes.get(classe)
    if not cid:
        anomalies.append(f"classe inconnue « {e.get('grade')} » pour {e.get('name')}")
        continue

    cle = (prenom, nom, cid)
    if cle in existants:
        nouvel_id = existants[cle]
        print(f"  = {e['name']:26} {classe:16} déjà présent")
    else:
        cree = ecrire('eleves', {'prenom': prenom, 'nom': nom, 'classe_id': cid, 'actif': True})
        nouvel_id = cree[0]['id']
        existants[cle] = nouvel_id
        print(f"  + {e['name']:26} {classe:16} → {prenom} | {nom}")

    for ref in filter(None, [e.get('sbId'), e.get('inscriptionId')]):
        correspondance[ref if ref.startswith('ins:') else 'el:' + ref] = nouvel_id

print(f"\n  {len(eleves_src)} élèves traités · {len(correspondance)} références anciennes conservées")
for a in anomalies:
    print(f"  ⚠ {a}")

# ── 2. Les images ───────────────────────────────────────────────────────────

print('\n── 2. Images des devoirs ───────────────────────────────────')


def deposer(base64_uri, chemin):
    """Dépose une image base64 dans le bucket `devoirs` et renvoie son URL."""
    entete, _, donnees = base64_uri.partition(',')
    mime = entete.split(':')[1].split(';')[0] if ':' in entete else 'image/jpeg'
    if not EXECUTER:
        return f'{URL}/storage/v1/object/public/devoirs/{chemin}'
    octets = base64.b64decode(donnees)
    req = urllib.request.Request(f'{URL}/storage/v1/object/devoirs/{chemin}', method='POST')
    req.add_header('apikey', CLE)
    req.add_header('Authorization', 'Bearer ' + CLE)
    req.add_header('Content-Type', mime)
    try:
        urllib.request.urlopen(req, octets)
    except urllib.error.HTTPError as e:
        if e.code != 409:                      # 409 = déjà déposée, on garde l'existante
            raise SystemExit(f'dépôt {chemin} → {e.code} {e.read().decode()[:200]}')
    return f'{URL}/storage/v1/object/public/devoirs/{chemin}'


# ── 3. Les devoirs ──────────────────────────────────────────────────────────

print('\n── 3. Devoirs ──────────────────────────────────────────────')
deja = {(d.get('contenu') or {}).get('id') for d in lire('devoirs?select=contenu')}
nb_images = 0

for d in devoirs_src:
    if d.get('id') in deja:
        print(f"  = devoir {d.get('id')} déjà migré")
        continue

    classe = nom_de_classe(d.get('grade'))
    cid = classes.get(classe)

    # L'ordre des images est celui du devoir : le rang figure dans le nom du
    # fichier, pour qu'un tri alphabétique le restitue même hors de la base.
    fichiers = []
    for rang, img in enumerate(d.get('images') or [], 1):
        if not isinstance(img, str):
            continue
        if not img.startswith('data:'):
            fichiers.append({'url': img, 'nom': f'image {rang}'})
            continue
        ext = mimetypes.guess_extension(img.split(':')[1].split(';')[0]) or '.jpg'
        chemin = f"migration/{d['id']}_{rang:02d}{ext.replace('.jpeg', '.jpg')}"
        fichiers.append({'url': deposer(img, chemin), 'nom': f'image {rang}'})
        nb_images += 1

    contenu = {**d, 'images': [f['url'] for f in fichiers]}

    ecrire('devoirs', {
        'classe_id': cid,
        'groupe': classe,
        'matiere': (d.get('subject') or '').strip() or None,
        'description': (d.get('content') or '').strip() or (d.get('objectives') or '').strip() or None,
        'date_donne': _date_iso(d.get('date')),
        # `date_rendu` est obligatoire en base. Quand le devoir n'en porte pas,
        # on retient sa date de création plutôt que d'inventer une échéance.
        'date_rendu': d.get('dueDate') or _date_iso(d.get('date')),
        'fichiers': fichiers,
        'fichier_url': fichiers[0]['url'] if fichiers else None,
        'fichier_nom': fichiers[0]['nom'] if fichiers else None,
        'contenu': contenu,
    })
    print(f"  + {d.get('date','?'):11} {classe:16} {str(d.get('subject'))[:18]:18} {len(fichiers)} image(s)")

print(f"\n  {len(devoirs_src)} devoirs traités · {nb_images} images déposées")

# ── 4. Les rapports élèves ──────────────────────────────────────────────────

print('\n── 4. Rapports élèves ──────────────────────────────────────')
for (app, cle), valeur in etat.items():
    if app != 'rapports_eleves':
        continue
    nouvel = correspondance.get(cle)
    if not nouvel:
        print(f"  ⚠ {cle} → aucun élève correspondant, rapport laissé en place")
        continue
    neuve = f'el:{nouvel}'
    if (app, neuve) in etat:
        print(f"  = {cle} déjà rattaché")
        continue
    if EXECUTER:
        appel('POST', '/rest/v1/app_state', {'app': app, 'key': neuve, 'value': valeur},
              {'Prefer': 'resolution=merge-duplicates'})
    print(f"  + {cle}\n      → {neuve}")

print('\n' + ('Migration terminée.' if EXECUTER else 'Simulation terminée — relancer avec --executer.'))
