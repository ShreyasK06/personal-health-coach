// Calendar contribution-graph strip: columns are weeks, rows are weekdays
// (Sun..Sat), and each cell's opacity maps its value low->high within a
// single-hue ramp derived from the `color` prop. Hover/focus shows a small
// date+value readout, matching the tooltip conventions used elsewhere.
import { useState } from 'react'
import { shortDate } from '../lib/uiHelpers'

interface HeatmapProps {
  values: (number | null)[]
  dates: string[]
  color: string
  weeks?: number
}

const CELL = 13
const GAP = 3
const DEFAULT_WEEKS = 18

function formatValue(v: number): string {
  return Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v).toString()
}

export function Heatmap({ values, dates, color, weeks = DEFAULT_WEEKS }: HeatmapProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const days = weeks * 7
  const sliceValues = values.slice(-days)
  const sliceDates = dates.slice(-days)

  // Left-pad so the first column starts on Sunday (row 0) and the grid is a
  // clean weeks x 7 matrix, with leading cells rendered empty.
  const firstDow = sliceDates.length > 0 ? new Date(`${sliceDates[0]}T00:00:00`).getDay() : 0
  const padded: { date: string | null; value: number | null }[] = [
    ...Array.from({ length: firstDow }, () => ({ date: null, value: null })),
    ...sliceDates.map((d, i) => ({ date: d, value: sliceValues[i] })),
  ]
  const colCount = Math.ceil(padded.length / 7)
  while (padded.length < colCount * 7) padded.push({ date: null, value: null })

  const present = sliceValues.filter((v): v is number => v != null && Number.isFinite(v))
  const max = present.length ? Math.max(...present) : 1
  const min = present.length ? Math.min(...present) : 0
  const span = max - min || 1

  const opacityFor = (v: number | null) => {
    if (v == null || !Number.isFinite(v)) return 0
    const frac = (v - min) / span
    return 0.12 + frac * 0.78
  }

  const columns: { date: string | null; value: number | null }[][] = []
  for (let c = 0; c < colCount; c++) {
    columns.push(padded.slice(c * 7, c * 7 + 7))
  }

  const width = colCount * (CELL + GAP) - GAP
  const height = 7 * (CELL + GAP) - GAP

  const activeCell = activeIdx != null ? padded[activeIdx] : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
          {activeCell?.date ? shortDate(activeCell.date) : 'Hover a day'}
        </span>
        <span className="font-display tabnum text-sm font-bold" style={{ color: 'var(--text)' }}>
          {activeCell?.value != null ? formatValue(activeCell.value) : '--'}
        </span>
      </div>
      <svg width="100%" height={height + 4} viewBox={`0 0 ${width} ${height + 4}`} preserveAspectRatio="xMinYMid meet">
        {columns.map((col, c) =>
          col.map((cell, r) => {
            const idx = c * 7 + r
            const x = c * (CELL + GAP)
            const y = r * (CELL + GAP) + 2
            if (cell.date == null) {
              return <rect key={idx} x={x} y={y} width={CELL} height={CELL} rx={3} fill="transparent" />
            }
            const op = opacityFor(cell.value)
            const isActive = idx === activeIdx
            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={3}
                fill={op > 0 ? color : 'var(--surface-2)'}
                opacity={op > 0 ? op : 1}
                stroke={isActive ? 'var(--text)' : 'none'}
                strokeWidth={isActive ? 1 : 0}
                tabIndex={0}
                role="img"
                aria-label={`${cell.date}: ${cell.value != null ? formatValue(cell.value) : 'no data'}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActiveIdx(idx)}
                onFocus={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                onBlur={() => setActiveIdx(null)}
              />
            )
          }),
        )}
      </svg>
    </div>
  )
}
