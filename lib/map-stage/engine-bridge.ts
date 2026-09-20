import type { RenderProps } from "@react-three/fiber";

export type BeforeRenderHost = {
  addBeforeRenderListener: (listener: () => void) => void;
  removeBeforeRenderListener: (listener: () => void) => void;
};

export type AnimationLoopHost = {
  rendering: { enableAnimationLoop: boolean };
  requestRender: () => void;
};

type ExternalRootConfig = Pick<
  RenderProps<HTMLCanvasElement>,
  "gl" | "scene" | "camera" | "frameloop" | "events"
>;

type ExternalRootInputs = {
  renderer: NonNullable<ExternalRootConfig["gl"]>;
  scene: NonNullable<ExternalRootConfig["scene"]>;
  camera: NonNullable<ExternalRootConfig["camera"]>;
};

export function createExternalRootConfig(
  inputs: ExternalRootInputs,
): ExternalRootConfig {
  return {
    gl: inputs.renderer,
    scene: inputs.scene,
    camera: inputs.camera,
    frameloop: "never",
    events: () => ({ enabled: false, priority: 0 }),
  };
}

export function connectExternalRenderLoop<State>(
  host: BeforeRenderHost,
  state: State,
  advanceFrame: (timestamp: number, state: State) => void,
  now: () => number = () => performance.now(),
): () => void {
  const onBeforeRender = () => advanceFrame(now(), state);

  host.addBeforeRenderListener(onBeforeRender);

  return () => {
    host.removeBeforeRenderListener(onBeforeRender);
  };
}

export function syncAnimationLoop(host: AnimationLoopHost, isPlaying: boolean) {
  host.rendering.enableAnimationLoop = isPlaying;
  host.requestRender();
}

export const limitMapPixelRatio = (value: number) => Math.min(value, 1.5);
