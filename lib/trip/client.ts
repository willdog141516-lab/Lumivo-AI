import type {
  PlanningResult,
  TripPlan,
} from "@/lib/trip/types";

export type PlanInput = {
  message: string;
  destination: string;
  days: number;
};

export type RevisionInput = {
  plan: TripPlan;
  day: number;
  instruction: string;
};

export type PlanningEvent = {
  event: string;
  requestId: string;
  sequence: number;
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  };
};

export type StreamOptions = {
  signal?: AbortSignal;
  onProgress?: (event: PlanningEvent) => void;
};

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class TripClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    retryable = false,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TripClientError";
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function streamError(message: string): TripClientError {
  return new TripClientError("STREAM_INVALID", message);
}

function errorFromPayload(value: unknown): TripClientError {
  const payload = isRecord(value) && isRecord(value.error) ? value.error : {};
  const code = typeof payload.code === "string" ? payload.code : "INTERNAL_ERROR";
  const message = typeof payload.message === "string" ? payload.message : "服务器内部错误";
  const retryable = payload.retryable === true;
  const details = isRecord(payload.details) ? payload.details : undefined;
  return new TripClientError(code, message, retryable, details);
}

const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

export class TripClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;

  constructor(
    baseUrl = process.env.NEXT_PUBLIC_AI_BACKEND_URL || "http://localhost:8000",
    fetcher: Fetcher = defaultFetcher,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetcher = fetcher;
  }

  planTrip(input: PlanInput, options: StreamOptions = {}): Promise<PlanningResult> {
    return this.stream("/api/v1/trips/plan", input, options);
  }

  reviseTrip(input: RevisionInput, options: StreamOptions = {}): Promise<PlanningResult> {
    return this.stream("/api/v1/trips/revise", input, options);
  }

  private async stream(
    path: string,
    input: PlanInput | RevisionInput,
    options: StreamOptions,
  ): Promise<PlanningResult> {
    const response = await this.fetcher(this.baseUrl + path, {
      method: "POST",
      headers: {
        Accept: "application/x-ndjson",
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
      signal: options.signal,
    });

    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // Use the stable generic error below when the server did not return JSON.
      }
      throw errorFromPayload(payload);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw streamError("服务器未返回行程流");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let requestId: string | undefined;
    let expectedSequence = 0;
    let result: PlanningResult | null = null;

    const handleLine = (line: string): void => {
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        throw streamError("行程流包含无效 JSON");
      }
      if (
        !isRecord(value)
        || typeof value.event !== "string"
        || typeof value.requestId !== "string"
        || !Number.isInteger(value.sequence)
        || value.sequence !== expectedSequence
      ) {
        throw streamError("行程流顺序或结构无效");
      }
      if (requestId === undefined) {
        requestId = value.requestId;
      } else if (requestId !== value.requestId) {
        throw streamError("行程流请求标识不一致");
      }
      expectedSequence += 1;

      const event = value as unknown as PlanningEvent;
      if (event.event !== "planning.completed") {
        options.onProgress?.(event);
      }
      if (event.event === "planning.error") {
        throw errorFromPayload({ error: event.error });
      }
      if (event.event === "planning.completed") {
        if (!isRecord(event.data) || !isRecord(event.data.plan) || !isRecord(event.data.timeline)) {
          throw streamError("行程完成数据不完整");
        }
        result = event.data as PlanningResult;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          handleLine(line);
        }
      }
      if (done) break;
    }
    if (buffer.trim()) {
      handleLine(buffer);
    }

    if (!result) {
      throw streamError("行程流未完成");
    }
    return result;
  }
}

export const tripClient = new TripClient();
