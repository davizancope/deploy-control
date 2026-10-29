import { describe, expect, it } from 'vitest'
import { nextCell } from './grid-nav'

const size = { rows: 3, cols: 3 }
const edge = { start: 0, end: 0, length: 0 }

describe('nextCell', () => {
  it('↑ e ↓ mantêm a coluna; ↑ na primeira linha não faz nada', () => {
    expect(nextCell('ArrowUp', { row: 1, col: 2 }, size, edge)).toEqual({ row: 0, col: 2, caret: 'end' })
    expect(nextCell('ArrowUp', { row: 0, col: 2 }, size, edge)).toBeNull()
    expect(nextCell('ArrowDown', { row: 0, col: 1 }, size, edge)).toEqual({ row: 1, col: 1, caret: 'end' })
  })

  it('↓ na última linha aponta para uma linha que ainda não existe', () => {
    expect(nextCell('ArrowDown', { row: 2, col: 0 }, size, edge)).toEqual({ row: 3, col: 0, caret: 'end' })
  })

  it('← e → só trocam de campo com o cursor na borda do texto', () => {
    const mid = { start: 2, end: 2, length: 5 }
    expect(nextCell('ArrowLeft', { row: 0, col: 1 }, size, mid)).toBeNull()
    expect(nextCell('ArrowRight', { row: 0, col: 1 }, size, mid)).toBeNull()
    expect(nextCell('ArrowLeft', { row: 0, col: 1 }, size, { start: 0, end: 0, length: 5 })).toEqual({ row: 0, col: 0, caret: 'end' })
    expect(nextCell('ArrowRight', { row: 0, col: 1 }, size, { start: 5, end: 5, length: 5 })).toEqual({ row: 0, col: 2, caret: 'start' })
  })

  it('← e → não passam das bordas da linha nem atrapalham texto selecionado', () => {
    expect(nextCell('ArrowLeft', { row: 0, col: 0 }, size, edge)).toBeNull()
    expect(nextCell('ArrowRight', { row: 0, col: 2 }, size, edge)).toBeNull()
    expect(nextCell('ArrowRight', { row: 0, col: 0 }, size, { start: 0, end: 5, length: 5 })).toBeNull()
  })
})
