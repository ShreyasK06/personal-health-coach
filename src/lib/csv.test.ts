import { describe, it, expect } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('parses a simple header + rows into records', () => {
    const text = 'a,b,c\n1,2,3\n4,5,6'
    const rows = parseCsv(text)
    expect(rows).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ])
  })

  it('handles quoted fields containing commas', () => {
    const text = 'name,note\n"Doe, John","hello, world"\nJane,plain'
    const rows = parseCsv(text)
    expect(rows).toEqual([
      { name: 'Doe, John', note: 'hello, world' },
      { name: 'Jane', note: 'plain' },
    ])
  })

  it('handles escaped double quotes inside quoted fields', () => {
    const text = 'a,b\n"she said ""hi""",2'
    const rows = parseCsv(text)
    expect(rows).toEqual([{ a: 'she said "hi"', b: '2' }])
  })

  it('handles empty cells', () => {
    const text = 'a,b,c\n1,,3'
    const rows = parseCsv(text)
    expect(rows).toEqual([{ a: '1', b: '', c: '3' }])
  })

  it('handles CRLF line endings', () => {
    const text = 'a,b\r\n1,2\r\n3,4'
    const rows = parseCsv(text)
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('skips trailing blank lines', () => {
    const text = 'a,b\n1,2\n\n'
    const rows = parseCsv(text)
    expect(rows).toEqual([{ a: '1', b: '2' }])
  })

  it('returns an empty array for header-only input', () => {
    const text = 'a,b,c'
    const rows = parseCsv(text)
    expect(rows).toEqual([])
  })

  it('handles quoted fields that span newlines', () => {
    const text = 'a,b\n"line1\nline2",2'
    const rows = parseCsv(text)
    expect(rows).toEqual([{ a: 'line1\nline2', b: '2' }])
  })
})
