// The single card primitive used across the app. Replaces the old ad-hoc
// `.glass` / inline-border-and-background card markup that screens used to
// hand-roll. `surface` is a solid `--surface` fill with a 1px `--border`
// hairline and 20px radius (no backdrop-blur -- that was the Noop/WHOOP
// signature this redesign moves away from). `hero` is a subtle gradient
// surface with a single accent top-border, for hero/header-style cards.
// Optional `onClick` makes the card an accessible button (role, keyboard
// activation, hover lift) without changing its visual tone.
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'

interface CardProps {
  tone?: 'surface' | 'hero'
  accent?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
  onClick?: () => void
}

export function Card({ tone = 'surface', accent, className = '', style, children, onClick }: CardProps) {
  const interactive = onClick != null

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  const toneStyle: CSSProperties =
    tone === 'hero'
      ? {
          background: `linear-gradient(160deg, var(--surface) 0%, var(--bg) 100%)`,
          borderTop: `2px solid ${accent ?? 'var(--accent)'}`,
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }
      : {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }

  return (
    <div
      className={`rounded-[20px] p-4 transition-transform ${interactive ? 'cursor-pointer' : ''} ${className}`}
      style={{ ...toneStyle, ...style }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onMouseEnter={
        interactive
          ? (e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
            }
          : undefined
      }
      onMouseLeave={
        interactive
          ? (e) => {
              e.currentTarget.style.transform = 'translateY(0)'
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
