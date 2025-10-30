export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function clientFromAuth(authHeader: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anon, { global: { headers: { Authorization: authHeader || '' } } })
}

type OfferRecord = {
  id: string
  offer_reference: string
  title: string | null
  status: string
  currency: string
  subtotal_amount: number | null
  discount_amount: number | null
  tax_amount: number | null
  transport_cost: number | null
  total_amount: number | null
  notes: string | null
  valid_until: string | null
  created_at: string
  customer: { id?: string; name?: string | null } | null
}

type OfferItemRecord = {
  id: string
  description: string
  quantity: number
  unit: string | null
  unit_price: number
  discount_amount: number | null
  tax_rate: number | null
  line_total: number | null
  position: number | null
}

type OfferForPdf = {
  offer_reference: string
  currency: string
  transport_cost: number | null
  total_amount: number | null
  created_at: string
  pdf_storage_path: string | null
  signed_at: string | null
  customer: { name?: string | null } | null
}

type OfferItemForPdf = {
  description: string | null
  quantity: number
  unit: string | null
  unit_price: number
  discount_amount: number | null
}

type OfferNotificationRow = {
  offer_reference: string
  total_amount: number | null
  sales_rep_id: string | null
  customer: { name?: string | null } | null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = clientFromAuth(req.headers.get('authorization'))
  const offerId = params.id
  const { data: offer, error } = await supabase
    .from('offers')
    .select('id, offer_reference, title, status, currency, subtotal_amount, discount_amount, tax_amount, transport_cost, total_amount, notes, valid_until, created_at, customer:customer_id(id,name)')
    .eq('id', offerId)
    .single<OfferRecord>()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: items, error: itemsErr } = await supabase
    .from('offer_items')
    .select('id, description, quantity, unit, unit_price, discount_amount, tax_rate, line_total, position')
    .eq('offer_id', offerId)
    .order('position', { ascending: true })
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 })
  return NextResponse.json({ offer, items: (items ?? []) as OfferItemRecord[] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { title, valid_until, transport_cost, notes, lines } = body || {}
    const supabase = clientFromAuth(req.headers.get('authorization'))
    const offerId = params.id

    // Update offer header (only in draft per RLS business intent)
    const { error: updErr } = await supabase
      .from('offers')
      .update({ title, valid_until, transport_cost, notes })
      .eq('id', offerId)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

    if (Array.isArray(lines)) {
      // Replace lines: delete then insert
      const { error: delErr } = await supabase.from('offer_items').delete().eq('offer_id', offerId)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
      if (lines.length) {
        const rows = lines.map((l: any, idx: number) => ({
          offer_id: offerId,
          description: l.description || l.sku || 'Item',
          quantity: Number(l.quantity) || 0,
          unit: l.unit ?? null,
          unit_price: Number(l.unit_price) || 0,
          discount_amount: Number(l.discount_amount) || 0,
          tax_rate: Number(l.tax_rate ?? 0) || 0,
          position: idx
        }))
        const { error: insErr } = await supabase.from('offer_items').insert(rows)
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { action, comment } = body || {}
    const auth = req.headers.get('authorization')
    const supabase = clientFromAuth(auth)
    const offerId = params.id

    // get current user id and role
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const uid = userData.user.id
    const { data: me } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
    const isManager = me?.role === 'manager' || me?.role === 'admin'

    if (action === 'submit') {
      const { error } = await supabase
        .from('offers')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', offerId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'approve' || action === 'reject') {
      if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (action === 'approve') {
        const { error: insErr } = await supabase
          .from('offer_approvals')
          .insert({ offer_id: offerId, approver_id: uid, decision: 'approved', comment: comment ?? null })
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
        const { error: updErr } = await supabase
          .from('offers')
          .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: uid })
          .eq('id', offerId)
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })
        // Generate PDF and upload + notifications
        try {
          const pdfRes = await generateOfferPdfAndStore(offerId, req.headers.get('authorization'))
          if (!pdfRes.ok) {
            return NextResponse.json({ ok: true, warning: 'PDF generation failed' })
          }
          await notifyOfferApproved(offerId)
        } catch { /* ignore */ }
        return NextResponse.json({ ok: true })
      } else {
        const { error: insErr } = await supabase
          .from('offer_approvals')
          .insert({ offer_id: offerId, approver_id: uid, decision: 'rejected', comment: comment ?? null })
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
        const { error: updErr } = await supabase
          .from('offers')
          .update({ status: 'rejected', rejected_at: new Date().toISOString(), rejected_reason: comment ?? null })
          .eq('id', offerId)
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })
        return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 })
  }
}

