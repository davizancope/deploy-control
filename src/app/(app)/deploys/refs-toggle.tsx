'use client'

import { useState } from 'react'
import { DEPLOY_REFS_COOKIE, DEPLOY_REFS_HIDDEN } from '@/lib/prefs'

/**
 * Interruptor que mostra ou esconde os detalhes dos cards (tasks, PRs e a descrição de cada PR); a escolha fica num cookie para o servidor já renderizar certo.
 * @param props.initialShown Preferência lida do cookie no servidor.
 * @param props.children Lista de deploys renderizada no servidor; os blocos de detalhes reagem ao data-refs do contêiner.
 * @returns Interruptor seguido da lista, dentro de um contêiner com data-refs.
 */
export function DeployRefsToggle({ initialShown, children }: { initialShown: boolean; children: React.ReactNode }) {
  const [shown, setShown] = useState(initialShown)

  /**
   * Aplica a escolha na tela e grava o cookie por um ano.
   * @param next Novo estado: true mostra os detalhes.
   */
  function change(next: boolean) {
    setShown(next)
    document.cookie = `${DEPLOY_REFS_COOKIE}=${next ? '1' : DEPLOY_REFS_HIDDEN}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <div data-refs={shown ? 'show' : 'hide'} className="group/refs">
      <div className="mb-4 flex justify-end">
        <label>
          <input type="checkbox" checked={shown} onChange={(e) => change(e.target.checked)} className="peer sr-only" />
          <span className="block rounded-full border border-line-strong bg-sunken px-3.5 py-1.5 text-sm text-ink-2 peer-checked:lift peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)]">
            Mostrar detalhes
          </span>
        </label>
      </div>
      {children}
    </div>
  )
}
