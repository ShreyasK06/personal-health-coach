// "Today's Synthesis" insight card: a dark card with a subtle border holding a
// one or two sentence plain-language summary of the day. The text is built by
// buildSynthesis(day) and passed in by the Today screen. The accent stripe is
// colored by recovery band.
export function SynthesisCard({
  text,
  accent = 'var(--gold)',
}: {
  text: string
  accent?: string
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[18px] border p-5 pl-6"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: accent, boxShadow: `0 0 16px ${accent}` }}
      />
      <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        {text}
      </p>
    </div>
  )
}
