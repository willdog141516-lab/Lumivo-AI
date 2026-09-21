"use client";

import { Html } from "@react-three/drei";
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
  limitMapPixelRatio,
  syncAnimationLoop,
  type AnimationLoopHost,
} from "@/lib/map-stage/engine-bridge";
import {
  createMapStageRuntime,
  type MapStageState,
} from "@/lib/map-stage/command-runtime";
import { createProjectedRoutePositions } from "@/lib/map-stage/route-geometry";
import {
  createRouteSampler,
  getRouteAnimationProgress,
  type RouteAnimationPhase,
} from "@/lib/map-stage/route-animation";
import {
  toRealPlaybackDuration,
  toRealRouteDuration,
} from "@/lib/story-player/playback-rate";
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
});

type MapEngine = InstanceType<(typeof import("@baidumap/mapv-three"))["Engine"]>;
type MapProjector = MapEngine["map"];
type StageStatus = "loading" | "ready" | "error";
type RouteAnimation = {
  routeLegId: string;
  draw: RouteAnimationPhase;
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
  stateRef: MutableRefObject<MapStageState>;
  animationRef: MutableRefObject<RouteAnimation | null>;
  reducedMotion: MutableRefObject<boolean>;
};

type PoiMarkerProps = {
  animationRef: MutableRefObject<RouteAnimation | null>;
  poi: VerifiedPoi;
  map: MapProjector;
  reducedMotion: MutableRefObject<boolean>;
  routesById: ReadonlyMap<string, RouteLeg>;
  stateRef: MutableRefObject<MapStageState>;
};

type RouteLineProps = {
  route: RouteLeg;
  map: MapProjector;
  stateRef: MutableRefObject<MapStageState>;
  animationRef: MutableRefObject<RouteAnimation | null>;
  reducedMotion: MutableRefObject<boolean>;
};

const toMapCoordinate = (point: GeoPoint) => [point.lng, point.lat, 0];

export const rangeForZoom = (zoom: number) =>
  // ponytail: fixture zoom-to-range heuristic; replace with provider zoom mapping when live camera behavior needs calibration.
  Math.max(80, 140000 / 2 ** (zoom - 10));

export const zoomForRouteDistance = (distanceMeters: number) => {
  const distance = Number.isFinite(distanceMeters) && distanceMeters >= 0
    ? Math.max(0.001, distanceMeters)
    : 500;

  return Math.min(30, Math.max(4, 16 - Math.log2(distance / 500)));
};

