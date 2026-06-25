// Bottom tab bar fixed within the centered column: Today / Trends / Sleep with
// a central circular gold "+" button that refreshes data from Firebase. Active
// tab is gold, others muted. Rendered by AppShell; onTab switches screens and
// onRefresh re-runs loadHealthData.
export type TabId = 'today' | 'trends' | 'sleep'

function TodayIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--gold)' : 'var(--text-mut)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrendsIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--gold)' : 'var(--text-mut)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M4 16l4-5 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SleepIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--gold)' : 'var(--text-mut)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TABS: { id: TabId; label: string; Icon: (p: { active: boolean }) => React.ReactElement }[] = [
  { id: 'today', label: 'Today', Icon: TodayIcon },
  { id: 'trends', label: 'Trends', Icon: TrendsIcon },
  { id: 'sleep', label: 'Sleep', Icon: SleepIcon },
]

export function BottomNav({
  active,
  onTab,
  onRefresh,
  refreshing,
}: {
  active: TabId
  onTab: (id: TabId) => void
  onRefresh: () => void
  refreshing?: boolean
}) {
  const left = TABS.slice(0, 1)
  const right = TABS.slice(1)

  return (
    <nav
      className="pointer-events-auto sticky bottom-0 z-20 mt-auto flex items-center justify-between gap-2 border-t px-4 pb-5 pt-3"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex flex-1 justify-around">
        {left.map(({ id, label, Icon }) => (
          <TabButton key={id} id={id} label={label} Icon={Icon} active={active === id} onClick={() => onTab(id)} />
        ))}
      </div>

      <button
        type="button"
        onClick={onRefresh}
        aria-label="Refresh data from Firebase"
        className="-mt-7 flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
        style={{
          background: 'var(--gold)',
          color: '#1A1304',
          boxShadow: '0 6px 20px color-mix(in srgb, var(--gold) 40%, transparent)',
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          className={refreshing ? 'animate-spin' : ''}
        >
          {refreshing ? (
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v4h-4" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>

      <div className="flex flex-1 justify-around">
        {right.map(({ id, label, Icon }) => (
          <TabButton key={id} id={id} label={label} Icon={Icon} active={active === id} onClick={() => onTab(id)} />
        ))}
      </div>
    </nav>
  )
}

function TabButton({
  label,
  Icon,
  active,
  onClick,
}: {
  id: TabId
  label: string
  Icon: (p: { active: boolean }) => React.ReactElement
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-3 py-1"
      style={{ color: active ? 'var(--gold)' : 'var(--text-mut)' }}
    >
      <Icon active={active} />
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
    </button>
  )
}
