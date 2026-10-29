export type GridKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

export type GridMove = { row: number; col: number; caret: 'start' | 'end' }

/**
 * Decide para qual célula uma seta do teclado leva numa grade de campos de texto.
 * @param key Tecla pressionada.
 * @param pos Célula atual (linha e coluna, base 0).
 * @param size Quantidade de linhas e de colunas da grade.
 * @param caret Seleção do campo atual; ← e → só saem do campo quando o cursor já está na borda.
 * @returns Célula de destino (linha além da última significa "criar linha") ou null para manter o comportamento do navegador.
 */
export function nextCell(
  key: GridKey,
  pos: { row: number; col: number },
  size: { rows: number; cols: number },
  caret: { start: number; end: number; length: number },
): GridMove | null {
  const { row, col } = pos
  if (key === 'ArrowUp') return row > 0 ? { row: row - 1, col, caret: 'end' } : null
  if (key === 'ArrowDown') return { row: row + 1, col, caret: 'end' }
  const collapsed = caret.start === caret.end
  if (key === 'ArrowLeft') return collapsed && caret.start === 0 && col > 0 ? { row, col: col - 1, caret: 'end' } : null
  return collapsed && caret.end === caret.length && col < size.cols - 1 ? { row, col: col + 1, caret: 'start' } : null
}
