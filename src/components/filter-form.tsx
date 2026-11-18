'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTransition, type FormEvent } from 'react'
import { Spinner } from '@/components/spinner'
import { filtersToQuery } from '@/lib/filter-query'

/**
 * Formulário de filtros que navega pelo cliente (sem recarregar a página) e mostra um spinner enquanto a nova tela carrega.
 * @param props.className Classes do formulário.
 * @param props.children Campos do filtro; o submit (inclusive via requestSubmit) aplica os valores na URL da página atual.
 * @returns Formulário com indicador de carregamento ao final.
 */
export function FilterForm({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = filtersToQuery(new FormData(event.currentTarget))
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  return (
    <form onSubmit={onSubmit} aria-busy={pending} className={className}>
      {children}
      <span role="status" className="inline-flex size-5 items-center justify-center text-ink-2">
        {pending && (
          <>
            <Spinner size={16} />
            <span className="sr-only">Carregando…</span>
          </>
        )}
      </span>
    </form>
  )
}
