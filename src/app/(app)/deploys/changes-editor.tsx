'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { emptyRow, rowsFromColumns, type ChangeRow } from '@/lib/change-rows'
import { nextCell, type GridKey, type GridMove } from '@/lib/grid-nav'
import type { KnownLink } from '@/lib/data'

/**
 * Lista editável de PRs/commits do deploy, cada um com sua task (ou marcado como sem task, com descrição).
 * @param props.initial Linhas iniciais.
 * @param props.repoUrl Repositório do projeto (habilita PR só pelo número).
 * @param props.jiraPrefix Prefixo do Jira do projeto (habilita a task só pelo número).
 * @param props.known PRs e commits já vinculados no projeto, para completar a task sozinho.
 * @param props.error Erros por linha vindos do servidor.
 * @returns Editor com campo oculto "changes" em JSON.
 */
export function ChangesEditor({
  initial,
  repoUrl,
  jiraPrefix,
  known,
  error,
}: {
  initial: ChangeRow[]
  repoUrl: string | null
  jiraPrefix: string | null
  known: KnownLink[]
  error?: string
}) {
  const [rows, setRows] = useState<ChangeRow[]>(initial.length ? initial.map((r) => shorten(r, repoUrl)) : [emptyRow()])
  const [pasteTasks, setPasteTasks] = useState('')
  const [pasteRefs, setPasteRefs] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)

  const listRef = useRef<HTMLOListElement>(null)
  const pendingFocus = useRef<GridMove | null>(null)

  // Depois de criar uma linha com ↓, o foco vai para ela assim que ela existe no DOM.
  useEffect(() => {
    if (!pendingFocus.current) return
    focusCell(listRef.current, pendingFocus.current)
    pendingFocus.current = null
  }, [rows.length])

  /**
   * Setas movem o foco entre os campos; ↓ na última linha cria outra.
   * @param e Evento de teclado do campo.
   * @param row Linha do campo.
   * @param col Coluna do campo.
   */
  const onGridKeyDown = (e: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (!ARROWS.has(e.key) || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return
    const el = e.currentTarget
    const caret = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0, length: el.value.length }
    const move = nextCell(e.key as GridKey, { row, col }, { rows: rows.length, cols: COLS }, caret)
    if (!move) return
    e.preventDefault()
    if (move.row < rows.length) return focusCell(listRef.current, move)
    pendingFocus.current = move
    setRows((rs) => [...rs, emptyRow()])
  }

  const update = (i: number, patch: Partial<ChangeRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  // Ao sair do campo do PR, completa task e descrição se o PR já foi vinculado antes.
  const fillFromKnown = (i: number) => {
    const row = rows[i]
    if (!row.ref.trim() || row.tasks.trim() || row.description.trim()) return
    const match = findKnown(row.ref, known)
    if (match) update(i, { tasks: match.tasks.join(' '), description: match.description ?? '' })
  }

  const buildFromPaste = () => {
    const built = rowsFromColumns(pasteTasks, pasteRefs).map((r) => shorten(r, repoUrl))
    if (!built.length) return
    setRows((rs) => [...rs.filter((r) => r.ref.trim() || r.tasks.trim() || r.description.trim()), ...built])
    setPasteTasks('')
    setPasteRefs('')
    setPasteOpen(false)
  }

  return (
    <div className="group/changes">
      <input type="hidden" name="changes" value={JSON.stringify(rows)} />
      <div className="hidden gap-3 px-1 pb-1.5 text-sm font-medium text-ink-2 md:grid md:grid-cols-[1.3fr_1fr_1.3fr_2.25rem]">
        <span>PR ou commit</span>
        <span>Task</span>
        <span>Descrição</span>
        <span />
      </div>
      <ol ref={listRef} className="space-y-3 md:space-y-2">
        {rows.map((row, i) => {
          const noTask = row.ref.trim() !== '' && row.tasks.trim() === ''
          return (
            <li key={i} className="grid gap-2 rounded-xl bg-sunken p-3 md:grid-cols-[1.3fr_1fr_1.3fr_2.25rem] md:items-start md:gap-3 md:border-0 md:bg-transparent md:p-0">
              <label className="sr-only" htmlFor={`ref-${i}`}>PR ou commit da linha {i + 1}</label>
              <input
                id={`ref-${i}`}
                data-row={i}
                data-col={0}
                className="field code"
                value={row.ref}
                placeholder={repoUrl ? '988 ou link do PR' : 'Link do PR ou hash do commit'}
                spellCheck={false}
                onChange={(e) => update(i, { ref: e.target.value })}
                onBlur={() => fillFromKnown(i)}
                onKeyDown={(e) => onGridKeyDown(e, i, 0)}
              />
              <label className="sr-only" htmlFor={`tasks-${i}`}>Task da linha {i + 1}</label>
              <input
                id={`tasks-${i}`}
                data-row={i}
                data-col={1}
                className="field code"
                value={row.tasks}
                placeholder={noTask ? 'Sem task' : jiraPrefix ? `1184 ou ${jiraPrefix}-1184` : 'ABC-123'}
                spellCheck={false}
                onChange={(e) => update(i, { tasks: e.target.value })}
                onKeyDown={(e) => onGridKeyDown(e, i, 1)}
              />
              <label className="sr-only" htmlFor={`desc-${i}`}>Descrição da linha {i + 1}</label>
              <input
                id={`desc-${i}`}
                data-row={i}
                data-col={2}
                className={`field ${noTask && !row.description.trim() ? 'border-warn' : ''}`}
                value={row.description}
                placeholder={noTask ? 'Obrigatória: o que mudou' : 'Opcional'}
                onChange={(e) => update(i, { description: e.target.value })}
                onKeyDown={(e) => onGridKeyDown(e, i, 2)}
              />
              <button
                type="button"
                className="btn justify-self-end px-2 text-ink-2 hover:bg-sunken hover:text-danger md:justify-self-auto"
                aria-label={`Remover linha ${i + 1}`}
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [emptyRow()]))}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ol>

      <p
        aria-hidden
        className="mt-2 hidden h-6 items-center gap-1.5 text-sm text-muted opacity-0 transition-opacity motion-reduce:transition-none group-has-[ol:focus-within]/changes:opacity-100 md:flex"
      >
        <Key>←</Key><Key>↑</Key><Key>↓</Key><Key>→</Key>
        <span>movem entre os campos; <Key>↓</Key> na última linha cria uma nova.</span>
      </p>

      {error && (
        <ul className="mt-3 space-y-1 text-sm text-danger" role="alert">
          {error.split('\n').map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-quiet py-1.5 text-sm" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          Adicionar linha
        </button>
        <button type="button" className="link text-sm" aria-expanded={pasteOpen} onClick={() => setPasteOpen((o) => !o)}>
          Colar as colunas da planilha
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        Cada PR ou commit precisa de uma task. Sem task, escreva na descrição o que mudou. Task sem PR pode ficar com o primeiro campo vazio.
      </p>

      {pasteOpen && (
        <div className="mt-4 rounded-2xl border border-line bg-sunken/50 p-4">
          <p className="mb-3 text-sm text-ink-2">
            Cole a coluna de tasks e a de PRs como estão na planilha. A linha 1 de uma vira par da linha 1 da outra.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="paste-tasks">Coluna de tasks</label>
              <textarea id="paste-tasks" className="field code min-h-28" value={pasteTasks} onChange={(e) => setPasteTasks(e.target.value)} spellCheck={false} />
            </div>
            <div>
              <label className="label" htmlFor="paste-refs">Coluna de PRs</label>
              <textarea id="paste-refs" className="field code min-h-28" value={pasteRefs} onChange={(e) => setPasteRefs(e.target.value)} spellCheck={false} />
            </div>
          </div>
          <button type="button" className="btn-quiet mt-3 py-1.5 text-sm" onClick={buildFromPaste}>Montar linhas</button>
        </div>
      )}
    </div>
  )
}

const COLS = 3

/**
 * Tecla desenhada como botão, para dicas de atalho.
 * @param props.children Símbolo da tecla.
 * @returns Elemento kbd estilizado.
 */
function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="code inline-flex min-w-6 justify-center rounded-md border border-line-strong bg-lift px-1 text-xs text-ink-2">{children}</kbd>
}
const ARROWS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

/**
 * Foca o campo da célula e posiciona o cursor.
 * @param list Lista de linhas do editor.
 * @param move Célula de destino e posição do cursor.
 */
function focusCell(list: HTMLElement | null, { row, col, caret }: GridMove) {
  const el = list?.querySelector<HTMLInputElement>(`[data-row="${row}"][data-col="${col}"]`)
  if (!el) return
  el.focus()
  const at = caret === 'start' ? 0 : el.value.length
  el.setSelectionRange(at, at)
}

// Link de PR do próprio repositório do projeto aparece só como número, mais fácil de ler.
function shorten(row: ChangeRow, repoUrl: string | null): ChangeRow {
  if (!repoUrl) return row
  const m = row.ref.match(/^https?:\/\/(.+)\/pull-requests\/(\d+)\/?$/i)
  return m && `https://${m[1]}` === repoUrl.replace(/^http:\/\//i, 'https://').replace(/\/+$/, '') ? { ...row, ref: m[2] } : row
}

function findKnown(ref: string, known: KnownLink[]): KnownLink | undefined {
  const v = ref.trim().replace(/^cherry[\s-]?pick\s*/i, '').replace(/^commit:?\s*/i, '').replace(/^#/, '')
  if (/^\d{1,6}$/.test(v)) return known.find((k) => k.number === Number(v))
  if (/^[0-9a-f]{7,40}$/i.test(v)) return known.find((k) => k.ref === v.toLowerCase())
  const url = v.replace(/^http:\/\//i, 'https://').replace(/\/(overview|diff|commits)\/?$/i, '').replace(/\/+$/, '')
  return known.find((k) => k.ref === url)
}
