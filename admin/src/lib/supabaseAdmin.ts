import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Missing admin Supabase env vars. Copy admin/.env.example to admin/.env.local and fill in real values.')
}

// Service-role client: bypasses Row Level Security entirely, so this reads every player's runs
// regardless of status. Only ever used for reads in this app — see admin/README-ish note in
// vite.config.ts for why this key must never end up in the main app's bundle.
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
})
