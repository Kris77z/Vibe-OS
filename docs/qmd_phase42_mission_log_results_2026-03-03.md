# QMD Phase 4.2 实验结果：Mission Log（2026-03-03）

> 目的：记录这轮在部署机 live instance 上完成的 `mission_log` 白名单实验结论。
> 上位实验计划见 [qmd_phase2_experiment_plan.md](/Users/kris/Desktop/Dev/Vibe-OS/docs/qmd_phase2_experiment_plan.md)。
> 执行 runbook 见 [qmd_phase42_mission_log_experiment_runbook.md](/Users/kris/Desktop/Dev/Vibe-OS/docs/qmd_phase42_mission_log_experiment_runbook.md)。

日期：2026-03-03

---

## 0. 实验边界

本轮保持以下边界不变：

- 不改 Telegram
- 不重做 Raycast
- 不索引 `memory/braindump.md`
- 不加 `daily memory`
- `memory.backend = "qmd"`
- `memory.qmd.searchMode = "search"`

唯一变量：

- 在 baseline 白名单上新增：

```json5
{ name: "mission-log", path: "memory", pattern: "mission_log.md" }
```

因此，本轮 candidate 白名单为：

```text
MEMORY.md
memory/knowledge/**/*.md
memory/mission_log.md
```

---

## 1. baseline 与 candidate

baseline：

- label: `search-baseline`
- 索引范围：
  - `MEMORY.md`
  - `memory/knowledge/**/*.md`

candidate：

- label: `mission-log-candidate`
- 索引范围：
  - `MEMORY.md`
  - `memory/knowledge/**/*.md`
  - `memory/mission_log.md`

对比文件：

- baseline report:
  `.logs/qmd-eval/search-baseline.json`
- candidate report:
  `.logs/qmd-eval/mission-log-candidate.json`
- comparison:
  `.logs/qmd-eval/search-vs-mission-log.md`

---

## 2. live status

本轮 candidate 生效后，live `memory status --deep` 为：

```text
Memory Search (main)
Provider: qmd (requested: qmd)
Model: qmd
Sources: memory
Indexed: 6/7 files · 6 chunks
Dirty: no
Store: ~/instances/vibe-os/state/agents/main/qmd/xdg-cache/qmd/index.sqlite
Workspace: ~/instances/vibe-os/workspace
Embeddings: ready
By source:
  memory · 6/7 files · 6 chunks
Vector: ready
Batch: disabled (failures 0/0)
```

相比 baseline：

- 从 `5/7 files · 5 chunks`
- 增长到 `6/7 files · 6 chunks`

说明：

- `memory/mission_log.md` 已成功纳入 live QMD index

---

## 3. query 结果变化

### 3.1 明显改善

本轮最明确的改善是：

- `验证 remote runner`

baseline：

- `No matches.`

candidate：

- 命中 `memory/mission-log.md`

这说明：

- mission_log 的确能补到“历史任务 / 历史疑虑”这类 query

### 3.2 部分改善，但伴随结果重排

`remote digestion`

baseline：

- 主命中是 `memory/knowledge/vibe-os-digestion.md`

candidate：

- `memory/mission-log.md` 排到前面
- `memory/knowledge/vibe-os-digestion.md` 退到第二

这说明：

- mission_log 确实在补任务线索
- 但也开始把某些“项目知识 query”拉向 TODO / 跟进项视角

### 3.3 没有改善

`run_remote_digestion.mjs`

baseline：

- `No matches.`

candidate：

- 仍然 `No matches.`

这说明：

- mission_log 目前只补到了自然语言任务表达
- 对具体脚本名召回并没有带来改善

---

## 4. 对高价值 baseline query 的影响

需要重点看的 baseline query：

- `AI Native`
- `Crypto Markdown`
- `Memory as File System`
- `OpenClaw gateway`

本轮结果：

- `AI Native`：主命中不变，只是分数轻微变化
- `Crypto Markdown`：主命中不变，只是分数轻微变化
- `Memory as File System`：主命中不变，只是分数轻微变化
- `OpenClaw gateway`：结果基本不变

结论：

- 当前看 **没有出现明显的高价值结果污染**
- 但 `remote digestion` 已出现“任务结果顶到知识结果前面”的趋势，需要继续观察

---

## 5. improved / regressed 判定

从“空结果变非空”这个最严格口径看：

- Improved:
  - `验证 remote runner`

- Regressed:
  - 暂无明确从“有结果变无结果”的项

- Not improved:
  - `run_remote_digestion.mjs`
  - `减脂`

如果按“结果是否发生重排”看：

- `remote digestion` 属于 **changed**
- 但不能简单算成 improved，因为它也带来了知识结果位次下沉

---

## 6. 延迟与可用性

本轮是 `search` 模式下做的 mission_log 实验。

结论：

- 没有出现像 `query` 模式那样的大面积 timeout
- 没有看到显著的交互级延迟恶化
- 本轮主要变化来自结果内容，而不是系统可用性下降

---

## 7. 当前结论

这轮 Mission Log 实验可以给出一个偏正面的中间结论：

1. `memory/mission_log.md` 确实有补价值
2. 它能补到一部分“历史任务 / 历史疑虑”召回
3. 当前尚未看到大面积污染 `MEMORY / knowledge` 的高价值结果
4. 但它会让部分项目知识 query 更偏向 TODO 视角
5. 对脚本名这类更具体的 query，补益仍然有限

所以更准确的判断不是“mission_log 已经完全值得纳入”，而是：

- **mission_log 值得继续保留在候选范围**
- **但还需要开发机进一步评估它是否会长期稀释 knowledge 排位**

---

## 8. 给开发机的建议

开发机后续优先看这两件事：

1. `remote digestion` 这类 query 是否应该优先知识结果，而不是 TODO 结果
2. 是否要对 mission_log 内容做更细粒度切分、去噪或权重控制，而不是整文件直接纳入

在没有进一步调优前，不建议基于这一轮就得出“mission_log 一定该永久纳入 live”的最终结论。
