import { useCallback, useRef, useState } from 'react'
import { extractCsvs } from './lib/loadZip'
import { parseDailyCsv, parseWorkoutsCsv, computeDailyResults, DEFAULT_PROFILE } from './lib/healthExport'
import type { DailyResult } from './lib/healthExport'
import { RecoveryRing } from './components/RecoveryRing'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; results: DailyResult[] }

const BAND_DOT: Record<'red' | 'amber' | 'green', string> = {
  red: 'var(--red)',
  amber: 'var(--amber)',
  green: 'var(--green)',
}

const LOAD_BAND_STYLE: Record<
  'detraining' | 'optimal' | 'caution' | 'high-risk',
  { color: string; bg: string; label: string }
> = {
  optimal: { color: 'var(--green)', bg: 'rgba(22, 196, 122, 0.15)', label: 'Optimal' },
  detraining: { color: 'var(--amber)', bg: 'rgba(255, 176, 32, 0.15)', label: 'Detraining' },
  caution: { color: 'var(--amber)', bg: 'rgba(255, 176, 32, 0.15)', label: 'Caution' },
  'high-risk': { color: 'var(--red)', bg: 'rgba(255, 59, 59, 0.15)', label: 'High risk' },
}

async function processZipFile(file: File): Promise<LoadState> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const { dailyCsv, workoutsCsv } = extractCsvs(bytes)

  if (!dailyCsv) return { status: 'empty' }

  const { nights, sleeps } = parseDailyCsv(dailyCsv)
  const workoutsByDate = workoutsCsv ? parseWorkoutsCsv(workoutsCsv) : new Map()
  const results = computeDailyResults(
    nights,
    sleeps,
    workoutsByDate,
    DEFAULT_PROFILE,
    new Date().getFullYear(),
  )

  if (results.length === 0) return { status: 'empty' }
  return { status: 'ready', results }
}

function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-5 sm:px-10">
      <div className="font-display text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
        delphi<span style={{ color: 'var(--green)' }}>-vitals</span>
      </div>
    </header>
  )
}

function UploadScreen({
  onFile,
  loading,
  errorMessage,
}: {
  onFile: (file: File) => void
  loading: boolean
  errorMessage: string | null
}) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-lg text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--text)' }}>
            Your training, decoded.
          </h1>
          <p className="mt-3 text-base" style={{ color: 'var(--muted)' }}>
            Upload your Health Auto Export to see recovery, strain, sleep, and training load.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="mt-8 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 transition-colors"
            style={{
              borderColor: dragActive ? 'var(--green)' : 'var(--border)',
              background: 'var(--card)',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke={dragActive ? 'var(--green)' : 'var(--muted)'}
              strokeWidth="1.6"
            >
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="font-medium" style={{ color: 'var(--text)' }}>
              {loading ? 'Reading export…' : 'Drop your .zip here, or click to browse'}
            </div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              Health Auto Export from the iOS app
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onFile(file)
              }}
            />
          </div>

          {errorMessage && (
            <div
              className="mt-6 rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--red)', color: 'var(--red)', background: 'rgba(255,59,59,0.08)' }}
            >
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 items-center justify-center px-6">
        <div
          className="w-full max-w-lg rounded-2xl border px-8 py-10 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <h2 className="font-display text-xl font-semibold" style={{ color: 'var(--text)' }}>
            No data found in that export
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            This export did not contain any daily metrics to score. On your iPhone go to{' '}
            <span style={{ color: 'var(--text)' }}>
              Settings → Privacy &amp; Security → Health → Health Auto Export
            </span>{' '}
            and turn on all categories, then re-export with a date range that has data.
          </p>
          <button
            onClick={onRetry}
            className="mt-6 rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: 'var(--green)', color: '#06140f' }}
          >
            Try another file
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  pill,
}: {
  label: string
  value: string
  sub?: string
  pill?: { text: string; color: string; bg: string }
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          {label}
        </span>
        {pill && (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ color: pill.color, background: pill.bg }}
          >
            {pill.text}
          </span>
        )}
      </div>
      <div className="font-display text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
        {value}
      </div>
      {sub && <div className="text-sm" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

function Dashboard({ results, onReset }: { results: DailyResult[]; onReset: () => void }) {
  const latest = results[results.length - 1]
  const recent = [...results].slice(-14).reverse()

  const sleepValue = latest.sleep ? `${Math.round(latest.sleep.score)}` : '—'
  const sleepSub = latest.sleep
    ? `${Math.round(latest.sleep.performance * 100)}% of sleep need met`
    : 'No sleep data'

  const loadBand = LOAD_BAND_STYLE[latest.load.band]

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-6 pb-16 sm:px-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Today
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {latest.date}
            </p>
          </div>
          <button
            onClick={onReset}
            className="rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Upload new file
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <div
            className="flex items-center justify-center rounded-2xl border p-8"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            {latest.recovery ? (
              <RecoveryRing score={latest.recovery.score} band={latest.recovery.band} />
            ) : (
              <div className="flex h-[220px] w-[220px] flex-col items-center justify-center text-center">
                <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                  No overnight data
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <StatCard label="Strain" value={latest.strain.strain.toFixed(1)} sub="out of 21" />
            <StatCard label="Sleep" value={sleepValue} sub={sleepSub} />
            <StatCard
              label="Load (ACWR)"
              value={latest.load.acwr.toFixed(2)}
              pill={{ text: loadBand.label, color: loadBand.color, bg: loadBand.bg }}
            />
          </div>
        </div>

        <div className="mt-8">
          <h2 className="font-display mb-3 text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Recent days
          </h2>
          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="px-5 py-3 text-left font-medium" style={{ color: 'var(--muted)' }}>
                    Date
                  </th>
                  <th className="px-5 py-3 text-left font-medium" style={{ color: 'var(--muted)' }}>
                    Recovery
                  </th>
                  <th className="px-5 py-3 text-left font-medium" style={{ color: 'var(--muted)' }}>
                    Strain
                  </th>
                  <th className="px-5 py-3 text-left font-medium" style={{ color: 'var(--muted)' }}>
                    Sleep
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((day) => (
                  <tr key={day.date} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                      {day.date}
                    </td>
                    <td className="px-5 py-3">
                      {day.recovery ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: BAND_DOT[day.recovery.band] }}
                          />
                          <span style={{ color: 'var(--text)' }}>{Math.round(day.recovery.score)}%</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                      {day.strain.strain.toFixed(1)}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                      {day.sleep ? Math.round(day.sleep.score) : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })

  const handleFile = useCallback(async (file: File) => {
    setState({ status: 'loading' })
    try {
      const result = await processZipFile(file)
      setState(result)
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not read that file.',
      })
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  if (state.status === 'ready') {
    return <Dashboard results={state.results} onReset={reset} />
  }

  if (state.status === 'empty') {
    return <EmptyState onRetry={reset} />
  }

  return (
    <UploadScreen
      onFile={handleFile}
      loading={state.status === 'loading'}
      errorMessage={state.status === 'error' ? state.message : null}
    />
  )
}
