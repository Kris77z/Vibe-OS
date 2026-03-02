# Vibe-OS Raycast x OpenClaw Replan

目标：在保留现有 `OpenClaw` 远程大脑方案的前提下，放弃继续投入 `SuperCmd` 作为第一优先前端，改为使用 **Raycast 私有扩展** 作为桌面入口。

这份文档是对 [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md) 的一次执行层重排，不推翻大方向，只替换第二阶段的前端载体。

## 1. 为什么要改方案

当前已经验证成功的部分：

- 远程 Mac 上的 `OpenClaw gateway` 已部署
- Docker sandbox 可用
- `memory.backend = builtin`
- 本机通过 SSH tunnel 可访问远程 `OpenClaw /v1/responses`
- 真实请求已经能返回模型回答

当前不值得继续投入的部分：

- `SuperCmd` 的命令语义混乱
- AI 入口和 AI 设置页命名冲突
- Electron 运行时缓存与本地设置文件状态不稳定
- 当前问题已经不在 OpenClaw，而在前端壳的可控性

结论：

- **OpenClaw 远程大脑方案保留**
- **SuperCmd 退居次优实验路线**
- **Raycast 私有扩展升级为桌面主入口**

当前状态补充：

- Raycast MVP 已完成本机实测
- `Ask / Dump / Rewrite` 三个命令均已跑通
- 当前主线路已经从“重规划”进入“已落地、待迭代”状态

## 2. 新的整体架构

延续原始蓝图里的三层结构，但把桌面端替换掉：

1. **AI 大脑基座**
   - 仍然是远程 Mac 上的 `OpenClaw`
   - 继续使用独立实例、独立 workspace、独立 state、Docker sandbox

2. **桌面端入口**
   - 改为 `Raycast 私有扩展`
   - 只负责采集输入、展示结果、触发不同意图
   - 不再承担多模型 provider 管理

3. **移动端入口**
   - 仍保留后续 `Telegram` 原生接入路线

拓扑：

```text
Raycast Extension
  -> local SSH tunnel (127.0.0.1:28789)
    -> remote OpenClaw gateway (/v1/responses)
      -> relay / model provider
      -> workspace / memory / tools / sandbox
```

## 3. 与原始 Implementation Plan 的对应关系

### 保留的部分

- 第一阶段：优先把大脑跑稳
- 第三阶段：后续再做 digestion / automation / Telegram
- `OpenClaw` 作为唯一大脑基座
- 工作区契约仍然是 `AGENTS.md`、`MEMORY.md`、`memory/`

### 替换的部分

原计划第二阶段：

- `SuperCmd` 作为专属 Mac 极简输入壳

新的第二阶段：

- `Raycast 私有扩展` 作为专属桌面输入壳

原因不是审美，而是工程优先级：

- Raycast 的命令模型更稳定
- 扩展边界更清晰
- 不需要再维护一层 Electron 主进程设置与 IPC 状态机
- 对当前已打通的远程 OpenClaw HTTP 链路更友好

## 4. 新的产品形态

不再追求“一开始就做一个大而全的 launcher”，而是先做三个明确命令。

### 4.1 Ask Brain

用途：

- 正常问答
- 检索记忆
- 多轮对话

输入：

- 一段自由文本

输出：

- 正常流式回答

### 4.2 Brain Dump

用途：

- 快速倾倒脑内想法

输入：

- 一段自由文本

输出：

- 极简确认句

要求：

- 发送后尽快结束交互
- 不展开成长对话

### 4.3 Rewrite

用途：

- 改写一段文本

输入：

- 原文
- 指令

输出：

- 纯文本结果

要求：

- 不要寒暄
- 不要 Markdown 包装
- 不要解释过程

## 5. MVP 范围

第一版只做最小闭环，不求完整桌面 OS 壳。

### MVP 必做

- `Ask Brain`
- `Brain Dump`
- `Rewrite`
- Raycast Preferences 中的 OpenClaw 连接配置
- 通过本地 tunnel 调远程 `/v1/responses`

### MVP 不做

- Telegram UI 管理
- 本地复杂会话状态管理
- 复杂富文本输出
- 本地多 provider 回退
- Raycast 内置 AI provider hack

## 6. 技术方案

### 6.1 不走 Raycast 内置 AI

