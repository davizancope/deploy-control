import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MESSAGE_TEMPLATE,
  SAMPLE_DEPLOY,
  commitUrl,
  findUnknownPlaceholders,
  markdownToHtml,
  messageVars,
  renderTemplate,
  taskUrls,
} from './release-message'

describe('taskUrls', () => {
  it('monta a URL do Jira ou cai para a chave sem Jira', () => {
    expect(taskUrls(['ABC-1', 'ABC-2'], 'https://x.atlassian.net')).toEqual(['https://x.atlassian.net/browse/ABC-1', 'https://x.atlassian.net/browse/ABC-2'])
    expect(taskUrls(['ABC-1'], null)).toEqual(['ABC-1'])
    expect(taskUrls([], 'https://x.atlassian.net')).toEqual([])
  })
})

describe('messageVars', () => {
  it('preenche os campos do deploy', () => {
    const v = messageVars(SAMPLE_DEPLOY)
    expect(v).toMatchObject({ release: 'release_2026-10-21', ambiente: 'Produção', projeto: 'Projeto Exemplo', tipo: 'Release', data: '21 out 2026', sprint: 'Sprint 42' })
    expect(v.tarefas).toBe('- [ABC-101](https://empresa.atlassian.net/browse/ABC-101)\n- [ABC-102](https://empresa.atlassian.net/browse/ABC-102)')
    expect(v.tarefas_urls).toBe('- https://empresa.atlassian.net/browse/ABC-101\n- https://empresa.atlassian.net/browse/ABC-102')
  })

  it('lida com projeto sem Jira, sem tasks e sem sprint/branch', () => {
    const v = messageVars({ ...SAMPLE_DEPLOY, sprint: null, branch: null, project: { name: 'P', jira_base_url: null, repo_url: null } })
    expect(v.tarefas).toBe('- ABC-101\n- ABC-102')
    expect(v.sprint).toBe('—')
    expect(v.branch).toBe('—')
    expect(messageVars({ ...SAMPLE_DEPLOY, tasks: [] }).tarefas).toBe('- Nenhuma task vinculada')
  })
})

describe('commitUrl', () => {
  it('monta o endereço conforme o provedor e devolve null sem repositório', () => {
    expect(commitUrl('https://bitbucket.org/emp/repo/', 'abc1234')).toBe('https://bitbucket.org/emp/repo/commits/abc1234')
    expect(commitUrl('https://github.com/emp/repo.git', 'abc1234')).toBe('https://github.com/emp/repo/commit/abc1234')
    expect(commitUrl('https://gitlab.com/emp/repo', 'abc1234')).toBe('https://gitlab.com/emp/repo/-/commit/abc1234')
    expect(commitUrl(null, 'abc1234')).toBeNull()
  })
})

describe('messageVars com PRs e commits sem task', () => {
  const base = { ...SAMPLE_DEPLOY, project: { name: 'P', jira_base_url: 'https://x.atlassian.net', repo_url: 'https://bitbucket.org/emp/repo' } }
  const repo = 'https://bitbucket.org/emp/repo'
  const noTaskPr = (number: number, description: string | null) => ({ url: `${repo}/pull-requests/${number}`, number, description, tasks: [], no_task: true })

  it('lista as tasks e depois os PRs sem task, com a descrição e o link', () => {
    const v = messageVars({
      ...base,
      tasks: ['WW-183', 'WW-185'],
      pull_requests: [{ url: `${repo}/pull-requests/986`, number: 986, description: null, tasks: ['WW-183'], no_task: false }, noTaskPr(988, 'Reports & Dashboard fix'), noTaskPr(990, 'OMS Sync')],
    })
    expect(v.tarefas).toBe(
      `- [WW-183](https://x.atlassian.net/browse/WW-183)\n- [WW-185](https://x.atlassian.net/browse/WW-185)\n- Reports & Dashboard fix ([PR #988](${repo}/pull-requests/988))\n- OMS Sync ([PR #990](${repo}/pull-requests/990))`,
    )
    expect(v.tarefas_urls).toBe(`- https://x.atlassian.net/browse/WW-183\n- https://x.atlassian.net/browse/WW-185\n- ${repo}/pull-requests/988\n- ${repo}/pull-requests/990`)
  })

  it('sem tasks, só os PRs e commits sem task, cada um com a própria descrição', () => {
    const v = messageVars({ ...base, tasks: [], pull_requests: [noTaskPr(988, 'Reports')], commits: [{ sha: 'abc1234def5678', description: null, tasks: [], no_task: true }] })
    expect(v.tarefas).toBe(`- Reports ([PR #988](${repo}/pull-requests/988))\n- [commit abc1234](${repo}/commits/abc1234def5678)`)
  })

  it('PR a vincular (sem task e sem marca de sem task) não entra como item', () => {
    const pending = { url: `${repo}/pull-requests/5`, number: 5, description: null, tasks: [], no_task: false }
    expect(messageVars({ ...base, tasks: ['WW-1'], pull_requests: [pending] }).tarefas).toBe('- [WW-1](https://x.atlassian.net/browse/WW-1)')
  })
})

