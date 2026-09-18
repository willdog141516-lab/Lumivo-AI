"use client";

import { useState } from "react";

import { TripClientError, tripClient } from "@/lib/trip/client";
import { saveActiveTrip } from "@/lib/trip/local-trip-store";
import type { PlanningResult } from "@/lib/trip/types";

type TripRevisionPanelProps = {
  result: PlanningResult;
  onRevised: (result: PlanningResult) => void;
};

const progressLabels: Record<string, string> = {
  "planning.started": "正在启动调整…",
  "destination.validated": "正在校验目的地…",
  "pois.found": "正在查找真实地点…",
  "routes.calculated": "正在计算路线…",
  "plan.validated": "正在校验新行程…",
  "timeline.ready": "正在准备地图故事…",
};

export default function TripRevisionPanel({
  result,
  onRevised,
}: TripRevisionPanelProps) {
  const [day, setDay] = useState(String(result.plan.days[0]?.day ?? 1));
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setStatus("正在提交调整…");
    try {
      const revised = await tripClient.reviseTrip(
        {
          plan: result.plan,
          day: Number(day),
          instruction: trimmedInstruction,
        },
        {
          onProgress: (progress) => {
            setStatus(progressLabels[progress.event] ?? "正在生成调整后的路线…");
          },
        },
      );
      saveActiveTrip(revised);
      onRevised(revised);
      setInstruction("");
      setStatus("路线已更新");
    } catch (caught) {
      if (caught instanceof TripClientError) {
        setError(caught.message);
      } else {
        setError("路线调整失败，请稍后再试。");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <aside className="pointer-events-none absolute left-5 top-20 z-30 w-[min(22rem,calc(100%-2.5rem))] sm:left-8">
      <details className="pointer-events-auto rounded-2xl border border-cyan-200/20 bg-slate-950/85 p-4 text-slate-100 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <summary className="cursor-pointer list-none text-sm font-medium text-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
          调整某一天的路线
        </summary>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <label className="block text-xs text-slate-400" htmlFor="trip-revision-day">
            调整天数
          </label>
          <select
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            disabled={isSubmitting}
            id="trip-revision-day"
            onChange={(event) => setDay(event.target.value)}
            value={day}
          >
            {result.plan.days.map((item) => (
              <option className="bg-slate-900" key={item.day} value={item.day}>
                第 {item.day} 天
              </option>
            ))}
          </select>
          <label className="block text-xs text-slate-400" htmlFor="trip-revision-instruction">
            想怎么调整
          </label>
          <textarea
            className="min-h-20 w-full resize-y rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-200"
            disabled={isSubmitting}
            id="trip-revision-instruction"
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="例如：增加一个博物馆，节奏慢一点"
            value={instruction}
          />
          <button
            className="w-full rounded-lg bg-cyan-100 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting || !instruction.trim()}
            type="submit"
          >
            {isSubmitting ? "调整中…" : "提交调整"}
          </button>
          <p aria-live="polite" className="min-h-5 text-xs text-cyan-100/70">
            {status}
          </p>
          {error && (
            <p className="text-xs leading-5 text-rose-200" role="alert">
              {error}
            </p>
          )}
        </form>
      </details>
    </aside>
  );
}
