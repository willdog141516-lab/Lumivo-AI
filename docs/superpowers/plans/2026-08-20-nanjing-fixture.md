# Nanjing Fixture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic three-day Nanjing `TripPlan` and its matching `StoryTimeline` without introducing live providers or UI playback.

**Architecture:** Keep canonical trip and story contracts in a focused `lib/trip/types.ts` module. Keep all deterministic sample facts in `lib/trip/nanjing-fixture.ts`, with fixture-source POIs and route geometry whose endpoints match the plan. Validate the fixture through executable Node tests so the timeline identity and playback references cannot drift from the plan.

**Tech Stack:** TypeScript, Node.js built-in test runner, Next.js 16 type checking.

**Spec:** `docs/superpowers/specs/2026-08-18-local-first-ai-travel-map-design.md`

## Global Constraints

- The fixture is deterministic and does not call Baidu, an AI provider, or a backend.
- Every fixture coordinate crossing the future map seam uses `crs: "BD09"`.
- Fixture POIs use `source: "fixture"` and stable UIDs; they are not presented as live provider verification.
- `StoryTimeline.tripId` and `StoryTimeline.tripVersion` must match the exact fixture `TripPlan`.
- Keep `app/page.tsx` and the existing Earth prototype unchanged in this step.
- Preserve unrelated user changes already present in the worktree.

---

### Task 1: Define canonical frontend domain contracts

**Files:**
- Create: `lib/trip/types.ts`
- Test: `lib/trip/nanjing-fixture.test.mjs`

**Interfaces:**
- Produces `GeoPoint`, `VerifiedPoi`, `TripStop`, `RouteLeg`, `TripDay`, `TripPlan`, `StoryCommand`, `StoryChapter`, `StoryTimeline`, and `PlanningResult` types matching the architecture spec.

- [x] **Step 1: Write the failing test**

Create tests that import the not-yet-created fixture and assert that the plan has three days, each route leg connects adjacent stops, route geometry starts and ends at the corresponding POIs, and every timeline route command references a known route leg.

- [x] **Step 2: Run the focused test to verify it fails**

Run:

```text
node --test lib/trip/nanjing-fixture.test.mjs
```

Expected: FAIL because `lib/trip/nanjing-fixture.ts` does not exist yet.

- [x] **Step 3: Write the minimal contracts**

Add only the types required by the fixture and its tests. Keep provider-specific details out of these contracts.

- [x] **Step 4: Keep the red test gate until the fixture is implemented**

The initial focused run failed on the missing fixture import; the implementation proceeded only after this red gate was observed.

### Task 2: Add the deterministic Nanjing plan and timeline

**Files:**
- Create: `lib/trip/nanjing-fixture.ts`
- Test: `lib/trip/nanjing-fixture.test.mjs`

**Interfaces:**
- Produces `nanjingTripPlan: TripPlan`, `nanjingStoryTimeline: StoryTimeline`, and `nanjingPlanningResult: PlanningResult`.

- [x] **Step 1: Add fixture POIs and route legs**

Use stable fixture UIDs, fixed `verifiedAt` values, BD-09 points, positive stay/duration values, and route geometries whose first and last points are the referenced POI points.

- [x] **Step 2: Add the three-day plan**

Use three days with three stops and two route legs per day. Keep all narration grounded in the named fixture attractions.

- [x] **Step 3: Add the matching timeline**

Include introduction, globe focus, projection transition, camera focus, POI/narration commands, route draw/follow commands for every route leg, and a closing chapter. Use stable IDs and ensure the timeline points to plan ID/version `fixture-nanjing-3d`/`1`.

- [x] **Step 4: Run the focused test to verify it passes**

Run:

```text
node --test lib/trip/nanjing-fixture.test.mjs
```

Expected: all fixture invariant tests pass.

### Task 3: Record the completed current-state milestone

**Files:**
- Modify: `CONTEXT.md`

- [x] **Step 1: Update current implementation facts**

Record that the repository now contains the deterministic Nanjing `TripPlan`/`StoryTimeline` fixture, while the visual player, backend, Baidu integration, and AI integration remain unimplemented.

- [x] **Step 2: Run the repository checks**

Run:

```text
npm run lint
npx tsc --noEmit
npm run build
```

Report only commands that actually pass.

- [x] **Step 3: Review the final diff**

Confirm only the fixture, tests, plan documentation, and current-state documentation changed; leave the existing `package.json` modification untouched.
