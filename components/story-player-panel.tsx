"use client";

import { useEffect, useState } from "react";

import {
  type StoryPlayer,
  type StoryPlayerState,
} from "@/lib/story-player/player";
import {
  toRealPlaybackDuration,
  toTimelineDelta,
} from "@/lib/story-player/playback-rate";
import type { TransportMode } from "@/lib/trip/client";
import type { StoryTimeline, TripPlan } from "@/lib/trip/types";
import { transportSummaryForDay } from "@/lib/trip/transport";

type StoryPlayerPanelProps = {
  plan: TripPlan;
  timeline: StoryTimeline;
  player: StoryPlayer;
  onTransportChange: (mode: TransportMode) => void | Promise<void>;
  reroutingMode: TransportMode | null;
  transportError: string | null;
  isTripRevisionBusy: boolean;
};

const transportOptions = [
  { mode: "transit", label: "公共交通", icon: "icon-a-211_ditie" },
  { mode: "drive", label: "驾车", icon: "icon-xiaoqiche" },
  { mode: "walk", label: "步行", icon: "icon-buxing" },
  { mode: "ride", label: "骑行", icon: "icon-qixing" },
] satisfies { mode: TransportMode; label: string; icon: string }[];

const transportLabels = Object.fromEntries(
  transportOptions.map(({ mode, label }) => [mode, label]),
) as Record<TransportMode, string>;

const controlClass =
  "rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white motion-safe:transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40";

const statusLabels: Record<StoryPlayerState["status"], string> = {
  idle: "未载入",
  paused: "已暂停",
  playing: "播放中",
  completed: "已完成",
};

