import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type Line = {
  catalog_item_id?: string | null
  sku?: string | null
  description: string
  quantity: number
  unit?: string | null
  unit_price: number
  discount_amount: number
  tax_rate?: number
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customer_id,
      customer_name,
      title,
      valid_until,
      transport_cost = 0,
      currency = 'USD',
      lines = [] as Line[],
    } = body || {}

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const auth = req.headers.get('authorization') || ''
    if (!auth) return NextResponse.json({ error: 'Missing Authorization' }, { status: 401 })
    const supabase = createClient(url, anon, { global: { headers: { Authorization: auth } } })

    // get user for auth.uid()
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const uid = userData.user.id

    // ensure customer row
    let finalCustomerId = customer_id as string | null | undefined
    if (!finalCustomerId && customer_name) {
      const { data: c, error: cErr } = await supabase
        .from('customers')
        .insert({ name: String(customer_name), created_by: uid })
        .select('id')
        .single()
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 })
      finalCustomerId = c.id
    }

    // create offer (defaults + totals handled by triggers)
    const { data: offer, error: oErr } = await supabase
      .from('offers')
      .insert({
        customer_id: finalCustomerId ?? null,
        sales_rep_id: uid,
        title: title ?? null,
        transport_cost: Number(transport_cost) || 0,
        currency: String(currency || 'USD').slice(0,3),
        valid_until: valid_until ?? null,
        status: 'draft'
      })
      .select('id, offer_reference')
      .single()

    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 })

    // insert lines
    if (Array.isArray(lines) && lines.length) {
      const rows = lines.map((l: Line, idx: number) => ({
        offer_id: offer.id,
        catalog_item_id: l.catalog_item_id ?? null,
        description: l.description || l.sku || 'Item',
        quantity: Number(l.quantity) || 0,
        unit: l.unit ?? null,
        unit_price: Number(l.unit_price) || 0,
        discount_amount: Number(l.discount_amount) || 0,
        tax_rate: Number(l.tax_rate ?? 0) || 0,
        position: idx
      }))
      const { error: liErr } = await supabase.from('offer_items').insert(rows)
      if (liErr) return NextResponse.json({ error: liErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, offer })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const auth = req.headers.get('authorization') || ''
    if (!auth) return NextResponse.json({ error: 'Missing Authorization' }, { status: 401 })
    const supabase = createClient(url, anon, { global: { headers: { Authorization: auth } } })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let q = supabase
      .from('offers')
      .select('id, offer_reference, title, status, total_amount, created_at, customer:customer_id(name)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (status) {
      // @ts-ignore supabase-js infers condition builder
      q = q.eq('status', status)
    }

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ offers: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 })
  }
}
