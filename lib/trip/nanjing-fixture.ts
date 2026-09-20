import type {
  GeoPoint,
  PlanningResult,
  RouteLeg,
  StoryChapter,
  StoryCommand,
  StoryCommandPayloads,
  StoryCommandType,
  StoryTimeline,
  TripPlan,
  TripStop,
  VerifiedPoi,
} from "./types.ts";

const FIXTURE_VERIFIED_AT = "2026-08-18T00:00:00+08:00";

const createPoint = (lng: number, lat: number): GeoPoint => ({
  lng,
  lat,
  crs: "BD09",
});

const createPoi = (input: {
  uid: string;
  name: string;
  address: string;
  point: GeoPoint;
  openingHours: string;
  recommendedStayMinutes: number;
}): VerifiedPoi => ({
  ...input,
  source: "fixture",
  verifiedAt: FIXTURE_VERIFIED_AT,
});

const createStop = (poi: VerifiedPoi, narration: string): TripStop => ({
  poi,
  narration,
});

const createRoute = (input: {
  id: string;
  from: VerifiedPoi;
  to: VerifiedPoi;
  mode: RouteLeg["mode"];
  distanceMeters: number;
  durationSeconds: number;
  waypoints: GeoPoint[];
}): RouteLeg => ({
  id: input.id,
  fromPoiUid: input.from.uid,
  toPoiUid: input.to.uid,
  mode: input.mode,
  distanceMeters: input.distanceMeters,
  durationSeconds: input.durationSeconds,
  geometry: [input.from.point, ...input.waypoints, input.to.point],
});

const fuzimiao = createPoi({
  uid: "fixture-nanjing-fuzimiao",
  name: "夫子庙-秦淮风光带",
  address: "南京市秦淮区夫子庙秦淮河景区",
  point: createPoint(118.7945, 32.0232),
  openingHours: "全天开放，具体场馆以现场公告为准",
  recommendedStayMinutes: 120,
});

const zhonghuamen = createPoi({
  uid: "fixture-nanjing-zhonghuamen",
  name: "中华门",
  address: "南京市秦淮区中华门城堡",
  point: createPoint(118.7815, 32.0134),
  openingHours: "08:30-21:00",
  recommendedStayMinutes: 90,
});

const laomendong = createPoi({
  uid: "fixture-nanjing-laomendong",
  name: "老门东历史文化街区",
  address: "南京市秦淮区箍桶巷与剪子巷一带",
  point: createPoint(118.7904, 32.0116),
  openingHours: "全天开放，商户营业时间各异",
  recommendedStayMinutes: 120,
});

const presidentialPalace = createPoi({
  uid: "fixture-nanjing-presidential-palace",
  name: "南京总统府",
  address: "南京市玄武区长江路292号",
  point: createPoint(118.7986, 32.0436),
  openingHours: "08:30-18:00，周一闭馆",
  recommendedStayMinutes: 120,
});

const sixDynastiesMuseum = createPoi({
  uid: "fixture-nanjing-six-dynasties-museum",
  name: "六朝博物馆",
  address: "南京市玄武区长江路302号",
  point: createPoint(118.8032, 32.0455),
  openingHours: "09:00-18:00，周一闭馆",
  recommendedStayMinutes: 90,
});

const nanjingMuseum = createPoi({
  uid: "fixture-nanjing-museum",
  name: "南京博物院",
  address: "南京市玄武区中山东路321号",
  point: createPoint(118.8438, 32.0416),
  openingHours: "09:00-17:00，周一闭馆",
  recommendedStayMinutes: 150,
});

const xuanwuLake = createPoi({
  uid: "fixture-nanjing-xuanwu-lake",
  name: "玄武湖",
  address: "南京市玄武区玄武巷1号",
  point: createPoint(118.799, 32.0722),
  openingHours: "06:00-21:00",
  recommendedStayMinutes: 120,
});

const jimingTemple = createPoi({
  uid: "fixture-nanjing-jiming-temple",
  name: "鸡鸣寺",
  address: "南京市玄武区鸡鸣寺路1号",
  point: createPoint(118.8155, 32.0605),
  openingHours: "07:30-17:30",
  recommendedStayMinutes: 90,
});

const taicheng = createPoi({
  uid: "fixture-nanjing-taicheng",
  name: "明城墙台城段",
  address: "南京市玄武区解放门至神策门一带",
  point: createPoint(118.814, 32.0671),
  openingHours: "08:30-21:00",
  recommendedStayMinutes: 90,
});

