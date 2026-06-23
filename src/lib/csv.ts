// Small, dependency-free CSV parser. Handles quoted fields (commas, embedded
// newlines, and escaped "" quotes inside quotes), CRLF/LF line endings, and
// trailing blank lines. Returns one record per data row, keyed by header.

function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      endField()
      i++
      continue
    }
    if (ch === '\r') {
      // Treat lone \r or \r\n as a row terminator.
      if (text[i + 1] === '\n') i++
      endRow()
      i++
      continue
    }
    if (ch === '\n') {
      endRow()
      i++
      continue
    }
    field += ch
    i++
  }

  // Final field/row if the text didn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    endRow()
  }

  return rows
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text).filter((r) => !(r.length === 1 && r[0] === ''))
  if (rows.length === 0) return []

  const header = rows[0]
  const records: Record<string, string>[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.length === 1 && row[0] === '') continue // blank line
    const record: Record<string, string> = {}
    for (let c = 0; c < header.length; c++) {
      record[header[c]] = row[c] ?? ''
    }
    records.push(record)
  }

  return records
}
