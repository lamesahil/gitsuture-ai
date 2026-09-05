
const CARDS = [
  {
    iconColor: '#4cd7f6',
    iconBg: 'rgba(76,215,246,0.08)',
    title: 'Sandboxed Execution',
    body: (
      <>
        Untrusted PR code runs strictly inside an isolated rootless Docker sandbox. Enforced with
        resource boundaries (
        <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4cd7f6' }}>cpu: 2, mem: 2GiB</code>
        ) and completely disabled outbound networking (
        <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4cd7f6' }}>--net none</code>
        ).
      </>
    ),
    Icon: TerminalSvg,
  },
  {
    iconColor: '#d0bcff',
    iconBg: 'rgba(208,188,255,0.08)',
    title: 'Context-Aware Repair',
    body: 'GitSuture uses call-graph stack analysis to provide the AI model only the precise AST context required to solve the error trace, eliminating broad extraneous code edits and unnecessary refactors.',
    Icon: TroubleshootSvg,
  },
  {
    iconColor: '#4edea3',
    iconBg: 'rgba(78,222,163,0.08)',
    title: 'Verified Healing',
    body: 'A generated patch is never pushed to GitHub unless the repaired workspace passes the entire test suite inside the reproduction container. Tests verified before commit to your repository.',
    Icon: VerifiedUserSvg,
  },
  {
    iconColor: '#4cd7f6',
    iconBg: 'rgba(76,215,246,0.08)',
    title: 'Controlled Repair Loop',
    body: 'Controlled repair loop with strict bounded attempt limits (max 3 loops). If an ambiguous or systemic architecture change is required, GitSuture steps aside gracefully and leaves diagnostic breadcrumbs.',
    Icon: LockClockSvg,
  },
]

export default function Differentiators() {
  return (
    <section id="differentiators" className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
      <div className="mb-10">
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#4edea3',
          }}
        >
          DESIGNED FOR SURGICAL PRECISION
        </span>
        <h2
          className="mt-2 font-semibold"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 'clamp(24px, 3vw, 32px)',
            lineHeight: '40px',
            letterSpacing: '-0.025em',
            color: '#dce3f0',
          }}
        >
          Why engineering teams trust GitSuture in production.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CARDS.map((card) => {
          const Icon = card.Icon
          return (
            <div
              key={card.title}
              className="p-5 rounded-xl transition-all shadow-md group"
              style={{ background: '#192029', border: '1px solid #232a34' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#232a34')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#192029')}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-105"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                <Icon color={card.iconColor} />
              </div>
              <h3
                className="font-semibold"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '18px',
                  lineHeight: '26px',
                  letterSpacing: '-0.015em',
                  color: '#dce3f0',
                }}
              >
                {card.title}
              </h3>
              <p
                className="mt-2"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  lineHeight: '20px',
                  color: '#bcc9cd',
                }}
              >
                {card.body}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Card Icons ───────────────────────────────────────────────────────────────

function TerminalSvg({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function TroubleshootSvg({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

function VerifiedUserSvg({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <path d="M12 2L8 5H4v4L2 12l2 3v4h4l4 3 4-3h4v-4l2-3-2-3V5h-4L12 2z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function LockClockSvg({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      <circle cx="12" cy="17" r="1" fill={color} stroke="none" />
    </svg>
  )
}
