'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '../lib/supabaseClient'

export default function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setEmail(data.session?.user?.email ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (email) {
    return (
      <div className="text-xs text-slate-600">
        Signed in as <span className="font-medium">{email}</span>
        <button
          className="ml-2 rounded border px-2 py-0.5 hover:bg-slate-50"
          onClick={() => getSupabase().auth.signOut()}
        >
          Logout
        </button>
      </div>
    )
  }
  return (
    <a href="/login" className="text-xs underline">Login</a>
  )
}
