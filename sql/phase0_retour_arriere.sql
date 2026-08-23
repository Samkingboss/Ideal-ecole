-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 0 — RETOUR ARRIÈRE
-- ═══════════════════════════════════════════════════════════════════════
--
-- Écrit et testé AVANT la première commande de `phase0_1_creation.sql`.
-- C'est le seul filet : le forfait Supabase gratuit n'offre aucune
-- restauration ponctuelle.
--
-- ── L'ORDRE EST IMPÉRATIF ──────────────────────────────────────────────
--
--        LE SQL D'ABORD, LE FRONTEND ENSUITE. JAMAIS L'INVERSE.
--
-- Vercel restaure le frontend en un clic mais ne sait rien de la base.
-- Repromouvoir d'abord placerait l'ancien code face à une colonne absente :
-- plus personne ne se connecterait, et la panique conduirait à improviser.
--
-- ── `users_secrets` n'est jamais supprimée pendant un retour arrière ────
--
-- C'est la copie de sûreté des codes. Elle ne se retire qu'une fois la
-- situation stabilisée, et jamais dans l'urgence.

-- ═══════════════════════════════════════════════════════════════════════
-- CAS A — interruption AVANT `phase0_2_retrait.sql`
-- ═══════════════════════════════════════════════════════════════════════
--
-- Les colonnes existent encore et le frontend d'origine fonctionne tel
-- quel : repromouvoir le déploiement Vercel précédent suffit à revenir au
-- comportement antérieur.
--
-- ── Mais un point de SQL reste nécessaire ──────────────────────────────
--
-- L'étape 2 relâche le NOT NULL de `users.code_acces`, et la nouvelle
-- fonction range le code dans `users_secrets` sans l'écrire dans `users`.
-- Tout compte créé entre l'étape 2 et le retour arrière a donc un
-- `users.code_acces` à NULL — et le frontend d'origine, qui authentifie
-- par cette colonne, ne saurait pas le connecter.
--
-- Ce bloc remet les codes en place et rétablit la contrainte. Il est sans
-- effet si aucun compte n'a été créé pendant la fenêtre : c'est le cas
-- normal, et l'exécuter reste alors inoffensif.

begin;

update public.users u
   set code_acces = s.code_acces
  from public.users_secrets s
 where s.user_id = u.id
   and u.code_acces is null;

do $$
declare
  n_sans_code integer;
begin
  select count(*) into n_sans_code from public.users where code_acces is null;

  if n_sans_code > 0 then
    raise exception
      'ARRET : % compte(s) sans code. NE PAS repromouvoir le frontend d''origine : '
      'ces comptes ne pourraient pas se connecter. Verifier users_secrets d''abord.',
      n_sans_code;
  end if;
end
$$;

alter table public.users alter column code_acces set not null;

commit;

-- Puis, et seulement ensuite, repromouvoir le déploiement Vercel précédent.
--
-- Pour effacer complètement les traces de l'étape 2 — facultatif, la
-- présence de ces objets ne gêne rien :
--
--   drop function if exists public.desactiver_utilisateur(uuid);
--   drop function if exists public.enregistrer_utilisateur(uuid,text,text,text,text,text,text,integer);
--   drop function if exists public.authentifier_par_code(text);
--   drop table    if exists public.users_secrets;


-- ═══════════════════════════════════════════════════════════════════════
-- CAS B — interruption APRÈS `phase0_2_retrait.sql`
-- ═══════════════════════════════════════════════════════════════════════
--
-- Exécuter ce bloc EN ENTIER, puis seulement ensuite repromouvoir le
-- déploiement Vercel précédent.

begin;

-- ── 1 · Recréer les colonnes, nullables dans un premier temps ──────────
--
-- `code_acces` porte un NOT NULL à l'origine. L'ajouter d'emblée ferait
-- échouer l'ALTER sur une table non vide. On restaure la contrainte à
-- l'étape 4, une fois les valeurs remises.

alter table public.users add column if not exists code_acces      text;
alter table public.users add column if not exists plafond_salaire integer;

-- ── 2 · Restaurer les valeurs depuis la copie de sûreté ────────────────

update public.users u
   set code_acces      = s.code_acces,
       plafond_salaire = s.plafond_salaire
  from public.users_secrets s
 where s.user_id = u.id;

-- ── 3 · Assertion : aucun compte ne doit rester sans code ──────────────
--
-- Sans ce contrôle, l'étape 4 échouerait sur la contrainte NOT NULL et
-- laisserait la base à mi-chemin.

do $$
declare
  n_sans_code integer;
begin
  select count(*) into n_sans_code
    from public.users where code_acces is null;

  if n_sans_code > 0 then
    raise exception
      'ARRET : % compte(s) sans code apres restauration. NE PAS repromouvoir le frontend. '
      'Verifier users_secrets avant toute autre action.', n_sans_code;
  end if;

  raise notice 'Restauration conforme : tous les comptes ont retrouve leur code.';
end
$$;

-- ── 4 · Rétablir la contrainte d'origine ───────────────────────────────

alter table public.users alter column code_acces set not null;

-- ── 5 · Rouvrir les droits ─────────────────────────────────────────────
--
-- On rend l'état antérieur, y compris ses faiblesses : un retour arrière
-- restaure, il n'improvise pas. La sécurisation se rejoue proprement.

grant insert, update, delete on public.users        to anon, authenticated;
grant update, delete        on public.journal_audit to anon, authenticated;

commit;

-- ── 6 · MAINTENANT, et pas avant : repromouvoir le déploiement Vercel ──


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS APRÈS RETOUR ARRIÈRE
-- ═══════════════════════════════════════════════════════════════════════

select count(*)                                    as comptes,
       count(*) filter (where code_acces is null)  as sans_code,
       count(*) filter (where actif)               as actifs
  from public.users;
-- attendu : 13 | 0 | 9

-- Concordance parfaite avec la copie de sûreté.
select count(*) as divergences
  from public.users u
  join public.users_secrets s on s.user_id = u.id
 where u.code_acces is distinct from s.code_acces;
-- attendu : 0


-- ═══════════════════════════════════════════════════════════════════════
-- CAS C — interruption APRÈS `phase0_3_rotation.sql`
-- ═══════════════════════════════════════════════════════════════════════
--
-- Les anciens codes n'existent plus nulle part : la rotation les a écrasés
-- dans `users_secrets`, et `users` ne les portait déjà plus.
--
-- Le retour arrière du CAS B reste valable — il restaure les codes
-- NOUVEAUX, pas les anciens. C'est le comportement voulu : les anciens
-- étaient compromis, on ne les remet pas en service.
--
-- Condition : le tableau des nouveaux codes doit avoir été recopié et
-- distribué. S'il a été perdu avant distribution, ne pas tenter de
-- retour arrière — relancer simplement `phase0_3_rotation.sql`, qui
-- produira un nouveau jeu.
