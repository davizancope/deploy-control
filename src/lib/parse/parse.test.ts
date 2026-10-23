import { describe, expect, it } from 'vitest'
import { extractTokens } from './tokens'
import { parseRawDate, resolveSheetDates } from './dates'
import { parseSheet } from './sheet'
import { pairColumns } from './changes'

describe('extractTokens', () => {
  it('separa tasks, PRs, commits e cherry-picks', () => {
    const t = extractTokens(
      [
        'https://acme.atlassian.net/browse/ABC-12',
        'http://bitbucket.org/acme/repo/pull-requests/45/overview',
        'cherry pick c778034',
        'commit: F8CA9E1',
        'f6f6dbf',
        'NO TASK [OMS]',
      ].join('\n'),
    )
    expect(t.tasks).toEqual(['ABC-12'])
    expect(t.pullRequests).toEqual([{ url: 'https://bitbucket.org/acme/repo/pull-requests/45', number: 45 }])
    expect(t.repoUrls).toEqual(['https://bitbucket.org/acme/repo'])
    expect(t.jiraBaseUrls).toEqual(['https://acme.atlassian.net'])
    expect(t.commits).toEqual([
      { sha: 'c778034', cherry_pick: true },
      { sha: 'f8ca9e1', cherry_pick: false },
      { sha: 'f6f6dbf', cherry_pick: false },
    ])
    expect(t.notes).toEqual(['Sem task [OMS]'])
  })

  it('lê branches e tira a task do nome da branch', () => {
    const t = extractTokens('feature/ABC-1004-dados-pdp\nrelease/3.1.1\nABC-998', { linesAreBranches: true })
    expect(t.branches).toEqual(['feature/ABC-1004-dados-pdp', 'release/3.1.1', 'ABC-998'])
    expect(t.tasks).toEqual(['ABC-1004', 'ABC-998'])
  })

  it('transforma número solto de PR em link quando o projeto tem repositório', () => {
    const t = extractTokens('1468\n#1470', { repoUrl: 'https://bitbucket.org/acme/repo/' })
    expect(t.pullRequests.map((p) => p.number)).toEqual([1468, 1470])
  })

  it('lê vários commits na mesma linha', () => {
    expect(extractTokens('commits: ef73848 & 4a69624').commits.map((c) => c.sha)).toEqual(['ef73848', '4a69624'])
    expect(extractTokens('commits: 25e8cbb, 71e55c5, ce06708').commits).toHaveLength(3)
  })

  it('não confunde palavra com hash de commit', () => {
    expect(extractTokens('decade').commits).toEqual([])
    expect(extractTokens('fix pre-release/2.1.0').notes).toEqual(['fix pre-release/2.1.0'])
  })
})

describe('extractTokens com prefixo do Jira', () => {
  it('transforma número solto em chave PREFIXO-NÚMERO', () => {
    const t = extractTokens('1184\nSUZSFCCSUS-1185', { jiraPrefix: 'SUZSFCCSUS' })
    expect(t.tasks).toEqual(['SUZSFCCSUS-1184', 'SUZSFCCSUS-1185'])
  })

  it('sem prefixo, número solto continua sendo observação', () => {
    expect(extractTokens('1184').notes).toEqual(['1184'])
  })
})

describe('resolveSheetDates', () => {
  const ref = new Date('2026-10-23T12:00:00Z')
  const resolve = (values: Array<string | Date>) => resolveSheetDates(values.map(parseRawDate), ref)
  const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

  it('aceita os formatos da planilha', () => {
    const r = resolve(['1/4/2026', '13/04', '9/6/26', utc(2026, 10, 21)])
    expect(r.dates.map((d) => d?.iso)).toEqual(['2026-04-01', '2026-04-13', '2026-06-09', '2026-10-21'])
    expect(r.inferredYearCount).toBe(1)
    expect(parseRawDate('junho')).toBeNull()
    expect(resolve(['31/02/2026']).dates[0]).toBeNull()
  })

  it('desfaz dia/mês trocados pelo Google Sheets em inglês', () => {
    // Digitado 1/4, 6/4, 8/4 (abril) numa planilha mm/dd: vira 4 jan, 4 jun, 4 ago; "13/04" ficou texto.
    const r = resolve([utc(2026, 1, 4), utc(2026, 6, 4), utc(2026, 8, 4), '13/04', utc(2026, 5, 10)])
    expect(r.dates.map((d) => d?.iso)).toEqual(['2026-04-01', '2026-04-06', '2026-04-08', '2026-04-13', '2026-10-05'])
    expect(r.usFormat).toBe(true)
    expect(r.swappedCount).toBe(4)
    expect(r.outOfOrder.size).toBe(0)
  })

  it('mantém datas tipadas corretas', () => {
    const r = resolve([utc(2026, 4, 1), utc(2026, 4, 15), '20/04', utc(2026, 5, 2)])
    expect(r.dates.map((d) => d?.iso)).toEqual(['2026-04-01', '2026-04-15', '2026-04-20', '2026-05-02'])
    expect(r.swappedCount).toBe(0)
  })

  it('aceita mm/dd em texto quando dd/mm é impossível', () => {
    expect(resolve(['4/13/2026']).dates[0]?.iso).toBe('2026-04-13')
  })

  it('passa para o ano seguinte quando a sequência vira o ano', () => {
    const r = resolveSheetDates(['20/12/2026', '05/01'].map(parseRawDate), new Date('2027-02-10T12:00:00Z'))
    expect(r.dates[1]?.iso).toBe('2027-01-05')
  })

  it('avisa linha fora de ordem', () => {
    const r = resolve(['10/09/2026', '15/09/2026', '02/03/2026', '20/09/2026'])
    expect([...r.outOfOrder]).toEqual([2])
  })
})

