import { useState } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileCode,
  GitBranch,
  FlaskConical,
  Brain,
  ShieldCheck,
  Clock,
} from 'lucide-react';

const fetcher = (url: string) => axios.get(url).then(res => res.data);

interface PullRequest {
  id: string;
  repoFullName: string;
  prNumber: number;
  headBranch: string;
  headSha: string;
  sender: string;
}

interface HealJob {
  id: string;
  pullRequest: PullRequest;
  status: 'QUEUED' | 'CLONING' | 'TESTING' | 'DIAGNOSING' | 'VERIFYING' | 'RESOLVED' | 'FAILED';
  attempt: number;
  initialError: string | null;
  appliedDiff: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────

/** Map each DB status to a display label — RESOLVED shown as HEALED */
function getStatusLabel(status: HealJob['status']): string {
  if (status === 'RESOLVED') return 'HEALED';
  return status;
}

/** Distinct icon per stage — no more uniform RefreshCw for everything */
function getStatusIcon(status: HealJob['status'], className = 'w-4 h-4') {
  switch (status) {
    case 'RESOLVED':
      return <CheckCircle className={`${className} text-[#4edea3]`} />;
    case 'FAILED':
      return <XCircle className={`${className} text-rose-400`} />;
    case 'CLONING':
      return <GitBranch className={`${className} text-[#06b6d4] animate-pulse`} />;
    case 'TESTING':
      return <FlaskConical className={`${className} text-amber-400 animate-pulse`} />;
    case 'DIAGNOSING':
      return <Brain className={`${className} text-violet-400 animate-pulse`} />;
    case 'VERIFYING':
      return <ShieldCheck className={`${className} text-[#06b6d4] animate-pulse`} />;
    case 'QUEUED':
    default:
      return <Clock className={`${className} text-[#5c6e73]`} />;
  }
}

function getStatusColor(status: HealJob['status']): string {
  switch (status) {
    case 'RESOLVED':  return 'text-[#4edea3]';
    case 'FAILED':    return 'text-rose-400';
    case 'TESTING':   return 'text-amber-400';
    case 'DIAGNOSING':return 'text-violet-400';
    case 'QUEUED':    return 'text-[#5c6e73]';
    default:          return 'text-[#06b6d4]';
  }
}

// ── Mini-timeline breadcrumb ──────────────────────────────────────────────────

/**
 * 6-step timeline that exactly mirrors the DB state machine:
 *   QUEUED → CLONING → TESTING → DIAGNOSING → VERIFYING → HEALED / FAILED
 */
const TIMELINE_STEPS: { label: string; activeStates: HealJob['status'][] }[] = [
  { label: 'Intercepted', activeStates: ['QUEUED','CLONING','TESTING','DIAGNOSING','VERIFYING','RESOLVED','FAILED'] },
  { label: 'Cloning',     activeStates: ['CLONING','TESTING','DIAGNOSING','VERIFYING','RESOLVED','FAILED'] },
  { label: 'Testing',     activeStates: ['TESTING','DIAGNOSING','VERIFYING','RESOLVED','FAILED'] },
  { label: 'Diagnosing',  activeStates: ['DIAGNOSING','VERIFYING','RESOLVED','FAILED'] },
  { label: 'Verifying',   activeStates: ['VERIFYING','RESOLVED','FAILED'] },
  { label: 'Healed',      activeStates: ['RESOLVED'] },
];

function MiniTimeline({ status }: { status: HealJob['status'] }) {
  const isFailed = status === 'FAILED';
  return (
    <div
      className="flex items-center flex-wrap gap-x-1 gap-y-1 text-[12px]"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {TIMELINE_STEPS.map((step, i) => {
        const isActive = step.activeStates.includes(status);
        const isHealedSlot = step.label === 'Healed';
        let color = '#3d494c';
        if (isHealedSlot && isFailed) color = '#f87171';
        else if (isActive) color = isHealedSlot ? '#4edea3' : '#dce3f0';

        return (
          <span key={step.label} className="flex items-center gap-1">
            <span style={{ color }}>
              {isHealedSlot && isFailed ? 'Escalated' : step.label}
            </span>
            {i < TIMELINE_STEPS.length - 1 && (
              <span style={{ color: '#3d494c' }}>›</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ── Unified diff renderer ─────────────────────────────────────────────────────

/**
 * Renders a raw unified git diff with per-line red/green backgrounds,
 * a dedicated symbol column, and cyan @@ hunk headers.
 */
function DiffRenderer({ diff }: { diff: string }) {
  const lines = diff.split('\n');
  return (
    <div
      className="rounded overflow-x-auto"
      style={{
        background: '#0d141d',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '12px',
        lineHeight: '18px',
      }}
    >
      {lines.map((line, i) => {
        let bg = 'transparent';
        let color = '#bcc9cd';
        let sym = ' ';

        if (line.startsWith('+++') || line.startsWith('---')) {
          color = '#869397';
        } else if (line.startsWith('@@')) {
          bg = 'rgba(76,215,246,0.08)';
          color = '#4cd7f6';
        } else if (line.startsWith('+')) {
          bg = 'rgba(27,189,133,0.15)';
          color = '#4edea3';
          sym = '+';
        } else if (line.startsWith('-')) {
          bg = 'rgba(147,0,10,0.25)';
          color = '#ffb4ab';
          sym = '-';
        }

        const isAddDel = sym === '+' || sym === '-';
        const text = isAddDel ? line.slice(1) : line;

        return (
          <div
            key={i}
            className="flex items-start px-2 py-0.5"
            style={{ background: bg, color }}
          >
            <span
              className="w-4 shrink-0 select-none font-bold"
              style={{ color: sym === '+' ? '#4edea3' : sym === '-' ? '#ffb4ab' : 'transparent' }}
            >
              {isAddDel ? sym : ''}
            </span>
            <span className="whitespace-pre overflow-x-auto">{text}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main dashboard component ──────────────────────────────────────────────────

export default function Dashboard() {
  // P0 fix: corrected port from 3000 → 3001 to match .env PORT=3001
  const { data: jobs, error, isLoading } = useSWR<HealJob[]>('/api/jobs', fetcher, {
    refreshInterval: 3000,
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const selectedJob = jobs?.find(j => j.id === selectedJobId);

  return (
    <div
      className="flex h-[calc(100svh-64px)] overflow-hidden bg-[#050505] text-[#dce3f0]"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-80 border-r border-[#1a2224] bg-[#080f17] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#1a2224] flex items-center justify-between">
          <h2 className="text-xs font-medium text-[#bcc9cd] uppercase tracking-wider">
            Intercepted PRs
          </h2>
          {jobs && (
            <span className="text-[11px] text-[#3d494c] font-mono">{jobs.length} jobs</span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {isLoading && (
            <div className="text-sm text-[#7a8c90] p-2">Connecting to GitSuture Engine…</div>
          )}
          {error && (
            <div className="text-sm text-rose-400 p-2">Failed to connect to GitSuture Engine</div>
          )}
          {jobs?.length === 0 && (
            <div className="text-sm text-[#7a8c90] p-2">No PRs intercepted yet.</div>
          )}

          {jobs?.map(job => (
            <button
              key={job.id}
              onClick={() => setSelectedJobId(job.id)}
              className={`w-full text-left p-3 rounded border transition-all ${
                selectedJobId === job.id
                  ? 'bg-[#121b22] border-[#06b6d4]/30 shadow-[0_0_15px_rgba(6,182,212,0.05)]'
                  : 'bg-transparent border-transparent hover:bg-[#0c141a]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="truncate font-medium text-[14px]">
                  {job.pullRequest.repoFullName}#{job.pullRequest.prNumber}
                </div>
                <div className="shrink-0 mt-0.5">
                  {getStatusIcon(job.status)}
                </div>
              </div>
              <div className="text-[12px] mt-1 flex items-center justify-between gap-2">
                <span className={`font-mono text-[11px] font-semibold ${getStatusColor(job.status)}`}>
                  {getStatusLabel(job.status)}
                </span>
                <span className="text-[#7a8c90]">
                  {format(new Date(job.createdAt), 'HH:mm:ss')}
                </span>
              </div>
              <div className="text-[11px] text-[#3d494c] mt-0.5 truncate font-mono">
                {job.pullRequest.headBranch}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main stage ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedJob ? (
          <div className="flex-1 flex items-center justify-center text-[#7a8c90] bg-[#050505]">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#1a2224] mb-4">
                <FileCode className="w-6 h-6 text-[#3d494c]" />
              </div>
              <p>Select a PR to view the diagnostic trace.</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Job header ─────────────────────────────────────────────── */}
            <div className="p-5 border-b border-[#1a2224] bg-[#080f17]/50">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-[#4cd7f6]">
                      {selectedJob.pullRequest.repoFullName}
                    </span>
                    <span>PR #{selectedJob.pullRequest.prNumber}</span>
                    <span className="text-sm font-normal text-[#7a8c90] font-mono">
                      {selectedJob.pullRequest.headSha.substring(0, 7)}
                    </span>
                  </h1>
                  <p className="text-[11px] text-[#3d494c] font-mono mt-1">
                    Job: {selectedJob.id.substring(0, 14)}…
                  </p>
                </div>

                {/* Status badge + attempt counter */}
                <div className="flex items-center gap-2 shrink-0">
                  {selectedJob.attempt > 0 && (
                    <span
                      className="px-2 py-1 rounded text-[11px] font-mono text-[#5c6e73]"
                      style={{ background: '#1a2224', border: '1px solid #232a34' }}
                    >
                      Attempt {selectedJob.attempt}/3
                    </span>
                  )}
                  <div
                    className={`px-3 py-1 rounded border text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${getStatusColor(selectedJob.status)} border-current bg-current/10`}
                  >
                    {getStatusIcon(selectedJob.status, 'w-3.5 h-3.5')}
                    {getStatusLabel(selectedJob.status)}
                  </div>
                </div>
              </div>

              {/* 6-step mini-timeline breadcrumb */}
              <MiniTimeline status={selectedJob.status} />
            </div>

            {/* ── Split pane ─────────────────────────────────────────────── */}
            <div className="flex-1 flex min-h-0">

              {/* Left — Initial Error (Agent 1) */}
              <div className="flex-1 flex flex-col border-r border-[#1a2224] min-w-0 bg-[#050505]">
                <div className="px-4 py-2.5 border-b border-[#1a2224] bg-[#0c141a] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#bcc9cd]">
                      Initial Error
                    </h3>
                    <span className="text-[10px] text-[#3d494c] font-mono">stderr</span>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      background: 'rgba(139,92,246,0.12)',
                      color: '#a78bfa',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <FlaskConical className="w-3 h-3" />
                    Agent 1 · Docker Sandbox
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                  <pre
                    className="text-[12px] leading-relaxed text-rose-200/90 whitespace-pre-wrap break-all"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {selectedJob.initialError || (
                      <span className="text-[#3d494c] italic">
                        {['QUEUED', 'CLONING'].includes(selectedJob.status)
                          ? 'Waiting for Agent 1 to run test suite…'
                          : 'No error trace captured.'}
                      </span>
                    )}
                  </pre>
                </div>
              </div>

              {/* Right — Generated Patch (Agent 2), verified by Agent 3 */}
              <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
                <div className="px-4 py-2.5 border-b border-[#1a2224] bg-[#0c141a] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-[#06b6d4] shrink-0" />
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#bcc9cd]">
                      Generated Patch
                    </h3>
                    {selectedJob.appliedDiff && (
                      <span className="text-[10px] text-[#3d494c] font-mono">unified diff</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        background: 'rgba(139,92,246,0.12)',
                        color: '#a78bfa',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      <Brain className="w-3 h-3" />
                      Agent 2 · Gemini
                    </span>
                    {['VERIFYING', 'RESOLVED'].includes(selectedJob.status) && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
                        style={{
                          background: 'rgba(78,222,163,0.10)',
                          color: '#4edea3',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Agent 3 · Verified
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                  {selectedJob.appliedDiff ? (
                    <DiffRenderer diff={selectedJob.appliedDiff} />
                  ) : (
                    <p
                      className="text-[12px] italic"
                      style={{ fontFamily: "'JetBrains Mono', monospace", color: '#3d494c' }}
                    >
                      {['QUEUED', 'CLONING', 'TESTING'].includes(selectedJob.status)
                        ? 'Waiting for Agent 1 to identify failures…'
                        : selectedJob.status === 'DIAGNOSING'
                          ? 'Agent 2 (Gemini) synthesizing patch…'
                          : 'No patch generated.'}
                    </p>
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a2224; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3d494c; }
      `}</style>
    </div>
  );
}