const dayOneRouteLegs: RouteLeg[] = [
  createRoute({
    id: "fixture-route-day-1-fuzimiao-zhonghuamen",
    from: fuzimiao,
    to: zhonghuamen,
    mode: "ride",
    distanceMeters: 3400,
    durationSeconds: 960,
    waypoints: [createPoint(118.789, 32.018)],
  }),
  createRoute({
    id: "fixture-route-day-1-zhonghuamen-laomendong",
    from: zhonghuamen,
    to: laomendong,
    mode: "walk",
    distanceMeters: 1500,
    durationSeconds: 480,
    waypoints: [createPoint(118.7866, 32.011)],
  }),
];

const dayTwoRouteLegs: RouteLeg[] = [
  createRoute({
    id: "fixture-route-day-2-presidential-six-dynasties",
    from: presidentialPalace,
    to: sixDynastiesMuseum,
    mode: "walk",
    distanceMeters: 1100,
    durationSeconds: 480,
    waypoints: [createPoint(118.8005, 32.0447)],
  }),
  createRoute({
    id: "fixture-route-day-2-six-dynasties-nanjing-museum",
    from: sixDynastiesMuseum,
    to: nanjingMuseum,
    mode: "ride",
    distanceMeters: 4200,
    durationSeconds: 1200,
    waypoints: [createPoint(118.818, 32.0438)],
  }),
];

const dayThreeRouteLegs: RouteLeg[] = [
  createRoute({
    id: "fixture-route-day-3-xuanwu-jiming",
    from: xuanwuLake,
    to: jimingTemple,
    mode: "walk",
    distanceMeters: 2200,
    durationSeconds: 720,
    waypoints: [createPoint(118.8084, 32.0674)],
  }),
  createRoute({
    id: "fixture-route-day-3-jiming-taicheng",
    from: jimingTemple,
    to: taicheng,
    mode: "walk",
    distanceMeters: 800,
    durationSeconds: 300,
    waypoints: [createPoint(118.8144, 32.0638)],
  }),
];

export const nanjingTripPlan: TripPlan = {
  id: "fixture-nanjing-3d",
  version: 1,
  destination: "南京",
  summary: "用三天时间串联秦淮风光、民国城市记忆与玄武湖畔的南京城市故事。",
  days: [
    {
      day: 1,
      title: "秦淮灯影与城南旧事",
      summary: "从夫子庙沿秦淮河走到中华门，再在老门东收束第一天。",
      stops: [
        createStop(
          fuzimiao,
          "从夫子庙开始认识南京：秦淮河、牌坊与市井烟火在这里交汇。",
        ),
        createStop(
          zhonghuamen,
          "中华门是南京城墙的重要南门，可以从城门结构俯瞰城南街巷。",
        ),
        createStop(
          laomendong,
          "老门东把传统街巷、手作店铺和夜间小吃连成一段适合慢慢散步的收尾路线。",
        ),
      ],
      routeLegs: dayOneRouteLegs,
    },
    {
      day: 2,
      title: "长江路上的近代南京",
      summary: "沿长江路理解南京的近代城市脉络，再用南京博物院补足历史纵深。",
      stops: [
        createStop(
          presidentialPalace,
          "总统府保留了多重历史时期的建筑与空间，是理解近代南京的一处入口。",
        ),
        createStop(
          sixDynastiesMuseum,
          "六朝博物馆用考古遗存和城市文脉，串起南京作为六朝古都的早期记忆。",
        ),
        createStop(
          nanjingMuseum,
          "南京博物院适合用较完整的一段时间浏览，从地方文明看到更大的中国历史。",
        ),
      ],
      routeLegs: dayTwoRouteLegs,
    },
    {
      day: 3,
      title: "玄武湖畔的城墙与晨光",
      summary: "以玄武湖的开阔水面开始，在鸡鸣寺和台城段城墙结束南京三日行程。",
      stops: [
        createStop(
          xuanwuLake,
          "玄武湖给最后一天留出舒展的节奏，湖面与城墙共同构成南京的城市天际线。",
        ),
        createStop(
          jimingTemple,
          "鸡鸣寺临湖而建，短暂停留可以感受古寺、山门和城市之间的距离。",
        ),
        createStop(
          taicheng,
          "从台城段城墙回望玄武湖，把自然水面、古都城防和现代城市放进同一幅画面。",
        ),
      ],
      routeLegs: dayThreeRouteLegs,
    },
  ],
  warnings: [],
};

const createCommand = <T extends StoryCommandType>(
  id: string,
  chapterId: string,
  type: T,
  startMs: number,
  durationMs: number,
  easing: StoryCommand<T>["easing"],
  payload: StoryCommandPayloads[T],
): StoryCommand<T> =>
  ({
    id,
    chapterId,
    type,
    startMs,
    durationMs,
    easing,
    payload,
  }) as StoryCommand<T>;

