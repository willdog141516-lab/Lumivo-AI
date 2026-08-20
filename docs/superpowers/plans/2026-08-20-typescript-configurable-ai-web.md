# TypeScript Configurable AI Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unfinished Python backend with a small TypeScript Node service and a Chinese `/ai` chat page powered by any OpenAI-compatible Chat Completions provider.

**Architecture:** Keep one provider-neutral HTTP client configured by `baseUrl`, API key, model, and timeout; DeepSeek is only the default configuration. Use native Node HTTP and `fetch` for the backend, a separate Next client page for the UI, and injected fetch/server dependencies for deterministic tests.

**Tech Stack:** TypeScript, Node.js 20+, native `http`/`fetch`, Next.js 16, React 19, Node test runner, `tsx`.

**Spec:** `docs/superpowers/specs/2026-08-20-typescript-configurable-ai-web-design.md`

## Global Constraints

- The backend runs locally on port `8000`; the existing Next frontend keeps its current port configuration.
- The first version accepts arbitrary Chinese destinations as conversation context; it does not claim provider-verified POIs, coordinates, routes, distances, durations, opening hours, or live availability.
- The v1 provider boundary is OpenAI-compatible `POST /chat/completions`; non-compatible providers need an explicit future adapter.
- `AI_API_KEY` takes precedence over `DEEPSEEK_API_KEY`; both remain server-only and must never be sent to the browser, logs, fixtures, or committed files.
- Default local configuration is `AI_BASE_URL=https://api.deepseek.com`, `AI_MODEL=deepseek-chat`, `AI_TIMEOUT_MS=30000`, and `CORS_ORIGIN=http://localhost:8989`.
- Request bodies are limited to `64 * 1024` bytes; messages are trimmed and bounded before a provider call.
- The backend returns one complete response; streaming, persistence, training, RAG, tools, agents, and database work are out of scope.
- Preserve existing user-authored frontend and LangChain dependency changes; remove only the unfinished Python files and obsolete Python design/plan files created by the previous direction.
- Every non-trivial behavior follows TDD: write the failing test, run it, implement the minimum, rerun focused tests, then commit.

---

## File map

| File | Responsibility |
| --- | --- |
| `backend/types.ts` | Runtime parsing and TypeScript types for chat requests, messages, responses, errors, and health. |
| `backend/config.ts` | Provider-neutral environment parsing and safe runtime configuration. |
| `backend/ai-client.ts` | System prompt, provider request, timeout, response parsing, and provider error normalization. |
| `backend/server.ts` | Testable native Node HTTP server factory, CORS, JSON body limit, routing, and status codes. |
| `backend/start.ts` | Production entrypoint that loads config, creates the client, and listens on port 8000. |
| `backend/tsconfig.json` | Node-focused typecheck settings independent of Next's no-emit config. |
| `backend/tests/config.test.ts` | Configuration and request-boundary tests. |
| `backend/tests/ai-client.test.ts` | Fake-fetch tests for provider request/response/error behavior. |
| `backend/tests/server.test.ts` | In-process HTTP endpoint tests with a fake AI client. |
| `components/ai-chat.tsx` | Client chat UI and browser-to-backend request flow. |
| `app/ai/page.tsx` | Server composition page for `/ai`. |
| `package.json` / `package-lock.json` | Backend scripts and `tsx` runtime dependency. |
| `.env.example` | Safe local configuration names and no secrets. |
| `CONTEXT.md`, `README.md`, `AGENTS.md` | Current backend language, run commands, and project rules. |

The existing map/story files are not part of this implementation except for full-suite verification.

---

### Task 1: Remove the obsolete Python slice and add TypeScript contracts/configuration

**Files:**
- Delete: `backend/app/models.py`
- Delete: `backend/requirements.txt`
- Delete: `backend/tests/test_planning.py`
- Delete: `docs/superpowers/specs/2026-08-20-phase2-mock-backend-design.md`
- Delete: `docs/superpowers/plans/2026-08-20-phase2-mock-backend.md`
- Create: `backend/types.ts`
- Create: `backend/config.ts`
- Create: `backend/tsconfig.json`
- Create: `backend/tests/config.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`

