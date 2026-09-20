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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("storage restores the canonical fixture result", () => {
  const storage = createStorage(null);
  saveActiveTrip(nanjingPlanningResult, storage);
  assert.deepEqual(JSON.parse(storage.getItem()), nanjingPlanningResult);
  assert.deepEqual(loadActiveTrip(storage), nanjingPlanningResult);
});

test("storage restores the legacy canonical fixture marker", () => {
  const storage = createStorage(JSON.stringify({
    tripId: nanjingPlanningResult.plan.id,
    tripVersion: nanjingPlanningResult.plan.version,
  }));
  assert.deepEqual(loadActiveTrip(storage), nanjingPlanningResult);
});

test("storage restores a verified result for the selected destination", () => {
  const storage = createStorage(null);
  const result = {
    plan: {
      ...nanjingPlanningResult.plan,
      id: "trip-chengdu-1",
      destination: "成都",
    },
    timeline: {
      ...nanjingPlanningResult.timeline,
      tripId: "trip-chengdu-1",
    },
  };

  saveActiveTrip(result, storage);

  assert.deepEqual(loadActiveTrip(storage), result);
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

test("storage returns a stable snapshot for unchanged active trip", () => {
  const storage = createStorage(null);
  saveActiveTrip(nanjingPlanningResult, storage);

  const first = loadActiveTrip(storage);
  const second = loadActiveTrip(storage);

  assert.equal(second, first);
});

test("storage rejects a timeline narration that differs from the plan stop", () => {
  const result = clone(nanjingPlanningResult);
  const command = result.timeline.chapters
    .flatMap((chapter) => chapter.commands)
    .find((candidate) => candidate.type === "narration.show" && candidate.payload.poiUid);

  command.payload.text = "这段旁白不属于当前 POI";

  assert.throws(
    () => saveActiveTrip(result, createStorage(null)),
    /可播放行程校验失败/,
  );
});

test("storage rejects a narration with no POI name anchor", () => {
  const result = clone(nanjingPlanningResult);
  const stop = result.plan.days[0].stops[0];

  stop.poi.name = "五凤溪古镇";

  assert.throws(
    () => saveActiveTrip(result, createStorage(null)),
    /可播放行程校验失败/,
  );
});

test("storage rejects a timeline route command for an unknown route", () => {
  const result = clone(nanjingPlanningResult);
  const command = result.timeline.chapters
    .flatMap((chapter) => chapter.commands)
    .find((candidate) => candidate.type === "route.draw");

  command.payload.routeLegId = "unknown-route";

  assert.throws(
    () => saveActiveTrip(result, createStorage(null)),
    /可播放行程校验失败/,
  );
});

test("storage clears a cached timeline whose narration no longer matches the plan", () => {
  const result = clone(nanjingPlanningResult);
  const command = result.timeline.chapters
    .flatMap((chapter) => chapter.commands)
    .find((candidate) => candidate.type === "narration.show" && candidate.payload.poiUid);

  command.payload.text = "不应从缓存中播放的旁白";
  const storage = createStorage(JSON.stringify(result));

  assert.equal(loadActiveTrip(storage), null);
  assert.equal(storage.getItem(), null);
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
