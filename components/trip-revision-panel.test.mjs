import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./trip-revision-panel.tsx", import.meta.url), "utf8");

test("trip revision panel uses a native accessible form and persists revisions", () => {
  assert.match(source, /<details/);
  assert.match(source, /trip-revision-day/);
  assert.match(source, /trip-revision-instruction/);
  assert.match(source, /reviseTrip/);
  assert.match(source, /saveActiveTrip/);
  assert.match(source, /aria-live/);
});
