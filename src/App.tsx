// App root for the Titanium dark redesign. On mount it loads health data from
// Firebase via loadHealthData(), manages loading / error / empty / ready states,
// and renders the AppShell with a BottomNav that switches between the Today,
// Trends, and Sleep screens. The gold "+" button refreshes from Firebase, and
// the empty state keeps the legacy CSV import as a secondary affordance. Also
// owns `selectedIndex`, the day Today/Sleep currently display (defaults to the
// latest day, steppable via DateNav).
import { useCallback, useEffect, useState } from 'react'
import { loadHealthData } from './lib/firebase'
import type { DayView, DetailKind } from './lib/firebase'
import { AppShell } from './components/AppShell'
import type { TabId } from './components/BottomNav'
import { Today } from './screens/Today'
import { Trends } from './screens/Trends'
import { Sleep } from './screens/Sleep'
import { LoadingScreen, ErrorScreen, EmptyScreen } from './screens/StatusScreens'
import { MetricDetailSheet } from './components/MetricDetailSheet'
import { RecoveryDetail } from './screens/details/RecoveryDetail'
import { SleepDetail } from './screens/details/SleepDetail'
import { StrainDetail } from './screens/details/StrainDetail'
import { LoadReadiness } from './screens/details/LoadReadiness'
import { SimpleMetricDetail } from './screens/details/SimpleMetricDetail'

const DETAIL_TITLE: Record<DetailKind, string> = {
  recovery: 'Recovery',
  sleep: 'Sleep',
  strain: 'Strain',
  load: 'Readiness & Load',
  hrv: 'HRV',
  rhr: 'Resting HR',
  respiratory: 'Respiratory',
}

type LoadState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; days: DayView[] }

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [tab, setTab] = useState<TabId>('today')
  const [refreshing, setRefreshing] = useState(false)
  // Index into `days` that Today/Sleep currently display. Defaults to the
  // latest day; reset to the latest whenever a fresh `days` array lands.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  // Which "in-depth detail" sheet is open, if any, and which day it shows.
  const [detail, setDetail] = useState<{ kind: DetailKind; index: number } | null>(null)
  const openDetail = useCallback((kind: DetailKind, index: number) => setDetail({ kind, index }), [])

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true)
    else setState({ status: 'loading' })
    try {
      const days = await loadHealthData()
      if (days.length === 0) setState({ status: 'empty' })
      else setState({ status: 'ready', days })
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong reaching the server.',
      })
    } finally {
      if (soft) setRefreshing(false)
    }
  }, [])

  // Fetch once on mount. The async work (and its setState calls) runs inside
  // loadHealthData()/load() after a microtask tick, not synchronously inside
  // the effect body, which satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await load()
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const handleRefresh = useCallback(() => {
    if (state.status === 'ready') void load(true)
    else void load(false)
  }, [load, state.status])

  if (state.status === 'loading') return <LoadingScreen />
  if (state.status === 'error') return <ErrorScreen message={state.message} onRetry={() => load(false)} />
  if (state.status === 'empty')
    return <EmptyScreen onRefresh={() => load(false)} onCsv={(days) => setState({ status: 'ready', days })} />

  const { days } = state
  const lastIndex = days.length - 1
  const activeIndex = selectedIndex == null ? lastIndex : Math.min(selectedIndex, lastIndex)

  const detailDay = detail ? days[detail.index] : null

  return (
    <AppShell active={tab} onTab={setTab} onRefresh={handleRefresh} refreshing={refreshing}>
      {tab === 'today' && (
        <Today
          days={days}
          selectedIndex={activeIndex}
          onSelectIndex={setSelectedIndex}
          onOpenDetail={openDetail}
        />
      )}
      {tab === 'trends' && <Trends days={days} onOpenDetail={openDetail} />}
      {tab === 'sleep' && (
        <Sleep
          days={days}
          selectedIndex={activeIndex}
          onSelectIndex={setSelectedIndex}
          onOpenDetail={openDetail}
        />
      )}

      {detail && detailDay && (
        <MetricDetailSheet
          title={DETAIL_TITLE[detail.kind]}
          date={detailDay.date}
          isLatest={detail.index === lastIndex}
          canGoBack={detail.index > 0}
          canGoForward={detail.index < lastIndex}
          onBack={() => setDetail((d) => (d ? { ...d, index: Math.max(0, d.index - 1) } : d))}
          onForward={() => setDetail((d) => (d ? { ...d, index: Math.min(lastIndex, d.index + 1) } : d))}
          onClose={() => setDetail(null)}
        >
          {detail.kind === 'recovery' && <RecoveryDetail days={days} index={detail.index} />}
          {detail.kind === 'sleep' && <SleepDetail days={days} index={detail.index} />}
          {detail.kind === 'strain' && <StrainDetail days={days} index={detail.index} />}
          {detail.kind === 'load' && <LoadReadiness days={days} index={detail.index} />}
          {detail.kind === 'hrv' && <SimpleMetricDetail days={days} index={detail.index} metric="hrv" />}
          {detail.kind === 'rhr' && <SimpleMetricDetail days={days} index={detail.index} metric="rhr" />}
          {detail.kind === 'respiratory' && (
            <SimpleMetricDetail days={days} index={detail.index} metric="respiratory" />
          )}
        </MetricDetailSheet>
      )}
    </AppShell>
  )
}
