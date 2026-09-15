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
      map: {
        cancelFlight?: () => void;
      };
      projectArrayCoordinate(input: number[], output: number[]): number[];
      setProjection(projection: string): void;
      flyTo(
        target: number[],
        options?: {
          heading?: number;
          pitch?: number;
          range?: number;
          duration?: number;
          complete?: () => void;
          cancel?: () => void;
        },
      ): void;
    };

    addBeforeRenderListener(listener: () => void): void;
    removeBeforeRenderListener(listener: () => void): void;
    requestRender(): void;
    dispose(): void;
  }

  export class BaiduVectorTileProvider {
    constructor(options?: {
      ak?: string;
      displayOptions?: {
        base?: boolean;
        link?: boolean;
        building?: boolean;
        poi?: boolean;
        flat?: boolean;
      };
    });
  }

  export class Baidu09ImageryTileProvider {
    constructor(options?: {
      ak?: string;
      type?: "street" | "satellite";
    });
  }

  export class BaiduMapConfig {
    static ak: string;
  }
}
