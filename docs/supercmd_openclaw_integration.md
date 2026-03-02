# SuperCmd x OpenClaw Integration Design

目标：把 SuperCmd 从“自带多模型直连的 AI 启动器”收敛成 Vibe-OS 的桌面输入壳，并保持现有流式 UI、快捷键和主进程控制能力。

> 当前文档按“开发机模式”编写：先做架构设计和最小替换路径，不急着在当前机器上跑完整常驻服务。

## 1. 现状判断

SuperCmd 当前不是一个纯前端壳，而是自带了一整套 LLM 访问链路：

- 渲染层通过 `window.electron.aiAsk()` 发起请求
- `preload.ts` 暴露 `aiAsk` / `aiCancel` / `aiIsAvailable`
- 主进程 `ipcMain.handle('ai-ask')` 管理请求生命周期、流式回传和取消
- `ai-provider.ts` 直接对接 OpenAI / Anthropic / Gemini / Ollama / OpenAI-compatible

关键结论：

- **最佳接缝在主进程 provider 层，不在 React UI 层**
- 现有流式 UI 和 requestId 路由机制值得保留
- 第一阶段不需要大改 `AiChatView`、`useAiChat` 或 `PromptApp`

## 2. 当前代码里的关键接缝

### 主进程 AI 入口

