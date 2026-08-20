import assert from "node:assert/strict";
import test from "node:test";

import {
  connectExternalRenderLoop,
  createExternalRootConfig,
} from "./engine-bridge.ts";

test("external render loop advances R3F from the map engine callback", () => {
  const listeners = new Set();
  const engine = {
    addBeforeRenderListener(listener) {
      listeners.add(listener);
    },
    removeBeforeRenderListener(listener) {
      listeners.delete(listener);
    },
  };
  const r3fState = { name: "r3f-state" };
  const frames = [];

  const cleanup = connectExternalRenderLoop(
    engine,
    r3fState,
    (timestamp, state) => frames.push({ timestamp, state }),
    () => 1234,
  );

  assert.equal(listeners.size, 1);
  [...listeners][0]();
  assert.deepEqual(frames, [{ timestamp: 1234, state: r3fState }]);

  cleanup();
  assert.equal(listeners.size, 0);
});

test("external root reuses the engine objects without creating an R3F loop", () => {
  const renderer = { name: "engine-renderer" };
  const scene = { name: "engine-scene" };
  const camera = { name: "engine-camera" };

  const config = createExternalRootConfig({ renderer, scene, camera });

  assert.equal(config.gl, renderer);
  assert.equal(config.scene, scene);
  assert.equal(config.camera, camera);
  assert.equal(config.frameloop, "never");
  assert.deepEqual(config.events({}), { enabled: false, priority: 0 });
});
