"use client"
import { useEffect, useState } from 'react'
import { getSupabase } from '../../../../lib/supabaseClient'

type Item = { id: string; sku: string; name: string; description: string | null; base_price: number; tax_rate: number | null; unit: string | null; currency: string; is_active: boolean }

export default function CatalogPage() {
  const [items, setItems] = useState<Item[]>([])
  const [role, setRole] = useState('sales_rep')
  const [form, setForm] = useState({ sku: '', name: '', description: '', base_price: 0, tax_rate: 0, unit: '', currency: 'USD', is_active: true })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const token = async () => (await getSupabase().auth.getSession()).data.session?.access_token

  const load = async () => {
    setErr(''); setMsg('')
    try {
      const t = await token(); if (!t) throw new Error('Please login')
      const res = await fetch('/api/catalog-items', { headers: { Authorization: `Bearer ${t}` } })
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Failed')
      setItems(j.items || [])
    } catch (e: any) { setErr(String(e.message || e)) }
  }

  useEffect(() => { (async() => {
    const s = getSupabase()
    const { data } = await s.from('profiles').select('role').maybeSingle()
    if (data?.role) setRole(data.role)
    await load()
  })() }, [])

  const createItem = async () => {
    setErr(''); setMsg('')
    try {
      const t = await token(); if (!t) throw new Error('Please login')
      const res = await fetch('/api/catalog-items', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(form) })
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Failed to create')
      setMsg('Created'); setForm({ sku: '', name: '', description: '', base_price: 0, tax_rate: 0, unit: '', currency: 'USD', is_active: true }); load()
    } catch (e: any) { setErr(String(e.message || e)) }
  }

  const toggleActive = async (id: string, is_active: boolean) => {
    try {
      const t = await token(); if (!t) throw new Error('Login')
      const res = await fetch(`/api/catalog-items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ is_active }) })
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Failed')
      load()
    } catch (e: any) { alert(String(e.message || e)) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete item?')) return
    try {
      const t = await token(); if (!t) throw new Error('Login')
      const res = await fetch(`/api/catalog-items/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } })
      const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Failed')
      load()
    } catch (e: any) { alert(String(e.message || e)) }
  }

  const canManage = role === 'manager' || role === 'admin'

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Catalog</h2>
      {!canManage && <p className="text-sm text-slate-600 mb-4">View only — managers/admins can add or edit items.</p>}
      {canManage && (
        <div className="mb-6 grid gap-2 border rounded p-3 bg-white">
          <h3 className="font-semibold">New Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="border rounded p-2" placeholder="SKU" value={form.sku} onChange={e=>setForm({...form, sku: e.target.value})} />
            <input className="border rounded p-2" placeholder="Name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
            <input className="border rounded p-2" placeholder="Unit (optional)" value={form.unit} onChange={e=>setForm({...form, unit: e.target.value})} />
            <input type="number" className="border rounded p-2" placeholder="Base price" value={form.base_price} onChange={e=>setForm({...form, base_price: parseFloat(e.target.value||'0')})} />
            <input type="number" className="border rounded p-2" placeholder="Tax %" value={form.tax_rate} onChange={e=>setForm({...form, tax_rate: parseFloat(e.target.value||'0')})} />
            <input className="border rounded p-2" placeholder="Currency" value={form.currency} onChange={e=>setForm({...form, currency: e.target.value})} />
          </div>
          <textarea className="border rounded p-2" placeholder="Description" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
          <div className="flex items-center justify-between">
            <label className="text-sm"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form, is_active: e.target.checked})} className="mr-2"/> Active</label>
            <button onClick={createItem} className="rounded bg-emerald-600 px-4 py-2 text-white">Create</button>
          </div>
          {msg && <p className="text-emerald-700 text-sm">{msg}</p>}
          {err && <p className="text-red-600 text-sm">{err}</p>}
        </div>
      )}

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="p-2">SKU</th>
              <th className="p-2">Name</th>
              <th className="p-2">Price</th>
              <th className="p-2">Tax %</th>
              <th className="p-2">Unit</th>
              <th className="p-2">Active</th>
              {canManage && <th className="p-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(ci => (
              <tr key={ci.id} className="border-t">
                <td className="p-2">{ci.sku}</td>
                <td className="p-2">{ci.name}</td>
                <td className="p-2">{ci.base_price.toFixed(2)} {ci.currency}</td>
                <td className="p-2">{ci.tax_rate ?? 0}</td>
                <td className="p-2">{ci.unit ?? '—'}</td>
                <td className="p-2">
                  {canManage ? (
                    <input type="checkbox" checked={ci.is_active} onChange={e=>toggleActive(ci.id, e.target.checked)} />
                  ) : (
                    <span>{ci.is_active ? 'Yes' : 'No'}</span>
                  )}
                </td>
                {canManage && (
                  <td className="p-2">
                    <button onClick={()=>remove(ci.id)} className="text-sm text-red-600">Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && <tr><td className="p-3 text-slate-500" colSpan={7}>No catalog items</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )}

