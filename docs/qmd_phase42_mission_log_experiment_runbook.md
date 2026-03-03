# QMD Phase 4.2 Mission Log 实验 Runbook

> 本文档承接 [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)。
> 目标：在不改 Telegram、不重做 Raycast、不索引 braindump 的前提下，验证把 `memory/mission_log.md` 纳入 live 白名单后，是否能补齐历史任务/疑虑召回。

日期：2026-03-03

---

## 0. 这轮只改一个变量

保持以下条件不变：

- `memory.backend = "qmd"`
- `memory.qmd.searchMode = "search"`
- 继续只跑部署机 live instance
- 不加 `daily memory`
- 不加 `braindump`

唯一变量：

- 在 baseline 白名单上新增 `memory/mission_log.md`

对应 overlay：

- [openclaw.vibe-os.instance.qmd-mission-log-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-mission-log-overlay.example.json5)

---

## 1. 实验前确认

先确认当前 live config 已经回到 `search`，不要继续停留在 `query`。

最小检查：

```bash
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/kris/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/kris/instances/vibe-os/config/openclaw.json \
openclaw memory status --agent main --deep
```

---

## 2. 先保留 baseline

如果还没有 corrected baseline，先跑：

```bash
node scripts/qmd_eval_matrix.mjs \
  --label search-baseline \
  --profile vibe-os \
  --instance-root /Users/kris/instances/vibe-os \
  --format json \
  --output .logs/qmd-eval/search-baseline.json
```

这份 baseline 后续作为统一对比面，不要覆盖成别的模式结果。

---

## 3. 应用 mission_log overlay

把下面这条白名单加到 live config：

```json5
{ name: "mission-log", path: "memory", pattern: "mission_log.md" }
```

保持其他项不变：

- `searchMode = "search"`
- `MEMORY.md`
- `memory/knowledge/**/*.md`
- `scope.default = "allow"` + deny `group/channel`

修改后重启 gateway。

---

## 4. 跑 candidate 评测

```bash
node scripts/qmd_eval_matrix.mjs \
  --label mission-log-candidate \
  --profile vibe-os \
  --instance-root /Users/kris/instances/vibe-os \
  --format json \
  --output .logs/qmd-eval/mission-log-candidate.json
```

再生成对比：

```bash
node scripts/qmd_compare_eval_reports.mjs \
  --base .logs/qmd-eval/search-baseline.json \
  --candidate .logs/qmd-eval/mission-log-candidate.json \
  --output .logs/qmd-eval/search-vs-mission-log.md
```

---

## 5. 重点看什么

这轮最重要的不是“结果变多了”，而是“结果是不是更对”。

重点 query：

- `run_remote_digestion.mjs`
- `验证 remote runner`
- `remote digestion`

同时盯住这类高价值 baseline query 是否被污染：

- `AI Native`
- `Crypto Markdown`
- `Memory as File System`
- `OpenClaw gateway`

---

## 6. 验收口径

只有同时满足下面条件，才值得保留 mission_log：

1. 历史任务 / 历史疑虑 query 明显改善
2. `knowledge / MEMORY` 的高密度结果没有大面积退化
3. 延迟没有明显恶化
4. 没出现 TODO 噪音淹没长期记忆的情况

---

## 7. 实验后汇报要求

至少贴出：

- `openclaw memory status --agent main --deep`
- `.logs/qmd-eval/search-vs-mission-log.md`
- 哪些 query improved
- 哪些 query regressed
- `run_remote_digestion.mjs` / `验证 remote runner` 是否终于可召回
- `AI Native` / `OpenClaw gateway` 是否被污染

---

## 8. 文档回写

如果实验完成，后续至少要回写：

- [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)
- [qmd_live_validation_findings_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_live_validation_findings_2026-03-03.md)

如果结论明确，再补一份：

- `qmd_phase42_mission_log_results_2026-03-03.md`
