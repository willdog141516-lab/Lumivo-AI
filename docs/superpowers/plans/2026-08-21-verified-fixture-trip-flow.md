# Verified Fixture Trip Flow Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ([ ] / [x]) syntax for tracking.

**Goal:** Connect the existing AI chat to a validated, playable Nanjing fixture result while failing closed for destinations and model output that are not covered by verified data.

**Architecture:** Add one fixture TripPlanner behind the existing AiClient, expose it through POST /api/trips/plan, and return the existing nanjingPlanningResult only when the model selects the exact known fixture schedule. This model call deliberately verifies structured output only; it does not personalize or reorder the fixture. Persist a small fixture identity marker in one focused browser storage module, then hydrate the canonical fixture from that marker on the homepage.

**Tech Stack:** TypeScript, native Node http/fetch, existing Next.js 16 and React 19, Node test runner, tsx, existing lib/trip domain types and fixture.

**Spec:** docs/superpowers/specs/2026-08-21-verified-fixture-trip-flow-design.md

## Global Constraints

- The fixture planner supports exactly 南京/南京市 with 3 days; other Chinese destinations return PLAN_NOT_AVAILABLE without an AI call.
- Recognizable overseas markers return UNSUPPORTED_REGION without an AI call.
- The AI receives fixture UID/name candidates only; it never supplies coordinates, route geometry, distances, durations, opening hours, or POI identity.
- The existing nanjingPlanningResult is the only source of POI, route, narration, TripPlan, and StoryTimeline facts in this slice.
- Invalid provider JSON or selection mismatch returns MODEL_OUTPUT_INVALID; no invalid result reaches StoryPlayer or browser storage.
- The fixture model call is a deliberate structured-output verification seam. It does not make the itinerary preference-sensitive; remove this call rather than pretending otherwise if that verification is no longer required.
- The API key stays in backend/.env; browser code reads only NEXT_PUBLIC_AI_BACKEND_URL.
- Reuse the existing native server, AiClient, parseChatRequest, frontend domain types, and fixture. Do not add Express, a provider factory, a database, a new UI library, or a second map/model abstraction.
- Every non-trivial behavior follows TDD: write the failing test, run it, implement the minimum, rerun focused tests, then commit.
- Preserve existing user-authored frontend changes and existing LangChain dependency entries.

---

## File Map

| File | Responsibility |
| --- | --- |
| backend/types.ts | Add required destination/day parsing for planning requests. |
| backend/trip-planner.ts | Fixture-only planner, candidate prompt, JSON selection parsing, region guard, and selection validation. |
| backend/tests/trip-planner.test.ts | Planner behavior and no-call failure tests. |
| backend/server.ts | Add OPTIONS /api/trips/plan, request parsing, planner invocation, and planner error mapping. |
| backend/start.ts | Construct the fixture planner from the configured AiClient. |
| backend/tests/server.test.ts | Planning endpoint HTTP behavior. |
| lib/trip/local-trip-store.ts | Browser-only fixture marker save/load/clear functions that always hydrate the canonical result. |
| lib/trip/local-trip-store.test.mjs | Fixture-marker validation and corruption tests. |
| components/trip-story-home.tsx | Hydrate stored result into the existing story experience with fixture fallback. |
| components/ai-chat.tsx | Add the plan action and navigate after a successful validated plan. |
| app/page.tsx | Keep server composition while passing the fixture fallback to the client wrapper. |
| CONTEXT.md, README.md, architecture spec | Record the current endpoint and fixture-only boundary. |

---

### Task 1: Add the required planning request contract

**Files:**
- Modify: backend/types.ts
- Modify: backend/tests/config.test.ts

**Interfaces:**
- Consumes: parseChatRequest(input: unknown): NormalizedChatRequest.
- Produces: TripPlanRequest = NormalizedChatRequest & { destination: string; days: number } and parseTripPlanRequest(input: unknown): TripPlanRequest.