function PoiMarker({
  animationRef,
  poi,
  map,
  reducedMotion,
  routesById,
  stateRef,
}: PoiMarkerProps) {
  const markerRef = useRef<THREE.Group>(null);
  const markerHtmlRef = useRef<HTMLDivElement>(null);
  const markerIconsRef = useRef<HTMLSpanElement>(null);
  const markerIconRef = useRef<SVGSVGElement>(null);

  useFrame(() => {
    const marker = markerRef.current;

    if (!marker) {
      return;
    }

    const stageState = stateRef.current;
    const active = stageState.activePoiUid === poi.uid;
    const routeAnimation = animationRef.current;
    const route = routeAnimation ? routesById.get(routeAnimation.routeLegId) : undefined;
    const isRouteDestination = route?.toPoiUid === poi.uid;
    const drawProgress = isRouteDestination && routeAnimation
      ? getRouteAnimationProgress(routeAnimation.draw, performance.now(), reducedMotion.current)
      : 1;
    const isPreview = isRouteDestination && drawProgress > 0 && drawProgress < 1;
    const visible =
      stageState.visiblePoiUids.includes(poi.uid) ||
      (isRouteDestination && drawProgress > 0);

    if (markerHtmlRef.current) {
      markerHtmlRef.current.style.display = visible ? "block" : "none";
    }
    markerIconsRef.current?.classList.toggle("is-preview", isPreview);
    markerIconRef.current?.classList.toggle("is-active", active && !isPreview);

    if (!visible) {
      marker.visible = false;
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

    marker.visible = true;
    marker.position.set(point[0], point[1], point[2] ?? 0);
    marker.scale.setScalar(coordinateUnit * (active ? 3 : 2));
  });

  return (
    <group ref={markerRef} visible={false}>
      <Html ref={markerHtmlRef} pointerEvents="none" wrapperClass="map-story-poi-marker">
        <span
          aria-label={poi.name}
          className="map-story-poi-marker-icons"
          ref={markerIconsRef}
          role="img"
        >
          <svg
            aria-hidden="true"
            className="icon-dingwei map-story-poi-marker-icon"
            ref={markerIconRef}
            viewBox="0 0 1024 1024"
          >
            <use href="#icon-dingwei" />
          </svg>
          <svg
            aria-hidden="true"
            className="icon-dingweitishi map-story-poi-marker-icon map-story-poi-marker-icon-hint"
            viewBox="0 0 1024 1024"
          >
            <use href="#icon-dingweitishi" />
          </svg>
        </span>
      </Html>
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
  const lastAnimationStartedAtRef = useRef<number | null>(null);
  const lastDrawProgressRef = useRef<number | null>(null);
  const lastVisibleRef = useRef(false);
  const lastActiveRef = useRef<boolean | null>(null);
  const lastPartialIndexRef = useRef<number | null>(null);
  const projectedPositions = useMemo(
    () =>
      createProjectedRoutePositions(route.geometry, (input, output) =>
        map.projectArrayCoordinate(input, output),
      ),
    [map, route.geometry],
  );
  const geometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(projectedPositions.slice(), 3),
    );
    return nextGeometry;
  }, [projectedPositions]);
  const sampler = useMemo(() => createRouteSampler(route.geometry), [route.geometry]);
  const line = useMemo(() => {
    const nextLine = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      }),
    );
    nextLine.visible = false;
    nextLine.frustumCulled = false;
    nextLine.renderOrder = 10000;
    return nextLine;
  }, [geometry]);
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
    const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
    const restorePartialPoint = () => {
      const partialIndex = lastPartialIndexRef.current;

      if (partialIndex === null) {
        return;
      }

      const offset = partialIndex * 3;
      positionAttribute.setXYZ(
        partialIndex,
        projectedPositions[offset],
        projectedPositions[offset + 1],
        projectedPositions[offset + 2],
      );
      positionAttribute.needsUpdate = true;
      lastPartialIndexRef.current = null;
    };

    if (!visible) {
      restorePartialPoint();
      if (lastVisibleRef.current) {
        geometry.setDrawRange(0, 0);
      }
      activeLine.visible = false;
      lastAnimationStartedAtRef.current = null;
      lastDrawProgressRef.current = null;
      lastVisibleRef.current = false;
      lastActiveRef.current = null;
      return;
    }

    const animation = animationRef.current?.routeLegId === route.id
      ? animationRef.current
      : null;
    const now = performance.now();
    const drawProgress = animation
      ? getRouteAnimationProgress(animation.draw, now, reducedMotion.current)
      : 1;
    const active = stageState.activeRouteLegId === route.id;
    const canDraw = drawProgress > 0;
    const shouldUpdateGeometry = !lastVisibleRef.current
      || lastAnimationStartedAtRef.current !== (animation?.draw.startedAt ?? null)
      || lastDrawProgressRef.current !== drawProgress;

    if (shouldUpdateGeometry) {
      const drawSample = sampler(drawProgress);

      if (drawSample && canDraw && route.geometry.length >= 2) {
        const projectedSample = map.projectArrayCoordinate(
          toMapCoordinate(drawSample.point),
          [0, 0, 0],
        );
        const partialIndex = Math.min(
          drawSample.segmentIndex + 1,
          route.geometry.length - 1,
        );
        restorePartialPoint();
        if (drawProgress < 1) {
          positionAttribute.setXYZ(
            partialIndex,
            projectedSample[0],
            projectedSample[1],
            projectedSample[2] ?? 0,
          );
          lastPartialIndexRef.current = partialIndex;
        }
        geometry.setDrawRange(0, Math.min(route.geometry.length, partialIndex + 1));
      } else {
        restorePartialPoint();
        geometry.setDrawRange(0, 0);
      }
      positionAttribute.needsUpdate = true;
      lastAnimationStartedAtRef.current = animation?.draw.startedAt ?? null;
      lastDrawProgressRef.current = drawProgress;
    }

    activeLine.visible = true;
    lastVisibleRef.current = true;

    const material = activeLine.material as THREE.LineBasicMaterial;

    if (lastActiveRef.current !== active || shouldUpdateGeometry) {
      const color = active ? "#075985" : "#4338ca";
      material.color.set(color);
      material.opacity = active ? 0.98 : 0.8;
      lastActiveRef.current = active;
    }
  });

  return <primitive object={line} />;
}