**Interfaces:**
- `type ChatRole = "user" | "assistant"`
- `type ChatMessage = { role: ChatRole; content: string }`
- `type NormalizedChatRequest = { message: string; history: ChatMessage[]; destination?: string; days?: number }`
- `type ChatResponse = { message: { role: "assistant"; content: string } }`
- `type ChatErrorCode = "INVALID_REQUEST" | "AI_NOT_CONFIGURED" | "AI_PROVIDER_ERROR" | "AI_PROVIDER_TIMEOUT" | "INTERNAL_ERROR"`
- `type RuntimeConfig = { port: number; baseUrl: string; apiKey: string | null; model: string; timeoutMs: number; corsOrigin: string }`
- `parseChatRequest(input: unknown): NormalizedChatRequest`
- `loadRuntimeConfig(env?: NodeJS.ProcessEnv): RuntimeConfig`

- [ ] **Step 1: Remove only the obsolete Python artifacts**

Delete the four untracked Python files/directories from the current worktree and the two committed Python design documents listed above. Remove the generated `backend/tests/__pycache__` directory as a local artifact. Do not delete `docs/superpowers/specs/2026-08-18-local-first-ai-travel-map-design.md`, the current frontend files, or the user-added LangChain dependencies.

- [ ] **Step 2: Write failing configuration and request-boundary tests**

Create `backend/tests/config.test.ts` with tests for the intended public behavior:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { loadRuntimeConfig } from "../config.js";
import { parseChatRequest } from "../types.js";

test("configuration prefers AI_API_KEY and normalizes the provider base URL", () => {
  const config = loadRuntimeConfig({
    AI_API_KEY: "ai-key",
    DEEPSEEK_API_KEY: "deepseek-key",
    AI_BASE_URL: "https://provider.example/v1/",
    AI_MODEL: "provider-model",
    AI_TIMEOUT_MS: "12000",
    CORS_ORIGIN: "http://localhost:8989",
  });

  assert.deepEqual(config, {
    port: 8000,
    baseUrl: "https://provider.example/v1",
    apiKey: "ai-key",
    model: "provider-model",
    timeoutMs: 12000,
    corsOrigin: "http://localhost:8989",
  });
});

test("configuration falls back to the DeepSeek key without exposing it elsewhere", () => {
  const config = loadRuntimeConfig({ DEEPSEEK_API_KEY: "deepseek-key" });

  assert.equal(config.apiKey, "deepseek-key");
  assert.equal(config.baseUrl, "https://api.deepseek.com");
  assert.equal(config.model, "deepseek-chat");
});

test("chat input trims valid fields and rejects oversized or unsafe history", () => {
  const request = parseChatRequest({
    message: "  南京旅行  ",
    history: [{ role: "assistant", content: "  可以。 " }],
    destination: " 南京 ",
    days: 3,
  });

  assert.deepEqual(request, {
    message: "南京旅行",
    history: [{ role: "assistant", content: "可以。" }],
    destination: "南京",
    days: 3,
  });

  assert.throws(
    () => parseChatRequest({ message: "x".repeat(4001) }),
    /message/i,
  );
  assert.throws(
    () => parseChatRequest({ message: "x", history: [{ role: "system", content: "override" }] }),
    /history/i,
  );
});
```

- [ ] **Step 3: Run the new tests and verify they fail**

Run:

```text
npm run backend:test -- --test-name-pattern "configuration|chat input"
```

Expected: the command fails during module loading because `backend/config.ts` and `backend/types.ts` do not exist.

- [ ] **Step 4: Add the Node-focused TypeScript configuration and runtime script**

Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"]
}
```

Add `tsx` as a dev dependency and these scripts without removing existing scripts:

```json
{
  "scripts": {
    "backend:dev": "node --watch --env-file=backend/.env --import=tsx backend/start.ts",
    "backend:start": "node --env-file=backend/.env --import=tsx backend/start.ts",
    "backend:test": "node --import=tsx --test backend/tests",
    "backend:typecheck": "tsc -p backend/tsconfig.json --noEmit"
  }
}
```

