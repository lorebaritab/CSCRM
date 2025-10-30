"use client"

import { useState } from 'react'
import { getSupabase } from '../../../lib/supabaseClient'

type Props = {
  offerId: string
}

export default function PdfLink({ offerId }: Props) {
  const [loading, setLoading] = useState(false)

  const openPdf = async () => {
    try {
      setLoading(true)
      const supabase = getSupabase()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch(`/api/offers/${offerId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'PDF not available')
      window.open(json.url, '_blank', 'noopener,noreferrer')
    } catch (error: any) {
      alert(`Unable to fetch PDF: ${String(error?.message || error)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={openPdf}
      disabled={loading}
      className="text-xs font-semibold text-emerald-700 underline disabled:opacity-50"
    >
      {loading ? 'Opening…' : 'PDF'}
    </button>
  )
}
