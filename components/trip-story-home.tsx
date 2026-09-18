"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";

import TripRevisionPanel from "@/components/trip-revision-panel";
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
  const [currentResult, setCurrentResult] = useState<PlanningResult | null>(null);
  const activeResult = currentResult ?? result;

  return (
    <div className="relative min-h-[100svh]">
      <TripStoryExperience plan={activeResult.plan} timeline={activeResult.timeline} />
      <TripRevisionPanel
        onRevised={(nextResult) => setCurrentResult(nextResult)}
        result={activeResult}
      />
    </div>
  );
}
