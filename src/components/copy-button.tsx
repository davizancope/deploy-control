'use client'

import { useEffect, useRef, useState } from 'react'

type CopyState = 'idle' | 'copied' | 'failed'

/**
 * Controla a cópia para a área de transferência e o estado de confirmação, que volta a "idle" sozinho.
 * @param resetAfterMs Tempo, em ms, até o estado voltar a "idle".
 * @returns Estado atual e a função copy(text, html?).
 */
function useCopy(resetAfterMs: number) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy(text: string, html?: string) {
    try {
      if (html && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(text)
      }
      setState('copied')
    } catch {
      setState('failed')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), resetAfterMs)
  }

  return { state, copy }
}

/**
 * Botão de texto que copia para a área de transferência e confirma no próprio rótulo por dois segundos.
 * @param props.text Texto puro a copiar.
 * @param props.html HTML opcional; com ele, apps como o Teams colam com negrito, lista e links.
 * @param props.children Rótulo do botão.
 * @param props.className Classe do botão (btn-quiet por padrão).
 * @param props.disabled Desabilita o botão.
 * @returns Botão com uma região de status para leitores de tela.
 */
export function CopyButton({
  text,
  html,
  children,
  className = 'btn-quiet',
  disabled,
}: {
  text: string
  html?: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  const { state, copy } = useCopy(2000)
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => copy(text, html)}>
        {state === 'copied' ? 'Copiado ✓' : state === 'failed' ? 'Não foi possível copiar' : children}
      </button>
      <span role="status" className="sr-only">
        {state === 'copied' ? 'Copiado.' : state === 'failed' ? 'Não foi possível copiar.' : ''}
      </span>
    </>
  )
}

/**
 * Ícone de cópia: duas folhas com uma seta saindo da primeira para a segunda.
 * @returns SVG de 20px que herda a cor do texto.
 */
function CopyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 19H4a2 2 0 0 1-2-2V5l3-3h8a2 2 0 0 1 2 2v1" />
      <path d="M5.5 6H10M5.5 8.5H8.5" />
      <path d="M10 12.5V9l3-3h7.5a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 10 20.5v-2" />
      <path d="M13.5 10h5.5M13.5 12.5h5.5M16.5 19.5H19" />
      <path d="M5.5 11.5c-.4 3 .3 4 3 4H12.5" />
      <path d="M12.2 14 15.2 15.5 12.2 17Z" fill="currentColor" />
    </svg>
  )
}

/**
 * Botão só com o ícone de cópia; ao clicar, copia o texto e mostra um aviso na parte de baixo da tela.
 * @param props.text Texto a copiar.
 * @param props.label Nome do botão, usado como dica e para leitores de tela.
 * @param props.message Aviso exibido depois de copiar.
 * @returns Botão de ícone e a região de aviso (role status).
 */
export function CopyIconButton({ text, label, message }: { text: string; label: string; message: string }) {
  const { state, copy } = useCopy(2500)
  return (
    <>
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={() => copy(text)}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-lift text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
      >
        <CopyIcon />
      </button>
      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {state !== 'idle' && (
          <p className={`rounded-xl px-4 py-2 text-sm shadow-lg ${state === 'copied' ? 'bg-ink text-paper' : 'bg-danger text-paper'}`}>
            {state === 'copied' ? message : 'Não foi possível copiar.'}
          </p>
        )}
      </div>
    </>
  )
}
