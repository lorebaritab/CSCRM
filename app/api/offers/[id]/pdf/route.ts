export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const BUCKET = process.env.NEXT_PUBLIC_OFFERS_BUCKET || 'offers'
  const supabase = createClient(url, svc)
  const { data: offer, error } = await supabase
    .from('offers')
    .select('pdf_storage_path, offer_reference')
    .eq('id', params.id)
    .single()
  if (error || !offer) return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 })
  if (!offer.pdf_storage_path) return NextResponse.json({ error: 'No PDF available' }, { status: 400 })
  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(offer.pdf_storage_path, 60 * 60)
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 })
  return NextResponse.json({ url: signed.signedUrl, filename: `${offer.offer_reference}.pdf` })
}