- [ ] **Step 1: Write the failing request-contract tests**

Change the existing types import at the top of backend/tests/config.test.ts to `import { parseChatRequest, parseTripPlanRequest } from "../types.js";`, then append this test:

~~~ts
test("trip planning input requires a destination and day count", () => {
  assert.deepEqual(
    parseTripPlanRequest({
      message: "想看历史和老街",
      destination: " 南京市 ",
      days: 3,
      history: [],
    }),
    {
      message: "想看历史和老街",
      destination: "南京市",
      days: 3,
      history: [],
    },
  );

  assert.throws(
    () => parseTripPlanRequest({ message: "规划行程", days: 3 }),
    /destination.*必填/i,
  );
  assert.throws(
    () => parseTripPlanRequest({ message: "规划行程", destination: "南京" }),
    /days.*必填/i,
  );
});
~~~

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

~~~text
npm run backend:test -- --test-name-pattern "trip planning input"
~~~

Expected: collection or execution fails because parseTripPlanRequest is not exported.

- [ ] **Step 3: Implement the minimum parser**

Add this type and function to backend/types.ts after parseChatRequest:

~~~ts
export type TripPlanRequest = NormalizedChatRequest & {
  destination: string;
  days: number;
};

export function parseTripPlanRequest(input: unknown): TripPlanRequest {
  const request = parseChatRequest(input);
  if (!request.destination) {
    throw new Error("destination 必填");
  }
  if (request.days === undefined) {
    throw new Error("days 必填");
  }
  return { ...request, destination: request.destination, days: request.days };
}
~~~

- [ ] **Step 4: Run focused tests and backend typecheck**

Run:

~~~text
npm run backend:test -- --test-name-pattern "configuration|chat input|trip planning input"
npm run backend:typecheck
~~~

Expected: all configuration and planning-request tests pass with no backend type errors.

- [ ] **Step 5: Commit the request contract**

~~~text
git add backend/types.ts backend/tests/config.test.ts
git commit -m "feat: add trip planning request contract"
~~~

---

### Task 2: Implement and test the fixture planner

**Files:**
- Create: backend/trip-planner.ts
- Create: backend/tests/trip-planner.test.ts

**Interfaces:**
- Consumes: AiClient, TripPlanRequest, nanjingTripPlan, and nanjingPlanningResult.
- Produces:

~~~ts
export type PlannerErrorCode =
  | "UNSUPPORTED_REGION"
  | "PLAN_NOT_AVAILABLE"
  | "MODEL_OUTPUT_INVALID";

export class TripPlannerError extends Error {
  constructor(public readonly code: PlannerErrorCode, message: string);
}

export type TripPlanner = {
  plan(request: TripPlanRequest): Promise<PlanningResult>;
};

export type FixtureSelection = {
  days: Array<{ day: number; poiUids: string[] }>;
};

export function createFixtureTripPlanner(client: AiClient): TripPlanner;
export function buildFixtureSelectionPrompt(request: TripPlanRequest): string;
export function parseFixtureSelection(content: string): FixtureSelection;
~~~

- [ ] **Step 1: Write failing planner tests**

Create backend/tests/trip-planner.test.ts:

~~~ts
import assert from "node:assert/strict";
import test from "node:test";

import type { AiClient } from "../ai-client.js";
import { createFixtureTripPlanner, TripPlannerError } from "../trip-planner.js";
import { nanjingPlanningResult, nanjingTripPlan } from "../../lib/trip/nanjing-fixture.js";

function fixtureSelection() {
  return {
    days: nanjingTripPlan.days.map((day) => ({
    day: day.day,
    poiUids: day.stops.map((stop) => stop.poi.uid),
    })),
  };
}

const validSelection = JSON.stringify(fixtureSelection());

function fakeClient(content: string, onCall?: (prompt: string) => void): AiClient {
  return {
    async complete(request) {
      onCall?.(request.message);
      return { message: { role: "assistant", content } };
    },
  };
}

