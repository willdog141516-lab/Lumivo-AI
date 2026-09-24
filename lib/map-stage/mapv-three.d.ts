declare module "@baidumap/mapv-three" {
  import type {
    OrthographicCamera,
    PerspectiveCamera,
    Scene,
    Vector3,
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
      getPixelSizeAtWorldPosition(worldPosition: Vector3): number;
      setProjection(projection: string): void;
      setCenter(target: number[]): void;
      setZoom(zoom: number): void;
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

  type BaiduVectorTileRequest = {
    loaderConfig?: { baseZ?: number };
    grid: {
      getRasterTileCoord(
        zoom: number,
        x: number,
        y: number,
      ): [number, number, number];
    };
  };

  export class BaiduVectorTileProvider {
    constructor(options?: {
      isOffline?: boolean;
      url?: string;
      projection?: string;
      displayOptions?: {
        base?: boolean;
        link?: boolean;
        building?: boolean;
        poi?: boolean;
        flat?: boolean;
      };
    });
    getTileURL(
      zoom: number,
      x: number,
      y: number,
      tile: BaiduVectorTileRequest,
    ): string;
  }
}
