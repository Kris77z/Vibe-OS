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
  --mission-log memory/mission_log.md \
  --output memory/task_memory.md
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
