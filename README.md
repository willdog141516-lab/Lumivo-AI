# Lumivo AI

Lumivo AI 是一个以地图叙事为核心的 AI 旅行规划产品。当前提供可切换 AI provider 的基础聊天入口，并把南京三日 fixture 接成一个可验证、可播放的本地闭环；全国目的地的地图校验仍待百度数据接入。

项目当前采用“本地功能优先”策略：先完成可运行、可验证的本地闭环，再评估登录、云端存储和服务器部署。

## 首版范围

- 中国境内的 AI 旅行建议与行程方向
- 街道级地图浏览与景点查看
- 地球到平面地图、城市和首个景点的镜头过渡
- 分日路线绘制、镜头跟随、景点讲解与播放控制
- 海外请求统一提示“暂不支持该地区”

首版不包含实时 GPS 导航、偏航重算、语音导航、登录注册、云端同步或生产环境部署。

## 当前状态

已经完成：

- Next.js 首页替换
- React Three Fiber 交互式地球原型
- 鼠标拖动、缩放、自动旋转和星空背景
- 南京三日 fixture 的 StoryPlayer、播放控制和 MapStage 路线叠加层
- TypeScript Node AI backend：`/health`、`/api/chat`、请求校验、超时和 provider 错误处理
- `/ai` 基础中文聊天页面，支持任意中国目的地、天数、加载和错误状态
- `POST /api/trips/plan`：仅支持南京三日 fixture，严格校验 AI 返回的 fixture UID 和顺序
- `/ai` 的“生成可播放行程”动作，以及 `lumivo.active-trip.v1` fixture 标识存储

尚未接入：

- 真实百度 POI、路线服务和在线地图验证
- 南京以外目的地的已验证 `TripPlan` / `StoryTimeline` 规划流程
- 生产部署、登录和云端持久化

## 技术方向

| 范围 | 技术 | 职责 |
| --- | --- | --- |
| 前端应用 | Next.js 16、React 19、TypeScript | 页面、对话、行程详情和状态管理 |
| 三维效果 | React Three Fiber、Three.js | 地球和地图上的自定义视觉效果 |
| 地图能力 | 百度地图 JSAPI Three / Web API | 中国地图、POI、坐标、路线和地图相机 |
| 后端 | TypeScript、Node `http`/`fetch` | AI provider 代理、请求边界和统一聊天响应 |
| 本地存储 | localStorage | 最近一次已验证 fixture 的 id/version 标识 |

## 本地运行

```bash
npm install
npm run dev
npm run backend:dev
```

前端访问 [http://localhost:8989](http://localhost:8989)，AI 聊天页为 [http://localhost:8989/ai](http://localhost:8989/ai)；backend 默认监听 `http://localhost:8000`。

验证南京本地可播放闭环：

1. 启动 `npm run backend:dev` 和 `npm run dev`。
2. 打开 `/ai`，填写“南京”和 `3` 天。
3. 点击“生成可播放行程”，页面会回到 `/` 并加载路线故事。
4. 使用成都等未接入目的地时，页面会显示明确的未接入提示。

将本地 provider 配置放在被忽略的 `backend/.env` 中。DeepSeek 是默认配置，也可以切换任意 OpenAI-compatible Chat Completions API：

```text
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=
AI_MODEL=deepseek-chat
AI_TIMEOUT_MS=30000
CORS_ORIGIN=http://localhost:8989
```

已有 `DEEPSEEK_API_KEY` 时会作为 `AI_API_KEY` 的 fallback；key 只在 backend 使用，不会进入浏览器。

常用检查：

```bash
npm run lint
npx tsc --noEmit
npm run backend:test
npm run backend:typecheck
npm run build
```

前端与 backend 分别启动，不要求 Docker、Nginx 或远程服务器。当前自由聊天仍返回 AI 建议；可播放行程只返回已有南京 fixture，不宣称其他目的地的坐标、路线距离、营业时间或实时信息已经过地图验证。

## 项目文档

- [CONTEXT.md](./CONTEXT.md)：当前阶段、已确认决策和下一步上下文
- [AGENTS.md](./AGENTS.md)：代码代理和贡献者必须遵守的工程规则
- [架构设计](./docs/superpowers/specs/2026-08-18-local-first-ai-travel-map-design.md)：首版完整产品与技术设计

## 产品原则

1. AI 负责理解与编排，地图服务负责事实。
2. AI 不生成坐标、路线几何或未经验证的景点。
3. 播放器只消费通过校验且版本匹配的行程。
4. 首版只承诺中国境内能力，海外不做降级猜测。
5. 先把 provider-configurable chat 接到已验证的南京 fixture，再扩展百度事实、全国目的地行程编排、账号和部署。
