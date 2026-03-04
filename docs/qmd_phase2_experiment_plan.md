# QMD Phase 4.2 实验计划

> 本文档承接 [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md) 阶段四。
> 前置 live 结论见 [qmd_live_validation_findings_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_live_validation_findings_2026-03-03.md)。
> 目标：在保持部署机 live QMD 可用的前提下，系统化推进召回质量调优，而不是继续停留在“能不能跑”。
> Phase 4.2 第一轮 `search vs query` 实验结果见：
> [qmd_phase42_search_vs_query_results_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_phase42_search_vs_query_results_2026-03-03.md)
> Phase 4.2 `mission_log` 实验结果见：
> [qmd_phase42_mission_log_results_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_phase42_mission_log_results_2026-03-03.md)
>
> 注意：本文档保留为已完成实验记录。当前主线已停止继续扩自定义 QMD retrieval 调参，后续推进见 [openclaw_memory_layer_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw_memory_layer_plan.md)。

日期：2026-03-03

---

## 0. 当前已知事实

部署机当前已经满足：

- `memory.backend = "qmd"` 已 live
- baseline 白名单只索引：
  - `MEMORY.md`
  - `memory/knowledge/**/*.md`
- `searchMode = "search"`
- `knowledge` 与 `MEMORY.md` 召回可用

同时已经确认的问题：

1. 中文短 query 在 `search` 模式下偏弱
2. `memory/mission_log.md` 未纳入索引，导致历史任务/疑虑召回缺失
3. `memory/YYYY-MM-DD.md` 还没纳入，daily memory 的收益与污染成本未知

---

## 1. 本阶段目标

这一阶段只做三件事：

1. 对比 `search` / `query` / 必要时 `vsearch` 的召回质量
2. 评估第二阶段白名单是否纳入 `memory/mission_log.md`
3. 评估第二阶段白名单是否纳入 `memory/YYYY-MM-DD.md`

配套资产：

- 评测 query 集：
  [qmd_eval_queries.txt](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_eval_queries.txt)
- 评测脚本：
  [qmd_eval_matrix.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/qmd_eval_matrix.mjs)
- 结果对比脚本：
  [qmd_compare_eval_reports.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/qmd_compare_eval_reports.mjs)
- 部署机一键评测脚本：
  [qmd_run_eval.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/qmd_run_eval.sh)
- query mode overlay：
  [openclaw.vibe-os.instance.qmd-query-mode-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-query-mode-overlay.example.json5)
- mission log overlay：
  [openclaw.vibe-os.instance.qmd-mission-log-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-mission-log-overlay.example.json5)
- mission log runbook：
  [qmd_phase42_mission_log_experiment_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase42_mission_log_experiment_runbook.md)
- task memory distillation script：
  [distill_mission_log_to_task_memory.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/distill_mission_log_to_task_memory.mjs)
- task memory one-command eval script：
  [qmd_run_task_memory_eval.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/qmd_run_task_memory_eval.sh)
- task memory overlay：
  [openclaw.vibe-os.instance.qmd-task-memory-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-task-memory-overlay.example.json5)
- task memory runbook：
  [qmd_phase43_task_memory_distillation_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase43_task_memory_distillation_runbook.md)
- daily memory overlay：
  [openclaw.vibe-os.instance.qmd-daily-memory-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-daily-memory-overlay.example.json5)

这一阶段明确不做：

- 索引 `memory/braindump.md`
- Telegram 相关改动
- 重做 Raycast
- 重构 digestion 产物格式

---

## 2. 实验一：Search Mode 对比

### 2.1 目的

确认是否值得从当前的 `search` 切到 `query`。

### 2.2 对比对象

- `search`
- `query`
- 必要时再加 `vsearch`

### 2.3 评测 query 集

至少覆盖三类：

1. 用户偏好
2. 项目知识 / 长期主题
3. 历史任务 / 项目疑虑

建议 query：

```text
AI Native
Crypto Markdown
Memory as File System
减脂
OpenClaw gateway
remote digestion
run_remote_digestion.mjs
验证 remote runner
```

### 2.4 评估维度

