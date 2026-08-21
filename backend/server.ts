import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { AiClientError, type AiClient } from "./ai-client.js";
import type { RuntimeConfig } from "./config.js";
import { parseChatRequest, parseTripPlanRequest, type TripPlanRequest } from "./types.js";
import { TripPlannerError, type TripPlanner } from "./trip-planner.js";

const MAX_BODY_BYTES = 64 * 1024;

export type ServerDependencies = {
  config: RuntimeConfig;
  client: AiClient;
  planner?: TripPlanner;
};

function setCors(request: IncomingMessage, response: ServerResponse, config: RuntimeConfig): void {
  if (request.headers.origin === config.corsOrigin) {
    response.setHeader("access-control-allow-origin", config.corsOrigin);
  }
}

function sendJson(
  request: IncomingMessage,
  response: ServerResponse,
  config: RuntimeConfig,
  status: number,
  body: unknown,
): void {
  setCors(request, response, config);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function sendError(
  request: IncomingMessage,
  response: ServerResponse,
  config: RuntimeConfig,
  status: number,
  code: string,
  message: string,
): void {
  sendJson(request, response, config, status, { error: { code, message } });
}

function readBody(request: IncomingMessage): Promise<{ body: string; tooLarge: boolean }> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve({ body: tooLarge ? "" : Buffer.concat(chunks).toString("utf8"), tooLarge });
    });
    request.on("error", reject);
  });
}

function providerFailure(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof AiClientError) {
    switch (error.code) {
      case "AI_NOT_CONFIGURED":
        return { status: 503, code: error.code, message: "AI 服务尚未配置" };
      case "AI_PROVIDER_TIMEOUT":
        return { status: 503, code: error.code, message: "AI 服务响应超时，请稍后重试" };
      case "AI_PROVIDER_ERROR":
        return { status: 503, code: error.code, message: "AI 服务暂时不可用，请稍后重试" };
      case "INTERNAL_ERROR":
        return { status: 500, code: error.code, message: "服务器内部错误" };
    }
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "服务器内部错误" };
}

function plannerFailure(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof TripPlannerError) {
    switch (error.code) {
      case "UNSUPPORTED_REGION":
        return { status: 422, code: error.code, message: "暂不支持该地区，等待后续开发" };
      case "PLAN_NOT_AVAILABLE":
        return { status: 422, code: error.code, message: "当前目的地的可播放行程尚未接入" };
      case "MODEL_OUTPUT_INVALID":
        return { status: 503, code: error.code, message: "AI 返回的行程选择无法通过校验" };
    }
  }
  return providerFailure(error);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ServerDependencies,
): Promise<void> {
  const { config, client } = dependencies;
  const method = request.method ?? "GET";
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  const isChatRoute = path === "/api/chat";
  const isPlanningRoute = path === "/api/trips/plan";

  if (method === "OPTIONS" && (path === "/health" || isChatRoute || isPlanningRoute)) {
    setCors(request, response, config);
    response.statusCode = 204;
    response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type");
    response.end();
    return;
  }

  if (method === "GET" && path === "/health") {
    sendJson(request, response, config, 200, { status: "ok", model: config.model });
    return;
  }

  if (method !== "POST" || (!isChatRoute && !isPlanningRoute)) {
    sendError(request, response, config, 404, "INVALID_REQUEST", "未找到接口");
    return;
  }

  let payload: { body: string; tooLarge: boolean };
  try {
    payload = await readBody(request);
  } catch {
    sendError(request, response, config, 400, "INVALID_REQUEST", "无法读取请求体");
    return;
  }

  if (payload.tooLarge) {
    sendError(request, response, config, 413, "INVALID_REQUEST", "请求体不能超过 64 KiB");
    return;
  }

  let parsedRequest;
  try {
    parsedRequest = isPlanningRoute
      ? parseTripPlanRequest(JSON.parse(payload.body))
      : parseChatRequest(JSON.parse(payload.body));
  } catch (error) {
    const message = error instanceof SyntaxError ? "请求体必须是有效 JSON" : error instanceof Error ? error.message : "请求参数无效";
    sendError(request, response, config, 400, "INVALID_REQUEST", message);
    return;
  }

  if (isPlanningRoute) {
    if (!dependencies.planner) {
      sendError(request, response, config, 503, "PLAN_NOT_AVAILABLE", "可播放行程服务尚未配置");
      return;
    }

    try {
      sendJson(
        request,
        response,
        config,
        200,
        await dependencies.planner.plan(parsedRequest as TripPlanRequest),
      );
    } catch (error) {
      const failure = plannerFailure(error);
      sendError(request, response, config, failure.status, failure.code, failure.message);
    }
    return;
  }

  try {
    sendJson(request, response, config, 200, await client.complete(parsedRequest));
  } catch (error) {
    const failure = providerFailure(error);
    sendError(request, response, config, failure.status, failure.code, failure.message);
  }
}

export function createBackendServer(dependencies: ServerDependencies): Server {
  return createServer((request, response) => {
    void handleRequest(request, response, dependencies).catch(() => {
      if (!response.headersSent) {
        sendError(request, response, dependencies.config, 500, "INTERNAL_ERROR", "服务器内部错误");
      } else {
        response.destroy();
      }
    });
  });
}
