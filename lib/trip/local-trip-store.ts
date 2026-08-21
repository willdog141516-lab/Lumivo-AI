import { nanjingPlanningResult } from "./nanjing-fixture.js";
import type { PlanningResult } from "./types.js";

export const ACTIVE_TRIP_STORAGE_KEY = "lumivo.active-trip.v1";

type FixtureMarker = {
  tripId: string;
  tripVersion: number;
};

const fixtureMarker: FixtureMarker = {
  tripId: nanjingPlanningResult.plan.id,
  tripVersion: nanjingPlanningResult.plan.version,
};

function resolveStorage(storage?: Storage): Storage | null {
  if (storage) {
    return storage;
  }
  return typeof window === "undefined" ? null : window.localStorage;
}

function isCurrentFixtureResult(result: PlanningResult): boolean {
  return result?.plan?.id === fixtureMarker.tripId
    && result.plan.version === fixtureMarker.tripVersion
    && result.timeline?.tripId === fixtureMarker.tripId
    && result.timeline.tripVersion === fixtureMarker.tripVersion;
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
  if (!isCurrentFixtureResult(result)) {
    throw new Error("可播放行程校验失败");
  }

  resolveStorage(storage)?.setItem(ACTIVE_TRIP_STORAGE_KEY, JSON.stringify(fixtureMarker));
}

export function loadActiveTrip(storage?: Storage): PlanningResult | null {
  const target = resolveStorage(storage);
  if (!target) {
    return null;
  }

  try {
    const raw = target.getItem(ACTIVE_TRIP_STORAGE_KEY);
    if (raw === null || isFixtureMarker(JSON.parse(raw))) {
      return raw === null ? null : nanjingPlanningResult;
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
