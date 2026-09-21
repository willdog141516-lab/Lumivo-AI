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
  assert.doesNotMatch(html, /backdrop-blur/);
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
  assert.doesNotMatch(html, /backdrop-blur/);
});

test("playback title uses the current plan day count", () => {
  assert.match(storyPlayerSource, /plan\.days\.length/);
  assert.doesNotMatch(storyPlayerSource, /三日路线故事/);
});

test("story console keeps the first route leg while condensing the rest", () => {
  const transitPlan = {
    ...nanjingTripPlan,
    days: nanjingTripPlan.days.map((day, index) => index === 0
      ? {
        ...day,
        routeLegs: day.routeLegs.map((leg) => ({
          ...leg,
          mode: "transit",
          instructions: ["步行至地铁 3 号线"],
        })),
      }
      : day),
  };
  const html = renderToStaticMarkup(
    createElement(StoryPlayerPanel, {
      plan: transitPlan,
      player: playerFor("paused"),
      timeline: nanjingStoryTimeline,
    }),
  );

  assert.match(html, /交通方式/);
  assert.match(html, /第1天 夫子庙-秦淮风光带 → 中华门 · 公共交通（等 1 段）/);
  assert.doesNotMatch(html, /步行至地铁 3 号线/);
  assert.doesNotMatch(html, /夫子庙 → 中华门/);
  assert.match(storyPlayerSource, /transportSummary/);
});

test("story console skips a day with no cross-POI route", () => {
  const oneStopPlan = {
    ...nanjingTripPlan,
    days: nanjingTripPlan.days.map((day) => day.day === 2
      ? { ...day, stops: day.stops.slice(0, 1), routeLegs: [] }
      : day),
  };
  const html = renderToStaticMarkup(
    createElement(StoryPlayerPanel, {
      plan: oneStopPlan,
      player: playerFor("paused"),
      timeline: nanjingStoryTimeline,
    }),
  );

  assert.doesNotMatch(html, /当天只有一个地点，无跨地点交通/);
  assert.doesNotMatch(html, /第2天 ·/);
});
