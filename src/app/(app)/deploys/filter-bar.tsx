'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useTransition, type FormEvent } from 'react'
import { Spinner } from '@/components/spinner'
import { filtersToQuery } from '@/lib/filter-query'

const SEARCH_DEBOUNCE_MS = 400

export type FilterValues = { q: string; projeto: string; ambiente: string; tipo: string; de: string; ate: string }

/**
 * Filtros da lista de deploys: aplicam sozinhos ao mudar um campo, com atraso enquanto se digita na busca.
 * @param props.values Valores atuais, vindos da URL.
 * @param props.projects Projetos do seletor.
 * @param props.filtered Se há algum filtro ativo (mostra o "Limpar").
 * @returns Formulário de busca.
 */
export function DeployFilterBar({
  values,
  projects,
  filtered,
}: {
  values: FilterValues
  projects: { id: string; name: string }[]
  filtered: boolean
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [pending, startTransition] = useTransition()
  const { q, projeto, ambiente, tipo, de, ate } = values

  const apply = () => {
    clearTimeout(timer.current)
    if (!formRef.current) return
    const query = filtersToQuery(new FormData(formRef.current))
    startTransition(() => router.replace(query ? `/deploys?${query}` : '/deploys', { scroll: false }))
  }

  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as HTMLElement
    if (target instanceof HTMLInputElement && target.type === 'search') {
      clearTimeout(timer.current)
      timer.current = setTimeout(apply, SEARCH_DEBOUNCE_MS)
    } else {
      apply()
    }
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  // Acompanha a URL quando ela muda por fora (menu, "Limpar"), sem mexer no campo em que a pessoa está digitando.
  useEffect(() => {
    const form = formRef.current
    if (!form) return
    for (const [name, value] of Object.entries({ q, projeto, ambiente, tipo, de, ate })) {
      const field = form.elements.namedItem(name)
      if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement) && field !== document.activeElement && field.value !== value) {
        field.value = value
      }
    }
  }, [q, projeto, ambiente, tipo, de, ate])

  return (
    <form
      ref={formRef}
      action="/deploys"
      onChange={onChange}
      onSubmit={(event) => {
        event.preventDefault()
        apply()
      }}
      aria-busy={pending}
      className="mb-8 grid gap-3 glass rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr_auto]"
      role="search"
    >
      <div>
        <label className="label" htmlFor="q">Code version, branch ou task</label>
        <input className="field code" id="q" name="q" type="search" defaultValue={q} maxLength={80} placeholder="release_4_2 ou ABC-123" autoComplete="off" spellCheck={false} />
      </div>
      <div>
        <label className="label" htmlFor="projeto">Projeto</label>
        <select className="field" id="projeto" name="projeto" defaultValue={projeto}>
          <option value="">Todos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ambiente">Ambiente</label>
        <select className="field" id="ambiente" name="ambiente" defaultValue={ambiente}>
          <option value="">Todos</option>
          <option value="staging">Staging</option>
          <option value="production">Produção</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="tipo">Tipo</label>
        <select className="field" id="tipo" name="tipo" defaultValue={tipo}>
          <option value="">Todos</option>
          <option value="release">Release</option>
          <option value="hotfix">Hotfix</option>
          <option value="bugfix">Bugfix</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="de">De</label>
        <input className="field" id="de" name="de" type="date" defaultValue={de} />
      </div>
      <div>
        <label className="label" htmlFor="ate">Até</label>
        <input className="field" id="ate" name="ate" type="date" defaultValue={ate} />
      </div>
      <div className="flex items-end gap-2">
        {/* Sem botão visível, o Enter na busca ainda envia o formulário. */}
        <button type="submit" hidden>Filtrar</button>
        <span role="status" className="inline-flex size-5 items-center justify-center self-center text-ink-2">
          {pending && (
            <>
              <Spinner size={16} />
              <span className="sr-only">Carregando…</span>
            </>
          )}
        </span>
        {filtered && (
          <Link href="/deploys" onClick={() => clearTimeout(timer.current)} className="btn px-2 text-ink-2 hover:text-ink">
            Limpar
          </Link>
        )}
      </div>
    </form>
  )
}
