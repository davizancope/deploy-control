'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/', label: 'Painel', match: (p: string) => p === '/' },
  { href: '/deploys', label: 'Deploys', match: (p: string) => p.startsWith('/deploys') || p.startsWith('/tasks') },
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
            className={`whitespace-nowrap rounded-md px-3 py-2 text-[15px] transition-colors ${
              active ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-sunken hover:text-ink'
            }`}
          >
            {item.label}
            {item.href === '/vincular' && pendingLinks > 0 && (
              <span className={`ml-2 rounded-full px-1.5 text-xs font-semibold ${active ? 'bg-paper text-ink' : 'bg-hotfix-soft text-hotfix'}`}>{pendingLinks}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
