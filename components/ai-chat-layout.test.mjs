import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const componentSource = readFileSync(
  fileURLToPath(new URL("./ai-chat.tsx", import.meta.url)),
  "utf8",
);
const stylesSource = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8",
);

test("switches from the intro layout to a full-height conversation layout", () => {
  assert.match(componentSource, /const hasMessages = messages\.length > 0/);
  assert.match(componentSource, /aria-hidden=\{hasMessages\}/);
  assert.match(componentSource, /hasMessages \? "ai-home-intro-hidden"/);
  assert.match(componentSource, /hasMessages \? "justify-start py-5 sm:py-6"/);
  assert.match(componentSource, /hasMessages \? "ai-home-chat-card-active flex min-h-0 flex-1 flex-col"/);
  assert.match(componentSource, /max-h-none flex-1 min-h-0/);
});

test("keeps the newest streaming output visible", () => {
  assert.match(componentSource, /useEffect, useRef, useState/);
  assert.match(componentSource, /const messagesRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(componentSource, /messagesElement\.scrollTop = messagesElement\.scrollHeight/);
  assert.match(componentSource, /ref=\{messagesRef\}/);
});

test("keeps quick prompts while giving the removed options row to chat", () => {
  assert.match(componentSource, /ai-home-chat-card-active/);
  assert.match(componentSource, /ai-home-composer-active/);
  assert.doesNotMatch(componentSource, /<details/);
  assert.doesNotMatch(componentSource, /planOptionsOpen/);
  assert.match(componentSource, /ai-home-composer[\s\S]*ai-home-aux-controls/);
  assert.doesNotMatch(componentSource, /setDestination\(nextDestination\)/);
  assert.doesNotMatch(componentSource, /setDays\(nextDays\)/);
  assert.doesNotMatch(stylesSource, /\.ai-home-chat-card-active\s*\{[\s\S]*min-height: 90%/);
  assert.doesNotMatch(stylesSource, /\.ai-home-chat-card-active \.ai-home-message-log[\s\S]*min-height: 60%/);
  assert.match(stylesSource, /\.ai-home-composer-active textarea[\s\S]*min-height: 3rem/);
  assert.match(stylesSource, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(stylesSource, /\.ai-home-plan-options/);
  assert.doesNotMatch(stylesSource, /\.ai-home-days/);
});

test("keeps the itinerary action inside the active chat card", () => {
  assert.match(
    componentSource,
    /ai-home-chat-card-active[\s\S]*\{hasMessages && \([\s\S]*ai-home-plan-cta/,
  );
});

test("sends the complete dialogue to playable planning", () => {
  assert.match(componentSource, /history: messages/);
  assert.match(componentSource, /if \(isBusy \|\| !hasMessages\)/);
  assert.doesNotMatch(componentSource, /const canPlan/);
});

test("keeps transport preference controls on the Story Map instead of AI chat", () => {
  assert.doesNotMatch(componentSource, /preferred-transport|transportOptions|TransportMode/);
  assert.doesNotMatch(componentSource, /history: messages,\s*transport,/);
});

test("keeps the generated plan in the dialogue before opening the map story", () => {
  assert.match(componentSource, /transportSummaryMarkdown\(result\.plan\)/);
  assert.match(componentSource, /const \[hasPlayablePlan, setHasPlayablePlan\] = useState\(false\)/);
  assert.match(componentSource, /hasPlayablePlan \? "查看地图故事 ↗"/);
  assert.match(componentSource, /onClick=\{hasPlayablePlan \? \(\) => router\.push\("\/trip"\) : createPlayablePlan\}/);
});

test("gives released composer spacing to the conversation log", () => {
  assert.match(componentSource, /ai-home-composer space-y-2/);
  assert.match(componentSource, /<p className="mt-3 text-center text-xs/);
  assert.doesNotMatch(stylesSource, /\.ai-home-composer-active > div/);
  assert.match(
    stylesSource,
    /\.ai-home-composer-active \.ai-home-composer-field\s*\{[\s\S]*padding: 0\.5rem 0\.75rem/,
  );
  assert.match(componentSource, /<footer className="flex items-center justify-between border-t border-white\/10 pt-3/);
});

test("keeps the explore action readable in the light theme", () => {
  assert.match(componentSource, /className="ai-home-submit flex h-12/);
  assert.match(
    stylesSource,
    /\.light \.ai-home \.ai-home-submit\s*\{[\s\S]*background-color: var\(--lumivo-accent-text\) !important;[\s\S]*color: white !important;/,
  );
  assert.match(
    stylesSource,
    /\.light \.ai-home \.ai-home-submit:disabled\s*\{[\s\S]*opacity: 1 !important;[\s\S]*background-color: var\(--lumivo-accent-soft\) !important;[\s\S]*color: var\(--lumivo-accent-text\) !important;/,
  );
});
