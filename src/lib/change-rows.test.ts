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
      { url: `${repo}/pull-requests/988`, number: 988, tasks: [], no_task: true, description: 'Dashboard', has_metadata_import: false, metadata_import_path: null },
      { url: `${repo}/pull-requests/986`, number: 986, tasks: ['WW-183'], no_task: false, description: null, has_metadata_import: false, metadata_import_path: null },
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

describe('parseChangeRows com metadados', () => {
  it('marca só os PRs com metadados, cada um com o seu caminho', () => {
    const r = parseChangeRows(
      [
        { ref: '988', tasks: 'WW-1', description: '', has_metadata: true, metadata_path: '  run_once/a  ' },
        { ref: '989', tasks: 'WW-2', description: '' },
        { ref: '990', tasks: 'WW-3', description: '', has_metadata: true, metadata_path: 'run_once/b' },
      ],
      repo,
    )
    expect(r.errors).toEqual([])
    expect(r.pullRequests.map((p) => [p.number, p.has_metadata_import, p.metadata_import_path])).toEqual([
      [988, true, 'run_once/a'],
      [989, false, null],
      [990, true, 'run_once/b'],
    ])
  })

  it('exige o caminho quando o PR está marcado', () => {
    const r = parseChangeRows([{ ref: '988', tasks: 'WW-1', description: '', has_metadata: true, metadata_path: '   ' }], repo)
    expect(r.errors).toEqual(['Linha 1: informe o caminho do import dos metadados.'])
  })

  it('recusa metadados em commit e em linha sem PR', () => {
    const r = parseChangeRows(
      [
        { ref: 'c778034', tasks: 'WW-1', description: '', has_metadata: true, metadata_path: 'x' },
        { ref: '', tasks: 'WW-2', description: '', has_metadata: true, metadata_path: 'x' },
      ],
      repo,
    )
    expect(r.errors).toEqual(['Linha 1: só PR leva metadados. Desmarque a opção nesta linha.', 'Linha 2: metadados são do PR. Informe o PR ou desmarque a opção.'])
  })

  it('ignora o caminho de um PR desmarcado', () => {
    const r = parseChangeRows([{ ref: '988', tasks: 'WW-1', description: '', has_metadata: false, metadata_path: 'sobrou' }], repo)
    expect(r.pullRequests[0]).toMatchObject({ has_metadata_import: false, metadata_import_path: null })
  })

  it('mantém a marcação quando o mesmo PR aparece em duas linhas', () => {
    const r = parseChangeRows(
      [
        { ref: '988', tasks: 'WW-1', description: '' },
        { ref: '988', tasks: 'WW-2', description: '', has_metadata: true, metadata_path: 'run_once/a' },
      ],
      repo,
    )
    expect(r.errors).toEqual([])
    expect(r.pullRequests).toHaveLength(1)
    expect(r.pullRequests[0]).toMatchObject({ tasks: ['WW-1', 'WW-2'], has_metadata_import: true, metadata_import_path: 'run_once/a' })
  })
})
