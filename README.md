# GitSuture

> **Code breaks. GitSuture fixes it.**

GitSuture is a three-stage autonomous healing pipeline, with Gemini powering diagnosis and repair. It detects failing tests in a Pull Request, diagnoses the root cause using highly focused Abstract Syntax Tree (AST) code extraction, generates a structured Unified Git Diff, and rigorously verifies the patch inside an isolated Docker sandbox before pushing the fix.

---

## ✨ What GitSuture Does

GitSuture replaces the manual cycle of pulling a broken branch, deciphering stack traces, and guessing fixes. It executes a strict, automated healing loop:

**Webhook Trigger** → **Job Queued** → **Agent 1 (Test Executor)** → **Agent 2 (Diagnosis & Repair)** → **Agent 3 (Patch & Verification)** → **Verified Result**

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

## 🧠 The Solution (3-Agent Architecture)

### Agent 1 — Test Executor (The Sandbox)
* Executes `npm test` safely on the cloned repository.
* Runs inside an isolated Docker container, providing an additional layer of execution isolation.
* Captures and multiplexes `stdout` and `stderr` streams.
* Enforces strict resource limits (1 GiB RAM, 1 CPU Core) and a 120-second timeout.
* Network access is disabled during execution to restrict test behavior.

### Agent 2 — Diagnosis & Repair (The Brain)
* Parses the raw `stderr` stack trace to pinpoint the failing file and line number.
* **AST Pruning:** Uses Babel (`@babel/parser`, `@babel/traverse`) to extract *only* the specific enclosing function/class. It does not feed entire files to the LLM, massively reducing token usage and hallucination risk.
* Sends the focused context to Google's Gemini 2.5 Flash model.
* Enforces a strict `responseSchema` to guarantee structured JSON output containing:
  * `rootCauseAnalysis`
  * `confidenceScore`
  * `filePath`
  * `unifiedDiff`

### Agent 3 — Verification (The Hands)
* Applies the generated Unified Git Diff to the local file system using the `diff` library.
* Triggers Agent 1 to re-run the test suite on the patched code.
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

GitSuture is not an AI chatbot that suggests code snippets for you to copy and paste. It is an end-to-end autonomous engineer. It creates a bounded Execution → Diagnosis → Patch → Verification loop, solving one of the most frustrating aspects of modern CI/CD pipelines natively and securely.

## 👤 Author

