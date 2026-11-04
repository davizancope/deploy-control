import { describe, expect, it } from 'vitest'
import { prLabel } from './format'

describe('prLabel', () => {
  it('usa o número quando existe', () => {
    expect(prLabel(42, 'https://bitbucket.org/ws/repo/pull-requests/42')).toBe('PR #42')
  })

  it('sem número, usa o último trecho da URL', () => {
    expect(prLabel(null, 'https://git.example.com/ws/repo/pull/feature-x?tab=diff#top')).toBe('PR feature-x')
  })

  it('sem número e sem caminho, devolve só PR', () => {
    expect(prLabel(null, '')).toBe('PR')
  })
})
