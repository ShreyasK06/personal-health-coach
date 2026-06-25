// Drop-in sibling of InteractiveChart.tsx: same scrub + range-selector UX and
// the same prop shape (values, dates, color, unit, bands, ranges, height),
// plus an optional vertical gradient fill under the line (color -> transparent).
import { useId, useMemo, useRef, useState } from 'react'
import { shortDate } from '../lib/uiHelpers'
import type { ChartBand } from './InteractiveChart'

interface AreaChartProps {
  values: (number | null)[]
  dates: string[]
  color: string
  gradFrom?: string
  gradTo?: string
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

export function AreaChart({
  values,
  dates,
  color,
  gradFrom,
  gradTo,
  unit,
  bands,
  ranges = DEFAULT_RANGES,
  height = 180,
}: AreaChartProps) {
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

  // Build a filled-area path that mirrors the line path but drops to the
  // baseline at the start/end of each contiguous run (breaks at gaps).
  let areaPath = ''
  let areaStarted = false
  let runStartX: number | null = null
  let lastX: number | null = null
  sliceValues.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (areaStarted && lastX != null && runStartX != null) {
        areaPath += `L${lastX.toFixed(2)} ${height - PAD_BOTTOM} L${runStartX.toFixed(2)} ${height - PAD_BOTTOM} Z `
      }
      areaStarted = false
      runStartX = null
      lastX = null
      return
    }
    const x = xAt(i)
    const y = yAt(v)
    if (!areaStarted) {
      areaPath += `M${x.toFixed(2)} ${y.toFixed(2)} `
      runStartX = x
      areaStarted = true
    } else {
      areaPath += `L${x.toFixed(2)} ${y.toFixed(2)} `
    }
    lastX = x
  })
  if (areaStarted && lastX != null && runStartX != null) {
    const finalX: number = lastX
    const finalRunStartX: number = runStartX
    areaPath += `L${finalX.toFixed(2)} ${height - PAD_BOTTOM} L${finalRunStartX.toFixed(2)} ${height - PAD_BOTTOM} Z `
  }

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
  const gradId = `${uid}-area-grad`
  const hasFill = Boolean(gradFrom || gradTo)

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
        {hasFill && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradFrom ?? color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={gradTo ?? color} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}

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

        {hasFill && areaPath && <path d={areaPath.trim()} fill={`url(#${gradId})`} stroke="none" />}

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