// --- PDF generation helper ---
import PDFDocument from 'pdfkit'
import { buffer as streamBuffer } from 'node:stream/consumers'

async function generateOfferPdfAndStore(offerId: string, authHeader: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(url, anon, { global: { headers: { Authorization: authHeader || '' } } })
  const svcClient = createClient(url, svc)
  const BUCKET = process.env.NEXT_PUBLIC_OFFERS_BUCKET || 'offers'
  try { await svcClient.storage.createBucket(BUCKET, { public: false }) } catch {}

  const { data: offer, error } = await supabase
    .from('offers')
    .select('offer_reference, currency, transport_cost, total_amount, created_at, pdf_storage_path, signed_at, customer:customer_id(name)')
    .eq('id', offerId)
    .single<OfferForPdf>()
  if (error || !offer) return { ok: false }
  const { data: items } = await supabase
    .from('offer_items')
    .select('description, quantity, unit, unit_price, discount_amount')
    .eq('offer_id', offerId)
    .order('position', { ascending: true })

  const doc = new PDFDocument({ margin: 50 })
  doc.fontSize(16).text(`Offer ${offer.offer_reference}`, { continued: false })
  doc.moveDown(0.5)
  doc.fontSize(10).text(`Customer: ${offer.customer?.name || '-'}`)
  doc.text(`Date: ${new Date(offer.created_at).toLocaleDateString()}`)
  doc.text(`Currency: ${offer.currency}`)
  doc.moveDown()
  doc.fontSize(12).text('Items')
  doc.moveDown(0.5)
  doc.fontSize(10)
  doc.text('Description', 50, doc.y, { continued: true })
  doc.text('Qty', 260, undefined, { continued: true })
  doc.text('Unit', 300, undefined, { continued: true })
  doc.text('Unit Price', 360, undefined, { continued: true })
  doc.text('Discount', 440, undefined, { continued: true })
  doc.text('Line Total', 520)
  doc.moveDown(0.5)
  let y = doc.y
  ;((items ?? []) as OfferItemForPdf[]).forEach((it) => {
    const qty = Number(it.quantity || 0)
    const price = Number(it.unit_price || 0)
    const discount = Number(it.discount_amount || 0)
    const lineTotal = qty * price - discount
    doc.text(it.description || '-', 50, y, { continued: true })
    doc.text(String(qty), 260, y, { continued: true })
    doc.text(it.unit || '-', 300, y, { continued: true })
    doc.text(price.toFixed(2), 360, y, { continued: true })
    doc.text(discount.toFixed(2), 440, y, { continued: true })
    doc.text(Number(lineTotal).toFixed(2), 520, y)
    y += 16
  })
  doc.moveDown()
  doc.text(`Transport: ${Number(offer.transport_cost||0).toFixed(2)}`)
  doc.text(`Total: ${Number(offer.total_amount||0).toFixed(2)}`)
  doc.end()
  // stream/consumers helper turns the PDF stream into a Buffer
  const buffer = await streamBuffer(doc as unknown as NodeJS.ReadableStream)

  const path = `${offer.offer_reference}.pdf`
  const { error: upErr } = await svcClient.storage.from(BUCKET).upload(path, buffer, { contentType: 'application/pdf', upsert: true })
  if (upErr) return { ok: false }
  await svcClient.from('offers').update({ pdf_storage_path: path, signed_at: new Date().toISOString() }).eq('id', offerId)
  return { ok: true }
}

// --- Notifications helper ---
async function notifyOfferApproved(offerId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(url, svc)
  const { data: o } = await supabase
    .from('offers')
    .select('offer_reference, total_amount, sales_rep_id, customer:customer_id(name)')
    .eq('id', offerId)
    .single<OfferNotificationRow>()
  if (!o) return

  const repId = o.sales_rep_id
  const { data: rep } = repId
    ? await supabase.from('profiles').select('email, full_name').eq('id', repId).maybeSingle<{ email: string | null; full_name: string | null }>()
    : { data: null }
  const to = rep?.email
  const subject = `Offer ${o.offer_reference} approved`
  const custName = o.customer?.name || '-'
  const text = `Offer ${o.offer_reference} for ${custName} has been approved. Total: ${Number(o.total_amount||0).toFixed(2)}`

  // Send email via Resend if configured
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && to) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [to], subject, text })
    }).catch(() => null)
  }
  // Telegram (optional)
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const custName2 = o.customer?.name || '-'
    const msg = `✅ ${subject}\nCustomer: ${custName2}\nTotal: ${Number(o.total_amount||0).toFixed(2)}`
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: msg })
    }).catch(() => null)
  }
}
