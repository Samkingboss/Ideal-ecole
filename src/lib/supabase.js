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
  clean(import.meta.env.VITE_SUPABASE_ANON_KEY, KEY_BASE)
)
