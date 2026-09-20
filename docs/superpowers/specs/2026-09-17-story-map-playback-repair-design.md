# 故事地图播放修复与优化设计

## 目标

修复 `/trip` 故事地图在开发地址、行程数据一致性、投影切换和路线显示上的已确认问题，并减少播放期间不必要的 WebGL 帧工作；保持现有 Engine 唯一渲染循环、暂停/恢复/跳章节和 `TripPlan`/`StoryTimeline` 契约。

## 已确认根因

- Next.js 开发服务器缺少 `allowedDevOrigins`，从 `127.0.0.1` 打开时客户端 chunk 被拦截，页面停留在服务端 HTML。
- `BaiduMapStage` 的 `onReady` 发生在 Engine、R3F root 和外部渲染循环挂载完成后；当前安装的 mapv-three 没有明确的公开底图瓦片 ready 回调，因此“已连接”不能表述为瓦片已完成。
- `lib/trip/local-trip-store.ts` 只验证行程对象的外形和 plan/timeline ID 绑定，没有验证 timeline 命令引用的 POI、路线和旁白是否来自同一份计划。
- `createMapStageRuntime` 通过追加数组保留所有历史路线；`RouteLine` 对隐藏或已完成的路线仍在每帧采样、更新 BufferAttribute。
- `globe.focus` 与 `projection.toFlat` 在百度底图故事播放中都保持 `EPSG:4326`；切换到球面投影会销毁并重建底图，导致播放中的画面被清空。

## 设计

### 1. 开发地址与状态文案

在 `next.config.ts` 添加 `allowedDevOrigins: ["127.0.0.1"]`，保留 `localhost` 默认行为。地图状态继续区分 `loading`、`ready`、`error`，但 ready 文案改为“引擎就绪”，消息明确说明百度瓦片可能继续加载；不添加无法由当前 provider 可靠支持的定时假 ready。

### 2. 可播放行程验证

继续把验证逻辑放在本地存储模块，不增加持久化接口。扩展现有 `isPlanningResult`：

- 每个 POI UID 和路线 ID 唯一且可被 timeline 命令引用；
- `poi.show`、`route.draw`、`route.follow` 只引用当前 plan 中存在的对象；
- `narration.show` 带 `poiUid` 时，UID 必须存在且文本必须等于对应 `TripStop.narration`；无 UID 的 intro/closing 旁白仍允许；
- plan 与 timeline 的 trip ID/version 继续强制匹配。

不合格的浏览器缓存沿用现有策略清理并回退 fixture，避免展示错配内容。为新规则增加真实 `saveActiveTrip`/`loadActiveTrip` 回归测试。

### 3. 投影与路线视觉

- `globe.focus` 与 `projection.toFlat` 都使用 `EPSG:4326`；重置或投影处理前取消当前飞行，避免旧的异步相机动画覆盖新章节。
- 章节跳转先发出最近的 `stage.clear`，再只重放所选章节起点的命令，不重放前面章节的路线跟随状态。
- 路线切换时只保留当前路线，避免已完成路线与新路线首尾叠加成混淆线条。
- 保留单个轻量路线移动点，绑定当前 route animation；`route.follow` 只发起一次到路线终点的地图飞行，不在 Engine 帧中调用 `setCenter`，避免底图瓦片在播放期间反复重算，不新增第二个渲染循环。

### 4. 帧预算

- 将 map runtime state 缓存到 ref，在命令应用时更新，移除 `StoryOverlay` 每帧复制状态数组。
- 隐藏路线直接隐藏并返回；静态路线只在可见性、激活状态或 draw progress 变化时更新 draw range、材质和 `needsUpdate`。
- POI 未显示时不做投影和缩放计算；当前已显示的 POI 保持投影同步。
- 保留已有的 Engine 播放态渲染循环、暂停静态重绘和 DPR 1.5 上限；不新增依赖，不改变播放速率。

### 5. UI 合成层

移除故事地图返回链接和全局主题按钮的 `backdrop-filter`，保留背景、边框、阴影和 focus 样式。

## 错误处理与兼容性

- 本地缓存验证失败时不尝试修补或猜测旁白，清除缓存并使用现有 fallback。
- reduced-motion 下路线移动点直接隐藏或停在终点，现有 ring reveal 和地图飞行的 reduced-motion 行为保持不变。
- 无百度 AK 时仍可使用故事叠加层；状态文案不得声称底图已连接。

## 验证标准

- focused Node tests 覆盖缓存语义校验、runtime 路线可见性、投影命令和路线动画更新。
- `npm run lint`、`npx tsc --noEmit` 通过；`npm run build` 若受 Windows `.next` cache `EPERM` 阻塞，单独报告为环境阻塞。
- Chrome `http://localhost:8989/trip` 可完成：初始加载、开始/暂停、重播、跳章节、主题切换；控制台不出现当前实现新增的错误。
- Chrome `http://127.0.0.1:8989/trip` 能完成 hydration，至少不再停留在无 Canvas 的服务端 HTML。

## 明确不做

- 不引入真实百度瓦片加载回调的私有 API。
- 不实现车辆模型或全国地图数据接入。
- 不把当前本地 fixture/缓存能力描述成云同步、实时导航或已验证全国规划。
