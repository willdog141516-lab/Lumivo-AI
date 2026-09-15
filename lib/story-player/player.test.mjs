import assert from "node:assert/strict";
import test from "node:test";

import {
  nanjingStoryTimeline,
  nanjingTripPlan,
} from "../trip/nanjing-fixture.ts";
import { createStoryPlayer } from "./player.ts";

test("player emits deterministic commands as the story advances", () => {
  const commands = [];
  const player = createStoryPlayer((command) => commands.push(command));

  player.load({ plan: nanjingTripPlan, timeline: nanjingStoryTimeline });
  player.play();
  player.advance(4000);

  assert.equal(player.getState().status, "playing");
  assert.equal(player.getState().chapterId, "chapter-intro");
  assert.equal(
    player.getState().activeNarration?.text,
    "南京三日行程，从秦淮河畔开始。",
  );
  assert.deepEqual(
    commands.map(({ type }) => type),
    ["stage.clear", "globe.focus", "projection.toFlat", "camera.flyTo", "narration.show"],
  );
});

test("player pause freezes time and play resumes from the same position", () => {
  const player = createStoryPlayer();

  player.load({ plan: nanjingTripPlan, timeline: nanjingStoryTimeline });
  player.play();
  player.advance(7000);
  player.pause();

  const pausedAt = player.getState().elapsedMs;
  player.advance(3000);
  assert.equal(player.getState().elapsedMs, pausedAt);

  player.play();
  player.advance(500);
  assert.equal(player.getState().elapsedMs, pausedAt + 500);
});

test("player chapter controls rebuild the stage and replay starts from the beginning", () => {
  const commands = [];
  const player = createStoryPlayer((command) => commands.push(command));

  player.load({ plan: nanjingTripPlan, timeline: nanjingStoryTimeline });
  player.next();
  assert.equal(player.getState().chapterId, "chapter-day-1");
  assert.equal(player.getState().status, "paused");
  assert.equal(player.getState().activeNarration, null);

  player.previous();
  assert.equal(player.getState().chapterId, "chapter-intro");

  player.seekChapter(999);
  assert.equal(player.getState().chapterId, "chapter-closing");

  player.replay();
  assert.equal(player.getState().status, "playing");
  assert.equal(player.getState().elapsedMs, 0);
  assert.equal(commands.at(-1)?.type, "globe.focus");
});

test("player rejects a timeline whose identity does not match the plan", () => {
  const player = createStoryPlayer();

  assert.throws(
    () =>
      player.load({
        plan: { ...nanjingTripPlan, version: 2 },
        timeline: nanjingStoryTimeline,
      }),
    (error) => error.code === "TIMELINE_MISMATCH",
  );
});

test("player replaces the active story when the new plan and timeline version match", () => {
  const player = createStoryPlayer();
  const revisedPlan = { ...nanjingTripPlan, version: 2 };
  const revisedTimeline = { ...nanjingStoryTimeline, tripVersion: 2 };

  player.load({ plan: nanjingTripPlan, timeline: nanjingStoryTimeline });
  player.play();
  player.advance(4000);
  player.load({ plan: revisedPlan, timeline: revisedTimeline });

  assert.equal(player.getState().status, "paused");
  assert.equal(player.getState().elapsedMs, 0);
  assert.equal(player.getState().totalMs, revisedTimeline.durationMs);
});

test("player reaches a stable completed state at the timeline duration", () => {
  const player = createStoryPlayer();

  player.load({ plan: nanjingTripPlan, timeline: nanjingStoryTimeline });
  player.play();
  player.advance(nanjingStoryTimeline.durationMs + 1000);

  assert.equal(player.getState().status, "completed");
  assert.equal(player.getState().elapsedMs, nanjingStoryTimeline.durationMs);
  player.play();
  assert.equal(player.getState().status, "completed");
});

test("player notifies subscribers with a snapshot of each state change", () => {
  const player = createStoryPlayer();
  const states = [];
  const unsubscribe = player.subscribe((state) => states.push(state));

  player.load({ plan: nanjingTripPlan, timeline: nanjingStoryTimeline });
  player.play();
  unsubscribe();
  player.pause();

  assert.deepEqual(
    states.map(({ status }) => status),
    ["paused", "playing"],
  );
  assert.notEqual(states[0], player.getState());
});
