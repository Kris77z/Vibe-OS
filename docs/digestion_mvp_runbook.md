# Digestion MVP Runbook

> 目标：先跑通本地增量切片与状态游标，再把同一份 payload 喂给 OpenClaw 做真正的 `daily memory / mission_log / knowledge` 提炼。
> 日期：2026-03-03

---

## 0. 当前范围

这一版先解决三件事：

1. 如何只读取 `braindump.md` 的新增条目
2. 如何在成功后推进 `digestion_state.json`
3. 如何让 digestion 默认产出 `memory/YYYY-MM-DD.md`

这一版还不直接自动改写：

- `MEMORY.md`
- 每周复盘
- Telegram 调度

当前状态：

- 2026-03-03 已在部署机真实跑通第一轮 digestion
- 当前脚本口径已切到 `daily memory` 默认出口
- 已确认可写入 `mission_log.md`、`memory/knowledge/*.md`、`digestion_state.json`
- 2026-03-03 已在 live instance 真实产出 `memory/2026-03-03.md`
- 已确认无新增条目时会返回 `noop`，且不重复写文件
- 已开始把远程执行收敛为单条本地命令，而不是临时 SSH 拼接
- 2026-03-03 已验证 `run_remote_digestion.mjs` 的 no-op 与真实写入两种路径
- 2026-03-03 已验证 OpenClaw 内建 cron 可运行，但 agent 直写 `mission_log.md` 不够安全，当前已禁用该 job
- 2026-03-03 已补控制器侧 launchd 安装脚本，后续正式定时以 controller runner 为准
- 2026-03-03 已完成本机 LaunchAgent 安装与一次 `kickstart` 验证，最近一轮 stdout 为 `noop`，stderr 为空
- 2026-03-03 已补控制器侧运行状态文件与 `check_remote_digestion_status.mjs`
- 2026-03-03 已补 controller wrapper 失败告警与 cooldown 抑制
- 2026-03-03 已补 controller env 配置入口，支持 webhook / Telegram 外部告警
- controller 当前会对 agent 返回的 `task_result_v1` 做本地结构校验，并在输出中附带 `contractValidation`
- 2026-03-04 已确认仓库包含统一写入器 `scripts/append_braindump_entry.mjs`（commit `61027b5`）
- 2026-03-04 已完成统一写入器本地 smoke + 20 轮 dump append 压测，验收结果 `PASS`
- 2026-03-04 已完成 Raycast dump 配置检查：dump 命令已切换到统一写入器路径

---

## 1. 状态文件

状态文件固定为：

- [digestion_state.json](/Users/jungle/Desktop/dev/vibe-os/memory/digestion_state.json)

当前字段：

```json
{
  "lastProcessedLine": 0,
  "lastProcessedAt": null
}
```

含义：

- `lastProcessedLine`：上一次已经确认处理完成的 `braindump.md` 行号
- `lastProcessedAt`：上一次确认推进游标的时间

---

## 2. 脚手架命令

脚本位置：

- [digestion_mvp.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/digestion_mvp.mjs)
- [run_remote_digestion.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/run_remote_digestion.mjs)

### 2.1 生成增量 payload

```bash
node scripts/digestion_mvp.mjs prepare
```

如果有新增条目，会输出结构化 JSON，包括：

- `startLine`
- `endLine`
- `excerpt`
- `writeScope`

如果没有新增条目，会输出：

```json
{
  "status": "noop"
}
```

### 2.2 成功后推进游标

当且仅当这次 digestion 已经成功写入 `daily memory` / `mission_log` / `knowledge` 后，再执行：

```bash
node scripts/digestion_mvp.mjs commit --end-line <prepare 输出里的 endLine>
```

这一步会更新：

- [digestion_state.json](/Users/jungle/Desktop/dev/vibe-os/memory/digestion_state.json)

### 2.3 一条命令跑远程 digestion

```bash
node scripts/run_remote_digestion.mjs run
```

默认目标：

- SSH target: `kris@annkimac.tail7f9f42.ts.net`
- SSH key: `~/.ssh/id_ed25519_vibe_os_deploy`
- instance root: `/Users/kris/instances/vibe-os`

这个命令会：

1. 拉取远程 `braindump.md` / `mission_log.md` / `digestion_state.json`
2. 本地生成增量 payload
3. 本地生成 digestion prompt
4. 远程调用本机 gateway `127.0.0.1:18789`
5. 控制器侧校验 agent 返回是否符合 `task_result_v1`
6. 成功后由控制器侧写回 `digestion_state.json`

当前状态：

- 已验证无新增条目时返回 `noop`
- 下一步主线是验证新增条目可真实写入 `memory/YYYY-MM-DD.md`
- 已验证 `digestion_state.json` 可由控制器侧推进，而不是继续依赖 agent 写时间戳
- 当前即使返回 contract 仍有偏差，控制器也会把校验错误显式带出，方便继续收口 schema

