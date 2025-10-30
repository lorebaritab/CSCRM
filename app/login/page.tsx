'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const supabase = getSupabase()
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const next = url.searchParams.get('next')
    if (code) {
      supabase.auth.exchangeCodeForSession(code as string).then(({ error }) => {
        if (error) setErr(error.message)
        else window.location.href = next || '/'
      })
    }
  }, [])

  const send = async () => {
    const supabase = getSupabase()
    setErr(''); setMsg('')
    if (!email) { setErr('Enter your email'); return }
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const redirectPath = next ? `/login?next=${encodeURIComponent(next)}` : '/login'
    const redirectTo = `${baseUrl}${redirectPath}`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
    })
    if (error) setErr(error.message)
    else setMsg('Check your inbox for the sign-in link.')
  }

  return (
    <div className="mx-auto max-w-sm">
      <h2 className="mb-2 text-xl font-semibold">Login</h2>
      <p className="text-sm text-slate-600">Enter your email to receive a magic link.</p>
      <input
        className="mt-4 w-full rounded border p-2"
        placeholder="you@company.com"
        value={email}
        onChange={(e)=>setEmail(e.target.value)}
      />
      <button onClick={send} className="mt-3 rounded bg-emerald-600 px-4 py-2 text-white">Send link</button>
      {msg && <p className="mt-2 text-emerald-700 text-sm">{msg}</p>}
      {err && <p className="mt-2 text-red-600 text-sm">{err}</p>}
    </div>
  )
}