test("fixture planner returns the existing playable result after valid UID selection", async () => {
  let prompt = "";
  const result = await createFixtureTripPlanner(fakeClient(validSelection, (value) => { prompt = value; })).plan({
    message: "想看历史和老街",
    destination: "南京市",
    days: 3,
    history: [],
  });

  assert.deepEqual(result, nanjingPlanningResult);
  assert.match(prompt, /fixture-nanjing-fuzimiao/);
  assert.match(prompt, /夫子庙-秦淮风光带/);
  assert.doesNotMatch(prompt, /118\.7945/);
});

for (const [name, content] of [
  ["malformed JSON", "not-json"],
  ["unknown UID", JSON.stringify({
    days: fixtureSelection().days.map((day) => day.day === 1
      ? { ...day, poiUids: ["unknown", ...day.poiUids.slice(1)] }
      : day),
  })],
  ["duplicate UID", JSON.stringify({
    days: fixtureSelection().days.map((day) => day.day === 1
      ? { ...day, poiUids: [day.poiUids[0], day.poiUids[0], ...day.poiUids.slice(2)] }
      : day),
  })],
  ["missing day", JSON.stringify({ days: fixtureSelection().days.slice(0, -1) })],
  ["wrong schedule", JSON.stringify({
    days: fixtureSelection().days.map((day) => ({ ...day, poiUids: [...day.poiUids].reverse() })),
  })],
] as const) {
  test("fixture planner rejects " + name, async () => {
    await assert.rejects(
      () => createFixtureTripPlanner(fakeClient(content)).plan({
        message: "规划行程",
        destination: "南京",
        days: 3,
        history: [],
      }),
      (error: Error & { code?: string }) =>
        error instanceof TripPlannerError && error.code === "MODEL_OUTPUT_INVALID",
    );
  });
}

test("fixture planner rejects overseas destinations before calling AI", async () => {
  let calls = 0;
  await assert.rejects(
    () => createFixtureTripPlanner(fakeClient(validSelection, () => { calls += 1; })).plan({
      message: "帮我规划巴黎旅行",
      destination: "巴黎",
      days: 3,
      history: [],
    }),
    (error: Error & { code?: string }) => error.code === "UNSUPPORTED_REGION",
  );
  assert.equal(calls, 0);
});

test("fixture planner rejects uncovered China destinations before calling AI", async () => {
  let calls = 0;
  await assert.rejects(
    () => createFixtureTripPlanner(fakeClient(validSelection, () => { calls += 1; })).plan({
      message: "帮我规划成都旅行",
      destination: "成都",
      days: 3,
      history: [],
    }),
    (error: Error & { code?: string }) => error.code === "PLAN_NOT_AVAILABLE",
  );
  assert.equal(calls, 0);
});
~~~

- [ ] **Step 2: Run planner tests and verify they fail**

Run:

~~~text
npm run backend:test -- --test-name-pattern "fixture planner"
~~~

Expected: collection fails because backend/trip-planner.ts does not exist.

- [ ] **Step 3: Implement the planner with a strict fixture boundary**

Create backend/trip-planner.ts. Import AiClient and TripPlanRequest from backend modules, import the existing nanjingPlanningResult and nanjingTripPlan from `../lib/trip/nanjing-fixture.js`, and import the existing PlanningResult type from `../lib/trip/types.js`. Match the existing backend's `.js` specifiers: tsx resolves them to the TypeScript sources during local execution and backend typecheck remains valid without changing tsconfig.

Use this conservative marker list:

~~~ts
const overseasMarkers = [
  "巴黎", "东京", "纽约", "伦敦", "首尔", "新加坡", "悉尼",
  "日本", "美国", "英国", "法国", "韩国", "欧洲", "澳大利亚",
];

// ponytail: conservative marker list; replace with a region provider before nationwide planning.
~~~

