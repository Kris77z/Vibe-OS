# QMD Phase 4.3 Task Memory 切片实验 Runbook

> 本文档承接 [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md) 与 [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)。
> 目标：不引入新基础设施，只用文件蒸馏把 `mission_log` 低噪声化，再验证 search 召回质量。

日期：2026-03-04

---

## 0. 实验假设

- `mission_log.md` 直索引有增益，但 TODO 语气噪音偏重。
- 先把任务线索蒸馏成 `memory/task_memory.md`，再索引该文件，可能更稳。
- 仍保持：
  - `memory.backend = "qmd"`
  - `searchMode = "search"`
  - 不纳入 `braindump.md`
  - 不碰 Telegram 与 Raycast

---

## 1. 生成 task memory 文件

在部署机仓库执行：

```bash
cd /Users/kris/Desktop/Dev/Vibe-OS
/opt/homebrew/bin/node scripts/distill_mission_log_to_task_memory.mjs \
  --mission-log /Users/kris/instances/vibe-os/workspace/memory/mission_log.md \
  --output /Users/kris/instances/vibe-os/workspace/memory/task_memory.md
```

预期输出：

- JSON `status: ok`
- `memory/task_memory.md` 生成或更新

---

## 2. 应用 task-memory overlay

在 live config 的 QMD paths 中，使用下面三项：

- `MEMORY.md`
- `memory/knowledge/**/*.md`
- `memory/task_memory.md`

参考：

- [openclaw.vibe-os.instance.qmd-task-memory-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-task-memory-overlay.example.json5)

说明：

- 本轮候选不再直索引 `memory/mission_log.md`

---

## 3. 评测命令

一键命令（推荐，前提是 baseline 报告已存在）：

```bash
scripts/qmd_run_task_memory_eval.sh \
  --instance-root /Users/kris/instances/vibe-os \
  --force-reindex
```

说明：

- 一键脚本默认会读取 `<instance-root>/workspace/memory/mission_log.md`
- 并写入 `<instance-root>/workspace/memory/task_memory.md`

对应脚本：

- [qmd_run_task_memory_eval.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/qmd_run_task_memory_eval.sh)

分步命令（排障时使用）：

先准备对比基线（建议使用不含 mission_log 的基线）：

```bash
scripts/qmd_run_eval.sh \
  --label search-baseline-no-mission-log \
  --instance-root /Users/kris/instances/vibe-os \
  --output .logs/qmd-eval/search-baseline-no-mission-log.json \
  --force-reindex
```

再跑 task-memory 候选：

```bash
scripts/qmd_run_eval.sh \
  --label task-memory-candidate \
  --instance-root /Users/kris/instances/vibe-os \
  --force-reindex \
  --base-report .logs/qmd-eval/search-baseline-no-mission-log.json \
  --compare-output .logs/qmd-eval/search-vs-task-memory.md
```

---

## 4. 验收口径

重点 query：

- `remote digestion`
- `验证 remote runner`
- `run_remote_digestion.mjs`

防回归 query：

- `AI Native`
- `Crypto Markdown`
- `Memory as File System`
- `OpenClaw gateway`

通过条件：

1. 任务 query 至少不弱于 `mission-log-candidate`
2. 防回归 query 不出现明显污染
3. 评测可稳定跑完，无 query-mode 式超时卡死

---

## 5. 结果回写

实验后同步回写：

- [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)
- [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md)

---

## 6. 2026-03-04 首轮实测结果（部署机本机）

说明：

- 本机仓库与 live workspace 分离（仓库：`/Users/kris/Desktop/Dev/Vibe-OS`；live：`/Users/kris/instances/vibe-os/workspace`）
- 因此本轮显式指定 distill 输入/输出为 live workspace 绝对路径

执行命令：

```bash
scripts/qmd_run_task_memory_eval.sh \
  --instance-root /Users/kris/instances/vibe-os \
  --mission-log /Users/kris/instances/vibe-os/workspace/memory/mission_log.md \
  --task-memory-output /Users/kris/instances/vibe-os/workspace/memory/task_memory.md \
  --force-reindex
```

产物：

- `.logs/qmd-eval/task-memory-candidate.json`
- `.logs/qmd-eval/search-vs-task-memory.md`
- `.logs/qmd-eval/mission-log-vs-task-memory.md`
- live 文件：`/Users/kris/instances/vibe-os/workspace/memory/task_memory.md`

结果摘要：

- `search-baseline-no-mission-log` vs `task-memory-candidate`：
  - `Improved 0 / Regressed 0 / Changed 6 / Same 2`
- `mission-log-candidate` vs `task-memory-candidate`：
  - `Improved 0 / Regressed 0 / Changed 6 / Same 2`
- `openclaw memory status --agent main --deep`：
  - `Indexed: 7/9 files · 7 chunks`

重点 query 对比（mission-log vs task-memory）：

- `remote digestion`：
  - mission-log 首命中 `0.480 memory/mission-log.md`
  - task-memory 首命中 `0.230 memory/task-memory.md`
- `验证 remote runner`：
  - mission-log 首命中 `0.760 memory/mission-log.md`
  - task-memory 首命中 `0.530 memory/task-memory.md`
