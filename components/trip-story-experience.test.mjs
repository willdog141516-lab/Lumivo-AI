import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as tripStoryExperienceModule from "./trip-story-experience.tsx";
import {
  nanjingStoryTimeline,
  nanjingTripPlan,
} from "../lib/trip/nanjing-fixture.ts";

const TripStoryExperience = tripStoryExperienceModule.default.default;

test("story experience provides a link back to the AI chat", () => {
  const html = renderToStaticMarkup(
    createElement(TripStoryExperience, {
      plan: nanjingTripPlan,
      timeline: nanjingStoryTimeline,
    }),
  );

  assert.match(html, /href="\/ai"/);
  assert.match(html, /返回问答/);
  assert.doesNotMatch(html, /backdrop-blur/);
});
