# QMD Enablement Plan

> 本文档承接 [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md) 的阶段四。

> 目标：在不破坏当前 `builtin + digestion + launchd` 可用链路的前提下，将 Vibe-OS 升级到符合 [cali_twitter_analysis.md](/Users/jungle/Desktop/dev/vibe-os/docs/cali_twitter_analysis.md) 的长期记忆检索架构。
> 日期：2026-03-03

> 实机验证与问题沉淀见：
> [qmd_live_validation_findings_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_live_validation_findings_2026-03-03.md)
>
> 第二阶段实验计划见：
> [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)
>
> 当前主线已从 QMD 调参转向官方 memory 层落盘，见：
> [openclaw_memory_layer_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw_memory_layer_plan.md)

---

## 0. 为什么现在切 QMD

当前这一步不是“为了上向量库而上向量库”，而是因为主线前提已经满足：

- `braindump.md` 已跑通 append-only 收集
- `digestion` 已能把原始输入蒸馏成 `mission_log / knowledge / state`
- `launchd` 与失败观察面已跑通

这意味着现在已经具备“先蒸馏、再索引”的条件，符合 [cali_twitter_analysis.md](/Users/jungle/Desktop/dev/vibe-os/docs/cali_twitter_analysis.md) 里反对“原始废话全量向量化”的原则。

---

## 1. 当前真实状态

当前 live 口径：

- 部署机实例已切到 `memory.backend = "qmd"`
- live 白名单当前只索引 `MEMORY.md` 与 `memory/knowledge/**/*.md`
- `searchMode = "search"`
- `digestion` 继续通过 controller runner 驱动
- 远程桌面主入口仍是 Raycast

保留的 fallback / 历史基线：

- `builtin` 仍是可回滚的安全基线

现状依据：

- [openclaw.vibe-os.instance.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.example.json5)
- [phase_c_and_digestion_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/phase_c_and_digestion_plan.md)
- [qmd_minimal_enablement_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_minimal_enablement_runbook.md)
- [qmd_live_validation_findings_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_live_validation_findings_2026-03-03.md)

历史痕迹：

- 仓库里留有早期 `qmd` 配置模板 [openclaw.local.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/openclaw.local.example.json5)
- 部署排障文档里曾出现 `spawn qmd ENOENT`，说明此前卡点是依赖未装，而不是路线错误，见 [remote_mac_deploy_issues_2026-03-02.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/remote_mac_deploy_issues_2026-03-02.md)

---

## 2. QMD 的目标边界

这一阶段只解决一件事：

- 把长期记忆检索层从 `builtin` 升级为 `qmd`

这一阶段不做：

- Telegram 正式接入
- 新前端入口
- 重新设计 digestion 输出格式
- 一次性全量重构所有 memory 文件布局

---

## 3. 索引策略

QMD 不应该一上来就全量吞 `braindump.md`。

### 3.1 第一优先级：高密度长期记忆

优先索引：

- `MEMORY.md`
- `memory/knowledge/**/*.md`

原因：

- 这部分信息密度最高
- 噪音最低
- 最接近“长期可召回知识块”

### 3.2 第二优先级：结构化日记 / digest

后续索引：

- `memory/YYYY-MM-DD.md`

前提：

- 这类 daily memory 文件先真实存在
- 格式比原始 `braindump.md` 更规整

### 3.3 谨慎处理原始 braindump

不建议第一版就全量索引：

- `memory/braindump.md`

如果要加，也建议：

- 只索引有限时间窗口
- 或者先切分导出为更稳定的 daily slices

---

## 4. 技术前提

参考 OpenClaw 官方 memory 文档：

