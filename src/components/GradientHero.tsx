// Header wrapper rendering a title (+ optional subtitle / right-side content
// / children) over the .hero-grad gradient wash with comfortable padding.
// Used as a premium page-header chrome above screen content.
import type { ReactNode } from 'react'

interface GradientHeroProps {
  title: string
  subtitle?: string
  right?: ReactNode
  children?: ReactNode
}

export function GradientHero({ title, subtitle, right, children }: GradientHeroProps) {
  return (
    <div className="hero-grad rounded-[18px] px-5 py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-black leading-tight" style={{ color: 'var(--text)' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm font-medium" style={{ color: 'var(--text-mut)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
