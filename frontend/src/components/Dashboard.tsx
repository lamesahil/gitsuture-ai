import React, { useState } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { format } from 'date-fns';
import { RefreshCw, CheckCircle, XCircle, ChevronRight, AlertTriangle, FileCode } from 'lucide-react';

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

const getStatusIcon = (status: HealJob['status']) => {
  if (status === 'RESOLVED') return <CheckCircle className="w-4 h-4 text-[#4edea3]" />;
  if (status === 'FAILED') return <XCircle className="w-4 h-4 text-rose-400" />;
  return <RefreshCw className="w-4 h-4 text-[#06b6d4] animate-spin" />;
};

const getStatusColor = (status: HealJob['status']) => {
  if (status === 'RESOLVED') return 'text-[#4edea3]';
  if (status === 'FAILED') return 'text-rose-400';
  return 'text-[#06b6d4]';
};

export default function Dashboard() {
  const { data: jobs, error, isLoading } = useSWR<HealJob[]>('http://localhost:3000/api/jobs', fetcher, {
    refreshInterval: 3000 // Poll every 3 seconds for live updates
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const selectedJob = jobs?.find(j => j.id === selectedJobId);

  return (
    <div className="flex h-[calc(100svh-64px)] overflow-hidden bg-[#050505] text-[#dce3f0]" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar - Recent Intercepts */}
      <div className="w-80 border-r border-[#1a2224] bg-[#080f17] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#1a2224]">
          <h2 className="text-xs font-medium text-[#bcc9cd] uppercase tracking-wider">Intercepted PRs</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && <div className="text-sm text-[#7a8c90] p-2">Loading jobs...</div>}
          {error && <div className="text-sm text-rose-400 p-2">Failed to connect to GitSuture Engine</div>}
          {jobs?.length === 0 && <div className="text-sm text-[#7a8c90] p-2">No PRs intercepted yet.</div>}
          
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
              <div className="text-[12px] text-[#7a8c90] mt-1 flex items-center justify-between">
                <span className="truncate max-w-[120px]">{job.pullRequest.headBranch}</span>
                <span>{format(new Date(job.createdAt), 'HH:mm:ss')}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Stage */}
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
            {/* Header / Minimal Timeline */}
            <div className="p-6 border-b border-[#1a2224] bg-[#080f17]/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
                    PR #{selectedJob.pullRequest.prNumber}
                    <span className="text-sm font-normal text-[#7a8c90] ml-2 font-mono">
                      {selectedJob.pullRequest.headSha.substring(0, 7)}
                    </span>
                  </h1>
                  <p className="text-sm text-[#7a8c90] font-mono">
                    Job ID: {selectedJob.id}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded border text-xs font-medium uppercase tracking-wider ${getStatusColor(selectedJob.status)} border-current bg-current/10`}>
                  {selectedJob.status}
                </div>
              </div>

              {/* Status Timeline */}
              <div className="flex items-center gap-3 text-[13px] text-[#5c6e73]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <span className={['QUEUED', 'CLONING', 'TESTING', 'DIAGNOSING', 'VERIFYING', 'RESOLVED', 'FAILED'].includes(selectedJob.status) ? 'text-white' : ''}>Failure</span>
                <ChevronRight className="w-4 h-4 text-[#3d494c]" />
                <span className={['DIAGNOSING', 'VERIFYING', 'RESOLVED', 'FAILED'].includes(selectedJob.status) && selectedJob.status !== 'TESTING' ? 'text-white' : ''}>AST Pruning</span>
                <ChevronRight className="w-4 h-4 text-[#3d494c]" />
                <span className={['VERIFYING', 'RESOLVED', 'FAILED'].includes(selectedJob.status) ? 'text-white' : ''}>Patch Validated</span>
                <ChevronRight className="w-4 h-4 text-[#3d494c]" />
                <span className={selectedJob.status === 'RESOLVED' ? 'text-[#4edea3] font-medium' : (selectedJob.status === 'FAILED' ? 'text-rose-400' : '')}>
                  {selectedJob.status === 'FAILED' ? 'Escalated' : 'Pushed'}
                </span>
              </div>
            </div>

            {/* Split View */}
            <div className="flex-1 flex min-h-0">
              {/* Left: Initial Error */}
              <div className="flex-1 flex flex-col border-r border-[#1a2224] min-w-0 bg-[#050505]">
                <div className="px-4 py-3 border-b border-[#1a2224] bg-[#0c141a] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#bcc9cd]">Initial Error (stderr)</h3>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                  <pre className="text-[13px] leading-relaxed text-rose-200/90 whitespace-pre-wrap break-all" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedJob.initialError || 'No error trace captured yet.'}
                  </pre>
                </div>
              </div>

              {/* Right: Applied Diff */}
              <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
                <div className="px-4 py-3 border-b border-[#1a2224] bg-[#0c141a] flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-[#06b6d4]" />
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#bcc9cd]">Generated Patch</h3>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                  <pre className="text-[13px] leading-relaxed text-[#4edea3] whitespace-pre-wrap break-all" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedJob.appliedDiff || 'Waiting for Agent 2 synthesis...'}
                  </pre>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1a2224;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3d494c;
        }
      `}</style>
    </div>
  );
}
