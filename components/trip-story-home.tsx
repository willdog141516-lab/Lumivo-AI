"use client";

import { useEffect, useState } from "react";

import TripStoryExperience from "@/components/trip-story-experience";
import { loadActiveTrip } from "@/lib/trip/local-trip-store";
import type { PlanningResult } from "@/lib/trip/types";

export default function TripStoryHome({ fallback }: { fallback: PlanningResult }) {
  const [result, setResult] = useState(fallback);

  useEffect(() => {
    const stored = loadActiveTrip();
    if (stored) {
      setResult(stored);
    }
  }, []);

  return <TripStoryExperience plan={result.plan} timeline={result.timeline} />;
}
