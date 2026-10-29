'use client'

import { useFormStatus } from 'react-dom'
import { Flash } from '@/components/flash'
import { Icon } from '@/components/icons'
import { ENVIRONMENT_LABEL, TYPE_LABEL, type DeployType, type Environment } from '@/lib/types'

/**
 * Botão de envio que desabilita e troca o texto enquanto a Server Action roda.
 * @param props.children Texto normal do botão.
 * @param props.pending Texto exibido durante o envio.
 * @param props.busy Estado de envio vindo de fora (useFormAction); sem ele usa o useFormStatus.
 * @param props.className Classe do botão (btn-primary por padrão).
 * @returns Botão de submit.
 */
export function SubmitButton({
  children,
  pending,
  busy,
  className = 'btn-primary',
}: {
  children: React.ReactNode
  pending?: string
  busy?: boolean
  className?: string
}) {
  const status = useFormStatus()
  const isBusy = busy ?? status.pending
  return (
    <button type="submit" className={className} disabled={isBusy} aria-busy={isBusy}>
      {isBusy ? (pending ?? 'Salvando…') : children}
    </button>
  )
}

/**
 * Mensagem de erro de um campo.
 * @param props.message Texto do erro; nada é renderizado quando vazio.
 * @returns Parágrafo com o erro.
 */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-sm text-danger">{message}</p>
}

/**
 * Faixa de aviso para erro geral ou confirmação de um formulário.
 * @param props.error Mensagem de erro.
 * @param props.message Mensagem de sucesso.
 * @param props.autoHide Faz a mensagem de sucesso sumir sozinha (erro nunca some).
 * @param props.resetKey Valor que, ao mudar, mostra a confirmação de novo; passe o estado do formulário.
 * @returns Bloco com role adequado para leitores de tela.
 */
export function FormNotice({
  error,
  message,
  autoHide,
  resetKey,
}: {
  error?: string
  message?: string
  autoHide?: boolean
  resetKey?: unknown
}) {
  if (error)
    return (
      <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
        {error}
      </p>
    )
  if (message) {
    const tone = 'rounded-xl border border-production/30 bg-production-soft px-3 py-2 text-sm text-ink'
    if (autoHide) return <Flash className={tone} resetKey={resetKey}>{message}</Flash>
    return (
      <p role="status" className={tone}>
        {message}
      </p>
    )
  }
  return null
}

export { EnvBadge, TypeBadge }

const ENV_TONE: Record<Environment, string> = {
  staging: 'bg-staging-soft text-staging',
  production: 'bg-production-soft text-production',
}
const TYPE_TONE: Record<DeployType, { chip: string; icon: string }> = {
  release: { chip: 'bg-release-soft', icon: 'text-release' },
  bugfix: { chip: 'bg-bugfix-soft', icon: 'text-bugfix' },
  hotfix: { chip: 'bg-hotfix-soft', icon: 'text-hotfix' },
}

function EnvBadge({ env }: { env: Environment }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ENV_TONE[env]}`}>
      <Icon name={env} size={14} />
      {ENVIRONMENT_LABEL[env]}
    </span>
  )
}

/**
 * Ícone do ambiente: frasco para Staging, foguete para Produção; herda a cor do texto.
 * @param props.env Ambiente.
 * @param props.size Lado em pixels.
 * @returns SVG decorativo.
 */
export function EnvMark({ env, size = 16 }: { env: Environment; size?: number }) {
  return <Icon name={env} size={size} />
}

/**
 * Ícone do tipo de deploy, na cor do tipo: pacote verde, inseto amarelo, chama vermelha.
 * @param props.type Tipo do deploy.
 * @param props.size Lado em pixels.
 * @returns SVG decorativo.
 */
export function TypeMark({ type, size = 16 }: { type: DeployType; size?: number }) {
  return <Icon name={type} size={size} className={TYPE_TONE[type].icon} />
}

function TypeBadge({ type }: { type: DeployType }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-ink ${TYPE_TONE[type].chip}`}>
      <TypeMark type={type} size={14} />
      {TYPE_LABEL[type]}
    </span>
  )
}
