import type { RouteLeg, TripDay, TripPlan } from "@/lib/trip/types";

const labels: Record<RouteLeg["mode"], string> = {
  walk: "步行",
  transit: "公共交通",
  drive: "驾车",
  ride: "骑行",
};

const icons: Record<RouteLeg["mode"], string | null> = {
  walk: "icon-buxing",
  transit: "icon-a-211_ditie",
  drive: "icon-xiaoqiche",
  ride: "icon-qixing",
};

const emojis: Record<RouteLeg["mode"], string> = {
  walk: "🚶",
  transit: "🚌",
  drive: "🚗",
  ride: "🚲",
};

export function transportSummaryForDay(day: TripDay) {
  return day.routeLegs.map((leg, index) => ({
      id: leg.id,
      day: day.day,
      fromName: day.stops[index]?.poi.name ?? leg.fromPoiUid,
      toName: day.stops[index + 1]?.poi.name ?? leg.toPoiUid,
      label: labels[leg.mode],
      icon: icons[leg.mode],
      fallbackIcon: icons[leg.mode] ? null : emojis[leg.mode],
      emoji: emojis[leg.mode],
      instruction: leg.instructions?.[0],
      durationMinutes: Math.max(1, Math.round(leg.durationSeconds / 60)),
      distanceKilometers: (leg.distanceMeters / 1000).toFixed(1),
    }));
}

export function transportSummary(plan: TripPlan) {
  return plan.days.flatMap(transportSummaryForDay);
}

export function transportSummaryMarkdown(plan: TripPlan) {
  const lines = ["### 已验证交通方式"];
  for (const day of plan.days) {
    const legs = transportSummaryForDay(day);
    if (!legs.length) {
      lines.push(`- 第${day.day}天：${day.stops.length <= 1 ? "当天只有一个地点，无跨地点交通" : "当天暂无可验证交通路线"}`);
      continue;
    }
    lines.push(
      ...legs.map(
        (leg) => `- 第${leg.day}天 ${leg.fromName} → ${leg.toName}：${leg.emoji} ${leg.label}${leg.instruction ? `（${leg.instruction}）` : ""} · 约${leg.durationMinutes}分钟 / ${leg.distanceKilometers}公里`,
      ),
    );
  }
  return lines.join("\n");
}
