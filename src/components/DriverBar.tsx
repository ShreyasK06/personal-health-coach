// Row visualizing one recovery driver (HRV, RHR, Sleep, Respiratory) inside
// the Recovery detail view: label + value on the left, a horizontal
// center-baseline bar showing the driver's z-score (green to the right when
// it lifts recovery, red to the left when it pulls it down), and the plain-
// language note underneath. Consumes the Driver shape from lib/detail.ts.
import type { Driver } from '../lib/detail'

const Z_CLAMP = 2.5

function formatZ(z: number): string {
  const sign = z >= 0 ? '+' : ''
  return `${sign}${z.toFixed(1)} sd`
}

export function DriverBar({ driver }: { driver: Driver }) {
  const z = Math.max(-Z_CLAMP, Math.min(Z_CLAMP, driver.z))
  const frac = Math.abs(z) / Z_CLAMP // 0..1
  const positive = z >= 0
  const barColor = positive ? 'var(--rec-high)' : 'var(--rec-low)'

  const displayValue =
    driver.value == null
      ? '--'
      : Math.abs(driver.value) < 10 && !Number.isInteger(driver.value)
        ? driver.value.toFixed(1)
        : Math.round(driver.value).toString()

  return (
    <div
      className="flex flex-col gap-3 rounded-[18px] border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
            {driver.label}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-display tabnum text-xl font-black leading-none" style={{ color: 'var(--text)' }}>
              {displayValue}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-mut)' }}>
              {driver.unit}
            </span>
          </div>
        </div>
        <span
          className="tabnum shrink-0 text-xs font-bold"
          style={{ color: barColor }}
        >
          {formatZ(driver.z)}
        </span>
      </div>

      <div className="relative h-2 w-full rounded-full" style={{ background: 'var(--surface-2)' }}>
        {/* baseline marker at center */}
        <div
          className="absolute top-1/2 h-3 w-px -translate-y-1/2"
          style={{ left: '50%', background: 'var(--border-strong)' }}
        />
        {positive ? (
          <div
            className="absolute top-0 h-2 rounded-full"
            style={{ left: '50%', width: `${frac * 50}%`, background: barColor }}
          />
        ) : (
          <div
            className="absolute top-0 h-2 rounded-full"
            style={{ right: '50%', width: `${frac * 50}%`, background: barColor }}
          />
        )}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-mut)' }}>
        {driver.note}
      </p>
    </div>
  )
}
