import assert from "node:assert/strict";
import test from "node:test";

import * as routeAnimation from "./route-animation.ts";

const { createRouteSampler, getRouteAnimationProgress } = routeAnimation;

const points = [
  { lng: 0, lat: 0, crs: "BD09" },
  { lng: 10, lat: 0, crs: "BD09" },
  { lng: 10, lat: 10, crs: "BD09" },
];

test("route progress is bounded and respects easing and reduced motion", () => {
  const phase = {
    startedAt: 1000,
    durationMs: 1000,
    easing: "easeInOut",
  };

  assert.equal(getRouteAnimationProgress(phase, 1000), 0);
  assert.equal(getRouteAnimationProgress(phase, 1500), 0.5);
  assert.equal(getRouteAnimationProgress(phase, 2500), 1);
  assert.equal(getRouteAnimationProgress(phase, 1500, true), 1);
});

test("route sampler interpolates across every segment by distance", () => {
  const sample = createRouteSampler(points);

  assert.deepEqual(sample(0), {
    point: points[0],
    segmentIndex: 0,
    segmentProgress: 0,
  });
  assert.deepEqual(sample(0.25), {
    point: { lng: 5, lat: 0, crs: "BD09" },
    segmentIndex: 0,
    segmentProgress: 0.5,
  });
  assert.deepEqual(sample(0.75), {
    point: { lng: 10, lat: 5, crs: "BD09" },
    segmentIndex: 1,
    segmentProgress: 0.5,
  });
  assert.deepEqual(sample(1), {
    point: points[2],
    segmentIndex: 1,
    segmentProgress: 1,
  });
});

test("route animation frame keeps the moving marker on the drawn route", () => {
  const getRouteAnimationFrame = routeAnimation.getRouteAnimationFrame;
  assert.equal(typeof getRouteAnimationFrame, "function");

  const sampler = createRouteSampler(points);
  const phase = { startedAt: 1000, durationMs: 1000, easing: "linear" };

  assert.deepEqual(getRouteAnimationFrame(sampler, phase, 1250), {
    progress: 0.25,
    sample: {
      point: { lng: 5, lat: 0, crs: "BD09" },
      segmentIndex: 0,
      segmentProgress: 0.5,
    },
  });
  assert.deepEqual(getRouteAnimationFrame(sampler, phase, 1250, true), {
    progress: 1,
    sample: {
      point: points[2],
      segmentIndex: 1,
      segmentProgress: 1,
    },
  });
});
