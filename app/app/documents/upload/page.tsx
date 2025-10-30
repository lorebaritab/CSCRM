"use client"
import { useState } from 'react'
import { getSupabase } from '../../../../lib/supabaseClient'

export default function UploadDocumentPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    setMsg(''); setErr('')
    if (!file || !title) { setErr('Please select a file and enter a title'); return }
    try {
      const supabase = getSupabase()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) { setErr('Please login'); return }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title)
      if (description) fd.append('description', description)
      if (category) fd.append('category', category)
      if (tags) fd.append('tags', tags)
      const res = await fetch('/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Upload failed')
      setMsg('Uploaded')
      setTitle(''); setDescription(''); setCategory(''); setTags(''); setFile(null)
    } catch (e: any) {
      setErr(String(e.message || e))
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="mb-4 text-xl font-semibold">Upload Document</h2>
      <div className="grid gap-3">
        <label className="text-sm">Title
          <input className="mt-1 w-full rounded border p-2" value={title} onChange={e=>setTitle(e.target.value)} />
        </label>
        <label className="text-sm">Description
          <textarea className="mt-1 w-full rounded border p-2" value={description} onChange={e=>setDescription(e.target.value)} />
        </label>
        <label className="text-sm">Category
          <input className="mt-1 w-full rounded border p-2" value={category} onChange={e=>setCategory(e.target.value)} />
        </label>
        <label className="text-sm">Tags (comma-separated)
          <input className="mt-1 w-full rounded border p-2" value={tags} onChange={e=>setTags(e.target.value)} />
        </label>
        <label className="text-sm">File
          <input className="mt-1 w-full" type="file" onChange={e=>setFile(e.target.files?.[0] ?? null)} />
        </label>
        <div className="pt-2">
          <button onClick={submit} className="rounded bg-emerald-600 px-4 py-2 text-white">Upload</button>
        </div>
        {msg && <p className="text-emerald-700 text-sm">{msg}</p>}
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </div>
    </div>
  )
}

