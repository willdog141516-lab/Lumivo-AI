# Story Map Playback Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `/trip` 故事地图的开发地址 hydration、行程/旁白错配、投影切换和路线视觉问题，并减少播放态的无效 WebGL 帧工作。

**Architecture:** 继续由 `StoryPlayer` 发出语义命令，`BaiduMapStage` 将命令翻译为 mapv-three 和 Three 对象操作；不增加 provider 私有加载接口，也不引入第二个渲染循环。行程校验仍放在现有本地存储边界，地图运行时状态通过 ref 在命令应用时同步，路线切换时只保留当前路线。

**Tech Stack:** Next.js 16, React, TypeScript, `@baidumap/mapv-three`, `@react-three/fiber`, Three.js, Node native test runner with `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-17-story-map-playback-repair-design.md`

## Global Constraints

- 保持 Engine 是唯一 WebGL 渲染循环；R3F 使用外部 render loop，暂停时停止连续渲染。
- 所有跨地图 seam 的坐标继续使用 BD-09；不得由 AI 或前端生成坐标、路线几何、距离或时长。
- `TripPlan` 是已验证行程，`StoryTimeline` 必须绑定同一 `tripId` 和 `version`。
- 不新增依赖、不覆盖现有用户未提交修改、不把本地 fixture 或 localStorage 描述成云同步/全国实况规划。
- 用户界面文案保持中文；遵守 `prefers-reduced-motion`。
- 每个生产行为改动先新增一个会失败的 focused test，确认失败原因后再实现。

---

### Task 1: 修复开发 origin、状态语义和地图浮层合成

**Files:**
- Modify: `next.config.ts`
- Modify: `components/map-stage/baidu-map-stage.tsx`
- Test: `components/map-stage/baidu-map-stage.test.mjs`
- Modify: `components/trip-story-experience.tsx`
- Modify: `app/globals.css`
- Test: `components/trip-story-experience.test.mjs`

**Interfaces:**
- `next.config.ts` exports the existing `NextConfig` with `allowedDevOrigins: ["127.0.0.1"]`.
- `BaiduMapStage` retains `onReady?: () => void`; only the user-facing label/message changes from “已连接” to an honest Engine-ready state.
- Existing return-link and theme-toggle DOM contracts remain unchanged except for removal of `backdrop-blur`/`backdrop-filter`.

- [ ] **Step 1: Add failing tests for the visible contracts**

  In `components/map-stage/baidu-map-stage.test.mjs`, assert the source contains the Engine-ready label and the explicit “底图可能仍在加载” wording, and assert it does not contain the old “已连接” label. In `components/trip-story-experience.test.mjs`, render the experience and assert the returned HTML does not contain `backdrop-blur`. Verify `next.config.ts` separately with `rg -n "allowedDevOrigins" next.config.ts`; configuration files are the TDD exception.

- [ ] **Step 2: Run the tests and verify they fail for the missing behavior**

  Run:

  ```powershell
  & 'C:\Users\dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import=tsx --test components/map-stage/baidu-map-stage.test.mjs components/trip-story-experience.test.mjs
  ```

  Expected: failure because the current source still renders “已连接” and the return link still contains `backdrop-blur-md`.

- [ ] **Step 3: Implement the minimal fixes**

  Add `allowedDevOrigins: ["127.0.0.1"]` to the existing `nextConfig`. Change the ready status label to `引擎就绪`; change the AK message to state that the Engine is ready while Baidu tiles may still be loading. Remove `backdrop-blur-md` from the return link and `backdrop-filter: blur(12px)` from `.theme-toggle`, preserving backgrounds, borders, shadows, hover, focus, and transition rules.

- [ ] **Step 4: Run the focused tests again**

  Run the same command from Step 2. Expected: all tests pass with zero failures.

- [ ] **Step 5: Commit only this task’s files**

  ```powershell
  git add -- next.config.ts components/map-stage/baidu-map-stage.tsx components/map-stage/baidu-map-stage.test.mjs components/trip-story-experience.tsx app/globals.css components/trip-story-experience.test.mjs
  git commit -m "fix: clarify story map readiness and reduce overlay blur"
  ```

### Task 2: Reject inconsistent cached plans and timelines

**Files:**
- Modify: `lib/trip/local-trip-store.ts`
- Test: `lib/trip/local-trip-store.test.mjs`

**Interfaces:**
- Keep `saveActiveTrip(result: PlanningResult, storage?: Storage): void` and `loadActiveTrip(storage?: Storage): PlanningResult | null` unchanged.
- Keep invalid-cache behavior unchanged: remove the raw entry and return `null`, allowing `TripStoryHome` to use the existing fixture fallback.

