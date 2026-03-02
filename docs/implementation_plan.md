# Vibe-OS 落地方案与技术蓝图 (Implementation Plan)

本文档是将 Vibe-OS（个人大脑智能体）从概念转化为实际工程代码的详细执行路线图。
基于“不重复造轮子”的第一性原理，我们的核心架构已确立为：**OpenClaw 提供 Agent 底座与记忆引擎 + 专属 Mac 极简输入壳 + Telegram 移动端直连**。

---

## 一、 整体架构拓扑 (Architecture Topology)

系统分为三个解耦的模块：

1.  **AI 大脑基座 (The Brain - OpenClaw)**
    *   **职责：** 接收来自两端的文字输入，处理自然语言，与 LLM (如 Kimi/Claude 等) 交互，读写本地文件，维护记忆索引。
    *   **运行方式：** 在 Mac 后台作为常驻守护进程运行。
    *   **记忆后端 (QMD vs ELF)：** 坚定选择开启 `QMD` (Experimental QMD Backend) 而非类似 `ELF` 的实体知识图谱。因为 Vibe-OS 的核心诉求是记录“带有情绪和推演过程”的瞬时灵感，而不是冰冷硬核的事实提取。QMD 内建的后台定时任务实现每 5 分钟的文本嵌入（Embedding）与全文索引（BM25），能最大程度地**无损保留输入时的心境（Vibe）**，并在检索时原汁原味地喂给 Agent。
2.  **桌面端入口 (Mac Desktop - Vibe-OS UI)**
    *   **职责：** 提供“零阻力”的交互体验。全局热键唤醒，敲击文字，回车发送并即刻隐藏。
    *   **通信方式：** 将收集到的文本，通过 OpenClaw 提供的 HTTP API（如果可用）或者直接写入本地指定的中继文件/接口，发送给 Agent。
3.  **移动端入口 (Mobile - Telegram)**
    *   **职责：** 收割碎片时间（走路、洗澡、通勤）的想法。
    *   **通信方式：** 直接利用 OpenClaw 原生内置的 Telegram Channel 接入功能。数据无缝直达同一大脑。

### Workspace 与代码库的边界说明

这里要明确一个很容易混淆的概念：**`openclaw/` 源码目录不等于 Agent Workspace**。

*   **`openclaw/` 代码库：** 用来运行 Gateway、管理 Channel、提供 Agent Runtime。本质上它是 Vibe-OS 依赖的底层引擎源码。
*   **Agent Workspace：** 是被 OpenClaw 挂载并长期读写的“个人大脑目录”，其中包含 `AGENTS.md`、`MEMORY.md`、`memory/` 等真正的提示词和记忆文件。

在当前仓库结构下，**最省事的短期方案** 是：直接把 Vibe-OS 仓库根目录本身作为 Workspace，并让 `openclaw/` 这份本地源码只负责运行引擎。也就是说：

*   `openclaw/` 负责“跑系统”；
*   `/Users/jungle/Desktop/dev/vibe-os` 负责“存人格、记忆、braindump 与后续知识沉淀”。

这样可以避免重复拷贝一份内容，同时不影响后续将 Workspace 独立迁移到 `~/.openclaw/workspace` 或其他私有目录。

### 开发机模式 vs 部署机模式

当前项目采用两台机器分工的思路：

*   **开发机（当前这台电脑）：** 只负责修改 Workspace、编写文档、维护 Raycast 前端壳、做最小本地 smoke test。
*   **部署机（后续那台常驻 Mac）：** 负责长期运行 OpenClaw Gateway、挂 Telegram、维护 QMD 索引和所有 24/7 服务能力。

这意味着：

*   当前阶段不要求开发机长期运行 OpenClaw。
*   开发机上的本地启动仅用于验证配置和接口联通性，而不是正式部署。
*   真正的 Bot Token、常驻任务、后台守护和记忆索引，应优先在部署机上完成。

---

## 二、 分阶段实施战术 (Phased Execution Plan)

为了确保系统稳定可控，我们的落地将严格遵循**“先造大脑（后端），再接感官（前端），最后练消化系统（自动化）”**的第一性原理，分为三大阶段：

