# JSAPI Three / R3F MapStage Spike

Date: 2026-08-20

Goal: establish one WebGL ownership model for the future MapStage without configuring a live Baidu key or basemap.

## Scope

- Add the official `@baidumap/mapv-three` package.
- Keep `mapvthree.Engine` as the only renderer owner.
- Mount a small R3F overlay into the Engine's existing renderer, scene, and camera.
- Disable R3F's own animation loop and advance it from the Engine before-render callback.
- Expose the spike at `/map-stage-spike`; leave the existing Earth homepage unchanged.

## Acceptance evidence

- [x] Bridge test covers callback registration and cleanup.
- [x] Bridge test covers external renderer/scene/camera reuse, `frameloop: "never"`, and disabled R3F events.
- [x] The route is included by the Next production build.
- [x] `npm run lint` passes.
- [x] `node_modules/.bin/tsc.cmd --noEmit` passes.
- [ ] Browser WebGL runtime check is still pending.
- [ ] Live Baidu basemap and POI/route requests are intentionally out of scope.

The fixture center remains the canonical BD-09 data source. The Engine is created with `provider: null`, so this spike proves render ownership and lifecycle cleanup without presenting a live map as available.
