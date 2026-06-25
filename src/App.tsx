// App root for the Titanium dark redesign. On mount it loads health data from
// Firebase via loadHealthData(), manages loading / error / empty / ready states,
// and renders the AppShell with a BottomNav that switches between the Today,
// Trends, and Sleep screens. The gold "+" button refreshes from Firebase, and
// the empty state keeps the legacy CSV import as a secondary affordance.
import { useCallback, useEffect, useState } from 'react'
import { loadHealthData } from './lib/firebase'
import type { DayView } from './lib/firebase'
import { AppShell } from './components/AppShell'
import type { TabId } from './components/BottomNav'
import { Today } from './screens/Today'
import { Trends } from './screens/Trends'
import { Sleep } from './screens/Sleep'
import { LoadingScreen, ErrorScreen, EmptyScreen } from './screens/StatusScreens'

type LoadState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; days: DayView[] }

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [tab, setTab] = useState<TabId>('today')
  const [refreshing, setRefreshing] = useState(false)

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

  useEffect(() => {
    void load()
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

  return (
    <AppShell active={tab} onTab={setTab} onRefresh={handleRefresh} refreshing={refreshing}>
      {tab === 'today' && <Today days={days} />}
      {tab === 'trends' && <Trends days={days} />}
      {tab === 'sleep' && <Sleep days={days} />}
    </AppShell>
  )
}
