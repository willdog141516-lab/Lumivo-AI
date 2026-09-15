import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as baiduMapStageModule from "./baidu-map-stage.tsx";
import { nanjingTripPlan } from "../../lib/trip/nanjing-fixture.ts";

const BaiduMapStage = baiduMapStageModule.default.default;

const renderStage = (isPlaying) =>
  renderToStaticMarkup(
    createElement(BaiduMapStage, {
      isPlaying,
      plan: nanjingTripPlan,
    }),
  );

test("playing state renders the compact map status card", () => {
  const html = renderStage(true);

  assert.match(html, /紧凑地图状态/);
  assert.doesNotMatch(html, /Engine：负责唯一 WebGL 渲染循环/);
});

test("non-playing state keeps the full map diagnostics", () => {
  const html = renderStage(false);

  assert.doesNotMatch(html, /紧凑地图状态/);
  assert.match(html, /Engine：负责唯一 WebGL 渲染循环/);
});
