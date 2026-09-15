"use client";

import { advance, createRoot, extend, useFrame } from "@react-three/fiber";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";

import {
  connectExternalRenderLoop,
  createExternalRootConfig,
} from "@/lib/map-stage/engine-bridge";
import {
  createMapStageRuntime,
  type MapStageState,
} from "@/lib/map-stage/command-runtime";
import {
  getRingRevealDrawCount,
  isRingRevealComplete,
  RING_SEGMENTS,
} from "@/lib/map-stage/ring-reveal";
import { createProjectedRoutePositions } from "@/lib/map-stage/route-geometry";
import { nanjingTripPlan } from "@/lib/trip/nanjing-fixture";
import type {
  GeoPoint,
  RouteLeg,
  StoryCommand,
  TripPlan,
  VerifiedPoi,
} from "@/lib/trip/types";

declare global {
  interface Window {
    MAPV_BASE_URL?: string;
  }
}

extend({
  Group: THREE.Group,
  Mesh: THREE.Mesh,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  RingGeometry: THREE.RingGeometry,
  SphereGeometry: THREE.SphereGeometry,
});

type MapEngine = InstanceType<(typeof import("@baidumap/mapv-three"))["Engine"]>;
type MapProjector = MapEngine["map"];
type MapStageRuntime = ReturnType<typeof createMapStageRuntime>;
type StageStatus = "loading" | "ready" | "error";
type RouteAnimation = {
  routeLegId: string;
  mode: "draw" | "follow";
  startedAt: number;
  durationMs: number;
};

export type MapStageHandle = {
  applyCommand(command: StoryCommand): void;
};

type BaiduMapStageProps = {
  isPlaying?: boolean;
  plan?: TripPlan;
  onReady?: () => void;
};

type StoryOverlayProps = {
  plan: TripPlan;
  map: MapProjector;
  runtime: MapStageRuntime;
  animationRef: MutableRefObject<RouteAnimation | null>;
  reducedMotion: MutableRefObject<boolean>;
};

type PoiMarkerProps = {
  poi: VerifiedPoi;
  map: MapProjector;
  stateRef: MutableRefObject<MapStageState>;
  reducedMotion: MutableRefObject<boolean>;
};

type RouteLineProps = {
  route: RouteLeg;
  map: MapProjector;
  stateRef: MutableRefObject<MapStageState>;
  animationRef: MutableRefObject<RouteAnimation | null>;
  reducedMotion: MutableRefObject<boolean>;
};

const toMapCoordinate = (point: GeoPoint) => [point.lng, point.lat, 0];

const rangeForZoom = (zoom: number) =>
  // ponytail: fixture zoom-to-range heuristic; replace with provider zoom mapping when live camera behavior needs calibration.
  Math.max(800, 140000 / 2 ** (zoom - 10));

const animationProgress = (
  animation: RouteAnimation | null,
  routeLegId: string,
  mode: RouteAnimation["mode"],
  reducedMotion: boolean,
) => {
  if (
    !animation ||
    animation.routeLegId !== routeLegId ||
    animation.mode !== mode
  ) {
    return 1;
  }

  if (reducedMotion) {
    return 1;
  }

  return Math.min(
    1,
    Math.max(0, (performance.now() - animation.startedAt) / animation.durationMs),
  );
};

