begin;

drop policy if exists inscriptions_photos_bulletins on storage.objects;

drop function if exists public.peut_lire_photo_bulletin(text);
drop function if exists public.lire_photos_bulletins_primaire(uuid[]);
drop function if exists public.sauver_evaluation_primaire(uuid,text,text,text,jsonb,text);
drop function if exists public.lire_bulletins_primaire(uuid[]);

drop table if exists public.primaire_bulletins;

commit;
