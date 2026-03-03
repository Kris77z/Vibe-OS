# QMD Phase 4.2 实验结果：Search vs Query（2026-03-03）

> 目的：记录这轮在部署机 live instance 上完成的 `search` vs `query` 对比实验结论。
> 上位实验计划见 [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)。
> 前置 live 基线见 [qmd_live_validation_findings_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_live_validation_findings_2026-03-03.md)。
> 归档说明：`query` 已被证明不适合当前 live 默认路径，这份文档保留为实验记录。

日期：2026-03-03

---

## 0. 实验边界

本轮严格保持以下边界：

- 不改 Telegram
- 不重做 Raycast
- 不索引 `memory/braindump.md`
- 不把 `memory/mission_log.md` 加进白名单
- 不把 `memory/YYYY-MM-DD.md` 加进白名单

唯一变量：

- `memory.qmd.searchMode`
  - baseline: `search`
  - candidate: `query`

索引白名单始终保持：

```text
MEMORY.md
memory/knowledge/**/*.md
```

---

## 1. 实验对象

live instance：

- config: `/Users/kris/instances/vibe-os/config/openclaw.json`
- workspace: `/Users/kris/instances/vibe-os/workspace`
- state: `/Users/kris/instances/vibe-os/state`

固定 query 集：

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

配套资产：

- 原始 baseline 报告：
  `.logs/qmd-eval/search-baseline.json`
- 原始 candidate 报告：
  `.logs/qmd-eval/query-mode.json`
- 对比摘要：
  `.logs/qmd-eval/search-vs-query.md`

---

## 2. 实验过程中的真实偏差

这轮实验中先暴露了一个执行口径问题：

- `node scripts/qmd_eval_matrix.mjs ...`
  默认只吃当前 shell 环境里的 `OPENCLAW_*`
- 如果不显式注入 live instance 的：
  - `OPENCLAW_PROFILE`
  - `OPENCLAW_STATE_DIR`
  - `OPENCLAW_CONFIG_PATH`
  它会误打到默认 `~/.openclaw`

因此：

- 第一轮 raw `search-baseline.json`
- 第一轮 raw `query-mode.json`

最初都不是针对 live Vibe-OS instance 的有效对比。

本轮已做修正：

- baseline 已在 live env 下重跑，作为有效基线
- query 模式的完整 matrix 在 live env 下重跑，但未在合理时间内完成
- 随后补做了受控的逐条 timed spot-check，用于给出最终判断

所以本轮结论应以：

- corrected live baseline
- query-mode timed spot-check

为准。

---

## 3. baseline（search）结果

corrected live baseline 结论：

- `search` 模式可正常工作
- `MEMORY.md` 与 `memory/knowledge/**/*.md` 的现有召回路径可用
- 英文/中英混合 query 可返回有效结果
- 中文短 query `减脂` 仍然返回空

典型可用命中：

- `AI Native`
- `Crypto Markdown`
- `Memory as File System`
- `OpenClaw gateway`
- `remote digestion`

典型仍然缺失：

- `减脂`
- `run_remote_digestion.mjs`
- `验证 remote runner`

这和 Phase 4.1 的 live 结论一致：

- 中文短 query 仍弱
- 历史任务/疑虑仍因未纳入 `mission_log` 而缺失

---

## 4. candidate（query）结果

### 4.1 完整 matrix

在 live env 下，`query-mode` 的完整 8-query matrix：

- 超过 8 分钟仍未跑完
- 最终手动中止

结论：

- `query` 模式当前不满足“固定评测集可在合理时间内完成”的要求

### 4.2 逐条 timed spot-check

为避免只得到“卡住”这一类模糊结论，本轮又对同一组 8 个 query 做了逐条受控 spot-check：

- 每条 query 的外层命令硬上限：约 30s
- OpenClaw 内部 QMD timeout：4000ms

实际结果：

- 8/8 全部触发同一种失败模式
- OpenClaw 日志统一表现为：
  - `qmd query ... timed out after 4000ms`
  - 然后 fallback 到 builtin memory path
- 但外层 CLI 调用仍然拖到大约 30 秒才返回

换句话说：

- 这不是“query 模式更慢但更准”
- 而是“query 模式在当前 live 条件下基本不可用”

---

## 5. 结果判定

### 5.1 improved / regressed

本轮可成立的最终判断：

- Improved: `0`
- Regressed: `8`
- Same: `0`

回归项：

- `AI Native`
- `Crypto Markdown`
- `Memory as File System`
- `减脂`
- `OpenClaw gateway`
- `remote digestion`
- `run_remote_digestion.mjs`
- `验证 remote runner`

### 5.2 中文短 query

重点 query：`减脂`

结果：

- 在 `search` baseline 下：无命中，但返回迅速
- 在 `query` mode 下：没有改善，直接触发 timeout

结论：

- `减脂` 没有任何正向提升
- 反而从“快速但无命中”退化成“超时并 fallback”

### 5.3 延迟体感

本轮实验最明确的结论之一就是延迟：

- `search`：可正常完成固定 query 集
- `query`：
  - 完整 matrix 超过 8 分钟未完成
  - 单条 query 常见 wall-clock 大约 30 秒
  - 内部 QMD query timeout 为 4 秒

结论：

- query 模式的响应延迟不是“略差”
- 而是**明显恶化，达到不可接受级别**

---

## 6. 当时的 live 状态

在这轮 `search vs query` 实验结束时，live config 停在：

- `memory.backend = "qmd"`
- `memory.qmd.searchMode = "query"`
- 白名单仍只有：
  - `MEMORY.md`
  - `memory/knowledge/**/*.md`

并且：

- 没有继续改 `mission_log`
- 没有继续改 `daily memory`
- 没有动 Telegram
- 没有动 Raycast

这符合本轮实验的边界要求。

---

## 7. 建议给开发机的结论

这轮 `search vs query` 第一轮实验已经足够给出明确方向：

1. 当前 live 条件下，`query` 不值得继续作为默认候选
2. 开发机如果要继续研究 `query`，优先查：
   - 为什么每条 query 都稳定触发 `qmd query ... timed out after 4000ms`
   - 是模型冷启动、query expansion、rerank、还是 QMD 本体耗时失控
3. 在没有明确性能修复前，不建议把 live 默认模式从 `search` 切到 `query`
4. 下一步比继续硬推 `query` 更优先的，仍然是：
   - `mission_log` 纳入评估
   - daily memory 纳入评估

---

## 8. 当前结论

这轮 Phase 4.2 第一轮实验的结论非常直接：

- `search` baseline 可用
- `query` candidate 全面回归

补充说明：

- 后续如果 live config 因其他实验继续变化，以实例当前配置为准
- 本文档只描述这轮 `search vs query` 实验结束时的状态快照
- 中文短 query（尤其 `减脂`）没有改善
- 延迟显著恶化

因此，当前不应基于这轮结果把 live 默认模式切到 `query`。
