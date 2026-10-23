import { describe, expect, it } from 'vitest'
import { parseChangeRows, rowsFromColumns } from './change-rows'

const repo = 'https://bitbucket.org/acme/repo'

describe('parseChangeRows', () => {
  it('liga PR à task, aceita sem task com descrição e task sem PR', () => {
    const r = parseChangeRows(
      [
        { ref: '988', tasks: '', description: 'Dashboard' },
        { ref: `${repo}/pull-requests/986`, tasks: 'https://acme.atlassian.net/browse/WW-183', description: '' },
        { ref: 'cherry pick c778034', tasks: 'WW-183, WW-185', description: '' },
        { ref: '', tasks: 'WW-200', description: '' },
        { ref: '', tasks: '', description: '' },
      ],
      repo,
    )
    expect(r.errors).toEqual([])
    expect(r.pullRequests).toEqual([
      { url: `${repo}/pull-requests/988`, number: 988, tasks: [], no_task: true, description: 'Dashboard' },
      { url: `${repo}/pull-requests/986`, number: 986, tasks: ['WW-183'], no_task: false, description: null },
    ])
    expect(r.commits[0]).toMatchObject({ sha: 'c778034', cherry_pick: true, tasks: ['WW-183', 'WW-185'] })
    expect(r.tasks).toEqual(['WW-183', 'WW-185', 'WW-200'])
  })

  it('completa a task só pelo número com o prefixo do projeto', () => {
    const r = parseChangeRows([{ ref: '988', tasks: '1184, SUZSFCCSUS-1185 0042', description: '' }], repo, 'SUZSFCCSUS')
    expect(r.errors).toEqual([])
    expect(r.tasks).toEqual(['SUZSFCCSUS-1184', 'SUZSFCCSUS-1185', 'SUZSFCCSUS-42'])
  })

  it('recusa número de task quando o projeto não tem prefixo', () => {
    const r = parseChangeRows([{ ref: '988', tasks: '1184', description: '' }], repo)
    expect(r.errors[0]).toMatch(/Linha 1: task "1184" não reconhecida/)
  })

  it('exige task ou descrição para o PR', () => {
    const r = parseChangeRows([{ ref: '988', tasks: '', description: '' }], repo)
    expect(r.errors[0]).toMatch(/Linha 1: escolha a task/)
  })

  it('recusa número de PR sem repositório e task inválida', () => {
    expect(parseChangeRows([{ ref: '988', tasks: 'AB-1', description: '' }], null).errors[0]).toMatch(/cadastre o repositório/)
    expect(parseChangeRows([{ ref: '', tasks: 'qualquer', description: '' }], repo).errors[0]).toMatch(/não reconhecida/)
  })
})

describe('rowsFromColumns', () => {
  it('monta linhas pelas colunas da planilha', () => {
    const rows = rowsFromColumns('NO TASK [OMS]\nWW-183\nWW-190', `${repo}/pull-requests/990\n${repo}/pull-requests/986\n${repo}/pull-requests/991`)
    expect(rows).toEqual([
      { ref: `${repo}/pull-requests/990`, tasks: '', description: 'OMS' },
      { ref: `${repo}/pull-requests/986`, tasks: 'WW-183', description: '' },
      { ref: `${repo}/pull-requests/991`, tasks: 'WW-190', description: '' },
    ])
  })
})
