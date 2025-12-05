import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Main client – used everywhere in the app (login, dashboards, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'property-management-auth',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

// Second client – only for Admin creating users
// It has its own auth state and does NOT touch the main session.
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // no need to keep session
  },
})
