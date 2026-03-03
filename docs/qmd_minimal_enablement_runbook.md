# QMD 最小接入 Runbook

> 本文档是 [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md) 阶段四的可执行子 runbook，配合 [qmd_enablement_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_enablement_plan.md) 使用。
> 目标：先把部署机依赖检查、QMD 最小启动验证、配置切换方案收成一条最短可执行路径。

日期：2026-03-03

---

## 0. 先说结论

当前最小可执行 QMD 接入路径应该是：

1. 在部署机先做依赖 preflight，不改线上配置
2. 用独立脚本对 `qmd` 本体做最小 smoke test，不经过 Telegram，不重做 Raycast
3. 配置切换时显式白名单索引 `MEMORY.md` 和 `memory/knowledge/**/*.md`
4. 第一版不要用 `includeDefaultMemory = true`
5. 通过后再把 OpenClaw `memory.backend` 从 `builtin` 切到 `qmd`

原因很直接：

- 历史真坑是 `spawn qmd ENOENT`
- 当前 `includeDefaultMemory = true` 会把 `memory/**/*.md` 全收进去，等于把 `braindump.md` 也索引了
- 这和 [cali_twitter_analysis.md](/Users/jungle/Desktop/dev/vibe-os/docs/cali_twitter_analysis.md) 的“先蒸馏，再索引”路线冲突

---

## 1. 仓库内已确认的真实状态

- 当前实例模板仍以 `memory.backend = "builtin"` 为默认口径：
  [openclaw.vibe-os.instance.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.example.json5)
- 仓库里存在早期 QMD 模板，但默认写法会把默认 memory 全纳入索引：
  [openclaw.local.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/openclaw.local.example.json5)
- 历史排障已明确出现过 `spawn qmd ENOENT`：
  [remote_mac_deploy_issues_2026-03-02.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/remote_mac_deploy_issues_2026-03-02.md)
- OpenClaw 官方 QMD 后端默认集合会包含：
  - `MEMORY.md`
  - `memory.md`
  - `memory/**/*.md`
  依据：
  [backend-config.ts](/Users/jungle/Desktop/dev/vibe-os/openclaw/src/memory/backend-config.ts)

所以，Vibe-OS 第一版切 QMD 时，不应该直接沿用 `includeDefaultMemory = true`。

---

## 2. 最小实施方案

### Step 1. 部署机依赖检查

在部署机 workspace 根目录执行：

```bash
scripts/check_qmd_prereqs.sh \
  --workspace-root /Users/openclaw-svc/instances/vibe-os/workspace \
  --state-dir /Users/openclaw-svc/instances/vibe-os/state
```

通过标准：

- `openclaw`、`bun`、`qmd`、`sqlite3` 可执行
- workspace 关键文件存在
- state dir 可写
- SQLite 编译选项里包含 `ENABLE_LOAD_EXTENSION`，或至少被脚本标记为需补 Homebrew sqlite

### Step 2. QMD 最小启动验证

仍然先不改 OpenClaw 主配置，直接验证 QMD 本体能否在 OpenClaw 未来会使用的 agent state 下工作：

```bash
scripts/qmd_smoke_test.sh \
  --workspace-root /Users/openclaw-svc/instances/vibe-os/workspace \
  --state-dir /Users/openclaw-svc/instances/vibe-os/state \
  --agent-id main
```

这个 smoke test 会：

- 使用 `state/agents/main/qmd/` 下的 agent-scoped XDG 目录
- 只创建两类 collection：
  - `MEMORY.md`
  - `memory/knowledge/**/*.md`
- 执行一次 `qmd update`
- 执行一次 `qmd search --json`
- 打印实际 index 路径和 collection 名称

通过标准：

- 不出现 `spawn qmd ENOENT`
- `qmd collection add` 成功或可幂等跳过
- `qmd update` 成功
- `qmd search --json` 成功返回
- index 文件落在：
  `/Users/openclaw-svc/instances/vibe-os/state/agents/main/qmd/xdg-cache/qmd/index.sqlite`

### Step 3. 配置切换

不要直接改当前 builtin 模板，改用单独的 QMD overlay 片段：

- [openclaw.vibe-os.instance.qmd-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-overlay.example.json5)

切换原则：

1. `memory.backend = "qmd"`
2. `includeDefaultMemory = false`
3. 用 `paths[]` 显式白名单索引范围
4. 第一版只索引：
   - `MEMORY.md`
   - `memory/knowledge/**/*.md`
5. `searchMode` 先用 `search`
6. `waitForBootSync` 保持 `false`

### Step 4. OpenClaw 切换后验证

把 overlay 合入部署机实例配置后，按现有实例方式重启 gateway，再执行：

```bash
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/openclaw-svc/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/openclaw-svc/instances/vibe-os/config/openclaw.json \
openclaw memory status --agent main --deep
```

```bash
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/openclaw-svc/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/openclaw-svc/instances/vibe-os/config/openclaw.json \
openclaw memory search --agent main --query "Vibe-OS"
```

通过标准：

- `memory status` 显示 backend 为 `qmd`
- index 文件非空
- `memory search` 能返回 `MEMORY.md` 或 `memory/knowledge/` 片段
- gateway 启动日志里不再出现 `spawn qmd ENOENT`

### Step 5. Rollback 方案

如果 QMD 启动或召回质量不过关，直接回滚到：

```json5
memory: {
  backend: "builtin",
  citations: "auto"
}
```

然后重启 gateway。

回滚原则：

- 不动 Raycast
- 不动 Telegram
- 不回头重做 digestion
- 只回退 memory backend

---

## 3. 第一版配置白名单

第一版建议只开这两块：

```text
MEMORY.md
memory/knowledge/**/*.md
```

后续第二阶段再评估：

```text
memory/YYYY-MM-DD.md
```

第一版明确不作为主索引源：

```text
memory/braindump.md
```

---

## 4. 为什么不用 `includeDefaultMemory = true`

OpenClaw 当前默认集合解析逻辑会把整个 `memory/**/*.md` 都纳入 collection。

这在通用产品里没问题，但在 Vibe-OS 当前阶段会直接带来两个副作用：

1. `braindump.md` 被一起索引
2. digestion 尚未沉淀完的原始噪音会污染召回

所以 Vibe-OS 第一版的正确姿势不是“开默认集合”，而是“关默认集合，然后显式声明高密度路径”。

---

## 5. 推荐切换顺序

1. 先在部署机跑 `scripts/check_qmd_prereqs.sh`
2. 再跑 `scripts/qmd_smoke_test.sh`
3. smoke test 通过后，把 QMD overlay 合入实例配置
4. 重启 gateway
5. 跑 `openclaw memory status --deep`
6. 跑一轮真实检索样例
7. 观察 24 小时后，再决定是否纳入 `memory/YYYY-MM-DD.md`

---

## 6. 本文档输出物

和本文档配套的新增资产：

- [check_qmd_prereqs.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/check_qmd_prereqs.sh)
- [qmd_smoke_test.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/qmd_smoke_test.sh)
- [openclaw.vibe-os.instance.qmd-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-overlay.example.json5)

总蓝图索引回链：

- [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md)