Normalize 南京市 to 南京, reject an overseas marker with UNSUPPORTED_REGION, reject any other destination or day count with PLAN_NOT_AVAILABLE, and do not call client.complete on either path.

Build the prompt only from nanjingTripPlan.days, including each poi.uid and poi.name, and instruct the provider to return only this shape:

~~~json
{"days":[{"day":1,"poiUids":["fixture-nanjing-fuzimiao"]}]}
~~~

Do not include coordinates or route fields. Call client.complete with the request message replaced by this prompt and history set to an empty array. Parse JSON.parse(content) into FixtureSelection, require exactly three day objects and arrays, then compare the complete day/UID structure with nanjingTripPlan.days. Convert every parse or mismatch failure to TripPlannerError with code MODEL_OUTPUT_INVALID and fixed message AI 返回的行程选择无法通过校验; do not include provider content in the error. Return nanjingPlanningResult only after its plan/timeline identity matches.

- [ ] **Step 4: Run planner tests and backend typecheck**

Run:

~~~text
npm run backend:test -- --test-name-pattern "fixture planner"
npm run backend:typecheck
~~~

Expected: valid selection passes, every malformed/unsafe selection fails with the typed error, no-call guards pass, and backend typecheck is clean.

- [ ] **Step 5: Commit the fixture planner**

~~~text
git add backend/trip-planner.ts backend/tests/trip-planner.test.ts
git commit -m "feat: validate ai selection against trip fixture"
~~~

---

### Task 3: Expose the planning endpoint through the existing server

**Files:**
- Modify: backend/server.ts
- Modify: backend/start.ts
- Modify: backend/tests/server.test.ts

**Interfaces:**
- Consumes: parseTripPlanRequest, TripPlanner, TripPlannerError, and nanjingPlanningResult in tests.
- Produces: OPTIONS /api/trips/plan and POST /api/trips/plan, with PlanningResult success and structured planner errors.

- [ ] **Step 1: Add failing in-process HTTP tests**

Extend the existing import block in backend/tests/server.test.ts with these imports, then add a fake planner and these tests below the existing fake-client helper:

~~~ts
import type { TripPlanner } from "../trip-planner.js";
import { TripPlannerError } from "../trip-planner.js";
import { nanjingPlanningResult } from "../../lib/trip/nanjing-fixture.js";

function fakePlanner(onCall?: () => void): TripPlanner {
  return {
    async plan() {
      onCall?.();
      return nanjingPlanningResult;
    },
  };
}

test("planning endpoint returns the validated fixture result", async () => {
  let calls = 0;
  const server = createBackendServer({ config, client: fakeClient(), planner: fakePlanner(() => { calls += 1; }) });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(address + "/api/trips/plan", {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "想看历史和老街", destination: "南京", days: 3 }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), nanjingPlanningResult);
    assert.equal(calls, 1);
  } finally {
    await closeServer(server);
  }
});

test("planning endpoint rejects invalid input before invoking planner", async () => {
  let calls = 0;
  const server = createBackendServer({ config, client: fakeClient(), planner: fakePlanner(() => { calls += 1; }) });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(address + "/api/trips/plan", {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "没有天数", destination: "南京" }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: "INVALID_REQUEST", message: "days 必填" },
    });
    assert.equal(calls, 0);
  } finally {
    await closeServer(server);
  }
});

test("planning endpoint maps typed planner errors without leaking details", async () => {
  const server = createBackendServer({
    config,
    client: fakeClient(),
    planner: { plan: async () => { throw new TripPlannerError("UNSUPPORTED_REGION", "internal detail"); } },
  });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(address + "/api/trips/plan", {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "巴黎", destination: "巴黎", days: 3 }),
    });
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), {
      error: { code: "UNSUPPORTED_REGION", message: "暂不支持该地区，等待后续开发" },
    });
  } finally {
    await closeServer(server);
  }
});
~~~

