-- ═══════════════════════════════════════════════════════════════════════
-- PHASE 0 — POINT DE CONTRÔLE 3B : TEST RÉEL, SANS RIEN LAISSER
-- ═══════════════════════════════════════════════════════════════════════
--
-- `enregistrer_utilisateur` et `desactiver_utilisateur` n'ont jamais été
-- exécutées. Les déployer sans les avoir vues fonctionner reviendrait à
-- découvrir un défaut au point de contrôle 5, c'est-à-dire en production.
--
-- Ce script les exécute pour de vrai, puis annule tout.
--
-- ── Comment l'annulation est garantie ──────────────────────────────────
--
-- Trois protections superposées, parce qu'une seule dépendrait du
-- comportement de l'éditeur SQL, que je ne peux pas vérifier d'ici :
--
--   1. `BEGIN` … `ROLLBACK` explicites autour de tout ;
--   2. le bloc DO se termine par `RAISE EXCEPTION` — une exception annule
--      son propre travail ET la transaction englobante, même si l'éditeur
--      ignorait le `BEGIN` et validait chaque instruction ;
--   3. aucun `COMMIT` nulle part, et aucune fonction appelée n'en contient.
--
-- Le rapport de test voyage donc dans le message d'exception. C'est
-- volontaire : un message d'erreur est toujours affiché, là où un `RAISE
-- NOTICE` peut se perdre selon l'éditeur.
--
--            ⚠  L'ÉCHEC FINAL EST LE COMPORTEMENT ATTENDU  ⚠
--
--   Le script DOIT se terminer par une erreur intitulée
--   « RAPPORT 3B ». C'est le signe que tout a été annulé.
--   Lis le rapport qu'elle contient : c'est le résultat du test.
--
-- ── Ce que le script ne touche pas ─────────────────────────────────────
--
-- Aucun code d'accès réel n'y figure. Le compte de test utilise un code
-- fictif inventé dans la transaction. Les deux comptes réels sollicités —
-- le directeur, pour les garde-fous — le sont par des appels conçus pour
-- être refusés AVANT toute écriture, et son identifiant est retrouvé par
-- son rôle, jamais écrit en dur.

begin;

do $$
declare
  -- Code fictif de 13 caractères : les codes réels en font 8 ou 9, une
  -- collision sur l'index unique est donc impossible.
  c_code_test  constant text := 'TESTPHASE0AAA';
  c_marqueur   constant text := 'ZZ-TEST-3B';

  v_users_avant   integer;
  v_actifs_avant  integer;
  v_audit_avant   integer;

  v_retour     jsonb;
  v_id         uuid;
  v_auth       jsonb;
  v_directeur  uuid;

  v_actif      boolean;
  v_secret     integer;
  v_audit_creation      integer;
  v_audit_desactivation integer;

  r  text := '';
  ok integer := 0;
  ko integer := 0;
begin
  ------------------------------------------------------------------
  -- ÉTAT INITIAL
  ------------------------------------------------------------------
  select count(*)                            into v_users_avant  from public.users;
  select count(*) filter (where actif)       into v_actifs_avant from public.users;
  select count(*)                            into v_audit_avant  from public.journal_audit;

  r := r || format(E'\n  Etat initial : %s comptes, %s actifs, %s lignes d''audit',
                   v_users_avant, v_actifs_avant, v_audit_avant);
  r := r || E'\n';

  ------------------------------------------------------------------
  -- T1 · CRÉATION D'UN COMPTE DE TEST
  ------------------------------------------------------------------
  v_retour := public.enregistrer_utilisateur(
    p_id       => null,
    p_prenom   => c_marqueur,
    p_nom      => c_marqueur,
    p_role     => 'professeur',
    p_langue   => 'fr',
    p_fonction => null,
    p_code     => c_code_test,
    p_plafond  => 12345
  );

  v_id := (v_retour ->> 'id')::uuid;

  if v_id is not null then
    ok := ok + 1; r := r || E'\n  [OK] T1  compte de test cree';
  else
    ko := ko + 1; r := r || E'\n  [KO] T1  aucun id retourne';
  end if;

  ------------------------------------------------------------------
  -- T2 · LA LIGNE EST CORRECTE DANS `users`
  ------------------------------------------------------------------
  if exists (select 1 from public.users
              where id = v_id and prenom = c_marqueur
                and role = 'professeur' and actif = true) then
    ok := ok + 1; r := r || E'\n  [OK] T2  ligne users conforme (role, actif)';
  else
    ko := ko + 1; r := r || E'\n  [KO] T2  ligne users incorrecte ou absente';
  end if;

  ------------------------------------------------------------------
  -- T3 · LE SECRET EST DANS `users_secrets`, ET NULLE PART AILLEURS
  ------------------------------------------------------------------
  select count(*) into v_secret
    from public.users_secrets
   where user_id = v_id and code_acces = c_code_test and plafond_salaire = 12345;

  if v_secret = 1 then
    ok := ok + 1; r := r || E'\n  [OK] T3  secret enregistre dans users_secrets';
  else
    ko := ko + 1; r := r || format(E'\n  [KO] T3  secret absent ou incorrect (%s)', v_secret);
  end if;

  -- La fenetre actuelle laisse encore exister users.code_acces. La fonction
  -- ne doit PAS y ecrire : le code doit rester nul cote users.
  if (select code_acces from public.users where id = v_id) is null then
    ok := ok + 1; r := r || E'\n  [OK] T4  users.code_acces reste nul (NOT NULL bien relache)';
  else
    ko := ko + 1; r := r || E'\n  [KO] T4  la fonction ecrit encore dans users.code_acces';
  end if;

  ------------------------------------------------------------------
  -- T5 · LA VALEUR RETOURNÉE NE CONTIENT AUCUN SECRET
  ------------------------------------------------------------------
  if not (v_retour ? 'code_acces') and not (v_retour ? 'plafond_salaire') then
    ok := ok + 1; r := r || E'\n  [OK] T5  retour sans code_acces ni plafond_salaire';
  else
    ko := ko + 1; r := r || E'\n  [KO] T5  FUITE : un secret figure dans le retour';
  end if;

  ------------------------------------------------------------------
  -- T6 · L'AUDIT DE CRÉATION EXISTE, SANS AUTEUR PRÉTENDU
  ------------------------------------------------------------------
  select count(*) into v_audit_creation
    from public.journal_audit
   where table_cible = 'users' and ligne_id = v_id::text
     and action = 'creation_compte'
     and auteur_id is null
     and auteur_nom = 'acteur non authentifie (phase 0)';

  if v_audit_creation = 1 then
    ok := ok + 1; r := r || E'\n  [OK] T6  audit de creation, auteur non authentifie';
  else
    ko := ko + 1; r := r || format(E'\n  [KO] T6  audit de creation absent ou incorrect (%s)', v_audit_creation);
  end if;

  ------------------------------------------------------------------
  -- T7 · AUTHENTIFICATION DU COMPTE DE TEST
  ------------------------------------------------------------------
  v_auth := public.authentifier_par_code(c_code_test);

  if v_auth is not null and (v_auth ->> 'id')::uuid = v_id then
    ok := ok + 1; r := r || E'\n  [OK] T7  authentification : le bon compte est retourne';
  else
    ko := ko + 1; r := r || E'\n  [KO] T7  authentification echouee ou mauvais compte';
  end if;

  if v_auth is not null
     and not (v_auth ? 'code_acces') and not (v_auth ? 'plafond_salaire') then
    ok := ok + 1; r := r || E'\n  [OK] T8  authentification sans secret dans le retour';
  else
    ko := ko + 1; r := r || E'\n  [KO] T8  FUITE a l''authentification';
  end if;

  -- Casse et ponctuation : la normalisation doit les absorber.
  if public.authentifier_par_code('  testphase0-aaa  ') is not null then
    ok := ok + 1; r := r || E'\n  [OK] T9  normalisation du code (casse, espaces, tirets)';
  else
    ko := ko + 1; r := r || E'\n  [KO] T9  normalisation defaillante';
  end if;

  ------------------------------------------------------------------
  -- T10 · DÉSACTIVATION
  ------------------------------------------------------------------
  perform public.desactiver_utilisateur(v_id);

  select actif into v_actif from public.users where id = v_id;

  if v_actif = false then
    ok := ok + 1; r := r || E'\n  [OK] T10 desactivation : actif = false';
  else
    ko := ko + 1; r := r || E'\n  [KO] T10 le compte est reste actif';
  end if;

  -- La ligne doit exister encore : desactivation, pas suppression.
  if exists (select 1 from public.users where id = v_id) then
    ok := ok + 1; r := r || E'\n  [OK] T11 la ligne subsiste (pas de suppression)';
  else
    ko := ko + 1; r := r || E'\n  [KO] T11 la ligne a ete supprimee';
  end if;

  if public.authentifier_par_code(c_code_test) is null then
    ok := ok + 1; r := r || E'\n  [OK] T12 connexion refusee apres desactivation';
  else
    ko := ko + 1; r := r || E'\n  [KO] T12 un compte desactive peut encore se connecter';
  end if;

  select count(*) into v_audit_desactivation
    from public.journal_audit
   where table_cible = 'users' and ligne_id = v_id::text
     and action = 'desactivation_compte'
     and champ = 'actif' and nouvelle_valeur = 'false'
     and auteur_id is null;

  if v_audit_desactivation = 1 then
    ok := ok + 1; r := r || E'\n  [OK] T13 audit de desactivation conforme';
  else
    ko := ko + 1; r := r || format(E'\n  [KO] T13 audit de desactivation absent (%s)', v_audit_desactivation);
  end if;

  ------------------------------------------------------------------
  -- GARDE-FOUS · chacun dans son bloc, pour qu'un refus attendu
  -- n'interrompe pas la suite
  ------------------------------------------------------------------
  r := r || E'\n';

  -- G1 · créer un directeur doit être refusé
  begin
    perform public.enregistrer_utilisateur(
      p_prenom => c_marqueur, p_nom => c_marqueur,
      p_role   => 'directeur', p_code => c_code_test || 'B');
    ko := ko + 1; r := r || E'\n  [KO] G1  creation d''un directeur ACCEPTEE';
  exception when others then
    if sqlerrm like '%role_directeur_interdit%' then
      ok := ok + 1; r := r || E'\n  [OK] G1  creation d''un directeur refusee';
    else
      ko := ko + 1; r := r || format(E'\n  [KO] G1  refusee, mais pour une autre raison : %s', sqlerrm);
    end if;
  end;

  -- G2 · code trop court
  begin
    perform public.enregistrer_utilisateur(
      p_prenom => c_marqueur, p_nom => c_marqueur,
      p_role   => 'professeur', p_code => 'AB1');
    ko := ko + 1; r := r || E'\n  [KO] G2  code trop court ACCEPTE';
  exception when others then
    if sqlerrm like '%code_trop_court%' then
      ok := ok + 1; r := r || E'\n  [OK] G2  code trop court refuse';
    else
      ko := ko + 1; r := r || format(E'\n  [KO] G2  refuse, mais pour une autre raison : %s', sqlerrm);
    end if;
  end;

  -- G3 · identité incomplète
  begin
    perform public.enregistrer_utilisateur(
      p_prenom => '   ', p_nom => c_marqueur,
      p_role   => 'professeur', p_code => c_code_test || 'C');
    ko := ko + 1; r := r || E'\n  [KO] G3  identite incomplete ACCEPTEE';
  exception when others then
    if sqlerrm like '%identite_incomplete%' then
      ok := ok + 1; r := r || E'\n  [OK] G3  identite incomplete refusee';
    else
      ko := ko + 1; r := r || format(E'\n  [KO] G3  refusee, mais pour une autre raison : %s', sqlerrm);
    end if;
  end;

  -- Le compte du directeur, retrouve par son role. Les deux appels qui
  -- suivent sont conçus pour etre refuses AVANT toute ecriture.
  select id into v_directeur from public.users where role = 'directeur' limit 1;

  -- G4 · désactiver le directeur doit être refusé
  begin
    perform public.desactiver_utilisateur(v_directeur);
    ko := ko + 1; r := r || E'\n  [KO] G4  desactivation du directeur ACCEPTEE';
  exception when others then
    if sqlerrm like '%compte_directeur_protege%' then
      ok := ok + 1; r := r || E'\n  [OK] G4  desactivation du directeur refusee';
    else
      ko := ko + 1; r := r || format(E'\n  [KO] G4  refusee, mais pour une autre raison : %s', sqlerrm);
    end if;
  end;

  -- G5 · modifier le directeur doit être refusé
  begin
    perform public.enregistrer_utilisateur(
      p_id     => v_directeur,
      p_prenom => c_marqueur, p_nom => c_marqueur,
      p_role   => 'professeur', p_code => c_code_test || 'D');
    ko := ko + 1; r := r || E'\n  [KO] G5  modification du directeur ACCEPTEE';
  exception when others then
    if sqlerrm like '%compte_directeur_protege%' then
      ok := ok + 1; r := r || E'\n  [OK] G5  modification du directeur refusee';
    else
      ko := ko + 1; r := r || format(E'\n  [KO] G5  refusee, mais pour une autre raison : %s', sqlerrm);
    end if;
  end;

  -- G6 · le directeur est intact malgre les tentatives
  if exists (select 1 from public.users
              where id = v_directeur and role = 'directeur' and actif = true) then
    ok := ok + 1; r := r || E'\n  [OK] G6  le compte directeur est intact';
  else
    ko := ko + 1; r := r || E'\n  [KO] G6  LE COMPTE DIRECTEUR A ETE ALTERE';
  end if;

  ------------------------------------------------------------------
  -- ÉTAT AVANT ANNULATION — doit montrer les écritures du test
  ------------------------------------------------------------------
  r := r || E'\n';
  r := r || format(E'\n  Dans la transaction : %s comptes (+%s), %s lignes d''audit (+%s)',
        (select count(*) from public.users),
        (select count(*) from public.users) - v_users_avant,
        (select count(*) from public.journal_audit),
        (select count(*) from public.journal_audit) - v_audit_avant);

  r := r || format(E'\n\n  RESULTAT : %s controle(s) reussi(s), %s en echec', ok, ko);
  r := r || E'\n  Tout ce qui precede va etre annule par l''exception ci-dessous.';

  ------------------------------------------------------------------
  -- ANNULATION GARANTIE
  ------------------------------------------------------------------
  -- Cette exception n'est pas un incident : c'est le mecanisme d'annulation.
  -- Elle annule le travail du bloc DO et la transaction englobante, meme si
  -- l'editeur SQL avait ignore le BEGIN.
  raise exception E'RAPPORT 3B%', r;
end
$$;

rollback;