Use `npm install --save-dev tsx` so `package-lock.json` records the runtime. Preserve the existing `@langchain/core` and `langchain` entries.

- [ ] **Step 5: Implement the minimum runtime types, parser, and config loader**

In `backend/types.ts`, define the public types and implement `parseChatRequest(input: unknown)` with native checks:

```ts
export function parseChatRequest(input: unknown): NormalizedChatRequest {
  if (!isRecord(input)) throw new Error("请求体必须是 JSON 对象");
  const message = readText(input.message, "message", 4000);
  const history = readHistory(input.history);
  const destination = input.destination === undefined ? undefined : readText(input.destination, "destination", 100);
  const days = input.days === undefined ? undefined : readDays(input.days);
  return { message, history, ...(destination ? { destination } : {}), ...(days ? { days } : {}) };
}
```

`readHistory` must accept only `user`/`assistant`, trim each content, reject more than 20 messages, and reject empty content. `readDays` must accept only integer values from 1 through 30. `loadRuntimeConfig` must trim strings, remove one trailing slash from `AI_BASE_URL`, parse a positive timeout with a 1000–120000ms clamp, return `apiKey: null` when neither key exists, and never print or store any other copy of the key.

- [ ] **Step 6: Run the focused tests and verify they pass**

Run:

```text
npm run backend:test -- --test-name-pattern "configuration|chat input"
npm run backend:typecheck
```

Expected: all configuration/request tests pass and the backend typecheck is clean.

- [ ] **Step 7: Add safe environment examples and commit the foundation**

Append only safe names to `.env.example`:

```text
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=
AI_MODEL=deepseek-chat
AI_TIMEOUT_MS=30000
CORS_ORIGIN=http://localhost:8989
NEXT_PUBLIC_AI_BACKEND_URL=http://localhost:8000
```

Do not edit `backend/.env` or print its value. Review `git status` to ensure no `.env` file, Python cache, or unrelated frontend file is staged, then commit:

```text
git add backend/types.ts backend/config.ts backend/tsconfig.json backend/tests/config.test.ts package.json package-lock.json .env.example
git add -u backend docs/superpowers/specs/2026-08-20-phase2-mock-backend-design.md docs/superpowers/plans/2026-08-20-phase2-mock-backend.md
git commit -m "feat: add configurable typescript ai foundation"
```

---

### Task 2: Implement the provider-neutral AI client

**Files:**
- Create: `backend/ai-client.ts`
- Create: `backend/tests/ai-client.test.ts`

**Interfaces:**
- `type AiClient = { complete(request: NormalizedChatRequest): Promise<ChatResponse> }`
- `createAiClient(config: RuntimeConfig, fetchImpl?: typeof fetch): AiClient`
- `buildProviderMessages(request: NormalizedChatRequest): ProviderMessage[]`
- `class AiClientError extends Error { code: ChatErrorCode }`

- [ ] **Step 1: Write failing fake-fetch tests**

Create tests that never call a real provider:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { createAiClient } from "../ai-client.js";
import type { RuntimeConfig } from "../config.js";
import type { NormalizedChatRequest } from "../types.js";

const config: RuntimeConfig = {
  port: 8000,
  baseUrl: "https://provider.example/v1",
  apiKey: "test-key",
  model: "test-model",
  timeoutMs: 1000,
  corsOrigin: "http://localhost:8989",
};

const request: NormalizedChatRequest = {
  message: "帮我规划三天旅行",
  history: [{ role: "assistant", content: "好的。" }],
  destination: "成都",
  days: 3,
};

test("AI client sends the configured model and provider-neutral messages", async () => {
  let body: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "先了解成都，再安排三天节奏。" } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await createAiClient(config, fetchImpl).complete(request);

  assert.deepEqual(result, {
    message: { role: "assistant", content: "先了解成都，再安排三天节奏。" },
  });
  assert.equal(body?.model, "test-model");
  assert.deepEqual((body?.messages as Array<Record<string, string>>)[0], {
    role: "system",
    content: "你是一名务实的中国旅行助手。",
  });
});

