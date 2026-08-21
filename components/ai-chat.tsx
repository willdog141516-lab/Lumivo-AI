"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveActiveTrip } from "@/lib/trip/local-trip-store";
import type { PlanningResult } from "@/lib/trip/types";

type UiMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  message?: { role: "assistant"; content: string };
  error?: { code?: string; message?: string };
};

type PlanningResponse = Partial<PlanningResult> & {
  error?: { code?: string };
};

const backendUrl = process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8000";
const planningErrorMessages: Record<string, string> = {
  UNSUPPORTED_REGION: "暂不支持该地区，等待后续开发",
  PLAN_NOT_AVAILABLE: "当前目的地的可播放行程尚未接入",
  MODEL_OUTPUT_INVALID: "AI 返回的行程选择无法通过校验",
};

export default function AiChat() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [planning, setPlanning] = useState(false);
  const isBusy = pending || planning;
  const dayCount = Number(days);
  const canPlan = destination.trim().length > 0
    && Number.isInteger(dayCount)
    && dayCount >= 1
    && dayCount <= 30;

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isBusy) {
      return;
    }

    const userMessage: UiMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage].slice(-20);
    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setPending(true);

    try {
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: nextMessages.slice(0, -1),
          destination: destination.trim() || undefined,
          days: days ? Number(days) : undefined,
        }),
      });
      const data = await response.json() as ChatResponse;

      if (!response.ok || !data.message?.content) {
        throw new Error(data.error?.message || "AI 暂时无法回复，请稍后再试。");
      }

      setMessages((current) => [...current, { role: "assistant" as const, content: data.message!.content }].slice(-20));
    } catch {
      setError("暂时无法连接 AI 后端，请确认 backend 已启动后重试。");
    } finally {
      setPending(false);
    }
  }

  async function createPlayablePlan() {
    const normalizedDestination = destination.trim();
    if (isBusy || !normalizedDestination || !Number.isInteger(dayCount) || dayCount < 1 || dayCount > 30) {
      return;
    }

    const planMessage = [...messages].reverse().find((item) => item.role === "user")?.content
      ?? "请生成可播放行程";

    setError(null);
    setPlanning(true);
    try {
      const response = await fetch(`${backendUrl}/api/trips/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: planMessage,
          destination: normalizedDestination,
          days: dayCount,
        }),
      });
      const data = await response.json() as PlanningResponse;

      if (!response.ok || !data.plan || !data.timeline) {
        setError(planningErrorMessages[data.error?.code ?? ""] ?? "可播放行程生成失败，请稍后再试。");
        return;
      }

      saveActiveTrip({ plan: data.plan, timeline: data.timeline });
      router.push("/");
    } catch {
      setError("可播放行程生成失败，请稍后再试。");
    } finally {
      setPlanning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_34%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-4 py-6 text-slate-950 sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col rounded-[2rem] border border-white/80 bg-white/75 p-5 shadow-2xl shadow-slate-300/40 backdrop-blur sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <Link className="text-sm font-medium text-slate-500 hover:text-slate-900" href="/">
              ← 返回 Lumivo 地图
            </Link>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-indigo-500">Lumivo AI</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">先聊聊你的下一段旅程</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              告诉我目的地、天数和偏好，先一起把想法整理成可执行的旅行方向。
            </p>
          </div>
          <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-700">
            <span className="block font-semibold">中国境内目的地</span>
            <span>南京只是示例，不限城市</span>
          </div>
        </header>

        <section className="flex flex-1 flex-col py-6" aria-label="AI 对话">
          <div className="flex-1 space-y-4" aria-live="polite" role="log">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm leading-6 text-slate-600">
                例如：&ldquo;我想去成都玩三天，喜欢慢节奏、美食和老街，帮我先安排一个方向。&rdquo;
              </div>
            ) : (
              messages.map((message, index) => (
                <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={`${message.role}-${index}-${message.content.slice(0, 8)}`}>
                  <div className={`max-w-[min(90%,_42rem)] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user" ? "rounded-br-md bg-slate-900 text-white" : "rounded-bl-md bg-indigo-50 text-slate-800"}`}>
                    {message.content}
                  </div>
                </div>
              ))
            )}
            {pending && <p className="text-sm text-slate-500">AI 正在整理路线方向…</p>}
            {planning && <p className="text-sm text-slate-500">正在生成可播放行程…</p>}
          </div>

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}

          <form className="mt-6 space-y-3" onSubmit={submitMessage}>
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
              <label className="text-sm font-medium text-slate-700">
                目的地（可选）
                <input
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                  disabled={isBusy}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="例如：成都、云南、沿海城市"
                  value={destination}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                天数（可选）
                <input
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                  disabled={isBusy}
                  max={30}
                  min={1}
                  onChange={(event) => setDays(event.target.value)}
                  placeholder="3"
                  type="number"
                  value={days}
                />
              </label>
            </div>

            <label className="sr-only" htmlFor="ai-message">你的旅行想法</label>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end">
              <textarea
                className="min-h-24 flex-1 resize-y bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-slate-400 disabled:text-slate-400"
                disabled={isBusy}
                id="ai-message"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="说说你想去哪里、喜欢什么，或直接提出问题…"
                value={draft}
              />
              <button
                className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy || !draft.trim()}
                type="submit"
              >
                {pending ? "思考中…" : "发送"}
              </button>
            </div>
            {canPlan && (
              <div className="flex flex-col gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-indigo-700">
                  当前本地可播放闭环仅覆盖南京三日 fixture，其他目的地会明确提示尚未接入。
                </p>
                <button
                  className="h-10 shrink-0 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy}
                  onClick={createPlayablePlan}
                  type="button"
                >
                  {planning ? "生成中…" : "生成可播放行程"}
                </button>
              </div>
            )}
            <p className="text-xs leading-5 text-slate-500">AI 回复用于启发和整理；精确地图事实、路线与实时信息仍需后续验证。</p>
          </form>
        </section>
      </div>
    </main>
  );
}