Also extend preflight coverage so OPTIONS /api/trips/plan returns 204 with access-control-allow-methods: GET,POST,OPTIONS and never calls the planner.

- [ ] **Step 2: Run planning server tests and verify they fail**

Run:

~~~text
npm run backend:test -- --test-name-pattern "planning endpoint|preflight"
~~~

Expected: collection fails because createBackendServer does not accept a planner and the route does not exist.

- [ ] **Step 3: Implement route wiring and safe error mapping**

Export ServerDependencies with planner?: TripPlanner. Add /api/trips/plan to the allowed preflight paths. For the POST route, read the same bounded body, call parseTripPlanRequest, then call dependencies.planner.plan. If no planner is configured, return 503 with PLAN_NOT_AVAILABLE and 可播放行程服务尚未配置.

Map planner errors with this fixed table:

~~~ts
const plannerMessages = {
  UNSUPPORTED_REGION: "暂不支持该地区，等待后续开发",
  PLAN_NOT_AVAILABLE: "当前目的地的可播放行程尚未接入",
  MODEL_OUTPUT_INVALID: "AI 返回的行程选择无法通过校验",
};
~~~

Return 422 for the first two codes, 503 for MODEL_OUTPUT_INVALID, and reuse the existing AiClientError mapping for provider configuration, timeout, and provider failures. Never serialize error.message from a provider or planner into the response; use fixed messages.

Update start.ts so the same configured AiClient is passed to both the server and createFixtureTripPlanner:

~~~ts
const client = createAiClient(config);
const server = createBackendServer({
  config,
  client,
  planner: createFixtureTripPlanner(client),
});
~~~

- [ ] **Step 4: Run the full backend suite and typecheck**

Run:

~~~text
npm run backend:test
npm run backend:typecheck
~~~

Expected: existing chat/health tests and all planning endpoint tests pass; invalid planning input never invokes the planner.

- [ ] **Step 5: Commit the planning endpoint**

~~~text
git add backend/server.ts backend/start.ts backend/tests/server.test.ts
git commit -m "feat: expose validated fixture planning endpoint"
~~~

---

### Task 4: Add validated browser trip storage and homepage hydration

**Files:**
- Create: lib/trip/local-trip-store.ts
- Create: lib/trip/local-trip-store.test.mjs
- Create: components/trip-story-home.tsx
- Modify: app/page.tsx

**Interfaces:**
- Consumes: PlanningResult, nanjingPlanningResult, and TripStoryExperience.
- Produces:

~~~ts
export const ACTIVE_TRIP_STORAGE_KEY = "lumivo.active-trip.v1";
export function saveActiveTrip(result: PlanningResult, storage?: Storage): void;
export function loadActiveTrip(storage?: Storage): PlanningResult | null;
export function clearActiveTrip(storage?: Storage): void;
~~~

- [ ] **Step 1: Write failing storage tests**

Create lib/trip/local-trip-store.test.mjs:

~~~js
import assert from "node:assert/strict";
import test from "node:test";

import { loadActiveTrip, saveActiveTrip } from "./local-trip-store.ts";
import { nanjingPlanningResult } from "./nanjing-fixture.ts";

function createStorage(value) {
  let current = value;
  return {
    getItem: () => current,
    setItem: (_key, next) => { current = next; },
    removeItem: () => { current = null; },
  };
}

test("storage restores the canonical fixture from its marker", () => {
  const storage = createStorage(null);
  saveActiveTrip(nanjingPlanningResult, storage);
  assert.deepEqual(JSON.parse(storage.getItem()), {
    tripId: nanjingPlanningResult.plan.id,
    tripVersion: nanjingPlanningResult.plan.version,
  });
  assert.deepEqual(loadActiveTrip(storage), nanjingPlanningResult);
});

