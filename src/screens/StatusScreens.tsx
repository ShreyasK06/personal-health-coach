// Loading / error / empty status screens shown by App before the dashboard is
// ready. The empty state offers a Refresh button (re-runs loadHealthData) and
// keeps the legacy CSV/zip import as a small secondary affordance, reusing
// extractCsvs + the existing scoring engines via parseDailyCsv/parseWorkoutsCsv
// /computeDailyResults to build DayView[] without a backend.
import { useRef, useState } from 'react'
import { extractCsvs } from '../lib/loadZip'
import {
  parseDailyCsv,
  parseWorkoutsCsv,
  computeDailyResults,
  DEFAULT_PROFILE,
} from '../lib/healthExport'
import type { DayView } from '../lib/firebase'

/** Builds DayView[] from a Health Auto Export .zip, mirroring the field mapping
 * in firebase.buildDayViews but sourced from the CSV parser. */
async function dayViewsFromZip(file: File): Promise<DayView[]> {
  const buf = await file.arrayBuffer()
  const { dailyCsv, workoutsCsv } = extractCsvs(new Uint8Array(buf))
  if (!dailyCsv) return []

  const { nights, sleeps } = parseDailyCsv(dailyCsv)
  const workoutsByDate = workoutsCsv ? parseWorkoutsCsv(workoutsCsv) : new Map()
  const results = computeDailyResults(nights, sleeps, workoutsByDate, DEFAULT_PROFILE, new Date().getFullYear())

  const nightsByDate = new Map(nights.map((n) => [n.date, n]))
  const sleepsByDate = new Map(sleeps.map((s) => [s.date, s]))

  return results
    .map((result) => {
      const night = nightsByDate.get(result.date) ?? null
      const sleep = sleepsByDate.get(result.date) ?? null
      return {
        ...result,
        hrvMs: night?.hrvMs ?? null,
        restingHr: night?.restingHr ?? null,
        respiratoryRate: night?.respiratoryRate ?? null,
        asleepMinutes: sleep?.asleepMinutes ?? null,
        inBedMinutes: sleep?.inBedMinutes ?? null,
        deepMinutes: sleep?.deepMinutes ?? null,
        remMinutes: sleep?.remMinutes ?? null,
        coreMinutes: sleep?.coreMinutes ?? null,
        awakeMinutes: sleep?.awakeMinutes ?? null,
        bedTime: sleep?.bedTime ?? null,
        wakeTime: sleep?.wakeTime ?? null,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  )
}

export function LoadingScreen() {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-4 text-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="2.2"
          className="animate-spin"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
        </svg>
        <p className="section-label">Syncing your data</p>
      </div>
    </Centered>
  )
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Centered>
      <div
        className="rounded-[18px] border p-6 text-center"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <h2 className="font-display text-xl font-bold" style={{ color: 'var(--text)' }}>
          Could not load your data
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-mut)' }}>
          {message}
        </p>
        <button
          onClick={onRetry}
          className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold transition-transform active:scale-95"
          style={{ background: 'var(--gold)', color: '#1A1304' }}
        >
          Try again
        </button>
      </div>
    </Centered>
  )
}

export function EmptyScreen({
  onRefresh,
  onCsv,
}: {
  onRefresh: () => void
  onCsv: (days: DayView[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File) => {
    setBusy(true)
    setCsvError(null)
    try {
      const days = await dayViewsFromZip(file)
      if (days.length === 0) {
        setCsvError('That export did not contain any daily metrics to score.')
      } else {
        onCsv(days)
      }
    } catch {
      setCsvError('Could not read that file. Make sure it is a Health Auto Export .zip.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Centered>
      <div
        className="rounded-[18px] border p-6 text-center"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'var(--surface-2)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="font-display mt-4 text-xl font-bold" style={{ color: 'var(--text)' }}>
          Your data has not synced yet
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-mut)' }}>
          Once your Health Auto Export pushes a night of data, pull to refresh and your recovery,
          sleep, and strain will appear here.
        </p>
        <button
          onClick={onRefresh}
          className="mt-5 w-full rounded-full px-5 py-3 text-sm font-semibold transition-transform active:scale-95"
          style={{ background: 'var(--gold)', color: '#1A1304' }}
        >
          Refresh
        </button>

        <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-xs font-semibold uppercase tracking-wide transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: 'var(--text-mut)' }}
          >
            {busy ? 'Reading export...' : 'Or import a CSV export'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
          {csvError && (
            <p className="mt-3 text-xs" style={{ color: 'var(--critical)' }}>
              {csvError}
            </p>
          )}
        </div>
      </div>
    </Centered>
  )
}
