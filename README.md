# GitSuture

> **Code breaks. GitSuture fixes it.**

GitSuture is an autonomous, three-agent local healing environment. It detects failing tests in a Pull Request, diagnoses the root cause using highly focused Abstract Syntax Tree (AST) code extraction and Gemini 2.5 Flash, generates a structured Unified Git Diff, and rigorously verifies the patch inside an isolated Docker sandbox before pushing the fix.

---

## ✨ What GitSuture Does

GitSuture replaces the manual cycle of pulling a broken branch, deciphering stack traces, and guessing fixes. It executes a strict, automated healing loop:

**Webhook Trigger** → **Job Queued** → **Agent 1 (Test Executor)** → **Agent 2 (Diagnosis & Repair)** → **Agent 3 (Patch & Verification)** → **Verified Result**

> **AI proposes the patch; deterministic execution and verification decide whether it is accepted.**

Crucially, GitSuture **does not blindly trust AI.** Every generated patch must be applied to the local repository and proven to pass the test suite inside a secure Docker sandbox. If the patch fails, GitSuture rolls back the code and retries (up to a strict limit of 3 attempts).

## 🎥 Demo Video

Watch the GitSuture end-to-end demonstration:

[Final YouTube URL pending]

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
* Runs strictly inside an isolated Docker container.
* Captures and multiplexes `stdout` and `stderr` streams.
* Enforces strict resource limits (1 GiB RAM, 1 CPU Core) and a 120-second timeout.
* Network access is entirely disabled during execution to prevent malicious code behavior.

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
5. GitSuture uses GitHub App installation tokens for authenticating clones and commits.
6. **No Personal Access Token (PAT) is required** for the GitHub App healing path.

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

GitSuture is designed with paranoia at its core:
* **Docker Sandboxing:** Untrusted code runs in a highly restricted container (`NetworkDisabled: true`, max 1 GiB RAM).
* **AST Pruning:** By using Babel, we send minimal context to the LLM, reducing the surface area for AI hallucinations.
* **Strict Verification:** No patch is pushed without passing `npm test` first.
* **Guaranteed Rollback:** Failed patches trigger an immediate filesystem restoration.
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

