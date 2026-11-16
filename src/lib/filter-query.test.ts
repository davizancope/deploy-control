import { describe, expect, it } from 'vitest'
import { filtersToQuery } from './filter-query'

describe('filtersToQuery', () => {
  it('mantém só os campos preenchidos', () => {
    expect(filtersToQuery([['q', 'release_4'], ['projeto', ''], ['ambiente', 'production'], ['de', '']])).toBe('q=release_4&ambiente=production')
  })

  it('apara espaços e ignora campos só com espaços', () => {
    expect(filtersToQuery([['q', '  ABC-123  '], ['tipo', '   ']])).toBe('q=ABC-123')
  })

  it('devolve vazio sem filtros e ignora arquivos', () => {
    expect(filtersToQuery([['q', ''], ['de', '']])).toBe('')
    expect(filtersToQuery([['anexo', new File([], 'a.txt')]])).toBe('')
  })

  it('codifica caracteres especiais', () => {
    expect(filtersToQuery([['q', 'a b/c']])).toBe('q=a+b%2Fc')
  })
})
