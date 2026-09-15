import type { RuntimeConfig } from "./config.js";
import type {
  ChatErrorCode,
  ChatResponse,
  NormalizedChatRequest,
} from "./types.js";

export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiClient = {
  complete(request: NormalizedChatRequest): Promise<ChatResponse>;
};

export class AiClientError extends Error {
  constructor(
    public readonly code: ChatErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

const systemPrompt = [
  "你是一名务实的中国旅行助手。",
  "支持中国境内任意目的地，并把用户提供的目的地和天数作为规划上下文。",
  "信息不足时明确说明假设，不要把猜测说成事实。",
  "不得编造坐标、地图 UID、路线几何、距离、时长、营业时间或实时可用性。",
  "用户询问精确地图事实时，说明当前尚未连接地图验证。",
].join("\n");

export function buildProviderMessages(request: NormalizedChatRequest): ProviderMessage[] {
  const context = [
    request.destination ? `目的地：${request.destination}` : "",
    request.days ? `旅行天数：${request.days} 天` : "",
  ].filter(Boolean);
  const userContent = context.length > 0
    ? `${context.join("\n")}\n\n用户问题：${request.message}`
    : request.message;

  return [
    { role: "system", content: systemPrompt },
    ...request.history,
    { role: "user", content: userContent },
  ];
}

function providerError(): AiClientError {
  return new AiClientError("AI_PROVIDER_ERROR", "AI 服务暂时不可用，请稍后重试");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function readContent(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("choices" in value) ||
    !Array.isArray(value.choices) ||
    value.choices.length === 0
  ) {
    throw providerError();
  }

  const firstChoice = value.choices[0];
  if (
    typeof firstChoice !== "object" ||
    firstChoice === null ||
    !("message" in firstChoice) ||
    typeof firstChoice.message !== "object" ||
    firstChoice.message === null ||
    !("content" in firstChoice.message) ||
    typeof firstChoice.message.content !== "string" ||
    !firstChoice.message.content.trim()
  ) {
    throw providerError();
  }

  return firstChoice.message.content.trim();
}

export function createAiClient(config: RuntimeConfig, fetchImpl: typeof fetch = fetch): AiClient {
  return {
    async complete(request) {
      if (!config.apiKey) {
        throw new AiClientError("AI_NOT_CONFIGURED", "AI 服务尚未配置 API key");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            messages: buildProviderMessages(request),
            temperature: 0.7,
            max_tokens: 1200,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw providerError();
        }

        let data: unknown;
        try {
          data = await response.json();
        } catch {
          throw providerError();
        }

        return { message: { role: "assistant", content: readContent(data) } };
      } catch (error) {
        if (error instanceof AiClientError) {
          throw error;
        }
        if (isAbortError(error)) {
          throw new AiClientError("AI_PROVIDER_TIMEOUT", "AI 服务响应超时，请稍后重试");
        }
        throw providerError();
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
