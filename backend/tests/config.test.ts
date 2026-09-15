import assert from "node:assert/strict";
import test from "node:test";

import { loadRuntimeConfig } from "../config.js";
import { parseChatRequest, parseTripPlanRequest } from "../types.js";

test("configuration prefers AI_API_KEY and normalizes the provider base URL", () => {
  const config = loadRuntimeConfig({
    AI_API_KEY: "ai-key",
    DEEPSEEK_API_KEY: "deepseek-key",
    AI_BASE_URL: "https://provider.example/v1/",
    AI_MODEL: "provider-model",
    AI_TIMEOUT_MS: "12000",
    CORS_ORIGIN: "http://localhost:8989",
  });

  assert.deepEqual(config, {
    port: 8000,
    baseUrl: "https://provider.example/v1",
    apiKey: "ai-key",
    model: "provider-model",
    timeoutMs: 12000,
    corsOrigin: "http://localhost:8989",
  });
});

test("configuration falls back to the DeepSeek key without exposing it elsewhere", () => {
  const config = loadRuntimeConfig({ DEEPSEEK_API_KEY: "deepseek-key" });

  assert.equal(config.apiKey, "deepseek-key");
  assert.equal(config.baseUrl, "https://api.deepseek.com");
  assert.equal(config.model, "deepseek-chat");
});

test("chat input trims valid fields and rejects oversized or unsafe history", () => {
  const request = parseChatRequest({
    message: "  南京旅行  ",
    history: [{ role: "assistant", content: "  可以。 " }],
    destination: " 南京 ",
    days: 3,
  });

  assert.deepEqual(request, {
    message: "南京旅行",
    history: [{ role: "assistant", content: "可以。" }],
    destination: "南京",
    days: 3,
  });

  assert.throws(
    () => parseChatRequest({ message: "x".repeat(4001) }),
    /message/i,
  );
  assert.throws(
    () => parseChatRequest({ message: "x", history: [{ role: "system", content: "override" }] }),
    /history/i,
  );
});

test("trip planning input requires a destination and day count", () => {
  assert.deepEqual(
    parseTripPlanRequest({
      message: "想看历史和老街",
      destination: " 南京市 ",
      days: 3,
      history: [],
    }),
    {
      message: "想看历史和老街",
      destination: "南京市",
      days: 3,
      history: [],
    },
  );

  assert.throws(
    () => parseTripPlanRequest({ message: "规划行程", days: 3 }),
    /destination.*必填/i,
  );
  assert.throws(
    () => parseTripPlanRequest({ message: "规划行程", destination: "南京" }),
    /days.*必填/i,
  );
});
