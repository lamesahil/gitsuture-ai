
const STEPS = [
  {
    num: '01',
    numColor: '#4cd7f6',
    icon: WebhookIcon,
    iconColor: '#4cd7f6',
    title: 'Detect',
    body: 'GitHub webhook catches failing PR check suites in real time (< 120ms). GitSuture intercepts the event without altering CI queue precedence.',
    footer: 'Hook latency: ~45ms',
  },
  {
    num: '02',
    numColor: '#d0bcff',
    icon: TreeIcon,
    iconColor: '#d0bcff',
    title: 'Diagnose',
    body: 'GitSuture spins up an ephemeral local container, isolates stack traces, and extracts the AST call graph to pinpoint the exact broken assertion.',
    footer: 'AST-guided analysis',
  },
  {
    num: '03',
    numColor: '#4cd7f6',
    icon: HealingIcon,
    iconColor: '#4cd7f6',
    title: 'Repair',
    body: 'Context-constrained patch generation targeting the relevant error scope without touching unrelated files or dependencies.',
    footer: 'Gemini Models',
  },
  {
    num: '04',
    numColor: '#4edea3',
    icon: TaskAltIcon,
    iconColor: '#4edea3',
    title: 'Verify',
    body: 'Patch is applied inside the isolated sandbox and the test suite is rerun. Only 100% verified patches update the branch and re-trigger green CI.',
    footer: 'Gatekeeper: Tests verified before commit',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="max-w-7xl mx-auto px-6 lg:px-12 py-20 relative">
      {/* Section header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#4cd7f6',
          }}
        >
          ARCHITECTURE &amp; LIFECYCLE
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
          Autonomous repair in four structured steps.
        </h2>
        <p
          className="mt-2"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            lineHeight: '20px',
            color: '#bcc9cd',
          }}
        >
          GitSuture isolates pull request failures and verifies proposed patches before updating branches.
        </p>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 relative">
        {/* Connector line (desktop) */}
        <div
          className="hidden lg:block absolute left-8 right-8 h-0.5 z-0"
          style={{
            top: '56px',
            background: 'linear-gradient(90deg, rgba(76,215,246,0.15), rgba(208,188,255,0.15), rgba(78,222,163,0.15))',
          }}
          aria-hidden="true"
        />

        {STEPS.map((step) => {
          const Icon = step.icon
          return (
            <div
              key={step.num}
              className="relative z-10 p-5 rounded-xl flex flex-col justify-between transition-all shadow-md group"
              style={{ background: '#192029', border: '1px solid #232a34' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#232a34')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#192029')}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '13px',
                      fontWeight: 700,
                      color: step.numColor,
                    }}
                  >
                    {step.num}
                  </span>
                  <Icon color={step.iconColor} />
                </div>
                <h3
                  className="font-semibold mb-2"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '18px',
                    lineHeight: '26px',
                    letterSpacing: '-0.015em',
                    color: '#dce3f0',
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    lineHeight: '18px',
                    color: '#bcc9cd',
                  }}
                >
                  {step.body}
                </p>
              </div>
              <div
                className="mt-4 pt-3"
                style={{
                  borderTop: '1px solid #232a34',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: '#869397',
                }}
              >
                {step.footer}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Step Icons ───────────────────────────────────────────────────────────────

function WebhookIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <path d="M18 16.8a7.15 7.15 0 0 0 2.24-5.32c0-3.96-3.36-7.16-7.5-7.16a7.35 7.35 0 0 0-7.5 7.16 7.15 7.15 0 0 0 2.24 5.32" />
      <path d="M12 4.5v7" />
      <path d="M8 14l4 4 4-4" />
    </svg>
  )
}

function TreeIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <path d="M12 4v4M12 4l4 4M12 4 8 8" />
      <path d="M8 12v4M16 12v4" />
      <rect x="10" y="3" width="4" height="4" rx="1" />
      <rect x="6" y="11" width="4" height="4" rx="1" />
      <rect x="14" y="11" width="4" height="4" rx="1" />
    </svg>
  )
}

function HealingIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function TaskAltIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}
