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
const globalStylesSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

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
      onTransportChange: () => {},
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
      onTransportChange: () => {},
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
      onTransportChange: () => {},
      player: playerFor("paused"),
      timeline: nanjingStoryTimeline,
    }),
  );

  assert.match(html, /交通方式/);
  assert.match(html, /第1天 夫子庙-秦淮风光带 → 中华门 · <svg[\s\S]*#icon-a-211_ditie[\s\S]*<\/svg> 公共交通（等 1 段）/);
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
      onTransportChange: () => {},
      player: playerFor("paused"),
      timeline: nanjingStoryTimeline,
    }),
  );

  assert.doesNotMatch(html, /当天只有一个地点，无跨地点交通/);
  assert.doesNotMatch(html, /第2天 ·/);
});

test("shows four real-route preference buttons on the Story Map", () => {
  const realPlan = {
    ...nanjingTripPlan,
    id: "trip-real",
    days: nanjingTripPlan.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => ({
        ...stop,
        poi: { ...stop.poi, source: "baidu" },
      })),
    })),
  };
  const html = renderToStaticMarkup(
    createElement(StoryPlayerPanel, {
      plan: realPlan,
      onTransportChange: () => {},
      player: playerFor("paused"),
      timeline: nanjingStoryTimeline,
    }),
  );
  const transportButtons = html.match(/<button[^>]*aria-label="优先方式：[^\"]+"[^>]*>/g) ?? [];

  assert.equal(transportButtons.length, 4);
  assert.ok(transportButtons.every((button) => !button.includes("disabled=\"\"")));
  for (const label of ["公共交通", "驾车", "步行", "骑行"]) {
    assert.ok(html.includes(label), "missing " + label);
  }
});

test("uses the loaded cycling iconfont symbol", () => {
  const html = renderToStaticMarkup(
    createElement(StoryPlayerPanel, {
      plan: nanjingTripPlan,
      onTransportChange: () => {},
      player: playerFor("paused"),
      timeline: nanjingStoryTimeline,
    }),
  );

  assert.match(html, /#icon-qixing/);
  assert.match(layoutSource, /font_5234803_u4o95pafjxi\.js/);
});

test("places transport preference controls in the upper left", () => {
  const realPlan = {
    ...nanjingTripPlan,
    days: nanjingTripPlan.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => ({
        ...stop,
        poi: { ...stop.poi, source: "baidu" },
      })),
    })),
  };
  const html = renderToStaticMarkup(
    createElement(StoryPlayerPanel, {
      plan: realPlan,
      onTransportChange: () => {},
      player: playerFor("paused"),
      timeline: nanjingStoryTimeline,
    }),
  );

  assert.match(html, /<section aria-label="优先出行方式控件" class="story-player-transport pointer-events-auto absolute left-5 top-20 z-20/);
});

test("applies light theme colors to the transport preference overlay", () => {
  assert.match(globalStylesSource, /\.light \.story-player-transport > div[\s\S]*background-color: var\(--lumivo-surface\)/);
  assert.match(globalStylesSource, /\.light \.story-player-transport > div[\s\S]*border-color: var\(--lumivo-accent-border\)/);
  assert.match(globalStylesSource, /\.light \.story-player-transport \[aria-pressed="true"\][\s\S]*background-color: var\(--lumivo-accent-soft\)/);
});

test("keeps fixture routes fixed and explains why transport switching is disabled", () => {
  const html = renderToStaticMarkup(
    createElement(StoryPlayerPanel, {
      plan: nanjingTripPlan,
      onTransportChange: () => {},
      player: playerFor("paused"),
      timeline: nanjingStoryTimeline,
    }),
  );
  const transportButtons = html.match(/<button[^>]*aria-label="优先方式：[^\"]+"[^>]*>/g) ?? [];

  assert.equal(transportButtons.length, 4);
  assert.ok(transportButtons.every((button) => button.includes("disabled=\"\"")));
  assert.match(html, /示例路线固定，无法重新规划优先方式/);
});
