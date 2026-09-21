"use client";

import Link from "next/link";
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
    <main className="trip-story-experience relative min-h-[100svh]">
      <Link
        aria-label="返回 AI 问答页面"
        className="absolute left-5 top-5 z-30 rounded-full border border-white/15 bg-slate-950/75 px-4 py-2 text-sm text-slate-100 shadow-lg shadow-slate-950/20 motion-safe:transition hover:border-cyan-200/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:left-8 sm:top-8"
        href="/ai"
      >
        ← 返回问答
      </Link>
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
