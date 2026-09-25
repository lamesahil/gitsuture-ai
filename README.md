# GitSuture

> **Code breaks. GitSuture fixes it.**

GitSuture is a three-stage autonomous healing pipeline, with Gemini powering diagnosis and repair. It detects failing tests in a Pull Request, diagnoses the root cause using highly focused Abstract Syntax Tree (AST) code extraction, generates a structured Unified Git Diff, and rigorously verifies the patch inside an isolated Docker sandbox before pushing the fix.

---

## ✨ What GitSuture Does

GitSuture replaces the manual cycle of pulling a broken branch, deciphering stack traces, and guessing fixes. It executes a strict, automated healing loop:

**Webhook Trigger** → **Job Queued** → **Stage 1 (Test Executor)** → **Stage 2 (Diagnosis & Repair)** → **Stage 3 (Patch & Verification)** → **Verified Result**

> **AI proposes the patch; deterministic execution and verification decide whether it is accepted.**

Crucially, GitSuture **does not blindly trust AI.** Every generated patch must be applied to the local repository and proven to pass the test suite inside a secure Docker sandbox. If the patch fails, GitSuture rolls back the code and retries (up to a strict limit of 3 attempts).

The demo showcases the real GitHub PR self-healing workflow, including:
- GitHub PR / webhook trigger
- Failing test reproduction
- AST-based cross-file context extraction
- Gemini-generated repair
- Docker sandbox verification
- Automated GitHub commit / write-back
- Diagnostic PR comment

## 🎯 The Problem

Debugging failing Pull Requests is a highly repetitive, high-friction process. When a CI pipeline fails, developers must:
1. Context-switch and pull the failing branch locally.
2. Reproduce the failure and inspect the stack trace.
3. Locate the relevant code block amidst hundreds of files.
4. Formulate a fix, apply it, and rerun tests.
5. Repeat until the suite passes.

GitSuture automates this exact workflow, executing it locally and autonomously.

## 🧠 The Solution (Three-Stage Healing Pipeline)

### Stage 1 — Test Executor (The Sandbox)
* Executes `npm test` safely on the cloned repository.
* Runs inside an isolated Docker container, providing an additional layer of execution isolation.
* Captures and multiplexes `stdout` and `stderr` streams.
* Enforces strict resource limits (1 GiB RAM, 1 CPU Core) and a 120-second timeout.
* Network access is disabled during execution to restrict test behavior.

### Stage 2 — Diagnosis & Repair (Gemini-Powered)
* Parses the raw `stderr` stack trace to pinpoint the failing file and line number.
* **AST Pruning:** Uses Babel (`@babel/parser`, `@babel/traverse`) to extract *only* the specific enclosing function/class. It does not feed entire files to the LLM, massively reducing token usage and hallucination risk.
* Sends the focused context to Google's Gemini 2.5 Flash model.
* Enforces a strict `responseSchema` to guarantee structured JSON output containing:
  * `rootCauseAnalysis`
  * `confidenceScore`
  * `filePath`
  * `unifiedDiff`

### Stage 3 — Verification (The Hands)
* Applies the generated Unified Git Diff to the local file system using the `diff` library.
* Triggers Stage 1 to re-run the test suite on the patched code.
* If the test passes (Exit Code 0), returns a `VERIFIED` status.
* If the test fails, it executes a strict rollback to restore the repository to its original state.

## 🔄 Healing State Machine

GitSuture operates on a strict, observable state machine managed by the Orchestrator.

```text
[ QUEUED ]
   ↓
[ CLONING ]
   ↓
[ TESTING ]
   ↓
[ DIAGNOSING ]
   ↓
[ REPAIRING ]
   ↓
[ VERIFYING ]
   ↓
[ RESOLVED ] (or [ ESCALATED ] if max retries reached)
```

**Maximum Retry Limit:** The verification loop is strictly bounded. If Agent 3 fails to verify a patch after 3 attempts, the job is marked as FAILED/ESCALATED to prevent infinite hallucination loops.


## 📦 GitHub App Installation

Installing the GitSuture GitHub App connects your repositories to the healing engine.

**Installation Flow:**
1. User clicks **Install GitHub App**.
2. GitHub asks which account or organization to install on.
3. User chooses **All repositories** or **selected repositories**.
4. GitSuture starts receiving `pull_request` webhooks.
5. GitSuture uses GitHub App installation tokens for authenticating clones and commits as the primary authentication path.
6. A Personal Access Token (PAT) is fully supported as a fallback for users not using the App.