function StoryOverlay({
  plan,
  map,
  stateRef,
  animationRef,
  reducedMotion,
}: StoryOverlayProps) {
  const pois = useMemo(
    () => plan.days.flatMap((day) => day.stops.map((stop) => stop.poi)),
    [plan],
  );
  const routes = useMemo(
    () => plan.days.flatMap((day) => day.routeLegs),
    [plan],
  );
  const routesById = useMemo(
    () => new Map(routes.map((route) => [route.id, route] as const)),
    [routes],
  );
  useFrame(() => undefined, 1);

  return (
    <>
      {pois.map((poi) => (
        <PoiMarker
          animationRef={animationRef}
          key={poi.uid}
          map={map}
          poi={poi}
          reducedMotion={reducedMotion}
          routesById={routesById}
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
    const runtimeStateRef = useRef<MapStageState>(runtime.getState());
    useEffect(() => {
      runtimeStateRef.current = runtime.getState();
    }, [runtime]);

    const firstPoi =
      plan.days[0]?.stops[0]?.poi ?? nanjingTripPlan.days[0].stops[0].poi;

    const applyCommandToEngine = useCallback(
      (engine: MapEngine, command: StoryCommand) => {
        const setProjection = (projection: "EPSG:4326") => {
          engine.map.map.cancelFlight?.();
          engine.map.setProjection(projection);
        };

        const flyTo = (target: GeoPoint, range: number, duration: number) => {
          engine.map.flyTo(toMapCoordinate(target), {
            heading: 0,
            pitch: 45,
            range,
            duration: reducedMotionRef.current ? 1 : toRealPlaybackDuration(duration),
            complete: () => undefined,
            cancel: () => undefined,
          });
        };

        switch (command.type) {
          case "stage.clear":
            animationRef.current = null;
            engine.map.map.cancelFlight?.();
            break;
          case "globe.focus":
            setProjection("EPSG:4326");
            break;
          case "projection.toFlat":
            setProjection("EPSG:4326");
            break;
          case "camera.flyTo": {
            runtimeStateRef.current = {
              ...runtimeStateRef.current,
              cameraZoom: command.payload.zoom,
            };

            flyTo(
              command.payload.target,
              rangeForZoom(command.payload.zoom),
              command.durationMs,
            );
            break;
          }
          case "route.draw": {
            const route = routesById.get(command.payload.routeLegId);
            const target = route?.geometry[1] ?? route?.geometry[0];
            const zoom = route
              ? zoomForRouteDistance(route.distanceMeters)
              : runtimeStateRef.current.cameraZoom ?? 14;
            const shouldFitRoute = Boolean(route && target);

            if (shouldFitRoute && target) {
              runtimeStateRef.current = {
                ...runtimeStateRef.current,
                cameraZoom: zoom,
              };
              flyTo(target, rangeForZoom(zoom), command.durationMs);
            }

            animationRef.current = {
              routeLegId: command.payload.routeLegId,
              draw: {
                startedAt: performance.now() + (
                  shouldFitRoute && !reducedMotionRef.current
                    ? toRealPlaybackDuration(command.durationMs)
                    : 0
                ),
                durationMs: toRealRouteDuration(command.durationMs),
                easing: command.easing,
              },
            };
            break;
          }
          case "route.follow": {
            const route = routesById.get(command.payload.routeLegId);
            const target = route?.geometry.at(-1);

            if (target) {
              flyTo(
                target,
                rangeForZoom(runtimeStateRef.current.cameraZoom ?? 14),
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
      [routesById],
    );

    useImperativeHandle(
      ref,
      () => ({
        applyCommand(command) {
          const nextState = runtime.apply(command);
          runtimeStateRef.current =
            command.type === "stage.clear" || command.type === "camera.flyTo"
              ? nextState
              : {
                  ...nextState,
                  cameraZoom: runtimeStateRef.current.cameraZoom,
                };

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
      if (engineRef.current) {
        syncAnimationLoop(
          engineRef.current as MapEngine & AnimationLoopHost,
          isPlaying,
        );
      }
    }, [isPlaying, status]);

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
              pixelRatio: limitMapPixelRatio(window.devicePixelRatio),
              enableAnimationLoop: false,
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
                stateRef={runtimeStateRef}
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
              ? "渲染引擎已就绪，百度底图可能仍在加载；路线故事已挂载到同一个 Engine"
              : "渲染引擎已就绪，R3F 路线故事已挂载到 JSAPI Three 的 renderer / scene / camera",
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
    const statusLabel = status === "ready" ? "引擎就绪" : status === "error" ? "初始化失败" : "初始化中";
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
              className="pointer-events-auto flex items-center gap-3 rounded-xl border border-cyan-200/20 bg-slate-950/80 px-3 py-2 text-slate-100 shadow-2xl shadow-cyan-950/30"
            >
              <span className="text-sm font-semibold tracking-tight">{plan.destination} · 路线故事</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}
              >
                {statusLabel}
              </span>
            </div>
          ) : (
            <div className="w-full max-w-2xl rounded-2xl border border-cyan-200/20 bg-slate-950/75 p-5 text-slate-100 shadow-2xl shadow-cyan-950/30">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">MapStage</p>
                  <h1 className="mt-2 text-xl font-semibold tracking-tight">{plan.destination} · 路线故事</h1>
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
                <p>数据：{plan.destination} / BD-09</p>
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
