# Phase C 与 Digestion MVP 推进方案

> 本文档接续 [raycast_openclaw_replan.md](./raycast_openclaw_replan.md) 在 2026-03-03 的实际状态。
> 目标不是继续空谈“优化”，而是把这一阶段的闭环状态收口清楚，并把后续增强项从 MVP 主线中拆出来。

---

## 0. 当前真实基线

先把现状说准确，避免后续文档继续漂移：

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| 远程 OpenClaw Gateway 部署 | 已完成 | LaunchAgent 常驻、Docker sandbox 可用 |
| SSH tunnel 通路 | 已完成 | 本机 `127.0.0.1:28789` 可转发到远程 `127.0.0.1:18789` |
| `/v1/responses` 联调 | 已完成 | curl 与 Raycast 都已验证成功 |
| Raycast MVP 三命令 | 已完成 | `Ask / Dump / Rewrite` 均可返回 |
| Workspace 契约文件 | 已完成 | `AGENTS.md`、`MEMORY.md`、`memory/` 已在仓库内 |
| Dump 成功后自动收口 | 已完成 | 当前实现已 `closeMainWindow()` + `showHUD()` |
| Ask 会话标识 | 已有基础版 | 当前使用固定 `sessionId = raycast-ask-vibe-os` |
| Ask 流式输出 | 未做 | 当前仍是 `stream: false`，但这不是当前 blocker |
| 远程 braindump 实际写盘 | 已验证 | 2026-03-03 已通过远程 API 与 Raycast 实测确认 |
| Digestion 自动化 | 已跑通可复用 MVP | 已完成首次真实写入、一次 no-op 复跑、一次单命令 runner 实写 |
| Telegram 接入 | 后置 | 不进入当前主线 |
| Raycast 响应延迟 | 有待优化 | 当前等待响应仍偏慢，但不阻塞主线 |
| Digestion 增量脚手架 | 已完成 | 已落地 `digestion_state.json`、prepare / commit / render-prompt / remote runner 脚本 |
| Digestion 定时调度 | 已完成首版 | 已改为本机 `launchd` 定时执行 controller runner |
| Digestion 失败观察面 | 已完成首版 | 已补状态文件、冷却、恢复态、本机通知、webhook / Telegram 外部告警入口 |

结论：

- Phase C 已完成
- Digestion MVP 已完成，可收阶段
- 当前剩余项不再属于 MVP 主线，而是运维增强与后续入口扩展

---

## 1. Phase C.0：先验证倾倒写盘链路

这一步已通过，但保留为后续回归 gate。

如果 Dump 只是返回一句“秒存”，但远程 `braindump.md` 没新增内容，那么：

- Raycast 只是一个会说话的壳
- 后续 digestion 无输入可吃
- Phase C 和 Phase D 都没有推进基础

### 1.1 验证目标

确认下面这条链路是真的，而不是“模型假装完成”：

```text
Raycast Dump
  -> /v1/responses
    -> OpenClaw agent main
      -> 真实追加写入远程 workspace/memory/braindump.md
```

### 1.2 推荐验证步骤

完整执行版见：

- [braindump_write_validation_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/braindump_write_validation_runbook.md)

1. 在 Raycast 执行 `倾倒到 Vibe-OS`
2. 输入一段唯一标识文本，例如：

```text
测试写盘：第一缕意识注入 2026-03-03 21:00
```

3. 确认 Raycast 返回极简确认句
4. SSH 到部署机，检查远程 workspace 的真实文件：

```bash
cat /Users/kris/instances/vibe-os/workspace/memory/braindump.md
```

5. 验证标准：
   - 文件确实新增一条记录
   - 文本内容可定位
   - 有时间戳
   - 没有把内容写到错误路径

### 1.3 注意