describe('parseSheet', () => {
  const header = ['Code Version', 'Branch base', 'Ambiente', 'Data do Deploy', 'Sprint', 'Tipo', 'Criada a partir da', 'Tasks do Jira', 'Link PR']

  it('normaliza linhas, ignora as incompletas e avisa duplicadas', () => {
    const result = parseSheet(
      'Projeto X',
      [
        header,
        ['', '', '', '', '', '', '', 'https://acme.atlassian.net/browse/ABC-1', ''],
        ['rel_1 ', 'release/1', 'Staging', '13/10/2026', 3, 'Release', 'main', 'https://acme.atlassian.net/browse/ABC-1', 'https://bitbucket.org/acme/repo/pull-requests/1'],
        ['rel_1', 'release/1', 'Staging', '14/10', 3, '', 'main', 'NO TASK', 'commit 9badfe6'],
        ['rel_2', 'release/2', '???', '15/10', 3, 'Release', 'main', '', ''],
        ['release_5_3_0', 'release/5.3.0', 'Produção', '16/10', 3, 'Hotfix', 'main', '', ''],
      ],
      new Date('2026-10-23T12:00:00Z'),
    )
    expect(result.error).toBeNull()
    expect(result.deploys).toHaveLength(3)
    expect(result.skipped.map((s) => s.sourceRow)).toEqual([2, 5])
    expect(result.deploys[0]).toMatchObject({ code_version: 'rel_1', environment: 'staging', deployed_on: '2026-10-13', sprint: '3', tasks: ['ABC-1'] })
    expect(result.deploys[1].warnings.join(' ')).toMatch(/repetida/)
    expect(result.deploys[1].warnings.join(' ')).toMatch(/Sem tipo/)
    expect(result.deploys[1].commits).toEqual([{ sha: '9badfe6', cherry_pick: false, tasks: [], no_task: true, description: null }])
    expect(result.deploys[2]).toMatchObject({ environment: 'production', type: 'hotfix' })
    expect(result.deploys[2].warnings.join(' ')).toMatch(/Hotfix numa branch de release/)
    expect(result.jiraBaseUrl).toBe('https://acme.atlassian.net')
    expect(result.repoUrl).toBe('https://bitbucket.org/acme/repo')
    expect(result.inferredYearCount).toBe(2)
  })

  it('reporta aba sem cabeçalho', () => {
    expect(parseSheet('Notas', [['qualquer coisa']]).error).toMatch(/Code Version/)
  })
})

describe('pairColumns', () => {
  const pr = (n: number) => `https://bitbucket.org/acme/repo/pull-requests/${n}`
  const jira = (k: string) => `https://acme.atlassian.net/browse/${k}`

  it('pareia linha a linha, com NO TASK virando descrição', () => {
    const r = pairColumns(
      ['NO TASK [DASHBOARD]', 'NO TASK [OMS]', jira('WW-183'), jira('WW-185')].join('\n'),
      [pr(988), pr(990), pr(986), pr(987)].join('\n'),
    )
    expect(r.pullRequests.map((p) => [p.number, p.tasks, p.no_task, p.description])).toEqual([
      [988, [], true, 'DASHBOARD'],
      [990, [], true, 'OMS'],
      [986, ['WW-183'], false, null],
      [987, ['WW-185'], false, null],
    ])
    expect(r.tasks).toEqual(['WW-183', 'WW-185'])
  })

  it('liga commit e descrição livre', () => {
    const r = pairColumns('hotfix release/2.0.0', 'commit f97f930')
    expect(r.commits).toEqual([{ sha: 'f97f930', cherry_pick: false, tasks: [], no_task: true, description: 'hotfix release/2.0.0' }])
  })

  it('um PR para várias tasks e uma task para vários PRs', () => {
    expect(pairColumns('AB-1\nAB-2\nAB-3', pr(10)).pullRequests[0].tasks).toEqual(['AB-1', 'AB-2', 'AB-3'])
    expect(pairColumns('AB-1', `${pr(10)}\n${pr(11)}`).pullRequests.map((p) => p.tasks)).toEqual([['AB-1'], ['AB-1']])
  })

  it('deixa a vincular quando não dá para parear', () => {
    const r = pairColumns('AB-1\nAB-2\nAB-3', `${pr(10)}\n${pr(11)}`)
    expect(r.pullRequests.every((p) => p.tasks.length === 0 && !p.no_task)).toBe(true)
    expect(r.tasks).toEqual(['AB-1', 'AB-2', 'AB-3'])
  })
})
