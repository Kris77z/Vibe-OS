# OpenClaw 官方 Memory 层推进计划

> 本文档承接 [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md) 当前主线。
> QMD enablement 已完成基线，相关收口见 [qmd_enablement_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/qmd_enablement_plan.md)。
> 官方 memory 模型说明见 [openclaw/docs/concepts/memory.md](/Users/jungle/Desktop/dev/vibe-os/openclaw/docs/concepts/memory.md)。
> 写入边界规范见 [openclaw_memory_write_spec.md](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw_memory_write_spec.md)。

日期：2026-03-03

---

## 0. 为什么主线切到这里

当前已经确认：

- 部署机 `memory.backend = "qmd"` 已 live
- `searchMode = "search"` 可用
- `query` 在当前 live 条件下不适合做默认交互路径
- `mission_log` 整文件纳入虽然有增益，但不值得继续扩成自定义复杂架构

这说明当前主问题已经不是“QMD 能不能跑”，而是：

- Vibe-OS 该把什么内容稳定写进官方 memory 层
- digestion 应该如何把原始倾倒蒸馏成长期记忆与近期上下文

按 OpenClaw 官方模型，Markdown 文件本身才是记忆源，QMD 只是检索后端。

因此后续主线不再是继续发明新的 retrieval 架构，而是把写盘层收敛到官方 memory 模型。

---

## 1. 当前判断

### 1.1 不需要更重的记忆架构

当前需求还不需要引入 `memU` 这类更重的 agentic memory infrastructure。

原因：

- 当前输入源仍以 Markdown 为主
- 当前主要目标是个人大脑，不是多 agent 共享基础设施
- 当前瓶颈在写入层不够稳定，而不是索引系统不够复杂

### 1.2 也不需要继续自定义 QMD 中间层

暂不继续推进：

- `task-memory` 自定义导出层
- `mission_log` 特殊权重控制
- 超出 OpenClaw 官方配置面的 QMD 调参

保留的官方能力面只有：

- `memory.backend = "qmd"`
- `memory.qmd.searchMode`
- `memory.qmd.includeDefaultMemory`
- `memory.qmd.paths`
- `memory.qmd.scope`
- `memory.qmd.limits / update`

---

## 2. Vibe-OS 的目标 memory 分层

后续统一按下面四层推进：

### 2.1 原始收件箱：`memory/braindump.md`

职责：

- append-only 原始倾倒
- 不作为第一优先级索引源

规则：

- 不重写历史内容
- 不做长期记忆主读取面

### 2.2 长期记忆：`MEMORY.md`

职责：

- 放长期稳定事实、偏好、决策、持续有效的项目判断

典型内容：

- 用户偏好
- 长期项目方向
- 反复验证过的工作流规则

### 2.3 近期上下文：`memory/YYYY-MM-DD.md`

职责：

- 放最近几天仍可能反复被提到的上下文
- 作为 daily memory 层承接 digestion 的日常沉淀

典型内容：

- 最近讨论过但还不够资格进 `MEMORY.md` 的事项
- 最近几天的项目推进脉络
- 短期有效的提醒、风险、观察

### 2.4 专题沉淀：`memory/knowledge/*.md`

职责：

- 放长线专题知识与项目专题结论

典型内容：

- AI Native
- Crypto Markdown
- Vibe-OS / OpenClaw 相关专题

### 2.5 任务面：`memory/mission_log.md`

职责：

- 保持任务与跟进项视角
- 继续作为 digestion 的任务输出面

规则：

- 不把它视为默认长期记忆主层
- 是否进入 QMD live 白名单，后续只在官方 memory 层稳定后再看

---

## 3. 当前缺口

当前真正没收好的不是 QMD，而是写盘目标：

1. digestion 目前更偏 `mission_log + knowledge`
2. `memory/YYYY-MM-DD.md` 还没有稳定产出
3. `MEMORY.md` 的写入口径还没单独写清楚
4. 因为 daily memory 层缺失，QMD 现在只能在长期层上工作

所以目前的召回问题，本质上是 memory source 不完整，而不是检索器本身一定不够强。

---

## 4. 接下来怎么推进

### Step 1. 写清 memory 写入规范

先把三类输出边界写死：

- 什么进 `MEMORY.md`
- 什么进 `memory/YYYY-MM-DD.md`
- 什么进 `memory/knowledge/*.md`

对应文档：

- [openclaw_memory_write_spec.md](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw_memory_write_spec.md)

原则：

- 长期稳定才进 `MEMORY.md`
- 最近几天有用但未沉淀的内容进 daily memory
- 专题化、可复用知识进 `knowledge`

### Step 2. 调整 digestion 产出目标

digestion 下一阶段不再只围绕：

- `mission_log`
- `knowledge`

而是要稳定产出：

- `memory/YYYY-MM-DD.md`
- 必要时更新 `MEMORY.md`
- 继续维护 `knowledge`
- 继续维护 `mission_log`

### Step 3. 保持当前 QMD baseline 不乱动

在 memory 层没有稳定前：

- 保持 `memory.backend = "qmd"`
- 保持 `searchMode = "search"`
- 不继续折腾 `query`
- 不把 `braindump.md` 纳入主索引

### Step 4. 等 daily memory 稳定后再做最小验证

等 `memory/YYYY-MM-DD.md` 连续真实产出几天后，再做一轮最小实验：

- baseline：`MEMORY.md + knowledge`
- candidate：`MEMORY.md + knowledge + daily memory`

这一轮只验证一件事：

- daily memory 是否带来短期上下文召回增益，且不会明显污染结果

---

## 5. 当前明确不做

- 不重开 `query` 默认化实验
- 不把 `braindump.md` 全量向量化
- 不围绕 `mission_log` 发明新的中间 memory 架构
- 不引入 `memU` 这类更重系统
- 不把 Telegram 拉回当前主线
- 不回头重做 Raycast

---

## 6. 预期产物

这一阶段收口时，应至少得到：

1. 一份稳定的 memory 写入规范
2. 一版 digestion 输出改造方案
3. 连续几天真实产出的 `memory/YYYY-MM-DD.md`
4. 一轮基于官方 memory 层的 daily memory 纳入验证结论

一句话：

**QMD 现在算基础设施收尾，下一阶段真正要做的是把 Vibe-OS 的 digestion 输出，稳定写进 OpenClaw 官方 memory 层。**
