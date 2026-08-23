-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 0 — ÉTAPE 8 : ROTATION DES CODES D'ACCÈS
-- ═══════════════════════════════════════════════════════════════════════
--
-- Les codes actuels sont considérés comme compromis. Ils ont été :
--   • lisibles publiquement par l'API anonyme ;
--   • renvoyés par `select('*')` ;
--   • stockés en clair dans le localStorage de chaque poste ;
--   • potentiellement présents sur des appareils partagés.
--
-- Fermer l'API arrête la fuite. Elle n'annule pas ce qui a déjà pu être
-- copié : seule la rotation le fait.
--
-- ── À N'EXÉCUTER QU'APRÈS `phase0_2_retrait.sql` ───────────────────────
--
-- Tourner les codes avant le retrait serait sans effet : ils seraient
-- aussitôt relisibles par l'API.
--
-- ═══════════════════════════════════════════════════════════════════════
--   ⚠  LES NOUVEAUX CODES NE S'AFFICHENT QUE DANS TON ÉDITEUR SQL  ⚠
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ils sont générés côté serveur. Ils n'apparaissent dans aucun fichier du
-- dépôt, aucun journal, aucune sortie d'outil, et ne transitent par aucun
-- assistant. Le résultat de la requête finale est la SEULE occasion de les
-- lire.
--
--   1. Exécute le script.
--   2. Recopie le tableau de résultats vers un support sûr — gestionnaire
--      de mots de passe, ou papier conservé sous clé.
--   3. Distribue chaque code à son titulaire, individuellement.
--   4. Exécute le bloc de nettoyage final, à la fin de ce fichier.
--
-- Ne colle ce résultat nulle part ailleurs. Ni dans un message, ni dans un
-- fichier du projet, ni dans une conversation avec un assistant.

begin;

-- ── 1 · Générateur ─────────────────────────────────────────────────────
--
-- Huit caractères, alphabet de 31 signes sans I, L, O, 0 ni 1 : ces
-- caractères se confondent à l'oral et à la lecture, et un code se
-- transmet de vive voix dans une école.
--
-- Le format reprend celui des codes existants — 8 caractères A-Z0-9 — donc
-- `normaliserCode` côté client n'a pas à changer.

create or replace function public.generer_code_acces()
returns text
language sql
volatile
as $function$
  select string_agg(
           substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                  1 + floor(random() * 31)::int, 1),
           '')
    from generate_series(1, 8);
$function$;

-- ── 2 · Rotation ───────────────────────────────────────────────────────
--
-- Une fonction plutôt qu'un simple UPDATE : il faut pouvoir réessayer en
-- cas de collision sur l'index unique. La probabilité est infime — 31^8
-- possibilités pour 13 codes — mais une collision ferait échouer tout
-- l'UPDATE, et l'école se retrouverait sans codes du tout.
--
-- SECURITY DEFINER est délibérément ABSENT : cette fonction ne doit
-- s'exécuter qu'avec les droits de l'éditeur SQL, jamais ceux de `anon`.

create or replace function public.rotation_codes_acces()
returns table (prenom text, nom text, role text, nouveau_code text)
language plpgsql
as $function$
declare
  r        record;
  v_code   text;
  v_essais integer;
begin
  for r in select u.id, u.prenom, u.nom, u.role
             from public.users u
            order by u.role, u.nom
  loop
    v_essais := 0;

    loop
      v_essais := v_essais + 1;
      v_code := public.generer_code_acces();

      begin
        update public.users_secrets
           set code_acces = v_code,
               updated_at = now()
         where user_id = r.id;
        exit;
      exception when unique_violation then
        if v_essais >= 20 then
          raise exception 'Collision persistante pour % % : rotation abandonnee.',
            r.prenom, r.nom;
        end if;
      end;
    end loop;

    prenom       := r.prenom;
    nom          := r.nom;
    role         := r.role;
    nouveau_code := v_code;
    return next;
  end loop;

  insert into public.journal_audit
    (table_cible, ligne_id, champ, ancienne_valeur, nouvelle_valeur,
     auteur_id, auteur_nom, action)
  values
    ('users_secrets', null, 'code_acces', '(compromis)', '(renouvele)',
     null, 'acteur non authentifie (phase 0)', 'rotation_codes');
end;
$function$;

-- ── 3 · Fermeture immédiate ────────────────────────────────────────────
--
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut sur toute fonction créée.
-- Sans ces révocations, `rotation_codes_acces()` serait appelable par la
-- clé anonyme — et renverrait les treize codes en clair. Ce script
-- créerait alors, à lui seul, une faille pire que celle qu'il referme.

revoke all on function public.generer_code_acces()    from public, anon, authenticated;
revoke all on function public.rotation_codes_acces()  from public, anon, authenticated;

commit;


-- ═══════════════════════════════════════════════════════════════════════
-- EXÉCUTION — le résultat ci-dessous est à recopier, puis à ne plus jamais
-- afficher. C'est la seule occasion de lire ces valeurs.
-- ═══════════════════════════════════════════════════════════════════════

select * from public.rotation_codes_acces();


-- ═══════════════════════════════════════════════════════════════════════
-- NETTOYAGE — à exécuter une fois les codes recopiés et distribués
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ces fonctions ne servent qu'à cette opération. Les laisser en place
-- maintiendrait dans la base un moyen de lire tous les codes en clair.
-- On les supprime ; le fichier reste versionné pour une rotation future.

-- drop function if exists public.rotation_codes_acces();
-- drop function if exists public.generer_code_acces();


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS — aucune ne révèle un code
-- ═══════════════════════════════════════════════════════════════════════

-- Tous les codes ont bien été renouvelés à l'instant.
select count(*) as codes_renouveles
  from public.users_secrets
 where updated_at > now() - interval '10 minutes';
-- attendu : 13

-- Aucun doublon, et le format attendu est respecté.
select count(*)                                  as total,
       count(distinct code_acces)                as distincts,
       count(*) filter (where code_acces ~ '^[A-Z0-9]{8}$') as format_conforme
  from public.users_secrets;
-- attendu : 13 | 13 | 13