* **Author:** Sahil Tiwari
* **GitHub:** [https://github.com/lamesahil/gitsuture-ai](https://github.com/lamesahil/gitsuture-ai)

## 📄 License

MIT License

---

## 🎥 Technical Walkthrough & Demo Evidence

> **Recording Checklist** — Follow this section line-by-line while recording your demo video.
> Every piece of evidence below is grounded in the actual repository, real test output, and existing screenshots.
> Nothing here is fabricated.

---

### 1. Problem & Solution

**WHAT TO SHOW**
Open the GitSuture landing page in a browser. Show the hero headline, the animated 3D network, and the five-step pipeline strip at the top. Then briefly explain the problem.

**WHERE TO FIND IT**
- Running frontend: `http://localhost:5173` (or your deployed URL)
- Screenshot: `docs/screenshots/landing_page.png`

**WHAT TO SAY**
> "Every developer knows this moment. A PR lands, the CI pipeline turns red, and you're context-switching to pull the branch, read a stack trace, guess a fix, and re-run tests. It's repetitive, slow, and blocks the entire team.
>
> GitSuture automates that exact cycle. Code breaks — GitSuture fixes it. Not by suggesting code snippets you copy-paste, but by actually running your tests, diagnosing the failure with focused AI analysis, applying a patch, verifying it inside a sandboxed environment, and writing the fix back to your PR automatically."

**SCREENSHOT / EVIDENCE**

![GitSuture landing page showing the hero headline "Code breaks. GitSuture fixes it." with the 3D abstract healing network and 5-step pipeline breadcrumb](docs/screenshots/landing_page.png)

The hero section shows the live 3D geometric network (React Three Fiber) alongside the pipeline status strip: **01 FAIL → 02 ANALYZE → 03 PATCH → 04 VERIFY → 05 HEALED**.

---

### 2. Three-Stage Healing Pipeline

**WHAT TO SHOW**
Show the architecture diagram from the README (or reproduce it on screen). Walk through the pipeline left to right, clearly identifying which stages are deterministic (execution, verification) and which uses Gemini (diagnosis and repair).

**WHERE TO FIND IT**
- Architecture diagram in this README (the ASCII block starting with `┌────────...`)
- Source files that map to each stage:
  - Stage 1 (deterministic): `src/agents/agent1_tester.ts`
  - Stage 2 (Gemini-powered): `src/agents/agent2_repair.ts`
  - Stage 3 (deterministic): `src/agents/agent3_verify.ts`
  - Orchestrator: `src/core/orchestrator.ts`

**WHAT TO SAY**
> "GitSuture is built as a three-stage autonomous healing pipeline, with Gemini powering diagnosis and repair.
>
> **Stage 1** is entirely deterministic: it clones your PR branch, mounts the code into a Docker container, and runs your test suite. No AI involved — just pure execution.
>
> **Stage 2** is where Gemini enters. The failing output from Stage 1 is passed through an AST pruner to extract only the narrowest relevant code block. That focused context, plus the stack trace, is sent to Gemini 2.5 Flash with a strict JSON response schema — guaranteeing a structured root cause, confidence score, target file, and a unified diff.
>
> **Stage 3** is deterministic again: it applies that diff to the file system and re-runs the Docker sandbox. The patch is only accepted if the test suite passes. If it fails, the file is rolled back. AI proposes; deterministic execution decides."

**SCREENSHOT / EVIDENCE**

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

**WHAT TO SHOW**
Open the three files in the cross-file demo repository in your editor (or show their content on screen). Explain the import chain: test → service → helper. Then show `src/ast/pruner.ts` to demonstrate that GitSuture does not send the whole repository to Gemini — it walks the AST to extract only what is used.

**WHERE TO FIND IT**
- Demo repository: `https://github.com/lamesahil/gitsuture-demo-crossfile`
  - `tests/cart.test.ts` — the failing test file
  - `src/cartService.ts` — imports `discountHelper`
  - `src/discountHelper.ts` — contains the bug
- AST pruner: `src/ast/pruner.ts` — the `extractEnclosingBlock()` function
- AST tests: `tests/ast.test.ts` — 13 passing tests including the cross-file traversal suite

**WHAT TO SAY**
> "Here is the actual code path GitSuture follows in the cross-file demo. `cart.test.ts` calls `calculateTotal` in `cartService.ts`, which in turn calls `applyDiscount` in `discountHelper.ts`.
>
> `discountHelper.ts` contained this intentional bug:
> ```typescript
> return total + percentage; // BUG: adds percentage as flat value
> ```
>
> The key point: GitSuture does not send the entire repository to Gemini. The AST pruner, implemented with Babel's parser and traverse API, walks the import graph starting from the failing line. It extracts the narrowest enclosing function block, then recursively follows local import specifiers up to two levels deep. This reduces the context sent to Gemini from potentially thousands of lines to a few dozen — cutting hallucination risk and token cost."

**SCREENSHOT / EVIDENCE**

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

**WHAT TO SHOW**
Show the diagnostic split-view screenshot. Call out the left pane (Agent 1 failure output) and the right pane (Agent 2 Gemini diff). Point to the confidence score, the root cause text, and the specific line change.

**WHERE TO FIND IT**
- Screenshot: `docs/screenshots/diagnostic_diff.png`
- Agent 2 source: `src/agents/agent2_repair.ts`
- Gemini is called with `responseMimeType: 'application/json'` and `responseSchema` enforcing 4 required fields

**WHAT TO SAY**
> "Here is the actual Agent 2 output from the live cross-file E2E run. On the left you see the raw Jest stack trace captured by Agent 1 from inside the Docker sandbox. On the right you see what Gemini returned.
>
> Gemini identified the root cause and generated a valid unified diff targeting `src/discountHelper.ts`, with 100% confidence. The fix:
> ```diff
> - return total + percentage;
> + return total - (total * percentage / 100);
> ```
> Critically, Gemini is constrained by a `responseSchema` — it cannot return free text or hallucinate a different output structure. The schema enforces `rootCauseAnalysis`, `confidenceScore`, `filePath`, and `unifiedDiff`. If the schema is violated, the repair is rejected."

**SCREENSHOT / EVIDENCE**

![GitSuture diagnostic split-view showing the Jest failure output on the left and the Gemini-generated unified diff on the right fixing the cross-file discount bug, stamped Agent 3 · Verified](docs/screenshots/diagnostic_diff.png)

Left pane: **Agent 1 (Docker Sandbox)** captures the raw Jest failure from `cart.test.ts`.
Right pane: **Agent 2 (Gemini)** generates the correct diff for `discountHelper.ts`, stamped **Agent 3 · Verified** after the second Docker sandbox confirmed `exitCode=0`.

---

### 5. Docker Verification

**WHAT TO SHOW**
Show the terminal output from a real E2E run. Focus on the Agent 1 initial failure, the Agent 3 patch application, and the final verification success line. Then show the Agent 1 container configuration from `src/agents/agent1_tester.ts` to demonstrate the security limits.

**WHERE TO FIND IT**
- Agent 3 source: `src/agents/agent3_verify.ts`
- The verification success log is emitted at line 64 of `agent3_verify.ts`:
  ```typescript
  console.log(`[AGENT3] Verification SUCCESS. Patch is valid.`);
  ```
- Agent 1 resource limits in `src/agents/agent1_tester.ts`:
  ```typescript
  Memory: 1_073_741_824,   // 1 GiB
  NanoCpus: 1_000_000_000, // 1 CPU core
  NetworkDisabled: true,   // no network access
  NetworkMode: 'none',     // belt-and-suspenders
  Binds: [`${localRepoPath}:/workspace:ro`], // read-only mount
  ```
- Live integration tests with real Docker: `tests/agent1.test.ts` — both `dummy-pass` and `dummy-fail` fixtures pass when Docker is available:
  ```
  ✓ Agent 1 Tester - Integration Tests (Live) > should run dummy-pass and capture logs   7629ms
  ✓ Agent 1 Tester - Integration Tests (Live) > should run dummy-fail and capture stack trace  6444ms
  ```

**WHAT TO SAY**
> "Before any GitHub write-back, the generated patch is verified by re-running the test suite inside the same restricted Docker execution environment.
>
> Agent 3 takes the unified diff from Gemini, applies it to the local file, and calls Agent 1 again. Agent 1 spins up a fresh container with network disabled, 1 GiB memory limit, and a read-only volume mount. If `npm test` exits with code 0, the patch is accepted. If it fails, the file is immediately rolled back to its original content.
>
> Only after verification succeeds does GitSuture attempt to write back to GitHub."

**SCREENSHOT / EVIDENCE**

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

**WHAT TO SHOW**
Two sub-sections: A) AI file-path validation, B) Stale-head protection. Show the actual code from `orchestrator.ts` and the unit test output that verifies both behaviors.

