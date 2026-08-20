import assert from "node:assert/strict";
import test from "node:test";

import {
  nanjingStoryTimeline,
  nanjingTripPlan,
} from "./nanjing-fixture.ts";

test("Nanjing fixture contains three connected playable days", () => {
  assert.equal(nanjingTripPlan.id, "fixture-nanjing-3d");
  assert.equal(nanjingTripPlan.version, 1);
  assert.equal(nanjingTripPlan.destination, "南京");
  assert.equal(nanjingTripPlan.days.length, 3);

  const poiIds = new Set();

  for (const day of nanjingTripPlan.days) {
    assert.equal(day.stops.length, 3);
    assert.equal(day.routeLegs.length, day.stops.length - 1);

    for (const stop of day.stops) {
      assert.equal(stop.poi.source, "fixture");
      assert.equal(stop.poi.point.crs, "BD09");
      assert.ok(stop.poi.recommendedStayMinutes > 0);
      assert.ok(!poiIds.has(stop.poi.uid), `duplicate POI UID: ${stop.poi.uid}`);
      poiIds.add(stop.poi.uid);
    }

    for (const [index, routeLeg] of day.routeLegs.entries()) {
      const fromPoi = day.stops[index].poi;
      const toPoi = day.stops[index + 1].poi;

      assert.equal(routeLeg.fromPoiUid, fromPoi.uid);
      assert.equal(routeLeg.toPoiUid, toPoi.uid);
      assert.deepEqual(routeLeg.geometry[0], fromPoi.point);
      assert.deepEqual(routeLeg.geometry.at(-1), toPoi.point);
      assert.ok(routeLeg.geometry.length >= 2);
      assert.ok(routeLeg.distanceMeters > 0);
      assert.ok(routeLeg.durationSeconds > 0);
    }
  }

  assert.equal(poiIds.size, 9);
});

test("Nanjing timeline is bound to the plan and covers every route leg", () => {
  assert.equal(nanjingStoryTimeline.tripId, nanjingTripPlan.id);
  assert.equal(nanjingStoryTimeline.tripVersion, nanjingTripPlan.version);
  assert.ok(nanjingStoryTimeline.chapters.length >= 5);
  assert.equal(
    nanjingStoryTimeline.durationMs,
    nanjingStoryTimeline.chapters.reduce(
      (total, chapter) => total + chapter.durationMs,
      0,
    ),
  );

  const routeIds = nanjingTripPlan.days.flatMap((day) =>
    day.routeLegs.map((routeLeg) => routeLeg.id),
  );
  const drawnRouteIds = nanjingStoryTimeline.chapters.flatMap((chapter) =>
    chapter.commands
      .filter((command) => command.type === "route.draw")
      .map((command) => command.payload.routeLegId),
  );
  const followedRouteIds = nanjingStoryTimeline.chapters.flatMap((chapter) =>
    chapter.commands
      .filter((command) => command.type === "route.follow")
      .map((command) => command.payload.routeLegId),
  );

  assert.deepEqual([...new Set(drawnRouteIds)].sort(), [...routeIds].sort());
  assert.deepEqual([...new Set(followedRouteIds)].sort(), [...routeIds].sort());

  const allCommands = nanjingStoryTimeline.chapters.flatMap(
    (chapter) => chapter.commands,
  );
  assert.equal(new Set(allCommands.map((command) => command.id)).size, allCommands.length);
  assert.ok(allCommands.some((command) => command.type === "globe.focus"));
  assert.ok(allCommands.some((command) => command.type === "projection.toFlat"));
  assert.ok(allCommands.some((command) => command.type === "camera.flyTo"));
  assert.ok(allCommands.some((command) => command.type === "narration.show"));

  const plannedNarrations = new Map(
    nanjingTripPlan.days.flatMap((day) =>
      day.stops.map((stop) => [stop.poi.uid, stop.narration]),
    ),
  );
  const timelineNarrations = allCommands.filter(
    (command) => command.type === "narration.show" && command.payload.poiUid,
  );

  assert.equal(timelineNarrations.length, plannedNarrations.size);
  for (const command of timelineNarrations) {
    assert.equal(command.payload.text, plannedNarrations.get(command.payload.poiUid));
  }
});
