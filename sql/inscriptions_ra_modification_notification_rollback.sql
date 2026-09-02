begin;

drop trigger if exists inscription_validee_notifier_ra on public.inscriptions;
drop trigger if exists inscription_validation_reservee_direction on public.inscriptions;
drop function if exists public.notifier_ra_inscription_validee();
drop function if exists public.reserver_validation_inscription_direction();
drop function if exists public.modifier_inscription_administration(uuid,jsonb);

commit;