- 本地仓库里的 [braindump.md](/Users/jungle/Desktop/dev/vibe-os/memory/braindump.md) 没变化，不足以证明远程没写盘
- 真正要看的是部署机挂载的 workspace 文件
- 如果需要更强确定性，可同时跑一次远程 CLI 黑盒写盘测试，参考 [vibe_os_remote_mac_deploy_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/vibe_os_remote_mac_deploy_runbook.md#L215)

### 1.4 如果写盘失败，排查顺序

按这个顺序查，不要发散：

1. Agent 实际 workspace 路径是否和预期一致
2. `AGENTS.md` 是否被正确加载
3. Agent 是否具备文件写入能力
4. Docker sandbox 挂载路径是否正确
5. Dump instructions 是否过于模糊，导致只回了一句确认但没执行写盘

当前状态补充：

- 2026-03-03 已通过远程本地 API 写入验证
- 2026-03-03 已通过 Raycast 倾倒验证，远程 `braindump.md` 新增：

```text
[2026-03-03T00:00:00] 3月3号，我狠狠测一下你
```

附带观察：

- 当前 Raycast 倾倒链路已确认可用
- 当前等待响应仍偏慢，属于 Phase C 体验问题
- 时间戳格式仍不统一，后续值得继续观察

只有写盘 gate 通过，才进入后续阶段；这一条件现在已满足。

---

## 2. Phase C：Raycast 收口，但不阻塞主线

写盘通过后，Raycast 端只做“收口”，不再扩需求面。

### 2.1 这一阶段的目标

目标不是把 Raycast 打磨成产品终态，而是把现有 MVP 收成稳定基线：

- 三类命令语义更稳
- 错误提示更可读
- Ask 的会话策略更清晰
- 不再出现文档与实现状态不一致

### 2.2 必做项

#### A. 固化三类命令的 instruction contract

当前问题不是“有没有 instructions”，而是 contract 还不够收紧。

建议方向：

- `Dump`
  - 明确要求追加写入 `memory/braindump.md`
  - 明确要求追加而不是改写
  - 明确要求回复中文、15 字内、禁止追问
- `Ask`
  - 保持默认自然问答
  - 对“帮我想想 / 我之前是不是说过 / 调出上次讨论”这类检索意图，要求优先检索 `MEMORY.md` 与 `memory/`
  - 不强制所有问答都先全盘检索，避免徒增延迟
- `Rewrite`
  - 保持“只输出结果文本”
  - 不引入解释性尾巴

#### B. 统一中文错误提示

当前 Raycast 命令还能直接把原始英文错误暴露给用户。

目标：

- 网络失败
- Token 缺失
- Gateway 401/403
- 超时
- 空响应

这些都映射成短中文提示，便于快速判断是 tunnel、token 还是服务端问题。

#### C. 收紧 Ask 会话策略

当前并不是“没有 sessionId”，而是“固定使用一个全局 sessionId”。

这需要明确策略：

- 如果目标是连续对话：保留固定 `sessionId`
- 如果目标是避免历史串味：提供“新开一轮”的清空入口，或改为显式 session reset

第一版建议：

- 保留固定 `sessionId`
- 只额外补一个“重置 Ask 会话”的轻量操作

当前状态：

- 已在 Raycast Ask 命令中落地 session reset 入口

### 2.3 可做但不阻塞项

这些项有价值，但都不应阻塞 digestion：

- Ask 改流式输出
- 按模式区分超时
- 更精细的结果展示
- Rewrite 回写当前编辑器

其中 Ask 流式输出尤其要明确：

- 它是体验优化
- 不是当前阶段的验收门槛

### 2.4 Phase C 验收标准

- [x] Dump 命令真实追加远程 `braindump.md`
- [x] 三类命令的 instruction contract 收紧并文档化
- [x] 主要错误场景有中文提示
- [x] Ask 会话策略明确，不再是“先这样凑合”

---

## 3. Digestion MVP：真正该推进的主线

这部分才是从“能倾倒”走向“能消化”的核心增量。

原则只有四条：

1. `braindump.md` 继续 append-only
2. digestion 只处理新增内容
3. 输出必须可重复执行，避免重复提炼
4. 第一版只做 `mission_log + knowledge`，不扩成复杂知识系统

当前结论：

- 这一部分已经达到 MVP 完成标准
- 后续不再把“是否跑通 digestion”当成待验证问题
- 后续只处理增强项，例如告警投递配置、重试策略、Telegram 接入

### 3.1 先别把 QMD 当 blocker

当前远程实例使用 `memory.backend = builtin`，这不是异常状态，而是当前主线方案的一部分。

因此：

- digestion MVP 不以切回 QMD 为前提
- 先验证 builtin 下的检索与文件读写是否够用
- QMD 放到后续增强阶段单独评估

换句话说：

- 现在的问题不是“要不要立刻回 QMD”
- 现在的问题是“现有 builtin 能不能支撑第一版 digestion”

### 3.2 第一版 digestion 的最小边界

第一版只做三件事：

1. 从 `memory/braindump.md` 读取上次处理之后的新增内容
2. 把其中的 TODO / 跟进项追加到 `memory/mission_log.md`
3. 把有长期价值的内容追加到 `memory/knowledge/*.md`

第一版明确不做：

- `MEMORY.md` 自动改写
- 每周复盘系统
- 复杂评分和知识图谱
- Telegram 驱动的多入口调度

### 3.3 必须引入增量游标

如果没有游标，Agent 只能靠“今天新增内容”这种模糊描述工作，结果必然不幂等。

建议新增一个轻量状态文件，例如：

```text
memory/digestion_state.json
```

当前状态：

- 已新增 [digestion_state.json](/Users/jungle/Desktop/dev/vibe-os/memory/digestion_state.json)
- 已新增 [digestion_mvp.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/digestion_mvp.mjs)
- 已新增 [digestion_mvp_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/digestion_mvp_runbook.md)

最小字段建议：

```json
{
  "lastProcessedLine": 0,
  "lastProcessedAt": null
}
```

运行逻辑：

1. 读取 `braindump.md`
2. 从 `lastProcessedLine` 之后截取新增块
3. 仅对新增块执行提炼
4. 写入 `mission_log.md` / `knowledge/*.md`
5. 成功后更新 `digestion_state.json`

这样才能做到：

- 可重复执行
- 失败后可重试
- 不会每次把同一批 braindump 再消化一遍

### 3.4 输入输出 contract 不要再走纯自然语言散打

自动化任务不要只给 Agent 一句“请整理今天新增内容”。

应该尽量向 [project_scoped_openclaw_spec.md](/Users/jungle/Desktop/dev/vibe-os/docs/project_scoped_openclaw_spec.md#L178) 靠拢，至少具备：

- 明确 objective
- 明确可读文件
- 明确可写范围
- 明确期望输出格式

第一版可采用这种结构：

```json
{
  "kind": "task_run",
  "objective": "整理新增 braindump 并更新 mission_log 与 knowledge",
  "context": {
    "files": [
      "memory/braindump.md",
      "memory/mission_log.md",
      "memory/digestion_state.json"
    ],
    "startLine": 123,
    "endLine": 168
  },
  "constraints": {
    "writeScope": [
      "memory/mission_log.md",
      "memory/knowledge/",
      "memory/digestion_state.json"
    ]
  },
  "expectedOutput": {
    "format": "json"
  }
}
```

这样做的好处是：

- 输入范围更可控
- 输出更容易校验
- 后续切到 cron 也更稳

### 3.5 任务触发方式

按优先级建议：

1. 先手动触发 digestion，跑通一轮真实写入
2. 验证 OpenClaw 内建 cron 是否能稳定承担该任务
3. 如果 agent 直写不稳，改用控制器侧系统调度执行 remote runner
4. Telegram 继续后置

当前状态：

- 2026-03-03 已在部署机手动跑通一次真实 digestion
- 远程 `mission_log.md` 已新增首条待办
- 远程 `memory/knowledge/openclaw_deploy.md` 已创建
- 远程 `memory/digestion_state.json` 已更新到 `lastProcessedLine = 1`
- 同轮已完成一次无新增复跑，返回 `noop` 且目标文件哈希不变
- 2026-03-03 已通过 `run_remote_digestion.mjs` 跑通第二轮真实 digestion
- 第二轮已验证控制器侧推进 `digestion_state.json`
- 2026-03-03 已验证 OpenClaw 内建 cron 的 scheduler 能力存在
- 同日验证发现：直接把 digestion 交给 isolated agent cron job，会导致 `mission_log.md` 追加纪律不稳定
- 因此当前正式方案改为：用系统级 `launchd` 定时执行 `run_remote_digestion.mjs`
- 2026-03-03 已完成本机 LaunchAgent 安装，label 为 `ai.vibe-os.remote-digestion`
- 已完成一次 `launchctl kickstart -k` 验证，stdout 返回 `noop`，stderr 为空，最近退出码为 `0`
- 已补 controller 侧运行状态文件与 `check_remote_digestion_status.mjs`
- 已补并发锁，避免 launchd 重叠执行 remote digestion
- `digestion_mvp.mjs` 已支持多行 braindump 块切片
- controller wrapper 已补失败告警与 cooldown 抑制
- controller wrapper 已支持 webhook / Telegram 外部告警

### 3.6 Digestion MVP 验收标准

- [x] 能只处理新增 braindump，而不是全量重扫
- [x] `mission_log.md` 首次出现真实提炼内容
- [x] `memory/knowledge/` 首次出现真实沉淀内容
- [x] 重复执行不会重复写入相同结果
- [x] 失败不会改写原始 `braindump.md`，错误会进入 controller 状态与告警链路

结论：

- Digestion MVP 已完成，可收阶段
- 当前 `mission_log / knowledge / digestion_state / launchd / alerting` 已形成闭环
- 后续不再继续在本文档里追加 MVP 范围内的“待实现项”

---

## 4. 后续增强顺序

MVP 收口后，后续按增强优先级推进：

### Step 1

配置真实外部告警投递：

- webhook
- Telegram Bot

### Step 2

补失败重试与更细粒度的运维观测。

### Step 3

评估 Telegram 作为用户入口，而不是只作为告警出口。

### Step 4

Raycast 体验优化，例如流式输出与响应延迟收口。

---

## 5. 当前建议结论

这一阶段可以正式收口。

当前已经完成：

- 远程 braindump 写盘
- Raycast 最小收口
- Digestion MVP 闭环
- controller 调度与观察面
- 本机通知与外部告警入口

Vibe-OS 当前已经从“能聊”进入“能积累、能消化”的状态。
