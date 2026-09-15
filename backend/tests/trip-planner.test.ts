import assert from "node:assert/strict";
import test from "node:test";

import type { AiClient } from "../ai-client.js";
import { createFixtureTripPlanner, TripPlannerError } from "../trip-planner.js";
import { nanjingPlanningResult, nanjingTripPlan } from "../../lib/trip/nanjing-fixture.js";

function fixtureSelection() {
  return {
    days: nanjingTripPlan.days.map((day) => ({
      day: day.day,
      poiUids: day.stops.map((stop) => stop.poi.uid),
    })),
  };
}

const validSelection = JSON.stringify(fixtureSelection());

function fakeClient(content: string, onCall?: (prompt: string) => void): AiClient {
  return {
    async complete(request) {
      onCall?.(request.message);
      return { message: { role: "assistant", content } };
    },
  };
}

test("fixture planner returns the existing playable result after valid UID selection", async () => {
  let prompt = "";
  const result = await createFixtureTripPlanner(
    fakeClient(validSelection, (value) => { prompt = value; }),
  ).plan({
    message: "想看历史和老街",
    destination: "南京市",
    days: 3,
    history: [],
  });

  assert.deepEqual(result, nanjingPlanningResult);
  assert.match(prompt, /fixture-nanjing-fuzimiao/);
  assert.match(prompt, /夫子庙-秦淮风光带/);
  assert.doesNotMatch(prompt, /118\.7945/);
});

for (const [name, content] of [
  ["malformed JSON", "not-json"],
  ["unknown UID", JSON.stringify({
    days: fixtureSelection().days.map((day) => day.day === 1
      ? { ...day, poiUids: ["unknown", ...day.poiUids.slice(1)] }
      : day),
  })],
  ["duplicate UID", JSON.stringify({
    days: fixtureSelection().days.map((day) => day.day === 1
      ? { ...day, poiUids: [day.poiUids[0], day.poiUids[0], ...day.poiUids.slice(2)] }
      : day),
  })],
  ["missing day", JSON.stringify({ days: fixtureSelection().days.slice(0, -1) })],
  ["wrong schedule", JSON.stringify({
    days: fixtureSelection().days.map((day) => ({ ...day, poiUids: [...day.poiUids].reverse() })),
  })],
] as const) {
  test("fixture planner rejects " + name, async () => {
    await assert.rejects(
      () => createFixtureTripPlanner(fakeClient(content)).plan({
        message: "规划行程",
        destination: "南京",
        days: 3,
        history: [],
      }),
      (error: Error & { code?: string }) =>
        error instanceof TripPlannerError && error.code === "MODEL_OUTPUT_INVALID",
    );
  });
}

test("fixture planner rejects overseas destinations before calling AI", async () => {
  let calls = 0;
  await assert.rejects(
    () => createFixtureTripPlanner(fakeClient(validSelection, () => { calls += 1; })).plan({
      message: "帮我规划巴黎旅行",
      destination: "巴黎",
      days: 3,
      history: [],
    }),
    (error: Error & { code?: string }) => error.code === "UNSUPPORTED_REGION",
  );
  assert.equal(calls, 0);
});

test("fixture planner rejects uncovered China destinations before calling AI", async () => {
  let calls = 0;
  await assert.rejects(
    () => createFixtureTripPlanner(fakeClient(validSelection, () => { calls += 1; })).plan({
      message: "帮我规划成都旅行",
      destination: "成都",
      days: 3,
      history: [],
    }),
    (error: Error & { code?: string }) => error.code === "PLAN_NOT_AVAILABLE",
  );
  assert.equal(calls, 0);
});
