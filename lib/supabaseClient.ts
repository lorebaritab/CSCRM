import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined
    // Do not throw at build time; guard for runtime
    if (!url || !anon) {
      // create a no-op client that will error on first use if misconfigured
      throw new Error('Supabase env vars are not set in NEXT_PUBLIC_…')
    }
    client = createClient(url, anon)
  }
  return client
}
