import assert from "node:assert/strict";
import test from "node:test";

import {
  getRingRevealDrawCount,
  isRingRevealComplete,
} from "./ring-reveal.ts";

test("reveals the ring mesh progressively over its draw duration", () => {
  assert.equal(getRingRevealDrawCount(1000, 1000), 0);
  assert.equal(getRingRevealDrawCount(1000, 1325), 192);
  assert.equal(getRingRevealDrawCount(1000, 1650), 384);
});

test("shows the complete ring when reduced motion is enabled", () => {
  assert.equal(getRingRevealDrawCount(1000, 1000, true), 384);
});

test("waits for the ring to finish drawing before it can rotate", () => {
  assert.equal(isRingRevealComplete(1000, 1325), false);
  assert.equal(isRingRevealComplete(1000, 1650), true);
});
