// Scrubbable line chart for the "in-depth detail" views: a hand-rolled SVG
// line over a numeric series with a trailing-range pill selector (7d/30d/90d/
// All), optional translucent background bands (e.g. recovery red/amber/green
// zones), and pointer/touch scrubbing that shows a guide line, a dot on the
// nearest point, and a date + value readout. No external chart lib.
import { useMemo, useRef, useState } from 'react'
import { shortDate } from '../lib/uiHelpers'

export interface ChartBand {
  from: number
  to: number
  color: string
}

interface InteractiveChartProps {
  values: (number | null)[]
  dates: string[]
  color: string
  unit?: string
  bands?: ChartBand[]
  ranges?: number[]
  height?: number
}

const DEFAULT_RANGES = [7, 30, 90]
const PAD_X = 10
const PAD_TOP = 14
const PAD_BOTTOM = 14

function formatValue(v: number): string {
  return Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v).toString()
}

export function InteractiveChart({
  values,
  dates,
  color,
  unit,
  bands,
  ranges = DEFAULT_RANGES,
  height = 180,
}: InteractiveChartProps) {
  const n = values.length
  const allOptions = useMemo(() => [...ranges, n], [ranges, n])

  // Default to the largest available range that has data, or 30d.
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
  const min = present.length ? Math.min(...present) : 0
  const max = present.length ? Math.max(...present) : 1
  const span = max - min || 1
  const padAmt = span * 0.08
  const yMin = min - padAmt
  const yMax = max + padAmt
  const ySpan = yMax - yMin || 1

  const width = 320
  const usableW = width - PAD_X * 2
  const usableH = height - PAD_TOP - PAD_BOTTOM

  const m = sliceValues.length
  const xAt = (i: number) => PAD_X + (m === 1 ? usableW / 2 : (i / (m - 1)) * usableW)
  const yAt = (v: number) => PAD_TOP + usableH - ((v - yMin) / ySpan) * usableH

  let path = ''
  let started = false
  const pts: { x: number; y: number; i: number }[] = []
  sliceValues.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      started = false
      return
    }
    const x = xAt(i)
    const y = yAt(v)
    pts.push({ x, y, i })
    path += `${started ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `
    started = true
  })

  const activeIdx = hoverIdx != null ? hoverIdx : pts.length ? pts[pts.length - 1].i : null
  const activePt = pts.find((p) => p.i === activeIdx) ?? null

  function nearestIndex(clientX: number): number | null {
    if (!svgRef.current || pts.length === 0) return null
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * width
    let best = pts[0]
    let bestDist = Math.abs(pts[0].x - relX)
    for (const p of pts) {
      const d = Math.abs(p.x - relX)
      if (d < bestDist) {
        bestDist = d
        best = p
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
        {bands?.map((b, idx) => {
          const top = yAt(Math.min(yMax, b.to))
          const bottom = yAt(Math.max(yMin, b.from))
          return (
            <rect
              key={idx}
              x={0}
              y={Math.min(top, bottom)}
              width={width}
              height={Math.max(0, Math.abs(bottom - top))}
              fill={b.color}
              opacity={0.12}
            />
          )
        })}

        {activePt && (
          <line
            x1={activePt.x}
            x2={activePt.x}
            y1={PAD_TOP}
            y2={height - PAD_BOTTOM}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />
        )}

        <path d={path.trim()} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {activePt && (
          <>
            <circle cx={activePt.x} cy={activePt.y} r={5} fill={color} opacity={0.25} />
            <circle cx={activePt.x} cy={activePt.y} r={3.5} fill={color} />
          </>
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
