# Lumivo AI Project Context

Last updated: 2026-09-23

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
- China map authority: Baidu Map JSAPI Three and Baidu Web APIs; browser map resources use the sibling FastAPI server proxy.
- Custom 3D effects: React Three Fiber and Three.js.
- Coordinate contract: BD-09 at the map seam.
- MVP persistence: browser `localStorage`; no database.
- Local development: frontend on port 8989 and backend on port 8000.
- Delivery strategy: deterministic map/story fixture first, then a provider-configurable AI chat slice, then a validated Nanjing fixture planning flow, followed by verified Baidu data and nationwide grounded itinerary planning.
- Deployment, authentication, cloud persistence, Redis, and queues are postponed until the local product flow is mature.

## Current implementation

The repository currently has:

- The Story Map playback panel offers public transport, driving, walking, and cycling preference buttons in both expanded and compact playback states. Real plans reroute every leg in the chosen mode and persist a new version; fixed fixture routes disable the controls and explain why.
- A Next.js 16 application.
- An AI travel search homepage at `/` with `/ai` kept as a compatible entry point, and the full-screen MapStage route story at `/trip`.
- An R3F procedural Earth with stars, lighting, rotation, drag, and zoom, preserved at `/earth`.
- A deterministic three-day Nanjing `TripPlan` and matching `StoryTimeline` fixture in `lib/trip/`.
- A deterministic `StoryPlayer` state machine, shared route-story playback panel, and `TripStoryExperience` that sends the same semantic commands to MapStage.
- MapStage fixture command translation for overview-to-city camera flights, attraction markers, route drawing, and route-follow camera movement; story playback keeps the map on its flat `EPSG:4326` boundary, routes animate by progressive drawing without a world-scaled arrow, and commands are queued until the Engine is ready. The vector provider runs in offline mode and requests tiles and allowlisted style assets through the sibling FastAPI proxy.
- A `/map-stage-spike` that creates a JSAPI Three `Engine`, reuses its renderer/scene/camera in R3F, and advances R3F from the Engine render callback; live basemap loading remains dependent on the server proxy and an accepted backend-only vector-tile AK.
- A legacy TypeScript Node compatibility backend in `backend/` with `GET /health`, `POST /api/chat`, bounded request validation, provider timeout/error mapping, and fake-provider tests; the playable planning path uses the sibling FastAPI service.
- A basic Chinese AI chat page at `/` and `/ai` that accepts arbitrary China destinations, keeps conversation state in memory, and calls the local backend.
- The AI chat page consumes the compatibility backend SSE response and renders assistant Markdown incrementally with `streamdown`; playable planning consumes the FastAPI canonical NDJSON stream through `TripClient`.
- A global dark/light theme toggle in the root layout, defaulting to dark and preserving the selected theme in browser storage.
- On `/trip`, transport markers use the global theme colors; the local vector style, building visibility, and renderer clear color follow the global light/dark theme without a browser Baidu key.
- A TripClient integration that plans through POST /api/v1/trips/plan, displays progress, persists the validated result, and opens /trip; the trip page can revise one day through POST /api/v1/trips/revise or reroute all route legs through POST /api/v1/trips/reroute, persisting the returned versioned plan/timeline.
- A focused `lumivo.active-trip.v1` browser store and `/trip` client wrapper that persists any validated `PlanningResult`, checks POI/timeline references and narration anchors, rehydrates legacy Nanjing markers, and preserves the fixture fallback.

The repository does not yet have:

- Verified live Baidu basemap, POI, or route lookup. The server proxy path is implemented, but live basemap rendering still requires an accepted backend-only vector-tile AK and provider smoke verification.
- Verified live Baidu POI and route data for arbitrary China destinations; the current planning endpoint remains fixture-only.
- Live AI-provider smoke evidence; deterministic tests use a fake provider and do not spend quota.

## Core invariants

- AI can reason about preferences and scheduling but cannot be the source of map facts.
- Every playable POI has a stable source UID, name, address, and BD-09 coordinate. Full-real mode requires Baidu verification; fixture mode uses deterministic fixture UIDs.
- Every playable route has provider-sourced geometry, distance, and duration.
- A plan with invalid POIs or missing route legs is not playable.
- A timeline is accepted only when its `tripId` and `version` match the active plan.
- A POI-bound narration must match the stop narration and contain a short anchor from that POI name before a cached plan is playable.
- Map and animation modules consume domain commands; they do not parse free-form model output.
- Provider failures produce explicit structured errors and never fake success.

