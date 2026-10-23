'use client'

/**
 * Select que envia o formulário ao mudar (filtros por GET).
 * @param props Atributos do select.
 * @returns Select.
 */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
}
