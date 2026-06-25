// AppShell: full-bleed dark canvas with a centered phone-width (max ~460px)
// column and a fixed BottomNav at the base. Rendered by App.tsx, it wraps the
// active screen (Today/Trends/Sleep) and forwards tab + refresh handlers to the
// BottomNav.
import { BottomNav, type TabId } from './BottomNav'

export function AppShell({
  children,
  active,
  onTab,
  onRefresh,
  refreshing,
}: {
  children: React.ReactNode
  active: TabId
  onTab: (id: TabId) => void
  onRefresh: () => void
  refreshing?: boolean
}) {
  return (
    <div className="flex min-h-screen w-full justify-center" style={{ background: 'var(--bg)' }}>
      <div
        className="relative flex min-h-screen w-full max-w-[460px] flex-col border-x"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        <main className="flex-1 px-5 pb-8 pt-7">{children}</main>
        <BottomNav active={active} onTab={onTab} onRefresh={onRefresh} refreshing={refreshing} />
      </div>
    </div>
  )
}
