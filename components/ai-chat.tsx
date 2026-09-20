"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Streamdown } from "streamdown";
import { useEffect, useRef, useState } from "react";

import { TripClientError, tripClient } from "@/lib/trip/client";
import { saveActiveTrip } from "@/lib/trip/local-trip-store";

type UiMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  message?: { role: "assistant"; content: string };
  error?: { code?: string; message?: string };
};

type ChatStreamEvent = {
  content?: string;
  error?: { code?: string; message?: string };
};

const backendUrl = process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8000";
const planningErrorMessages: Record<string, string> = {
  UNSUPPORTED_REGION: "暂不支持该地区，等待后续开发",
  PLAN_NOT_AVAILABLE: "当前目的地的可播放行程尚未接入",
  MAP_PROVIDER_ERROR: "百度地图服务暂时不可用，请检查地图配置后重试",
  MAP_PROVIDER_TIMEOUT: "百度地图服务响应超时，请稍后重试",
  MODEL_OUTPUT_INVALID: "AI 返回的行程选择无法通过校验",
};
const planningProgressMessages: Record<string, string> = {
  "planning.started": "正在启动规划…",
  "destination.validated": "正在校验目的地…",
  "pois.found": "正在整理真实地点…",
  "routes.calculated": "正在计算真实路线…",
  "plan.validated": "正在校验行程…",
  "timeline.ready": "正在准备地图故事…",
};

async function readChatStream(response: Response, onDelta: (content: string) => void) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("AI 未返回流式内容");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let receivedContent = false;

  const readEvent = (rawEvent: string) => {
    let eventName = "message";
    let data = "";
    for (const line of rawEvent.split(/\r?\n/)) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;

    const payload = JSON.parse(data) as ChatStreamEvent;
    if (eventName === "error" || payload.error) {
      throw new Error(payload.error?.message || "AI 暂时无法回复，请稍后再试。");
    }
    if (eventName === "delta" && payload.content) {
      receivedContent = true;
      onDelta(payload.content);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    events.forEach(readEvent);
    if (done) break;
  }
  if (buffer) readEvent(buffer);
  if (!receivedContent) throw new Error("AI 未返回有效内容");
}

