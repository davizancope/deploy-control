import { describe, expect, it } from 'vitest'
import { evaluatePassword, isPasswordValid, PASSWORD_MAX, PASSWORD_MIN } from './password-rules'

const met = (value: string) => Object.fromEntries(evaluatePassword(value).map((r) => [r.id, r.met]))

describe('evaluatePassword', () => {
  it('senha vazia: tudo pendente e sem o limite máximo na lista', () => {
    expect(met('')).toEqual({ length: false, letter: false, digit: false })
  })

  it('marca cada critério de forma independente', () => {
    expect(met('abc')).toEqual({ length: false, letter: true, digit: false })
    expect(met('1234567890')).toEqual({ length: true, letter: false, digit: true })
    expect(met('abcdefghij1')).toEqual({ length: true, letter: true, digit: true })
  })

  it('conta exatamente o mínimo de caracteres', () => {
    expect(met('a'.repeat(PASSWORD_MIN - 1) + '1').length).toBe(true)
    expect(met('a'.repeat(PASSWORD_MIN - 2) + '1').length).toBe(false)
  })

  it('mostra o limite máximo só quando ele é ultrapassado', () => {
    expect(met('a1'.repeat(PASSWORD_MAX / 2)).max).toBeUndefined()
    expect(met('a1'.repeat(PASSWORD_MAX / 2) + 'a').max).toBe(false)
  })
})

describe('isPasswordValid', () => {
  it('aceita quando todos os critérios passam', () => {
    expect(isPasswordValid('senhaforte123')).toBe(true)
  })

  it('recusa curta, sem número, sem letra ou longa demais', () => {
    expect(isPasswordValid('abc123')).toBe(false)
    expect(isPasswordValid('somenteletras')).toBe(false)
    expect(isPasswordValid('1234567890123')).toBe(false)
    expect(isPasswordValid('a1'.repeat(PASSWORD_MAX / 2) + 'a')).toBe(false)
  })
})
