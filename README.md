# Lumivo AI

Lumivo AI 是一个以地图叙事为核心的 AI 旅行规划产品。用户用自然语言描述旅行需求，例如“我计划去南京玩三天”，系统生成经过地图数据校验的行程，并通过地球、城市地图、路线和景点讲解逐步演示整个旅程。

项目当前采用“本地功能优先”策略：先完成可运行、可验证的本地闭环，再评估登录、云端存储和服务器部署。

## 首版范围

- 中国境内的 AI 行程规划
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

尚未接入：

- Python FastAPI 后端
- 百度地图 JSAPI Three、POI 和路线服务
- AI 模型与行程规划流程
- StoryPlayer 路线动画播放器

## 技术方向

| 范围 | 技术 | 职责 |
| --- | --- | --- |
| 前端应用 | Next.js 16、React 19、TypeScript | 页面、对话、行程详情和状态管理 |
| 三维效果 | React Three Fiber、Three.js | 地球和地图上的自定义视觉效果 |
| 地图能力 | 百度地图 JSAPI Three / Web API | 中国地图、POI、坐标、路线和地图相机 |
| 后端 | Python、FastAPI、Pydantic | AI 编排、地图数据校验和统一数据契约 |
| 本地存储 | localStorage | 首版行程草稿和最近一次规划 |

## 本地运行

当前仓库只包含前端：

```bash
npm install
npm run dev
```

浏览器访问 [http://localhost:9090](http://localhost:9090)。

常用检查：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

FastAPI 后端默认在 `http://localhost:8000` 运行。前端与后端分别启动，不要求 Docker、Nginx 或远程服务器。

## 项目文档

- [CONTEXT.md](./CONTEXT.md)：当前阶段、已确认决策和下一步上下文
- [AGENTS.md](./AGENTS.md)：代码代理和贡献者必须遵守的工程规则
- [架构设计](./docs/superpowers/specs/2026-08-18-local-first-ai-travel-map-design.md)：首版完整产品与技术设计

## 产品原则

1. AI 负责理解与编排，地图服务负责事实。
2. AI 不生成坐标、路线几何或未经验证的景点。
3. 播放器只消费通过校验且版本匹配的行程。
4. 首版只承诺中国境内能力，海外不做降级猜测。
5. 先完成南京三日游本地闭环，再扩展城市、账号和部署。