**WHERE TO FIND IT**
- Orchestrator source: `src/core/orchestrator.ts` (lines ~295–324 for path validation, lines ~342–345 for stale-head)
- Unit tests: `tests/orchestrator.test.ts`
  - `"should reject unsafe AI file paths (path traversal and absolute paths)"` — PASSING
  - `"should throw and fail if remote head has advanced (stale head protection)"` — PASSING
- Safety tests: `tests/safety.test.ts` — `isPatchSafe()` guard — PASSING

**WHAT TO SAY**
> "GitSuture includes two important write-back protections.
>
> First, AI file-path validation. Gemini may return a file path that is a path traversal attack or absolute system path — for example `../../etc/passwd` or `C:/Windows/System32/file`. The orchestrator resolves the path relative to the work directory and checks whether it would escape the sandbox using Node.js `path.relative`. If the result starts with `..` or is itself absolute, the patch is silently rejected and the attempt is counted against the retry limit.
>
> Second, stale-head protection. Before committing a verified patch, the orchestrator calls the GitHub API to confirm the PR's head SHA matches the SHA the job was started with. If the PR was updated while the healing job was running — meaning someone pushed a new commit — GitSuture refuses to write back the now-outdated patch and marks the job as FAILED.
>
> These are not absolute security boundaries, but they meaningfully reduce the risk of incorrect or harmful write-backs during normal operation."