**Required Permissions:**
GitSuture operates with the principle of least privilege.
* **Contents:** Read & Write (To clone the repository and push the verified patch)
* **Pull requests:** Read & Write (To post diagnostic comments)
* **Metadata:** Read-only (Mandatory for all apps)
* **Events:** `pull_request` webhook

> [!IMPORTANT]
> **Hosting Distinction**
> Installing the GitHub App on your repository grants GitSuture permission to monitor and push to it, but **it does not host or start the GitSuture backend**. You must still run the GitSuture backend server (or use a managed deployment) to actually receive the webhooks and execute the Docker sandboxes.

## 🏗️ Architecture

**Workflow:**
GitHub PR → GitHub App webhook → HMAC validation → installation ID → installation access token → clone → Agent 1 test execution → AST context extraction → Agent 2 Gemini diagnosis + unified diff → Docker sandbox verification → Agent 3 → commit + push → PR diagnostic comment



```text
┌────────────────────────────────────────────────────────────┐
│            GITHUB PULL REQUEST (App or PAT webhook)        │
└─┬────────────────────────────────────────────────────────┬─┘
  │ Webhook Payload (HMAC-verified)           Octokit Push │
  │ installation.id (App) or absent (PAT)                  │
  ▼                                                        │
┌──────────────────────────────────────────────────────────┴─┐
│                    GITSUTURE CORE                          │
│                                                            │
│  ┌────────────────┐     ┌───────────────────────────────┐  │
│  │ Express API    │ ──> │ Orchestrator (State Machine)  │  │
│  │ (/api/webhooks)│     └─┬─────────────────────────────┘  │
│  └────────────────┘       │                                │
│       ▲ Auth modes:       ▼                                │
│  ┌────┴──────────────────────────────────────────────────┐ │
│  │ GitHub Auth Layer (src/git/)                          │ │
│  │   App:  installationId → @octokit/auth-app → token   │ │
│  │   PAT:  GITHUB_TOKEN (fallback when no App ID)       │ │
│  └────┬──────────────────────────────────────────────────┘ │
│       │                                                    │
│       ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Agent 1 (Test Executor)                 │  │
│  │ └─ Docker Sandbox (npm test, Exit Code, Stderr)      │  │
│  └─┬────────────────────────────────────────────────────┘  │
│    │ (If Exit Code 1)                                      │
│    ▼                                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Agent 2 (Diagnosis & Repair)             │  │
│  │ ├─ Babel AST Pruner (Extracts local context)         │  │
│  │ └─ Gemini 2.5 API (Structured JSON output)           │  │
│  └─┬────────────────────────────────────────────────────┘  │
│    │ (Unified Git Diff)                                    │
│    ▼                                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Agent 3 (Patch & Verify)               │  │
│  │ ├─ Diff Library (Applies patch)                      │  │
│  │ └─ Loops back to Agent 1 for Verification            │  │
│  └──────────────────────────────────────────────────────┘  │
└─┬────────────────────────────────────────────────────────┬─┘
  │ Read/Write Job State                       Fetch State │
  ▼                                                        │
┌──────────────────┐                     ┌─────────────────┐
│ SQLite Database  │ <── Prisma Client ──> │ React Frontend  │
│   (Jobs, PRs)    │                     │ (Vite + 3D UI)  │
└──────────────────┘                     └─────────────────┘
```

## 🖥️ UI / Dashboard

The frontend is a premium, dark-mode developer tool interface built with React and Tailwind CSS.
* **Live PR Status:** Real-time polling of intercepted PRs and their healing state.
* **Healing Timeline:** Visual steps tracking the Orchestrator's progress.
* **Diagnostic Split-View:** Left pane shows the raw captured stderr; right pane shows the dynamically generated, code-formatted Unified Git Diff.

## 🧊 3D Visualization (Code Healing Field)

GitSuture features a high-end 3D visual layer built with React Three Fiber and Three.js.
* **Aesthetic:** A dark, abstract geometric network representing an intelligent dependency graph.
* **Interaction:** Smooth, expensive-feeling parallax that gently follows the mouse cursor.
* **Accents:** Subtle cyan/teal/green emissive nodes and thin connecting lines that match the GitSuture brand palette.
* **Performance:** The canvas is set to pointer-events: none to never interfere with UI clicks, and includes reduced-motion handling for mobile devices. (Note: This is a visualization layer representing the AI engine, not the engine itself).

## 🛡️ Safety & Reliability

