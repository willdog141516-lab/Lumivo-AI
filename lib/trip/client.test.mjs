import assert from "node:assert/strict";
import test from "node:test";

import {
  TripClient,
  TripClientError,
} from "./client.ts";
import { nanjingPlanningResult, nanjingTripPlan } from "./nanjing-fixture.ts";

function responseFor(records, splitAt) {
  const encoded = new TextEncoder().encode(
    records.map((record) => JSON.stringify(record)).join("\n") + "\n",
  );
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded.slice(0, splitAt));
      controller.enqueue(encoded.slice(splitAt));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson" },
  });
}

test("TripClient parses records split across UTF-8 chunks", async () => {
  const progress = [];
  const client = new TripClient("http://localhost:8000", async () => responseFor([
    { event: "planning.started", requestId: "r1", sequence: 0, data: {} },
    { event: "destination.validated", requestId: "r1", sequence: 1, data: { destination: "南京" } },
    {
      event: "planning.completed",
      requestId: "r1",
      sequence: 2,
      data: nanjingPlanningResult,
    },
  ], 17));

  const result = await client.planTrip(
    { message: "南京三日游", destination: "南京", days: 3 },
    { onProgress: (event) => progress.push(event.event) },
  );

  assert.deepEqual(result, nanjingPlanningResult);
  assert.deepEqual(progress, ["planning.started", "destination.validated"]);
});

test("TripClient turns a terminal planning error into TripClientError", async () => {
  const client = new TripClient("http://localhost:8000", async () => responseFor([
    { event: "planning.started", requestId: "r1", sequence: 0, data: {} },
    {
      event: "planning.error",
      requestId: "r1",
      sequence: 1,
      error: {
        code: "MAP_PROVIDER_ERROR",
        message: "地图服务暂时不可用",
        retryable: true,
        details: {},
      },
    },
  ], 9));

  await assert.rejects(
    client.planTrip({ message: "南京三日游", destination: "南京", days: 3 }),
    (error) => {
      assert.ok(error instanceof TripClientError);
      assert.equal(error.code, "MAP_PROVIDER_ERROR");
      assert.equal(error.retryable, true);
      return true;
    },
  );
});

test("TripClient passes AbortSignal to fetch", async () => {
  const controller = new AbortController();
  let receivedSignal;
  const client = new TripClient("http://localhost:8000", async (_url, init) => {
    receivedSignal = init.signal;
    return responseFor([
      { event: "planning.started", requestId: "r1", sequence: 0, data: {} },
      { event: "planning.completed", requestId: "r1", sequence: 1, data: nanjingPlanningResult },
    ], 0);
  });

  await client.planTrip(
    { message: "南京三日游", destination: "南京", days: 3 },
    { signal: controller.signal },
  );

  assert.equal(receivedSignal, controller.signal);
});

test("TripClient reroutes the compact trip snapshot using the chosen transport", async () => {
  let receivedUrl;
  let receivedBody;
  const client = new TripClient("http://localhost:8000", async (url, init) => {
    receivedUrl = String(url);
    receivedBody = JSON.parse(init.body);
    return responseFor([
      { event: "planning.started", requestId: "r1", sequence: 0, data: {} },
      { event: "planning.completed", requestId: "r1", sequence: 1, data: nanjingPlanningResult },
    ], 0);
  });

  await client.rerouteTrip({ plan: nanjingTripPlan, transport: "ride" });

  assert.equal(receivedUrl, "http://localhost:8000/api/v1/trips/reroute");
  assert.equal(receivedBody.transport, "ride");
  assert.equal(receivedBody.plan.id, nanjingTripPlan.id);
  assert.deepEqual(
    receivedBody.plan.days.map((day) => day.stops.length),
    nanjingTripPlan.days.map((day) => day.stops.length),
  );
  assert.ok(receivedBody.plan.days.every((day) => !("routeLegs" in day)));
});