**SCREENSHOT / EVIDENCE**

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

**WHAT TO SHOW**
Show the GitHub App authentication flow — the scripts in `scripts/` and the auth module in `src/git/`. Explain the dual-path authentication model. **Do not show or paste any private keys, PATs, webhook secrets, installation tokens, or API keys.**

**WHERE TO FIND IT**
- Auth source: `src/git/githubAppAuth.ts` — `resolveAppPrivateKey()` and `isAppAuthConfigured()`
- Auth integration: `src/git/octokit.ts` — `getOctokit(installationId?)` selects App or PAT path
- Auth test script: `scripts/test-github-app-auth.ts`
- Unit tests: `tests/githubAppAuth.test.ts` — 10 passing tests covering PEM resolution, fallback logic, and PAT selection contract

**WHAT TO SAY**
> "GitSuture uses a dual-path GitHub authentication model. The primary path is GitHub App installation token authentication. When a webhook is delivered with an `installation.id` field — which GitHub App deliveries include automatically — the orchestrator exchanges the App's RSA private key for a short-lived installation access token via `@octokit/auth-app`. That token is then used for all git clone, push, and PR comment operations.
>
> When the installation ID is absent — for example, when using a direct PAT-based webhook setup — a Personal Access Token from `GITHUB_TOKEN` is used as the fallback.
>
> The App permissions are scoped to the minimum required: Contents read/write for cloning and pushing, Pull Requests read/write for posting diagnostic comments, and Metadata read-only."

**SCREENSHOT / EVIDENCE**

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

### 8. Developer Workflow / User Benefit

**WHAT TO SHOW**
Show the dashboard screenshot with the HEALED state. Walk through the full timeline visible in the UI. Then briefly explain the practical developer experience.

**WHERE TO FIND IT**
- Screenshot: `docs/screenshots/dashboard_healed.png`
- Frontend: `frontend/src/` (React + Tailwind, live polling of SQLite job state via Express API)

**WHAT TO SAY**
> "From a developer's perspective, the workflow is straightforward. You open a PR. If the tests fail, GitSuture picks up the webhook, clones the branch, runs your test suite inside Docker, and begins the healing process automatically.
>
> You can watch the status in the dashboard — it shows the exact state transition in real time: Intercepted → Cloning → Testing → Diagnosing → Verifying → Healed. Each step is backed by a real database state change in the SQLite HealJob record.
>
> When healing succeeds, two things happen on GitHub: a commit is pushed to your PR branch with the verified fix, and a diagnostic comment is posted to the PR showing the root cause, confidence score, and the unified diff that was applied.
>
> Stale-head protection ensures GitSuture never writes back a patch for an outdated version of your branch — if you pushed a new commit while healing was in progress, the job aborts cleanly."

**SCREENSHOT / EVIDENCE**

