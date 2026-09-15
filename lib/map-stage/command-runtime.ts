import type { GeoPoint, StoryCommand, TripPlan } from "../trip/types.ts";

export type MapStageState = {
  projection: "globe" | "flat";
  visiblePoiUids: string[];
  visibleRouteLegIds: string[];
  activePoiUid: string | null;
  activeRouteLegId: string | null;
  cameraTarget: GeoPoint | null;
  cameraZoom: number | null;
};

const emptyState = (): MapStageState => ({
  projection: "globe",
  visiblePoiUids: [],
  visibleRouteLegIds: [],
  activePoiUid: null,
  activeRouteLegId: null,
  cameraTarget: null,
  cameraZoom: null,
});

export function createMapStageRuntime(plan: TripPlan) {
  const poiUids = new Set(
    plan.days.flatMap((day) => day.stops.map((stop) => stop.poi.uid)),
  );
  const routeLegIds = new Set(
    plan.days.flatMap((day) => day.routeLegs.map((routeLeg) => routeLeg.id)),
  );
  let state = emptyState();

  const getState = (): MapStageState => ({
    ...state,
    visiblePoiUids: [...state.visiblePoiUids],
    visibleRouteLegIds: [...state.visibleRouteLegIds],
    cameraTarget: state.cameraTarget ? { ...state.cameraTarget } : null,
  });

  const addUnique = (items: string[], value: string) =>
    items.includes(value) ? items : [...items, value];

  return {
    apply(command: StoryCommand) {
      switch (command.type) {
        case "stage.clear":
          state = emptyState();
          break;
        case "globe.focus":
          state = {
            ...state,
            projection: "globe",
            cameraTarget: { ...command.payload.target },
          };
          break;
        case "projection.toFlat":
          state = { ...state, projection: "flat" };
          break;
        case "camera.flyTo":
          state = {
            ...state,
            cameraTarget: { ...command.payload.target },
            cameraZoom: command.payload.zoom,
          };
          break;
        case "poi.show":
          if (poiUids.has(command.payload.poiUid)) {
            state = {
              ...state,
              visiblePoiUids: addUnique(state.visiblePoiUids, command.payload.poiUid),
              activePoiUid: command.payload.poiUid,
            };
          }
          break;
        case "route.draw":
          if (routeLegIds.has(command.payload.routeLegId)) {
            state = {
              ...state,
              visibleRouteLegIds: addUnique(
                state.visibleRouteLegIds,
                command.payload.routeLegId,
              ),
              activeRouteLegId: command.payload.routeLegId,
            };
          }
          break;
        case "route.follow":
          if (routeLegIds.has(command.payload.routeLegId)) {
            state = {
              ...state,
              visibleRouteLegIds: addUnique(
                state.visibleRouteLegIds,
                command.payload.routeLegId,
              ),
              activeRouteLegId: command.payload.routeLegId,
            };
          }
          break;
        default:
          break;
      }

      return getState();
    },

    getState,
  };
}
