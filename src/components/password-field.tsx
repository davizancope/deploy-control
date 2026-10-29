'use client'

import { useState, type ComponentProps } from 'react'
import { Icon } from '@/components/icons'
import type { RuleStatus } from '@/lib/password-rules'

/**
 * Campo de senha com botão para mostrar ou ocultar o que foi digitado.
 * @param props Props de um input, exceto type; id e name devem ser informados pelo formulário.
 * @returns Input mascarado por padrão, com o botão de olho dentro do campo.
 */
export function PasswordField({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`field pr-11! ${className ?? ''}`}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // Mantém o foco e o cursor no campo ao clicar no olho.
        onMouseDown={(e) => e.preventDefault()}
        aria-label="Mostrar senha"
        aria-pressed={visible}
        aria-controls={props.id}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-1.5 my-auto grid size-8 place-items-center rounded-full text-muted transition-colors hover:text-ink"
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
      </button>
    </div>
  )
}

/**
 * Lista de critérios que muda de estado conforme a pessoa digita.
 * @param props.id Id da lista, para o aria-describedby do campo.
 * @param props.items Critérios com o estado atendido ou pendente; sem itens, nada é renderizado.
 * @returns Lista com ícone e texto para cada critério, lida por leitores de tela como atendido ou pendente.
 */
export function RuleChecklist({ id, items }: { id: string; items: RuleStatus[] }) {
  if (items.length === 0) return null
  return (
    <ul id={id} className="mt-2 space-y-1">
      {items.map((item) => (
        <li key={item.id} className={`flex items-center gap-2 text-sm transition-colors ${item.met ? 'text-production' : 'text-muted'}`}>
          <span
            aria-hidden="true"
            className={`grid size-4 shrink-0 place-items-center rounded-full border ${item.met ? 'border-production bg-production-soft' : 'border-line-strong'}`}
          >
            {item.met && <Icon name="check" size={11} />}
          </span>
          <span className="sr-only">{item.met ? 'Atendido: ' : 'Pendente: '}</span>
          {item.label}
        </li>
      ))}
    </ul>
  )
}
