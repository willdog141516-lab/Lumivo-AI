import assert from "node:assert/strict";
import test from "node:test";

import { nanjingTripPlan } from "./nanjing-fixture.ts";
import { transportSummaryMarkdown } from "./transport.ts";

test("transport summary keeps a day with no cross-POI route", () => {
  const plan = {
    ...nanjingTripPlan,
    days: nanjingTripPlan.days.map((day) => day.day === 2
      ? { ...day, stops: day.stops.slice(0, 1), routeLegs: [] }
      : day),
  };

  const summary = transportSummaryMarkdown(plan);

  assert.match(summary, /第2天/);
  assert.match(summary, /当天只有一个地点，无跨地点交通/);
});
