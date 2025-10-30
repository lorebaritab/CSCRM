import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSupabase } from '../../../lib/supabaseServer'
import PdfLink from './PdfLink'

type Row = {
  id: string
  offer_reference: string
  title: string | null
  status: string
  total_amount: number
  created_at: string
  pdf_storage_path: string | null
  customer?: { name?: string | null } | null
}

export default async function SalesPage() {
  const supabase = getServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login?next=/app/sales')

  const { data, error } = await supabase
    .from('offers')
    .select('id, offer_reference, title, status, total_amount, created_at, pdf_storage_path, customer:customer_id(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  const rows: Row[] = (data || []) as Row[]

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sales</h2>
        <Link href="/app/sales/offers/new" className="rounded bg-emerald-600 px-3 py-1.5 text-white text-sm">New Offer</Link>
      </div>
      <div className="mt-2 text-sm">
        <Link href="/app/sales/catalog" className="underline">Catalog</Link>
      </div>
      <div className="mt-4 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="p-2">Created</th>
              <th className="p-2">Reference</th>
              <th className="p-2">Customer</th>
              <th className="p-2">Title</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-center">PDF</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2 font-medium">
                  <Link href={`/app/sales/offers/${r.id}`} className="underline">
                    {r.offer_reference}
                  </Link>
                </td>
                <td className="p-2">{r.customer?.name ?? '—'}</td>
                <td className="p-2">{r.title ?? '—'}</td>
                <td className="p-2"><span className="rounded border px-2 py-0.5 text-xs">{r.status}</span></td>
                <td className="p-2 text-center">
                  {r.pdf_storage_path ? <PdfLink offerId={r.id} /> : '—'}
                </td>
                <td className="p-2 text-right">{Number(r.total_amount || 0).toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-3 text-slate-500">No offers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
