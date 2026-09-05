# GITSUTURE_MASTER_SPEC.md

━━━━━━━━━━━━━━━━━━━━
## 1. PRODUCT VISION
━━━━━━━━━━━━━━━━━━━━
**Product Name:** GitSuture
**One-Line Pitch:** An autonomous three-agent local healing environment that intercepts failing tests, diagnoses AST-level bugs, and verifies patches safely before pushing them to GitHub.

**Problem Being Solved:** Developers lose hours context-switching to fix trivial syntax errors, package typos, or minor logical bugs that break Continuous Integration (CI) builds.
**Target Users:** Software Engineers, DevOps Teams, Open-Source Maintainers.
**Core Value Proposition:** Zero-touch bug resolution. It doesn't just suggest code; it runs it.
**What Makes It Different:** Unlike standard AI PR reviewers that just drop comments, GitSuture uses an isolated Docker sandbox to safely execute and verify AI-generated patches before they are committed. 
**Winning Angle:** The required three-agent healing loop is the core engine; the GitHub App integration operationalizes it for the real world.

━━━━━━━━━━━━━━━━━━━━
## 2. OFFICIAL PS #07 REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━
**Explicit Problem Statement Requirements:**
*   Event-driven local development environment.
*   Agent 1: Executes unit tests on code changes.
*   Agent 2: Intercepts stack trace, diagnoses error, rewrites offending lines.
*   Agent 3: Re-runs tests to verify the fix.
*   Output: A clean visual diagnostic trace mapping failure, reasoning, and correction.

**Our Proposed Enhancement:**
*   **AST Context Pruning:** We do not feed entire files to the LLM. We parse the AST to extract only the failing function block, which reduces unnecessary context and improves patch reliability.
*   **Production GitHub Integration:** We wrap the required local multi-agent loop in a production GitHub Webhook architecture. 

━━━━━━━━━━━━━━━━━━━━
## 3. COMPLETE USER JOURNEY
━━━━━━━━━━━━━━━━━━━━
1. **Trigger:** Developer pushes a commit to a PR.
2. **Ingestion:** GitHub webhook hits the local server.
3. **Execution (Agent 1):** Clones code into an isolated Docker container and runs tests.
4. **Failure Detection:** Test fails. Exit code 1. `stderr` captured.
5. **Diagnosis (Agent 2):** Parses stack trace, extracts AST node, and passes it to Gemini.
6. **Patch Generation:** Gemini outputs a strict Unified Diff patch.
7. **Application:** System applies the `.patch` locally.
8. **Verification (Agent 3):** Re-runs the sandbox tests.
9. **GitHub Update:** Tests pass (Exit 0) -> Signed commit pushed to PR.
10. **Visual Trace:** Frontend updates via REST polling.

━━━━━━━━━━━━━━━━━━━━
## 4. FINAL ARCHITECTURE
━━━━━━━━━━━━━━━━━━━━
The core engine is the local multi-agent healing loop. The GitHub integration acts as the outer operational shell.

              GitHub PR
                  ↓
            Webhook / Local
                  ↓
        ┌────────────────────┐
        │     AGENT 1        │
        │   TEST EXECUTOR    │
        └─────────┬──────────┘
                  ↓
             ❌ FAILURE
                  ↓
        ┌────────────────────┐
        │     AGENT 2        │
        │ DIAGNOSE + REPAIR  │
        │                    │
        │ Stack Trace        │
        │      +             │
        │ AST Context        │
        │      ↓             │
        │ Gemini Patch       │
        └─────────┬──────────┘
                  ↓
             Apply Patch
                  ↓
        ┌────────────────────┐
        │     AGENT 3        │
        │      VERIFY        │
        └─────────┬──────────┘
                  ↓
             Run Tests
             /       \
          FAIL       PASS
           ↓           ↓
       Retry ≤3    VERIFIED
                       ↓
                GitHub Commit
                       ↓
                 Visual Trace

━━━━━━━━━━━━━━━━━━━━
## 5. FINAL TECH STACK
━━━━━━━━━━━━━━━━━━━━
*   **Runtime:** Node.js (v20+) & TypeScript.
*   **API/Webhooks:** Express.js (Core routing).
*   **GitHub Integration:** `octokit` & `@octokit/webhooks`.
*   **AI Engine:** `@google/genai` (Gemini API for Agent 2).
*   **Execution Sandbox:** `dockerode` (Agent 1 & Agent 3 environment control).
*   **Database:** SQLite + Prisma ORM.
*   **AST Parsing:** `@babel/parser` & `@babel/traverse`.
*   **Frontend (Dashboard):** React + Vite + Tailwind CSS + Framer Motion.

━━━━━━━━━━━━━━━━━━━━
## 6. FOLDER STRUCTURE
━━━━━━━━━━━━━━━━━━━━
```text
gitsuture-ai/
├── frontend/                  # React dashboard
├── prisma/
│   └── schema.prisma          # SQLite models
├── src/
│   ├── index.ts               # Server boot
│   ├── server/
│   │   ├── webhooks.ts        # GitHub ingestion
│   │   └── api.ts             # REST endpoints
│   ├── agents/
│   │   ├── agent1_tester.ts   # Sandbox execution & initial run
│   │   ├── agent2_repair.ts   # AST + Gemini inference
│   │   └── agent3_verify.ts   # Patch application & sandbox verification
│   ├── core/
│   │   └── orchestrator.ts    # State machine connecting agents
│   ├── git/
│   │   └── octokit.ts         # GitHub commit pushes
│   └── db/
│       └── client.ts          # Prisma client
└── package.json