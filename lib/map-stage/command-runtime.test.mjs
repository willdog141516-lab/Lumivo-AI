import assert from "node:assert/strict";
import test from "node:test";

import { nanjingTripPlan } from "../trip/nanjing-fixture.ts";
import { createMapStageRuntime } from "./command-runtime.ts";

const command = (type, payload = {}) => ({
  id: `test-${type}`,
  chapterId: "test-chapter",
  type,
  startMs: 0,
  durationMs: 500,
  easing: "linear",
  payload,
});

test("translates playback commands into visible route and camera state", () => {
  const runtime = createMapStageRuntime(nanjingTripPlan);
  const target = { lng: 118.7945, lat: 32.0232, crs: "BD09" };

  runtime.apply(command("stage.clear"));
  runtime.apply(command("globe.focus", { target }));
  runtime.apply(command("projection.toFlat"));
  runtime.apply(command("camera.flyTo", { target, zoom: 14 }));
  runtime.apply(
    command("poi.show", { poiUid: "fixture-nanjing-fuzimiao" }),
  );
  runtime.apply(
    command("route.draw", {
      routeLegId: "fixture-route-day-1-fuzimiao-zhonghuamen",
    }),
  );
  runtime.apply(
    command("route.follow", {
      routeLegId: "fixture-route-day-1-fuzimiao-zhonghuamen",
    }),
  );

  assert.deepEqual(runtime.getState(), {
    projection: "flat",
    visiblePoiUids: ["fixture-nanjing-fuzimiao"],
    visibleRouteLegIds: ["fixture-route-day-1-fuzimiao-zhonghuamen"],
    activePoiUid: "fixture-nanjing-fuzimiao",
    activeRouteLegId: "fixture-route-day-1-fuzimiao-zhonghuamen",
    cameraTarget: target,
    cameraZoom: 14,
  });
});

test("clearing the stage removes previous markers and routes", () => {
  const runtime = createMapStageRuntime(nanjingTripPlan);

  runtime.apply(
    command("poi.show", { poiUid: "fixture-nanjing-fuzimiao" }),
  );
  runtime.apply(
    command("route.draw", {
      routeLegId: "fixture-route-day-1-fuzimiao-zhonghuamen",
    }),
  );
  runtime.apply(command("stage.clear"));

  assert.deepEqual(runtime.getState(), {
    projection: "globe",
    visiblePoiUids: [],
    visibleRouteLegIds: [],
    activePoiUid: null,
    activeRouteLegId: null,
    cameraTarget: null,
    cameraZoom: null,
  });
});

test("drawing a new route keeps the previous route line visible", () => {
  const runtime = createMapStageRuntime(nanjingTripPlan);

  runtime.apply(
    command("route.draw", {
      routeLegId: "fixture-route-day-1-fuzimiao-zhonghuamen",
    }),
  );
  runtime.apply(
    command("route.draw", {
      routeLegId: "fixture-route-day-1-zhonghuamen-laomendong",
    }),
  );

  assert.deepEqual(runtime.getState().visibleRouteLegIds, [
    "fixture-route-day-1-fuzimiao-zhonghuamen",
    "fixture-route-day-1-zhonghuamen-laomendong",
  ]);
});