## Immediate development sequence

1. Build a static Nanjing `TripPlan` and `StoryTimeline` fixture. **Completed:** deterministic data and invariant tests now live in `lib/trip/`.
2. Prove the JSAPI Three and R3F integration on one visible map stage. **Proxy path added:** MapStage has a single Engine-owned render loop and all browser map resources target the FastAPI proxy; live tiles still need backend-only vector-tile-AK smoke verification.
3. Finish MapStage command translation for the deterministic StoryPlayer route playback. **Completed for the fixture:** shared player wiring, command runtime tests, marker/route overlays, and map camera commands now live on `/trip`.
4. Connect the provider-configurable TypeScript chat slice to the verified Nanjing fixture planning contract. **Completed:** compatibility chat, canonical FastAPI planning, strict UID validation, browser persistence, and `/`/`/ai` → `/trip` navigation form the local acceptance flow.
5. Add real Baidu POI and route data behind explicit adapters for arbitrary China destinations. **Local adapters completed:** live credentials, quotas, and broader coverage still need smoke evidence.
6. **Completed locally:** canonical NDJSON planning and stateless one-day revision constrained by provider-verified POIs; the returned version and timeline are rendered by the existing story flow.
7. **Completed locally:** Story Map transport preference switching for all real-plan route legs; fixture routes remain fixed and cannot be switched.
8. Add browser acceptance, recovery/performance hardening, and live provider smoke evidence.

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-09-22 | Transport preference belongs on the Story Map | Switching reroutes every real-plan leg in one exact mode; fixture geometry is fixed, so fixture controls are disabled and explained. |
| 2026-08-18 | China-only MVP | Street-level accuracy and provider constraints require a focused launch region. |
| 2026-08-18 | No login in MVP | Login does not prove the core planning and playback experience. |
| 2026-08-18 | R3F for custom animation, Baidu for map truth | This keeps creative control without rebuilding a street map engine. |
| 2026-08-18 | Local-first delivery | The product flow should be useful before deployment work begins. |
| 2026-08-20 | Baidu Engine owns the shared render loop | The R3F root reuses Engine renderer/scene/camera, disables its own loop, and advances from `addBeforeRenderListener`. |
| 2026-08-20 | TypeScript Node backend with configurable OpenAI-compatible provider | The initial AI web slice needs a small server-side boundary; DeepSeek is the default, not a hard-coded provider. |
| 2026-08-21 | Fixture planning is fail-closed | The local planning endpoint may return only the canonical Nanjing fixture; other regions and invalid model selections produce structured errors. |
| 2026-08-21 | JSAPI Three needs an accepted backend-only vector-tile AK through the proxy | Browser credentials cannot be made secret; the provider now requests the FastAPI map proxy, which injects the backend-only vector-tile AK. |
| 2026-08-21 | AI search is the first screen | `/` starts with natural-language travel Q&A; a playable result drills down to `/trip`, which owns the MapStage story experience. |
| 2026-09-17 | Story playback uses one Engine loop with bounded overlay work | Keep the Engine authoritative, update route geometry only when playback state changes, start one `map.flyTo` per route-follow command instead of recentering every frame, show only the active route leg, and avoid world-scaled route-head overlays; keep the Baidu provider on flat `EPSG:4326`, cancel camera flights on reset, and seek by rebuilding only the selected chapter. |
| 2026-09-23 | Browser map resources use the server proxy | `LUMIVO_BAIDU_VECTOR_TILE_AK` stays backend-only for mapv-three tiles; `LUMIVO_BAIDU_MAP_AK` remains the Web API credential, and browser requests carry only proxy coordinates. |
| 2026-09-18 | FastAPI is the canonical planning boundary | `TripClient` consumes NDJSON progress and terminal results from `/api/v1/trips/plan` and `/api/v1/trips/revise`; the legacy TypeScript service remains only for compatibility chat behavior. |

## When to update this file

Update this context when the supported region, MVP scope, provider choice, canonical data model, current implementation state, or next development milestone changes. Move lasting interface details into the architecture spec rather than expanding this file indefinitely.