export default function StoryPlayerPanel({
  plan,
  timeline,
  player,
  onTransportChange,
  reroutingMode = null,
  transportError = null,
  isTripRevisionBusy = false,
}: StoryPlayerPanelProps) {
  const [state, setState] = useState<StoryPlayerState>(() => player.getState());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = player.subscribe(setState);
    player.load({ plan, timeline });

    return unsubscribe;
  }, [player, plan, timeline]);

  useEffect(() => {
    if (state.status !== "playing") return;

    let previousTime = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      player.advance(toTimelineDelta(now - previousTime));
      previousTime = now;
    }, 100);

    return () => window.clearInterval(interval);
  }, [player, state.status]);

  const chapter = timeline.chapters[state.chapterIndex] ?? timeline.chapters[0];
  const progress = timeline.durationMs
    ? Math.min(state.elapsedMs / timeline.durationMs, 1)
    : 0;
  const elapsedSeconds = Math.floor(toRealPlaybackDuration(state.elapsedMs) / 1000);
  const totalSeconds = Math.floor(toRealPlaybackDuration(timeline.durationMs) / 1000);
  const transportDays = plan.days.map((day) => ({
    day,
    legs: transportSummaryForDay(day),
  })).filter(({ legs }) => legs.length > 0);
  const routeModes = plan.days.flatMap((day) => day.routeLegs.map((leg) => leg.mode));
  const selectedTransport = routeModes.length > 0 && routeModes.every((mode) => mode === routeModes[0])
    ? routeModes[0]
    : null;
  const isFixturePlan = plan.days.some((day) =>
    day.stops.some((stop) => stop.poi.source === "fixture"),
  );
  const hasRoutes = routeModes.length > 0;
  const isTransportBusy = reroutingMode !== null || isTripRevisionBusy;
  const transportPreference = (
    <div className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-1.5 rounded-xl border border-cyan-200/20 bg-slate-950/90 p-2 text-slate-100 shadow-2xl shadow-cyan-950/40">
      <span className="mr-1 text-xs text-slate-400">优先方式</span>
      <div aria-label="优先出行方式" className="flex flex-wrap gap-1" role="group">
        {transportOptions.map(({ mode, label, icon }) => (
          <button
            aria-label={"优先方式：" + label}
            aria-pressed={selectedTransport === mode}
            className={[
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40",
              selectedTransport === mode
                ? "bg-cyan-300/15 text-cyan-100"
                : "text-slate-300 hover:bg-white/10 hover:text-white",
            ].join(" ")}
            disabled={isFixturePlan || !hasRoutes || isTransportBusy}
            key={mode}
            onClick={() => {
              if (mode !== selectedTransport && !isFixturePlan && hasRoutes && !isTransportBusy) {
                void onTransportChange(mode);
              }
            }}
            type="button"
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5 fill-current" viewBox="0 0 1024 1024">
              <use href={`#${icon}`} />
            </svg>
            {label}
          </button>
        ))}
      </div>
      {isFixturePlan ? (
        <p className="w-full text-[11px] text-slate-400" role="note">
          示例路线固定，无法重新规划优先方式
        </p>
      ) : !hasRoutes ? (
        <p className="w-full text-[11px] text-slate-400" role="note">
          当前行程没有可切换的路段
        </p>
      ) : isTransportBusy ? (
        <p aria-live="polite" className="w-full text-[11px] text-cyan-100/80">
          {reroutingMode
            ? "正在按" + transportLabels[reroutingMode] + "重新规划路线…"
            : "正在调整行程…"}
        </p>
      ) : transportError ? (
        <p aria-live="polite" className="w-full text-[11px] text-rose-200" role="alert">
          {transportError}
        </p>
      ) : null}
    </div>
  );
  const transportOverlay = (
    <section
      aria-label="优先出行方式控件"
      className="story-player-transport pointer-events-auto absolute left-5 top-20 z-20 right-5 sm:left-8 sm:top-24 sm:right-auto"
    >
      {transportPreference}
    </section>
  );
  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
  const handlePlayPause = () => {
    setIsExpanded(false);
    if (state.status === "playing") {
      player.pause();
    } else {
      player.play();
    }
  };
  const handleReplay = () => {
    setIsExpanded(false);
    player.replay();
  };

  if (state.status === "playing" && !isExpanded) {
    return (
      <>
        {transportOverlay}
        <section className="story-player-panel pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-3 sm:p-4">
          <div
            aria-label="紧凑播放控制台"
            className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-xl border border-cyan-200/20 bg-slate-950/85 px-3 py-2.5 text-slate-100 shadow-2xl shadow-cyan-950/40 sm:gap-4 sm:px-4"
          >
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-slate-100">{chapter?.title ?? "路线故事"}</p>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                {formatTime(elapsedSeconds)} / {formatTime(totalSeconds)}
              </span>
            </div>
            <div
              aria-label="故事播放进度"
              className="mt-1 h-1 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-400 motion-safe:transition-[width] duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
          <button
            aria-label="暂停播放"
            className="shrink-0 rounded-lg border border-cyan-200/30 bg-cyan-300/15 px-2.5 py-1.5 text-xs text-cyan-50 motion-safe:transition hover:bg-cyan-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            onClick={handlePlayPause}
            type="button"
          >
            暂停
          </button>
          <button
            aria-label="展开完整播放控制台"
            className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs text-white motion-safe:transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            onClick={() => setIsExpanded(true)}
            type="button"
          >
            展开
          </button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {transportOverlay}
      <section className="story-player-panel pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-4 sm:p-6">
        <div className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-cyan-200/20 bg-slate-950/85 p-4 text-slate-100 shadow-2xl shadow-cyan-950/40 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">路线故事</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {plan.destination} · {plan.days.length}日路线故事
            </h2>
            <p className="mt-1 text-sm text-slate-300">{chapter?.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {state.status === "playing" && (
              <button
                aria-label="收起播放控制台"
                className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-slate-200 motion-safe:transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                onClick={() => setIsExpanded(false)}
                type="button"
              >
                收起
              </button>
            )}
            <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-medium text-cyan-100">
              {statusLabels[state.status]}
            </span>
          </div>
        </div>

        <div className="mt-4" aria-label="故事播放进度" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress * 100)}>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-400 motion-safe:transition-[width] duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs tabular-nums text-slate-400">
            <span>{formatTime(elapsedSeconds)}</span>
            <span>{formatTime(totalSeconds)}</span>
          </div>
        </div>

        {transportDays.length > 0 && (
          <div className="mt-3" aria-label="交通方式">
            <p className="text-xs font-medium text-cyan-100">交通方式</p>
            <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {transportDays.map(({ day, legs }) => (
                <li className="max-w-lg truncate rounded-lg bg-white/5 px-2.5 py-2 text-xs text-slate-300" key={day.day}>
                  第{day.day}天 {legs[0].fromName} → {legs[0].toName} · {legs[0].icon ? (
                    <svg aria-hidden="true" className="inline-block h-3.5 w-3.5 fill-current align-[-2px]" viewBox="0 0 1024 1024">
                      <use href={`#${legs[0].icon}`} />
                    </svg>
                  ) : legs[0].fallbackIcon} {legs[0].label}{legs.length > 1 ? `（等 ${legs.length - 1} 段）` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            aria-label="上一章"
            className={controlClass}
            disabled={state.chapterIndex === 0}
            onClick={() => player.previous()}
            type="button"
          >
            上一章
          </button>
          <button
            aria-label={state.status === "playing" ? "暂停播放" : "开始播放"}
            className={`${controlClass} border-cyan-200/30 bg-cyan-300/15 text-cyan-50 hover:bg-cyan-300/25`}
            onClick={handlePlayPause}
            type="button"
          >
            {state.status === "playing" ? "暂停" : "播放"}
          </button>
          <button aria-label="从头播放" className={controlClass} onClick={handleReplay} type="button">
            重播
          </button>
          <button
            aria-label="下一章"
            className={controlClass}
            disabled={state.chapterIndex === timeline.chapters.length - 1}
            onClick={() => player.next()}
            type="button"
          >
            下一章
          </button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="故事章节">
          {timeline.chapters.map((item, index) => (
            <button
              aria-current={index === state.chapterIndex ? "step" : undefined}
              className={`min-w-max rounded-lg border px-3 py-2 text-left text-xs motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${
                index === state.chapterIndex
                  ? "border-cyan-200/50 bg-cyan-300/15 text-cyan-50"
                  : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
              key={item.id}
              onClick={() => player.seekChapter(index)}
              type="button"
            >
              <span className="block">{index === 0 ? "序章" : index === timeline.chapters.length - 1 ? "收束" : `第 ${index} 天`}</span>
              <span className="mt-0.5 block max-w-40 truncate">{item.title}</span>
            </button>
          ))}
        </div>
        </div>
      </section>
    </>
  );
}