![GitSuture dashboard showing a single intercepted PR (lamesahil/gitsuture-demo-crossfile#1) with a green HEALED badge and the full timeline: Intercepted › Cloning › Testing › Diagnosing › Verifying › Healed](docs/screenshots/dashboard_healed.png)

A genuine, clean state captured from the live E2E run. The timeline confirms all six states executed successfully: `QUEUED → CLONING → TESTING → DIAGNOSING → VERIFYING → RESOLVED`.

---

### 9. Future Scope

**WHAT TO SHOW**
Show this section or a simple closing slide with the three realistic future directions. Make clear these are **not currently implemented**.

**WHERE TO FIND IT**
- Existing "Future Improvements" section in this README

**WHAT TO SAY**
> "GitSuture currently supports JavaScript and TypeScript projects using Jest or Vitest. There are three realistic directions for expansion.
>
> First, broader language and framework support — dynamically provisioning Docker images for Python, Go, or Java projects based on the detected project type.
>
> Second, deeper CI integration — writing repair summaries directly into GitHub's Checks API instead of only posting PR comments, which would surface the diagnosis inline in the GitHub UI.
>
> Third, more complex repair strategies — handling multi-file refactors, dependency changes, or type-level errors that require context beyond a single function block.
>
> None of these are implemented today. They represent the natural next phase of development."

**SCREENSHOT / EVIDENCE**
No screenshot needed. Show the Future Improvements section of this README or a simple text slide.

---

### 10. Final

**WHAT TO SHOW**
Return to the landing page hero. Let the camera rest on the headline. Then close with a verbal thank you.

**WHERE TO FIND IT**
- Landing page: `http://localhost:5173` (or your deployed URL)
- Screenshot: `docs/screenshots/landing_page.png`

**WHAT TO SAY**
> "Code breaks."
>
> *(pause)*
>
> "GitSuture fixes it."
>
> *(pause)*
>
> "Thank you."

**SCREENSHOT / EVIDENCE**

Show the hero section of the landing page — the 3D network with the headline centred on screen. No additional evidence needed.

---

## 🎬 Final Demo Recording Order

Use this as your exact recording script. Target minimum **4 minutes**.

| Timecode | Section | What to show |
|---|---|---|
| **0:00 – 0:50** | **Problem + GitSuture intro** | Landing page hero; explain the PR-failure developer pain point; "Code breaks. GitSuture fixes it." |
| **0:50 – 1:00** | **Transition** | Brief pause or screen transition to technical content |
| **1:00 – 1:30** | **Three-Stage Pipeline** | Architecture diagram; identify Stage 1 (deterministic), Stage 2 (Gemini), Stage 3 (deterministic) |
| **1:30 – 2:00** | **AST-Pruned Context** | `cart.test.ts → cartService.ts → discountHelper.ts`; show `src/ast/pruner.ts`; explain token reduction |
| **2:00 – 2:45** | **Live demo** | Dashboard screenshot (HEALED run); diagnostic split-view screenshot; walk through Agent 1 failure → Gemini diff → Agent 3 verification |
| **2:45 – 3:15** | **Docker Verification** | Show terminal output with `[AGENT3] Verification SUCCESS. Patch is valid.`; show container security limits from `agent1_tester.ts` |
| **3:15 – 3:45** | **Safety + GitHub App** | Path traversal rejection code from `orchestrator.ts`; stale-head protection; GitHub App installation token flow |
| **3:45 – 4:10** | **Developer Workflow** | Dashboard HEALED screenshot; explain the PR → heal → write-back flow from the developer's perspective |
| **4:10 – 4:35** | **Future Scope** | Three realistic future directions (language support, Checks API, complex repairs) |
| **4:35 – 4:50** | **Closing** | Return to landing page hero; "Code breaks. GitSuture fixes it." → "Thank you." |

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

## 📸 Evidence Files to Capture for Recording

The three screenshots already exist in `docs/screenshots/`:

| File | Used in section |
|---|---|
| `docs/screenshots/landing_page.png` | Sections 1, 10 |
| `docs/screenshots/dashboard_healed.png` | Sections 8 |
| `docs/screenshots/diagnostic_diff.png` | Section 4 |

**Additional captures to make before recording (not yet available as static files):**

| What to capture | Where to find it | Used in section |
|---|---|---|
| Terminal output with `[AGENT3] Verification SUCCESS. Patch is valid.` | Run `npm run test:app-webhook-e2e` against live repo, or show from a saved terminal session | Section 5 |
| `src/agents/agent1_tester.ts` open in editor showing the HostConfig security limits | Open in VS Code | Section 5 |
| `src/core/orchestrator.ts` lines 295–310 (path traversal rejection) | Open in VS Code | Section 6A |
| `src/core/orchestrator.ts` lines 342–345 (stale-head check) | Open in VS Code | Section 6B |
| `src/ast/pruner.ts` open in editor — the import traversal loop | Open in VS Code | Section 3 |
| Demo repo files: `discountHelper.ts` with the bug, `cartService.ts`, `cart.test.ts` | `https://github.com/lamesahil/gitsuture-demo-crossfile` | Section 3 |
| GitHub PR #1 with the diagnostic comment (root cause + diff) | `https://github.com/lamesahil/gitsuture-demo-crossfile/pull/1` | Section 7 |

MIT License

