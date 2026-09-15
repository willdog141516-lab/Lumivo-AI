"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import BaiduMapStage, {
  type MapStageHandle,
} from "@/components/map-stage/baidu-map-stage";
import StoryPlayerPanel from "@/components/story-player-panel";
import {
  createStoryPlayer,
  type StoryPlayer,
} from "@/lib/story-player/player";
import type { StoryCommand, StoryTimeline, TripPlan } from "@/lib/trip/types";

type TripStoryExperienceProps = {
  plan: TripPlan;
  timeline: StoryTimeline;
};

export default function TripStoryExperience({
  plan,
  timeline,
}: TripStoryExperienceProps) {
  const stageRef = useRef<MapStageHandle>(null);
  const [stageReady, setStageReady] = useState(false);
  const [pendingCommands, setPendingCommands] = useState<StoryCommand[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const player = useMemo<StoryPlayer>(
    () =>
      createStoryPlayer((command) => {
        setPendingCommands((current) => [...current, command]);
      }),
    [],
  );

  useEffect(() => {
    return player.subscribe((state) => setIsPlaying(state.status === "playing"));
  }, [player]);
  const handleStageReady = useCallback(() => {
    setStageReady(true);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stageReady || !stage || pendingCommands.length === 0) {
      return;
    }

    pendingCommands.forEach((command) => {
      stage.applyCommand(command);
    });
    setPendingCommands([]);
  }, [pendingCommands, stageReady]);

  return (
    <main className="relative min-h-[100svh]">
      <BaiduMapStage
        ref={stageRef}
        isPlaying={isPlaying}
        plan={plan}
        onReady={handleStageReady}
      />
      <StoryPlayerPanel plan={plan} player={player} timeline={timeline} />
    </main>
  );
}
