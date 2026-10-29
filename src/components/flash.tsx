'use client'

import { useEffect, useState } from 'react'

const VISIBLE_MS = 5000

/**
 * Confirmação passageira: aparece, some sozinha depois de alguns segundos e tira da URL o parâmetro que a trouxe, para não voltar no refresh.
 * @param props.children Conteúdo da mensagem.
 * @param props.className Classes da faixa (inclua o espaçamento, que recolhe junto).
 * @param props.clearParam Parâmetro, ou parâmetros, a remover da URL.
 * @param props.resetKey Valor que, ao mudar, mostra a mensagem de novo e reinicia a contagem.
 * @returns Região live que recolhe ao desaparecer.
 */
export function Flash({
  children,
  className,
  clearParam,
  resetKey,
}: {
  children: React.ReactNode
  className: string
  clearParam?: string | string[]
  resetKey?: unknown
}) {
  const [hidden, setHidden] = useState(false)
  const [lastKey, setLastKey] = useState(resetKey)
  const params = typeof clearParam === 'string' ? clearParam : (clearParam ?? []).join(',')

  // Mensagem nova: mostra de novo antes de pintar a tela.
  if (lastKey !== resetKey) {
    setLastKey(resetKey)
    setHidden(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => setHidden(true), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [resetKey])

  useEffect(() => {
    const names = params ? params.split(',') : []
    const url = new URL(window.location.href)
    if (!names.some((name) => url.searchParams.has(name))) return
    for (const name of names) url.searchParams.delete(name)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [params])

  return (
    <div
      className={`grid transition-all duration-300 motion-reduce:transition-none ${hidden ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
    >
      <div className="min-h-0 overflow-hidden">
        <p role="status" className={className}>{children}</p>
      </div>
    </div>
  )
}
