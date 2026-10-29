'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/', label: 'Painel', match: (p: string) => p === '/' },
  { href: '/deploys', label: 'Deploys', match: (p: string) => p.startsWith('/deploys') || p.startsWith('/tasks') },
  { href: '/branches', label: 'Branches', match: (p: string) => p.startsWith('/branches') },
  { href: '/projetos', label: 'Projetos', match: (p: string) => p.startsWith('/projetos') },
  { href: '/vincular', label: 'Vincular PRs', match: (p: string) => p.startsWith('/vincular') },
  { href: '/importar', label: 'Importar planilha', match: (p: string) => p.startsWith('/importar') },
  { href: '/mensagem-time', label: 'Mensagem ao time', match: (p: string) => p.startsWith('/mensagem-time') },
]

export function Nav({ pendingLinks }: { pendingLinks: number }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Principal" className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.filter((item) => item.href !== '/vincular' || pendingLinks > 0 || pathname.startsWith('/vincular')).map((item) => {
        const active = item.match(pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[15px] transition-colors ${
              active ? 'lift font-medium text-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink'
            }`}
          >
            {item.label}
            {item.href === '/vincular' && pendingLinks > 0 && (
              <span className="ml-2 rounded-full bg-warn-soft px-1.5 text-xs font-semibold text-warn">{pendingLinks}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
