# Lumivo AI Project Context

Last updated: 2026-08-18

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
- Backend: Python FastAPI with Pydantic models.
- China map authority: Baidu Map JSAPI Three and Baidu Web APIs.
- Custom 3D effects: React Three Fiber and Three.js.
- Coordinate contract: BD-09 at the map seam.
- MVP persistence: browser `localStorage`; no database.
- Local development: frontend on port 3000 and backend on port 8000.
- Delivery strategy: mock data first, then real Baidu data, then AI.
- Deployment, authentication, cloud persistence, Redis, and queues are postponed until the local product flow is mature.

## Current implementation

The repository currently has:

- A Next.js 16 application.
- A full-screen homepage.
- An R3F procedural Earth with stars, lighting, rotation, drag, and zoom.

The repository does not yet have:

- A `backend/` FastAPI application.
- Baidu Map scripts, access keys, POI lookup, or route lookup.
- AI provider integration.
- Canonical `TripPlan` models.
- StoryTimeline compilation or route playback UI.

## Core invariants

- AI can reason about preferences and scheduling but cannot be the source of map facts.
- Every playable POI has a stable source UID, name, address, and BD-09 coordinate. Full-real mode requires Baidu verification; fixture mode uses deterministic fixture UIDs.
- Every playable route has provider-sourced geometry, distance, and duration.
- A plan with invalid POIs or missing route legs is not playable.
- A timeline is accepted only when its `tripId` and `version` match the active plan.
- Map and animation modules consume domain commands; they do not parse free-form model output.
- Provider failures produce explicit structured errors and never fake success.

## Immediate development sequence

1. Build a static Nanjing `TripPlan` and `StoryTimeline` fixture.
2. Prove the JSAPI Three and R3F integration on one visible map stage.
3. Implement StoryPlayer commands and deterministic route playback against the fixture.
4. Add the FastAPI skeleton and mock map/model Adapters.
5. Replace mock map data with real Baidu POI and route data.
6. Add AI planning constrained to the verified candidate set.
7. Add plan revision, recovery states, local persistence, and performance work.

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-08-18 | China-only MVP | Street-level accuracy and provider constraints require a focused launch region. |
| 2026-08-18 | Python FastAPI backend | The user has Python familiarity and wants backend development support. |
| 2026-08-18 | No login in MVP | Login does not prove the core planning and playback experience. |
| 2026-08-18 | R3F for custom animation, Baidu for map truth | This keeps creative control without rebuilding a street map engine. |
| 2026-08-18 | Local-first delivery | The product flow should be useful before deployment work begins. |

## When to update this file

Update this context when the supported region, MVP scope, provider choice, canonical data model, current implementation state, or next development milestone changes. Move lasting interface details into the architecture spec rather than expanding this file indefinitely.
