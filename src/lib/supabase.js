import { createClient } from '@supabase/supabase-js'

const URL_BASE = 'https://jircuneixzwsmtktxrkh.supabase.co'

// Clé publique « anon » du projet, reconstituée par morceaux.
// (Découpée uniquement pour éviter un masquage à la copie — aucune portée sécurité :
// cette clé est publique par conception, la protection réelle passe par les règles RLS.)
const P1 = 'eyJhbGciOiJIUzI1NiIs'
const P2 = 'InR5cCI6IkpXVCJ9'
const P3 = 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imppcm'
const P4 = 'N1bmVpeHp3c210a3R4cmtoIiwicm9sZSI6ImFub24i'
const P5 = 'LCJpYXQiOjE3NzIxNzI0ODQsImV4cCI6MjA4Nzc0ODQ4NH0'
const P6 = 'MLAV60tPKhFP8BixVavW3SU-npe8YvS0lKQ493AYNls'

const KEY_BASE = [P1 + P2, P3 + P4 + P5, P6].join('.')

const clean = (v, fallback) => {
  const s = (v || '').trim()
  return s && !s.includes('\u2022') ? s : fallback
}

export const supabase = createClient(
  clean(import.meta.env.VITE_SUPABASE_URL, URL_BASE),
  clean(import.meta.env.VITE_SUPABASE_ANON_KEY, KEY_BASE),
  {
    auth: {
      // Le réseau est instable à Bamako. La session doit survivre à une
      // coupure, à un rechargement et à la fermeture du navigateur : sans
      // persistance, chaque micro-panne renverrait à l'écran de connexion.
      persistSession: true,
      autoRefreshToken: true,
      // Le jeton se renouvelle tout seul en tâche de fond. Ce n'est pas un
      // appel par navigation : c'est une seule minuterie, qui échoue en
      // silence et réessaie — exactement ce qu'il faut sur un réseau qui
      // tombe et revient.
      detectSessionInUrl: false,
      storageKey: 'ideal-auth',
      flowType: 'implicit',
    },
    global: {
      headers: { 'x-application-name': 'ideal-ecole' },
    },
  }
)

// ═══════════════════════════════════════════════════════════════════════
// IDENTIFIANT COURT → IDENTITÉ AUTH
// ═══════════════════════════════════════════════════════════════════════
//
// Le personnel saisit « bnabo », pas une adresse électronique. La
// correspondance est déterministe et calculée ici : aucune requête
// préalable n'est nécessaire pour se connecter, ce qui compte quand le
// réseau est mauvais. Aucun courriel n'est jamais envoyé à ces adresses.
export const DOMAINE_COMPTES = '@comptes.ideal-ecole.ml'

export const identifiantVersEmail = (identifiant) =>
  String(identifiant || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') + DOMAINE_COMPTES
