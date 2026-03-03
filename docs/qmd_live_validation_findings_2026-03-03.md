# QMD 实机验证结论（2026-03-03）

> 目的：记录这轮在本机真实实例上的 QMD enablement、live 切换与召回质量验证结论，供后续开发机评估与迭代使用。
> 总蓝图见 [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md)。
> 下一阶段实验项见 [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)。
> `search vs query` 第一轮实验结果见 [qmd_phase42_search_vs_query_results_2026-03-03.md](/Users/kris/Desktop/Dev/Vibe-OS/docs/qmd_phase42_search_vs_query_results_2026-03-03.md)。

日期：2026-03-03

---

## 0. 机器分工更新

当前角色分工已经明确切换为：

- **本机（当前这台 Mac）**：部署机。负责长期运行 OpenClaw Gateway、QMD、launchd、真实索引、真实检索、真实验证。
- **开发机（后续那台评估/开发机器）**：负责方案评估、代码开发、检索质量调优、索引策略试验与非生产改动。

这意味着：

- 本机不再承担“开发机模式”的前提。
- 后续涉及召回调优、索引策略迭代、search mode 试验，优先在开发机做。
- 本机只承接部署、测试、真实运行与最终验收。

---

## 1. 本轮已完成的真实动作

### 1.1 live QMD 切换

本机真实实例路径：

- instance root: `/Users/kris/instances/vibe-os`
- workspace: `/Users/kris/instances/vibe-os/workspace`
- state: `/Users/kris/instances/vibe-os/state`
- config: `/Users/kris/instances/vibe-os/config/openclaw.json`

本轮已完成：

1. 安装 Bun
2. 安装 QMD CLI
3. 跑通 `scripts/check_qmd_prereqs.sh`
4. 跑通 `scripts/qmd_smoke_test.sh`
5. 将 live instance 的 `memory.backend` 从 `builtin` 切到 `qmd`
6. 重启 gateway 并验证：
   - `openclaw memory status --agent main --deep`
   - `openclaw memory search --agent main --query ...`

当前 live 状态：

- gateway 正常运行
- `memory backend = qmd`
- QMD index 位于：
  `/Users/kris/instances/vibe-os/state/agents/main/qmd/xdg-cache/qmd/index.sqlite`
- `memory status --deep` 显示：
  - `Provider: qmd`
  - `Embeddings: ready`
  - `Vector: ready`

---

## 2. 环境与安装层面的真实结论

### 2.1 QMD 安装口径

本机验证可用的安装方式是：

```bash
curl -fsSL https://bun.sh/install | bash
PATH="$HOME/.bun/bin:$PATH" bun install -g @tobilu/qmd
```

本机验证中，以下方式有坑：

```bash
bun install -g https://github.com/tobi/qmd
```

问题：

- 它会落成源码 checkout
- 可能没有可直接执行的 `dist/`
- 不能稳定作为部署机安装口径

结论：

- 部署机 runbook 应优先使用发布包 `@tobilu/qmd`
- 不要把 GitHub 源码安装当成默认路径

### 2.2 sqlite warning 的真实含义

`scripts/check_qmd_prereqs.sh` 中的 `ENABLE_LOAD_EXTENSION` 检查当前只能视为 **advisory warning**。

原因：

- Homebrew `sqlite3` 的 `pragma compile_options;` 并未显式返回 `ENABLE_LOAD_EXTENSION`
- 但 QMD / OpenClaw 实际运行时已经成功完成 vector probe
- live `memory status --deep` 已明确显示 `Embeddings: ready` 与 `Vector: ready`

结论：

- 不应把这条 warning 误判成“QMD 当前不可用”
- 是否真的可用，应以：
  - `scripts/qmd_smoke_test.sh`
  - `openclaw memory status --deep`
  - live `memory search`
  的真实结果为准

### 2.3 QMD scope 的真实坑

OpenClaw 当前 QMD 默认 scope 是：

- `default: "deny"`
- 仅允许 `chatType: "direct"`

这会导致一个实际问题：