export default function AiChat() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planningStatus, setPlanningStatus] = useState("准备生成可播放行程");
  const isBusy = pending || planning;
  const dayCount = Number(days);
  const canPlan = destination.trim().length > 0
    && Number.isInteger(dayCount)
    && dayCount >= 1
    && dayCount <= 30;
  const hasMessages = messages.length > 0;
  const messagesRef = useRef<HTMLDivElement>(null);
  const planningAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (messagesElement) {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    }
  }, [messages]);

  useEffect(() => () => {
    planningAbortRef.current?.abort();
  }, []);

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
      const response = await fetch(`${backendUrl}/api/chat?stream=true`, {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          history: nextMessages.slice(0, -1),
          destination: destination.trim() || undefined,
          days: days ? Number(days) : undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json() as ChatResponse;
        throw new Error(data.error?.message || "AI 暂时无法回复，请稍后再试。");
      }

      setMessages((current) => [...current, { role: "assistant" as const, content: "" }].slice(-20));
      let assistantContent = "";
      await readChatStream(response, (delta) => {
        assistantContent += delta;
        setMessages((current) => {
          const last = current[current.length - 1];
          if (last?.role !== "assistant") return current;
          return [...current.slice(0, -1), { ...last, content: assistantContent }].slice(-20);
        });
      });
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
    setPlanningStatus(planningProgressMessages["planning.started"]);
    const controller = new AbortController();
    planningAbortRef.current = controller;
    try {
      const result = await tripClient.planTrip({
          message: planMessage,
          destination: normalizedDestination,
          days: dayCount,
        }, {
          signal: controller.signal,
          onProgress: (event) => {
            setPlanningStatus(
              planningProgressMessages[event.event] ?? "正在生成可播放行程…",
            );
          },
        });
      if (controller.signal.aborted) {
        return;
      }

      saveActiveTrip(result);
      router.push("/trip");
    } catch (caught) {
      if (controller.signal.aborted) {
        return;
      }
      if (caught instanceof TripClientError) {
        setError(
          planningErrorMessages[caught.code]
            ?? caught.message
            ?? "可播放行程生成失败，请稍后再试。",
        );
      } else {
        setError("可播放行程生成失败，请稍后再试。");
      }
    } finally {
      if (planningAbortRef.current === controller) {
        planningAbortRef.current = null;
        setPlanning(false);
        setPlanningStatus("准备生成可播放行程");
      }
    }
  }

  return (
    <main className="ai-home relative h-[100svh] min-h-0 overflow-hidden bg-[#081115] text-[#f6f4ed]">
      <div aria-hidden="true" className="ai-home-map" />
      <div aria-hidden="true" className="ai-home-glow" />
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col px-5 py-5 sm:px-8 sm:py-7">
        <header className="flex items-center justify-between">
          <Link className="group flex items-center gap-3 text-sm font-semibold tracking-[0.22em] text-white" href="/">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200/30 bg-cyan-200/10 text-cyan-100 transition group-hover:border-cyan-100/70">
              <span className="h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_16px_#91f5ee]" />
            </span>
            LUMIVO
          </Link>
          <Link className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-slate-300 backdrop-blur transition hover:border-cyan-200/40 hover:text-white" href="/trip">
            查看地图故事 ↗
          </Link>
        </header>

        <section className={`ai-home-page-scrollbar mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto ${hasMessages ? "justify-start py-5 sm:py-6" : "justify-center py-12"}`} aria-label="AI 旅行搜索">
          <div
            aria-hidden={hasMessages}
            className={`ai-home-intro mb-8 text-center sm:mb-10 ${hasMessages ? "ai-home-intro-hidden" : ""}`}
          >
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.38em] text-cyan-200/70">AI TRAVEL MAP</p>
            <h1 className="mx-auto max-w-3xl text-4xl font-medium leading-[1.12] tracking-[-0.04em] text-white sm:text-6xl">
              问一句，<span className="text-cyan-100">路线就出现。</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              说说你想去哪里、喜欢什么，Lumivo 会先和你聊清楚，再把答案变成一张可以走进去的地图。
            </p>
          </div>

          <div className={`ai-home-chat-card ${hasMessages ? "ai-home-chat-card-active flex min-h-0 flex-1 flex-col" : ""} rounded-[2rem] border border-white/15 bg-[#111d21]/80 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-4`}>
            <div className="flex flex-wrap items-center gap-2 px-2 pb-3 text-xs text-slate-400">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_10px_#91f5ee]" />
              和 Lumivo 聊聊你的下一段旅程
              <span className="ml-auto rounded-full border border-white/10 px-2 py-1 text-[10px] tracking-[0.12em] text-slate-500">CHINA · BETA</span>
            </div>

            {messages.length > 0 && (
              <div className="ai-home-scrollbar ai-home-message-log mb-3 max-h-none flex-1 min-h-0 space-y-3 overflow-y-auto rounded-2xl bg-black/10 p-2" aria-live="polite" ref={messagesRef} role="log">
                {messages.map((message, index) => (
                  <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={`${message.role}-${index}`}>
                    <div className={`max-w-[min(90%,_42rem)] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "whitespace-pre-wrap rounded-br-md bg-cyan-100 text-[#0b1a1d]" : "rounded-bl-md bg-white/10 text-slate-100"}`}>
                      {message.role === "user" ? message.content : (
                        <Streamdown
                          isAnimating={pending && index === messages.length - 1}
                          mode="streaming"
                        >
                          {message.content}
                        </Streamdown>
                      )}
                    </div>
                  </div>
                ))}
                {pending && <p className="px-2 text-xs text-cyan-100/70">AI 正在整理路线方向…</p>}
              </div>
            )}

            <form className={`ai-home-composer space-y-2 ${hasMessages ? "ai-home-composer-active" : ""}`} onSubmit={submitMessage}>
              <label className="sr-only" htmlFor="ai-message">你的旅行问题</label>
              <div className="ai-home-composer-field flex flex-col gap-3 rounded-[1.35rem] border border-white/10 bg-[#0b171a] p-3 sm:flex-row sm:items-end sm:p-4">
                <textarea
                  className="min-h-24 flex-1 resize-none bg-transparent px-1 py-1 text-base leading-7 text-white outline-none placeholder:text-slate-500 disabled:text-slate-500"
                  disabled={isBusy}
                  id="ai-message"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="例如：南京三天怎么玩？想看博物馆和老街，但别太赶…"
                  value={draft}
                />
                <button
                  aria-label="发送问题"
                  className="ai-home-submit flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-100 px-5 text-sm font-semibold text-[#102126] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isBusy || !draft.trim()}
                  type="submit"
                >
                  {pending ? "思考中…" : "开始探索"}
                  <span aria-hidden="true" className="text-lg leading-none">↗</span>
                </button>
              </div>

              <div className="ai-home-aux-controls flex flex-wrap gap-2 px-1" aria-label="示例问题">
                {[
                  ["南京三日慢游", "南京三天怎么玩？想看博物馆和老街。", "南京", "3"],
                  ["成都美食与老街", "我想去成都玩三天，重点安排美食和老街。", "成都", "3"],
                  ["苏州园林一日", "苏州一日游，想看园林，也想留点时间喝茶。", "苏州", "1"],
                ].map(([label, prompt, nextDestination, nextDays]) => (
                  <button
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-cyan-200/40 hover:bg-cyan-100/5 hover:text-cyan-100 disabled:opacity-40"
                    disabled={isBusy}
                    key={label}
                    onClick={() => {
                      setDraft(prompt);
                      setDestination(nextDestination);
                      setDays(nextDays);
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </form>

            {canPlan && (
              <div className="ai-home-plan-cta mt-4 flex flex-col gap-3 rounded-2xl border border-cyan-200/20 bg-cyan-100/10 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-50">准备好把这段对话变成路线了吗？</p>
                <p className="mt-1 text-xs leading-5 text-cyan-100/60">南京三日可离线演示；后端启用真实地图规划后，可生成当前目的地的可播放行程。</p>
              </div>
              <button
                className="h-10 shrink-0 rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-[#102126] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isBusy}
                onClick={createPlayablePlan}
                type="button"
              >
                    {planning ? planningStatus : "生成可播放行程 ↗"}
                  </button>
              </div>
            )}
          </div>

          {planning && (
            <p aria-live="polite" className="mt-3 text-center text-xs text-cyan-100/70">
              {planningStatus}
            </p>
          )}

          {error && <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100" role="alert">{error}</p>}
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">AI 回复用于启发和整理；精确地图事实、路线与实时信息仍需后续验证。</p>
        </section>

        <footer className="flex items-center justify-between border-t border-white/10 pt-3 text-[11px] tracking-[0.12em] text-slate-500">
          <span>让每个问题，都有一张地图</span>
          <span>LOCAL-FIRST / 2026</span>
        </footer>
      </div>
    </main>
  );
}
