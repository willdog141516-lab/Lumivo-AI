import assert from "node:assert/strict";
import test from "node:test";

import { createAiClient } from "../ai-client.js";
import type { RuntimeConfig } from "../config.js";
import type { NormalizedChatRequest } from "../types.js";

const config: RuntimeConfig = {
  port: 8000,
  baseUrl: "https://provider.example/v1",
  apiKey: "test-key",
  model: "test-model",
  timeoutMs: 1000,
  corsOrigin: "http://localhost:8989",
};

const request: NormalizedChatRequest = {
  message: "帮我规划三天旅行",
  history: [{ role: "assistant", content: "好的。" }],
  destination: "成都",
  days: 3,
};

test("AI client sends the configured model and provider-neutral messages", async () => {
  let body: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "先了解成都，再安排三天节奏。" } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await createAiClient(config, fetchImpl).complete(request);

  assert.deepEqual(result, {
    message: { role: "assistant", content: "先了解成都，再安排三天节奏。" },
  });
  assert.equal(body?.model, "test-model");
  const systemMessage = (body?.messages as Array<Record<string, string>>)[0];
  assert.equal(systemMessage.role, "system");
  assert.match(systemMessage.content, /^你是一名务实的中国旅行助手。/);
  assert.match(systemMessage.content, /不得编造坐标/);
});

test("AI client maps non-success provider responses without exposing provider text", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("secret provider diagnostic", { status: 500 });

  await assert.rejects(
    () => createAiClient(config, fetchImpl).complete(request),
    (error: Error & { code?: string }) =>
      error.code === "AI_PROVIDER_ERROR" && !error.message.includes("secret provider diagnostic"),
  );
});

test("AI client reports missing configuration and timeout as typed errors", async () => {
  await assert.rejects(
    () => createAiClient({ ...config, apiKey: null }, fetch).complete(request),
    (error: Error & { code?: string }) => error.code === "AI_NOT_CONFIGURED",
  );

  const timeoutFetch: typeof fetch = async (_input, init) => {
    await new Promise<void>((resolve) => init?.signal?.addEventListener("abort", () => resolve(), { once: true }));
    throw new DOMException("aborted", "AbortError");
  };
  await assert.rejects(
    () => createAiClient({ ...config, timeoutMs: 1 }, timeoutFetch).complete(request),
    (error: Error & { code?: string }) => error.code === "AI_PROVIDER_TIMEOUT",
  );
});