### 阶段一：激活“裸跑”的大脑 (The Backend: OpenClaw)
*目标：不碰任何前端 UI，纯侧重后端逻辑流转与配置，验证 Agent 能否被我们的 `MEMORY.md` 约束。*
1.  **挂载灵魂配置与引擎启动：** 
    *   在机器上跑通 OpenClaw 底座。
    *   将 OpenClaw 的 `workspace` 明确指向当前 Vibe-OS 仓库根目录，避免额外复制一套独立 Workspace。
    *   按 OpenClaw 的标准工作区约定整理根目录文件：确保 `AGENTS.md` 位于 Workspace 根目录；`MEMORY.md` 作为长期记忆主文件可被稳定注入；`memory/` 下保留 `braindump.md`、`mission_log.md`、`knowledge/` 等运行期落盘目录。
    *   将我们已编写好的 Vibe-OS 行为规则正式挂载给 Agent，确保系统加载了“倾倒模式”法则与长期心智上下文。
2.  **黑盒通信测试 (CLI / API)：** 
    *   通过终端或简单的 API 触发模拟输入。
    *   验证核心标准：确认 Agent 没有用冗长废话回复，并且精准地将输入内容和时间戳追加写入了 `memory/braindump.md`。
    *   在开发机模式下，这一步只要求完成一次最小 smoke test，不要求在本机长期保持 Gateway 常驻。
3.  **打通移动端输入 (Telegram 闭环)：** 
    *   将 OpenClaw 与申请好的 Telegram Bot Token 绑定。
    *   验证核心标准：手机发消息 -> Mac 本地 `braindump.md` 瞬间增加记录，实现外脑雏形的可用状态。
    *   推荐在后续部署机上完成，而不是在当前开发机上先绑正式 Telegram 入口。

### 阶段二：前端换脑与“机甲合体” (The Frontend: Raycast)
*目标：在保证大脑正常运转后，为其打造专属的 Mac 极简聚光灯交互外壳。*
4.  **跑通 Raycast 私有扩展原型：**
    *   在本地 `raycast-vibe-os/` 目录下安装 Node 依赖包并启动开发环境。
    *   体验全局唤起、命令检索和表单输入的交互流。
5.  **前端接脑：** 
    *   让 Raycast 扩展通过本地 SSH tunnel 调远程 OpenClaw `/v1/responses`。
    *   保留两类主命令：`倾倒` 与 `发问`。
    *   实现“一键倾倒后隐藏”的标志性 0 阻力体验。

### 阶段三：搭建“消化系统”与记忆索引 (The Automation)
*目标：让死数据变成活的上下文指引。*
6.  **激活 QMD 与消化池：**
    *   确认 OpenClaw 后台的 QMD 引擎正常工作（每 5 分钟的 Markdown 索引）。
    *   编写或配置定时脚本（Cron），每日按时抽取 `braindump.md` 的增量部分，推演提取为 `mission_log.md` (待办) 以及 `knowledge/` (沉淀领域)，彻底代替手动 GTD。

## 三、 第一步行动建议 (Next Steps)
在确认了这份蓝图后，我们应当从 **Phase 1: 基建与灵魂注入** 开始。
由于你本地已经拷贝了 `openclaw/` 源码，**当前不需要再额外复制一套新的工作区内容**。更合理的起步方式是：

1.  直接将当前 Vibe-OS 仓库根目录作为 OpenClaw 的 Workspace。
2.  将现有的提示词/记忆文件整理到符合 OpenClaw 约定的位置（尤其是根目录 `AGENTS.md` 与 `MEMORY.md`）。
3.  让 `openclaw/` 这份源码只承担“开发期引擎运行器”的角色，先完成一次 CLI 黑盒写盘验证。
4.  正式的 Telegram 接入、常驻运行、QMD 后台索引与守护进程部署，统一放到后续部署机执行。

换句话说，**下一步不是继续写蓝图，而是开始整理 Workspace 契约并跑通 Phase 1 的最小闭环。**
