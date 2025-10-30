import './globals.css'
import Link from 'next/link'
import AuthStatus from '../components/AuthStatus'

export const metadata = { title: 'Capture Ops', description: 'Internal platform' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <aside className="w-60 border-r bg-white p-4">
            <h1 className="mb-4 text-lg font-semibold">Capture Ops</h1>
            <nav className="space-y-2 text-sm">
              <Link href="/" className="block hover:underline">Dashboard</Link>
              <Link href="/app/sales" className="block hover:underline">Sales</Link>
              <Link href="/app/sales/catalog" className="block hover:underline">Catalog</Link>
              <Link href="/app/documents" className="block hover:underline">Documents</Link>
              <Link href="/app/inventory" className="block hover:underline">Inventory</Link>
              <Link href="/app/support" className="block hover:underline">Support</Link>
              <Link href="/app/settings" className="block hover:underline">Settings</Link>
            </nav>
          </aside>
          <main className="flex-1 p-6">
            <div className="mb-4 flex justify-end"><AuthStatus /></div>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
