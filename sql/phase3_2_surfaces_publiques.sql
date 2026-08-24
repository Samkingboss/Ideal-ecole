-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 3 — ÉTAPE 2 : LES SURFACES PUBLIQUES MINIMALES
-- ═══════════════════════════════════════════════════════════════════════
--
-- ADDITIF. Aucune table modifiée, aucune politique posée, rien de cassé.
-- Cette étape crée seulement les fonctions qui permettront, à l'étape 3,
-- de fermer les tables sans supprimer un usage légitime.
--
-- ── Le problème ────────────────────────────────────────────────────────
--
-- Trois workflows publics lisent aujourd'hui des tables entières avec la
-- clé publiable — celle qui se trouve, par construction, dans le
-- navigateur de tout visiteur :
--
--   1. `fiche.html`      vérification du QR d'une carte scolaire
--   2. `chercherEtPreremplir()`  pré-remplissage d'un réinscrit
--   3. `verifierDoublon()`       refus d'une inscription en double
--
-- Le deuxième est le plus exposé : il lit l'inscription ENTIÈRE et le
-- responsable ENTIER à partir d'un simple nom. Connaître le nom d'un
-- enfant suffit à obtenir l'adresse du domicile, les deux téléphones, le
-- WhatsApp, le courriel, la profession et l'employeur de ses parents.
--
-- ── Le principe ────────────────────────────────────────────────────────
--
--   FORMULAIRE PUBLIC D'INSCRIPTION  ≠  LECTURE PUBLIQUE DES DOSSIERS
--   QR PUBLIC                        ≠  ACCÈS AU DOSSIER ÉLÈVE
--
-- Chaque fonction ci-dessous renvoie le strict minimum. Aucune ne renvoie
-- une ligne complète que le frontend masquerait ensuite : le masquage
-- côté écran n'est pas de la sécurité, c'est de la présentation.
--
-- ── Le facteur de connaissance ─────────────────────────────────────────
--
-- Un nom n'est pas un secret. Un matricule l'est davantage : il est
-- imprimé sur la carte de l'élève et sur son dossier, et seule la famille
-- l'a en main. Le pré-remplissage passe donc du nom au matricule.

begin;

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · VÉRIFICATION D'UNE CARTE SCOLAIRE  (cible du QR)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ce que le QR doit permettre : dire si la carte est authentique, et de
-- qui elle est. Rien d'autre. Ni allergies, ni adresse, ni contacts des
-- parents, ni scolarité antérieure.
--
-- Un matricule inconnu ne provoque pas d'erreur : il répond « non
-- reconnue ». Distinguer les deux cas donnerait un oracle pour énumérer
-- les matricules valides.

