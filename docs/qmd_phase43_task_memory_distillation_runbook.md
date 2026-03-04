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
