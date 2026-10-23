'use client'

import { FieldError, FormNotice, SubmitButton } from '@/components/ui'
import { useFormAction } from '@/components/use-form-action'
import { createOrganization } from './actions'

export function OrgForm() {
  const { state, onSubmit, pending } = useFormAction(createOrganization)
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormNotice error={state.error} />
      <div>
        <label className="label" htmlFor="name">Nome da organização</label>
        <input className="field" id="name" name="name" placeholder="Ex.: Backlgrs" required autoFocus />
        <FieldError message={state.fieldErrors?.name} />
      </div>
      <SubmitButton busy={pending} pending="Criando…" className="btn-primary w-full">Criar organização</SubmitButton>
    </form>
  )
}