GitSuture is designed with reliability and safety at its core:
* **Docker Isolation:** Untrusted code runs in a restricted container (`NetworkDisabled: true`, max 1 GiB RAM).
* **AST Pruning:** By using Babel, we send minimal context to the LLM, reducing the surface area for AI hallucinations.
* **Strict Verification:** No patch is pushed without passing `npm test` first.
* **Automated Rollback:** Failed patches trigger an immediate filesystem restoration.
* **HMAC Security:** Webhook payloads are verified using SHA-256 signatures via `crypto.timingSafeEqual`.
* **Bounded Retries:** The system physically cannot loop more than 3 times on a single fix.

## 🧰 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, React Three Fiber, Three.js |
| **Backend** | Node.js, TypeScript, Express |
| **AI / LLM** | Google Gemini API (gemini-2.5-flash), `@google/genai` SDK |
| **Execution** | Docker, dockerode |
| **Code Intelligence** | `@babel/parser`, `@babel/traverse` |
| **GitHub Ops** | `@octokit/rest`, `@octokit/auth-app`, `simple-git` |
| **Database** | Prisma, SQLite |
| **Testing** | Vitest (Mock API/Sandbox/Agent isolation tests) |

## 📁 Project Structure

```text
gitsuture-ai/
├── docker/            # Dockerfile configurations for the sandbox
├── frontend/          # React / Vite frontend application
│   ├── public/
│   └── src/
│       ├── components/ # UI components and 3D Scene.tsx
│       └── App.tsx     # Main dashboard and API integration
├── prisma/            # SQLite database schema and migrations
├── scripts/           # Utility scripts (e.g., trigger-mock-webhook.ts)
├── src/               # Backend source code
│   ├── agents/        # Agent 1 (Test), Agent 2 (Repair), Agent 3 (Verify)
│   ├── ast/           # Babel AST pruning engine
│   ├── config/        # Environment validation
│   ├── core/          # Orchestrator (State Machine) and Types
│   ├── db/            # Prisma client instantiation
│   ├── git/           # Octokit and simple-git operations
│   ├── sandbox/       # Dockerode wrapper and limits
│   └── server/        # Express setup, API routes, Webhooks
├── tests/             # Vitest suite (Agent mocks, Health, AST, Orchestrator)
├── .env.example
├── GITSUTURE_MASTER_SPEC.md
├── package.json
└── tsconfig.json
```

## ⚙️ Prerequisites

To run GitSuture locally, you need:
* **Node.js:** v20.0.0 or higher
* **npm:** Package manager
* **Docker Desktop / Engine:** Must be running in the background for Agent 1.
* **Gemini API Key:** From Google AI Studio.

## 🚀 Local Development Setup

Clone the repository:
```bash
git clone https://github.com/lamesahil/gitsuture-ai.git
cd gitsuture-ai
```

Install Backend Dependencies & Setup Database:
```bash
npm install
npx prisma db push
npx prisma generate
```

Install Frontend Dependencies:
```bash
cd frontend
npm install
cd ..
```

## 🚀 Production Deployment (VM)

GitSuture requires a **Virtual Machine or host with access to the Docker daemon** (e.g., Ubuntu on Azure, DigitalOcean, AWS EC2, or Hetzner). Standard PaaS platforms (Vercel, Heroku) are incompatible because Agent 1 requires direct host access to the Docker daemon (`/var/run/docker.sock`) to spawn isolated sandboxes.

**Architecture:**
* Node.js / PM2 for the backend daemon.
* Caddy Reverse Proxy for API routing and static file serving.
* SQLite (`dev.db`) on the VM disk for persistence.

**Manual First-Time Setup on a Fresh Ubuntu VM:**
1. Clone the repository to `/opt/gitsuture`.
2. Run the bootstrap script as root: `sudo bash /opt/gitsuture/scripts/deploy.sh`. This installs Node 20, Docker, Caddy, PM2, and pre-pulls the Agent 1 image.
3. Create your `.env` file in `/opt/gitsuture` using `.env.example` as a template.
4. Copy `Caddyfile.example` to `/etc/caddy/Caddyfile` and replace the placeholder with your actual domain.
5. Reload Caddy (`sudo systemctl reload caddy`).
6. Run `npm install`, `npm run build`, and start the backend: `pm2 start ecosystem.config.js`.

## 🔐 Environment Variables

Create a `.env` file in the root directory. Use `.env.example` as a template:

