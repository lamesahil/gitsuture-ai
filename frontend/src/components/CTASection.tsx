import { useState } from 'react'
import { GitHubIcon, CopyIcon, CheckIcon } from './icons'

const CLI_COMMAND = 'gh extension install gitsuture/gh-suture'

interface CTAProps {
  onScrollToDemo: () => void
}

export default function CTASection({ onScrollToDemo }: CTAProps) {
  const [cliCopied, setCliCopied] = useState(false)

  function handleCliCopy() {
    navigator.clipboard.writeText(CLI_COMMAND).then(() => {
      setCliCopied(true)
      setTimeout(() => setCliCopied(false), 2000)
    })
  }

  return (
    <section id="cta" className="max-w-7xl mx-auto px-6 lg:px-12 py-20 relative">
      <div
        className="relative rounded-2xl p-8 lg:p-12 text-center overflow-hidden shadow-2xl"
        style={{ background: '#232a34', border: '1px solid #3d494c' }}
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(76,215,246,0.04) 0%, transparent 60%, rgba(35,42,52,0) 100%)',
          }}
          aria-hidden="true"
        />

        {/* AI repair glow line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, #06b6d4, #8b5cf6, transparent)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#4cd7f6',
              marginBottom: '8px',
            }}
          >
            GET STARTED IN UNDER 2 MINUTES
          </span>

          <h2
            className="font-semibold"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              lineHeight: '1.15',
              letterSpacing: '-0.025em',
              color: '#dce3f0',
              margin: 0,
            }}
          >
            Stop babysitting broken CI.
          </h2>
          <p
            className="mt-2 font-medium"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(20px, 2.5vw, 24px)',
              lineHeight: '32px',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(90deg, #4cd7f6, #4edea3)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Let GitSuture heal it.
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#"
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
              id="cta-scroll-demo"
              onClick={onScrollToDemo}
              className="inline-flex items-center gap-2 px-5 py-3 rounded font-medium transition-colors shadow-sm"
              style={{
                background: '#192029',
                color: '#dce3f0',
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                lineHeight: '22px',
                letterSpacing: '-0.01em',
                border: '1px solid #3d494c',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#4cd7f6')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#dce3f0')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
              <span>View Live Demo</span>
            </button>
          </div>

          {/* CLI snippet */}
          <div
            className="mt-8 w-full max-w-md rounded-lg p-3 flex items-center justify-between shadow-inner"
            style={{ background: '#080f17', border: '1px solid #232a34' }}
          >
            <div className="flex items-center gap-2 overflow-x-auto">
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4cd7f6', userSelect: 'none', flexShrink: 0 }}>$</span>
              <span
                id="cli-command"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#dce3f0', whiteSpace: 'nowrap' }}
              >
                {CLI_COMMAND}
              </span>
            </div>
            <button
              id="copy-cli-btn"
              onClick={handleCliCopy}
              className="p-1.5 rounded transition-colors shrink-0 ml-2"
              style={{ color: cliCopied ? '#4edea3' : '#bcc9cd' }}
              onMouseEnter={(e) => { if (!cliCopied) e.currentTarget.style.color = '#4cd7f6' }}
              onMouseLeave={(e) => { if (!cliCopied) e.currentTarget.style.color = '#bcc9cd' }}
              aria-label="Copy CLI command"
            >
              {cliCopied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
