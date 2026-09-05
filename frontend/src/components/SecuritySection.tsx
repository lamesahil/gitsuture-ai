import { Fragment } from 'react'
import { ArrowForwardIcon } from './icons'

const PIPELINE_NODES = [
  { icon: AIIcon, label: 'AI Patch', sub: 'Gemini', color: '#d0bcff' },
  { icon: DockerIcon, label: 'Docker Sandbox', sub: 'Isolated Node', color: '#4cd7f6' },
  { icon: TestIcon, label: 'Test Suite', sub: 'Verified in isolated sandbox', color: '#4cd7f6' },
  { icon: SecurityIcon, label: 'Verified Gate', sub: 'Tests verified before commit', color: '#4edea3' },
  { icon: LockIcon, label: 'Signed Commit', sub: 'PR Updated', color: '#4edea3', highlight: true },
]

const SECURITY_CARDS = [
  {
    icon: WifiOffIcon,
    iconColor: '#4cd7f6',
    title: 'Network Disabled',
    body: (
      <>
        Sandbox spins up with{' '}
        <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#4cd7f6' }}>--net none</code>
        . Code cannot phone home or leak keys.
      </>
    ),
  },
  {
    icon: TimerIcon,
    iconColor: '#4cd7f6',
    title: 'Execution Timeout',
    body: (
      <>
        Strict{' '}
        <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#4cd7f6' }}>max_duration: 90s</code>{' '}
        execution cap stops runaway infinite loops or malicious freezes.
      </>
    ),
  },
  {
    icon: MemoryIcon,
    iconColor: '#4cd7f6',
    title: 'Resource Quotas',
    body: 'Capped at 2 CPUs, 2GiB memory, and 4GiB ephemeral storage per isolated task container.',
  },
  {
    icon: CodeBlocksIcon,
    iconColor: '#4edea3',
    title: 'AST Patch Validation',
    body: 'Patches undergo static syntax and linter validation before sandbox compilation begins.',
  },
  {
    icon: EncryptedIcon,
    iconColor: '#4edea3',
    title: 'GitHub App Commits',
    body: 'Updates pushed via configured GitHub App bot with scoped permissions.',
  },
  {
    icon: VisibilityOffIcon,
    iconColor: '#4edea3',
    title: 'Zero Production Access',
    body: 'GitSuture operates strictly on PR branches and cannot push to protected production branches.',
  },
]

export default function SecuritySection() {
  return (
    <section id="security" className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#d0bcff',
          }}
        >
          DEFENSE-IN-DEPTH SECURITY
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
          AI can propose the fix. The sandbox decides whether it works.
        </h2>
        <p
          className="mt-2"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '20px', color: '#bcc9cd' }}
        >
          GitSuture is designed specifically for enterprise compliance, zero exfiltration risk, and strict principle-of-least-privilege operations.
        </p>
      </div>

      {/* Pipeline diagram */}
      <div
        className="p-5 rounded-xl shadow-xl max-w-5xl mx-auto mb-14 overflow-x-auto"
        style={{ background: '#151c25', border: '1px solid #232a34' }}
      >
        <div className="flex items-center justify-between min-w-[700px] gap-2 py-4">
          {PIPELINE_NODES.map((node, i) => {
            const Icon = node.icon
            return (
              <Fragment key={node.label}>
                <div
                  className="flex flex-col items-center text-center p-3 rounded-lg shrink-0"
                  style={{
                    background: node.highlight ? 'rgba(78,222,163,0.1)' : '#232a34',
                    border: node.highlight ? '1px solid rgba(78,222,163,0.3)' : '1px solid #3d494c',
                    minWidth: '128px',
                  }}
                >
                  <Icon color={node.color} />
                  <span
                    className="mt-1 font-semibold"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '11px',
                      color: node.highlight ? node.color : '#dce3f0',
                    }}
                  >
                    {node.label}
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#869397', lineHeight: '16px', marginTop: '2px' }}>
                    {node.sub}
                  </span>
                </div>
                {i < PIPELINE_NODES.length - 1 && (
                  <span style={{ color: '#3d494c', flexShrink: 0 }}>
                    <ArrowForwardIcon />
                  </span>
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* Security cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
        {SECURITY_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className="p-4 rounded-lg shadow-sm"
              style={{ background: '#192029', border: '1px solid #232a34' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon color={card.iconColor} />
                <h4
                  className="font-semibold"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '15px',
                    lineHeight: '22px',
                    letterSpacing: '-0.01em',
                    color: '#dce3f0',
                  }}
                >
                  {card.title}
                </h4>
              </div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: '18px', color: '#bcc9cd' }}>
                {card.body}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Pipeline Icons ───────────────────────────────────────────────────────────

function AIIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" />
    </svg>
  )
}

function DockerIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="11" width="20" height="8" rx="2" />
      <path d="M7 11V7M12 11V7M17 11V7" />
      <path d="M7 7H17" />
    </svg>
  )
}

function TestIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

function SecurityIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function LockIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}

function WifiOffIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
    </svg>
  )
}

function TimerIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <polyline points="12 9 12 13 14.5 13" />
      <path d="M9 3h6M12 3v2" />
    </svg>
  )
}

function MemoryIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="8" y="8" width="8" height="8" />
      <path d="M8 2v2M16 2v2M8 20v2M16 20v2M2 8h2M2 16h2M20 8h2M20 16h2" />
    </svg>
  )
}

function CodeBlocksIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
      <line x1="12" y1="2" x2="12" y2="22" opacity="0.4" />
    </svg>
  )
}

function EncryptedIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="11" width="20" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
      <circle cx="12" cy="16" r="1" fill={color} stroke="none" />
    </svg>
  )
}

function VisibilityOffIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