- [ ] **Step 1: Add a failing test for mismatched narration**

  Clone `nanjingPlanningResult`, replace one `narration.show` command’s `payload.text` while keeping its valid `poiUid`, and assert `saveActiveTrip` throws `/可播放行程/`. Add a second test with a timeline `route.draw` payload referencing an unknown route ID and assert the same rejection. Add a load test that serializes the mismatched result, calls `loadActiveTrip`, and asserts it returns `null` and clears storage.

- [ ] **Step 2: Run only the storage tests and verify RED**

  ```powershell
  & 'C:\Users\dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import=tsx --test lib/trip/local-trip-store.test.mjs
  ```

  Expected: the new tests fail because the current validator accepts structurally valid but semantically inconsistent timelines.

- [ ] **Step 3: Extend the existing validator at the storage boundary**

  In `isPlanningResult`, collect unique POI UIDs and their `TripStop.narration` values from `plan.days`; collect unique route IDs from `plan.days`. Validate each timeline chapter has a unique string ID and command array. For each command, require `command.chapterId` to equal the containing chapter ID; require `poi.show` payload UIDs to exist; require `route.draw`/`route.follow` payload route IDs to exist; require a `narration.show` payload with `poiUid` to reference an existing POI and exactly match that stop’s narration. Allow narration commands without `poiUid` for intro/closing copy. Preserve the existing plan/timeline ID/version checks and reject duplicate POI UIDs or route IDs rather than guessing.

- [ ] **Step 4: Run storage and fixture contract tests GREEN**

  ```powershell
  & 'C:\Users\dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import=tsx --test lib/trip/local-trip-store.test.mjs lib/trip/nanjing-fixture.test.mjs
  ```

  Expected: all tests pass, including the existing fixture assertion that every fixture narration matches its plan stop.

- [ ] **Step 5: Commit only this task’s files**

  ```powershell
  git add -- lib/trip/local-trip-store.ts lib/trip/local-trip-store.test.mjs
  git commit -m "fix: validate story timeline references"
  ```

### Task 3: Make runtime state cheap and old routes visually subordinate

**Files:**
- Modify: `components/map-stage/baidu-map-stage.tsx`
- Test: `components/map-stage/baidu-map-stage.test.mjs`

**Interfaces:**
- `StoryOverlay` consumes a `MutableRefObject<MapStageState>` instead of calling `runtime.getState()` on every render frame.
- `BaiduMapStageHandle.applyCommand` still accepts one `StoryCommand` and applies it in the same order; it additionally stores the returned state snapshot in the ref.

- [ ] **Step 1: Add failing source-level regression assertions**

  Assert `StoryOverlay` no longer assigns `runtime.getState()` inside a `useFrame` callback. Assert the route renderer contains an early hidden-route return, conditional `needsUpdate`, and lower opacity for inactive historical routes. Keep the existing one-render-object and no-per-frame-full-reprojection assertions.

- [ ] **Step 2: Run the map-stage tests and verify RED**

  ```powershell
  & 'C:\Users\dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import=tsx --test components/map-stage/baidu-map-stage.test.mjs
  ```

  Expected: the new assertions fail against the current per-frame `runtime.getState()` and unconditional `positionAttribute.needsUpdate = true`.

- [ ] **Step 3: Implement the frame-budget changes**

  Create one `runtimeStateRef` beside `runtime`, initialize it with `runtime.getState()`, pass it to `StoryOverlay`, and update it with the result of `runtime.apply(command)` before sending the command to the Engine. Remove the overlay `useFrame` state-copy callback. In `PoiMarker`, compute visibility before projection and return early for hidden POIs after resetting the ring state. In `RouteLine`, return early for hidden lines; set draw range and `needsUpdate` only when the line becomes visible, its animation progress changes, its animation start changes, or the projection/active state changes. Set inactive historical route opacity to about `0.2` and keep the active route near `0.98`.

- [ ] **Step 4: Run the map-stage and runtime tests GREEN**

  ```powershell
  & 'C:\Users\dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import=tsx --test components/map-stage/baidu-map-stage.test.mjs lib/map-stage/command-runtime.test.mjs lib/map-stage/engine-bridge.test.mjs lib/map-stage/route-animation.test.mjs
  ```

  Expected: all tests pass and the runtime still preserves prior route IDs while tracking one active route.

- [ ] **Step 5: Commit only this task’s files**

  ```powershell
  git add -- components/map-stage/baidu-map-stage.tsx components/map-stage/baidu-map-stage.test.mjs
  git commit -m "perf: avoid redundant story map frame work"
  ```

### Task 4: Restore the actual globe transition and add one lightweight route head

**Files:**
- Modify: `components/map-stage/baidu-map-stage.tsx`
- Test: `components/map-stage/baidu-map-stage.test.mjs`
- Modify: `lib/map-stage/engine-bridge.ts` only if the installed type requires a narrow projection type adjustment

