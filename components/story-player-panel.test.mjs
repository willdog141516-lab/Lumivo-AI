import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as storyPlayerPanelModule from "./story-player-panel.tsx";
import {
  nanjingStoryTimeline,
  nanjingTripPlan,
} from "../lib/trip/nanjing-fixture.ts";

const StoryPlayerPanel = storyPlayerPanelModule.default.default;
const storyPlayerSource = await readFile(new URL("./story-player-panel.tsx", import.meta.url), "utf8");

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

test("playback title uses the current plan day count", () => {
  assert.match(storyPlayerSource, /plan\.days\.length/);
  assert.doesNotMatch(storyPlayerSource, /三日路线故事/);
});