const createChapter = (
  id: string,
  title: string,
  startMs: number,
  durationMs: number,
  commands: StoryCommand[],
): StoryChapter => ({
  id,
  title,
  startMs,
  durationMs,
  commands,
});

const dayOneStartMs = 5200;
const dayOneDurationMs = 15400;
const dayTwoStartMs = dayOneStartMs + dayOneDurationMs;
const dayTwoDurationMs = 15400;
const dayThreeStartMs = dayTwoStartMs + dayTwoDurationMs;
const dayThreeDurationMs = 15400;
const closingStartMs = dayThreeStartMs + dayThreeDurationMs;
const closingDurationMs = 2800;

export const nanjingStoryTimeline: StoryTimeline = {
  tripId: nanjingTripPlan.id,
  tripVersion: nanjingTripPlan.version,
  durationMs: closingStartMs + closingDurationMs,
  chapters: [
    createChapter("chapter-intro", "从全景进入南京", 0, 5200, [
      createCommand(
        "command-intro-clear",
        "chapter-intro",
        "stage.clear",
        0,
        300,
        "linear",
        {},
      ),
      createCommand(
        "command-intro-globe-focus",
        "chapter-intro",
        "globe.focus",
        0,
        1800,
        "easeInOut",
        { target: fuzimiao.point },
      ),
      createCommand(
        "command-intro-projection-flat",
        "chapter-intro",
        "projection.toFlat",
        1800,
        1000,
        "easeInOut",
        {},
      ),
      createCommand(
        "command-intro-camera-fuzimiao",
        "chapter-intro",
        "camera.flyTo",
        2800,
        1800,
        "easeInOut",
        { target: fuzimiao.point, zoom: 14 },
      ),
      createCommand(
        "command-intro-narration",
        "chapter-intro",
        "narration.show",
        3900,
        1200,
        "linear",
        {
          text: "南京三日行程，从秦淮河畔开始。",
        },
      ),
    ]),
    createChapter(
      "chapter-day-1",
      "第一天：秦淮灯影与城南旧事",
      dayOneStartMs,
      dayOneDurationMs,
      [
        createCommand(
          "command-day-1-show-fuzimiao",
          "chapter-day-1",
          "poi.show",
          dayOneStartMs,
          300,
          "linear",
          { poiUid: fuzimiao.uid },
        ),
        createCommand(
          "command-day-1-narrate-fuzimiao",
          "chapter-day-1",
          "narration.show",
          dayOneStartMs + 300,
          1800,
          "linear",
          { text: "从夫子庙开始认识南京：秦淮河、牌坊与市井烟火在这里交汇。", poiUid: fuzimiao.uid },
        ),
        createCommand(
          "command-day-1-fit-route-1",
          "chapter-day-1",
          "camera.flyTo",
          dayOneStartMs + 2100,
          800,
          "easeInOut",
          { target: dayOneRouteLegs[0].geometry[1], zoom: 12 },
        ),
        createCommand(
          "command-day-1-draw-route-1",
          "chapter-day-1",
          "route.draw",
          dayOneStartMs + 2900,
          800,
          "linear",
          { routeLegId: dayOneRouteLegs[0].id },
        ),
        createCommand(
          "command-day-1-follow-route-1",
          "chapter-day-1",
          "route.follow",
          dayOneStartMs + 3700,
          1700,
          "easeInOut",
          { routeLegId: dayOneRouteLegs[0].id },
        ),
        createCommand(
          "command-day-1-show-zhonghuamen",
          "chapter-day-1",
          "poi.show",
          dayOneStartMs + 5400,
          300,
          "linear",
          { poiUid: zhonghuamen.uid },
        ),
        createCommand(
          "command-day-1-narrate-zhonghuamen",
          "chapter-day-1",
          "narration.show",
          dayOneStartMs + 5700,
          1900,
          "linear",
          { text: "中华门是南京城墙的重要南门，可以从城门结构俯瞰城南街巷。", poiUid: zhonghuamen.uid },
        ),
        createCommand(
          "command-day-1-fit-route-2",
          "chapter-day-1",
          "camera.flyTo",
          dayOneStartMs + 7600,
          800,
          "easeInOut",
          { target: dayOneRouteLegs[1].geometry[1], zoom: 12 },
        ),
        createCommand(
          "command-day-1-draw-route-2",
          "chapter-day-1",
          "route.draw",
          dayOneStartMs + 8400,
          800,
          "linear",
          { routeLegId: dayOneRouteLegs[1].id },
        ),
        createCommand(
          "command-day-1-follow-route-2",
          "chapter-day-1",
          "route.follow",
          dayOneStartMs + 9200,
          1600,
          "easeInOut",
          { routeLegId: dayOneRouteLegs[1].id },
        ),
        createCommand(
          "command-day-1-show-laomendong",
          "chapter-day-1",
          "poi.show",
          dayOneStartMs + 10800,
          300,
          "linear",
          { poiUid: laomendong.uid },
        ),
        createCommand(
          "command-day-1-narrate-laomendong",
          "chapter-day-1",
          "narration.show",
          dayOneStartMs + 11100,
          2500,
          "linear",
          { text: "老门东把传统街巷、手作店铺和夜间小吃连成一段适合慢慢散步的收尾路线。", poiUid: laomendong.uid },
        ),
        createCommand(
          "command-day-1-pause",
          "chapter-day-1",
          "chapter.pause",
          dayOneStartMs + 13600,
          1800,
          "linear",
          {},
        ),
      ],
    ),
    createChapter(
      "chapter-day-2",
      "第二天：长江路上的近代南京",
      dayTwoStartMs,
      dayTwoDurationMs,
      [
        createCommand(
          "command-day-2-show-presidential-palace",
          "chapter-day-2",
          "poi.show",
          dayTwoStartMs,
          300,
          "linear",
          { poiUid: presidentialPalace.uid },
        ),
        createCommand(
          "command-day-2-narrate-presidential-palace",
          "chapter-day-2",
          "narration.show",
          dayTwoStartMs + 300,
          1800,
          "linear",
          { text: "总统府保留了多重历史时期的建筑与空间，是理解近代南京的一处入口。", poiUid: presidentialPalace.uid },
        ),
        createCommand(
          "command-day-2-fit-route-1",
          "chapter-day-2",
          "camera.flyTo",
          dayTwoStartMs + 2100,
          800,
          "easeInOut",
          { target: dayTwoRouteLegs[0].geometry[1], zoom: 12 },
        ),
        createCommand(
          "command-day-2-draw-route-1",
          "chapter-day-2",
          "route.draw",
          dayTwoStartMs + 2900,
          800,
          "linear",
          { routeLegId: dayTwoRouteLegs[0].id },
        ),
        createCommand(
          "command-day-2-follow-route-1",
          "chapter-day-2",
          "route.follow",
          dayTwoStartMs + 3700,
          1700,
          "easeInOut",
          { routeLegId: dayTwoRouteLegs[0].id },
        ),
        createCommand(
          "command-day-2-show-six-dynasties",
          "chapter-day-2",
          "poi.show",
          dayTwoStartMs + 5400,
          300,
          "linear",
          { poiUid: sixDynastiesMuseum.uid },
        ),
        createCommand(
          "command-day-2-narrate-six-dynasties",
          "chapter-day-2",
          "narration.show",
          dayTwoStartMs + 5700,
          1900,
          "linear",
          { text: "六朝博物馆用考古遗存和城市文脉，串起南京作为六朝古都的早期记忆。", poiUid: sixDynastiesMuseum.uid },
        ),
        createCommand(
          "command-day-2-fit-route-2",
          "chapter-day-2",
          "camera.flyTo",
          dayTwoStartMs + 7600,
          800,
          "easeInOut",
          { target: dayTwoRouteLegs[1].geometry[1], zoom: 12 },
        ),
        createCommand(
          "command-day-2-draw-route-2",
          "chapter-day-2",
          "route.draw",
          dayTwoStartMs + 8400,
          800,
          "linear",
          { routeLegId: dayTwoRouteLegs[1].id },
        ),
        createCommand(
          "command-day-2-follow-route-2",
          "chapter-day-2",
          "route.follow",
          dayTwoStartMs + 9200,
          1600,
          "easeInOut",
          { routeLegId: dayTwoRouteLegs[1].id },
        ),
        createCommand(
          "command-day-2-show-nanjing-museum",
          "chapter-day-2",
          "poi.show",
          dayTwoStartMs + 10800,
          300,
          "linear",
          { poiUid: nanjingMuseum.uid },
        ),
        createCommand(
          "command-day-2-narrate-nanjing-museum",
          "chapter-day-2",
          "narration.show",
          dayTwoStartMs + 11100,
          2500,
          "linear",
          { text: "南京博物院适合用较完整的一段时间浏览，从地方文明看到更大的中国历史。", poiUid: nanjingMuseum.uid },
        ),
        createCommand(
          "command-day-2-pause",
          "chapter-day-2",
          "chapter.pause",
          dayTwoStartMs + 13600,
          1800,
          "linear",
          {},
        ),
      ],
    ),
    createChapter(
      "chapter-day-3",
      "第三天：玄武湖畔的城墙与晨光",
      dayThreeStartMs,
      dayThreeDurationMs,
      [
        createCommand(
          "command-day-3-show-xuanwu-lake",
          "chapter-day-3",
          "poi.show",
          dayThreeStartMs,
          300,
          "linear",
          { poiUid: xuanwuLake.uid },
        ),
        createCommand(
          "command-day-3-narrate-xuanwu-lake",
          "chapter-day-3",
          "narration.show",
          dayThreeStartMs + 300,
          1800,
          "linear",
          { text: "玄武湖给最后一天留出舒展的节奏，湖面与城墙共同构成南京的城市天际线。", poiUid: xuanwuLake.uid },
        ),
        createCommand(
          "command-day-3-fit-route-1",
          "chapter-day-3",
          "camera.flyTo",
          dayThreeStartMs + 2100,
          800,
          "easeInOut",
          { target: dayThreeRouteLegs[0].geometry[1], zoom: 12 },
        ),
        createCommand(
          "command-day-3-draw-route-1",
          "chapter-day-3",
          "route.draw",
          dayThreeStartMs + 2900,
          800,
          "linear",
          { routeLegId: dayThreeRouteLegs[0].id },
        ),
        createCommand(
          "command-day-3-follow-route-1",
          "chapter-day-3",
          "route.follow",
          dayThreeStartMs + 3700,
          1700,
          "easeInOut",
          { routeLegId: dayThreeRouteLegs[0].id },
        ),
        createCommand(
          "command-day-3-show-jiming-temple",
          "chapter-day-3",
          "poi.show",
          dayThreeStartMs + 5400,
          300,
          "linear",
          { poiUid: jimingTemple.uid },
        ),
        createCommand(
          "command-day-3-narrate-jiming-temple",
          "chapter-day-3",
          "narration.show",
          dayThreeStartMs + 5700,
          1900,
          "linear",
          { text: "鸡鸣寺临湖而建，短暂停留可以感受古寺、山门和城市之间的距离。", poiUid: jimingTemple.uid },
        ),
        createCommand(
          "command-day-3-fit-route-2",
          "chapter-day-3",
          "camera.flyTo",
          dayThreeStartMs + 7600,
          800,
          "easeInOut",
          { target: dayThreeRouteLegs[1].geometry[1], zoom: 12 },
        ),
        createCommand(
          "command-day-3-draw-route-2",
          "chapter-day-3",
          "route.draw",
          dayThreeStartMs + 8400,
          800,
          "linear",
          { routeLegId: dayThreeRouteLegs[1].id },
        ),
        createCommand(
          "command-day-3-follow-route-2",
          "chapter-day-3",
          "route.follow",
          dayThreeStartMs + 9200,
          1600,
          "easeInOut",
          { routeLegId: dayThreeRouteLegs[1].id },
        ),
        createCommand(
          "command-day-3-show-taicheng",
          "chapter-day-3",
          "poi.show",
          dayThreeStartMs + 10800,
          300,
          "linear",
          { poiUid: taicheng.uid },
        ),
        createCommand(
          "command-day-3-narrate-taicheng",
          "chapter-day-3",
          "narration.show",
          dayThreeStartMs + 11100,
          2500,
          "linear",
          { text: "从台城段城墙回望玄武湖，把自然水面、古都城防和现代城市放进同一幅画面。", poiUid: taicheng.uid },
        ),
        createCommand(
          "command-day-3-pause",
          "chapter-day-3",
          "chapter.pause",
          dayThreeStartMs + 13600,
          1800,
          "linear",
          {},
        ),
      ],
    ),
    createChapter("chapter-closing", "南京三日行程结束", closingStartMs, closingDurationMs, [
      createCommand(
        "command-closing-narration",
        "chapter-closing",
        "narration.show",
        closingStartMs,
        1800,
        "linear",
        { text: "三天的南京，从秦淮河的灯影走到玄武湖的晨光，路线也在城市故事中闭合。" },
      ),
      createCommand(
        "command-closing-pause",
        "chapter-closing",
        "chapter.pause",
        closingStartMs + 1800,
        1000,
        "linear",
        {},
      ),
    ]),
  ],
};

export const nanjingPlanningResult: PlanningResult = {
  plan: nanjingTripPlan,
  timeline: nanjingStoryTimeline,
};