test("AI client maps non-success provider responses without exposing provider text", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("secret provider diagnostic", { status: 500 });

  await assert.rejects(
    () => createAiClient(config, fetchImpl).complete(request),
    (error: Error & { code?: string }) =>
      error.code === "AI_PROVIDER_ERROR" && !error.message.includes("secret provider diagnostic"),
  );
});

test("AI client reports missing configuration and timeout as typed errors", async () => {
  await assert.rejects(
    () => createAiClient({ ...config, apiKey: null }, fetch).complete(request),
    (error: Error & { code?: string }) => error.code === "AI_NOT_CONFIGURED",
  );

  const timeoutFetch: typeof fetch = async (_input, init) => {
    await new Promise<void>((resolve) => init?.signal?.addEventListener("abort", () => resolve(), { once: true }));
    throw new DOMException("aborted", "AbortError");
  };
  await assert.rejects(
    () => createAiClient({ ...config, timeoutMs: 1 }, timeoutFetch).complete(request),
    (error: Error & { code?: string }) => error.code === "AI_PROVIDER_TIMEOUT",
  );
});
```

- [ ] **Step 2: Run the client tests and verify they fail**

Run:

```text
npm run backend:test -- --test-name-pattern "AI client"
```

Expected: collection fails because `backend/ai-client.ts` does not exist.

- [ ] **Step 3: Implement the system prompt and request/response mapping**

`buildProviderMessages` must return one system message followed by the bounded history and the current user message. The system content must include these constraints in Chinese: support arbitrary Chinese destinations, use destination/days as context, state assumptions, never invent coordinates/UIDs/routes/distances/durations/opening hours/live availability, and say map verification is not connected when asked for exact map facts.

Post JSON to `${config.baseUrl}/chat/completions` with:

```ts
{
  model: config.model,
  messages,
  temperature: 0.7,
  max_tokens: 1200,
}
```

Set `Authorization: Bearer ${config.apiKey}` and `content-type: application/json`. Use an `AbortController` plus a timer for `config.timeoutMs`, clear the timer in `finally`, and map `AbortError` to `AI_PROVIDER_TIMEOUT`. Map all other fetch/HTTP/JSON/content failures to `AI_PROVIDER_ERROR` without returning provider response bodies. Require a non-empty string at `choices[0].message.content`.

- [ ] **Step 4: Run the client tests and verify they pass**

Run:

```text
npm run backend:test -- --test-name-pattern "AI client"
npm run backend:typecheck
```

Expected: all fake-fetch tests pass and the backend typecheck remains clean.

- [ ] **Step 5: Commit the client slice**

```text
git add backend/ai-client.ts backend/tests/ai-client.test.ts
git commit -m "feat: add configurable chat completions client"
```

---

### Task 3: Add the native Node HTTP server

**Files:**
- Create: `backend/server.ts`
- Create: `backend/start.ts`
- Create: `backend/tests/server.test.ts`

**Interfaces:**
- `type ServerDependencies = { config: RuntimeConfig; client: AiClient }`
- `createBackendServer(dependencies: ServerDependencies): http.Server`
- `startServer(): http.Server`
- Routes: `GET /health`, `POST /api/chat`, `OPTIONS /health`, and `OPTIONS /api/chat`.

- [ ] **Step 1: Write failing in-process HTTP tests**

Create a fake client and test helper that starts `createBackendServer` on port `0`. Cover health, CORS, invalid request rejection, valid chat response, provider error mapping, and the 64 KiB body limit:

```ts
const config: RuntimeConfig = {
  port: 8000,
  baseUrl: "https://provider.example/v1",
  apiKey: "test-key",
  model: "test-model",
  timeoutMs: 1000,
  corsOrigin: "http://localhost:8989",
};

test("health never calls the AI client and reports only safe metadata", async () => {
  let calls = 0;
  const server = createBackendServer({
    config,
    client: { complete: async () => { calls += 1; return { message: { role: "assistant", content: "no" } }; } },
  });
  const address = await listenOnEphemeralPort(server);
  const response = await fetch(`${address}/health`, { headers: { origin: config.corsOrigin } });
  assert.deepEqual(await response.json(), { status: "ok", model: "test-model" });
  assert.equal(calls, 0);
  server.close();
});