不依赖 Raycast 自带 AI provider 配置。

原因：

- 我们的核心对象是 `OpenClaw gateway`
- 不是让 Raycast 直接管理 `OpenAI/Claude`
- 这样更符合“前端壳 <-> 外部 brain service”结构

### 6.2 只做一个很薄的 OpenClaw transport

扩展内部只需要一个轻量 transport：

```ts
type BrainMode = "ask" | "dump" | "rewrite";

interface OpenClawRequest {
  mode: BrainMode;
  prompt: string;
  instructions?: string;
  sessionId?: string;
}
```

扩展只负责：

- 读 Raycast preferences
- 拼 `/v1/responses` 请求
- 处理流式或非流式响应

### 6.3 Preferences

Raycast 扩展内固定三项：

- `baseUrl`
- `gatewayToken`
- `agentId`

开发机默认值建议：

- `baseUrl = http://127.0.0.1:28789`
- `agentId = main`

说明：

- 这个 `28789` 是本机 SSH tunnel 口
- 真正远端 gateway 仍然是 `127.0.0.1:18789`

## 7. 命令设计

### 命令一：问问 Vibe-OS

形式：

- Raycast command + 表单输入

行为：

- 输入问题
- 发送到 `openclaw:main`
- 展示回答

### 命令二：倾倒到 Vibe-OS

形式：

- Raycast command + 单输入框

行为：

- 输入一句或一段
- 直接发给大脑
- 返回极简确认

### 命令三：用 Vibe-OS 改写

形式：

- Raycast command + 两个输入框
  - 原文
  - 指令

行为：

- 请求改写
- 返回纯文本结果

第一版不强求“自动写回当前编辑器”，先追求正确输出。

## 8. 会话策略

### Ask Brain

- 允许稳定 `sessionId`
- 用于保持多轮上下文

### Brain Dump

- 不强调会话连续性
- 每次独立提交即可

### Rewrite

- 默认无状态
- 不复用聊天 session

## 9. 分阶段执行计划

### Phase A: 固化远程大脑契约

目标：

- 不再继续折腾前端壳
- 把远程 OpenClaw 视为已可用基础设施

检查项：

- tunnel 可复用
- `/v1/responses` 稳定
- `main` agent 可用

### Phase B: Raycast MVP

目标：

- 做出第一个可用桌面壳

任务：

1. 新建 `raycast-vibe-os` 私有扩展目录
2. 写 Preferences
3. 写 `问问 Vibe-OS`
4. 写 `倾倒到 Vibe-OS`
5. 写 `用 Vibe-OS 改写`
6. 通过本地 tunnel 调远程 OpenClaw

验收标准：

- 问答能成功
- dump 能成功
- rewrite 能成功
- 不需要手动改代码才能切 token/baseUrl

### Phase C: 结构化语义与交互打磨

目标：

- 把三类意图进一步收紧和打磨

任务：

1. 为不同命令继续细化 instructions contract
2. 优化问答与改写结果展示
3. 视需要引入更稳定的会话策略

### Phase D: 自动化与移动端回归

目标：

- 回到原计划第三阶段

任务：

1. Telegram 接入
2. digestion / mission log / knowledge automation
3. 后续如有需要，再考虑保留或淘汰 SuperCmd 路线

## 10. 对 SuperCmd 的新定位

从现在开始：

- `SuperCmd` 不再是主路线 blocker
- 它可以保留为实验分支
- 未来若要继续做，只在“已经有可用 Raycast 前端”的前提下再推进

也就是说：

- `Raycast` 先解决可用性
- `SuperCmd` 再解决理想化体验

## 11. 下一步建议

最顺的执行顺序：

1. 在仓库内新增一个 Raycast 私有扩展目录
2. 实现 `问问 Vibe-OS`
3. 实现 `倾倒到 Vibe-OS`
4. 实现 `用 Vibe-OS 改写`
5. 用本地 tunnel 做联调

## 12. 当前建议结论

新的优先级已经很明确：

1. **远程 OpenClaw 是稳定的大脑**
2. **Raycast 是新的桌面主入口**
3. **SuperCmd 暂停，不再阻塞主线**

这个调整不改变 Vibe-OS 的第一性原理，只是把“桌面壳”从一个难控的 Electron 项目，换成一个更适合快速落地的命令式前端。
