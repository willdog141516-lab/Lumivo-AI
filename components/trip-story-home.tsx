"use client";

import { useSyncExternalStore } from "react";

import TripStoryExperience from "@/components/trip-story-experience";
import { loadActiveTrip } from "@/lib/trip/local-trip-store";
import type { PlanningResult } from "@/lib/trip/types";

const subscribe = () => () => {};

export default function TripStoryHome({ fallback }: { fallback: PlanningResult }) {
  const result = useSyncExternalStore(
    subscribe,
    () => loadActiveTrip() ?? fallback,
    () => fallback,
  );

  return <TripStoryExperience plan={result.plan} timeline={result.timeline} />;
}
