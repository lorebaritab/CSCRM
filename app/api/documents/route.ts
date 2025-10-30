import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET = process.env.NEXT_PUBLIC_DOCS_BUCKET || 'documents'

function clientFromAuth(authHeader?: string | null, service = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = service ? process.env.SUPABASE_SERVICE_ROLE_KEY! : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const headers = authHeader ? { Authorization: authHeader } : undefined
  return createClient(url, key, { global: { headers } })
}

export async function GET(req: NextRequest) {
  const supabase = clientFromAuth(req.headers.get('authorization'))
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').toLowerCase()
  const category = searchParams.get('category')

  let query = supabase
    .from('documents')
    .select('id, title, description, category, tags, file_path, file_size, mime_type, uploaded_by, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (category) {
    // @ts-ignore
    query = query.eq('category', category)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const items = (data || []).filter(d => !q || `${d.title} ${d.description ?? ''}`.toLowerCase().includes(q))
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const supabaseSvc = clientFromAuth(auth, true)
    const supabase = clientFromAuth(auth)
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    const title = String(form.get('title') || '')
    const description = String(form.get('description') || '')
    const category = String(form.get('category') || '')
    const tags = String(form.get('tags') || '')
    if (!file || !title) return NextResponse.json({ error: 'Missing file or title' }, { status: 400 })

    // ensure bucket exists (idempotent)
    try { await supabaseSvc.storage.createBucket(BUCKET, { public: false }) } catch { /* ignore */ }

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const name = `${uid}/${crypto.randomUUID()}-${file.name}`
    const { data: up, error: upErr } = await supabaseSvc.storage.from(BUCKET).upload(name, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    const meta = {
      title,
      description: description || null,
      category: category || null,
      tags: tags ? tags.split(',').map(s=>s.trim()) : [],
      file_path: up.path,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: uid
    }
    const { data: ins, error: insErr } = await supabase.from('documents').insert(meta).select('id').single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: ins.id, path: up.path })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 })
  }
}