create or replace function public.verifier_carte_scolaire(p_matricule text)
returns table (
  reconnue       boolean,
  nom            text,
  prenom         text,
  classe         text,
  annee_scolaire text,
  statut         text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    i.id is not null                              as reconnue,
    i.nom, i.prenom,
    -- La classe demandée est la seule information de classe portée par
    -- l'inscription ; l'affectation réelle vit sur l'élève.
    coalesce(c.nom, i.classe_demandee)            as classe,
    i.annee_scolaire,
    case when i.statut = 'validee' then 'validee' else 'en_attente' end
  from (select 1) z
  left join public.inscriptions i
         on upper(btrim(i.matricule)) = upper(btrim(p_matricule))
  left join public.eleves e on e.inscription_id = i.id
  left join public.classes c on c.id = e.classe_id
  limit 1;
$function$;

comment on function public.verifier_carte_scolaire(text) is
  'Verification publique d''une carte scolaire. Renvoie le strict minimum : '
  'authenticite, identite de l''eleve, classe, annee. Jamais de donnee '
  'familiale, medicale ou d''adresse.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · REFUS D'UNE INSCRIPTION EN DOUBLE
-- ═══════════════════════════════════════════════════════════════════════
--
-- Le formulaire doit pouvoir dire « ce nom existe déjà en CP1 » sans
-- ouvrir le dossier. Le demandeur a lui-même saisi le nom : le lui
-- renvoyer n'apprend rien. La classe et l'année, en revanche, suffisent
-- à l'avertir utilement.

create or replace function public.verifier_doublon_inscription(
  p_nom text, p_prenom text
)
returns table (classe_demandee text, annee_scolaire text, depose_le date)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select i.classe_demandee, i.annee_scolaire, i.created_at::date
    from public.inscriptions i
   -- `unaccent_simple` met deja en minuscules : pas de `lower` en plus.
   where public.unaccent_simple(btrim(i.nom))    = public.unaccent_simple(btrim(p_nom))
     and public.unaccent_simple(btrim(i.prenom)) = public.unaccent_simple(btrim(p_prenom))
   order by i.created_at desc
   limit 5;
$function$;

comment on function public.verifier_doublon_inscription(text, text) is
  'Signale qu''un dossier existe deja pour ce nom, sans rien reveler du '
  'dossier lui-meme. Ni matricule, ni responsable, ni coordonnees.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3 · PRÉ-REMPLISSAGE D'UNE RÉINSCRIPTION
-- ═══════════════════════════════════════════════════════════════════════
--
-- Rendre à une famille ses propres données pour lui éviter de tout
-- ressaisir. La clé est le MATRICULE, imprimé sur la carte et le dossier
-- de l'enfant : la famille l'a, un curieux ne l'a pas.
--
-- Les champs renvoyés sont ceux que le formulaire pré-remplit, et
-- seulement ceux-là. La profession et l'employeur du responsable n'en
-- font pas partie : le formulaire ne les pré-remplissait pas.

create or replace function public.prefill_reinscription(p_matricule text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case when i.id is null then null else jsonb_build_object(
    'eleve', jsonb_build_object(
      'nom', i.nom, 'prenom', i.prenom, 'sexe', i.sexe,
      'date_naissance', i.date_naissance, 'lieu_naissance', i.lieu_naissance,
      'nationalite', i.nationalite, 'langue_maison', i.langue_maison,
      'classe_precedente', i.classe_demandee, 'ancienne_ecole', i.ancienne_ecole,
      'adresse', i.adresse),
    'responsable', case when r.id is null then null else jsonb_build_object(
      'nom', r.nom, 'prenom', r.prenom, 'lien_parente', r.lien_parente,
      'tel1', r.tel1, 'tel2', r.tel2, 'whatsapp', r.whatsapp,
      'email', r.email, 'adresse', r.adresse) end
  ) end
  from public.inscriptions i
  left join public.responsables r on r.id = i.responsable1_id
  where upper(btrim(i.matricule)) = upper(btrim(p_matricule))
  limit 1;
$function$;

comment on function public.prefill_reinscription(text) is
  'Rend a une famille ses propres donnees pour une reinscription. Clef : le '
  'matricule, que seule la famille detient. Remplace une recherche par nom '
  'qui ouvrait le dossier de n''importe qui.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4 · COMPTEURS PUBLICS
-- ═══════════════════════════════════════════════════════════════════════
--
-- La page d'accueil affiche deux nombres. Un compte n'est pas une donnée
-- personnelle ; le rendre par une fonction évite d'avoir à laisser la
-- table lisible pour deux entiers.

create or replace function public.compteurs_inscriptions()
returns table (total bigint, cantine bigint)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select count(*), count(*) filter (where i.cantine is true)
    from public.inscriptions i;
$function$;

-- ═══════════════════════════════════════════════════════════════════════
-- 5 · DROITS
-- ═══════════════════════════════════════════════════════════════════════
--
-- `anon` peut exécuter ces quatre fonctions, et rien de plus. C'est
-- exactement la surface publique dont les workflows légitimes ont besoin.

grant execute on function public.verifier_carte_scolaire(text)          to anon, authenticated;
grant execute on function public.verifier_doublon_inscription(text, text) to anon, authenticated;
grant execute on function public.prefill_reinscription(text)            to anon, authenticated;
grant execute on function public.compteurs_inscriptions()               to anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- Une carte connue est reconnue, et ne renvoie que six colonnes.
select * from public.verifier_carte_scolaire('26-27 A001');
-- attendu : reconnue = true, nom/prenom/classe/annee, statut

-- Une carte inconnue ne provoque pas d'erreur.
select reconnue from public.verifier_carte_scolaire('MATRICULE-QUI-N-EXISTE-PAS');
-- attendu : reconnue = false

-- Le doublon se signale sans rien reveler du dossier.
select * from public.verifier_doublon_inscription('TEST-INTEGRATION', 'Enfant');
-- attendu : une ligne classe/annee/date, aucune donnee personnelle

-- Le prefill exige le matricule.
select public.prefill_reinscription('26-27 A001') is not null as avec_matricule,
       public.prefill_reinscription('inexistant') is null      as sans_matricule;
-- attendu : true | true

-- Les compteurs.
select * from public.compteurs_inscriptions();
-- attendu : total = 7
