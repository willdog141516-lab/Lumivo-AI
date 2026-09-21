import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./trip-story-home.tsx", import.meta.url), "utf8");

test("trip story remounts the map when the active plan version changes", () => {
  assert.match(
    source,
    /<TripStoryExperience\s+key=\{`\$\{activeResult\.plan\.id\}:\$\{activeResult\.plan\.version\}`\}/,
  );
});
