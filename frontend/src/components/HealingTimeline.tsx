import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  BugIcon,
  CheckCircleIcon,
  CancelIcon,
  LockIcon,
  ReplayIcon,
  SpinIcon,
  SyncIcon,
  VerifiedIcon,
  CommentIcon,
} from './icons'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StageNav {
  id: number
  label: string
  sub: string
  dotColor: string
  activeClass: 'fail' | 'analyze' | 'patch' | 'verify' | 'healed'
}

// ─── Stage Nav Config ─────────────────────────────────────────────────────────

const STAGES: StageNav[] = [
  { id: 0, label: '01 FAIL', sub: 'Exit Code 1', dotColor: '#93000a', activeClass: 'fail' },
  { id: 1, label: '02 ANALYZE', sub: 'AST Context', dotColor: '#4cd7f6', activeClass: 'analyze' },
  { id: 2, label: '03 PATCH', sub: 'AI-Generated Patch', dotColor: '#d0bcff', activeClass: 'patch' },
  { id: 3, label: '04 VERIFY', sub: 'Docker Sandbox', dotColor: '#4cd7f6', activeClass: 'verify' },
  { id: 4, label: '05 HEALED', sub: 'PR Updated', dotColor: '#4edea3', activeClass: 'healed' },
]

// ─── Panel helpers ─────────────────────────────────────────────────────────────

function FailPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold"
            style={{
              background: '#93000a',
              color: '#ffdad6',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.02em',
            }}
          >
            <CancelIcon color="#ffdad6" />
            CI CHECK FAILED
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#ffb4ab' }}>
            Exit Code 1
          </span>
        </div>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#869397' }}>
          Workflow: test-suite.yml #819
        </span>
      </div>

      <div
        className="rounded-lg p-3 overflow-x-auto shadow-inner"
        style={{ background: '#0d141d' }}
      >
        <div className="flex items-center gap-2 mb-2" style={{ color: '#ffb4ab', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600 }}>
          <BugIcon size={15} />
          <span>FAIL: src/auth/session.test.ts &gt; should authenticate valid cookies</span>
        </div>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#bcc9cd', paddingLeft: '16px' }}>
          TypeError: Cannot read properties of undefined (reading 'sessionToken')
        </p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#ffb4ab', paddingLeft: '32px', marginTop: '4px' }}>
          at extractSession (src/auth/session.ts:42:15)
        </p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#869397', paddingLeft: '32px' }}>
          at Object.&lt;anonymous&gt; (src/auth/session.test.ts:18:24)
        </p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#869397', paddingLeft: '32px' }}>
          at Promise.then.completed (node_modules/jest-circus/build/utils.js:298:28)
        </p>
        <div className="mt-3 pt-2 flex items-center justify-between flex-wrap gap-1" style={{ borderTop: '1px solid #232a34', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#bcc9cd' }}>
          <span>Tests: 1 failed, 17 passed, 18 total</span>
          <span style={{ color: '#ffb4ab' }}>Snapshots: 0 failed</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-1 flex-wrap gap-2">
        <span className="flex items-center gap-1.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#4cd7f6' }}>
          <SyncIcon />
          GitSuture daemon intercepted failing check run via webhook webhook_id:wh_89201a
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#869397' }}>10:41:02 UTC</span>
      </div>
    </div>
  )
}

function AnalyzePanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold"
            style={{
              background: '#232a34',
              color: '#4cd7f6',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.02em',
            }}
          >
            <SpinIcon size={13} />
            AST CONTEXT ISOLATION
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4cd7f6' }}>
            3 relevant files indexed
          </span>
        </div>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#869397' }}>
          Container: gitsuture-runner-v3
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {[
          { label: 'Target Function', value: 'extractSession()', sub: 'src/auth/session.ts:38-51', valueColor: '#dce3f0' },
          { label: 'Fault Signature', value: 'Null Dereference', sub: 'AST node: MemberExpression', valueColor: '#d0bcff' },
          { label: 'Sandbox State', value: 'Spooled (420ms)', sub: 'Docker rootless runtime', valueColor: '#4edea3' },
        ].map((card) => (
          <div key={card.label} className="p-2 rounded" style={{ background: '#232a34' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#869397', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
              {card.label}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: card.valueColor, fontWeight: 600 }}>
              {card.value}
            </span>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#3d494c', marginTop: '4px' }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg p-3 shadow-inner" style={{ background: '#0d141d' }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4cd7f6', fontWeight: 500 }}>
          $ gitsuture trace --ast --symbol "req.cookies"
        </p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#dce3f0', paddingLeft: '8px', marginTop: '4px' }}>
          [✓] Graph extracted: 4 callers, 1 null-vulnerable access point identified.
        </p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#dce3f0', paddingLeft: '8px' }}>
          [✓] Context window pruned: 12,410 tokens → 640 surgical tokens.
        </p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4edea3', paddingLeft: '8px' }}>
          [✓] Dispatched to Gemini with deterministic patch prompt.
        </p>
      </div>
    </div>
  )
}

function PatchPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold"
            style={{
              background: '#571bc1',
              color: '#c4abff',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.02em',
            }}
          >
            ✦ AI-GENERATED PATCH
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#d0bcff' }}>
            Context-constrained
          </span>
        </div>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#869397' }}>
          src/auth/session.ts (+3, -2)
        </span>
      </div>

      <div className="rounded-lg overflow-hidden shadow-inner" style={{ background: '#0d141d' }}>
        <div
          className="px-3 py-1.5 flex items-center justify-between"
          style={{ background: '#192029', borderBottom: '1px solid #232a34' }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#869397' }}>
            @@ -41,4 +41,5 @@ export async function extractSession(req: Request)
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#4cd7f6' }}>
            diff.patch
          </span>
        </div>
        <div className="p-2 space-y-0.5">
          {[
            { line: '41', symbol: '-', code: 'const token = req.cookies.sessionToken;', type: 'del' },
            { line: '42', symbol: '-', code: 'return await verifyToken(token);', type: 'del' },
            { line: '41', symbol: '+', code: 'const token = req.cookies?.sessionToken;', type: 'add' },
            { line: '42', symbol: '+', code: "if (!token) throw new AuthenticationError('Missing session token');", type: 'add' },
            { line: '43', symbol: '+', code: 'return await verifyToken(token);', type: 'add' },
          ].map((row, i) => (
            <div
              key={i}
              className="flex items-center px-2 py-0.5 rounded"
              style={{
                background: row.type === 'del' ? 'rgba(147,0,10,0.3)' : 'rgba(27,189,133,0.2)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                color: row.type === 'del' ? '#ffb4ab' : '#4edea3',
              }}
            >
              <span className="w-8 select-none" style={{ color: '#869397' }}>{row.line}</span>
              <span className="w-4 select-none font-bold">{row.symbol}</span>
              <span className="pl-2 whitespace-pre overflow-x-auto">{row.code}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="flex items-center gap-1.5" style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#bcc9cd' }}>
        <VerifiedIcon size={14} />
        AST validation passed: Patch constrained to failure scope and syntax verified.
      </p>
    </div>
  )
}

function VerifyPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold"
            style={{
              background: 'rgba(76,215,246,0.15)',
              color: '#4cd7f6',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.02em',
            }}
          >
            <SpinIcon size={13} />
            SANDBOX VERIFICATION
          </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#dce3f0' }}>
            Running isolated check suite
          </span>
        </div>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#869397' }}>
          Docker: --net none --read-only
        </span>
      </div>

      <div className="rounded-lg p-3 shadow-inner" style={{ background: '#0d141d' }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4cd7f6' }}>
          $ yarn test --ci --testPathPattern="src/auth"
        </p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#bcc9cd', marginTop: '8px' }}>PASS src/auth/session.test.ts</p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#bcc9cd' }}>PASS src/auth/jwt.test.ts</p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#bcc9cd' }}>PASS src/auth/rbac.test.ts</p>

        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#bcc9cd' }}>
            <span>Executing test suites (18 of 18)</span>
            <span style={{ color: '#4edea3' }}>100%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#232a34' }}>
            <div
              className="h-full w-full"
              style={{ background: 'linear-gradient(90deg, #4cd7f6, #4edea3)' }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs pt-2 flex-wrap gap-1" style={{ borderTop: '1px solid #232a34', fontFamily: "'JetBrains Mono', monospace", color: '#4edea3' }}>
          <span>Test Suites: 3 passed, 3 total</span>
          <span>Tests: 18 passed, 18 total • 1.2s</span>
        </div>
      </div>
    </div>
  )
}

function HealedPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-semibold"
            style={{
              background: '#1bbd85',
              color: '#00452e',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.02em',
            }}
          >
            <VerifiedIcon size={13} />
            PULL REQUEST HEALED
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4edea3' }}>
            All 18 checks passing
          </span>
        </div>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#869397' }}>
          Mean repair time: 28.4s
        </span>
      </div>

      <div
        className="rounded-lg p-3 shadow-inner flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        style={{ background: '#0d141d' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(78,222,163,0.15)', color: '#4edea3' }}
          >
            <CheckCircleIcon color="#4edea3" />
          </div>
          <div>
            <h4 style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 600, color: '#dce3f0', margin: 0 }}>
              Patch committed &amp; verified
            </h4>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#bcc9cd', marginTop: '2px' }}>
              Committed by{' '}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4cd7f6' }}>
                gitsuture-bot[bot]
              </span>{' '}
              with verified test execution logs.
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded"
          style={{ background: '#192029', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4edea3' }}
        >
          <LockIcon size={13} />
          <span>Verified Test Run</span>
        </div>
      </div>

      <div
        className="p-3 rounded flex items-center justify-between flex-wrap gap-2"
        style={{ background: '#192029' }}
      >
        <div className="flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#bcc9cd' }}>
          <CommentIcon size={16} />
          <span>Automated PR comment posted with full AST diagnostic logs and test outputs.</span>
        </div>
        <a
          href="#"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#4cd7f6' }}
          className="hover:underline"
        >
          View PR #42 →
        </a>
      </div>
    </div>
  )
}

const PANELS = [FailPanel, AnalyzePanel, PatchPanel, VerifyPanel, HealedPanel]

// ─── Main Component ────────────────────────────────────────────────────────────

export interface HealingTimelineRef {
  startAutoCycle: () => void
}

interface HealingTimelineProps {
  timelineRef: React.RefObject<HealingTimelineRef | null>
}

export default function HealingTimeline({ timelineRef }: HealingTimelineProps) {
  const [activeStage, setActiveStage] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stageRef = useRef(0)

  const clearCycle = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startAutoCycle = useCallback(() => {
    clearCycle()
    stageRef.current = 0
    setActiveStage(0)
    intervalRef.current = setInterval(() => {
      stageRef.current = (stageRef.current + 1) % 5
      setActiveStage(stageRef.current)
    }, 3400)
  }, [clearCycle])

  // Expose startAutoCycle via ref
  useEffect(() => {
    if (timelineRef && 'current' in timelineRef) {
      (timelineRef as React.MutableRefObject<HealingTimelineRef>).current = { startAutoCycle }
    }
  }, [timelineRef, startAutoCycle])

  // Auto-start on mount
  useEffect(() => {
    startAutoCycle()
    return clearCycle
  }, [startAutoCycle, clearCycle])

  function handleStageClick(id: number) {
    clearCycle()
    stageRef.current = id
    setActiveStage(id)
  }

  const ActivePanel = PANELS[activeStage]

  return (
    <div className="mt-12 max-w-5xl mx-auto px-6 lg:px-12 pb-4" id="interactive-demo">
      <div
        className="rounded-xl overflow-hidden shadow-xl"
        style={{ background: '#151c25' }}
      >
        {/* GitHub header bar */}
        <div
          className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
          style={{ background: '#232a34', borderBottom: '1px solid #3d494c' }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(76,215,246,0.1)',
                color: '#4cd7f6',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 500,
              }}
            >
              # 42
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 600, color: '#dce3f0' }}>
              fix: user authentication token validation
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
              style={{
                background: '#192029',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                color: '#bcc9cd',
              }}
            >
              <span style={{ color: '#869397' }}>main</span>
              <span style={{ color: '#bcc9cd' }}>←</span>
              <span style={{ color: '#4cd7f6', fontWeight: 500 }}>auth-session-fix</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#869397' }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
                style={{ background: 'rgba(76,215,246,0.15)', color: '#4cd7f6' }}
              >
                AL
              </span>
              <span>alexander</span>
              <span style={{ color: '#3d494c' }}>@</span>
              <span style={{ color: '#bcc9cd' }}>7f83b2a</span>
            </div>
            <button
              id="replay-btn"
              onClick={startAutoCycle}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded transition-all active:scale-95 shadow-sm"
              style={{
                background: '#192029',
                color: '#4cd7f6',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                border: '1px solid #3d494c',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#4cd7f6'
                e.currentTarget.style.color = '#003640'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#192029'
                e.currentTarget.style.color = '#4cd7f6'
              }}
            >
              <ReplayIcon />
              <span>Replay Healing Loop</span>
            </button>
          </div>
        </div>

        {/* Stage timeline nav */}
        <div
          className="px-5 py-2 grid gap-1 overflow-x-auto"
          style={{
            background: '#192029',
            gridTemplateColumns: 'repeat(5, 1fr)',
            borderBottom: '1px solid #3d494c',
          }}
        >
          {STAGES.map((stage) => {
            const isActive = stage.id === activeStage
            let activeBg = '#192029'
            let activeColor = '#bcc9cd'

            if (isActive) {
              if (stage.id === 0) { activeBg = '#93000a'; activeColor = '#ffdad6' }
              else if (stage.id === 4) { activeBg = '#1bbd85'; activeColor = '#00452e' }
              else { activeBg = 'rgba(76,215,246,0.15)'; activeColor = '#4cd7f6' }
            }

            return (
              <button
                key={stage.id}
                data-stage={stage.id}
                onClick={() => handleStageClick(stage.id)}
                className="py-2 px-2 rounded flex flex-col items-center gap-1 transition-all text-center"
                style={{ background: isActive ? activeBg : '#232a34', color: activeColor }}
              >
                <div className="flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em' }}>
                  {stage.id === 0 && isActive ? (
                    <span className="w-2 h-2 rounded-full animate-ping" style={{ background: '#93000a' }} />
                  ) : (
                    <span className="w-2 h-2 rounded-full" style={{ background: stage.dotColor, opacity: isActive ? 1 : 0.5 }} />
                  )}
                  <span>{stage.label}</span>
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', opacity: 0.8 }}>{stage.sub}</span>
              </button>
            )
          })}
        </div>

        {/* Active panel */}
        <div className="p-5" style={{ background: '#080f17' }}>
          <ActivePanel />
        </div>
      </div>
    </div>
  )
}
