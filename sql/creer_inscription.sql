CREATE OR REPLACE FUNCTION public.creer_inscription(p_dossier jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r1  jsonb := p_dossier -> 'responsable1';
  r2  jsonb := p_dossier -> 'responsable2';
  el  jsonb := p_dossier -> 'eleve';
  dos jsonb := coalesce(p_dossier -> 'dossier',  '{}'::jsonb);
  fic jsonb := coalesce(p_dossier -> 'fichiers', '{}'::jsonb);

  v_annee     text;
  v_type      text;
  v_sexe      text;
  v_prefixe   text;
  v_suite     int;
  v_matricule text;

  v_r1_id   uuid;
  v_r2_id   uuid := null;
  v_insc_id uuid;
  v_doc     jsonb;

begin
  ------------------------------------------------------------------
  -- 1. VALIDATIONS — toutes avant la moindre écriture
  ------------------------------------------------------------------
  -- La base ne protège rien : dans `responsables`, même `nom` est nullable.
  -- Ces contrôles sont l'unique garde-fou.
  if nullif(btrim(coalesce(r1 ->> 'nom',    '')), '') is null
  or nullif(btrim(coalesce(r1 ->> 'prenom', '')), '') is null
  or nullif(btrim(coalesce(r1 ->> 'tel1',   '')), '') is null then
    raise exception 'responsable_incomplet'
      using detail = 'Le responsable principal exige un nom, un prénom et un téléphone.';
  end if;

  if nullif(btrim(coalesce(el ->> 'nom',    '')), '') is null
  or nullif(btrim(coalesce(el ->> 'prenom', '')), '') is null then
    raise exception 'eleve_incomplet'
      using detail = 'Le nom et le prénom de l''élève sont obligatoires.';
  end if;

  -- Date réelle, pas seulement une chaîne non vide : « 2020-02-31 » est refusé.
  if nullif(btrim(coalesce(el ->> 'date_naissance', '')), '') is null then
    raise exception 'date_naissance_invalide' using detail = '(absente)';
  end if;

  begin
    perform (el ->> 'date_naissance')::date;
  exception when others then
    raise exception 'date_naissance_invalide' using detail = el ->> 'date_naissance';
  end;

  -- `eleves.sexe` porte un CHECK ('M','F') que `inscriptions.sexe` n'a pas.
  -- Laisser passer autre chose ici ferait échouer la création de l'élève à la
  -- validation, des semaines plus tard, sans que personne comprenne pourquoi.
  v_sexe := nullif(btrim(coalesce(el ->> 'sexe', '')), '');

  if v_sexe is not null and v_sexe not in ('M', 'F') then
    raise exception 'sexe_invalide' using detail = v_sexe;
  end if;

  if nullif(btrim(coalesce(el ->> 'classe_demandee', '')), '') is null then
    raise exception 'classe_manquante'
      using detail = 'La classe demandée est obligatoire.';
  end if;

  v_annee := btrim(coalesce(dos ->> 'annee_scolaire', ''));

  if v_annee !~ '^\d{4}-\d{4}$' then
    raise exception 'annee_invalide' using detail = v_annee;
  end if;

  if (right(v_annee, 4))::int <> (left(v_annee, 4))::int + 1 then
    raise exception 'annee_invalide'
      using detail = v_annee || ' — les deux années doivent se suivre.';
  end if;

  v_type := coalesce(
    nullif(btrim(coalesce(dos ->> 'type_inscription', '')), ''),
    'nouvelle'
  );

  if v_type not in ('nouvelle', 'reinscription') then
    raise exception 'type_invalide' using detail = v_type;
  end if;

  -- Responsable 2 : absent, ou complet. Jamais entre les deux.
  --
  -- L'ancien code faisait `if (!r2Err) r2Id = r2.id` : une erreur passait
  -- inaperçue et l'inscription était créée sans le second responsable que
  -- l'agent avait pourtant saisi.
  if r2 is not null
     and jsonb_typeof(r2) = 'object'
     and r2 <> '{}'::jsonb then

    if nullif(btrim(coalesce(r2 ->> 'nom',    '')), '') is null
    or nullif(btrim(coalesce(r2 ->> 'prenom', '')), '') is null
    or nullif(btrim(coalesce(r2 ->> 'tel1',   '')), '') is null then

      raise exception 'responsable2_incomplet'
        using detail = 'Un second responsable a été saisi : nom, prénom et téléphone sont alors requis.';
    end if;

  else
    r2 := null;
  end if;

  ------------------------------------------------------------------
  -- 2. VERROU — sérialise les créations du même préfixe
  ------------------------------------------------------------------
  v_prefixe :=
    substr(left(v_annee, 4), 3, 2)
    || '-'
    || substr(right(v_annee, 4), 3, 2)
    || ' A';

  -- Verrou consultatif, portée transaction : libéré au COMMIT comme au
  -- ROLLBACK. Il ne bloque que les créations partageant ce préfixe. Aucun
  -- trigger ne génère de matricule — vérifié — il est donc seul maître,
  -- avec UNIQUE (matricule) comme dernier rempart.
  perform pg_advisory_xact_lock(
    hashtext('inscription_matricule:' || v_prefixe)
  );

  ------------------------------------------------------------------
  -- 3. RESPONSABLE 1
  ------------------------------------------------------------------
  insert into public.responsables
    (nom, prenom, lien_parente, tel1, whatsapp, email,
     adresse, profession, situation_matrimoniale)
  values (
    btrim(r1 ->> 'nom'),
    btrim(r1 ->> 'prenom'),
    nullif(btrim(coalesce(r1 ->> 'lien_parente', '')), ''),
    btrim(r1 ->> 'tel1'),
    nullif(btrim(coalesce(r1 ->> 'whatsapp', '')), ''),
    nullif(btrim(coalesce(r1 ->> 'email', '')), ''),
    nullif(btrim(coalesce(r1 ->> 'adresse', '')), ''),
    nullif(btrim(coalesce(r1 ->> 'profession', '')), ''),
    nullif(btrim(coalesce(r1 ->> 'situation_matrimoniale', '')), '')
  )
  returning id into v_r1_id;

  ------------------------------------------------------------------
  -- 4. RESPONSABLE 2, seulement s'il a été saisi
  ------------------------------------------------------------------
  if r2 is not null then
    insert into public.responsables
      (nom, prenom, lien_parente, tel1, whatsapp, email,
       adresse, profession, situation_matrimoniale)
    values (
      btrim(r2 ->> 'nom'),
      btrim(r2 ->> 'prenom'),
      nullif(btrim(coalesce(r2 ->> 'lien_parente', '')), ''),
      btrim(r2 ->> 'tel1'),
      nullif(btrim(coalesce(r2 ->> 'whatsapp', '')), ''),
      nullif(btrim(coalesce(r2 ->> 'email', '')), ''),
      nullif(btrim(coalesce(r2 ->> 'adresse', '')), ''),
      nullif(btrim(coalesce(r2 ->> 'profession', '')), ''),
      nullif(btrim(coalesce(r2 ->> 'situation_matrimoniale', '')), '')
    )
    returning id into v_r2_id;
  end if;

  ------------------------------------------------------------------
  -- 5. MATRICULE
  ------------------------------------------------------------------
  -- Lu sous le verrou : aucune autre transaction ne peut intercaler la
  -- sienne entre ce MAX et l'INSERT qui suit.
  select coalesce(
    max(
      nullif(
        regexp_replace(
          substr(matricule, length(v_prefixe) + 1),
          '\D',
          '',
          'g'
        ),
        ''
      )::int
    ),
    0
  )
  into v_suite
  from public.inscriptions
  where matricule like v_prefixe || '%';

  v_matricule := v_prefixe || lpad((v_suite + 1)::text, 3, '0');

  ------------------------------------------------------------------
  -- 6. INSCRIPTION
  ------------------------------------------------------------------
  -- `statut` n'est pas fourni : la colonne a pour défaut « en_cours ».
  -- `eleve_id` reste nul — l'élève naîtra à la validation.
  insert into public.inscriptions (
    matricule, responsable1_id, responsable2_id,
    nom, prenom, sexe, date_naissance, lieu_naissance, groupe_sanguin,
    nationalite, langue_maison, ancienne_ecole, classe_precedente,
    classe_demandee, adresse,
    cantine, allergies, restrictions, transport, droit_image,
    photo_chemin, signature_chemin, annee_scolaire, type_inscription
  )
  values (
    v_matricule, v_r1_id, v_r2_id,
    btrim(el ->> 'nom'),
    btrim(el ->> 'prenom'),
    v_sexe,
    (el ->> 'date_naissance')::date,
    nullif(btrim(coalesce(el ->> 'lieu_naissance', '')), ''),
    nullif(btrim(coalesce(el ->> 'groupe_sanguin', '')), ''),
    nullif(btrim(coalesce(el ->> 'nationalite', '')), ''),
    nullif(btrim(coalesce(el ->> 'langue_maison', '')), ''),
    nullif(btrim(coalesce(el ->> 'ancienne_ecole', '')), ''),
    nullif(btrim(coalesce(el ->> 'classe_precedente', '')), ''),
    btrim(el ->> 'classe_demandee'),
    nullif(btrim(coalesce(el ->> 'adresse', '')), ''),
    coalesce((dos ->> 'cantine')::boolean, false),
    nullif(btrim(coalesce(dos ->> 'allergies', '')), ''),
    nullif(btrim(coalesce(dos ->> 'restrictions', '')), ''),
    coalesce((dos ->> 'transport')::boolean, false),
    coalesce((dos ->> 'droit_image')::boolean, false),
    nullif(btrim(coalesce(fic ->> 'photo_chemin', '')), ''),
    nullif(btrim(coalesce(fic ->> 'signature_chemin', '')), ''),
    v_annee,
    v_type
  )
  returning id into v_insc_id;

  ------------------------------------------------------------------
  -- B3 AJOUT — PIÈCES JUSTIFICATIVES
  ------------------------------------------------------------------
  -- Les documents sont facultatifs.
  -- Si la clé est absente, null ou d'un autre type, aucun document
  -- n'est inséré.
  --
  -- Aucun bloc EXCEPTION ici : une erreur doit annuler toute la
  -- transaction, y compris l'inscription et les responsables.
  for v_doc in
    select value
    from jsonb_array_elements(
      case
        when jsonb_typeof(fic -> 'documents') = 'array'
        then fic -> 'documents'
        else '[]'::jsonb
      end
    )
  loop
    if nullif(btrim(coalesce(v_doc ->> 'type', '')), '') is null
       or nullif(btrim(coalesce(v_doc ->> 'chemin', '')), '') is null then

      raise exception 'DOCUMENT_INVALIDE'
        using detail = 'Chaque document exige au minimum un type et un chemin Storage.';
    end if;

    insert into public.documents_inscription
      (inscription_id, type, nom_fichier, url, taille_kb, chemin)
    values (
      v_insc_id,
      btrim(v_doc ->> 'type'),
      nullif(btrim(coalesce(v_doc ->> 'nom_fichier', '')), ''),
      null,
      nullif(btrim(coalesce(v_doc ->> 'taille_kb', '')), '')::integer,
      nullif(btrim(coalesce(v_doc ->> 'chemin', '')), '')
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'inscription_id',  v_insc_id,
    'matricule',       v_matricule,
    'responsable1_id', v_r1_id,
    'responsable2_id', v_r2_id
  );
end;
$function$
