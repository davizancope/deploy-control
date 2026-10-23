export type FormState = {
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

export const initialFormState: FormState = {}

/**
 * Converte os erros do zod num mapa campo → primeira mensagem.
 * @param issues Lista de issues do zod.
 * @returns Mapa para exibir embaixo de cada campo.
 */
export function fieldErrorsFrom(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