- CLI 侧 `openclaw memory search` 没有 session 上下文时，会被 QMD scope 拒绝

本机 live 切换后，已将 live config 调整为：

- `default: "allow"`
- 显式拒绝 `group`
- 显式拒绝 `channel`

这样做的目的：

- 保留 CLI / 本地验证可用性
- 不放开 group/channel 检索面

---

## 3. 当前 live 索引边界

本机 live QMD 第一版白名单当前只索引：

```text
MEMORY.md
memory/knowledge/**/*.md
```

明确未纳入：

```text
memory/braindump.md
memory/mission_log.md
memory/YYYY-MM-DD.md
```

这意味着：

- 当前召回更偏“长期原则 + 已沉淀 knowledge”
- 还不是“所有历史任务/疑虑/日记都能召回”的状态

---

## 4. 真实召回质量验证

本轮使用 live `openclaw memory search` 做了三类样例验证。

### 4.1 knowledge 召回

样例：

- `OpenClaw gateway`
- `remote digestion`

结果：

- 可以命中 `memory/knowledge/openclaw_deploy.md`
- 可以命中 `memory/knowledge/vibe_os_digestion.md`

结论：

- **knowledge 召回可用**
- 对英文或中英混合关键词表现更稳定

### 4.2 历史项目疑虑 / 项目任务召回

样例：

- `remote digestion`
- `run_remote_digestion.mjs`
- `验证 remote runner`

结果：

- `remote digestion` 可以命中 digestion 设计知识
- `run_remote_digestion.mjs`、`验证 remote runner` 返回空

原因不是 QMD 坏了，而是当前白名单没有把：

- `memory/mission_log.md`

纳入索引。

结论：

- **历史项目知识召回部分可用**
- **历史任务/疑虑召回当前不完整**

### 4.3 用户偏好召回

样例：

- `AI Native`
- `Crypto Markdown`
- `Memory as File System`
- `减脂`

结果：

- `AI Native`、`Crypto Markdown`、`Memory as File System` 可以稳定命中 `MEMORY.md`
- `减脂` 这类中文短 query 返回空

结论：

- **用户偏好召回可用**
- 但在当前 `searchMode: "search"` 下，**中文短词召回明显偏弱**

---

## 5. 当前问题列表

需要开发机后续评估和开发的重点，不在本机直接做大改：

1. `searchMode: "search"` 对中文短 query 不够友好
2. 第一版白名单未纳入 `memory/mission_log.md`，导致历史任务/疑虑召回缺失
3. 当前只验证了第一版低噪音白名单，还没验证纳入 daily memory 后的召回收益与污染成本
4. `sqlite3` compile option warning 容易误导，需要以后持续以 runtime probe 为主

---

## 6. 推荐开发机工作项

开发机后续建议优先做这三件事：

### 6.1 search mode 对比实验

在开发机对比：

- `search`
- `query`
- 如有必要再看 `vsearch`

目标：

- 比较中文 query、英文 query、混合 query 的召回质量
- 明确是否值得为中文体验切到 `query`

### 6.2 索引白名单第二阶段设计

优先评估是否纳入：

- `memory/mission_log.md`
- `memory/YYYY-MM-DD.md`

继续明确不纳入：

- `memory/braindump.md`

目标：

- 补齐“历史任务/疑虑”召回
- 控制原始噪音污染

### 6.3 中文 query 评测集

建议在开发机构造一组小型评测 query：

- knowledge 类
- 项目疑虑类
- 用户偏好类

重点覆盖：

- 中文短 query
- 中英混合 query
- 原话命中
- 概念级命中

---

## 7. 当前结论

截至 2026-03-03，这轮 QMD enablement 可以下结论：

- 本机 live QMD 已跑通，可作为正式部署机继续使用
- 第一版路线正确：先索引 `MEMORY.md + knowledge`
- 当前最主要的后续优化点不是“能不能跑”，而是：
  - 中文 query 召回质量
  - 历史任务/疑虑覆盖面
  - 第二阶段索引白名单边界

这部分应转交开发机继续评估与开发。
