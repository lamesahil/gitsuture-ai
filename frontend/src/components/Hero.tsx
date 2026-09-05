import { Fragment } from 'react'
import { GitHubIcon } from './icons'

interface HeroProps {
  onScrollToDemo: () => void
}

const TECH_PILLS = [
  { label: 'GitHub Webhooks', color: '#4cd7f6' },
  { label: 'Docker Sandbox', color: '#4cd7f6' },
  { label: 'Gemini', color: '#4edea3' },
  { label: 'Verified Patches', color: '#4edea3' },
]

export default function Hero({ onScrollToDemo }: HeroProps) {
  return (
    <section id="hero" className="relative w-full overflow-hidden">
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[340px] rounded-full"
        style={{ background: 'rgba(76,215,246,0.08)', filter: 'blur(130px)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-24 right-1/4 w-[380px] h-[220px] rounded-full"
        style={{ background: 'rgba(78,222,163,0.07)', filter: 'blur(110px)' }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-16 relative">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">

          {/* Status badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full shadow-sm"
            style={{
              background: '#232a34',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 500,
              lineHeight: '14px',
              letterSpacing: '0.02em',
            }}
          >
            {/* Ping dot */}
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: '#4edea3' }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: '#4edea3' }}
              />
            </span>
            <span
              className="tracking-wider uppercase font-medium"
              style={{ color: '#dce3f0' }}
            >
              AUTONOMOUS PULL REQUEST REPAIR
            </span>
            <span style={{ color: '#3d494c' }}>•</span>
            <span style={{ color: '#4edea3' }}>ISOLATED WORKFLOW</span>
          </div>

          {/* Main headline */}
          <h1
            className="mt-6 font-semibold leading-tight tracking-tight"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(36px, 6vw, 64px)',
              lineHeight: '1.1',
              letterSpacing: '-0.025em',
              color: '#dce3f0',
            }}
          >
            Code breaks.{' '}
            <br className="hidden sm:inline" />
            <span
              style={{
                background: 'linear-gradient(90deg, #4cd7f6, #acedff, #4edea3)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              GitSuture fixes it.
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="mt-6 max-w-2xl leading-relaxed"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '16px',
              lineHeight: '24px',
              letterSpacing: '-0.005em',
              color: '#bcc9cd',
            }}
          >
            An autonomous AI repair loop for failing GitHub Pull Requests — reproduce, diagnose,
            patch, verify, and recover without leaving your workflow.
          </p>

          {/* CTA Group */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#cta"
              onClick={(e) => {
                e.preventDefault()
                document.querySelector('#cta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded font-medium transition-all shadow-md hover:brightness-110 active:scale-[0.98]"
              style={{
                background: '#06b6d4',
                color: '#00424f',
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                lineHeight: '22px',
                letterSpacing: '-0.01em',
              }}
            >
              <GitHubIcon className="w-4 h-4" />
              <span>Install GitHub App</span>
            </a>
            <button
              id="hero-scroll-btn"
              onClick={onScrollToDemo}
              className="inline-flex items-center gap-2 px-5 py-3 rounded font-medium transition-colors shadow-sm"
              style={{
                background: '#232a34',
                color: '#dce3f0',
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                lineHeight: '22px',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#4cd7f6')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#dce3f0')}
            >
              <PlayCircleIcon />
              <span>View Live Demo</span>
            </button>
          </div>

          {/* Technical trust line */}
          <div
            className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              lineHeight: '18px',
              color: '#869397',
            }}
          >
            {TECH_PILLS.map((pill, i) => (
              <Fragment key={pill.label}>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: pill.color, opacity: 0.7 }}
                    aria-hidden="true"
                  />
                  {pill.label}
                </span>
                {i < TECH_PILLS.length - 1 && (
                  <span style={{ color: '#3d494c' }} aria-hidden="true">•</span>
                )}
              </Fragment>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}

function PlayCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  )
}