如果当前机器本身就是部署机，且没有可用的 Tailscale SSH key，可用本地等价链路做验证：

1. 在 live workspace 跑 `prepare` / `render-prompt`
2. 直接调用本机 gateway `127.0.0.1:18789 /v1/responses`
3. 用 `run_remote_digestion.mjs` 同口径校验逻辑检查 `task_result_v1`
4. 手动 `commit --end-line <endLine>` 推进游标

### 2.4 包装成本地稳定入口

```bash
scripts/run_remote_digestion.sh
```

作用：

- 固定回到仓库根目录执行
- 自动探测 Homebrew / 系统 `node`
- 作为 `launchd` 的稳定 `ProgramArguments` 入口

### 2.5 安装控制器侧 launchd

```bash
scripts/install_remote_digestion_launch_agent.sh
```

默认行为：

- 安装 LaunchAgent label：`ai.vibe-os.remote-digestion`
- `RunAtLoad = true`
- `StartInterval = 1800`，即每 30 分钟执行一次
- 会把 runner 复制到 `~/.vibe-os-controller/bin/`
- stdout / stderr 日志写到 `~/.vibe-os-controller/logs/`

这样做是为了绕开 macOS 对 `Desktop/` 目录的 `launchd` 访问限制；仓库即使位于 `~/Desktop/...`，调度器本身也不再直接执行该目录下的脚本

如果要改频率，可在安装前设置：

```bash
DIGESTION_START_INTERVAL_SECONDS=900 scripts/install_remote_digestion_launch_agent.sh
```

卸载命令：

```bash
scripts/uninstall_remote_digestion_launch_agent.sh
```

### 2.6 检查最近运行状态

```bash
node scripts/check_remote_digestion_status.mjs
```

这个命令会汇总：

- 最近一轮运行
- 最近一次成功
- 最近一次失败
- 最近一次告警
- 最近几轮 history
- 如果调度重叠，会看到 `skipped_locked`

---

## 3. 推荐执行顺序

### Step 1

先准备增量输入：

```bash
node scripts/digestion_mvp.mjs prepare
```

### Step 2

把输出的 JSON payload 作为自动任务输入，交给 OpenClaw 执行 digestion。

### Step 3

确认 `memory/YYYY-MM-DD.md` / `mission_log.md` / `memory/knowledge/` 已成功更新。

### Step 4

再推进游标：

```bash
node scripts/digestion_mvp.mjs commit --end-line <endLine>
```

---

## 4. 2026-03-03 实跑结果

部署机真实结果：

- 新增待办写入远程 `memory/mission_log.md`
- 新增知识文件 `memory/knowledge/openclaw_deploy.md`
- 更新远程 `memory/digestion_state.json`

本轮实跑提炼出的结果：

- TODO：明天把 digestion MVP 接到 OpenClaw cron
- 长期知识：
  - 部署机 workspace 路径是 `/Users/kris/instances/vibe-os/workspace`
  - gateway 本地端口是 `18789`

随后又做了一次“无新增条目”复跑验证：

- OpenClaw 返回 `{"status":"noop", ...}`
- `mission_log.md` 哈希未变化
- `memory/knowledge/openclaw_deploy.md` 哈希未变化
- `digestion_state.json` 哈希未变化

这意味着当前 MVP 已经具备：

- 首次真实写入能力
- 基于游标的无新增 no-op 能力
- 避免重复写入同一批内容的基本能力

### 2026-03-03 第二轮：单命令 remote runner 实跑结果

执行命令：

```bash
node scripts/run_remote_digestion.mjs run
```

结果：

- 成功处理 `braindump.md` 第 2 行新增内容
- 远程 `mission_log.md` 追加了第二条 TODO
- 新增远程知识文件 `memory/knowledge/vibe_os_digestion.md`
- 远程 `digestion_state.json` 更新为：

```json
{
  "lastProcessedLine": 2,
  "lastProcessedAt": "2026-03-03T02:23:00.273Z"
}
```

本轮说明：

- 这次 `lastProcessedAt` 由控制器侧写入
- 证明远程 digestion 已不再依赖临时手工 SSH 拼 prompt
- 证明“本地控制器编排 + 部署机本地 gateway 执行”这条路径可复用

### 2026-03-03 第三轮：OpenClaw 内建 cron 验证结果

验证结果：

- 已确认部署机 `openclaw cron status` / `list` / `run` 可用
- 已成功创建并触发一条 isolated session cron job
- job 运行记录已写入部署机 `state/cron/runs/*.jsonl`

但这轮也暴露了关键问题：

- agent 直写 `memory/mission_log.md` 时没有稳定保持 append discipline
- 实际结果出现了 `mission_log.md` 内容被压缩到仅剩新条目的风险

