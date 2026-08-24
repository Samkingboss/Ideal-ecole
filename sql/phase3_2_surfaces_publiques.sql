-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 3 — ÉTAPE 2 : LES SURFACES PUBLIQUES MINIMALES
-- ═══════════════════════════════════════════════════════════════════════
--
-- ADDITIF. Aucune table modifiée, aucune politique posée, rien de cassé.
--
-- ── Version corrigée après audit de sécurité du 24/08/2026 ─────────────
--
-- La première version de ce fichier contenait DEUX fonctions qui ont été
-- retirées, et une troisième qui a été durcie. Le raisonnement qui les
-- avait produites était faux ; il est consigné ici pour qu'il ne soit pas
-- refait.
--
--   RETIRÉE · prefill_reinscription(matricule)
--
--     Elle rendait l'adresse, les téléphones, le WhatsApp, le courriel du
--     responsable — à quiconque présentait un matricule. Or le matricule
--     est IMPRIMÉ SUR LA CARTE DE L'ÉLÈVE. Il identifie un dossier ; il ne
--     prouve rien et n'autorise rien. Remplacer une recherche par nom par
--     une recherche par matricule ne corrigeait pas la faille : elle la
--     déplaçait.
--
--     Le pré-remplissage d'une réinscription exige une VRAIE preuve
--     d'autorisation — un jeton non prédictible, émis par l'école et
--     transmis à la famille par le canal officiel. C'est l'objet de
--     l'étape 3, et il n'a pas sa place ici.
--
--   RETIRÉE · verifier_doublon_inscription(nom, prenom)
--
--     Elle répondait, à partir d'un simple nom, qu'un enfant est inscrit
--     et dans quelle classe. C'est un oracle d'appartenance : il permet de
--     demander « cet enfant est-il scolarisé à IDEAL ? » sur n'importe
--     quel nom. Le refus d'un doublon appartient au moment de la
--     SOUMISSION, côté serveur, où le demandeur n'apprend rien sur les
--     autres — étape 3.
--
--   DURCIE · verifier_carte_scolaire
--
--     Elle acceptait le seul matricule. Or les matricules sont
--     séquentiels — vérifié : 26-27 A001 à A007 — et une boucle de
--     quelques lignes aurait suffi à extraire le nom et la classe de tous
--     les élèves de l'école. Un trombinoscope complet, servi par une
--     fonction destinée à vérifier une carte.
--
--     Elle exige désormais le matricule ET le nom.
--
--     ATTENTION AU VOCABULAIRE : ce ne sont PAS deux facteurs
--     d'authentification. Les deux sont imprimés sur la même carte ; qui
--     tient la carte tient les deux. Ils n'authentifient personne.
--
--     Ils servent à une chose et une seule : empêcher l'énumération
--     triviale de matricules séquentiels. Sans le nom, une boucle de
--     quelques lignes extrayait le trombinoscope de l'école. Avec lui, il
--     faut déjà tenir la carte — et alors on ne DÉCOUVRE plus rien, on
--     CONFIRME ce qui y est écrit.
--
--       matricule + nom  →  vérification minimale d'une carte
--       matricule + nom  ↛  autorisation d'accès au dossier
--
-- ── Le principe ────────────────────────────────────────────────────────
--
--   MATRICULE ≠ SECRET  ≠ PREUVE D'IDENTITÉ  ≠ AUTORISATION D'ACCÈS
--
--   FORMULAIRE PUBLIC D'INSCRIPTION  ≠  LECTURE PUBLIQUE DES DOSSIERS
--   QR PUBLIC                        ≠  ACCÈS AU DOSSIER ÉLÈVE

begin;

-- ═══════════════════════════════════════════════════════════════════════
-- 1 · VÉRIFICATION D'UNE CARTE SCOLAIRE  (cible du QR)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Entrée : ce qui est IMPRIMÉ SUR LA CARTE — le matricule et le nom.
-- Sortie : la carte est-elle authentique, et la classe.
--
-- Rien d'autre. Ni allergies, ni adresse, ni date de naissance, ni
-- contacts des parents, ni scolarité antérieure, ni statut du dossier.
--
-- Trois refus se ressemblent volontairement — matricule inconnu, nom qui
-- ne correspond pas, argument vide. Tous répondent « non reconnue » sans
-- dire pourquoi : distinguer les cas donnerait la carte au tricheur.
--
-- La fonction renvoie TOUJOURS exactement une ligne. Une réponse vide et
-- une réponse négative ne doivent pas se distinguer à la durée ni à la
-- forme.

