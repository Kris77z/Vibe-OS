# Vibe-OS 落地方案与技术蓝图 (Implementation Plan)

本文档是 Vibe-OS 的总蓝图与执行主索引。

作用分成两层：

1. 保留顶层架构与阶段目标
2. 记录实际开发链路，明确每一阶段已经落到哪份 runbook / 脚本 / 结论

当前主线已经从“抽象蓝图”进入“分阶段落地 + 文档拆分”的状态，因此这里不再只写理想方案，也同步维护真实进度。

基于“不重复造轮子”的第一性原理，当前核心架构口径是：**OpenClaw 提供 Agent 底座与记忆引擎 + Raycast 作为桌面主入口 + Telegram 继续后置 + QMD 已在部署机 live 跑通，下一阶段主线切到 OpenClaw 官方 memory 层落盘与 digestion 输出收敛**。

---

## 一、 整体架构拓扑 (Architecture Topology)

系统分为三个解耦的模块：

1.  **AI 大脑基座 (The Brain - OpenClaw)**
    *   **职责：** 接收来自两端的文字输入，处理自然语言，与 LLM (如 Kimi/Claude 等) 交互，读写本地文件，维护记忆索引。
    *   **运行方式：** 在 Mac 后台作为常驻守护进程运行。
    *   **记忆后端策略：** 当前生产链路先以 `builtin` 跑通写盘、Raycast、digestion 与调度闭环；下一阶段切入 `QMD`，但不是为了“先上向量库再说”，而是为了符合 [cali_twitter_analysis.md](/Users/jungle/Desktop/dev/vibe-os/docs/cali_twitter_analysis.md) 里“先蒸馏、再索引、再主动唤醒”的路线。
2.  **桌面端入口 (Mac Desktop - Vibe-OS UI)**
    *   **职责：** 提供“零阻力”的交互体验。全局唤起，敲击文字，回车发送并即刻隐藏。
    *   **通信方式：** 当前已切为 Raycast 私有扩展，通过本地 SSH tunnel 调远程 OpenClaw `/v1/responses`。
3.  **移动端入口 (Mobile - Telegram)**
    *   **职责：** 收割碎片时间（走路、洗澡、通勤）的想法。
    *   **通信方式：** 继续保留 OpenClaw 原生 Telegram Channel 路线，但当前不是主线 blocker。

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

*   **部署机（当前这台电脑）：** 负责长期运行 OpenClaw Gateway、QMD、launchd、真实索引、真实检索、真实验收。
*   **开发机（后续那台评估/开发机器）：** 负责方案评估、代码开发、检索质量调优、索引策略试验与非生产改动。

这意味着：

*   本机不再按“开发机模式”推进。
*   本机只承担部署、测试、真实运行与最终验收。
*   后续涉及召回调优、索引策略实验、search mode 对比，应优先转到开发机完成。

---

## 二、 实际开发链路记录 (Execution Ledger)

这一节用于防止总文档和拆分文档继续漂移。

### 2026-03-03 已完成阶段

#### A. Workspace 契约与远程 OpenClaw 基线

- 已明确当前仓库根目录就是 Workspace
- 已完成远程部署机 Gateway 基线与 tunnel 联调
- 已确认远程 `braindump.md` 真实写盘

对应文档：

- [vibe_os_remote_mac_deploy_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/vibe_os_remote_mac_deploy_runbook.md)
- [braindump_write_validation_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/braindump_write_validation_runbook.md)

#### B. Raycast 前端主入口

- 已正式放弃 `SuperCmd` 作为当前桌面主入口
- 已完成 `Ask / Dump / Rewrite` 三命令 MVP
- 已补中文错误提示、Ask session reset、Dump contract 收口

对应文档：

- [raycast_openclaw_replan.md](/Users/jungle/Desktop/dev/vibe-os/docs/raycast_openclaw_replan.md)
- [phase_c_and_digestion_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/phase_c_and_digestion_plan.md)

对应代码：

- [openclaw.ts](/Users/jungle/Desktop/dev/vibe-os/raycast-vibe-os/src/lib/openclaw.ts)
- [ask-vibe-os.tsx](/Users/jungle/Desktop/dev/vibe-os/raycast-vibe-os/src/ask-vibe-os.tsx)
- [dump-to-vibe-os.tsx](/Users/jungle/Desktop/dev/vibe-os/raycast-vibe-os/src/dump-to-vibe-os.tsx)
- [rewrite-with-vibe-os.tsx](/Users/jungle/Desktop/dev/vibe-os/raycast-vibe-os/src/rewrite-with-vibe-os.tsx)

#### C. Digestion MVP 闭环

- 已完成增量游标文件
- 已完成 `prepare / commit / render-prompt`
- 已完成远程单命令 runner
- 已完成 `launchd` 定时调度
- 已完成失败观察面、本机通知、外部告警入口

对应文档：

- [phase_c_and_digestion_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/phase_c_and_digestion_plan.md)
- [digestion_mvp_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/digestion_mvp_runbook.md)
- [remote_digestion_launchd_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/remote_digestion_launchd_runbook.md)

对应代码：

- [digestion_mvp.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/digestion_mvp.mjs)
- [run_remote_digestion.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/run_remote_digestion.mjs)
- [run_remote_digestion.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/run_remote_digestion.sh)
- [check_remote_digestion_status.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/check_remote_digestion_status.mjs)
- [install_remote_digestion_launch_agent.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/install_remote_digestion_launch_agent.sh)

### 当前主线结论

