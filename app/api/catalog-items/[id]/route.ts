import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function clientFromAuth(authHeader?: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const headers = authHeader ? { Authorization: authHeader } : undefined
  return createClient(url, anon, { global: { headers } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const supabase = clientFromAuth(req.headers.get('authorization'))
    const { error } = await supabase
      .from('catalog_items')
      .update(body)
      .eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = clientFromAuth(req.headers.get('authorization'))
  const { error } = await supabase
    .from('catalog_items')
    .delete()
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

