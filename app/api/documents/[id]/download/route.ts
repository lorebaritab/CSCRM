export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET = process.env.NEXT_PUBLIC_DOCS_BUCKET || 'documents'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(url, svc)
  const { data: doc, error } = await supabase
    .from('documents')
    .select('file_path, title')
    .eq('id', params.id)
    .single()
  if (error || !doc) return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 })
  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60 * 60)
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 })
  return NextResponse.json({ url: signed.signedUrl, filename: doc.title })
}