- [memory.md](/Users/jungle/Desktop/dev/vibe-os/openclaw/docs/concepts/memory.md#L125)

部署机需要满足：

1. `qmd` CLI 已安装并在 `PATH`
2. Bun 可用
3. SQLite 扩展能力可用
4. OpenClaw state dir 可写

最小配置口径：

```json5
memory: {
  backend: "qmd",
  citations: "auto",
  qmd: {
    searchMode: "search",
    includeDefaultMemory: false,
    update: {
      interval: "5m",
      onBoot: true,
      waitForBootSync: false,
      embedInterval: "60m"
    },
    limits: {
      maxResults: 6,
      timeoutMs: 4000
    },
    scope: {
      default: "allow",
      rules: [
        { action: "deny", match: { chatType: "group" } },
        { action: "deny", match: { chatType: "channel" } }
      ]
    },
    paths: [
      { name: "memory-root", path: ".", pattern: "MEMORY.md" },
      { name: "knowledge", path: "memory/knowledge", pattern: "**/*.md" }
    ]
  }
}
```

注意：

- `includeDefaultMemory = false` 是第一版推荐值
- 否则 OpenClaw 默认集合会把 `memory/**/*.md` 也纳入索引，等于把 `braindump.md` 一起吃进去
- QMD 默认 scope 会让 CLI `openclaw memory search` 变得不可测；当前 live 口径改为 `default: "allow"`，再显式拒绝 `group / channel`
- 正式切换前先用 [qmd_minimal_enablement_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_minimal_enablement_runbook.md) 跑完依赖检查和 smoke test

---

## 5. 建议实施顺序

### Step 1

在部署机安装 `qmd`，并确认 `qmd` 命令可执行。

先跑：

```bash
scripts/check_qmd_prereqs.sh \
  --workspace-root /Users/openclaw-svc/instances/vibe-os/workspace \
  --state-dir /Users/openclaw-svc/instances/vibe-os/state
```

### Step 2

先在部署机本地做一次最小 QMD 启动验证：

- OpenClaw 不切主配置
- 只验证 `qmd` 二进制和依赖完整
- 只索引 `MEMORY.md` 和 `memory/knowledge/**/*.md`

对应脚本：

```bash
scripts/qmd_smoke_test.sh \
  --workspace-root /Users/openclaw-svc/instances/vibe-os/workspace \
  --state-dir /Users/openclaw-svc/instances/vibe-os/state \
  --agent-id main
```

### Step 3

复制一份实例配置，切成：

- `memory.backend = "qmd"`

并只索引低噪音范围。

配置片段见：

- [openclaw.vibe-os.instance.qmd-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-overlay.example.json5)

### Step 4

验证以下四件事：

1. Gateway 启动不报 `spawn qmd ENOENT`
2. `memory_search` 返回结果且 backend 标识为 `qmd`
3. 首次 boot sync 不阻塞主服务过久
4. QMD 失败时 builtin fallback 行为符合预期

### Step 5

再做一轮真实检索用例：

- 用户偏好
- 一周前的项目疑虑
- 某个长期主题的历史脉络

当前状态：

- 上述 baseline 步骤已在部署机真实跑通
- 下一阶段重点不再是“切不切得上 QMD”，而是：
  - `search` vs `query` 的中文召回质量
  - 是否纳入 `memory/mission_log.md`
  - 是否纳入 `memory/YYYY-MM-DD.md`

---

## 6. 验收标准

- [x] 部署机 `qmd` CLI 已安装可执行
- [x] OpenClaw 实例可用 `memory.backend = "qmd"` 正常启动
- [x] `memory_search` 已实际通过 QMD 返回结果
- [x] `knowledge / MEMORY` 的 baseline 召回已验证可用
- [x] QMD 出错时不会打断主服务可用性

未完成但已转入后续阶段的问题：

- [ ] 中文短 query 召回质量优化
- [ ] `mission_log` 是否纳入索引
- [ ] daily memory 是否纳入索引

当前 disposition：

- `QMD enablement` 这件事已完成基线收口
- `query` 不适合当前 live 默认路径
- 后续不再继续扩自定义 retrieval 架构
- 下一阶段主问题改为：让 digestion 稳定写入 OpenClaw 官方 memory 层，再基于这些更干净的 memory source 做最小验证

---

## 7. 风险与注意事项

### 风险一：把原始 braindump 全量索引

后果：

- 噪音上升
- 召回污染
- 违背 Cali 文档的蒸馏原则

### 风险二：把 QMD 切换和 Telegram 接入绑在一起

后果：

- 排障面变大
- 无法分清是 memory 还是 channel 问题

### 风险三：首次模型下载/索引耗时

后果：

- 误判成“QMD 卡死”

建议：

- 先做一次部署机本地 warm-up
- 单独记录首次耗时

---

## 8. 本阶段输出物

完成这一阶段后，至少要补齐：

- 部署机依赖检查脚本
- QMD 最小启动验证脚本
- QMD 配置切换 runbook
- 实例配置 overlay 示例

当前已补：

- [check_qmd_prereqs.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/check_qmd_prereqs.sh)
- [qmd_smoke_test.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/qmd_smoke_test.sh)
- [qmd_minimal_enablement_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_minimal_enablement_runbook.md)
- [openclaw.vibe-os.instance.qmd-overlay.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.qmd-overlay.example.json5)
- [qmd_live_validation_findings_2026-03-03.md](/Users/jungle/Desktop/dev/vibe-os/docs/archive/2026-03/qmd_live_validation_findings_2026-03-03.md)
- [qmd_phase2_experiment_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_phase2_experiment_plan.md)

- 一份部署机 QMD 安装 runbook
- 一份 QMD 切换验证记录
- 更新主文档 [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md)

这样后面回看时，才能看到：

- 为什么现在切 QMD
- QMD 索引了什么
- QMD 没索引什么
- 当前是否已真正切换完成
