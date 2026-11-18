'use client'

import { useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { Spinner } from '@/components/spinner'
import type { OrgSummary } from '@/lib/session'
import { switchOrg } from './actions'

/**
 * Seletor da organização: desabilita e mostra um spinner enquanto a troca é processada.
 * @param props.orgs Organizações do usuário.
 * @param props.activeId Organização ativa.
 * @returns Select dentro do formulário da Server Action.
 */
function OrgSelect({ orgs, activeId, formRef }: { orgs: OrgSummary[]; activeId: string; formRef: React.RefObject<HTMLFormElement | null> }) {
  const { pending } = useFormStatus()
  return (
    <>
      <select
        id="org"
        name="org"
        defaultValue={activeId}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full cursor-pointer appearance-none rounded-xl border border-transparent bg-transparent py-1 pr-6 text-base font-semibold tracking-tight hover:border-line"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
        <option value="__new">+ Nova organização</option>
      </select>
      {pending && <Spinner size={14} className="absolute top-1/2 right-1 -translate-y-1/2 text-ink-2" />}
    </>
  )
}

export function OrgSwitcher({ orgs, activeId }: { orgs: OrgSummary[]; activeId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  return (
    <form ref={formRef} action={switchOrg} className="relative">
      <label htmlFor="org" className="sr-only">Organização</label>
      <OrgSelect orgs={orgs} activeId={activeId} formRef={formRef} />
    </form>
  )
}
