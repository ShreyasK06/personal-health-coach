// Vertical bar chart over a daily series: gradient-filled bars with rounded
// tops, pointer/touch scrub that highlights the nearest bar and shows a
// date+value readout, and a trailing-range pill selector (7d/30d/90d/All) --
// the same UX pattern as InteractiveChart.tsx, just bars instead of a line.
import { useId, useMemo, useRef, useState } from 'react'
import { shortDate } from '../lib/uiHelpers'

interface BarChartProps {
  values: (number | null)[]
  dates: string[]
  color: string
  gradFrom?: string
  gradTo?: string
  unit?: string
  height?: number
  ranges?: number[]
}

const DEFAULT_RANGES = [7, 30, 90]
const PAD_X = 10
const PAD_TOP = 14
const PAD_BOTTOM = 14
const BAR_GAP_FRAC = 0.32 // fraction of the per-bar slot left as gap

function formatValue(v: number): string {
  return Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v).toString()
}

export function BarChart({
  values,
  dates,
  color,
  gradFrom,
  gradTo,
  unit,
  height = 180,
  ranges = DEFAULT_RANGES,
}: BarChartProps) {
  const uid = useId().replace(/:/g, '')
  const n = values.length
  const allOptions = useMemo(() => [...ranges, n], [ranges, n])

  const defaultRange = useMemo(() => {
    const withData = [...ranges].filter((r) => r <= n)
    if (withData.length === 0) return n
    return withData.includes(30) ? 30 : Math.max(...withData)
  }, [ranges, n])

  const [range, setRange] = useState<number>(defaultRange)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const windowSize = Math.min(range, n)
  const sliceValues = values.slice(n - windowSize)
  const sliceDates = dates.slice(n - windowSize)

  const present = sliceValues.filter((v): v is number => v != null && Number.isFinite(v))
  const max = present.length ? Math.max(...present) : 1
  const yMax = max * 1.08 || 1

  const width = 320
  const usableW = width - PAD_X * 2
  const usableH = height - PAD_TOP - PAD_BOTTOM

  const m = sliceValues.length
  const slotW = m > 0 ? usableW / m : usableW
  const barW = Math.max(2, slotW * (1 - BAR_GAP_FRAC))

  const bars = sliceValues
    .map((v, i) => {
      if (v == null || !Number.isFinite(v)) return null
      const x = PAD_X + i * slotW + (slotW - barW) / 2
      const barH = Math.max(1, (v / yMax) * usableH)
      const y = PAD_TOP + usableH - barH
      return { i, x, y, barH, v }
    })
    .filter((b): b is { i: number; x: number; y: number; barH: number; v: number } => b != null)

  const activeIdx = hoverIdx != null ? hoverIdx : bars.length ? bars[bars.length - 1].i : null
  const activeBar = bars.find((b) => b.i === activeIdx) ?? null

  function nearestIndex(clientX: number): number | null {
    if (!svgRef.current || bars.length === 0) return null
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * width
    let best = bars[0]
    let bestDist = Math.abs(best.x + barW / 2 - relX)
    for (const b of bars) {
      const d = Math.abs(b.x + barW / 2 - relX)
      if (d < bestDist) {
        bestDist = d
        best = b
      }
    }
    return best.i
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const idx = nearestIndex(e.clientX)
    if (idx != null) setHoverIdx(idx)
  }

  function handlePointerLeave() {
    setHoverIdx(null)
  }

  const readoutDate = activeIdx != null ? sliceDates[activeIdx] : null
  const readoutValue = activeIdx != null ? sliceValues[activeIdx] : null
  const gradId = `${uid}-bar-grad`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display tabnum text-2xl font-black leading-none" style={{ color: 'var(--text)' }}>
            {readoutValue != null ? formatValue(readoutValue) : '--'}
          </span>
          {unit && (
            <span className="text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
              {unit}
            </span>
          )}
        </div>
        <span className="text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
          {readoutDate ? shortDate(readoutDate) : ''}
        </span>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ touchAction: 'none' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradFrom ?? color} />
            <stop offset="100%" stopColor={gradTo ?? color} stopOpacity={0.55} />
          </linearGradient>
        </defs>

        {bars.map((b) => {
          const isActive = b.i === activeIdx
          const r = Math.min(barW / 2, 4)
          return (
            <rect
              key={b.i}
              x={b.x}
              y={b.y}
              width={barW}
              height={b.barH}
              rx={r}
              ry={r}
              fill={gradFrom || gradTo ? `url(#${gradId})` : color}
              opacity={isActive ? 1 : 0.72}
              style={{ transition: 'opacity 0.15s ease' }}
            />
          )
        })}

        {activeBar && (
          <line
            x1={activeBar.x + barW / 2}
            x2={activeBar.x + barW / 2}
            y1={PAD_TOP}
            y2={height - PAD_BOTTOM}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.35}
          />
        )}
      </svg>

      <div className="flex items-center justify-center gap-1.5">
        {allOptions.map((r) => {
          const label = r === n && !ranges.includes(r) ? 'All' : `${r}d`
          const isActive = range === r
          return (
            <button
              key={`${r}-${label}`}
              type="button"
              onClick={() => setRange(r)}
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                color: isActive ? 'var(--gold)' : 'var(--text-mut)',
                background: isActive ? 'var(--surface-2)' : 'transparent',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
