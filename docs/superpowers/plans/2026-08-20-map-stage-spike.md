# JSAPI Three / R3F MapStage Spike

Date: 2026-08-20

Goal: establish one WebGL ownership model for the future MapStage, with an optional locally configured Baidu vector basemap.

## Scope

- Add the official `@baidumap/mapv-three` package.
- Keep `mapvthree.Engine` as the only renderer owner.
- Read the browser AK from ignored `.env.local`; never commit the credential.
- Copy only the Baidu vector parser Worker required by the online provider.
- Mount a small R3F overlay into the Engine's existing renderer, scene, and camera.
- Disable R3F's own animation loop and advance it from the Engine before-render callback.
- Expose the spike at `/map-stage-spike` and make the same MapStage visible at `/`; preserve the Earth prototype at `/earth`.

## Acceptance evidence

- [x] Bridge test covers callback registration and cleanup.
- [x] Bridge test covers external renderer/scene/camera reuse, `frameloop: "never"`, and disabled R3F events.
- [x] The route is included by the Next production build.
- [x] `npm run lint` passes.
- [x] `node_modules/.bin/tsc.cmd --noEmit` passes.
- [x] Local AK configuration is ignored by Git and is not part of the commit.
- [ ] Browser WebGL runtime check is still pending.
- [ ] Live Baidu basemap and POI/route requests still require runtime verification.

The fixture center remains the canonical BD-09 data source. When the local AK is absent, the Engine uses `provider: null`; when it is present, it creates `BaiduVectorTileProvider` while preserving the same Engine-owned render loop.
