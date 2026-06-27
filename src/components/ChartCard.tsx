// Standard wrapper for ALL charts so they never overlap. The header row
// (title, optional big value, optional right-side slot like range pills)
// and the chart body each get an explicit CSS-reserved height -- not a
// flex-content-derived height -- so a sparse or empty chart can never
// collapse the header into the body or vice versa. Fixes the "charts
// overlapping" bug, which was caused by chart-internal content (readouts,
// pill rows) sizing the container instead of the container sizing the
// chart.
import type { ReactNode } from 'react'
import { Card } from './Card'

interface ChartCardProps {
  title?: string
  value?: string
  unit?: string
  right?: ReactNode
  children: ReactNode
  minBodyHeight?: number
  className?: string
}

const HEADER_HEIGHT = 40

export function ChartCard({
  title,
  value,
  unit,
  right,
  children,
  minBodyHeight = 200,
  className = '',
}: ChartCardProps) {
  const hasHeader = title != null || value != null || right != null

  return (
    <Card className={className}>
      <div className="flex flex-col gap-3">
        {hasHeader && (
          <div
            className="flex items-start justify-between gap-3"
            style={{ minHeight: HEADER_HEIGHT, height: HEADER_HEIGHT }}
          >
            <div className="flex flex-col gap-0.5">
              {title && <span className="text-label" style={{ color: 'var(--text-mut)' }}>{title}</span>}
              {value != null && (
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display tabnum text-display-sm" style={{ color: 'var(--text)' }}>
                    {value}
                  </span>
                  {unit && (
                    <span className="text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
                      {unit}
                    </span>
                  )}
                </div>
              )}
            </div>
            {right && <div className="flex-shrink-0">{right}</div>}
          </div>
        )}
        <div style={{ minHeight: minBodyHeight, height: minBodyHeight, position: 'relative' }}>{children}</div>
      </div>
    </Card>
  )
}
