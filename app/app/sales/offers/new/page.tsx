'use client'
import { useState } from 'react'
import { getSupabase } from '../../../../../lib/supabaseClient'

type Line = { sku: string; description: string; quantity: number; unitPrice: number; discount: number }
type CatalogItem = { id: string; sku: string; name: string; description: string | null; base_price: number; unit: string | null; tax_rate: number | null }

export default function NewOfferPage() {
  const [customer, setCustomer] = useState('')
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [transport, setTransport] = useState(0)
  const [lines, setLines] = useState<Line[]>([{ sku: '', description: '', quantity: 1, unitPrice: 0, discount: 0 }])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [showSuggest, setShowSuggest] = useState<number | null>(null)

  const subtotal = lines.reduce((s,l)=> s + l.quantity * l.unitPrice, 0)
  const discounts = lines.reduce((s,l)=> s + l.discount, 0)
  const total = subtotal - discounts + transport

  const addLine = () => setLines([...lines, { sku: '', description: '', quantity: 1, unitPrice: 0, discount: 0 }])
  const updateLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l,idx)=> idx===i?{...l, ...patch}:l))
  const removeLine = (i:number)=> setLines(lines.filter((_,idx)=> idx!==i))

  const loadCatalog = async () => {
    try {
      const supabase = getSupabase()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) return
      const res = await fetch('/api/catalog-items', { headers: { Authorization: `Bearer ${token}` } })
      const j = await res.json()
      if (res.ok) setCatalog(j.items || [])
    } catch { /* ignore */ }
  }

  const saveDraft = async () => {
    const supabase = getSupabase()
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) {
      alert('Please login first.');
      return
    }
    const payload = {
      customer_name: customer || null,
      title,
      valid_until: validUntil || null,
      transport_cost: transport,
      lines: lines.map(l => ({
        sku: l.sku,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        discount_amount: l.discount
      }))
    }
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    })
    const j = await res.json()
    if (!res.ok) {
      alert('Error: ' + (j.error || 'failed'))
    } else {
      alert('Saved! Offer reference: ' + j.offer.offer_reference)
      window.location.href = '/app/sales'
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">New Offer</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">Customer
          <input className="mt-1 w-full rounded border p-2" value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Customer name" />
        </label>
        <label className="text-sm">Title
          <input className="mt-1 w-full rounded border p-2" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Offer title" />
        </label>
        <label className="text-sm">Valid Until
          <input type="date" className="mt-1 w-full rounded border p-2" value={validUntil} onChange={e=>setValidUntil(e.target.value)} />
        </label>
        <label className="text-sm">Transport Cost
          <input type="number" className="mt-1 w-full rounded border p-2" value={transport} onChange={e=>setTransport(parseFloat(e.target.value||'0'))} />
        </label>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Line Items</h3>
          <button onClick={addLine} className="rounded bg-slate-800 px-3 py-1 text-white text-sm">Add line</button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="p-2">SKU</th>
                <th className="p-2">Description</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Unit Price</th>
                <th className="p-2">Discount</th>
                <th className="p-2">Line Total</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-2">
                    <input
                      className="w-full border rounded p-1"
                      value={l.sku}
                      onFocus={() => { setShowSuggest(i); if (!catalog.length) loadCatalog() }}
                      onChange={e=>updateLine(i,{sku:e.target.value})}
                      placeholder="SKU"
                    />
                    {showSuggest===i && catalog.length>0 && (
                      <div className="mt-1 max-h-48 overflow-auto rounded border bg-white shadow">
                        {catalog.filter(ci=>
                          !l.sku || ci.sku.toLowerCase().includes(l.sku.toLowerCase()) || (ci.name||'').toLowerCase().includes(l.sku.toLowerCase())
                        ).slice(0,50).map(ci => (
                          <button
                            key={ci.id}
                            type="button"
                            className="block w-full text-left px-2 py-1 hover:bg-slate-50"
                            onClick={() => {
                              updateLine(i, { sku: ci.sku, description: ci.name || ci.description || '', unitPrice: Number(ci.base_price||0) })
                              setShowSuggest(null)
                            }}
                          >
                            <div className="text-sm font-medium">{ci.sku} — {ci.name}</div>
                            {ci.description && <div className="text-xs text-slate-500 truncate">{ci.description}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <input className="w-full border rounded p-1" value={l.description} onChange={e=>updateLine(i,{description:e.target.value})} placeholder="Description" />
                  </td>
                  <td className="p-2"><input type="number" className="w-24 border rounded p-1" value={l.quantity} onChange={e=>updateLine(i,{quantity: parseFloat(e.target.value||'0')})} /></td>
                  <td className="p-2"><input type="number" className="w-28 border rounded p-1" value={l.unitPrice} onChange={e=>updateLine(i,{unitPrice: parseFloat(e.target.value||'0')})} /></td>
                  <td className="p-2"><input type="number" className="w-28 border rounded p-1" value={l.discount} onChange={e=>updateLine(i,{discount: parseFloat(e.target.value||'0')})} /></td>
                  <td className="p-2 text-right">{(l.quantity*l.unitPrice - l.discount).toFixed(2)}</td>
                  <td className="p-2"><button className="text-red-600 text-xs" onClick={()=>removeLine(i)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-2 w-full max-w-md">
        <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-slate-600">Discounts</span><span>-{discounts.toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total (excl. tax)</span><span>{total.toFixed(2)}</span></div>
      </div>

      <div className="mt-6">
        <button onClick={saveDraft} className="rounded bg-emerald-600 px-4 py-2 text-white">Save Draft</button>
      </div>
    </div>
  )
}
