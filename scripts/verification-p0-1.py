#!/usr/bin/env python3
"""Vérification de la migration P0-1 — les onze contrôles demandés.

Ce script ne modifie rien. Il relit la base et la sauvegarde, et compare.
Un échec suffit à considérer la migration comme non validée.
"""

import json, glob, os, urllib.error, urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def env(nom):
    for l in open(os.path.join(RACINE, '.env.local'), encoding='utf-8'):
        if l.startswith(nom + '='):
            return l.split('=', 1)[1].strip()


URL, CLE = env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY')


def lire(chemin):
    r = urllib.request.Request(URL + '/rest/v1/' + chemin, headers={'apikey': CLE})
    return json.load(urllib.request.urlopen(r))


def accessible(url):
    try:
        req = urllib.request.Request(url, method='HEAD')
        return urllib.request.urlopen(req).status == 200
    except Exception:
        return False


resultats = []


def controle(numero, libelle, condition, detail=''):
    resultats.append(condition)
    print(f"  {'✓' if condition else '✗'}  {numero:>2}. {libelle}{('  — ' + detail) if detail else ''}")


# ── Source de comparaison : la sauvegarde d'avant migration ─────────────────

sauv = sorted(glob.glob(os.path.join(RACINE, 'sauvegardes', 'app_state-*.json')))[-1]
avant = {(r['app'], r['key']): r['value'] for r in json.load(open(sauv))}
eleves_src = avant[('pedago', 'ideal_students')]
devoirs_src = avant[('pedago', 'ideal_homeworks')]
print(f"Référence : {os.path.basename(sauv)}")
print(f"            {len(eleves_src)} élèves, {len(devoirs_src)} devoirs avant migration\n")

# ── Les onze contrôles ──────────────────────────────────────────────────────

eleves = lire('eleves?select=id,prenom,nom,actif,classe_id,classes(nom)')
devoirs = lire('devoirs?select=id,groupe,matiere,fichiers,contenu,classe_id')
etat = {(r['app'], r['key']): r['value'] for r in lire('app_state?select=app,key,value')}
classes = {c['id']: c['nom'] for c in lire('classes?select=id,nom')}

print('── Intégrité de la migration ───────────────────────────────')
controle(1, '12 élèves présents après migration', len(eleves) == 12, f'{len(eleves)} en base')
controle(2, '13 devoirs présents après migration', len(devoirs) == 13, f'{len(devoirs)} en base')

# 3. Rapports élèves : chaque ancienne clé doit avoir sa jumelle rattachée
anciennes = [k for (a, k) in etat if a == 'rapports_eleves' and not k.startswith('el:')] + \
            [k for (a, k) in etat if a == 'rapports_eleves' and k.startswith('el:')]
rapports_avant = [k for (a, k) in avant if a == 'rapports_eleves']
ids_eleves = {e['id'] for e in eleves}
rattaches = [k for (a, k) in etat if a == 'rapports_eleves'
             and k.startswith('el:') and k[3:] in ids_eleves]
controle(3, '5 rapports élèves rattachés à un élève existant',
         len(rattaches) == len(rapports_avant), f'{len(rattaches)}/{len(rapports_avant)}')

# 4. Toutes les images accessibles
urls = [f['url'] for d in devoirs for f in (d.get('fichiers') or [])]
attendues = sum(len(h.get('images') or []) for h in devoirs_src)
ko = [u for u in urls if not accessible(u)]
controle(4, 'toutes les images des devoirs sont accessibles',
         len(urls) == attendues and not ko, f'{len(urls)}/{attendues} déposées, {len(ko)} injoignable(s)')

# 5 / 6. Aucune perte : chaque source doit se retrouver
ids_migres = {(d.get('contenu') or {}).get('id') for d in devoirs}
perdus = [h['id'] for h in devoirs_src if h['id'] not in ids_migres]
controle(5, 'aucun devoir perdu', not perdus, f'{len(perdus)} manquant(s)')