- 是否命中正确文档
- 结果是否出现在前 3
- 中文短 query 是否明显改善
- 响应延迟是否可接受
- 首次冷启动是否明显恶化

### 2.5 验收口径

只有同时满足下面条件，才值得切 live：

- 中文 query 的有效召回明显优于 `search`
- 英文 / 中英混合 query 没有明显退化
- 响应时延没有恶化到影响交互

推荐执行：

```bash
scripts/qmd_run_eval.sh \
  --label search-baseline \
  --instance-root /Users/kris/instances/vibe-os \
  --force-reindex
```

切到 `query` overlay 后再跑：

```bash
scripts/qmd_run_eval.sh \
  --label query-mode \
  --instance-root /Users/kris/instances/vibe-os \
  --base-report .logs/qmd-eval/search-baseline.json \
  --compare-output .logs/qmd-eval/search-vs-query.md
```

第一轮 live 结果（2026-03-03）：

- `search` baseline 可用
- `query` mode 在当前 live 条件下完整 matrix 超过 8 分钟未完成
- 逐条 timed spot-check 中 8/8 query 触发 `qmd query ... timed out after 4000ms`
- 当前阶段不建议把 live 默认模式切到 `query`
- 后续所有 live eval 都应显式注入 `--profile` + `--instance-root`，避免误打到默认 `~/.openclaw`
- 部署机非交互 shell 可能缺少 Homebrew PATH；评测命令应显式注入 `--openclaw-bin /opt/homebrew/bin/openclaw`
- 统一建议优先通过 `scripts/qmd_run_eval.sh` 执行评测，避免部署机环境漂移

2026-03-04 一键脚本复验（部署机本机）：

1. baseline（search）先通过一键脚本刷新：

```bash
scripts/qmd_run_eval.sh \
  --label search-baseline \
  --instance-root /Users/kris/instances/vibe-os \
  --force-reindex
```

- 结果：`Indexed 6/8 files · 6 chunks`
- baseline 报告成功更新：
  - `.logs/qmd-eval/search-baseline.json`（2026-03-04 18:05）
- 仍有 2 条 `No matches`：`减脂`、`run_remote_digestion.mjs`

2. 切换 `memory.qmd.searchMode=query` 后执行：

```bash
scripts/qmd_run_eval.sh \
  --label query-mode \
  --instance-root /Users/kris/instances/vibe-os \
  --base-report .logs/qmd-eval/search-baseline.json \
  --compare-output .logs/qmd-eval/search-vs-query.md
```

- 运行超过 9 分钟仍未完成（`qmd_eval_matrix.mjs` 持续挂起），按超时中止
- 本轮未生成新 `query-mode` 报告；旧文件时间戳仍停留在 2026-03-03：
  - `.logs/qmd-eval/query-mode.json`
  - `.logs/qmd-eval/search-vs-query.md`

3. 限时 spot-check（8 条 query，单条 12s 超时保护）：

- `AI Native`：`qmd query ... timed out after 4000ms`
- `Crypto Markdown`：`qmd query ... timed out after 4000ms`
- `Memory as File System`：`qmd query ... timed out after 4000ms`
- `减脂`：`qmd query ... timed out after 4000ms`
- `OpenClaw gateway`：`qmd query ... timed out after 4000ms`
- `remote digestion`：`qmd query ... timed out after 4000ms`
- `run_remote_digestion.mjs`：`qmd query ... timed out after 4000ms`
- `验证 remote runner`：`qmd query ... timed out after 4000ms`

结论：

- 当前部署机口径下，`query` 模式仍不可用于 live 默认检索
- 已将 `searchMode` 回滚为 `search`，并重启 `ai.openclaw.vibe-os` gateway

---

## 3. 实验二：Mission Log 纳入评估

### 3.1 目的

补齐“历史任务 / 历史疑虑 / 跟进项”召回缺口。

### 3.2 候选白名单

在当前 baseline 上新增：

```json5
{ name: "mission-log", path: "memory", pattern: "mission_log.md" }
```

对应 overlay：

- [openclaw.vibe-os.instance.qmd-mission-log-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-mission-log-overlay.example.json5)