结论：

- OpenClaw 内建 cron 证明了 scheduler 能力是存在的
- 但当前 digestion 不应直接交给 cron job 的 agent turn 负责文件改写
- 当前正式路径改为“控制器侧 runner + 系统级 launchd 定时”

### 2026-03-03 第四轮：daily memory 真实落盘验证

live instance 真实结果：

- 已新增 `memory/2026-03-03.md`
- `mission_log.md` 保持任务视角，没有被改写成背景说明
- `MEMORY.md` 保持不动
- `digestion_state.json` 已推进到新行号，复跑 `prepare` 会返回 `noop`

这轮同时暴露了三件事：

- 历史 `braindump.md` 有一条记录末尾缺少换行，导致首个 validation entry 被黏进旧行
- agent 返回的 JSON 还没完全贴合 `task_result_v1`，只是“接近”
- knowledge 文件命名还需要约束，否则容易为同主题同时产出 `vibe_os_xxx.md` 和 `vibe-os-xxx.md`

处理结果：

- live 现场已清理掉本轮 `.digestion_validation_*` 临时文件
- 重复 knowledge 文件已合并回 `memory/knowledge/vibe_os_digestion.md`
- 仓库内 prompt 已补 strict JSON contract 与 snake_case 命名约束

遗留说明：

- live `memory/2026-03-03.md` 与 `memory/braindump.md` 中保留了本轮 validation 内容；这是运行期真实痕迹，不在本轮代码收口中回滚
- `task_result_v1` 的 prompt 约束已收紧，但还需要后续再做一轮 machine-strict 验证

### 2026-03-04 第五轮：部署机本地复测（contract + append）

背景：

- 这台机是部署机本体；`run_remote_digestion.mjs` 默认 SSH key 仍缺失
- 因此本轮使用部署机本地等价验证链路，而不是 remote SSH 路径

结果：

- 新增 `2026-03-04 09:52:00` 条目时，braindump 没有再黏连到上一条
- 但再追加 `2026-03-04 09:53:30` 时，曾出现 `braindump.md` 被覆盖为单条的风险
- 已恢复已知条目并保留备份：`memory/braindump.md.bak.2026-03-04-verify`
- 本轮 digestion 返回通过同口径 `task_result_v1` 校验：
  - `valid: true`
  - `errors: []`
- 游标已推进到 `lastProcessedLine = 5`，复跑 `prepare` 为 `noop`

结论：

- contract 收口出现正向进展（至少本轮 machine-valid）
- 但 braindump 写入稳定性问题优先级更高，应先确保绝对 append-only 行为

### 2026-03-04 第六轮：统一写入器本地冒烟与 dump append 压测

执行范围：

- 确认最新代码包含 `61027b5`
- 统一写入器本地冒烟（末尾无换行场景）
- 连续 20 轮 append 压测（`wc -c` 每轮对账）
- Raycast dump 配置只读检查（不做 UI 操作）

结果：

- 冒烟通过：`beforeBytes 43 -> afterBytes 107`
- 压测通过：20/20 轮 `delta > 0`，且每轮 `wc -c == afterBytes`
- 压测首尾 tail 均显示条目按行追加，未出现新黏连
- Raycast dump 已切到统一写入器（`dump-to-vibe-os.tsx -> braindump-writer.ts -> append_braindump_entry.mjs`）

结论：

- 统一写入器本地稳定性满足当前验收标准

---

## 5. 当前限制

- 当前默认把“以 `[` 开头并带日期”的行视为 braindump 条目
- 当前已支持“时间戳首行 + 后续连续文本”的多行 braindump 块
- `prepare` 会返回每条新增记录的 `startLine / endLine / lineCount`
- `commit` 继续以最后一条记录的块尾 `endLine` 推进游标
- 当前第一次实跑仍由 agent 写入了 `digestion_state.json`
- 后续以控制器侧推进 `digestion_state.json` 为准，避免继续依赖 agent 写时间戳
- 如果历史 braindump 记录没有以换行结束，新的条目可能会被拼进旧记录，导致增量检测失真
- 当前 agent 侧虽然已能真实写 daily memory，但结构化返回 contract 仍需继续收口
- dump 写盘历史上出现过“覆盖成单条”回归；统一写入器本地压测已通过，但 Raycast live E2E 仍需完成

---

## 6. 下一步

这个 runbook 跑通后，下一手再做：

1. 先做一轮 Raycast UI -> live `memory/braindump.md` 的端到端压测（20~50 条），确认无覆盖、无黏连、size 单调增长
2. 继续观察 `task_result_v1` 校验是否连续多轮保持 `valid=true`
3. 用 `launchd` 把 `scripts/run_remote_digestion.sh` 挂成稳定定时任务
4. 连续观察几天真实产出的 `memory/YYYY-MM-DD.md`