- `run_remote_digestion.mjs`：
  - 两者都仍是 `No matches`

结论：

- task-memory 候选可以命中任务线索，但首轮强度暂未达到“不弱于 mission-log-candidate”的通过标准
- 防回归 query（`AI Native / Crypto Markdown / Memory as File System / OpenClaw gateway`）未见污染
- live 已回滚到 `mission-log` 白名单（`search` 模式保持不变），task-memory 继续作为下一轮 distillation 迭代方向

下一轮（v2）调整点：

- 蒸馏文件改为更紧凑结构，减少模板噪音
- 为每条任务自动附加 query anchors（例如 `remote digestion`、`remote runner`、`run_remote_digestion.mjs`）
- 复验命令保持不变，继续使用 `scripts/qmd_run_task_memory_eval.sh`

---

## 7. 2026-03-04 第二轮实测结果（anchors 版本）

执行命令：

```bash
scripts/qmd_run_task_memory_eval.sh \
  --instance-root /Users/kris/instances/vibe-os \
  --label task-memory-candidate-v2 \
  --base-report .logs/qmd-eval/search-baseline-no-mission-log.json \
  --compare-output .logs/qmd-eval/search-vs-task-memory-v2.md \
  --force-reindex
```

说明：

- 第二轮使用更新后的 distill 脚本（默认 `includeEntryAnchors=true`）
- `task_memory.md` 结构已变为紧凑版，包含 `Open Tasks` 与 `Search Anchors`

产物：

- `.logs/qmd-eval/task-memory-candidate-v2.json`
- `.logs/qmd-eval/search-vs-task-memory-v2.md`
- `.logs/qmd-eval/mission-log-vs-task-memory-v2.md`

结果摘要：

- `search-baseline-no-mission-log` vs `task-memory-candidate-v2`：
  - `Improved 0 / Regressed 0 / Changed 6 / Same 2`
- `mission-log-candidate` vs `task-memory-candidate-v2`：
  - `Improved 0 / Regressed 0 / Changed 6 / Same 2`
- `openclaw memory status --agent main --deep`：
  - `Indexed: 7/9 files · 7 chunks`

重点 query（mission-log vs task-memory-v2）：

- `remote digestion`：
  - mission-log：`0.480 memory/mission-log.md`
  - task-memory-v1：`0.230 memory/task-memory.md`
  - task-memory-v2：`0.320 memory/task-memory.md`
- `验证 remote runner`：
  - mission-log：`0.760 memory/mission-log.md`
  - task-memory-v1：`0.530 memory/task-memory.md`
  - task-memory-v2：`0.670 memory/task-memory.md`
- `run_remote_digestion.mjs`：
  - mission-log / task-memory-v1 / task-memory-v2 均 `No matches`

结论：

- anchors 版本相对首轮有改善（任务 query 首命中分值上升）
- 但仍未达到“任务 query 不弱于 mission-log-candidate”的通过标准
- live 继续保持 `search + mission_log`，task-memory 进入下一轮规则优化

---

## 8. 2026-03-04 第三轮实测结果（anchors v3 精简）

第三轮改动：

- distill 脚本进一步收敛 query keys：
  - 去掉低信号碎词（如 `todo`、`run`、`mjs` 单词级噪音）
  - 保留高信号短语（如 `验证 remote runner`、`remote digestion`、`run_remote_digestion.mjs`）
  - 每条任务默认最多保留 8 个 query keys

执行命令：

```bash
scripts/qmd_run_task_memory_eval.sh \
  --instance-root /Users/kris/instances/vibe-os \
  --label task-memory-candidate-v3 \
  --base-report .logs/qmd-eval/search-baseline-no-mission-log.json \
  --compare-output .logs/qmd-eval/search-vs-task-memory-v3.md \
  --force-reindex
```

产物：

- `.logs/qmd-eval/task-memory-candidate-v3.json`
- `.logs/qmd-eval/search-vs-task-memory-v3.md`
- `.logs/qmd-eval/mission-log-vs-task-memory-v3.md`

结果摘要：

- `search-baseline-no-mission-log` vs `task-memory-candidate-v3`：
  - `Improved 0 / Regressed 0 / Changed 6 / Same 2`
- `mission-log-candidate` vs `task-memory-candidate-v3`：
  - `Improved 0 / Regressed 0 / Changed 6 / Same 2`

重点 query（mission-log vs task-memory-v2 vs task-memory-v3）：

- `remote digestion`：
  - mission-log：`0.480 memory/mission-log.md`
  - task-memory-v2：`0.320 memory/task-memory.md`
  - task-memory-v3：`0.330 memory/task-memory.md`
- `验证 remote runner`：
  - mission-log：`0.760 memory/mission-log.md`
  - task-memory-v2：`0.670 memory/task-memory.md`
  - task-memory-v3：`0.670 memory/task-memory.md`
- `run_remote_digestion.mjs`：
  - mission-log / task-memory-v2 / task-memory-v3 均 `No matches`

结论：

- v3 相比 v2 仅小幅提升（`remote digestion 0.320 -> 0.330`），总体仍弱于 `mission-log-candidate`
- 当前阶段判定为“已接近上限但未过线”，继续保持 live `search + mission_log`
