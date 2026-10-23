'use client'

import { useRef } from 'react'
import type { OrgSummary } from '@/lib/session'
import { switchOrg } from './actions'

export function OrgSwitcher({ orgs, activeId }: { orgs: OrgSummary[]; activeId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  return (
    <form ref={formRef} action={switchOrg}>
      <label htmlFor="org" className="sr-only">Organização</label>
      <select
        id="org"
        name="org"
        defaultValue={activeId}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full cursor-pointer appearance-none rounded-md border border-transparent bg-transparent py-1 pr-6 text-base font-semibold tracking-tight hover:border-line"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
        <option value="__new">+ Nova organização</option>
      </select>
    </form>
  )
}
