"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";

import TripRevisionPanel from "@/components/trip-revision-panel";
import TripStoryExperience from "@/components/trip-story-experience";
import { TripClientError, tripClient, type TransportMode } from "@/lib/trip/client";
import { loadActiveTrip, saveActiveTrip } from "@/lib/trip/local-trip-store";
import type { PlanningResult } from "@/lib/trip/types";

const subscribe = () => () => {};

export default function TripStoryHome({ fallback }: { fallback: PlanningResult }) {
  const result = useSyncExternalStore(
    subscribe,
    () => loadActiveTrip() ?? fallback,
    () => fallback,
  );
  const [currentResult, setCurrentResult] = useState<PlanningResult | null>(null);
  const [reroutingMode, setReroutingMode] = useState<TransportMode | null>(null);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [isRevisionBusy, setIsRevisionBusy] = useState(false);
  const activeResult = currentResult ?? result;

  async function reroute(mode: TransportMode) {
    if (reroutingMode !== null || isRevisionBusy) return;

    setTransportError(null);
    setReroutingMode(mode);
    try {
      const nextResult = await tripClient.rerouteTrip({
        plan: activeResult.plan,
        transport: mode,
      });
      saveActiveTrip(nextResult);
      setCurrentResult(nextResult);
    } catch (caught) {
      setTransportError(
        caught instanceof TripClientError
          ? caught.message
          : "交通方式切换失败，请稍后重试。",
      );
    } finally {
      setReroutingMode(null);
    }
  }

  return (
    <div className="relative min-h-[100svh]">
      <TripStoryExperience
        key={`${activeResult.plan.id}:${activeResult.plan.version}`}
        isTripRevisionBusy={isRevisionBusy}
        onTransportChange={reroute}
        reroutingMode={reroutingMode}
        transportError={transportError}
        plan={activeResult.plan}
        timeline={activeResult.timeline}
      />
      <TripRevisionPanel
        isOtherActionBusy={reroutingMode !== null}
        onBusyChange={setIsRevisionBusy}
        onRevised={(nextResult) => setCurrentResult(nextResult)}
        result={activeResult}
      />
    </div>
  );
}
