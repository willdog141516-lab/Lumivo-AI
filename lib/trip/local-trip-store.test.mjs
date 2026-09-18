import assert from "node:assert/strict";
import test from "node:test";

import { loadActiveTrip, saveActiveTrip } from "./local-trip-store.ts";
import { nanjingPlanningResult } from "./nanjing-fixture.ts";

function createStorage(value) {
  let current = value;
  return {
    getItem: () => current,
    setItem: (_key, next) => { current = next; },
    removeItem: () => { current = null; },
  };
}

test("storage restores the canonical fixture from its marker", () => {
  const storage = createStorage(null);
  saveActiveTrip(nanjingPlanningResult, storage);
  assert.deepEqual(JSON.parse(storage.getItem()), {
    tripId: nanjingPlanningResult.plan.id,
    tripVersion: nanjingPlanningResult.plan.version,
  });
  assert.deepEqual(loadActiveTrip(storage), nanjingPlanningResult);
});

test("storage round-trips a revised version two result", () => {
  const storage = createStorage(null);
  const result = JSON.parse(JSON.stringify(nanjingPlanningResult));
  result.plan.version = 2;
  result.timeline.tripVersion = 2;

  saveActiveTrip(result, storage);

  assert.equal(loadActiveTrip(storage).plan.version, 2);
  assert.equal(loadActiveTrip(storage).timeline.tripVersion, 2);
});

test("storage removes corrupt or non-fixture markers and rejects mismatched results", () => {
  const corrupt = createStorage("not-json");
  assert.equal(loadActiveTrip(corrupt), null);
  assert.equal(corrupt.getItem(), null);

  const wrongFixture = createStorage(JSON.stringify({ tripId: "wrong-trip", tripVersion: 1 }));
  assert.equal(loadActiveTrip(wrongFixture), null);
  assert.equal(wrongFixture.getItem(), null);

  assert.throws(
    () => saveActiveTrip({
      ...nanjingPlanningResult,
      timeline: { ...nanjingPlanningResult.timeline, tripId: "wrong-trip" },
    }, createStorage(null)),
    /可播放行程/,
  );
});
