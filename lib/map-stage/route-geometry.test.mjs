import assert from "node:assert/strict";
import test from "node:test";

import { createProjectedRoutePositions } from "./route-geometry.ts";

test("projects each route point into a reusable position buffer", () => {
  const points = [
    { lng: 1, lat: 2, crs: "BD09" },
    { lng: 3, lat: 4, crs: "BD09" },
  ];
  const calls = [];

  const positions = createProjectedRoutePositions(points, (input, output) => {
    calls.push(input);
    output[0] = input[0] * 10;
    output[1] = input[1] * 10;
    output[2] = 7;
    return output;
  });

  assert.deepEqual([...positions], [10, 20, 7, 30, 40, 7]);
  assert.deepEqual(calls, [
    [1, 2, 0],
    [3, 4, 0],
  ]);
});