create or replace function public.verifier_carte_scolaire(
  p_matricule text,
  p_nom       text
)
returns table (
  reconnue       boolean,
  prenom         text,
  nom            text,
  classe         text,
  annee_scolaire text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with correspondance as (
    select i.prenom, i.nom,
           coalesce(c.nom, i.classe_demandee) as classe,
           i.annee_scolaire
      from public.inscriptions i
      left join public.eleves  e on e.inscription_id = i.id
      left join public.classes c on c.id = e.classe_id
     where nullif(btrim(coalesce(p_matricule, '')), '') is not null
       and nullif(btrim(coalesce(p_nom, '')), '')       is not null
       and upper(btrim(i.matricule)) = upper(btrim(p_matricule))
       -- Le nom est comparé sans accents ni casse : il est recopié à la
       -- main depuis la carte, pas choisi dans une liste.
       and public.unaccent_simple(btrim(i.nom)) = public.unaccent_simple(btrim(p_nom))
     limit 1
  )
  select coalesce((select true from correspondance), false),
         (select prenom from correspondance),
         (select nom from correspondance),
         (select classe from correspondance),
         (select annee_scolaire from correspondance);
$function$;

comment on function public.verifier_carte_scolaire(text, text) is
  'Verification publique d''une carte scolaire. Exige le matricule ET le nom, '
  'tous deux imprimes sur la carte : on CONFIRME une identite, on ne la '
  'DECOUVRE pas. Les matricules etant sequentiels, le matricule seul aurait '
  'permis d''extraire le trombinoscope de l''ecole. Ne renvoie jamais de '
  'donnee familiale, medicale, ni de date de naissance.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2 · DROITS
-- ═══════════════════════════════════════════════════════════════════════
--
-- `anon` n'obtient QU'UNE fonction. C'est toute la surface publique de
-- lecture dont IDEAL a besoin.
--
-- `compteurs_inscriptions` a été retirée de ce fichier. Elle ne servait
-- qu'à afficher « X élèves inscrits » sur la page d'accueil : de la
-- vitrine, pas un workflow. Le public n'a pas besoin de connaître les
-- effectifs de l'école pour vérifier une carte, et une fonction publique
-- qui n'est indispensable à rien ne doit pas exister. Le compte se lit
-- directement en SQL, côté administration.
--
-- L'ancienne signature à un seul argument est retirée si elle existe : la
-- laisser en place annulerait le durcissement, PostgreSQL choisissant la
-- surcharge selon le nombre d'arguments.

drop function if exists public.verifier_carte_scolaire(text);
drop function if exists public.verifier_doublon_inscription(text, text);
drop function if exists public.prefill_reinscription(text);
drop function if exists public.compteurs_inscriptions();

grant execute on function public.verifier_carte_scolaire(text, text) to anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — les cas qui doivent MARCHER
-- ═══════════════════════════════════════════════════════════════════════

-- CAS A · carte authentique, matricule et nom concordants.
select * from public.verifier_carte_scolaire('26-27 A001', 'TEST-INTEGRATION');
-- attendu : reconnue = true, prenom/nom/classe/annee renseignes

-- Le volume, lu directement : c'est une requête d'administration, pas une
-- API publique.
select count(*) as total_inscriptions from public.inscriptions;
-- attendu : 7


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — les cas qui doivent ÉCHOUER
-- ═══════════════════════════════════════════════════════════════════════
--
-- Une garde qui ne teste que ce qui doit marcher ne prouve rien.

-- CAS B · matricule invente.
select reconnue from public.verifier_carte_scolaire('26-27 Z999', 'TEST-INTEGRATION');
-- attendu : false

-- CAS C · matricule REEL, nom qui ne correspond pas. C'est le cas de
-- l'enumeration : celui qui compte les matricules sans connaitre les noms.
select reconnue from public.verifier_carte_scolaire('26-27 A001', 'DUPONT');
-- attendu : false

-- CAS D · nom REEL, matricule inconnu. Celui qui connait un enfant et
-- cherche son dossier.
select reconnue from public.verifier_carte_scolaire('26-27 B001', 'TEST-INTEGRATION');
-- attendu : false

-- CAS E · arguments vides ou nuls.
select reconnue from public.verifier_carte_scolaire('', '');
select reconnue from public.verifier_carte_scolaire(null::text, null::text);
-- attendu : false, false  — jamais d'erreur, jamais de ligne surprise

-- CAS F · aucune donnee privee ne peut sortir de cette fonction.
-- Les colonnes renvoyees sont figees par sa signature : cette requete
-- DOIT echouer, et c'est la preuve.
-- select adresse from public.verifier_carte_scolaire('26-27 A001', 'TEST-INTEGRATION');
-- attendu si decommentee : ERREUR « column adresse does not exist »

-- CAS G · les fonctions dangereuses n'existent plus.
select count(*) as fonctions_retirees
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('prefill_reinscription', 'verifier_doublon_inscription',
                     'compteurs_inscriptions');
-- attendu : 0

-- CAS H · la surcharge a un seul argument n'a pas survecu.
select count(*) as surcharges_matricule_seul
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'verifier_carte_scolaire'
   and p.pronargs = 1;
-- attendu : 0

-- CAS I · la surface publique de lecture se limite a une seule fonction.
select p.proname, p.pronargs
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and has_function_privilege('anon', p.oid, 'execute')
   and p.proname in ('verifier_carte_scolaire', 'compteurs_inscriptions',
                     'prefill_reinscription', 'verifier_doublon_inscription')
 order by p.proname;
-- attendu : une seule ligne — verifier_carte_scolaire | 2
