export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 72

/**
 * Diz se a senha tem ao menos uma letra (A–Z, a mesma checagem do servidor).
 * @param value Senha digitada.
 * @returns true quando há pelo menos uma letra.
 */
export function hasLetter(value: string): boolean {
  return /[a-zA-Z]/.test(value)
}

/**
 * Diz se a senha tem ao menos um dígito.
 * @param value Senha digitada.
 * @returns true quando há pelo menos um número.
 */
export function hasDigit(value: string): boolean {
  return /\d/.test(value)
}

export type PasswordRule = {
  id: 'length' | 'letter' | 'digit' | 'max'
  label: string
  test: (value: string) => boolean
  /** Regra de limite: só aparece na lista quando é violada. */
  hideWhenMet?: boolean
}

export type RuleStatus = { id: string; label: string; met: boolean }

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: `Pelo menos ${PASSWORD_MIN} caracteres`, test: (v) => v.length >= PASSWORD_MIN },
  { id: 'letter', label: 'Pelo menos uma letra', test: hasLetter },
  { id: 'digit', label: 'Pelo menos um número', test: hasDigit },
  { id: 'max', label: `No máximo ${PASSWORD_MAX} caracteres`, test: (v) => v.length <= PASSWORD_MAX, hideWhenMet: true },
]

/**
 * Avalia a senha contra cada critério, para a lista exibida enquanto a pessoa digita.
 * @param value Senha digitada.
 * @returns Critérios a exibir, cada um com o estado atendido ou pendente.
 */
export function evaluatePassword(value: string): RuleStatus[] {
  return PASSWORD_RULES.map(({ id, label, test, hideWhenMet }) => ({ id, label, met: test(value), hideWhenMet }))
    .filter((rule) => !(rule.hideWhenMet && rule.met))
    .map(({ id, label, met }) => ({ id, label, met }))
}

/**
 * Diz se a senha atende todos os critérios.
 * @param value Senha digitada.
 * @returns true quando nenhum critério está pendente.
 */
export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}