```env
# Server
PORT=3001

# AI (Required for Agent 2)
GEMINI_API_KEY="your_gemini_api_key_here"

# Database
DATABASE_URL="file:./dev.db"

# GitHub Ops (Required — PAT used for all git operations when App is not configured)
GITHUB_WEBHOOK_SECRET="your_custom_secret_string"
GITHUB_TOKEN="your_personal_access_token_here"

# GitHub App (Optional — enables App installation token auth when all three are set)
# When configured, the App installation token is used instead of the PAT for
# clone, push, and PR comment operations. PAT (GITHUB_TOKEN) remains the fallback.
# GITHUB_APP_ID="123456"
# GITHUB_APP_PRIVATE_KEY_PATH="/path/to/your-app.pem"
# GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

## ▶️ Running Locally

You will need two terminal windows to run the application.

**Terminal 1: Start the Backend**
```bash
# From the root gitsuture-ai directory
npm run dev
```
*(Server will start on port 3001)*

**Terminal 2: Start the Frontend**
```bash
# From the root gitsuture-ai directory
cd frontend
npm run dev
```
*(Frontend will start on port 5173. Open http://localhost:5173 in your browser).*

## 🧪 Testing

The backend is fully tested using Vitest, with HTTP requests and Docker environments heavily mocked to ensure fast, reliable test execution.

To run the test suite:
```bash
npm test
```

**Test Coverage Includes:**
* Webhook HMAC validation.
* AST Extraction logic.
* Agent 2 Gemini prompt formatting (mocked).
* Agent 3 patch application and rollback logic.
* Orchestrator state machine transitions.

## 🎬 End-to-End Demo

To see GitSuture in action, you can route a live GitHub Webhook from a test repository directly to your local backend using Cloudflare Tunnels (`cloudflared`).

### The Verified Flow
When the GitHub PR webhook (`pull_request.synchronize`) is triggered, you can observe the following strict progression in the logs and the UI:

**BROKEN TEST** → **QUEUED** → **CLONING** → **TESTING** → **DIAGNOSING** → **VERIFYING** → **HEALED**

### The REAL Cross-File E2E Demonstration
In our verified E2E run on the demo repository [https://github.com/lamesahil/gitsuture-demo-crossfile](https://github.com/lamesahil/gitsuture-demo-crossfile), a function used across multiple files (`applyDiscount` in `discountHelper.ts`) was intentionally broken:
```typescript
export function applyDiscount(total: number, percentage: number): number {
  // BUG: Accidentally adds the percentage as a flat value instead of calculating and subtracting it.
  return total + percentage;
}
```

During the live flow, the relevant code path crosses `cart.test.ts` → `cartService.ts` → `discountHelper.ts`:
1. **GitHub PR → webhook** triggers the pipeline.
2. **Agent 1 Docker test execution** runs tests inside a secure Docker sandbox and captures the failure in `cart.test.ts`.
3. **AST-based cross-file context extraction** successfully walks the dependency graph from the failing test (`cart.test.ts`) → `cartService.ts` → `discountHelper.ts`.
4. **Gemini diagnosis + unified diff** is generated by Agent 2 with 100% confidence: `return total - (total * percentage / 100);`.
5. **Agent 3 Docker verification** applies the patch to the isolated clone and spins up a fresh Docker sandbox to verify the test suite now passes (`exitCode=0`).
6. **GitHub commit/push + diagnostic PR comment:** The verified commit is automatically pushed to the GitHub PR branch, and a diagnostic markdown comment containing the root cause analysis and diff is posted directly to the PR.

### Try It Locally (Real Webhook)
1. Ensure both the Backend and Frontend are running.
2. Expose your local backend via a secure tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```
3. In a GitHub repository (e.g., a fork of `gitsuture-demo-crossfile`), configure a Webhook pointing to your `cloudflared` URL (`https://<your-tunnel>.trycloudflare.com/api/webhooks/github`) with the content type `application/json` and your `GITHUB_WEBHOOK_SECRET`.
4. Open a PR with a failing test on your repository.
5. Watch your Dashboard (http://localhost:5173). You will see the webhook intercepted and the agents executing the full cross-file healing loop in real-time.

## 📸 Screenshots

### Landing Page — Code Healing Field

![GitSuture landing page showing the hero headline "Code breaks. GitSuture fixes it." with the 3D abstract healing network and 5-step pipeline breadcrumb](docs/screenshots/landing_page.png)

*The hero section features a live 3D geometric network (React Three Fiber) representing GitSuture's intelligent dependency graph, alongside the real-time pipeline status strip: **01 FAIL → 02 ANALYZE → 03 PATCH → 04 VERIFY → 05 HEALED**.*

---

### Dashboard — Live HEALED Run

![GitSuture dashboard showing a single intercepted PR (lamesahil/gitsuture-demo-crossfile#1) with a green HEALED badge and the full timeline: Intercepted › Cloning › Testing › Diagnosing › Verifying › Healed](docs/screenshots/dashboard_healed.png)

*A genuine, clean state captured from the live E2E run. The sidebar shows the intercepted PR on `lamesahil/gitsuture-demo-crossfile`, the status badge reads **HEALED**, and every breadcrumb node in the timeline is lit — confirming the full `QUEUED → CLONING → TESTING → DIAGNOSING → VERIFYING → RESOLVED` state machine executed successfully.*

---

### Diagnostic Split-View — Agent 1 stderr · Agent 2 Patch · Agent 3 Verified

![GitSuture diagnostic split-view showing the Jest failure output on the left and the Gemini-generated unified diff on the right fixing the cross-file discount bug, stamped Agent 3 · Verified](docs/screenshots/diagnostic_diff.png)

*Left pane: **Agent 1 (Docker Sandbox)** captures the raw Jest test failure from `cart.test.ts`. Right pane: **Agent 2 (Gemini)** utilizes AST extraction to generate the correct unified diff for `discountHelper.ts` (`- return total + percentage;` → `+ return total - (total * percentage / 100);`), stamped **Agent 3 · Verified** after the second Docker sandbox run confirmed `exitCode=0`.*

## 🧩 Design Philosophy

GitSuture is built on the philosophy of **Verification over Blind Automation**. LLMs are probabilistic; software engineering requires determinism. By wrapping a generative model (Gemini) inside a deterministic execution sandbox (Docker + AST), we harness the reasoning capabilities of AI while strictly bounding its ability to hallucinate or break working systems.

## 🚧 Known Constraints & Failure Modes

* **Language Support:** Strictly limited to JavaScript/TypeScript projects using Jest or Vitest.
* **AST Extraction Limits:** Highly dynamic or complex JavaScript patterns (e.g., heavy metaprogramming) can reduce AST context extraction quality.
* **Concurrency:** The current orchestrator is strictly designed for single-host execution and manages concurrency internally via in-memory locks. It is not designed for distributed execution across multiple instances.
* **Dependencies:** Docker is strictly required for sandbox verification.
* **Network Constraints:** A public HTTPS backend is required to receive GitHub webhooks.


## 🔮 Future Improvements

* **Expanded AST Context:** Passing sibling files or imported interfaces to Agent 2 for more complex, multi-file refactors.
* **GitHub Checks API Integration:** Writing diagnostic summaries directly into the GitHub PR UI via the Checks API instead of just pushing commits.
* **Multi-Language Sandbox:** Dynamic Docker container provisioning based on the repository's primary language.

## 🏆 Why GitSuture?

GitSuture is not an AI chatbot that suggests code snippets for you to copy and paste. It is an end-to-end autonomous engineer. It creates a bounded Execution → Diagnosis → Patch → Verification loop — a three-stage autonomous healing pipeline, with Gemini powering diagnosis and repair — solving one of the most frustrating aspects of modern CI/CD pipelines natively and securely.

## 🎥 Demo Video

[![Watch the Final Demo](https://img.shields.io/badge/YouTube-Watch%20the%20Final%20Demo-red?style=for-the-badge&logo=youtube)](https://youtu.be/GUT2RXzsYPQ)

🎥 [Watch the Final Demo](https://youtu.be/GUT2RXzsYPQ)

## 👤 Author

* **Author:** Sahil Tiwari
* **GitHub:** [https://github.com/lamesahil/gitsuture-ai](https://github.com/lamesahil/gitsuture-ai)

## 📄 License

MIT License

---

## 🎥 Technical Walkthrough & Demo Evidence

The following sections document the evidence behind each stage of the demo video.

---

### 1. Problem & Solution

**Evidence**

![GitSuture landing page showing the hero headline "Code breaks. GitSuture fixes it." with the 3D abstract healing network and 5-step pipeline breadcrumb](docs/screenshots/landing_page.png)

The hero section shows the live 3D geometric network (React Three Fiber) alongside the pipeline status strip: **01 FAIL → 02 ANALYZE → 03 PATCH → 04 VERIFY → 05 HEALED**.

---

### 2. Three-Stage Healing Pipeline

GitSuture is built as a three-stage autonomous healing pipeline, with Gemini powering diagnosis and repair.

**Stage 1** is entirely deterministic: it clones your PR branch, mounts the code into a Docker container, and runs your test suite. No AI involved — just pure execution.

**Stage 2** is where Gemini enters. The failing output from Stage 1 is passed through an AST pruner to extract only the narrowest relevant code block. That focused context, plus the stack trace, is sent to Gemini 2.5 Flash with a strict JSON response schema — guaranteeing a structured root cause, confidence score, target file, and a unified diff.

**Stage 3** is deterministic again: it applies that diff to the file system and re-runs the Docker sandbox. The patch is only accepted if the test suite passes. If it fails, the file is rolled back. AI proposes; deterministic execution decides.

Source files: `src/agents/agent1_tester.ts` · `src/agents/agent2_repair.ts` · `src/agents/agent3_verify.ts` · `src/core/orchestrator.ts`

**Evidence**

```text
GitHub PR
  → Webhook (HMAC-verified)
  → [Stage 1] Docker sandbox npm test (deterministic)
      → failure captured: stdout + stderr
  → AST pruner extracts narrowest enclosing block + cross-file imports
  → [Stage 2] Gemini 2.5 Flash — structured JSON diagnosis + unified diff
  → [Stage 3] Docker sandbox re-run with patch applied (deterministic)
      → exitCode=0 → VERIFIED
  → git commit + push + PR diagnostic comment
```

State machine managed by `src/core/orchestrator.ts`:
```text
[ QUEUED ] → [ CLONING ] → [ TESTING ] → [ DIAGNOSING ] → [ VERIFYING ] → [ RESOLVED ]
```

---

### 3. AST-Pruned Cross-File Context

GitSuture does not send the entire repository to Gemini. The AST pruner (implemented with Babel's parser and traverse API in `src/ast/pruner.ts`) walks the import graph starting from the failing line. It extracts the narrowest enclosing function block, then recursively follows local import specifiers up to two levels deep.

In the cross-file demo, `cart.test.ts` calls `calculateTotal` in `cartService.ts`, which calls `applyDiscount` in `discountHelper.ts`. The bug was:
```typescript
return total + percentage; // BUG: adds percentage as flat value
```
This reduces the context sent to Gemini from potentially thousands of lines to a few dozen — cutting hallucination risk and token cost.

Demo repository: `https://github.com/lamesahil/gitsuture-demo-crossfile` · AST pruner: `src/ast/pruner.ts` · AST tests: `tests/ast.test.ts` (13 passing)

**Evidence**

The AST pruner cross-file logic (from `src/ast/pruner.ts`, function `extractEnclosingBlock`):
```typescript
// Walks local imports used within the failing block (up to maxDepth=2)
for (const usedId of usedIdentifiers) {
  const importInfo = localImports.get(usedId);
  if (importInfo) {
    const importedContext = extractExportedSymbolFromFile(
      currentFilePath,
      importInfo.source,
      importInfo.importedName,
      1,  // currentDepth
      2,  // maxDepth
      visitedSymbols,
      currentTotalChars
    );
    // Appended as:
    // --- Imported from ./discountHelper ---
    // export function applyDiscount(...) { ... }
  }
}
```

Verified by 13 passing AST tests (`tests/ast.test.ts`), including cross-file traversal, circular dependency handling, and graceful fallback on parse errors.

---

### 4. AI Diagnosis & Repair

Gemini is constrained by a `responseSchema` — it cannot return free text or hallucinate a different output structure. The schema enforces `rootCauseAnalysis`, `confidenceScore`, `filePath`, and `unifiedDiff`. If the schema is violated, the repair is rejected.

From the live cross-file E2E run, Gemini identified the root cause and generated a valid unified diff targeting `src/discountHelper.ts`, with 100% confidence:
```diff
- return total + percentage;
+ return total - (total * percentage / 100);
```

Source: `src/agents/agent2_repair.ts` (called with `responseMimeType: 'application/json'` and strict `responseSchema`)

**Evidence**

![GitSuture diagnostic split-view showing the Jest failure output on the left and the Gemini-generated unified diff on the right fixing the cross-file discount bug, stamped Agent 3 · Verified](docs/screenshots/diagnostic_diff.png)

Left pane: **Agent 1 (Docker Sandbox)** captures the raw Jest failure from `cart.test.ts`.
Right pane: **Agent 2 (Gemini)** generates the correct diff for `discountHelper.ts`, stamped **Agent 3 · Verified** after the second Docker sandbox confirmed `exitCode=0`.

---

### 5. Docker Verification

Before any GitHub write-back, the generated patch is verified by re-running the test suite inside the same restricted Docker execution environment. Stage 3 takes the unified diff from Gemini, applies it to the local file, and calls Stage 1 again with a fresh container.

Agent 1 resource limits (`src/agents/agent1_tester.ts`):
```typescript
Memory: 1_073_741_824,   // 1 GiB
NanoCpus: 1_000_000_000, // 1 CPU core
NetworkDisabled: true,   // no network access
NetworkMode: 'none',     // belt-and-suspenders
Binds: [`${localRepoPath}:/workspace:ro`], // read-only mount
```

Live integration tests: `tests/agent1.test.ts` — both `dummy-pass` and `dummy-fail` fixtures pass when Docker is available.

**Evidence**

From the live E2E run (from `src/agents/agent3_verify.ts` and orchestrator logs):
```
[AGENT1] Starting sandbox. path=... image=node:20-alpine timeout=120000ms
[AGENT1] Container created. id=b920029becb9...
[AGENT1] Container started.
[AGENT1] Execution complete. exitCode=1 timedOut=false durationMs=5501
[AGENT1] Container removed.

[AGENT3] Patch applied locally to src/discountHelper.ts. Verifying...
[AGENT1] Container created. id=...
[AGENT1] Container started.
[AGENT1] Execution complete. exitCode=0 timedOut=false durationMs=...
[AGENT3] Verification SUCCESS. Patch is valid.
```

---

### 6. Safety & Write-Back Protection

GitSuture includes two important write-back protections.

**A — AI file-path validation.** Gemini may return a file path that is a path traversal attack or absolute system path (e.g., `../../etc/passwd`). The orchestrator resolves the path relative to the work directory and checks whether it would escape the sandbox using Node.js `path.relative`. If the result starts with `..` or is itself absolute, the patch is silently rejected and the attempt is counted against the retry limit.

**B — Stale-head protection.** Before committing a verified patch, the orchestrator calls the GitHub API to confirm the PR's head SHA matches the SHA the job was started with. If a new commit was pushed while healing was in progress, GitSuture refuses to write back the now-outdated patch and marks the job as FAILED.

These are not absolute security boundaries, but they meaningfully reduce the risk of incorrect or harmful write-backs during normal operation.

**Evidence**

**A — AI file-path validation** (from `src/core/orchestrator.ts`):
```typescript
const resolvedPath = path.resolve(workDirAbs, repairFilePath);
const relativePath = path.relative(workDirAbs, resolvedPath);

if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
  console.error(`[ORCHESTRATOR] Unsafe patch rejected: Path traversal detected (${repairResult.filePath}).`);
  continue; // count against retry limit
}
```

Test case covering this (from `tests/orchestrator.test.ts`):
```typescript
it('should reject unsafe AI file paths (path traversal and absolute paths)', async () => {
  // Attempt 1: Path Traversal — '../../etc/passwd' → rejected
  // Attempt 2: Absolute Path  — 'C:/etc/passwd'    → rejected
  // Attempt 3: Valid Path     — 'src/nested/valid.ts' → accepted
  expect(agent3Verify.applyAndVerifyPatch).toHaveBeenCalledTimes(1); // only valid path reached Agent 3
});
```

**B — Stale-head protection** (from `src/core/orchestrator.ts`):
```typescript
const remoteSha = await getRemoteHeadSha(event.repoFullName, event.prNumber, event.installationId);
if (remoteSha && remoteSha !== event.headSha) {
  throw new Error(`Stale job: PR head has advanced to ${remoteSha}, but job was for ${event.headSha}`);
}
```

Verified by unit test `"should throw and fail if remote head has advanced"` — when `getRemoteHeadSha` returns a different SHA, `pushSignedCommit` is never called.

---

### 7. GitHub App Integration

GitSuture uses a dual-path GitHub authentication model. The primary path is GitHub App installation token authentication: when a webhook is delivered with an `installation.id` field, the orchestrator exchanges the App's RSA private key for a short-lived installation access token via `@octokit/auth-app`. That token is used for all git clone, push, and PR comment operations.

When the installation ID is absent (direct PAT-based webhook setup), a Personal Access Token from `GITHUB_TOKEN` is used as the fallback. App permissions are scoped to the minimum required: Contents read/write, Pull Requests read/write, and Metadata read-only.

Source: `src/git/githubAppAuth.ts` · `src/git/octokit.ts` · unit tests: `tests/githubAppAuth.test.ts` (10/10 passing)

**Evidence**

Auth selection logic in `src/git/octokit.ts` (conceptually):
```typescript
// App token path: used when installationId is present AND App is configured
if (installationId !== undefined && isAppAuthConfigured()) {
  // Exchange private key → short-lived installation token (ghs_***)
}
// PAT fallback: used when no installationId or App not configured
// Uses GITHUB_TOKEN environment variable
```

Unit test confirming the PAT fallback contract (from `tests/githubAppAuth.test.ts`):
```typescript
it('selects PAT when installationId is undefined (no App delivery)', async () => {
  const useAppAuth = installationId !== undefined && isAppAuthConfigured();
  expect(useAppAuth).toBe(false); // → PAT path selected
});
```

All 10 GitHub App auth unit tests: **PASSING** (`npm test` — 63/63 total).

> **Security note:** The private key is never printed in output. The `scripts/test-github-app-auth.ts` masks all tokens: `maskToken(token)` shows only the first 4 characters. Installation tokens (format: `ghs_***`) are never logged in full anywhere in the codebase.

---

### 8. Developer Workflow

From a developer's perspective, the workflow is: open a PR → if tests fail, GitSuture picks up the webhook, clones the branch, runs tests inside Docker, and begins the healing process automatically.

The dashboard shows the exact state transition in real time: Intercepted → Cloning → Testing → Diagnosing → Verifying → Healed. Each step is backed by a real database state change in the SQLite HealJob record.

When healing succeeds, two things happen on GitHub: a commit is pushed to the PR branch with the verified fix, and a diagnostic comment is posted to the PR showing the root cause, confidence score, and the unified diff that was applied.

Frontend: `frontend/src/` (React + Tailwind, live polling of SQLite job state via Express API)

**Evidence**

![GitSuture dashboard showing a single intercepted PR (lamesahil/gitsuture-demo-crossfile#1) with a green HEALED badge and the full timeline: Intercepted › Cloning › Testing › Diagnosing › Verifying › Healed](docs/screenshots/dashboard_healed.png)

A genuine, clean state captured from the live E2E run. The timeline confirms all six states executed successfully: `QUEUED → CLONING → TESTING → DIAGNOSING → VERIFYING → RESOLVED`.

---

### 9. Future Scope

GitSuture currently supports JavaScript and TypeScript projects using Jest or Vitest. Three realistic directions for expansion (none currently implemented):

1. **Broader language support** — dynamically provisioning Docker images for Python, Go, or Java projects.
2. **Deeper CI integration** — writing repair summaries directly into GitHub's Checks API.
3. **More complex repair strategies** — handling multi-file refactors, dependency changes, or type-level errors.

---

---



## ✅ Final Verification Status

> Captured on branch `final-polish` — working tree clean.

### `npm test` — **63/63 PASSING** ✅

```
Test Files  10 passed (10)
     Tests  63 passed (63)
  Start at  22:03:49
  Duration  24.91s
```

**Test files covered:**
- `tests/agent1.test.ts` — Docker sandbox unit tests (mocked) + live integration tests (`dummy-pass`, `dummy-fail`)
- `tests/agent2.test.ts` — Gemini prompt formatting (mocked AI client)
- `tests/agent3.test.ts` — Patch application and rollback logic
- `tests/ast.test.ts` — AST pruner: 13 tests including cross-file traversal, circular dependency handling, graceful fallback
- `tests/githubAppAuth.test.ts` — 10 tests: PEM resolution, path vs inline key, PAT fallback contract
- `tests/health.test.ts` — `/api/health` endpoint
- `tests/orchestrator.test.ts` — 7 tests: full healing loop, stale-head protection, path traversal rejection, concurrency lock, iterative retry
- `tests/safety.test.ts` — `isPatchSafe()` guard against test file modifications
- `tests/api.test.ts` — REST API
- `tests/webhooks.test.ts` — HMAC verification, event normalization, bot event filtering, idempotency

### `npm run typecheck` — **PASSING (0 errors)** ✅

```
> tsc --project tsconfig.json --noEmit
(exit code 0, no output = clean)
```

### GitHub App auth (`npm run test:app-auth`) — **Requires live credentials**

This script (`scripts/test-github-app-auth.ts`) tests the real GitHub App JWT → installation token exchange. It requires `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_PATH` / `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_APP_INSTALLATION_ID` in `.env`. It cannot be run without valid App credentials. The underlying auth logic is unit-tested in `tests/githubAppAuth.test.ts` (10/10 passing).

### GitHub App E2E (`npm run test:app-e2e`) — **Requires live credentials + running server**

This script (`scripts/test-github-app-git-e2e.ts`) requires live App credentials and a running backend. Not part of the automated `npm test` suite; run manually.

### GitHub App Webhook E2E (`npm run test:app-webhook-e2e`) — **Requires live credentials + running server + network**

This script (`scripts/test-github-app-webhook-e2e.ts`) creates a real branch on `lamesahil/gitsuture-demo-crossfile`, sends a signed webhook to `localhost:3001`, and monitors the full healing loop. Requires all live credentials and a running backend. Not part of the automated `npm test` suite; run manually.

### Git Status

```
On branch final-polish
nothing to commit, working tree clean
```

---

## 📸 Screenshots

The three screenshots are in `docs/screenshots/`:

| File | Section |
|---|---|
| `docs/screenshots/landing_page.png` | Problem & Solution, Final |
| `docs/screenshots/dashboard_healed.png` | Developer Workflow |
| `docs/screenshots/diagnostic_diff.png` | AI Diagnosis & Repair |