- Raycast 桌面入口已够用
- Digestion MVP 已完成，可收阶段
- QMD 已在部署机 live 跑通
- Telegram 仍后置
- 下一阶段主线切到 `OpenClaw 官方 memory 层`

### 2026-03-03 正在推进的阶段

#### D. QMD Enablement Live 基线

- 已收敛部署机 QMD 切换边界：先 preflight，再 smoke test，再切 backend
- 已明确第一版不使用 `includeDefaultMemory = true`
- 已补部署机依赖检查脚本、QMD 最小启动验证脚本、配置 overlay 示例
- 已在部署机完成 live 切换，当前 `memory.backend = qmd`
- 已补 live 验证结论，明确下一阶段主问题是中文召回与白名单扩展

对应文档：

- [qmd_enablement_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_enablement_plan.md)
- [qmd_minimal_enablement_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_minimal_enablement_runbook.md)
- [qmd_live_validation_findings_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_live_validation_findings_2026-03-03.md)
- [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)

对应代码 / 脚本：

- [check_qmd_prereqs.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/check_qmd_prereqs.sh)
- [qmd_smoke_test.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/qmd_smoke_test.sh)
- [openclaw.vibe-os.instance.qmd-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-overlay.example.json5)

当前判断：

- QMD enablement 基线已完成
- `query` 不适合当前默认交互路径
- 后续不再继续扩自定义 retrieval 架构，主线改为把 digestion 输出收敛到 OpenClaw 官方 memory 层

#### E. OpenClaw 官方 Memory 层收敛

- 已明确后续主线不再追求更重的 memory infrastructure
- 已明确 `braindump / MEMORY / daily memory / knowledge / mission_log` 的角色边界
- 下一步重点是写清 memory 写入规范，并让 digestion 稳定产出 `memory/YYYY-MM-DD.md`

对应文档：

- [openclaw_memory_layer_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw_memory_layer_plan.md)
- [openclaw/docs/concepts/memory.md](/Users/jungle/Desktop/dev/vibe-os/openclaw/docs/concepts/memory.md)

---

## 三、 分阶段实施战术 (Phased Execution Plan)

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
3.  **验证最小记忆写盘闭环：**
    *   当前阶段已由远程 API 与 Raycast 黑盒写盘验证替代。
    *   Telegram 暂不作为阶段一验收门槛。

### 阶段二：前端换脑与“机甲合体” (The Frontend: Raycast)
*目标：在保证大脑正常运转后，为其打造专属的 Mac 极简聚光灯交互外壳。*
4.  **跑通 Raycast 私有扩展原型：**
    *   在本地 `raycast-vibe-os/` 目录下安装 Node 依赖包并启动开发环境。
    *   体验全局唤起、命令检索和表单输入的交互流。
5.  **前端接脑：** 
    *   让 Raycast 扩展通过本地 SSH tunnel 调远程 OpenClaw `/v1/responses`。
    *   保留两类主命令：`倾倒` 与 `发问`。
    *   实现“一键倾倒后隐藏”的标志性 0 阻力体验。

### 阶段三：搭建“消化系统”与基础自动化 (The Automation MVP)
*目标：先让死数据变成结构化上下文。*
6.  **跑通 digestion MVP：**
    *   从 `braindump.md` 增量提炼 `mission_log.md` 与 `knowledge/`
    *   用 controller runner 而不是 agent 直写 cron job 保证幂等
    *   接本机 `launchd` 完成首版调度与失败观察

当前状态：

- 已完成

### 阶段四：激活 QMD 记忆增强 (The Retrieval Upgrade)
*目标：让系统从“能消化”升级到“能高质量召回与主动注入”。*
7.  **切入 QMD：**
    *   在部署机安装 `qmd` CLI 与依赖
    *   将 OpenClaw memory backend 从 `builtin` 切到 `qmd`
    *   谨慎定义索引范围，优先索引 `MEMORY.md`、`memory/knowledge/`、高密度 daily memory，而不是无脑全量喂原始 `braindump.md`
    *   验证 `memory_search` 的召回质量、启动时同步、增量更新与 fallback 行为

对应子计划：

- [qmd_enablement_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_enablement_plan.md)
- [qmd_minimal_enablement_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_minimal_enablement_runbook.md)
- [qmd_live_validation_findings_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_live_validation_findings_2026-03-03.md)
- [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)

当前状态：

- 阶段四 baseline 已完成
- 后续只保留官方配置面上的最小验证
- 主线不再继续扩 QMD retrieval tuning，而是切到官方 memory 层写盘策略

### 阶段五：移动端入口与长期运维 (Telegram / Ops)
*目标：补齐移动端入口与长期稳定性。*
8.  **Telegram 正式接入：**
    *   绑定正式 Bot Token
    *   验证消息进入同一大脑与同一记忆链路
9.  **运维增强：**
    *   配置真实外部告警投递
    *   补失败重试与长期观察面

## 四、 下一步行动建议 (Next Steps)

当前不需要再回到“整理 Workspace 契约”那一层了，那一阶段已经完成。

现在最合理的下一步是：

1.  保持当前部署机 `qmd + digestion` live 基线继续可用。
2.  按 [openclaw_memory_layer_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw_memory_layer_plan.md) 收敛 digestion 输出，稳定写入 `MEMORY.md`、`memory/YYYY-MM-DD.md` 与 `memory/knowledge/`。
3.  等 daily memory 真实产出后，再做一轮只基于官方 memory 层的最小 QMD 验证。
4.  Telegram 保持后置，不作为当前 blocker。

一句话：

**下一步不是继续做桌面端，也不是急着做 Telegram，而是把 digestion 输出稳定收敛到 OpenClaw 官方 memory 层。**
