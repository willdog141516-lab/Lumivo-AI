import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(
  fileURLToPath(new URL("./ai-chat.tsx", import.meta.url)),
  "utf8",
);

test("switches from the intro layout to a full-height conversation layout", () => {
  assert.match(source, /const hasMessages = messages\.length > 0/);
  assert.match(source, /\{!hasMessages && \(/);
  assert.match(source, /hasMessages \? "justify-start py-5 sm:py-6"/);
  assert.match(source, /hasMessages \? "flex min-h-0 flex-1 flex-col"/);
  assert.match(source, /max-h-none flex-1 min-h-0/);
});

test("keeps the newest streaming output visible", () => {
  assert.match(source, /useEffect, useRef, useState/);
  assert.match(source, /const messagesRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(source, /messagesElement\.scrollTop = messagesElement\.scrollHeight/);
  assert.match(source, /ref=\{messagesRef\}/);
});