test("storage removes corrupt or non-fixture markers and rejects mismatched results", () => {
  const corrupt = createStorage("not-json");
  assert.equal(loadActiveTrip(corrupt), null);
  assert.equal(corrupt.getItem(), null);

  const wrongFixture = createStorage(JSON.stringify({ tripId: "wrong-trip", tripVersion: 1 }));
  assert.equal(loadActiveTrip(wrongFixture), null);
  assert.equal(wrongFixture.getItem(), null);

  assert.throws(
    () => saveActiveTrip({
      ...nanjingPlanningResult,
      timeline: { ...nanjingPlanningResult.timeline, tripId: "wrong-trip" },
    }, createStorage(null)),
    /可播放行程/,
  );
});
~~~

- [ ] **Step 2: Run storage tests and verify they fail**

Run:

~~~text
node --test lib/trip/local-trip-store.test.mjs
~~~

Expected: module loading fails because local-trip-store.ts does not exist.

- [ ] **Step 3: Implement the focused storage module**

Use localStorage only when no explicit test storage is passed and window exists. Do not persist a user-controlled PlanningResult object. Import nanjingPlanningResult and write only this marker under ACTIVE_TRIP_STORAGE_KEY:

~~~ts
{ tripId: nanjingPlanningResult.plan.id, tripVersion: nanjingPlanningResult.plan.version }
~~~

saveActiveTrip requires result.plan.id and result.timeline.tripId to equal the fixture id and result.plan.version and result.timeline.tripVersion to equal the fixture version; otherwise throw Error("可播放行程校验失败"). loadActiveTrip catches JSON errors, accepts only the exact marker above, and returns the imported nanjingPlanningResult. Every other value removes the key and returns null. clearActiveTrip removes the key and is a no-op outside a browser. This keeps every playback field canonical even if localStorage is edited.

- [ ] **Step 4: Add the homepage client wrapper**

Create components/trip-story-home.tsx:

~~~tsx
"use client";

import { useEffect, useState } from "react";

import TripStoryExperience from "@/components/trip-story-experience";
import { loadActiveTrip } from "@/lib/trip/local-trip-store";
import type { PlanningResult } from "@/lib/trip/types";

export default function TripStoryHome({ fallback }: { fallback: PlanningResult }) {
  const [result, setResult] = useState(fallback);

  useEffect(() => {
    const stored = loadActiveTrip();
    if (stored) setResult(stored);
  }, []);

  return <TripStoryExperience plan={result.plan} timeline={result.timeline} />;
}
~~~

Change app/page.tsx to remain a server composition page that imports nanjingPlanningResult and renders TripStoryHome with that result as fallback.

- [ ] **Step 5: Run storage, frontend lint, and frontend typecheck**

Run:

~~~text
node --test lib/trip/local-trip-store.test.mjs
npm run lint
npx tsc --noEmit --incremental false
~~~

Expected: storage tests, lint, and TypeScript checks pass.

- [ ] **Step 6: Commit browser storage and homepage hydration**

~~~text
git add lib/trip/local-trip-store.ts lib/trip/local-trip-store.test.mjs components/trip-story-home.tsx app/page.tsx
git commit -m "feat: hydrate homepage from validated trip draft"
~~~

---

### Task 5: Connect /ai to planning and playback

**Files:**
- Modify: components/ai-chat.tsx

**Interfaces:**
- Consumes: POST /api/trips/plan, saveActiveTrip, PlanningResult, and Next useRouter.
- Produces: a separate button that sends the current request to the planner, displays fixed structured errors, saves success, and navigates to /.

- [ ] **Step 1: Define the manual browser acceptance seam**

There is no React test runner in this repository. The deterministic seams are the endpoint tests and storage tests; the click flow is verified manually after implementation:

1. Start npm run backend:start and the existing frontend at port 8989.
2. Open /ai, enter destination 南京, days 3, and a message.
3. Click 生成可播放行程.
4. Confirm navigation to /, the story panel shows the Nanjing plan, and playback controls remain usable.
5. Repeat with 成都 and confirm the chat remains visible with 当前目的地的可播放行程尚未接入.

