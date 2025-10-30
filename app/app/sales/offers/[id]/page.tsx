import { notFound, redirect } from 'next/navigation'
import { getServerSupabase } from '../../../../../lib/supabaseServer'
import OfferDetailClient, { type OfferItem } from './OfferDetailClient'

type OfferRow = {
  id: string
  offer_reference: string
  title: string | null
  status: string
  currency: string
  transport_cost: number
  valid_until: string | null
  notes: string | null
  created_at: string
  customer: { id?: string; name?: string | null } | null
}

export default async function OfferDetailPage({ params }: { params: { id: string } }) {
  const supabase = getServerSupabase()
  const {
    data: { session }
  } = await supabase.auth.getSession()

  const offerId = params.id
  if (!session) {
    redirect(`/login?next=/app/sales/offers/${offerId}`)
  }

  const { data: offer, error } = await supabase
    .from('offers')
    .select(
      'id, offer_reference, title, status, currency, transport_cost, valid_until, notes, created_at, customer:customer_id(id,name)'
    )
    .eq('id', offerId)
    .single<OfferRow>()

  if (error || !offer) {
    notFound()
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from('offer_items')
    .select('id, description, quantity, unit, unit_price, discount_amount, tax_rate, line_total, position')
    .eq('offer_id', offerId)
    .order('position', { ascending: true })

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  const items: OfferItem[] = (itemsData ?? []).map((line) => ({
    id: line.id,
    description: line.description,
    quantity: Number(line.quantity || 0),
    unit: line.unit,
    unit_price: Number(line.unit_price || 0),
    discount_amount: Number(line.discount_amount || 0),
    tax_rate: line.tax_rate,
    line_total: line.line_total ? Number(line.line_total) : undefined,
    position: line.position
  }))

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle<{ role: string | null }>()

  return (
    <OfferDetailClient
      offerId={offerId}
      initialOffer={offer}
      initialItems={items}
      userRole={me?.role ?? 'sales_rep'}
    />
  )
}
