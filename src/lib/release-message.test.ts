import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MESSAGE_TEMPLATE,
  SAMPLE_DEPLOY,
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
    const v = messageVars({ ...SAMPLE_DEPLOY, sprint: null, branch: null, project: { name: 'P', jira_base_url: null } })
    expect(v.tarefas).toBe('- ABC-101\n- ABC-102')
    expect(v.sprint).toBe('—')
    expect(v.branch).toBe('—')
    expect(messageVars({ ...SAMPLE_DEPLOY, tasks: [] }).tarefas).toBe('- Nenhuma task vinculada')
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
