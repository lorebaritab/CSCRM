"use client"

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '../../../../../lib/supabaseClient'

type Offer = {
  id: string
  offer_reference: string
  title: string | null
  status: string
  currency: string
  transport_cost: number
  valid_until: string | null
  notes: string | null
  created_at: string
  customer?: { id?: string; name?: string | null } | null
}

export type OfferItem = {
  id?: string
  description: string
  quantity: number
  unit?: string | null
  unit_price: number
  discount_amount: number
  tax_rate?: number | null
  line_total?: number
  position?: number
}

type Props = {
  offerId: string
  initialOffer: Offer
  initialItems: OfferItem[]
  userRole: string
}

export default function OfferDetailClient({ offerId, initialOffer, initialItems, userRole }: Props) {
  const [offer, setOffer] = useState<Offer>(initialOffer)
  const [items, setItems] = useState<OfferItem[]>(initialItems)
  const [busy, setBusy] = useState(false)

  const isDraft = offer.status === 'draft'
  const canApprove = userRole === 'manager' || userRole === 'admin'

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, line) => sum + line.quantity * line.unit_price, 0)
    const discounts = items.reduce((sum, line) => sum + (line.discount_amount || 0), 0)
    const preTax = subtotal - discounts + Number(offer.transport_cost || 0)
    return { subtotal, discounts, preTax }
  }, [items, offer.transport_cost])

  const tokenFetch = async (path: string, init?: RequestInit) => {
    const supabase = getSupabase()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Please sign in again.')
    const res = await fetch(path, {
      ...(init || {}),
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`
      }
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Request failed')
    return json
  }

  const updateItem = (idx: number, patch: Partial<OfferItem>) => {
    setItems((prev) => prev.map((line, index) => (index === idx ? { ...line, ...patch } : line)))
  }

  const onSave = async () => {
    try {
      setBusy(true)
      await tokenFetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: offer.title ?? null,
          valid_until: offer.valid_until ?? null,
          transport_cost: offer.transport_cost ?? 0,
          notes: offer.notes ?? null,
          lines: items.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unit: line.unit ?? null,
            unit_price: line.unit_price,
            discount_amount: line.discount_amount || 0,
            tax_rate: line.tax_rate || 0
          }))
        })
      })
      alert('Saved')
    } catch (e: any) {
      alert(`Error: ${String(e.message || e)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleAction = async (kind: 'submit' | 'approve' | 'reject') => {
    try {
      setBusy(true)
      await tokenFetch(`/api/offers/${offerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: kind })
      })
      alert(
        kind === 'submit'
          ? 'Submitted for approval'
          : kind === 'approve'
            ? 'Approved'
            : 'Rejected'
      )
      window.location.reload()
    } catch (e: any) {
      alert(`Error: ${String(e.message || e)}`)
    } finally {
      setBusy(false)
    }
  }

  const viewPdf = async () => {
    try {
      setBusy(true)
      const supabase = getSupabase()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch(`/api/offers/${offerId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'PDF not available')
      window.open(json.url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      alert(`Error: ${String(e.message || e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Offer {offer.offer_reference}</h2>
          <p className="text-sm text-slate-600">
            Status: <span className="rounded border px-2 py-0.5">{offer.status}</span>
          </p>
        </div>
        <Link href="/app/sales" className="text-sm underline">
          Back to Sales
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">
          Title
          <input
            disabled={!isDraft || busy}
            className="mt-1 w-full rounded border p-2"
            value={offer.title ?? ''}
            onChange={(event) => setOffer({ ...offer, title: event.target.value })}
          />
        </label>
        <label className="text-sm">
          Valid Until
          <input
            disabled={!isDraft || busy}
            type="date"
            className="mt-1 w-full rounded border p-2"
            value={offer.valid_until ?? ''}
            onChange={(event) => setOffer({ ...offer, valid_until: event.target.value })}
          />
        </label>
        <label className="text-sm">
          Transport Cost
          <input
            disabled={!isDraft || busy}
            type="number"
            className="mt-1 w-full rounded border p-2"
            value={offer.transport_cost ?? 0}
            onChange={(event) =>
              setOffer({ ...offer, transport_cost: parseFloat(event.target.value || '0') })
            }
          />
        </label>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 font-semibold">Line Items</h3>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="p-2">Description</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Unit Price</th>
                <th className="p-2">Discount</th>
                <th className="p-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((line, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">
                    <input
                      disabled={!isDraft || busy}
                      className="w-full rounded border p-1"
                      value={line.description}
                      onChange={(event) => updateItem(idx, { description: event.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      disabled={!isDraft || busy}
                      type="number"
                      className="w-24 rounded border p-1"
                      value={line.quantity}
                      onChange={(event) =>
                        updateItem(idx, { quantity: parseFloat(event.target.value || '0') })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      disabled={!isDraft || busy}
                      className="w-24 rounded border p-1"
                      value={line.unit ?? ''}
                      onChange={(event) => updateItem(idx, { unit: event.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      disabled={!isDraft || busy}
                      type="number"
                      className="w-28 rounded border p-1"
                      value={line.unit_price}
                      onChange={(event) =>
                        updateItem(idx, { unit_price: parseFloat(event.target.value || '0') })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      disabled={!isDraft || busy}
                      type="number"
                      className="w-28 rounded border p-1"
                      value={line.discount_amount}
                      onChange={(event) =>
                        updateItem(idx, { discount_amount: parseFloat(event.target.value || '0') })
                      }
                    />
                  </td>
                  <td className="p-2 text-right">
                    {(line.quantity * line.unit_price - (line.discount_amount || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    No items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid w-full max-w-md gap-2">
        <div className="flex justify-between">
          <span className="text-slate-600">Subtotal</span>
          <span>{totals.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Discounts</span>
          <span>-{totals.discounts.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total (excl. tax)</span>
          <span>{totals.preTax.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {isDraft && (
          <button
            onClick={onSave}
            disabled={busy}
            className="rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
          >
            Save
          </button>
        )}
        {isDraft && (
          <button
            onClick={() => handleAction('submit')}
            disabled={busy}
            className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Submit for approval
          </button>
        )}
        {canApprove && offer.status === 'submitted' && (
          <>
            <button
              onClick={() => handleAction('approve')}
              disabled={busy}
              className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={busy}
              className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {offer.status !== 'draft' && (
          <button
            onClick={viewPdf}
            disabled={busy}
            className="rounded border px-4 py-2 disabled:opacity-50"
          >
            View PDF
          </button>
        )}
      </div>
    </div>
  )
}
