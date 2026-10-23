import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseSheet } from './sheet'
import { readWorkbook } from './workbook'

describe('readWorkbook', () => {
  it('lê abas do .xlsx com datas, links e células de várias linhas', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Projeto A')
    ws.addRow(['Code Version', 'Branch base', 'Ambiente', 'Data do Deploy', 'Sprint', 'Tipo', 'Criada a partir da', 'Tasks do Jira', 'Link PR'])
    ws.addRow([
      'release_1_0_0_10',
      'release/1.0.0',
      'Produção',
      new Date(Date.UTC(2026, 3, 1)),
      50,
      'Release',
      'main',
      { text: 'ABC-1', hyperlink: 'https://acme.atlassian.net/browse/ABC-1' },
      'https://bitbucket.org/acme/repo/pull-requests/7\nhttps://bitbucket.org/acme/repo/pull-requests/8',
    ])
    wb.addWorksheet('Oculta').state = 'hidden'
    const buffer = await wb.xlsx.writeBuffer()

    const sheets = await readWorkbook('controle.xlsx', buffer as ArrayBuffer)
    expect(sheets.map((s) => s.name)).toEqual(['Projeto A'])
    const parsed = parseSheet(sheets[0].name, sheets[0].rows)
    expect(parsed.deploys[0]).toMatchObject({
      deployed_on: '2026-04-01',
      environment: 'production',
      sprint: '50',
      tasks: ['ABC-1'],
    })
    expect(parsed.deploys[0].pull_requests.map((p) => p.number)).toEqual([7, 8])
  })

  it('lê .csv', async () => {
    const csv = 'Code Version,Ambiente,Data do Deploy\nrel_1,Staging,13/04/2026\n'
    const sheets = await readWorkbook('Projeto B.csv', new TextEncoder().encode(csv).buffer as ArrayBuffer)
    expect(parseSheet(sheets[0].name, sheets[0].rows).deploys[0].deployed_on).toBe('2026-04-13')
  })
})
