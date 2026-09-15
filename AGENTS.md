<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lumivo AI Project Rules

## Read before changing the project

1. Read `CONTEXT.md` for the current product state and accepted decisions.
2. Read `docs/superpowers/specs/2026-08-18-local-first-ai-travel-map-design.md` for the MVP architecture and contracts.
3. Before changing Next.js code, read the relevant installed guide under `node_modules/next/dist/docs/` as required above.
4. Inspect the current worktree before editing. Preserve unrelated and user-authored changes.

## Product scope

Lumivo AI is a China-first AI trip planner with street-level map browsing and route-story animation. The current local milestone is a basic `/ai` chat for arbitrary China destinations plus the existing Nanjing map/story fixture; a verified itinerary flow is still a later integration milestone.

The MVP does not include production deployment, authentication, cloud sync, a database, Redis, task queues, real-time GPS navigation, rerouting, or overseas planning. Overseas requests must return the explicit unsupported-region result; do not silently provide an unverified plan.

## Current repository state

- The repository contains the Next.js frontend, an R3F Earth/map prototype, a TypeScript Node backend under `backend/`, and a basic `/ai` chat page.
- The backend currently provides a provider-neutral OpenAI-compatible chat endpoint. DeepSeek is the default local configuration; no map facts or verified itinerary are returned yet.
- Baidu Map integration for live POIs/routes and the map-backed planning orchestration remain planned modules.
- Do not describe planned capabilities as implemented unless a current source and a completed verification prove them.

## Architectural rules

- Design deep modules with small interfaces. Keep map-provider and model-provider details behind explicit seams. Keep MVP persistence details local to one focused module.
- Introduce an Adapter only where at least two implementations are used now, such as mock and real providers. Do not add speculative wrappers.
- `TripPlan` is the canonical validated itinerary. `StoryTimeline` is disposable playback data derived from one exact `tripId` and `version`.
- Use BD-09 for every coordinate crossing the map seam. Never mix WGS-84, GCJ-02, and BD-09 implicitly.
- AI may select and organize verified POIs, but it must not invent coordinates, map UIDs, route geometry, distance, or duration.
- Route geometry comes from the Baidu route Adapter. POI identity and coordinates come from the Baidu POI Adapter.
- The browser may store MVP drafts in `localStorage`; access storage through one focused module. Introduce a persistence interface only when a second Adapter, such as cloud storage, is actually implemented.

## Frontend rules

- Keep `app/page.tsx` as composition. Put map runtime, playback, planning UI, and domain state in focused modules.
- `MapStage` owns the visible map surface and map camera. `StoryPlayer` emits semantic commands and does not call Baidu or Three.js objects directly.
- During the integration spike, verify how R3F attaches custom objects and frame updates to the JSAPI Three scene. Do not ship two competing full-screen WebGL render loops.
- Use R3F for custom Earth and route effects; use Baidu as the authority for China basemap, projection, POI interaction, and street-level camera behavior.
- Respect reduced-motion preferences. Playback must provide pause, resume, replay, previous chapter, and next chapter controls.
- User-facing copy is Chinese unless a specific screen is designed otherwise.

## Backend rules

- The current backend language is TypeScript and the web layer uses Node's native `http` and `fetch`; keep the provider-neutral contracts in the focused `backend/` modules.
- The current AI seam accepts OpenAI-compatible Chat Completions providers. DeepSeek is only the default configuration; do not add provider-specific branches until a non-compatible provider is actually required.
- Keep future planning orchestration separate from provider clients and pure validation/compilation modules.
- Store provider keys only in ignored local environment files. Never place secrets in browser code, committed files, examples, fixtures, or logs.
- Return a structured error instead of fabricating provider or map data. The current synchronous chat slice does not retry provider failures.

## Required local verification

For frontend changes, run the checks relevant to the change and report only what actually passed:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

For backend changes, run focused Node tests first, then the complete backend suite with `npm run backend:test` and `npm run backend:typecheck`. Browser behavior, live Baidu responses, and live AI responses require their own evidence; a build does not prove them.

## Documentation discipline

- Update `CONTEXT.md` when a product decision, current-state fact, or immediate priority changes.
- Update the architecture spec when an interface, invariant, or MVP acceptance criterion changes.
- Keep `README.md` concise and newcomer-oriented.
- Do not put temporary progress notes or unverified claims in `AGENTS.md`.
