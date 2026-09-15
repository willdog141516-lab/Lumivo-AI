import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as storyPlayerPanelModule from "./story-player-panel.tsx";
import {
  nanjingStoryTimeline,
  nanjingTripPlan,
} from "../lib/trip/nanjing-fixture.ts";

const StoryPlayerPanel = storyPlayerPanelModule.default.default;

const playerFor = (status) => ({
  getState: () => ({
    status,
    chapterIndex: 0,
    chapterId: "chapter-intro",
    elapsedMs: 4000,
    totalMs: nanjingStoryTimeline.durationMs,
    activeNarration: null,
  }),
  subscribe: () => () => {},
});

test("playing state renders the compact playback console", () => {
  const html = renderToStaticMarkup(
    createElement(StoryPlayerPanel, {
      plan: nanjingTripPlan,
      player: playerFor("playing"),
      timeline: nanjingStoryTimeline,
    }),
  );

  assert.match(html, /紧凑播放控制台/);
  assert.doesNotMatch(html, /上一章/);
  assert.match(html, /展开/);
});

test("paused state keeps the full playback console", () => {
  const html = renderToStaticMarkup(
    createElement(StoryPlayerPanel, {
      plan: nanjingTripPlan,
      player: playerFor("paused"),
      timeline: nanjingStoryTimeline,
    }),
  );

  assert.doesNotMatch(html, /紧凑播放控制台/);
  assert.match(html, /上一章/);
});
