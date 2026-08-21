export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type NormalizedChatRequest = {
  message: string;
  history: ChatMessage[];
  destination?: string;
  days?: number;
};

export type ChatResponse = {
  message: {
    role: "assistant";
    content: string;
  };
};

export type ChatErrorCode =
  | "INVALID_REQUEST"
  | "AI_NOT_CONFIGURED"
  | "AI_PROVIDER_ERROR"
  | "AI_PROVIDER_TIMEOUT"
  | "INTERNAL_ERROR";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${field} 必须是字符串`);
  }

  const text = value.trim();
  if (!text) {
    throw new Error(`${field} 不能为空`);
  }
  if (text.length > maxLength) {
    throw new Error(`${field} 长度不能超过 ${maxLength} 个字符`);
  }
  return text;
}

function readHistory(value: unknown): ChatMessage[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("history 必须是数组");
  }
  if (value.length > 20) {
    throw new Error("history 不能超过 20 条消息");
  }

  return value.map((item) => {
    if (!isRecord(item) || (item.role !== "user" && item.role !== "assistant")) {
      throw new Error("history 只允许 user 或 assistant 消息");
    }
    return {
      role: item.role,
      content: readText(item.content, "history.content", 4000),
    };
  });
}

function readOptionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} 必须是字符串`);
  }

  const text = value.trim();
  if (!text) {
    return undefined;
  }
  if (text.length > maxLength) {
    throw new Error(`${field} 长度不能超过 ${maxLength} 个字符`);
  }
  return text;
}

function readDays(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 30) {
    throw new Error("days 必须是 1 到 30 之间的整数");
  }
  return value as number;
}

export function parseChatRequest(input: unknown): NormalizedChatRequest {
  if (!isRecord(input)) {
    throw new Error("请求体必须是 JSON 对象");
  }

  const message = readText(input.message, "message", 4000);
  const history = readHistory(input.history);
  const destination = readOptionalText(input.destination, "destination", 100);
  const days = input.days === undefined ? undefined : readDays(input.days);

  return {
    message,
    history,
    ...(destination ? { destination } : {}),
    ...(days ? { days } : {}),
  };
}

export type TripPlanRequest = NormalizedChatRequest & {
  destination: string;
  days: number;
};

export function parseTripPlanRequest(input: unknown): TripPlanRequest {
  const request = parseChatRequest(input);
  if (!request.destination) {
    throw new Error("destination 必填");
  }
  if (request.days === undefined) {
    throw new Error("days 必填");
  }
  return { ...request, destination: request.destination, days: request.days };
}
