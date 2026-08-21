import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { AiClientError } from "../ai-client.js";
import { createBackendServer } from "../server.js";
import type { RuntimeConfig } from "../config.js";
import type { AiClient } from "../ai-client.js";
import type { TripPlanner } from "../trip-planner.js";
import { TripPlannerError } from "../trip-planner.js";
import { nanjingPlanningResult } from "../../lib/trip/nanjing-fixture.js";

const config: RuntimeConfig = {
  port: 8000,
  baseUrl: "https://provider.example/v1",
  apiKey: "test-key",
  model: "test-model",
  timeoutMs: 1000,
  corsOrigin: "http://localhost:8989",
};

async function listenOnEphemeralPort(server: ReturnType<typeof createBackendServer>): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: ReturnType<typeof createBackendServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function fakeClient(content = "这是测试回复。", onComplete?: () => void): AiClient {
  return {
    async complete() {
      onComplete?.();
      return { message: { role: "assistant", content } };
    },
  };
}

function fakePlanner(onCall?: () => void): TripPlanner {
  return {
    async plan() {
      onCall?.();
      return nanjingPlanningResult;
    },
  };
}

test("health never calls the AI client and reports only safe metadata", async () => {
  let calls = 0;
  const server = createBackendServer({ config, client: fakeClient("no", () => { calls += 1; }) });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/health`, { headers: { origin: config.corsOrigin } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", model: "test-model" });
    assert.equal(response.headers.get("access-control-allow-origin"), config.corsOrigin);
    assert.equal(calls, 0);
  } finally {
    await closeServer(server);
  }
});

test("chat rejects invalid input before invoking the AI client", async () => {
  let calls = 0;
  const server = createBackendServer({ config, client: fakeClient("no", () => { calls += 1; }) });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "" }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: "INVALID_REQUEST", message: "message 不能为空" },
    });
    assert.equal(calls, 0);
  } finally {
    await closeServer(server);
  }
});

test("chat returns the injected AI response", async () => {
  const server = createBackendServer({ config, client: fakeClient() });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "帮我规划成都三日游", destination: "成都", days: 3 }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      message: { role: "assistant", content: "这是测试回复。" },
    });
  } finally {
    await closeServer(server);
  }
});

test("provider errors become structured 503 responses without provider text", async () => {
  const server = createBackendServer({
    config,
    client: {
      complete: async () => {
        throw new AiClientError("AI_PROVIDER_ERROR", "secret provider diagnostic");
      },
    },
  });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "测试 provider 错误" }),
    });
    assert.equal(response.status, 503);
    const body = await response.json() as { error: { code: string; message: string } };
    assert.equal(body.error.code, "AI_PROVIDER_ERROR");
    assert.equal(body.error.message.includes("secret provider diagnostic"), false);
  } finally {
    await closeServer(server);
  }
});

test("disallowed origins do not receive CORS permission", async () => {
  const server = createBackendServer({ config, client: fakeClient() });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/health`, { headers: { origin: "http://evil.example" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.has("access-control-allow-origin"), false);
  } finally {
    await closeServer(server);
  }
});

test("body over 64 KiB is rejected before invoking the AI client", async () => {
  let calls = 0;
  const server = createBackendServer({ config, client: fakeClient("no", () => { calls += 1; }) });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "x".repeat(64 * 1024) }),
    });
    assert.equal(response.status, 413);
    assert.equal(calls, 0);
  } finally {
    await closeServer(server);
  }
});

test("planning endpoint returns the validated fixture result", async () => {
  let calls = 0;
  const server = createBackendServer({
    config,
    client: fakeClient(),
    planner: fakePlanner(() => { calls += 1; }),
  });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/api/trips/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "想看历史和老街", destination: "南京", days: 3 }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), nanjingPlanningResult);
    assert.equal(calls, 1);
  } finally {
    await closeServer(server);
  }
});

test("planning endpoint rejects invalid input before invoking planner", async () => {
  let calls = 0;
  const server = createBackendServer({
    config,
    client: fakeClient(),
    planner: fakePlanner(() => { calls += 1; }),
  });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/api/trips/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "没有天数", destination: "南京" }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: "INVALID_REQUEST", message: "days 必填" },
    });
    assert.equal(calls, 0);
  } finally {
    await closeServer(server);
  }
});

test("planning endpoint maps typed planner errors without leaking details", async () => {
  const server = createBackendServer({
    config,
    client: fakeClient(),
    planner: {
      plan: async () => {
        throw new TripPlannerError("UNSUPPORTED_REGION", "internal detail");
      },
    },
  });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/api/trips/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: config.corsOrigin },
      body: JSON.stringify({ message: "巴黎", destination: "巴黎", days: 3 }),
    });
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), {
      error: { code: "UNSUPPORTED_REGION", message: "暂不支持该地区，等待后续开发" },
    });
  } finally {
    await closeServer(server);
  }
});

test("planning preflight returns CORS methods without invoking planner", async () => {
  let calls = 0;
  const server = createBackendServer({
    config,
    client: fakeClient(),
    planner: fakePlanner(() => { calls += 1; }),
  });
  const address = await listenOnEphemeralPort(server);

  try {
    const response = await fetch(`${address}/api/trips/plan`, {
      method: "OPTIONS",
      headers: { origin: config.corsOrigin },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-methods"), "GET,POST,OPTIONS");
    assert.equal(calls, 0);
  } finally {
    await closeServer(server);
  }
});
