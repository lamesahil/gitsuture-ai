import { useState } from 'react'
import { CopyIcon, CheckIcon, CancelIcon, CheckCircleIcon } from './icons'

const PATCH_TEXT = `--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -41,2 +41,3 @@
-  const token = req.cookies.sessionToken;
-  return await verifyToken(token);
+  const token = req.cookies?.sessionToken;
+  if (!token) throw new AuthenticationError('Missing session token');
+  return await verifyToken(token);`

export default function DiffSection() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(PATCH_TEXT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section id="diff" className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
      {/* Section header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
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
          HIGH FIDELITY DIFF VIEW
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
          Surgical precision. Minimal patch footprint.
        </h2>
        <p
          className="mt-2"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '20px', color: '#bcc9cd' }}
        >
          See the actual diff GitSuture committed to remediate PR #42.
        </p>
      </div>

      <div
        className="max-w-4xl mx-auto rounded-xl overflow-hidden shadow-xl"
        style={{ background: '#192029', border: '1px solid #232a34' }}
      >
        {/* Diff header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: '#232a34', borderBottom: '1px solid #3d494c' }}
        >
          <div className="flex items-center gap-2">
            <FileIcon />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 500, color: '#dce3f0' }}>
              src/auth/session.ts
            </span>
            <span
              className="px-2 py-0.5 rounded"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', background: '#192029', color: '#869397' }}
            >
              TypeScript
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 500 }}>
              <span style={{ color: '#ffb4ab' }}>-2 lines</span>
              <span style={{ color: '#3d494c' }}>•</span>
              <span style={{ color: '#4edea3' }}>+3 lines</span>
            </div>
            <button
              id="copy-diff-btn"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded transition-colors"
              style={{
                background: '#192029',
                color: copied ? '#4edea3' : '#bcc9cd',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                border: '1px solid #3d494c',
              }}
            >
              {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
              <span>{copied ? 'Copied!' : 'Copy Patch'}</span>
            </button>
          </div>
        </div>

        {/* Diff code area */}
        <div
          className="p-2 overflow-x-auto"
          style={{ background: '#0d141d', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', lineHeight: '18px' }}
        >
          {/* Context line */}
          <DiffLine old="40" newNum="40" symbol=" " text="export async function extractSession(req: AuthenticatedRequest) {" type="ctx" />
          {/* Deleted */}
          <DiffLine old="41" symbol="-" text="  const token = req.cookies.sessionToken;" type="del" />
          <DiffLine old="42" symbol="-" text="  return await verifyToken(token);" type="del" />
          {/* Added */}
          <DiffLine newNum="41" symbol="+" text="  const token = req.cookies?.sessionToken;" type="add" />
          <DiffLine newNum="42" symbol="+" text="  if (!token) throw new AuthenticationError('Missing session token');" type="add" />
          <DiffLine newNum="43" symbol="+" text="  return await verifyToken(token);" type="add" />
          {/* Context line */}
          <DiffLine old="43" newNum="44" symbol=" " text="}" type="ctx" />
        </div>

        {/* Before/After test comparison */}
        <div
          className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-3"
          style={{ background: '#192029', borderTop: '1px solid #3d494c' }}
        >
          <div
            className="flex items-center gap-3 p-2 rounded"
            style={{ background: '#151c25' }}
          >
            <CancelIcon color="#ffb4ab" />
            <div className="min-w-0">
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: '#ffb4ab', textTransform: 'uppercase' }}>
                Pre-Suture CI
              </span>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#dce3f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Jest v29.7 • 17 passed, 1 failed
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-3 p-2 rounded"
            style={{ background: '#151c25' }}
          >
            <CheckCircleIcon color="#4edea3" />
            <div className="min-w-0">
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, color: '#4edea3', textTransform: 'uppercase' }}>
                Post-Suture Verified
              </span>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#dce3f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Jest v29.7 • 18 passed, 0 failed (412ms)
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Helper Components ─────────────────────────────────────────────────────────

interface DiffLineProps {
  old?: string
  newNum?: string
  symbol: '+' | '-' | ' '
  text: string
  type: 'add' | 'del' | 'ctx'
}

function DiffLine({ old, newNum, symbol, text, type }: DiffLineProps) {
  const bgColor =
    type === 'del' ? 'rgba(147,0,10,0.2)' : type === 'add' ? 'rgba(27,189,133,0.15)' : 'transparent'
  const textColor =
    type === 'del' ? '#ffb4ab' : type === 'add' ? '#4edea3' : '#bcc9cd'
  const symColor =
    type === 'del' ? '#ffb4ab' : type === 'add' ? '#4edea3' : '#3d494c'

  return (
    <div
      className="flex items-center px-1 py-0.5 rounded"
      style={{ background: bgColor, color: textColor }}
    >
      <span className="w-10 text-right pr-4 select-none" style={{ color: '#3d494c', opacity: type === 'del' ? 0.6 : type === 'add' ? 0.3 : 0.4 }}>
        {old ?? ' '}
      </span>
      <span className="w-10 text-right pr-4 select-none" style={{ color: '#3d494c', opacity: type === 'add' ? 0.6 : type === 'del' ? 0.3 : 0.4 }}>
        {newNum ?? ' '}
      </span>
      <span className="w-4 select-none font-bold" style={{ color: symColor }}>{symbol}</span>
      <span className="pl-4 whitespace-pre">{text}</span>
    </div>
  )
}

function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#869397" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
