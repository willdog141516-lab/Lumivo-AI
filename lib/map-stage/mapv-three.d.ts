declare module "@baidumap/mapv-three" {
  import type {
    OrthographicCamera,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
  } from "three";

  export class Engine {
    constructor(
      container: HTMLElement,
      options?: {
        rendering?: Record<string, unknown>;
        map?: Record<string, unknown>;
        event?: Record<string, unknown>;
        selection?: Record<string, unknown>;
        widgets?: Record<string, unknown>;
      },
    );

    readonly renderer: WebGLRenderer;
    readonly scene: Scene;
    readonly camera: OrthographicCamera | PerspectiveCamera;
    readonly map: {
      projectArrayCoordinate(input: number[], output: number[]): number[];
    };

    addBeforeRenderListener(listener: () => void): void;
    removeBeforeRenderListener(listener: () => void): void;
    dispose(): void;
  }
}
