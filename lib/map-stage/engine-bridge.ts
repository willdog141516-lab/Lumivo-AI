import type { RenderProps } from "@react-three/fiber";

export type BeforeRenderHost = {
  addBeforeRenderListener: (listener: () => void) => void;
  removeBeforeRenderListener: (listener: () => void) => void;
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
