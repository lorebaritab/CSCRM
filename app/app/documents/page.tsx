"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../../lib/supabaseClient'

type Doc = { id: string; title: string; description: string | null; category: string | null; tags: string[] | null; file_size: number | null; mime_type: string | null; created_at: string }

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const tokenFetch = async (path: string) => {
    const supabase = getSupabase()
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (!token) throw new Error('Please login')
    const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error || 'Request failed')
    return j
  }

  const load = async () => {
    setLoading(true)
    try {
      const j = await tokenFetch(`/api/documents?q=${encodeURIComponent(q)}`)
      setDocs(j.items || [])
    } catch (e: any) {
      setErr(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const download = async (id: string) => {
    try {
      const j = await tokenFetch(`/api/documents/${id}/download`)
      window.open(j.url, '_blank')
    } catch (e: any) {
      alert('Error: ' + String(e.message || e))
    }
  }

  const remove = async (id: string) => {
    try {
      const supabase = getSupabase()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) return alert('Login required')
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Failed to delete')
      await load()
    } catch (e: any) {
      alert('Error: ' + String(e.message || e))
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documents</h2>
        <Link href="/app/documents/upload" className="rounded bg-emerald-600 px-3 py-1.5 text-white text-sm">Upload</Link>
      </div>
      <div className="mb-3 flex gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search title/description" className="w-full max-w-md rounded border p-2" />
        <button onClick={load} className="rounded border px-3 py-1.5">Search</button>
      </div>
      {loading && <p className="text-slate-600">Loading…</p>}
      {err && <p className="text-red-600">{err}</p>}
      {!loading && !err && (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="p-2">Uploaded</th>
                <th className="p-2">Title</th>
                <th className="p-2">Category</th>
                <th className="p-2">Size</th>
                <th className="p-2">Type</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id} className="border-t">
                  <td className="p-2">{new Date(d.created_at).toLocaleString()}</td>
                  <td className="p-2">
                    <div className="font-medium">{d.title}</div>
                    {d.description && <div className="text-xs text-slate-500">{d.description}</div>}
                  </td>
                  <td className="p-2">{d.category ?? '—'}</td>
                  <td className="p-2">{d.file_size ? `${(d.file_size/1024).toFixed(1)} KB` : '—'}</td>
                  <td className="p-2">{d.mime_type ?? '—'}</td>
                  <td className="p-2">
                    <button onClick={()=>download(d.id)} className="text-sm underline mr-3">Download</button>
                    <button onClick={()=>remove(d.id)} className="text-sm text-red-600">Delete</button>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td className="p-3 text-slate-500" colSpan={6}>No documents</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
