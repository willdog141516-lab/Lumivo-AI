export type GeoPoint = {
  lng: number;
  lat: number;
  crs: "BD09";
};

export type VerifiedPoi = {
  uid: string;
  name: string;
  address: string;
  point: GeoPoint;
  openingHours?: string;
  recommendedStayMinutes: number;
  source: "baidu" | "fixture";
  verifiedAt: string;
};

export type TripStop = {
  poi: VerifiedPoi;
  arrivalTime?: string;
  departureTime?: string;
  narration: string;
};

export type RouteLeg = {
  id: string;
  fromPoiUid: string;
  toPoiUid: string;
  mode: "walk" | "transit" | "drive" | "ride";
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoPoint[];
};

export type TripDay = {
  day: number;
  title: string;
  summary: string;
  stops: TripStop[];
  routeLegs: RouteLeg[];
};

export type PlanWarning = {
  code: "OPENING_HOURS_UNCERTAIN" | "SCHEDULE_TIGHT" | "TRANSPORT_LIMITED";
  message: string;
  poiUid?: string;
};

export type TripPlan = {
  id: string;
  version: number;
  destination: string;
  summary: string;
  days: TripDay[];
  warnings: PlanWarning[];
};

export type StoryCommandType =
  | "globe.focus"
  | "projection.toFlat"
  | "camera.flyTo"
  | "poi.show"
  | "route.draw"
  | "route.follow"
  | "narration.show"
  | "chapter.pause"
  | "stage.clear";

export type StoryCommandPayloads = {
  "globe.focus": { target: GeoPoint };
  "projection.toFlat": Record<string, never>;
  "camera.flyTo": { target: GeoPoint; zoom: number };
  "poi.show": { poiUid: string };
  "route.draw": { routeLegId: string };
  "route.follow": { routeLegId: string };
  "narration.show": { text: string; poiUid?: string };
  "chapter.pause": Record<string, never>;
  "stage.clear": Record<string, never>;
};

export type StoryCommand<T extends StoryCommandType = StoryCommandType> = T extends StoryCommandType
  ? {
      id: string;
      chapterId: string;
      type: T;
      startMs: number;
      durationMs: number;
      easing: "linear" | "easeInOut";
      payload: StoryCommandPayloads[T];
    }
  : never;

export type StoryChapter = {
  id: string;
  title: string;
  startMs: number;
  durationMs: number;
  commands: StoryCommand[];
};

export type StoryTimeline = {
  tripId: string;
  tripVersion: number;
  durationMs: number;
  chapters: StoryChapter[];
};

export type PlanningResult = {
  plan: TripPlan;
  timeline: StoryTimeline;
};
