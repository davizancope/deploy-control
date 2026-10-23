'use client'

import { startTransition, useActionState, type FormEvent } from 'react'
import type { FormState } from '@/lib/forms'

/**
 * Liga uma Server Action a um formulário sem o reset automático do React 19, para não apagar o que a pessoa digitou quando há erro.
 * @param action Server Action no formato (estadoAnterior, formData) => estado.
 * @returns Estado atual, handler de submit e se está enviando.
 */
export function useFormAction(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState(action, {} as FormState)
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => dispatch(formData))
  }
  return { state, onSubmit, pending }
}
