import { readFileSync } from 'node:fs'

const lire = chemin => readFileSync(chemin, 'utf8')
const page = lire('src/pages/InscriptionsValidation.jsx')
const app = lire('src/pages/DirecteurApp.jsx')
const sql = lire('sql/inscriptions_ra_modification_notification.sql')
const rollback = lire('sql/inscriptions_ra_modification_notification_rollback.sql')
const rpcModification = sql.split('create or replace function public.notifier_ra_inscription_validee')[0]
const affectationsInscription = rpcModification.match(/update public\.inscriptions set([\s\S]*?)where id = v_ins\.id/)?.[1] || ''
let echecs = 0

const verifier = (nom, condition) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${nom}`)
  if (!condition) echecs++
}

verifier('RA ouvre le gestionnaire interne des dossiers',
  app.includes("'/administration/inscriptions': 'inscriptions'")
  && app.includes("moduleAdministration === 'inscriptions'"))
verifier('édition affichée uniquement au RA',
  page.includes("directeur?.role === 'responsable_administratif'")
  && page.includes('estResponsableAdministratif && edition'))
verifier('signature et validation restent réservées au Directeur',
  page.includes("!estResponsableAdministratif && selection.statut !== 'validee'")
  && sql.includes("ideal_est(array['directeur'])")
  && sql.includes('inscription_validation_reservee_direction'))
verifier('aucune écriture directe depuis le navigateur',
  !/from\('inscriptions'\)\.update\(/.test(page)
  && page.includes("rpc('modifier_inscription_administration'"))
verifier('RPC protégée par le rôle RA issu de auth.uid()',
  sql.includes("ideal_est(array['responsable_administratif'])")
  && /revoke all on function public\.modifier_inscription_administration[\s\S]*from public, anon, authenticated/.test(sql)
  && /grant execute on function public\.modifier_inscription_administration[\s\S]*to authenticated/.test(sql))
verifier('champs de validation immuables',
  affectationsInscription.length > 0
  && !/(statut|matricule|signature_directeur_chemin)\s*=/.test(affectationsInscription))
verifier('dossier validé et fiche élève synchronisés',
  sql.includes("if v_ins.statut = 'validee' then")
  && sql.includes('update public.eleves set'))
verifier('notification uniquement destinée au RA',
  sql.includes("constant text := 'notifs_responsable_administratif'")
  && sql.includes("array['responsable_administratif']")
  && !sql.includes("array['directeur', 'responsable_administratif']"))
verifier('notification idempotente et rattachée au dossier',
  sql.includes("'insc-validee-' || new.id::text")
  && sql.includes("'ref', new.id::text")
  && sql.includes("is distinct from (v_notif ->> 'id')"))
verifier('aucune notification avant validation signée',
  sql.includes("old.statut is not distinct from 'validee'")
  && sql.includes('new.signature_directeur_chemin is null'))
verifier('confirmation parent contient la chaîne WhatsApp officielle',
  page.includes("const CHAINE_WHATSAPP_ECOLE = 'https://whatsapp.com/channel/0029VbAvPN6DzgT5CqYNXY2u'")
  && page.includes('veuillez vous abonner à notre chaîne WhatsApp officielle'))
verifier('message WhatsApp adressé au numéro du responsable',
  page.includes("import { lienWhatsApp, NOM_ECOLE } from '../lib/ecole'")
  && page.includes("lienWhatsApp(numero, texte)"))
verifier('envoi parent proposé au RA uniquement après validation',
  page.includes("estResponsableAdministratif && selection.statut === 'validee'")
  && page.includes('Informer le parent de la validation'))
verifier('validation Direction ne déclenche aucun message parent',
  !page.match(/const valider = async \(\) => \{([\s\S]*?)\n  \}\n\n  return/)?.[1]?.includes('ouvrirWhatsApp')
  && page.includes("Signer et valider l’inscription"))
verifier('rollback disponible',
  rollback.includes('drop trigger if exists inscription_validee_notifier_ra')
  && rollback.includes('drop function if exists public.modifier_inscription_administration'))

process.exit(echecs ? 1 : 0)
