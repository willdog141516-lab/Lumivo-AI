# Lumivo AI Project Context

Last updated: 2026-08-21

This file is the short operational context for developers and coding agents. It records what the project is building, what has already been decided, what actually exists, and what should happen next.

## Product vision

Lumivo AI turns a natural-language travel request into a map-backed visual story. A user can ask for a trip such as “南京玩三天”; the application plans the days, verifies attractions and routes, then animates the journey from an overview to a city map and through each route chapter.

## Confirmed MVP

The first version supports China only and contains exactly three product capabilities:

1. AI itinerary planning.
2. Street-level map browsing.
3. Route animation playback.

An overseas destination returns `UNSUPPORTED_REGION` and the Chinese message “暂不支持该地区，等待后续开发”。

The first reference scenario is a three-day Nanjing trip. It is the fixture, demo path, and end-to-end acceptance case.

## Confirmed technical decisions

- Frontend: Next.js, React, TypeScript.
- Backend: Python FastAPI service in sibling `lumivo-backend`; the frontend `backend/` TypeScript Node service remains only as a legacy compatibility path for focused tests.
- AI provider: OpenAI-compatible Chat Completions API; DeepSeek is the default local configuration and can be replaced through environment variables.
- China map authority: Baidu Map JSAPI Three and Baidu Web APIs.
- Custom 3D effects: React Three Fiber and Three.js.
- Coordinate contract: BD-09 at the map seam.
- MVP persistence: browser `localStorage`; no database.
- Local development: frontend on port 8989 and backend on port 8000.
- Delivery strategy: deterministic map/story fixture first, then a provider-configurable AI chat slice, then a validated Nanjing fixture planning flow, followed by verified Baidu data and nationwide grounded itinerary planning.
- Deployment, authentication, cloud persistence, Redis, and queues are postponed until the local product flow is mature.

## Current implementation

The repository currently has:

- A Next.js 16 application.
- An AI travel search homepage at `/` with `/ai` kept as a compatible entry point, and the full-screen MapStage route story at `/trip`.
- An R3F procedural Earth with stars, lighting, rotation, drag, and zoom, preserved at `/earth`.
- A deterministic three-day Nanjing `TripPlan` and matching `StoryTimeline` fixture in `lib/trip/`.
- A deterministic `StoryPlayer` state machine, shared route-story playback panel, and `TripStoryExperience` that sends the same semantic commands to MapStage.
- MapStage fixture command translation for overview-to-city camera flights, attraction markers, route drawing, and route-follow camera movement; commands are queued until the Engine is ready.
- A `/map-stage-spike` that creates a JSAPI Three `Engine`, reuses its renderer/scene/camera in R3F, and advances R3F from the Engine render callback. Its current local Baidu AK receives HTTP 403 from JSAPI Three tile endpoints, so live basemap loading is not yet verified.
- A legacy TypeScript Node compatibility backend in `backend/` with `GET /health`, `POST /api/chat`, bounded request validation, provider timeout/error mapping, and fake-provider tests; the playable planning path uses the sibling FastAPI service.
- A basic Chinese AI chat page at `/` and `/ai` that accepts arbitrary China destinations, keeps conversation state in memory, and calls the local backend.
- The AI chat page consumes the compatibility backend SSE response and renders assistant Markdown incrementally with `streamdown`; playable planning consumes the FastAPI canonical NDJSON stream through `TripClient`.
- A `TripClient` integration that plans through `POST /api/v1/trips/plan`, displays progress, persists the validated result, and opens `/trip`; the trip page can revise one day through `POST /api/v1/trips/revise` and keeps the returned versioned timeline playable.
- A focused `lumivo.active-trip.v1` browser marker store and `/trip` client wrapper that rehydrates the canonical Nanjing result while preserving the fixture fallback.

The repository does not yet have:

- Verified live Baidu basemap, POI, or route lookup. The current local AK must be replaced or authorized as a browser AK before JSAPI Three can load Baidu tiles.
- Verified live Baidu POI and route data for arbitrary China destinations; the current planning endpoint remains fixture-only.
- Live AI-provider smoke evidence; deterministic tests use a fake provider and do not spend quota.

## Core invariants

- AI can reason about preferences and scheduling but cannot be the source of map facts.
- Every playable POI has a stable source UID, name, address, and BD-09 coordinate. Full-real mode requires Baidu verification; fixture mode uses deterministic fixture UIDs.
- Every playable route has provider-sourced geometry, distance, and duration.
- A plan with invalid POIs or missing route legs is not playable.
- A timeline is accepted only when its `tripId` and `version` match the active plan.
- Map and animation modules consume domain commands; they do not parse free-form model output.
- Provider failures produce explicit structured errors and never fake success.

## Immediate development sequence

1. Build a static Nanjing `TripPlan` and `StoryTimeline` fixture. **Completed:** deterministic data and invariant tests now live in `lib/trip/`.
2. Prove the JSAPI Three and R3F integration on one visible map stage. **Spike added:** `/map-stage-spike` has a single Engine-owned render loop, but its current Baidu tile requests return HTTP 403 and need a correctly authorized browser AK.
3. Finish MapStage command translation for the deterministic StoryPlayer route playback. **Completed for the fixture:** shared player wiring, command runtime tests, marker/route overlays, and map camera commands now live on `/trip`.
4. Connect the provider-configurable TypeScript chat slice to the verified Nanjing fixture planning contract. **Completed:** compatibility chat, canonical FastAPI planning, strict UID validation, browser persistence, and `/`/`/ai` → `/trip` navigation form the local acceptance flow.
5. Add real Baidu POI and route data behind explicit adapters for arbitrary China destinations. **Local adapters completed:** live credentials, quotas, and broader coverage still need smoke evidence.
6. **Completed locally:** canonical NDJSON planning and stateless one-day revision constrained by provider-verified POIs; the returned version and timeline are rendered by the existing story flow.
7. Add browser acceptance, recovery/performance hardening, and live provider smoke evidence.

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-08-18 | China-only MVP | Street-level accuracy and provider constraints require a focused launch region. |
| 2026-08-18 | No login in MVP | Login does not prove the core planning and playback experience. |
| 2026-08-18 | R3F for custom animation, Baidu for map truth | This keeps creative control without rebuilding a street map engine. |
| 2026-08-18 | Local-first delivery | The product flow should be useful before deployment work begins. |
| 2026-08-20 | Baidu Engine owns the shared render loop | The R3F root reuses Engine renderer/scene/camera, disables its own loop, and advances from `addBeforeRenderListener`. |
| 2026-08-20 | TypeScript Node backend with configurable OpenAI-compatible provider | The initial AI web slice needs a small server-side boundary; DeepSeek is the default, not a hard-coded provider. |
| 2026-08-21 | Fixture planning is fail-closed | The local planning endpoint may return only the canonical Nanjing fixture; other regions and invalid model selections produce structured errors. |
| 2026-08-21 | JSAPI Three needs an authorized browser AK | The current local AK returns HTTP 403 for ordinary, street, and vector tile endpoints from common localhost referers. |
| 2026-08-21 | AI search is the first screen | `/` starts with natural-language travel Q&A; a playable result drills down to `/trip`, which owns the MapStage story experience. |
| 2026-09-18 | FastAPI is the canonical planning boundary | `TripClient` consumes NDJSON progress and terminal results from `/api/v1/trips/plan` and `/api/v1/trips/revise`; the legacy TypeScript service remains only for compatibility chat behavior. |

## When to update this file

Update this context when the supported region, MVP scope, provider choice, canonical data model, current implementation state, or next development milestone changes. Move lasting interface details into the architecture spec rather than expanding this file indefinitely.
