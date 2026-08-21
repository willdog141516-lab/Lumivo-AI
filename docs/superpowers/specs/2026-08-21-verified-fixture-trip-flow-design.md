# Verified Fixture Trip Flow Design

Date: 2026-08-21

Status: Awaiting written review

## 1. Purpose

Connect the existing provider-configurable AI chat to the already verified Nanjing fixture without pretending that arbitrary destinations have live map facts. A successful request will pass through one explicit boundary:

`/ai` chat → `POST /api/trips/plan` → AI selects known fixture UIDs → server validates the selection → existing `TripPlan + StoryTimeline` → `/` playback.

This is the first planning contract, not the nationwide map integration. It proves the end-to-end shape while keeping the fixture as the only source of POI identity, BD-09 coordinates, route geometry, distance, duration, and narration.

## 2. Scope

### Included

- A `POST /api/trips/plan` endpoint on the existing TypeScript Node backend.
- Request validation for destination, days, message, and bounded chat history.
- A fixture planner that supports exactly the existing three-day Nanjing fixture.
- Reuse of the existing `nanjingPlanningResult`; no duplicate POI, route, or timeline literals.
- An AI selection prompt containing only fixture candidate UIDs and names.
- Strict parsing and validation of the AI JSON selection before returning a playable result.
- A typed planner error when model output contains an unknown UID, missing day, duplicate POI, or invalid shape.
- Explicit `UNSUPPORTED_REGION` for a conservative set of recognizable overseas destinations and `PLAN_NOT_AVAILABLE` for other destinations not covered by the fixture.
- A small browser-only `localStorage` module for the last validated `PlanningResult`.
- A planning action on `/ai` that stores the validated result and navigates to `/`.
- A client wrapper on `/` that loads the stored validated result and falls back to the existing Nanjing fixture.

### Excluded

- Baidu POI, route, or live map calls.
- Nationwide destination coverage in this slice. Other Chinese destinations fail closed with a clear “fixture not available” response.
- Model-generated coordinates, route geometry, distances, durations, opening hours, or POI UIDs.
- Dynamic timeline compilation for arbitrary model-selected schedules. The first fixture contract accepts only the known three-day fixture schedule so the existing StoryPlayer can consume it unchanged.
- Streaming, persistence beyond one browser draft, authentication, database, RAG, tools, agents, or provider-specific APIs.

## 3. Contracts

### 3.1 Planning request

`POST /api/trips/plan` accepts the chat-compatible shape:

```ts
type TripPlanRequest = {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  destination: string;
  days: number;
};
```

`destination` is normalized and required. `days` must be an integer from 1 through 30 at the transport boundary; the fixture planner then accepts only `南京`/`南京市` with `3` days. Invalid JSON or fields return HTTP `400` with `INVALID_REQUEST`.

### 3.2 Planning success

The success body is the existing frontend domain contract, returned unchanged:

```ts
type PlanningResult = {
  plan: TripPlan;
  timeline: StoryTimeline;
};
```

The server returns this only after the model selection matches the known fixture schedule and `timeline.tripId === plan.id` plus `timeline.tripVersion === plan.version`.

### 3.3 Planning errors

```ts
type PlanningErrorCode =
  | "UNSUPPORTED_REGION"
  | "PLAN_NOT_AVAILABLE"
  | "MODEL_OUTPUT_INVALID"
  | "AI_NOT_CONFIGURED"
  | "AI_PROVIDER_ERROR"
  | "AI_PROVIDER_TIMEOUT"
  | "INTERNAL_ERROR";
```

Expected error responses keep the existing shape:

```json
{
  "error": {
    "code": "MODEL_OUTPUT_INVALID",
    "message": "AI 返回的行程选择无法通过校验"
  }
}
```

`UNSUPPORTED_REGION` and `PLAN_NOT_AVAILABLE` are HTTP `422`; model/provider failures are `503`; unexpected failures are `500`. No provider response body or key is returned.

## 4. Planner boundary

The planner depends on the existing `AiClient` interface:

```ts
type TripPlanner = {
  plan(request: NormalizedChatRequest): Promise<PlanningResult>;
};
```

The fixture implementation performs these steps:

1. Normalize and classify the destination before any AI call.
2. Reject recognizable overseas destinations with `UNSUPPORTED_REGION`.
3. Reject non-Nanjing destinations with `PLAN_NOT_AVAILABLE`.
4. Build a Chinese prompt containing the fixture's candidate UID/name pairs and the expected three-day shape. Coordinates and route facts are not placed in the model prompt.
5. Call the existing `AiClient` once.
6. Parse the response as JSON with shape `{ "days": [{ "day": number, "poiUids": string[] }] }`.
7. Require exactly three days, the expected day numbers, no duplicate or unknown UID, and the exact fixture stop order. Any mismatch is `MODEL_OUTPUT_INVALID`.
8. Return the existing fixture `PlanningResult` without mutating it.

The conservative overseas check is deliberately small and fail-closed: it recognizes common country/city markers such as `巴黎`, `东京`, `纽约`, `伦敦`, `日本`, `美国`, and `欧洲`; unknown non-Nanjing destinations do not call the model and return `PLAN_NOT_AVAILABLE`. A future region provider replaces this marker list before nationwide planning.

## 5. Browser flow

`AiChat` keeps the current conversational flow. When destination and days are filled, it exposes a separate “生成可播放行程” action. The action sends the current user request and bounded history to `/api/trips/plan`; it does not reuse a free-form assistant answer as a plan.

On success it calls `saveActiveTrip(result)` and navigates to `/`. On failure it keeps the chat and displays the structured Chinese error. The browser stores only the validated response in the focused key `lumivo.active-trip.v1`.

The homepage remains a server composition page and renders a small client wrapper with the static Nanjing fixture as its initial fallback. After hydration, the wrapper loads the stored result, validates the plan/timeline identity and basic shape, and passes the result to the existing `TripStoryExperience`. Corrupt storage is removed and the fixture remains visible.

## 6. Security and invariants

- The provider API key remains in `backend/.env`; the browser sees only `NEXT_PUBLIC_AI_BACKEND_URL`.
- The AI may select only fixture UIDs; it cannot introduce map facts.
- The existing BD-09 coordinates, source UIDs, route geometry, distance, duration, plan version, and timeline version remain authoritative.
- The server validates before returning a result; invalid model output never reaches `StoryPlayer`.
- The route uses the existing CORS and 64 KiB body limit.
- The browser does not store keys or raw provider responses.

## 7. Verification and acceptance

Backend tests must cover:

- valid Nanjing fixture selection returns the exact fixture result;
- unknown UID, duplicate UID, missing day, malformed JSON, and wrong schedule return `MODEL_OUTPUT_INVALID`;
- overseas marker returns `UNSUPPORTED_REGION` without an AI call;
- non-Nanjing China destination returns `PLAN_NOT_AVAILABLE` without an AI call;
- endpoint validation happens before planner invocation;
- successful endpoint returns the canonical plan/timeline and errors remain structured.

Frontend/domain tests must cover:

- valid stored result loads;
- mismatched plan/timeline identity and corrupt JSON are discarded;
- planning success stores the result and navigates through the existing `/ai` action (manual browser evidence for the click flow).

Deterministic verification remains `npm run backend:test`, `npm run backend:typecheck`, `npm run lint`, `npx tsc --noEmit --incremental false`, and the existing Node tests. No live provider request is required for the default suite.

## 8. Follow-up boundary

After this slice is verified, the next design replaces the fixture planner with a real Baidu POI/route adapter for arbitrary China destinations and introduces a structured AI schedule over provider-verified candidates. That work must not weaken the validation boundary established here.
