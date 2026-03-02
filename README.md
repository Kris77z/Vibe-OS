# Vibe-OS: 个人外脑智能体 (Personal Brain Agent)

## 🎯 项目愿景
Vibe-OS 是一个基于“第一性原理”和“外脑记忆模型”打造的个人智能知识库。它彻底摒弃了传统笔记软件高摩擦力的分类、命名过程，旨在实现**“无感倾倒（Zero-Friction Brain Dump）”**与**“无声消化（Automated Digestion）”**，让你专注于思考，把记忆和整理工作交给 AI。

---

## 🏗️ 核心架构规划 (Architecture)

### 1. 核心大脑与基座 (The Agent Backend)
*   **不重复造轮子：** Vibe-OS 的底层 AI 调度和通讯网关直接构建在开源的 **OpenClaw** 框架之上。
*   **移动端 (Mobile) 零成本接入：** 直接利用 OpenClaw 原生支持的 Telegram/WhatsApp 等消息通道。你的手机端不需要安装任何特殊的 App，只需要通过 Telegram 跟部署在本地的 OpenClaw Agent 说话即可。
*   **数据落点：** 我们在 OpenClaw 内配置特殊的系统指令（System Prompt），要求 Agent 必须将所有用户的日常碎片输入追加写入到 `memory/braindump.md` 之中。

### 2. 专属桌面端入口 (Mac Desktop Frontend UI)
虽然 OpenClaw 极其强大，但为了实现 Mac 上“零阻尼”的体验，我们仍然需要一个为 Vibe-OS 专属定做的前端外壳。
*   **表现形式：** Mac 全局快捷键唤起一个极简输入悬浮窗（当前主线为 Raycast 私有扩展）。
*   **行为逻辑：** 这是一个纯净的“倾卸口”和“发问口”。你敲完一行字，前端把内容静默传给远程 OpenClaw，由它决定是追加写入 `braindump.md`，还是进入问答 / 检索模式。
*   **落地技术：** 当前主线为 `raycast-vibe-os/`，通过本地 SSH tunnel 调远程 OpenClaw `/v1/responses`。

### 3. 消化层 (Digestion System) — “后厨与梦境整理”
后台依托 OpenClaw 调度自动运行的 AI 逻辑，代替繁琐的手动 GTD（Getting Things Done）。
*   **日切片整理 (Daily Context Sync)：**
    *   每天固定时间（如凌晨），AI 自动读取昨天的 `braindump.md`。
    *   提取行动项（TODOs），更新到 `mission_log.md`。
    *   提取思考与见解，沉淀为当天的结构化日记（如 `daily/YYYY-MM-DD.md`）。
    *   清空或归档原有 braindump 内容。
*   **周复合演化 (Weekly Compound)：**
    *   周末 AI 自动回顾一周的 Daily Logs。
    *   将同类项、长线项目的思考进行合并，更新到全局的知识库节点中。

### 4. 记忆与检索层 (Memory & Output Layer) — “懂你的外脑”
*   **`MEMORY.md` 核心状态墙：** 系统的“最高宪法”，存放你当前的重点关注项目、投资原则、核心个人状态。每次唤起 AI 问答时，这个文件会作为前置 Context（系统提示词）强制注入，保证大方向不偏。
*   **向量化语境唤醒：** 当你开启长对话时，AI 可以通过语义搜索你过往的沉淀，主动给你补充被遗忘的上下文点子。

---

## 📂 目录结构预演 (目录树构想)
```text
vibe-os/
├── README.md                # 本文档：系统使用说明与架构规划
├── AGENTS.md                # Workspace 根协议：Agent 行为边界与倾倒模式规则
├── MEMORY.md                # Workspace 根长期记忆：高优事项与长期准则
├── openclaw/                # (第三方依赖) OpenClaw 引擎源码目录
├── raycast-vibe-os/         # 当前桌面前端：Raycast 私有扩展
├── docs/                    # 落地方案、分析和本地配置样例
├── memory/                  # (核心) 交由 OpenClaw 管理和读取的记忆文件夹
│   ├── braindump.md         # 最核心的无序倾倒容器（收件箱 / Context）
│   ├── mission_log.md       # AI 整理的结构化任务清单
│   ├── knowledge/           # (启发自 memU) 被 AI 消化提纯后的领域知识卡片
│   │   ├── technical.md     # 例如：关于开发框架的积淀
│   │   └── investment.md    # 例如：关于加密货币或特定标的的长期推演
├── scripts/                 # 兼容性文档或后续自动化脚本
```

---

## 🛠️ 下一步开发路径与讨论板
> **当前状态：** 远程 OpenClaw + Raycast 前端已打通，后台自动整理与长期记忆链路待补。

1. **基座拉取：** 部署并跑通 OpenClaw 本地环境。
2. **打通移动端：** 将 OpenClaw 与你的 Telegram 对接，测试最初的对话能力。
3. **注入灵魂：** 编写 `MEMORY.md` 和 `AGENTS.md`，配置自动整理链路，让 OpenClaw 学会如何写入 `braindump.md` 以及如何每日整理。
4. **后台自动化：** 补齐 `braindump -> mission_log -> knowledge` 的消化链路，再考虑 Telegram 正式接入。

（本档案将被持续更新，作为 Vibe-OS 迭代的唯一真相来源）
