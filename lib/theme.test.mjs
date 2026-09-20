import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTheme,
  getNextTheme,
  readTheme,
  writeTheme,
} from "./theme.ts";

function createStorage(value = null) {
  let current = value;
  return {
    getItem: () => current,
    setItem: (_key, next) => { current = next; },
  };
}

test("persists light theme and falls back to dark for unknown values", () => {
  const storage = createStorage();

  assert.equal(readTheme(storage), "dark");
  writeTheme("light", storage);
  assert.equal(readTheme(storage), "light");
  writeTheme("sepia", storage);
  assert.equal(readTheme(storage), "dark");
});

test("applies exactly one theme class and matching color scheme", () => {
  const classNames = new Set(["dark", "light"]);
  const root = {
    classList: {
      toggle(name, force) {
        if (force) classNames.add(name);
        else classNames.delete(name);
      },
    },
    style: { colorScheme: "" },
  };

  applyTheme("light", root);
  assert.equal(classNames.has("light"), true);
  assert.equal(classNames.has("dark"), false);
  assert.equal(root.style.colorScheme, "light");

  applyTheme("dark", root);
  assert.equal(classNames.has("dark"), true);
  assert.equal(classNames.has("light"), false);
  assert.equal(root.style.colorScheme, "dark");
});

test("toggles between the two supported themes", () => {
  assert.equal(getNextTheme("dark"), "light");
  assert.equal(getNextTheme("light"), "dark");
});
