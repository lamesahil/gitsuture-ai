
const FOOTER_LINKS = ['Docs', 'Security Whitepaper', 'GitHub Repo', 'Changelog']

export default function Footer() {
  return (
    <footer
      className="w-full relative pt-12 pb-8"
      style={{ background: '#080f17', borderTop: '1px solid #232a34' }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col gap-6">
        {/* Top row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status indicators */}
          <div className="flex flex-wrap items-center gap-5">
            <div
              className="inline-flex items-center gap-2 px-2 py-1 rounded"
              style={{ background: '#151c25', border: '1px solid #232a34' }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: '#4edea3' }}
                aria-hidden="true"
              />
              <span
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#4edea3' }}
              >
                Sandbox Engine: Operational
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <SpeedIcon />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#bcc9cd' }}>
                Mean time to heal: &lt; 42s
              </span>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex flex-wrap items-center gap-5">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="transition-colors"
                style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#bcc9cd' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#dce3f0')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#bcc9cd')}
              >
                {link}
              </a>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #232a34' }} />

        {/* Bottom row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4cd7f6' }}>$</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#bcc9cd' }}>gitsuture</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#3d494c' }}>|</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#bcc9cd' }}>autonomous PR repair</span>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#bcc9cd' }}>
            © 2025 GitSuture. Tests verified before commit.
          </div>
        </div>
      </div>
    </footer>
  )
}

function SpeedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4cd7f6" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
      <path d="M12 12l3-3" />
    </svg>
  )
}
