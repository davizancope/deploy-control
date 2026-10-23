import 'server-only'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import type { CellValue } from './dates'
import type { SheetRow } from './sheet'

export type RawSheet = { name: string; rows: SheetRow[] }

const MAX_ROWS_PER_SHEET = 5000

/**
 * Lê um .xlsx ou .csv enviado pelo usuário e devolve as abas com as linhas cruas.
 * @param fileName Nome do arquivo, usado para decidir o formato.
 * @param data Conteúdo do arquivo.
 * @returns Uma entrada por aba (o CSV vira uma aba só, com o nome do arquivo).
 */
export async function readWorkbook(fileName: string, data: ArrayBuffer): Promise<RawSheet[]> {
  if (/\.csv$/i.test(fileName)) {
    const text = new TextDecoder('utf-8').decode(data)
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false })
    return [{ name: fileName.replace(/\.csv$/i, ''), rows: parsed.data.slice(0, MAX_ROWS_PER_SHEET + 20) }]
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(data)
  const sheets: RawSheet[] = []
  workbook.eachSheet((sheet) => {
    if (sheet.state !== 'visible') return
    const rows: SheetRow[] = []
    const last = Math.min(sheet.rowCount, MAX_ROWS_PER_SHEET + 20)
    for (let r = 1; r <= last; r++) {
      const row = sheet.getRow(r)
      const cells: CellValue[] = []
      for (let c = 1; c <= Math.max(row.cellCount, sheet.columnCount); c++) {
        cells.push(cellValue(row.getCell(c)))
      }
      rows.push(cells)
    }
    sheets.push({ name: sheet.name, rows })
  })
  return sheets
}

function cellValue(cell: ExcelJS.Cell): CellValue {
  const v = cell.value
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'number' || typeof v === 'string') return v
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    if ('result' in v && v.result !== undefined) {
      const r = v.result
      return r instanceof Date || typeof r === 'number' || typeof r === 'string' ? r : String(r)
    }
    if ('richText' in v) return v.richText.map((t) => t.text).join('')
    if ('hyperlink' in v) return (v as ExcelJS.CellHyperlinkValue).hyperlink
  }
  return cell.text ?? null
}