**Interfaces:**
- Story command types remain unchanged: `globe.focus`, `projection.toFlat`, `route.draw`, and `route.follow` keep their existing payloads.
- `route.follow` continues to issue one map `flyTo`; no per-frame `setCenter`, `setZoom`, or new camera loop is introduced.

- [ ] **Step 1: Add failing assertions for projection and route-head behavior**

  In the map-stage source test, assert `globe.focus` selects `EPSG:4978`, `projection.toFlat` selects `EPSG:4326`, and the route renderer contains exactly one lightweight `travelHead` object path. Assert the source still has no `map.setCenter` or `map.setZoom` inside route playback.

- [ ] **Step 2: Run the map-stage test and verify RED**

  ```powershell
  & 'C:\Users\dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import=tsx --test components/map-stage/baidu-map-stage.test.mjs
  ```

  Expected: failure because the current globe command uses `EPSG:4326` and the current route renderer has no moving head.

- [ ] **Step 3: Implement the minimal animation**

  Parameterize the existing projection helper so only projection changes cancel an in-flight map flight. Use `EPSG:4978` for `globe.focus`, `EPSG:4326` for flat projection, and keep Engine initialization compatible with the existing map provider. Add one `THREE.Mesh` with a low-segment `SphereGeometry` and `MeshBasicMaterial`; place it at the active route sampler point, scale it from the active route’s projected coordinate unit, show it only while the active route animation is progressing, and hide it for reduced motion or stable/inactive routes. Update its position only for the active route; do not create one head per route vertex.

- [ ] **Step 4: Run animation and fixture tests GREEN**

  ```powershell
  & 'C:\Users\dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import=tsx --test components/map-stage/baidu-map-stage.test.mjs lib/map-stage/ring-reveal.test.mjs lib/map-stage/route-animation.test.mjs lib/trip/nanjing-fixture.test.mjs
  ```

  Expected: all tests pass; reduced-motion tests continue to complete animations immediately.

- [ ] **Step 5: Commit only this task’s files**

  ```powershell
  git add -- components/map-stage/baidu-map-stage.tsx components/map-stage/baidu-map-stage.test.mjs lib/map-stage/engine-bridge.ts
  git commit -m "feat: animate globe focus and route progress"
  ```

### Task 5: Run full verification and browser regression checks

**Files:**
- Modify: `CONTEXT.md` only after browser evidence confirms the new current-state wording

**Interfaces:**
- No new production interface; this task verifies the previous tasks together.

- [ ] **Step 1: Run the complete focused frontend suite**

  ```powershell
  & 'C:\Users\dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --import=tsx --test app/trip/page.test.mjs components/map-stage/baidu-map-stage.test.mjs components/story-player-panel.test.mjs components/trip-story-experience.test.mjs lib/map-stage/command-runtime.test.mjs lib/map-stage/engine-bridge.test.mjs lib/map-stage/ring-reveal.test.mjs lib/map-stage/route-animation.test.mjs lib/story-player/player.test.mjs lib/trip/local-trip-store.test.mjs lib/trip/nanjing-fixture.test.mjs
  ```

  Expected: zero failures.

- [ ] **Step 2: Run lint and typecheck**

  ```powershell
  npm run lint
  npx tsc --noEmit
  ```

  Record exact exit status. Do not call a cache-write-blocked build a pass.

- [ ] **Step 3: Run the production build separately**

  ```powershell
  npm run build
  ```

  If Windows blocks `.next/cache` or `.next/cache/.tsbuildinfo` with `EPERM`/`TS5033`, report it separately from lint, typecheck, tests, and browser results.

- [ ] **Step 4: Verify `/trip` in Chrome**

  Use `http://localhost:8989/trip` and verify the Canvas, Engine-ready wording, map tiles, start/pause/replay, chapter seek, theme toggle, visible globe-to-flat transition, moving route head, and that the previous route disappears when the next route starts. Confirm no new runtime errors and record any remaining non-fatal library deprecation warnings.

- [ ] **Step 5: Verify the dev-origin regression**

  Open `http://127.0.0.1:8989/trip` after the Next dev server reloads the config. Verify the page hydrates, has a Canvas, and the play button responds. If the already-running dev server does not reload `next.config.ts`, restart only the project’s existing dev server after confirming its PID/listener; do not kill unrelated processes.

- [ ] **Step 6: Update current-state documentation only with verified facts**

  Update the relevant `CONTEXT.md` paragraph to record the actual readiness wording and supported globe/flat behavior only if Chrome confirms both. Do not claim tile-ready telemetry or real route-follow camera tracking.

- [ ] **Step 7: Commit documentation and review the final diff**

  ```powershell
  git diff --check
  git status --short
  git add -- CONTEXT.md
  git commit -m "docs: record story map playback verification"
  ```

  Confirm unrelated pre-existing modifications remain untouched.
