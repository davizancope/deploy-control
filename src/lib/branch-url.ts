/**
 * Monta a URL da página de branches mantendo projeto, período e filtro; clicar na branch já selecionada limpa a seleção.
 * @param o.projectId Projeto exibido.
 * @param o.period Período em dias ou "all".
 * @param o.pending Se o filtro "só o que falta subir" está ligado.
 * @param o.branch Branch alvo do link; sem ela, o link só limpa a seleção.
 * @param o.selected Branch hoje selecionada (igual a `branch` alterna para "sem seleção").
 * @returns Caminho com query string.
 */
export function branchesHref(o: { projectId: string; period: string; pending: boolean; branch?: string; selected?: string }): string {
  const q = new URLSearchParams({ projeto: o.projectId, periodo: o.period })
  if (o.branch && o.branch !== o.selected) q.set('branch', o.branch)
  if (o.pending) q.set('pendentes', '1')
  return `/branches?${q}`
}
