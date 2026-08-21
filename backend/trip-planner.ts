import type { AiClient } from "./ai-client.js";
import type { TripPlanRequest } from "./types.js";
import { nanjingPlanningResult, nanjingTripPlan } from "../lib/trip/nanjing-fixture.js";
import type { PlanningResult } from "../lib/trip/types.js";

export type PlannerErrorCode =
  | "UNSUPPORTED_REGION"
  | "PLAN_NOT_AVAILABLE"
  | "MODEL_OUTPUT_INVALID";

export class TripPlannerError extends Error {
  constructor(
    public readonly code: PlannerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TripPlannerError";
  }
}

export type TripPlanner = {
  plan(request: TripPlanRequest): Promise<PlanningResult>;
};

export type FixtureSelection = {
  days: Array<{ day: number; poiUids: string[] }>;
};

const overseasMarkers = [
  "巴黎", "东京", "纽约", "伦敦", "首尔", "新加坡", "悉尼",
  "日本", "美国", "英国", "法国", "韩国", "欧洲", "澳大利亚",
];

// ponytail: conservative marker list; replace with a region provider before nationwide planning.

const invalidSelectionMessage = "AI 返回的行程选择无法通过校验";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExactKeySet(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys.slice().sort()[index]);
}

function normalizeDestination(destination: string): string {
  return destination.trim().replace(/市$/, "");
}

function isFixturePlan(result: PlanningResult): boolean {
  return result.plan.id === nanjingTripPlan.id
    && result.plan.version === nanjingTripPlan.version
    && result.timeline.tripId === nanjingTripPlan.id
    && result.timeline.tripVersion === nanjingTripPlan.version;
}

export function buildFixtureSelectionPrompt(request: TripPlanRequest): string {
  const candidates = nanjingTripPlan.days.map((day) => ({
    day: day.day,
    pois: day.stops.map((stop) => ({ uid: stop.poi.uid, name: stop.poi.name })),
  }));

  return [
    "你只负责确认已验证的南京三日 fixture 选择。",
    `目的地：${request.destination}`,
    `天数：${request.days}`,
    "只能从以下候选 POI 中返回原有三日顺序，不得新增或改写任何 UID：",
    JSON.stringify(candidates, null, 2),
    '只返回严格 JSON：{"days":[{"day":1,"poiUids":["fixture-nanjing-fuzimiao"]}]}',
    "不要返回坐标、路线、距离、时长、营业时间或解释文字。",
  ].join("\n");
}

export function parseFixtureSelection(content: string): FixtureSelection {
  const parsed: unknown = JSON.parse(content);
  if (!isRecord(parsed) || !isExactKeySet(parsed, ["days"]) || !Array.isArray(parsed.days)) {
    throw new Error(invalidSelectionMessage);
  }

  const days = parsed.days.map((value) => {
    if (
      !isRecord(value)
      || !isExactKeySet(value, ["day", "poiUids"])
      || !Number.isInteger(value.day)
      || !Array.isArray(value.poiUids)
      || value.poiUids.some((uid) => typeof uid !== "string" || !uid)
    ) {
      throw new Error(invalidSelectionMessage);
    }
    return { day: value.day as number, poiUids: value.poiUids as string[] };
  });

  return { days };
}

function hasExactFixtureSelection(selection: FixtureSelection): boolean {
  const expected = nanjingTripPlan.days.map((day) => ({
    day: day.day,
    poiUids: day.stops.map((stop) => stop.poi.uid),
  }));

  return selection.days.length === expected.length
    && selection.days.every((day, index) => {
      const expectedDay = expected[index];
      return day.day === expectedDay.day
        && day.poiUids.length === expectedDay.poiUids.length
        && day.poiUids.every((uid, uidIndex) => uid === expectedDay.poiUids[uidIndex]);
    });
}

export function createFixtureTripPlanner(client: AiClient): TripPlanner {
  return {
    async plan(request) {
      const destination = normalizeDestination(request.destination);
      if (overseasMarkers.some((marker) => request.destination.includes(marker))) {
        throw new TripPlannerError("UNSUPPORTED_REGION", "暂不支持该地区，等待后续开发");
      }
      if (destination !== "南京" || request.days !== 3) {
        throw new TripPlannerError("PLAN_NOT_AVAILABLE", "当前目的地的可播放行程尚未接入");
      }

      const response = await client.complete({
        ...request,
        message: buildFixtureSelectionPrompt(request),
        history: [],
      });

      try {
        const selection = parseFixtureSelection(response.message.content);
        if (!hasExactFixtureSelection(selection) || !isFixturePlan(nanjingPlanningResult)) {
          throw new Error(invalidSelectionMessage);
        }
        return nanjingPlanningResult;
      } catch {
        throw new TripPlannerError("MODEL_OUTPUT_INVALID", invalidSelectionMessage);
      }
    },
  };
}