function PoiMarker({ poi, map, stateRef, reducedMotion }: PoiMarkerProps) {
  const markerRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const wasVisibleRef = useRef(false);
  const ringRevealStartedAtRef = useRef(0);

  useFrame((_, delta) => {
    const marker = markerRef.current;

    if (!marker) {
      return;
    }

    const point = map.projectArrayCoordinate(toMapCoordinate(poi.point), [0, 0, 0]);
    const nearby = map.projectArrayCoordinate(
      [poi.point.lng + 0.001, poi.point.lat, 0],
      [0, 0, 0],
    );
    const coordinateUnit = Math.max(
      Math.hypot(
        nearby[0] - point[0],
        nearby[1] - point[1],
        (nearby[2] ?? 0) - (point[2] ?? 0),
      ),
      0.0001,
    );
    const active = stateRef.current.activePoiUid === poi.uid;
    const visible = stateRef.current.visiblePoiUids.includes(poi.uid);

    marker.visible = visible;
    marker.position.set(point[0], point[1], point[2] ?? 0);
    marker.scale.setScalar(coordinateUnit * (active ? 3 : 2));

    const ringGeometry = ringRef.current?.geometry;

    if (!visible) {
      wasVisibleRef.current = false;
      ringRevealStartedAtRef.current = 0;
      ringGeometry?.setDrawRange(0, 0);
    } else {
      const now = performance.now();

      if (!wasVisibleRef.current) {
        wasVisibleRef.current = true;
        ringRevealStartedAtRef.current = now;
      }

      ringGeometry?.setDrawRange(
        0,
        getRingRevealDrawCount(
          ringRevealStartedAtRef.current,
          now,
          reducedMotion.current,
        ),
      );

      if (
        active &&
        !reducedMotion.current &&
        isRingRevealComplete(ringRevealStartedAtRef.current, now) &&
        ringRef.current
      ) {
        ringRef.current.rotation.z += delta * 0.9;
      }
    }
  });

  return (
    <group ref={markerRef} visible={false}>
      <mesh>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial color="#65d8ff" depthTest={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1.08, RING_SEGMENTS, 1, 0, Math.PI * 2]} />
        <meshBasicMaterial
          color="#0284c7"
          transparent
          opacity={0.95}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function RouteLine({
  route,
  map,
  stateRef,
  animationRef,
  reducedMotion,
}: RouteLineProps) {
  const lineRef = useRef<THREE.Line | null>(null);
  const projectedPositions = useMemo(
    () =>
      createProjectedRoutePositions(route.geometry, (input, output) =>
        map.projectArrayCoordinate(input, output),
      ),
    [map, route.geometry],
  );
  const geometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(projectedPositions, 3));
    return nextGeometry;
  }, [projectedPositions]);
  const line = useMemo(
    () => {
      const nextLine = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          transparent: true,
          opacity: 0.8,
          depthTest: false,
        }),
      );
      nextLine.visible = false;
      nextLine.frustumCulled = false;
      return nextLine;
    },
    [geometry],
  );

  useEffect(() => {
    lineRef.current = line;

    return () => {
      lineRef.current = null;
      geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [geometry, line]);

  useFrame(() => {
    const activeLine = lineRef.current;

    if (!activeLine) {
      return;
    }

    const stageState = stateRef.current;
    const visible = stageState.visibleRouteLegIds.includes(route.id);
    const drawProgress = animationProgress(
      animationRef.current,
      route.id,
      "draw",
      reducedMotion.current,
    );
    const pointCount = visible
      ? drawProgress <= 0
        ? 0
        : Math.min(
            route.geometry.length,
            Math.max(2, Math.ceil(route.geometry.length * drawProgress)),
          )
      : 0;

    activeLine.visible = visible;
    geometry.setDrawRange(0, pointCount);

    const material = activeLine.material as THREE.LineBasicMaterial;
    material.color.set(
      stageState.activeRouteLegId === route.id ? "#0057d9" : "#4338ca",
    );
    material.opacity = stageState.activeRouteLegId === route.id ? 1 : 0.9;
  });

  return <primitive object={line} />;
}

function StoryOverlay({
  plan,
  map,
  runtime,
  animationRef,
  reducedMotion,
}: StoryOverlayProps) {
  const stateRef = useRef(runtime.getState());
  const pois = useMemo(
    () => plan.days.flatMap((day) => day.stops.map((stop) => stop.poi)),
    [plan],
  );
  const routes = useMemo(
    () => plan.days.flatMap((day) => day.routeLegs),
    [plan],
  );

  useFrame(() => {
    stateRef.current = runtime.getState();
  });

  return (
    <>
      {pois.map((poi) => (
        <PoiMarker
          key={poi.uid}
          map={map}
          poi={poi}
          reducedMotion={reducedMotion}
          stateRef={stateRef}
        />
      ))}
      {routes.map((route) => (
        <RouteLine
          key={route.id}
          animationRef={animationRef}
          map={map}
          reducedMotion={reducedMotion}
          route={route}
          stateRef={stateRef}
        />
      ))}
    </>
  );
}

const BaiduMapStage = forwardRef<MapStageHandle, BaiduMapStageProps>(
  function BaiduMapStage({ isPlaying = false, plan = nanjingTripPlan, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const reducedMotionRef = useRef(false);
    const engineRef = useRef<MapEngine | undefined>(undefined);
    const animationRef = useRef<RouteAnimation | null>(null);
    const pendingCommandsRef = useRef<StoryCommand[]>([]);
    const [status, setStatus] = useState<StageStatus>("loading");
    const [message, setMessage] = useState("正在创建 JSAPI Three Engine…");
    const runtime = useMemo(() => createMapStageRuntime(plan), [plan]);
    const routesById = useMemo(
      () =>
        new Map(
          plan.days.flatMap((day) =>
            day.routeLegs.map((route) => [route.id, route] as const),
          ),
        ),
      [plan],
    );
    const firstPoi =
      plan.days[0]?.stops[0]?.poi ?? nanjingTripPlan.days[0].stops[0].poi;

    const applyCommandToEngine = useCallback(
      (engine: MapEngine, command: StoryCommand) => {
        const setProjection = () => {
          engine.map.map.cancelFlight?.();
          engine.map.setProjection("EPSG:4326");
        };

        const flyTo = (target: GeoPoint, range: number, duration: number) => {
          engine.map.flyTo(toMapCoordinate(target), {
            heading: 0,
            pitch: 45,
            range,
            duration: reducedMotionRef.current ? 1 : duration,
            complete: () => undefined,
            cancel: () => undefined,
          });
        };

        switch (command.type) {
          case "stage.clear":
            animationRef.current = null;
            setProjection();
            break;
          case "globe.focus":
            setProjection();
            flyTo(command.payload.target, 420000, command.durationMs);
            break;
          case "projection.toFlat":
            setProjection();
            break;
          case "camera.flyTo":
            flyTo(
              command.payload.target,
              rangeForZoom(command.payload.zoom),
              command.durationMs,
            );
            break;
          case "route.draw":
            animationRef.current = {
              routeLegId: command.payload.routeLegId,
              mode: "draw",
              startedAt: performance.now(),
              durationMs: Math.max(1, command.durationMs),
            };
            break;
          case "route.follow": {
            const route = routesById.get(command.payload.routeLegId);
            const target = route?.geometry.at(-1);

            animationRef.current = {
              routeLegId: command.payload.routeLegId,
              mode: "follow",
              startedAt: performance.now(),
              durationMs: Math.max(1, command.durationMs),
            };

            if (target) {
              flyTo(
                target,
                rangeForZoom(runtime.getState().cameraZoom ?? 14),
                command.durationMs,
              );
            }
            break;
          }
          default:
            break;
        }

        engine.requestRender();
      },
      [routesById, runtime],
    );

    useImperativeHandle(
      ref,
      () => ({
        applyCommand(command) {
          runtime.apply(command);

          if (engineRef.current) {
            applyCommandToEngine(engineRef.current, command);
          } else {
            pendingCommandsRef.current.push(command);
          }
        },
      }),
      [applyCommandToEngine, runtime],
    );

    useEffect(() => {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const updateMotionPreference = () => {
        reducedMotionRef.current = mediaQuery.matches;
      };

      updateMotionPreference();
      mediaQuery.addEventListener("change", updateMotionPreference);

      return () => mediaQuery.removeEventListener("change", updateMotionPreference);
    }, []);

    useEffect(() => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      let disposed = false;
      let engine: MapEngine | undefined;
      let root: ReturnType<typeof createRoot> | undefined;
      let disconnectRenderLoop: (() => void) | undefined;
      const baiduMapAk = process.env.NEXT_PUBLIC_BAIDU_MAP_AK?.trim();

      const dispose = () => {
        disconnectRenderLoop?.();
        disconnectRenderLoop = undefined;

        root?.unmount();
        root = undefined;

        engine?.dispose();
        engine = undefined;
        engineRef.current = undefined;
        animationRef.current = null;
      };

      const setup = async () => {
        try {
          window.MAPV_BASE_URL = "/mapvthree/";
          const mapvthree = await import("@baidumap/mapv-three");

          if (disposed) {
            return;
          }

          if (baiduMapAk) {
            mapvthree.BaiduMapConfig.ak = baiduMapAk;
          }

          engine = new mapvthree.Engine(container, {
            rendering: {
              enableAnimationLoop: true,
              animationLoopFrameTime: 16,
              features: {
                antialias: {
                  enabled: true,
                  method: "msaa",
                },
              },
            },
            map: {
              provider: baiduMapAk
                ? new mapvthree.BaiduVectorTileProvider({
                    ak: baiduMapAk,
                    displayOptions: {
                      base: true,
                      link: true,
                      poi: true,
                    },
                  })
                : null,
              center: [firstPoi.point.lng, firstPoi.point.lat],
              projection: "EPSG:4326",
              range: 16000,
              pitch: 45,
            },
            event: {},
            selection: {},
            widgets: {},
          });
          engineRef.current = engine;

          root = createRoot(engine.renderer.domElement);
          await root.configure(
            createExternalRootConfig({
              renderer: engine.renderer,
              scene: engine.scene,
              camera: engine.camera,
            }),
          );

          if (disposed) {
            dispose();
            return;
          }

          const r3fState = root
            .render(
              <StoryOverlay
                animationRef={animationRef}
                map={engine.map}
                plan={plan}
                reducedMotion={reducedMotionRef}
                runtime={runtime}
              />,
            )
            .getState();

          disconnectRenderLoop = connectExternalRenderLoop(
            engine,
            r3fState,
            (timestamp, state) => advance(timestamp, false, state),
          );

          setStatus("ready");
          setMessage(
            baiduMapAk
              ? "百度矢量底图与路线故事已挂载到同一个 Engine"
              : "R3F 路线故事已挂载到 JSAPI Three 的 renderer / scene / camera",
          );

          pendingCommandsRef.current.splice(0).forEach((command) => {
            applyCommandToEngine(engine as MapEngine, command);
          });
          onReady?.();
        } catch (error) {
          dispose();

          if (!disposed) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "地图舞台初始化失败");
          }
        }
      };

      void setup();

      return () => {
        disposed = true;
        dispose();
      };
    }, [applyCommandToEngine, firstPoi, onReady, plan, runtime]);

    const hasBaiduMapAk = Boolean(process.env.NEXT_PUBLIC_BAIDU_MAP_AK?.trim());
    const statusLabel = status === "ready" ? "已连接" : status === "error" ? "初始化失败" : "初始化中";
    const statusClass =
      status === "ready"
        ? "bg-emerald-300/15 text-emerald-200"
        : status === "error"
          ? "bg-rose-300/15 text-rose-200"
          : "bg-amber-300/15 text-amber-100";

    return (
      <section className="relative min-h-[100svh] overflow-hidden bg-[#02050d]">
        <div ref={containerRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-5 sm:p-8">
          {isPlaying && status !== "error" ? (
            <div
              aria-label="紧凑地图状态"
              className="pointer-events-auto flex items-center gap-3 rounded-xl border border-cyan-200/20 bg-slate-950/80 px-3 py-2 text-slate-100 shadow-2xl shadow-cyan-950/30 backdrop-blur-md"
            >
              <span className="text-sm font-semibold tracking-tight">南京 · 路线故事</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}
              >
                {statusLabel}
              </span>
            </div>
          ) : (
            <div className="w-full max-w-2xl rounded-2xl border border-cyan-200/20 bg-slate-950/75 p-5 text-slate-100 shadow-2xl shadow-cyan-950/30 backdrop-blur-md">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">MapStage</p>
                  <h1 className="mt-2 text-xl font-semibold tracking-tight">南京 · 路线故事</h1>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>

              <p aria-live="polite" className="mt-4 text-sm leading-6 text-slate-300">
                {message}
              </p>

              <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <p>Engine：负责唯一 WebGL 渲染循环</p>
                <p>StoryPlayer：发出语义路线命令</p>
                <p>数据：Nanjing fixture / BD-09</p>
                <p>底图：{hasBaiduMapAk ? "Baidu 矢量底图" : "未配置 AK，当前使用故事叠加层"}</p>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  },
);

export default BaiduMapStage;