- [ ] **Step 2: Implement the planning action**

Add useRouter, PlanningResult, and saveActiveTrip. Keep the existing free-form submitMessage path unchanged. Add this module-level response type and fixed error table; only this table may surface a server planning error:

~~~tsx
type PlanningResponse = {
  plan?: PlanningResult["plan"];
  timeline?: PlanningResult["timeline"];
  error?: { code?: string };
};

const planningErrorMessages: Record<string, string> = {
  UNSUPPORTED_REGION: "暂不支持该地区，等待后续开发",
  PLAN_NOT_AVAILABLE: "当前目的地的可播放行程尚未接入",
  MODEL_OUTPUT_INVALID: "AI 返回的行程选择无法通过校验",
};
~~~

Inside AiChat, add `const [planning, setPlanning] = useState(false);` and `const isBusy = pending || planning;`. Then add this handler:

~~~tsx
async function createPlayablePlan() {
  const normalizedDestination = destination.trim();
  const dayCount = Number(days);
  if (isBusy || !normalizedDestination || !Number.isInteger(dayCount) || dayCount < 1 || dayCount > 30) {
    return;
  }

const planMessage = [...messages].reverse().find((item) => item.role === "user")?.content
  ?? "请生成可播放行程";

  setError(null);
  setPlanning(true);
  try {
    const response = await fetch(backendUrl + "/api/trips/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: planMessage,
        destination: normalizedDestination,
        days: dayCount,
      }),
    });
    const data = await response.json() as PlanningResponse;
    if (!response.ok || !data.plan || !data.timeline) {
      setError(planningErrorMessages[data.error?.code ?? ""] ?? "可播放行程生成失败，请稍后再试。");
      return;
    }
    saveActiveTrip({ plan: data.plan, timeline: data.timeline });
    router.push("/");
  } catch {
    setError("可播放行程生成失败，请稍后再试。");
  } finally {
    setPlanning(false);
  }
}
~~~

The fixture planner replaces the outgoing message with its fixed UID-only prompt, so do not send history on this action. Require a non-empty destination, integer days from 1 through 30, and no concurrent chat/planning request before sending. Replace every existing `disabled={pending}` with `disabled={isBusy}`, including both buttons; use the appropriate pending label for chat versus planning. Show the planning button only for a valid destination/day count, with a short note that this local playback slice currently covers only the Nanjing three-day fixture. Network, malformed JSON, and unknown errors use only the generic fallback; no raw error text is rendered.

- [ ] **Step 3: Run frontend checks**

Run:

~~~text
npm run lint
npx tsc --noEmit --incremental false
~~~

Expected: the client component compiles and has no lint errors.

- [ ] **Step 4: Commit the chat-to-playback action**

~~~text
git add components/ai-chat.tsx
git commit -m "feat: connect ai chat to playable trip fixture"
~~~

---

### Task 6: Update documentation and run complete verification

**Files:**
- Modify: CONTEXT.md
- Modify: README.md
- Modify: docs/superpowers/specs/2026-08-18-local-first-ai-travel-map-design.md
- Modify: docs/superpowers/specs/2026-08-21-verified-fixture-trip-flow-design.md

**Interfaces:**
- Consumes: the implemented POST /api/trips/plan, browser storage key, and fixture-only boundary.
- Produces: newcomer and architecture documentation that distinguishes implemented Nanjing fixture playback from future nationwide Baidu planning.

- [ ] **Step 1: Update current-state documentation**

Add to CONTEXT.md current implementation:

~~~text
- A validated POST /api/trips/plan fixture contract: the AI may select only the known Nanjing fixture UIDs, and the server returns the existing playable Plan/Timeline only after strict validation.
- The /ai planning action stores the validated fixture identity marker in lumivo.active-trip.v1; the homepage hydrates the canonical Nanjing fixture from that marker and keeps it as fallback.
~~~