### 3.3 关注点

- 是否能补到 `run_remote_digestion.mjs`、`验证 remote runner` 这类历史任务线索
- 是否引入过多低密度 TODO 噪音
- 是否挤占 `knowledge / MEMORY` 的高价值结果位

### 3.4 验收口径

只有在“任务召回明显提升”且“不会大面积污染原有高密度结果”时，才纳入 live 白名单。

推荐执行：

```bash
scripts/qmd_run_eval.sh \
  --label mission-log-candidate \
  --instance-root /Users/kris/instances/vibe-os \
  --base-report .logs/qmd-eval/search-baseline.json \
  --compare-output .logs/qmd-eval/search-vs-mission-log.md
```

当前 live 实验结论（2026-03-03）：

- `验证 remote runner` 明显改善
- `remote digestion` 出现 mission-log 结果顶到 knowledge 结果前面的趋势
- `run_remote_digestion.mjs` 仍未改善
- 暂未看到 `AI Native / OpenClaw gateway` 这类高价值 query 被明显污染
- 结论偏正面，但还不足以下“必须永久纳入 live”的最终判断
- 下一步优先做 `mission_log` 的切片/去噪实验，而不是直接接受“整文件永久纳入”

2026-03-04 补充观察（部署机 spot-check）：

- 修复非交互环境 `openclaw ENOENT` 后，search baseline 评测可稳定跑完
- 与 2026-03-03 baseline 对比为 `Changed 6 / Same 2`，主要是分值波动，不是结构性召回退化
- `remote digestion` query 里 `mission_log` 结果重新出现到前排，说明该源在任务线索召回上仍有价值

