import assert from "node:assert/strict";
import test from "node:test";
import * as TripStoryHomeModule from "../../components/trip-story-home.tsx";
import * as TripPageModule from "./page.tsx";

const TripStoryHome = TripStoryHomeModule.default.default ?? TripStoryHomeModule.default;
const TripPage = TripPageModule.default.default ?? TripPageModule.default;

test("trip route renders the playable story home", () => {
  const element = TripPage();

  assert.equal(element.type, TripStoryHome);
  assert.equal(element.props.fallback.plan.destination, "南京");
});