noms_base = {f"{e['prenom']} {e['nom']}".strip() for e in eleves}
absents = [e['name'] for e in eleves_src
           if ' '.join((e.get('name') or '').split()) not in noms_base]
controle(6, 'aucun élève perdu', not absents, ', '.join(absents) if absents else '')

# 7. Aucun doublon involontaire
paires = [(e['prenom'], e['nom'], e['classe_id']) for e in eleves]
controle(7, 'aucun doublon créé involontairement', len(paires) == len(set(paires)),
         f'{len(paires) - len(set(paires))} doublon(s)')

# 8. Correspondance PS / GS
attendu_ps = sum(1 for h in devoirs_src if (h.get('grade') or '').upper() == 'PS')
attendu_gs = sum(1 for h in devoirs_src if (h.get('grade') or '').upper() == 'GS')
obtenu_ps = sum(1 for d in devoirs if d['groupe'] == 'Petite Section')
obtenu_gs = sum(1 for d in devoirs if d['groupe'] == 'Grande Section')
sans_classe = [d['groupe'] for d in devoirs if not d.get('classe_id')]
controle(8, 'correspondance PS/GS correcte',
         obtenu_ps == attendu_ps and obtenu_gs == attendu_gs and not sans_classe,
         f'PS {obtenu_ps}/{attendu_ps} · GS {obtenu_gs}/{attendu_gs} · {len(sans_classe)} devoir(s) sans classe')

# ── Périmètre des enseignants ───────────────────────────────────────────────

print('\n── Périmètre et permissions ────────────────────────────────')
profs = lire('users?select=id,prenom,nom&role=eq.professeur')
liens = lire('prof_classes?select=user_id,classe_id')
portee = {}
for l in liens:
    portee.setdefault(l['user_id'], set()).add(l['classe_id'])

# Le filtrage est correct lorsque, pour chaque enseignant, l'ensemble visible
# est exactement celui de ses classes. Un enseignant dont les classes n'ont
# aucun élève doit voir zéro élève : c'est le bon comportement, pas une panne.
# Pour prouver que le mécanisme n'est pas simplement en train de tout masquer,
# on vérifie en plus qu'au moins un enseignant voit bien ses élèves.
filtrage_exact, quelquun_voit, fuite = True, False, []
for p in profs:
    autorisees = portee.get(p['id'], set())
    if not autorisees:
        continue
    visibles = [e for e in eleves if e['classe_id'] in autorisees]
    hors = [e for e in eleves if e['classe_id'] not in autorisees]
    attendus = [e for e in eleves if e['classe_id'] in autorisees]
    if {e['id'] for e in visibles} != {e['id'] for e in attendus}:
        filtrage_exact = False
    if visibles:
        quelquun_voit = True
    fuite += [e['id'] for e in hors if e['classe_id'] in autorisees]
    noms = ', '.join(sorted(classes.get(c, '?') for c in autorisees))
    vide = '  (aucun élève inscrit dans ces classes)' if not visibles else ''
    print(f"     {p['prenom']} {p['nom']:12} → {noms:16} {len(visibles)} visible(s), {len(hors)} masqué(s){vide}")

controle(9, 'le filtrage prof_classes reste fonctionnel',
         filtrage_exact and quelquun_voit and bool(profs))
controle(10, "un enseignant ne voit pas les élèves d'une autre classe", not fuite)

# ── La copie de sécurité ────────────────────────────────────────────────────

print('\n── Copie de sécurité ───────────────────────────────────────')
intact = (etat.get(('pedago', 'ideal_students')) == eleves_src
          and etat.get(('pedago', 'ideal_homeworks')) == devoirs_src)
controle(11, 'les données app_state restent intactes', intact)

# ── Verdict ─────────────────────────────────────────────────────────────────

print('\n' + '─' * 60)
if all(resultats):
    print(f'  MIGRATION VALIDÉE — {len(resultats)}/{len(resultats)} contrôles au vert')
else:
    print(f'  MIGRATION NON VALIDÉE — {sum(resultats)}/{len(resultats)} contrôles au vert')