2026-03-04 search-only 对比结论（见 [qmd_phase42_mission_log_experiment_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase42_mission_log_experiment_runbook.md#L149)）：

- 对比口径：`search-baseline-no-mission-log` vs `mission-log-candidate`
- 汇总结果：`Improved 0 / Regressed 0 / Changed 2 / Same 6`
- `验证 remote runner` 从 `No matches` 变为命中 `memory/mission-log.md`
- `remote digestion` 增加 `mission_log` 线索且排序前移
- `AI Native` / `Crypto Markdown` / `Memory as File System` / `OpenClaw gateway` 无明显污染

阶段决策（当前生效）：

- live 默认继续保持 `search`，不切 `query`
- `mission_log` 白名单在 `search` 模式下继续保留观察
- 下一步优先做 `mission_log` 切片/去噪，再评估是否长期固化
- Phase 4.3 首轮（task-memory）已完成；当前结论是“先不替换 mission_log 直索引”

下一轮执行入口（Phase 4.3）：

- 先用 [distill_mission_log_to_task_memory.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/distill_mission_log_to_task_memory.mjs) 生成 `memory/task_memory.md`
- 用 [openclaw.vibe-os.instance.qmd-task-memory-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-task-memory-overlay.example.json5) 替换 `mission_log` 直索引
- 按 [qmd_phase43_task_memory_distillation_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase43_task_memory_distillation_runbook.md) 跑对比评测

2026-03-04 Phase 4.3 首轮结果（见 [qmd_phase43_task_memory_distillation_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase43_task_memory_distillation_runbook.md#L128)）：

- 对比口径一：`search-baseline-no-mission-log` vs `task-memory-candidate`
  - `Improved 0 / Regressed 0 / Changed 6 / Same 2`
- 对比口径二：`mission-log-candidate` vs `task-memory-candidate`
  - `Improved 0 / Regressed 0 / Changed 6 / Same 2`
- 任务 query 命中情况：
  - `remote digestion`、`验证 remote runner` 在 task-memory 下可命中
  - 但相对 mission-log 候选，首命中分值偏低（强度暂弱）
  - `run_remote_digestion.mjs` 仍然 `No matches`
- 防回归 query（`AI Native` / `Crypto Markdown` / `Memory as File System` / `OpenClaw gateway`）未见污染
- 决策：live 继续维持 `search + mission_log`；task-memory 作为下一轮切片规则优化方向

推荐下一轮方向：

1. 从 `mission_log` 导出更高密度的 task-memory 子集，而不是整文件直灌
2. 把“开放任务 / 跟进项 / 已完成事项”拆开，避免 TODO 语气挤占知识结果
3. 保持 `search` 模式不变，只比较索引源切片策略

2026-03-04 基线复跑记录（部署机本机，QMD baseline refresh）：

- 首次在受限环境执行 `memory index` 触发 `SQLITE_CANTOPEN`（`unable to open database file`），属于实例 state 目录写权限受限导致的假故障
- 在部署机宿主权限下执行：

```bash
OPENCLAW_STATE_DIR=/Users/kris/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/kris/instances/vibe-os/config/openclaw.json \
/opt/homebrew/bin/openclaw memory index --agent main --force
```

- reindex 成功后状态：
  - `Indexed: 6/8 files · 6 chunks`
  - store: `~/instances/vibe-os/state/agents/main/qmd/xdg-cache/qmd/index.sqlite`
- 复跑 baseline（显式注入 profile/instance/openclaw-bin）：

```bash
node scripts/qmd_eval_matrix.mjs \
  --label search-baseline-reindex \
  --profile vibe-os \
  --instance-root /Users/kris/instances/vibe-os \
  --openclaw-bin /opt/homebrew/bin/openclaw \
  --format json \
  --output .logs/qmd-eval/search-baseline-reindex-2026-03-04.json
```

- 结果摘要：
  - `8/8` query 执行成功
  - `No matches` 从 `8` 条降到 `2` 条（`减脂`、`run_remote_digestion.mjs`）
  - 对比旧 baseline：`Changed 6 / Same 2`
- 产物：
  - `.logs/qmd-eval/search-baseline-reindex-2026-03-04.json`
  - `.logs/qmd-eval/search-baseline-vs-reindex-2026-03-04.md`
- 备注：输出中持续出现 telegram allowlist doctor warning，但不影响本轮 QMD baseline 结论

---

## 4. 实验三：Daily Memory 纳入评估

### 4.1 前提

只有在 `memory/YYYY-MM-DD.md` 真实稳定产出后，才做这轮实验。

### 4.2 候选白名单

```json5
{ name: "daily-memory", path: "memory", pattern: "20*.md" }
```

对应 overlay：

- [openclaw.vibe-os.instance.qmd-daily-memory-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-daily-memory-overlay.example.json5)

### 4.3 目的

补齐“最近几天讨论过但尚未进入 knowledge / MEMORY”的上下文召回。

### 4.4 风险

- 时间性噪音增多
- 检索结果更像流水账
- 容易稀释 `knowledge / MEMORY` 的信号强度

### 4.5 验收口径

如果 daily memory 只能带来少量增益，却显著污染 top results，就不进入 live。

---

## 5. 推荐实验顺序

1. 先固定当前 baseline：
   - `searchMode = search`
   - 白名单只含 `MEMORY.md + knowledge`
2. 仅切换 search mode，对比 `search` vs `query`
3. 在保留较优 search mode 的前提下，单独评估 `mission_log`
4. 最后再评估 `daily memory`

原则：

- 一次只改一个变量
- 不把 `searchMode` 和白名单扩展绑在同一轮
- 不把 `mission_log` 和 `daily memory` 绑在同一轮

---

## 6. 建议输出物

完成这阶段后，至少应补齐：

- 一份 search mode 对比记录
- 一份 `mission_log` 纳入与否结论
- 一份 `daily memory` 纳入与否结论
- 如果 live 配置发生变化，同步更新：
  - [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md)
  - [qmd_enablement_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_enablement_plan.md)
  - [qmd_live_validation_findings_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_live_validation_findings_2026-03-03.md)

---

## 7. 当前结论

QMD baseline enablement 已完成。

现在的主问题不是：

- QMD 有没有装上
- Gateway 能不能起来
- `memory_search` 有没有结果

现在的主问题是：

- 中文 query 召回质量够不够
- `mission_log` 值不值得纳入
- daily memory 值不值得纳入

这才是阶段四接下来的真正主线。
