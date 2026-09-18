import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./ai-chat.tsx", import.meta.url), "utf8");

test("playable planning uses the streamed TripClient", () => {
  assert.match(source, /TripClient/);
  assert.match(source, /planTrip/);
  assert.match(source, /planningStatus/);
  assert.match(source, /onProgress/);
  assert.doesNotMatch(source, /\/api\/trips\/plan/);
});
