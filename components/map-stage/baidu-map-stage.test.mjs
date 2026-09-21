import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as baiduMapStageModule from "./baidu-map-stage.tsx";
import { nanjingTripPlan } from "../../lib/trip/nanjing-fixture.ts";

const BaiduMapStage = baiduMapStageModule.default.default;
const source = readFileSync(new URL("./baidu-map-stage.tsx", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

const renderStage = (isPlaying) =>
  renderToStaticMarkup(
    createElement(BaiduMapStage, {
      isPlaying,
      plan: nanjingTripPlan,
    }),
  );

test("playing state renders the compact map status card", () => {
  const html = renderStage(true);

  assert.match(html, /紧凑地图状态/);
  assert.doesNotMatch(html, /Engine：负责唯一 WebGL 渲染循环/);
  assert.doesNotMatch(html, /backdrop-blur/);
});

test("non-playing state keeps the full map diagnostics", () => {
  const html = renderStage(false);

  assert.doesNotMatch(html, /紧凑地图状态/);
  assert.match(html, /Engine：负责唯一 WebGL 渲染循环/);
  assert.doesNotMatch(html, /backdrop-blur/);
});

test("map readiness distinguishes the Engine from pending base-map tiles", () => {
  assert.match(source, /引擎就绪/);
  assert.match(source, /底图可能仍在加载/);
  assert.doesNotMatch(source, /已连接/);
});

test("map status uses the active plan destination", () => {
  const html = renderToStaticMarkup(
    createElement(BaiduMapStage, {
      isPlaying: true,
      plan: { ...nanjingTripPlan, destination: "成都" },
    }),
  );

  assert.match(html, /成都 · 路线故事/);
});

test("route camera zoom adapts to route distance", () => {
  const zoomForRouteDistance = baiduMapStageModule.zoomForRouteDistance;

  assert.equal(typeof zoomForRouteDistance, "function");
  assert.equal(zoomForRouteDistance(0), 30);
  assert.equal(zoomForRouteDistance(0.001), 30);
  assert.equal(zoomForRouteDistance(1_000_000_000), 4);
  assert.equal(zoomForRouteDistance(2_000), 14);
  assert.ok(zoomForRouteDistance(20_000) > 4);
  assert.ok(zoomForRouteDistance(400) > zoomForRouteDistance(4_000));
  const drawSource = source.slice(
    source.indexOf('case "route.draw"'),
    source.indexOf('case "route.follow"'),
  );
  assert.match(drawSource, /routesById\.get\(command\.payload\.routeLegId\)/);
  assert.match(drawSource, /zoomForRouteDistance\(route\.distanceMeters\)/);
  assert.doesNotMatch(source, /candidate\.geometry\.some/);
});

test("close routes can use a camera range below the old wide-view floor", () => {
  const rangeForZoom = baiduMapStageModule.rangeForZoom;

  assert.equal(typeof rangeForZoom, "function");
  assert.ok(rangeForZoom(20) < 800);
});

test("route follow reuses the zoom prepared before route drawing", () => {
  const followSource = source.slice(
    source.indexOf('case "route.follow"'),
    source.indexOf("default:", source.indexOf('case "route.follow"')),
  );

  assert.match(source, /cameraZoom: zoom/);
  assert.match(followSource, /runtimeStateRef\.current\.cameraZoom/);
  assert.doesNotMatch(followSource, /zoomForRouteDistance/);
});

test("route drawing does not cancel the pre-draw camera zoom flight", () => {
  const drawSource = source.slice(
    source.indexOf('case "route.draw"'),
    source.indexOf('case "route.follow"'),
  );

  assert.doesNotMatch(drawSource, /cancelFlight/);
});

test("route drawing prepares its route camera before starting the draw animation", () => {
  const drawSource = source.slice(
    source.indexOf('case "route.draw"'),
    source.indexOf('case "route.follow"'),
  );
  const cameraFitIndex = drawSource.indexOf("flyTo(");
  const drawAnimationIndex = drawSource.indexOf("animationRef.current =");

  assert.match(drawSource, /routesById\.get\(command\.payload\.routeLegId\)/);
  assert.ok(cameraFitIndex >= 0);
  assert.ok(cameraFitIndex < drawAnimationIndex);
});

test("route destination markers wait for the pre-draw camera fit", () => {
  const markerSource = source.slice(
    source.indexOf("function PoiMarker"),
    source.indexOf("function RouteLine"),
  );

  assert.match(markerSource, /drawProgress > 0/);
  assert.match(markerSource, /isRouteDestination && drawProgress > 0/);
});

test("resolved camera zoom survives non-camera commands", () => {
  const commandSource = source.slice(
    source.indexOf("applyCommand(command)"),
    source.indexOf("[applyCommandToEngine, runtime]"),
  );

  assert.match(commandSource, /cameraZoom: runtimeStateRef\.current\.cameraZoom/);
});

test("route following starts one camera flight instead of recentering every frame", () => {
  const routeSource = source.slice(
    source.indexOf("function RouteLine"),
    source.indexOf("function StoryOverlay"),
  );
  const followSource = source.slice(
    source.indexOf('case "route.follow"'),
    source.indexOf("default:", source.indexOf('case "route.follow"')),
  );

  assert.doesNotMatch(routeSource, /followRouteCamera/);
  assert.doesNotMatch(routeSource, /setCenter/);
  assert.match(followSource, /const target = route\?\.geometry\.at\(-1\)/);
  assert.match(followSource, /flyTo\(/);
});

test("route follow does not rebase the current route draw animation", () => {
  const followSource = source.slice(
    source.indexOf('case "route.follow"'),
    source.indexOf("default:", source.indexOf('case "route.follow"')),
  );

  assert.doesNotMatch(followSource, /drawElapsedMs/);
  assert.doesNotMatch(followSource, /drawStartedAt/);
  assert.doesNotMatch(followSource, /animationRef\.current =/);
});

test("long routes keep one render object and avoid full reprojection per frame", () => {
  assert.doesNotMatch(source, /route\.geometry\.slice\(1\)\.map/);
  assert.doesNotMatch(source, /route\.geometry\.forEach\(\(point, index\)/);
});

test("story overlay keeps runtime state out of the render frame", () => {
  assert.doesNotMatch(
    source,
    /useFrame\(\(\) => \{\s*stateRef\.current = runtime\.getState\(\)/s,
  );
});

test("external Engine rendering does not get a second raw R3F render", () => {
  assert.match(source, /useFrame\(\(\) => undefined, 1\)/);
});

test("route lines skip hidden work and update geometry conditionally", () => {
  const routeSource = source.slice(
    source.indexOf("function RouteLine"),
    source.indexOf("function StoryOverlay"),
  );

  assert.match(routeSource, /if \(!visible\) \{[\s\S]*return;/);
  assert.match(routeSource, /if \(shouldUpdateGeometry\) \{[\s\S]*positionAttribute\.needsUpdate = true;/);
  assert.match(routeSource, /material\.opacity = active \? 0\.98 : 0\.8;/);
});

test("route drawing restores its previous partial vertex before advancing", () => {
  const routeSource = source.slice(
    source.indexOf("function RouteLine"),
    source.indexOf("function StoryOverlay"),
  );

  assert.match(routeSource, /const lastPartialIndexRef = useRef<number \| null>\(null\)/);
  assert.match(routeSource, /const restorePartialPoint = \(\) => \{[\s\S]*projectedPositions\[offset\]/);
  assert.match(routeSource, /if \(!visible\) \{[\s\S]*restorePartialPoint\(\)/);
  assert.match(routeSource, /restorePartialPoint\(\);\s*if \(drawProgress < 1\)/);
});

test("route travel does not render a world-scaled outline arrow", () => {
  const routeSource = source.slice(
    source.indexOf("function RouteLine"),
    source.indexOf("function StoryOverlay"),
  );

  assert.doesNotMatch(routeSource, /travelHead/);
  assert.doesNotMatch(routeSource, /new THREE\.LineSegments\(/);
  assert.doesNotMatch(routeSource, /getPixelSizeAtWorldPosition/);
  assert.match(routeSource, /geometry\.setDrawRange\(0,/);
});

test("story focus stays in the flat projection used by the Baidu tile provider", () => {
  const stageClearSource = source.slice(
    source.indexOf('case "stage.clear"'),
    source.indexOf('case "globe.focus"'),
  );
  const globeFocusSource = source.slice(
    source.indexOf('case "globe.focus"'),
    source.indexOf('case "projection.toFlat"'),
  );

  assert.doesNotMatch(stageClearSource, /setProjection\(/);
  assert.match(globeFocusSource, /setProjection\("EPSG:4326"\)/);
  assert.doesNotMatch(globeFocusSource, /flyTo\(/);
  assert.doesNotMatch(source, /focusRouteStart/);
});

test("flat projection switches cancel the active camera flight", () => {
  assert.match(source, /engine\.map\.map\.cancelFlight\?\.\(\)/);
  assert.doesNotMatch(source, /_ellipsoidCamera/);
});

test("story POI markers use the provided multicolor dingwei icon", () => {
  assert.match(layoutSource, /font_5234803_avfswqha8t\.css/);
  assert.match(layoutSource, /font_5234803_avfswqha8t\.js/);
  assert.match(layoutSource, /font_5234803_i6mmxewqpy\.js/);
  assert.match(source, /className="icon-dingwei map-story-poi-marker-icon"/);
  assert.match(source, /href="#icon-dingwei"/);
  assert.doesNotMatch(source, /iconfont icon-dingwei/);
  assert.match(styleSource, /\.map-story-poi-marker-icons \{[\s\S]*width: 2\.4rem;/);
});

test("story POI markers do not render the extra blue ring", () => {
  assert.doesNotMatch(source, /ringGeometry|ringRef|RING_SEGMENTS/);
});

test("route material distinguishes active and inactive route states", () => {
  assert.match(source, /material\.opacity = active \? 0\.98 : 0\.8;/);
});

test("route destinations preview with the hint icon before switching to the location icon", () => {
  assert.match(source, /icon-dingweitishi/);
  assert.match(source, /href="#icon-dingweitishi"/);
  assert.match(source, /is-preview/);
  assert.match(styleSource, /map-story-poi-marker-bob/);
  assert.match(styleSource, /map-story-poi-marker-icons\.is-preview/);
});
