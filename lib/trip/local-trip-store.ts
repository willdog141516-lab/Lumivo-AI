import { nanjingPlanningResult } from "@/lib/trip/nanjing-fixture";
import type { PlanningResult } from "@/lib/trip/types";

export const ACTIVE_TRIP_STORAGE_KEY = "lumivo.active-trip.v1";

type FixtureMarker = {
  tripId: string;
  tripVersion: number;
};

type ActiveTripSnapshot = {
  raw: string;
  result: PlanningResult;
};

const fixtureMarker: FixtureMarker = {
  tripId: nanjingPlanningResult.plan.id,
  tripVersion: nanjingPlanningResult.plan.version,
};
const snapshotCache = new WeakMap<Storage, ActiveTripSnapshot>();

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }
  return typeof window === "undefined" ? null : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isGeoPoint(value: unknown): boolean {
  return isRecord(value)
    && value.crs === "BD09"
    && typeof value.lng === "number" && Number.isFinite(value.lng)
    && typeof value.lat === "number" && Number.isFinite(value.lat);
}

function hasPoiNameAnchor(poiName: unknown, narration: string): boolean {
  if (!isNonEmptyString(poiName)) {
    return false;
  }

  const normalizedName = poiName.replace(/[\s·—–-]/g, "");
  if (normalizedName.length < 3) {
    return narration.includes(normalizedName);
  }

  // ponytail: three-character name anchor catches cross-POI narration; replace with provider-backed semantic validation when available.
  for (let index = 0; index <= normalizedName.length - 3; index += 1) {
    if (narration.includes(normalizedName.slice(index, index + 3))) {
      return true;
    }
  }

  return false;
}

type PlanningReferences = {
  poiNarrations: Map<string, string>;
  routeLegIds: Set<string>;
};

function collectPlanningReferences(plan: Record<string, unknown>): PlanningReferences | null {
  if (!Array.isArray(plan.days) || plan.days.length === 0) {
    return null;
  }

  const poiNarrations = new Map<string, string>();
  const routeLegIds = new Set<string>();

  for (const day of plan.days) {
    if (!isRecord(day) || !Array.isArray(day.stops) || day.stops.length === 0 || !Array.isArray(day.routeLegs)) {
      return null;
    }

    for (const stop of day.stops) {
      if (!isRecord(stop)
        || !isRecord(stop.poi)
        || !isNonEmptyString(stop.poi.uid)
        || !isGeoPoint(stop.poi.point)
        || !isNonEmptyString(stop.narration)
        || !hasPoiNameAnchor(stop.poi.name, stop.narration)) {
        return null;
      }

      if (poiNarrations.has(stop.poi.uid)) {
        return null;
      }

      poiNarrations.set(stop.poi.uid, stop.narration);
    }

    for (const routeLeg of day.routeLegs) {
      if (!isRecord(routeLeg)
        || !isNonEmptyString(routeLeg.id)
        || routeLegIds.has(routeLeg.id)
        || !Array.isArray(routeLeg.geometry)
        || routeLeg.geometry.length < 2
        || !routeLeg.geometry.every(isGeoPoint)) {
        return null;
      }

      routeLegIds.add(routeLeg.id);
    }
  }

  return { poiNarrations, routeLegIds };
}

function hasValidTimeline(
  timeline: Record<string, unknown>,
  references: PlanningReferences,
): boolean {
  if (!Array.isArray(timeline.chapters) || timeline.chapters.length === 0) {
    return false;
  }

  const chapterIds = new Set<string>();

  for (const chapter of timeline.chapters) {
    if (!isRecord(chapter) || !isNonEmptyString(chapter.id) || !Array.isArray(chapter.commands) || chapterIds.has(chapter.id)) {
      return false;
    }

    chapterIds.add(chapter.id);

    for (const command of chapter.commands) {
      if (!isRecord(command) || command.chapterId !== chapter.id || !isNonEmptyString(command.type) || !isRecord(command.payload)) {
        return false;
      }

      switch (command.type) {
        case "globe.focus":
          if (!isGeoPoint(command.payload.target)) {
            return false;
          }
          break;
        case "camera.flyTo":
          if (!isGeoPoint(command.payload.target)
            || typeof command.payload.zoom !== "number"
            || !Number.isFinite(command.payload.zoom)) {
            return false;
          }
          break;
        case "poi.show":
          if (!isNonEmptyString(command.payload.poiUid) || !references.poiNarrations.has(command.payload.poiUid)) {
            return false;
          }
          break;
        case "route.draw":
        case "route.follow":
          if (!isNonEmptyString(command.payload.routeLegId) || !references.routeLegIds.has(command.payload.routeLegId)) {
            return false;
          }
          break;
        case "narration.show": {
          if (!isNonEmptyString(command.payload.text)) {
            return false;
          }

          if (Object.prototype.hasOwnProperty.call(command.payload, "poiUid")) {
            if (!isNonEmptyString(command.payload.poiUid)
              || references.poiNarrations.get(command.payload.poiUid) !== command.payload.text) {
              return false;
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return true;
}

function isPlanningResult(value: unknown): value is PlanningResult {
  if (!isRecord(value) || !isRecord(value.plan) || !isRecord(value.timeline)) {
    return false;
  }

  const { plan, timeline } = value;
  if (!isNonEmptyString(plan.id)
    || typeof plan.version !== "number" || !Number.isInteger(plan.version) || plan.version <= 0
    || !isNonEmptyString(plan.destination)
    || timeline.tripId !== plan.id
    || timeline.tripVersion !== plan.version) {
    return false;
  }

  const references = collectPlanningReferences(plan);
  return references !== null && hasValidTimeline(timeline, references);
}

function isFixtureMarker(value: unknown): value is FixtureMarker {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const marker = value as Record<string, unknown>;
  return Object.keys(marker).length === 2
    && marker.tripId === fixtureMarker.tripId
    && marker.tripVersion === fixtureMarker.tripVersion;
}

export function saveActiveTrip(result: PlanningResult, storage?: Storage): void {
  if (!isPlanningResult(result)) {
    throw new Error("可播放行程校验失败");
  }

  resolveStorage(storage)?.setItem(ACTIVE_TRIP_STORAGE_KEY, JSON.stringify(result));
}

export function loadActiveTrip(storage?: Storage): PlanningResult | null {
  const target = resolveStorage(storage);
  if (!target) {
    return null;
  }

  try {
    const raw = target.getItem(ACTIVE_TRIP_STORAGE_KEY);
    if (raw === null) return null;

    const cached = snapshotCache.get(target);
    if (cached?.raw === raw) return cached.result;

    const result = JSON.parse(raw);
    if (isFixtureMarker(result)) return nanjingPlanningResult;
    if (isPlanningResult(result)) {
      snapshotCache.set(target, { raw, result });
      return result;
    }
  } catch {
    // Invalid browser storage is discarded below.
  }

  try {
    target.removeItem(ACTIVE_TRIP_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return null;
}

export function clearActiveTrip(storage?: Storage): void {
  resolveStorage(storage)?.removeItem(ACTIVE_TRIP_STORAGE_KEY);
}
