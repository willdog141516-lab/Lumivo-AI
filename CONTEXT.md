# Lumivo AI Project Context

Last updated: 2026-08-21

This file is the short operational context for developers and coding agents. It records what the project is building, what has already been decided, what actually exists, and what should happen next.

## Product vision

Lumivo AI turns a natural-language travel request into a map-backed visual story. A user can ask for a trip such as “南京玩三天”; the application plans the days, verifies attractions and routes, then animates the journey from a globe to a city map and through each route chapter.

## Confirmed MVP

The first version supports China only and contains exactly three product capabilities:

1. AI itinerary planning.
2. Street-level map browsing.
3. Route animation playback.

An overseas destination returns `UNSUPPORTED_REGION` and the Chinese message “暂不支持该地区，等待后续开发”。

The first reference scenario is a three-day Nanjing trip. It is the fixture, demo path, and end-to-end acceptance case.

## Confirmed technical decisions

- Frontend: Next.js, React, TypeScript.
- Backend: TypeScript Node service using native `http`/`fetch`; the current chat contract is maintained in focused TypeScript modules.
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
- A full-screen MapStage homepage at `/`.
- An R3F procedural Earth with stars, lighting, rotation, drag, and zoom, preserved at `/earth`.
- A deterministic three-day Nanjing `TripPlan` and matching `StoryTimeline` fixture in `lib/trip/`.
- A deterministic `StoryPlayer` state machine, shared homepage playback panel, and `TripStoryExperience` that sends the same semantic commands to MapStage.
- MapStage fixture command translation for projection, camera flights, attraction markers, route drawing, and route-follow camera movement; commands are queued until the Engine is ready.
- A `/map-stage-spike` that creates a JSAPI Three `Engine`, reuses its renderer/scene/camera in R3F, and advances R3F from the Engine render callback. It can use a locally ignored Baidu browser AK for vector tiles; without one it stays fixture-only.
- A TypeScript Node backend in `backend/` with `GET /health`, `POST /api/chat`, bounded request validation, provider timeout/error mapping, and fake-provider tests.
- A basic Chinese AI chat page at `/ai` that accepts arbitrary China destinations, keeps conversation state in memory, and calls the local backend.
- A `POST /api/trips/plan` endpoint that supports only 南京/南京市 with 3 days, sends fixture UID/name candidates to the configured AI provider, and returns the canonical `nanjingPlanningResult` only after strict selection validation.
- A focused `lumivo.active-trip.v1` browser marker store and `/` client wrapper that rehydrates the canonical Nanjing result while preserving the fixture fallback.

The repository does not yet have:

- Verified live Baidu basemap behavior, POI lookup, or route lookup. The local spike has conditional vector-provider wiring, but live browser/provider evidence is still pending.
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
2. Prove the JSAPI Three and R3F integration on one visible map stage. **Spike added:** `/map-stage-spike` has a single Engine-owned render loop and conditional Baidu vector-provider wiring; live browser WebGL and live Baidu basemap evidence remain pending.
3. Finish MapStage command translation for the deterministic StoryPlayer route playback. **Completed for the fixture:** shared player wiring, command runtime tests, marker/route overlays, and map camera commands now live on `/`.
4. Connect the provider-configurable TypeScript chat slice to the verified Nanjing fixture planning contract. **Completed:** `/api/trips/plan`, strict UID validation, browser marker hydration, and `/ai` navigation now form the local acceptance flow.
5. Add real Baidu POI and route data behind explicit adapters for arbitrary China destinations.
6. Replace the fixture planner with AI planning constrained to the provider-verified candidate set and compile the result into the existing story flow.
7. Add plan revision, recovery states, local persistence, and performance work.

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

## When to update this file

Update this context when the supported region, MVP scope, provider choice, canonical data model, current implementation state, or next development milestone changes. Move lasting interface details into the architecture spec rather than expanding this file indefinitely.
