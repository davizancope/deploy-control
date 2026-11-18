import { describe, expect, it } from 'vitest'
import { branchesHref } from './branch-url'

const base = { projectId: 'p1', period: '90', pending: false }

describe('branchesHref', () => {
  it('seleciona a branch mantendo projeto e período', () => {
    expect(branchesHref({ ...base, branch: 'release/1.0', selected: '' })).toBe('/branches?projeto=p1&periodo=90&branch=release%2F1.0')
  })

  it('clicar na já selecionada limpa a seleção', () => {
    expect(branchesHref({ ...base, branch: 'release/1.0', selected: 'release/1.0' })).toBe('/branches?projeto=p1&periodo=90')
  })

  it('outra branch troca a seleção', () => {
    expect(branchesHref({ ...base, branch: 'b', selected: 'a' })).toContain('branch=b')
  })

  it('mantém o filtro de pendentes', () => {
    expect(branchesHref({ ...base, pending: true })).toBe('/branches?projeto=p1&periodo=90&pendentes=1')
  })
})