Move the immediate next milestone to Baidu POI/route adapters for arbitrary China destinations. Keep live provider evidence pending explicit.

Add to README.md the local flow:

~~~text
1. Start npm run backend:dev.
2. Start npm run dev.
3. Open /ai, use 南京 + 3 days, and choose 生成可播放行程.
4. The validated fixture opens on / and can be played.
~~~

Document that non-Nanjing destinations are not yet verified/plannable by this endpoint.

At the top of the architecture spec, add this authoritative current-state paragraph:

~~~text
The implemented planning slice is TypeScript Node JSON transport: POST /api/trips/plan accepts TripPlanRequest and returns PlanningResult directly for the validated Nanjing fixture. Browser persistence stores only the fixture id/version marker and reloads the canonical fixture. The FastAPI, Pydantic, and application/x-ndjson sections below are historical larger-architecture proposals, not the current implementation contract.
~~~

Keep the broader Baidu-backed planning contract explicitly future work. Do not describe the historical FastAPI `TripClient` or NDJSON endpoints as current behavior.

Update the approved design spec `docs/superpowers/specs/2026-08-21-verified-fixture-trip-flow-design.md` as follows:

~~~text
Status: Approved
~~~

Change its planner interface to `plan(request: TripPlanRequest): Promise<PlanningResult>;`, and replace its wording that says the browser stores a `PlanningResult` with wording that says it stores the validated fixture id/version marker and rehydrates the canonical fixture. This keeps the approved design and the implemented storage boundary consistent.

- [ ] **Step 2: Run documentation and secret checks**

Run:

~~~text
git diff --check
git status --short --untracked-files=all
git ls-files backend/.env .env.local
~~~

Expected: no whitespace errors, no provider key file is tracked, and unrelated existing user changes remain visible.

- [ ] **Step 3: Run complete deterministic verification**

Run:

~~~text
npm run backend:test
npm run backend:typecheck
npm run lint
npx tsc --noEmit --incremental false
node --test lib/**/*.test.mjs
npm run build
~~~

Expected: backend tests, backend typecheck, lint, frontend typecheck, and all existing Node tests pass. Report the build exactly; if the managed environment again rejects .next/cache writes, record that environment failure without claiming build success.

- [ ] **Step 4: Run local endpoint and browser smoke checks**

Start the backend and verify:

~~~text
Invoke-RestMethod -Uri http://127.0.0.1:8000/health -Method Get
~~~

Then open http://localhost:8989/ai in the already running frontend and perform the manual acceptance sequence from Task 5. Do not make a live provider request in automated verification or print any key.

- [ ] **Step 5: Commit documentation and report actual evidence**

~~~text
git add CONTEXT.md README.md docs/superpowers/specs/2026-08-18-local-first-ai-travel-map-design.md docs/superpowers/specs/2026-08-21-verified-fixture-trip-flow-design.md
git commit -m "docs: record verified fixture trip flow"
~~~

Report exact test counts, endpoint response evidence, browser evidence, and any build permission failure. Do not claim nationwide Baidu coverage or live AI success.

---

## Final Acceptance Checklist

- [ ] POST /api/trips/plan validates its body before planner invocation.
- [ ] Nanjing three-day model selection is constrained to the existing fixture UIDs and exact schedule.
- [ ] Overseas and uncovered destinations fail closed with structured Chinese errors.
- [ ] No model output can introduce a coordinate, route, distance, duration, or POI UID.
- [ ] Existing TripPlan/StoryTimeline identity remains intact.
- [ ] The validated result survives /ai to / navigation through lumivo.active-trip.v1.
- [ ] Corrupt or mismatched browser storage is discarded safely.
- [ ] Existing map/story tests and current AI chat tests remain green.
- [ ] Documentation states the fixture-only boundary and the next Baidu integration milestone.