- [main.ts](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/main/main.ts#L10670)

职责：

- 处理 `ai-ask`
- 检查是否可用
- 构造系统提示
- 调用 `streamAI()`
- 发送 `ai-stream-chunk` / `ai-stream-done` / `ai-stream-error`

这是最合适的替换点。

### Provider 实现

- [ai-provider.ts](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/main/ai-provider.ts#L1)

职责：

- 管理 provider 枚举与模型路由
- 判断 provider 是否可用
- 用统一的 async generator 对外提供流式输出

这里适合新增 `openclaw` provider，而不是推翻整套流式协议。

### 聊天 UI

- [useAiChat.ts](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/renderer/src/hooks/useAiChat.ts#L42)
- [AiChatView.tsx](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/renderer/src/views/AiChatView.tsx#L17)

职责：

- 发起请求
- 消费流式 chunk
- 处理取消和退出 AI mode

这层应该尽量保持薄，不要把 OpenClaw 连接逻辑下沉到 React。

### Prompt 重写 UI

- [PromptApp.tsx](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/renderer/src/PromptApp.tsx#L59)

职责：

- 将“改写选中文本 / 插入文本”的意图组装成 prompt
- 等待完整响应
- 直接写回当前编辑器

这一层对“只返回纯文本”有强假设，后续不能直接用普通聊天语义替代。

### 设置层

- [settings-store.ts](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/main/settings-store.ts#L13)
- [AITab.tsx](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/renderer/src/settings/AITab.tsx#L618)

当前设置明显是“API key + provider”模型中心设计。Vibe-OS 后续应逐步改成“Gateway 连接中心”。

## 3. 目标架构

### 核心原则

- SuperCmd 只负责桌面交互体验
- OpenClaw 负责 Agent、记忆、QMD、渠道和行为约束
- 桌面端不再直接拼接各家模型 API

### 建议分层

```text
Renderer UI
  -> preload IPC
    -> main process request controller
      -> brain transport layer
        -> OpenClaw gateway / local agent endpoint
```

这里有两个重要点：

- `request controller` 继续保留现有 `requestId + cancel + stream event` 机制
- `brain transport layer` 才是新增层，用来封装“如何和 OpenClaw 通信”

## 4. 三类意图必须分开

SuperCmd 接入 Vibe-OS 后，至少有三类意图：

### 1. Ask Brain

用途：

- 正常问答
- 调记忆
- 调 QMD
- 做连续对话

输出特征：

- 允许正常回复
- 允许流式文本

### 2. Vibe Dump

用途：

- 快速倾倒想法
- 只要求落盘到 `memory/braindump.md`

输出特征：

- 极短确认语
- 完成后窗口应立即隐藏
- 不应展开成长对话

### 3. Rewrite

用途：

- 改写选中文本
- 生成要插入编辑器的结果

输出特征：

- 必须只返回可插入文本
- 不允许寒暄、解释、格式包装

结论：

- 这三类意图不能长期复用一个通用裸 prompt
- 即使 UI 入口暂时共用，主进程接口也应该开始区分语义

## 5. 推荐演进路线

### Phase A: 最小替换

目标：不动 React UI，大部分逻辑留在主进程。

做法：

- 在 `AISettings.provider` 中新增 `openclaw`
- 在 `ai-provider.ts` 增加 `streamOpenClaw()`
- 让现有 `ai-ask` 在 provider 为 `openclaw` 时，改走 OpenClaw
- 继续复用现有 `ai-stream-chunk/done/error`

收益：

- 改动面最小
- 聊天 UI 和 Prompt UI 都能继续工作
- 便于开发机 smoke test

代价：

- `PromptApp` 和 `AiChat` 还共享同一个 `ai-ask`
- 语义边界还不够清晰

### Phase B: 语义拆分

目标：把“聊天”、“倾倒”、“改写”拆成不同请求类型。

建议新增接口：

- `brainAsk`
- `brainDump`
- `brainRewrite`
- `brainCancel`
- `brainStatus`

对应 UI：

- `AiChatView` -> `brainAsk`
- 快速倾倒命令 -> `brainDump`
- `PromptApp` -> `brainRewrite`

收益：

- 行为边界清晰
- 便于把 Vibe-OS 的产品语义写进代码
- 后续接远程部署机更稳

### Phase C: 设置页重构

目标：从“模型设置”转向“Brain 连接设置”。

建议替换为：

- OpenClaw base URL
- gateway token
- local / remote mode
- connection status
- default action

可以保留旧 provider 作为开发回退，但不再作为主体验中心。

## 6. 最小可行接口设计

第一版不需要追求 OpenClaw 全能力，只需要一个足够薄的传输层。

### 建议的传输抽象

```ts
interface BrainRequest {
  mode: 'ask' | 'dump' | 'rewrite';
  prompt: string;
  systemPrompt?: string;
  sessionId?: string;
  signal?: AbortSignal;
}
```

```ts
interface BrainTransport {
  isAvailable(): Promise<boolean>;
  stream(request: BrainRequest): AsyncGenerator<string>;
}
```

这样 `main.ts` 只关心：

- 现在发的是什么请求
- 怎么把结果转成现有 IPC chunk 事件

而不关心底层到底是直连 provider，还是走 OpenClaw。

### 建议的 IPC 草图

如果进入语义拆分阶段，建议逐步从现有 `ai-*` 迁移到更明确的 `brain-*`：

```ts
type BrainMode = 'ask' | 'dump' | 'rewrite';

interface BrainRequestOptions {
  mode: BrainMode;
  model?: string;
  creativity?: number;
  systemPrompt?: string;
}
```

```ts
brainAsk(requestId: string, prompt: string, options?: Omit<BrainRequestOptions, 'mode'>): Promise<void>
brainDump(requestId: string, text: string): Promise<void>
brainRewrite(
  requestId: string,
  payload: { instruction: string; selectedText?: string },
  options?: Omit<BrainRequestOptions, 'mode'>
): Promise<void>
brainCancel(requestId: string): Promise<void>
brainIsAvailable(): Promise<boolean>
```

事件层可以先保持和现在一致，只把命名从 `ai-*` 逐步切到 `brain-*`：

```ts
brain-stream-chunk
brain-stream-done
brain-stream-error
```

这样做的好处是：

- 渲染层迁移成本低
- 可以保留现有 `requestId` 路由逻辑
- `PromptApp`、聊天面板、快速倾倒入口都能共用一套流式协议

### OpenClaw 会话连续性要求

OpenClaw 的 `/v1/responses` 默认是**按请求无状态**的。

如果希望 SuperCmd 的聊天面板保持多轮连续上下文，必须在请求里带一个稳定标识，例如：

- OpenResponses `user`
- 或未来明确的 `sessionKey`

因此：

- `AiChatView` 应在“进入 AI mode”时生成一次 `sessionId`
- 同一次聊天里的后续追问应复用该 `sessionId`
- `exitAiMode()` 时再清掉它

而像 `PromptApp` 这种改写式请求，默认保持无状态更合理。

### 主进程侧的职责划分

建议把未来主进程职责拆成三层：

1. **IPC Handler**
   - 接收 `brainAsk` / `brainDump` / `brainRewrite`
   - 管理 `requestId`
   - 广播 chunk / done / error

2. **Brain Controller**
   - 按 mode 构造统一请求
   - 负责取消、超时和错误归一化
   - 决定是否要附加 rewrite 专用规则

3. **OpenClaw Transport**
   - 真正和 OpenClaw gateway / local endpoint 通信
   - 屏蔽本地/远程连接差异

这样可以避免把 OpenClaw 协议细节直接揉进 `ipcMain.handle(...)`。

### 渲染层入口如何映射

建议映射如下：

- `AiChatView` / `useAiChat`
  - 先继续走现有聊天 UI
  - 底层从 `aiAsk` 过渡到 `brainAsk`

- 快速倾倒命令
  - 直接走 `brainDump`
  - 成功后立即隐藏窗口

- `PromptApp`
  - 走 `brainRewrite`
  - 继续要求“只返回可插入文本”

### 兼容过渡策略

为了避免一次性改动过大，可以采用两步过渡：

1. **过渡期**
   - `window.electron.aiAsk()` 仍存在
   - 主进程内部把它转发到 Brain Controller
   - 根据调用来源决定默认 mode

2. **收口期**
   - 新代码只使用 `brainAsk` / `brainDump` / `brainRewrite`
   - `aiAsk` 仅保留为兼容层，最终移除

这比一次性全量替换 renderer 更稳。

### PromptApp -> brainRewrite 的专项拆分

这里需要单独强调：`Rewrite` 不只是一个产品模式，它还是一条**强约束 RPC**。

当前有两条 UI 链路都在做同一件事：

- [PromptApp.tsx](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/renderer/src/PromptApp.tsx#L59)
- [useCursorPrompt.ts](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/renderer/src/hooks/useCursorPrompt.ts#L142)

它们现在的共同问题是：

- 在 renderer 里手工拼自然语言 prompt
- 通过通用 `aiAsk` 发送请求
- 假设模型一定会“只返回可插入文本”
- 返回后立刻写回编辑器

这套做法短期能跑，但长期有三个风险：

1. **行为约束不稳定**
   - 一旦底层切到 OpenClaw 的通用聊天 agent，模型更容易输出解释、前缀或 markdown。

2. **规则散落在前端**
   - `PromptApp` 和 `useCursorPrompt` 各自维护一套 rewrite prompt，后面很容易漂移。

3. **无法表达真正的产品语义**
   - “改写选中文本”和“在光标处插入文本”本质上不是聊天，而是一个受控编辑动作。

因此建议把它们收敛成统一的 `brainRewrite` 接口。

#### 建议的 renderer 职责

渲染层只负责：

- 收集 `instruction`
- 读取当前选中文本
- 展示处理中 / 错误 / 成功状态
- 在完成后把结果应用回编辑器

渲染层不再负责：

- 拼接 rewrite 规则 prompt
- 判断“这次该不该允许解释性输出”
- 区分 OpenClaw 的改写模式和聊天模式

#### 建议的 main / controller 职责

`brainRewrite` 应该在主进程里变成一个显式动作：

```ts
interface BrainRewritePayload {
  instruction: string;
  selectedText?: string;
}
```

```ts
brainRewrite(
  requestId: string,
  payload: BrainRewritePayload,
  options?: Omit<BrainRequestOptions, 'mode'>
): Promise<void>
```

主进程或 `Brain Controller` 负责：

- 根据是否有 `selectedText`，决定是 `rewrite-selection` 还是 `insert-at-cursor`
- 统一附加 rewrite 专用规则
- 禁止走聊天会话连续性
- 统一错误文案，例如“空响应”或“非纯文本响应”
- 把请求转发给 OpenClaw transport

#### rewrite 请求的行为契约

`brainRewrite` 应有固定契约，而不是依赖每个 renderer 自己提醒模型：

- 输入是编辑意图，不是聊天消息
- 输出必须是“最终可插入文本”
- 不允许解释、寒暄、标题、markdown、引号、标签
- 默认保持**无状态**
- 不复用 `AiChatView` 的 `sessionId`

还有一个细节必须提前定住：

- `PromptApp` 和 `useCursorPrompt` 都依赖“原样写回编辑器”
- 因此主进程不应擅自做 `.trim()` 之类会破坏换行的清洗
- 唯一允许的空响应判断应该在“是否完全为空”这一层

#### 与 OpenClaw 的边界

从 SuperCmd 的视角看，`brainRewrite` 最好被视为：

- 一个专用 transport mode
- 或一个专用 agent action

而不是“把通用聊天 prompt 写得更凶一点”。

这能带来两个直接好处：

1. 后面如果 OpenClaw 侧要为 rewrite 做专门系统提示或工具约束，SuperCmd 不需要再改 renderer。
2. `PromptApp` 的稳定性不再依赖提示词技巧，而是依赖明确接口。

#### 最小落地路径

这部分我建议按最小 patch 面推进：

1. 在 `preload.ts` / `electron.d.ts` 增加 `brainRewrite`
2. 在 `main.ts` 里新增 `ipcMain.handle('brain-rewrite', ...)`
3. 在 `Brain Controller` 或现有 `ai-ask` 旁边集中生成 rewrite 专用 prompt
4. 先把 [PromptApp.tsx](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/renderer/src/PromptApp.tsx#L59) 迁到 `brainRewrite`
5. 再把 [useCursorPrompt.ts](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/renderer/src/hooks/useCursorPrompt.ts#L142) 迁过去
6. 最后删除 renderer 里的 `compositePrompt` 拼接逻辑

原因很直接：

- `PromptApp` 是独立窗口，边界更清晰，更适合先迁
- `useCursorPrompt` 嵌在主应用内，联动面更大，适合第二步再收

#### 第一阶段先不要做的事

这一步先不要引入以下复杂度：

- 不要给 rewrite 引入多轮上下文
- 不要在 renderer 侧增加新的对话状态机
- 不要同时重做 `PromptApp` UI
- 不要先碰 `Vibe Dump`

第一阶段的验收标准应该只有三个：

1. `PromptApp` 不再调用通用 `aiAsk`
2. rewrite 规则只在主进程维护一份
3. 输出仍能稳定写回编辑器，且不破坏换行

## 7. 当前最值得保留的部分

这些东西不应该轻易推翻：

- `requestId` 路由
- `AbortController` 取消机制
- `ai-stream-chunk/done/error` 事件模型
- React 侧的薄状态管理

原因很简单：这些都已经是比较干净的边界，重写收益低，回归风险高。

## 8. 当前最值得改掉的部分

### 1. 多模型直连中心化

SuperCmd 当前把自己当成 LLM 客户端，这和 Vibe-OS 的架构方向不一致。

### 2. 设置页的 API key 中心模型

这套设计更适合通用 AI Launcher，不适合“接一个外脑服务”。

### 3. 双重记忆注入风险

[main.ts](/Users/jungle/Desktop/dev/vibe-os/SuperCmd/src/main/main.ts#L10687) 当前会先构建 `memoryContextSystemPrompt`。

如果以后请求已经交给 OpenClaw，而 OpenClaw 自己还会注入：

- `AGENTS.md`
- `MEMORY.md`
- `memory/`
- QMD 检索结果

那么 SuperCmd 这层本地记忆增强必须关掉，否则会出现：

- 重复喂上下文
- token 膨胀
- 风格冲突
- 调试困难

## 9. 开发机模式下的建议

当前这台机器只做开发，不做正式常驻部署。

因此推荐策略是：

- 先在代码层把 OpenClaw 接缝设计清楚
- 保留本地 provider 作为应急回退
- 把正式连接模式默认指向未来部署机，而不是当前机器

开发机上的目标不是“长期跑起来”，而是：

- 结构正确
- 可 smoke test
- 能无痛迁移到部署机

## 10. 建议的后续文档与实现顺序

### 先写，不急着改代码

1. 确定 OpenClaw 连接模式
   - 本地 gateway
   - 远程部署机 gateway
   - 是否保留开发回退 provider

2. 定义三类动作的产品入口
   - Ask Brain
   - Vibe Dump
   - Rewrite

3. 定义主进程接口命名
   - 继续复用 `ai-*`
   - 还是迁移为 `brain-*`

### 真正开工时的推荐顺序

1. 先加 `openclaw` provider 和 transport 层
2. 保持 `ai-ask` 外壳不变，内部改由 Brain Controller 接管
3. 再拆 `ask/dump/rewrite` 语义接口
4. 最后重构设置页和命令入口

## 11. 如何开始落地

如果现在开始真正推进，建议按下面这个最小路径执行：

1. **先只动主进程，不动 React**
   - 在 `settings-store.ts` 为 `provider` 加入 `openclaw`
   - 在 `ai-provider.ts` 增加 `streamOpenClaw()`
   - 在 `main.ts` 的 `ai-ask` 中增加 `openclaw` 分支

2. **先把 OpenClaw 当作一个 provider**
   - 不急着重命名为 `brain-*`
   - 先让现有聊天面板能通过 OpenClaw 返回流式结果
   - 先验证取消、错误、stream chunk 都正常

3. **确认 PromptApp 是否需要单独分流**
   - 如果普通问答能跑通，再把 `PromptApp` 从通用 `aiAsk` 拆到 `brainRewrite`
   - 不建议在第一刀里同时改聊天和改写两条链

4. **最后再改产品入口**
   - 增加 `Vibe Dump`
   - 增加 `Ask Brain`
   - 把设置页从 API key 中心改成 Gateway 连接中心

当前最推荐的第一刀非常明确：

- 不改 UI
- 不改设置页结构
- 不接 Telegram
- 只让 `AiChatView` 背后的 `ai-ask` 改走 OpenClaw transport

这一步一旦跑通，后面所有动作都会简单很多。

## 12. 当前建议结论

最稳的落地方式不是“重写 SuperCmd”，而是：

- **保留现有 UI**
- **保留现有 IPC 流模型**
- **把 provider 层替换成 OpenClaw transport**
- **再逐步把产品语义从 `ai-*` 收敛到 `brain-*`**

这条路径改动小、可验证、可迁移，也最符合 Vibe-OS 当前“开发机先整理、部署机再常驻”的推进节奏。
