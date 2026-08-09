import { createClient } from '@supabase/supabase-js'

// Valeurs publiques du projet Supabase IDEAL.
// La clé « anon » est conçue pour être visible côté navigateur : la protection
// des données repose sur les règles RLS de Supabase, pas sur son secret.
// Les variables d'environnement restent prioritaires si elles sont définies.
const FALLBACK_URL = 'https://jircuneixzwsmtktxrkh.supabase.co'
const FALLBACK_KEY = 'eyJhbGci••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'

const clean = (v, fallback) => {
  const s = (v || '').trim()
  return s && !s.includes('\u2022') ? s : fallback
}

export const supabase = createClient(
  clean(import.meta.env.VITE_SUPABASE_URL, FALLBACK_URL),
  clean(import.meta.env.VITE_SUPABASE_ANON_KEY, FALLBACK_KEY)
)