describe('messageVars sem task', () => {
  const noTask = {
    ...SAMPLE_DEPLOY,
    tasks: [],
    project: { name: 'P', jira_base_url: 'https://x.atlassian.net', repo_url: 'https://bitbucket.org/emp/repo' },
  }
  const pr = { url: 'https://bitbucket.org/emp/repo/pull-requests/12', number: 12, description: 'Ajuste de CSS', tasks: [], no_task: false }
  const commit = { sha: 'abc1234def5678', description: null, tasks: [], no_task: false }

  it('sem PR ou commit marcado como sem task, usa as observações e linka o PR ou commit', () => {
    const v = messageVars({ ...noTask, notes: 'Correção do banner', pull_requests: [pr], commits: [commit] })
    expect(v.tarefas).toBe('- Correção do banner ([PR #12](https://bitbucket.org/emp/repo/pull-requests/12), [commit abc1234](https://bitbucket.org/emp/repo/commits/abc1234def5678))')
    expect(v.tarefas_urls).toBe('- https://bitbucket.org/emp/repo/pull-requests/12\n- https://bitbucket.org/emp/repo/commits/abc1234def5678')
  })

  it('observações em várias linhas viram itens e os links vão no último', () => {
    const v = messageVars({ ...noTask, notes: '- Linha 1\n\nLinha 2', pull_requests: [pr] })
    expect(v.tarefas).toBe('- Linha 1\n- Linha 2 ([PR #12](https://bitbucket.org/emp/repo/pull-requests/12))')
  })

  it('sem observações usa a descrição do PR/commit; sem nada, avisa que não há task', () => {
    expect(messageVars({ ...noTask, notes: null, pull_requests: [pr] }).tarefas).toBe('- Ajuste de CSS ([PR #12](https://bitbucket.org/emp/repo/pull-requests/12))')
    expect(messageVars({ ...noTask, notes: '  ' }).tarefas).toBe('- Nenhuma task vinculada')
    expect(messageVars({ ...noTask, notes: '  ' }).tarefas_urls).toBe('- Nenhuma task vinculada')
  })

  it('commit sem repositório cadastrado aparece só pelo hash', () => {
    const v = messageVars({ ...noTask, project: { ...noTask.project, repo_url: null }, notes: 'Ajuste', commits: [commit] })
    expect(v.tarefas).toBe('- Ajuste (commit abc1234)')
    expect(v.tarefas_urls).toBe('- Nenhuma task vinculada')
  })

  it('com tasks, as observações não entram', () => {
    expect(messageVars({ ...SAMPLE_DEPLOY, notes: 'ignorada' }).tarefas).not.toContain('ignorada')
  })
})

describe('renderTemplate', () => {
  it('troca campos ignorando maiúsculas e espaços, e mantém os desconhecidos', () => {
    expect(renderTemplate('{{release}} / {{ Ambiente }} / {{nada}}', { release: 'r1', ambiente: 'Produção' })).toBe('r1 / Produção / {{nada}}')
  })

  it('não usa propriedades herdadas nem interpreta $ nos valores', () => {
    expect(renderTemplate('{{constructor}} {{release}}', { release: 'a$&b' })).toBe('{{constructor}} a$&b')
  })
})

describe('findUnknownPlaceholders', () => {
  it('lista só os campos que não existem, sem repetir', () => {
    expect(findUnknownPlaceholders('{{release}} {{tarefa}} {{TAREFA}} {{foo}}')).toEqual(['tarefa', 'foo'])
    expect(findUnknownPlaceholders(DEFAULT_MESSAGE_TEMPLATE)).toEqual([])
  })
})

describe('markdownToHtml', () => {
  it('converte a mensagem padrão em parágrafos, negrito e lista de links', () => {
    const html = markdownToHtml(renderTemplate(DEFAULT_MESSAGE_TEMPLATE, messageVars(SAMPLE_DEPLOY)))
    expect(html).toBe(
      '<p>Olá time,</p>' +
        '<p>A release <strong>release_2026-10-21</strong> foi publicada em <strong>Produção</strong>.</p>' +
        '<p>As seguintes tarefas foram incluídas no deploy:</p>' +
        '<ul><li><a href="https://empresa.atlassian.net/browse/ABC-101">ABC-101</a></li>' +
        '<li><a href="https://empresa.atlassian.net/browse/ABC-102">ABC-102</a></li></ul>',
    )
  })

  it('escapa HTML e só aceita links http(s)', () => {
    expect(markdownToHtml('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
    expect(markdownToHtml('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>')
    expect(markdownToHtml('[a"b](https://x.com/?a=1&b=2)')).toBe('<p><a href="https://x.com/?a=1&amp;b=2">a&quot;b</a></p>')
  })

  it('liga URLs soltas sem levar a pontuação final e junta linhas do mesmo parágrafo com quebra', () => {
    expect(markdownToHtml('veja https://x.com/a.\nlinha 2')).toBe('<p>veja <a href="https://x.com/a">https://x.com/a</a>.<br>linha 2</p>')
  })
})
