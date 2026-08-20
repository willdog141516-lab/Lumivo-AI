"use client";

import { advance, createRoot, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import {
  connectExternalRenderLoop,
  createExternalRootConfig,
} from "@/lib/map-stage/engine-bridge";
import { nanjingTripPlan } from "@/lib/trip/nanjing-fixture";

declare global {
  interface Window {
    MAPV_BASE_URL?: string;
  }
}

type StageStatus = "loading" | "ready" | "error";
type Vector3Tuple = [number, number, number];

type OwnershipOverlayProps = {
  position: Vector3Tuple;
  radius: number;
  reducedMotion: { current: boolean };
};

function OwnershipOverlay({ position, radius, reducedMotion }: OwnershipOverlayProps) {
  const ring = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!reducedMotion.current && ring.current) {
      ring.current.rotation.z += delta * 0.45;
    }
  }, 1);

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius * 0.42, 24, 24]} />
        <meshBasicMaterial color="#65d8ff" transparent opacity={0.9} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, radius * 0.08, 12, 64]} />
        <meshBasicMaterial color="#a8f1ff" transparent opacity={0.76} />
      </mesh>
    </group>
  );
}

const firstPoi = nanjingTripPlan.days[0].stops[0].poi;

export default function BaiduMapStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotionRef = useRef(false);
  const [status, setStatus] = useState<StageStatus>("loading");
  const [message, setMessage] = useState("正在创建 JSAPI Three Engine…");

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
    let engine: InstanceType<(typeof import("@baidumap/mapv-three"))["Engine"]> | undefined;
    let root: ReturnType<typeof createRoot> | undefined;
    let disconnectRenderLoop: (() => void) | undefined;

    const dispose = () => {
      disconnectRenderLoop?.();
      disconnectRenderLoop = undefined;

      root?.unmount();
      root = undefined;

      engine?.dispose();
      engine = undefined;
    };

    const setup = async () => {
      try {
        const mapvthree = await import("@baidumap/mapv-three");

        if (disposed) {
          return;
        }

        // The provider is intentionally null in this spike. It proves the
        // shared render ownership without shipping a key or live basemap.
        window.MAPV_BASE_URL = "/mapvthree/";
        engine = new mapvthree.Engine(container, {
          rendering: {
            enableAnimationLoop: true,
            animationLoopFrameTime: 16,
          },
          map: {
            provider: null,
            center: [firstPoi.point.lng, firstPoi.point.lat],
            projection: "EPSG:4326",
            range: 16000,
            pitch: 45,
          },
          event: {},
          selection: {},
          widgets: {},
        });

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

        const projectedCenter = engine.map.projectArrayCoordinate(
          [firstPoi.point.lng, firstPoi.point.lat, 0],
          [0, 0, 0],
        );
        const projectedNearby = engine.map.projectArrayCoordinate(
          [firstPoi.point.lng + 0.001, firstPoi.point.lat, 0],
          [0, 0, 0],
        );
        const coordinateUnit = Math.max(
          Math.abs(projectedNearby[0] - projectedCenter[0]),
          Math.abs(projectedNearby[1] - projectedCenter[1]),
          0.0001,
        );
        const markerPosition: Vector3Tuple = [
          projectedCenter[0],
          projectedCenter[1],
          projectedCenter[2] ?? 0,
        ];

        const r3fState = root
          .render(
            <OwnershipOverlay
              position={markerPosition}
              radius={coordinateUnit * 12}
              reducedMotion={reducedMotionRef}
            />,
          )
          .getState();

        disconnectRenderLoop = connectExternalRenderLoop(
          engine,
          r3fState,
          (timestamp, state) => advance(timestamp, false, state),
        );

        setStatus("ready");
        setMessage("R3F 已挂载到 JSAPI Three 的 renderer / scene / camera");
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
  }, []);

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#02050d]">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-5 sm:p-8">
        <div className="w-full max-w-2xl rounded-2xl border border-cyan-200/20 bg-slate-950/75 p-5 text-slate-100 shadow-2xl shadow-cyan-950/30 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">MapStage Spike</p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight">南京 · 夫子庙</h1>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                status === "ready"
                  ? "bg-emerald-300/15 text-emerald-200"
                  : status === "error"
                    ? "bg-rose-300/15 text-rose-200"
                    : "bg-amber-300/15 text-amber-100"
              }`}
            >
              {status === "ready" ? "已连接" : status === "error" ? "初始化失败" : "初始化中"}
            </span>
          </div>

          <p aria-live="polite" className="mt-4 text-sm leading-6 text-slate-300">
            {message}
          </p>

          <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <p>Engine：负责唯一 WebGL 渲染循环</p>
            <p>R3F：只推进对象帧钩子，不直接 render</p>
            <p>数据：Nanjing fixture / BD-09</p>
            <p>底图：未配置 AK，当前不加载百度瓦片</p>
          </div>
        </div>
      </div>
    </section>
  );
}