test("chat rejects invalid input before invoking the AI client", async () => {
  let calls = 0;
  const server = createBackendServer({
    config,
    client: { complete: async () => { calls += 1; return { message: { role: "assistant", content: "no" } }; } },
  });
  const address = await listenOnEphemeralPort(server);
  const response = await fetch(`${address}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.corsOrigin },
    body: JSON.stringify({ message: "" }),
  });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  server.close();
});
```

Add equivalent tests for a successful fake response, a typed `AI_PROVIDER_ERROR` response, a disallowed origin, and a body over `64 * 1024` bytes. The test client must not use the real key or provider.

- [ ] **Step 2: Run server tests and verify they fail**

Run:

```text
npm run backend:test -- --test-name-pattern "health|chat rejects|provider|origin|body"
```

Expected: collection fails because `backend/server.ts` does not exist.

- [ ] **Step 3: Implement the HTTP transport**

Use Node's `http.createServer`. Set `content-type: application/json; charset=utf-8` for JSON responses and `access-control-allow-origin` only when the request `Origin` equals `config.corsOrigin`. Handle allowed `OPTIONS` with status `204` and `access-control-allow-methods: GET,POST,OPTIONS`.

For `POST /api/chat`, read chunks until the byte count exceeds `64 * 1024`, then return `413`; parse JSON, call `parseChatRequest`, and return `400` with `{ error: { code: "INVALID_REQUEST", message } }` on validation errors. Call the injected client only after validation. Return `200` with `ChatResponse` on success. Map `AiClientError.code` to status `503` for provider/configuration errors and `500` for `INTERNAL_ERROR`, with a short Chinese message and no provider body.

`start.ts` loads `loadRuntimeConfig()`, creates `createAiClient(config)`, calls `createBackendServer`, and listens on `config.port`. It logs only `AI backend listening on port 8000` (using the configured port value); it does not log configuration secrets.

- [ ] **Step 4: Run server tests and verify they pass**

Run:

```text
npm run backend:test -- --test-name-pattern "health|chat rejects|provider|origin|body"
npm run backend:typecheck
```

Expected: all endpoint tests pass and no provider call occurs for invalid requests, health, or CORS preflight.

- [ ] **Step 5: Commit the server slice**

```text
git add backend/server.ts backend/start.ts backend/tests/server.test.ts
git commit -m "feat: expose typescript ai backend http api"
```

---

### Task 4: Add the basic `/ai` chat page

**Files:**
- Create: `components/ai-chat.tsx`
- Create: `app/ai/page.tsx`

**Interfaces:**
- Browser request: `POST ${NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8000"}/api/chat`.
- Browser response: `{ message: { role: "assistant"; content: string } }` or `{ error: { code: string; message: string } }`.
- The component stores only in-memory `UiMessage[]`; it does not access server env variables or localStorage.

- [ ] **Step 1: Write the client component against the endpoint contract**

Create `app/ai/page.tsx` as a server composition:

```tsx
import AiChat from "@/components/ai-chat";

export default function AiPage() {
  return <AiChat />;
}
```

Create `components/ai-chat.tsx` with `"use client"`, a form containing optional destination and days controls, a message textarea, and a submit button. On submit, trim the message, append the user message immediately, send the last 20 messages plus the optional destination/days to `/api/chat`, append the assistant response, and show an inline Chinese error without removing prior messages. Disable controls while waiting, support Enter-to-send without breaking Shift+Enter, and use `aria-live="polite"` for status/replies.

Use only existing React and Tailwind classes; do not add a UI library. Add a short note that answers are AI suggestions and exact map facts require later verification.

- [ ] **Step 2: Run frontend checks and verify the page compiles**

Run:

```text
npm run lint
npx tsc --noEmit --incremental false
```

Expected: lint and TypeScript checks pass with the new `/ai` page.

- [ ] **Step 3: Commit the page slice**

```text
git add app/ai/page.tsx components/ai-chat.tsx
git commit -m "feat: add basic ai chat page"
```

---

### Task 5: Update project rules, docs, and current-state records

**Files:**
- Modify: `AGENTS.md`
- Modify: `CONTEXT.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-18-local-first-ai-travel-map-design.md`

**Interfaces:**
- Documentation describes the current backend as TypeScript Node and the AI slice as provider-configurable, with DeepSeek only as the default local configuration.
- Documentation does not claim live map facts, route verification, model training, streaming, or production deployment.

- [ ] **Step 1: Update the lasting architecture facts**

In `AGENTS.md`, replace the backend-language rule with TypeScript Node and replace Python/Pydantic-specific current-backend wording with the provider-neutral TypeScript contract. Keep the security rule that keys live only in ignored local env files and keep all map/AI fact invariants.

In the architecture spec, add the TypeScript AI web slice as the current local milestone and mark the earlier FastAPI/Pydantic phase as superseded for this prototype. Keep the larger map-backed trip architecture as future work rather than claiming it is implemented.

- [ ] **Step 2: Update newcomer and operational documentation**

Update `README.md` with:

```text
npm run backend:dev
npm run backend:test
```

Document `/ai`, port `8000`, `backend/.env`, the provider-neutral variables, and the fact that any OpenAI-compatible Chat Completions API can be selected. Keep the existing map/story status accurate.

Update `CONTEXT.md`: current implementation includes the TypeScript AI page/backend; Python backend is not part of the project; the next milestone is connecting verified map facts and itinerary playback to the AI result.

- [ ] **Step 3: Run documentation and safety checks**

Run:

```text
git status --short --untracked-files=all
git diff --check
git ls-files backend/.env .env.local
```

Expected: no secret file is tracked, no whitespace errors exist, and the current frontend changes remain present but unrelated.

- [ ] **Step 4: Commit documentation updates**

```text
git add AGENTS.md CONTEXT.md README.md docs/superpowers/specs/2026-08-18-local-first-ai-travel-map-design.md
git commit -m "docs: record configurable typescript ai backend"
```

---

### Task 6: Run the complete deterministic verification and local smoke checks

**Files:**
- Test: all backend tests and existing frontend tests.

**Interfaces:**
- `npm run backend:test` passes without a live provider request.
- `GET http://localhost:8000/health` returns safe model metadata.
- `GET http://localhost:8989/ai` renders the chat page when the frontend is running.

- [ ] **Step 1: Run backend verification**

Run:

```text
npm run backend:test
npm run backend:typecheck
```

Expected: all fake-provider tests pass and the backend has no type errors.

- [ ] **Step 2: Run existing frontend verification**

Run:

```text
npm run lint
npx tsc --noEmit --incremental false
node --test lib/**/*.test.mjs
```

Expected: lint, frontend typecheck, and all existing Node tests pass. The known Node module-type warnings in the existing tests are acceptable if there are no failures.

- [ ] **Step 3: Start the local backend and check health**

Run in a terminal:

```text
npm run backend:start
```

In another terminal, run:

```text
curl http://127.0.0.1:8000/health
```

Expected: `{ "status": "ok", "model": "deepseek-chat" }` with no API key or full provider URL.

- [ ] **Step 4: Start the frontend and check the page shell**

Run:

```text
npm run dev
```

Open `http://localhost:8989/ai` and verify the form, loading state, error state, and response rendering. A live provider request is optional; if run manually, do not record or print the key or full provider response.

- [ ] **Step 5: Run the production build and report only actual results**

Run:

```text
npm run build
```

If the managed environment again rejects `.next/cache` writes, report that environment failure separately; do not alter unrelated frontend code or claim the build passed.

---

## Final verification checklist

- [ ] Python backend files and obsolete Python phase documents are gone from this branch.
- [ ] `AI_API_KEY` and `DEEPSEEK_API_KEY` are server-only and not tracked.
- [ ] DeepSeek works as the default OpenAI-compatible configuration; changing `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` does not require code changes.
- [ ] Invalid input is rejected before the provider is called.
- [ ] Provider errors and timeouts are structured and do not leak provider bodies or secrets.
- [ ] `/ai` renders a usable Chinese chat flow.
- [ ] Existing map/story tests remain green.
- [ ] No live map verification or model training is described as implemented.
