# OpenClaw Memory 写入规范 v1

> 本文档承接 [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md) 当前主线。
> 上位方案见 [openclaw_memory_layer_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw_memory_layer_plan.md)。
> 官方 memory 模型见 [openclaw/docs/concepts/memory.md](/Users/jungle/Desktop/dev/vibe-os/openclaw/docs/concepts/memory.md)。

日期：2026-03-03

---

## 0. 目的

这份规范只解决一个问题：

- digestion 以后到底把内容写到哪里

目标不是设计复杂知识系统，而是让 Vibe-OS 稳定落到 OpenClaw 官方 memory 层：

- `MEMORY.md`
- `memory/YYYY-MM-DD.md`
- `memory/knowledge/*.md`
- `memory/mission_log.md`

---

## 1. 总原则

### 1.1 文件才是记忆本体

- Markdown 文件是 source of truth
- QMD 只是检索后端，不负责定义记忆结构

### 1.2 默认先进 daily memory

对 digestion 来说，默认落点不是 `MEMORY.md`，而是：

- `memory/YYYY-MM-DD.md`

原因：

- 大部分新增内容还不够稳定
- 先进入 daily memory，后续再决定是否晋升为长期记忆或专题知识

### 1.3 `MEMORY.md` 必须高门槛

`MEMORY.md` 只放下面三类：

- 长期稳定偏好
- 已确认的长期决策
- 反复出现、跨天仍成立的 durable facts

不满足这三类，就先不要写进 `MEMORY.md`。

### 1.4 `mission_log` 只保留任务视角

- TODO
- 跟进项
- 待验证事项

不要把它写成长期记忆主文件。

### 1.5 `knowledge` 只收专题化、可复用内容

只有当一段内容满足：

- 已经不是单日流水账
- 未来还能复用
- 适合归到某个主题文件

才进入 `memory/knowledge/*.md`。

---

## 2. 写入决策树

收到一条新增内容后，按下面顺序判断：

### Step 1. 它是不是用户行动项

如果是：

- 写 `memory/mission_log.md`

典型例子：

- 明天去跑 smoke test
- 要验证 remote runner
- 需要补告警 webhook

### Step 2. 它是不是最近几天会反复用到的上下文

如果是：

- 写 `memory/YYYY-MM-DD.md`

典型例子：

- 今天决定先停掉 `query`
- 这轮部署机验证发现 `search` 可用、`query` 超时
- 当前主线切到 OpenClaw 官方 memory 层

### Step 3. 它是不是跨天稳定成立的长期事实或偏好

如果是：

- 写 `MEMORY.md`

典型例子：

- 用户明确偏好极简、本地 Markdown、反黑盒数据库
- 项目长期原则是“先蒸馏，再索引，再召回”
- 当前长期桌面入口是 Raycast，不重做桌面端

### Step 4. 它是不是可复用专题知识

如果是：

- 写 `memory/knowledge/*.md`

典型例子：

- OpenClaw / QMD 的已验证运行结论
- digestion controller 的稳定设计结论
- 某个 AI Native 工作流方法论

### Step 5. 如果它同时满足多类

按下面优先级拆写，而不是只选一个：

1. 任务部分进 `mission_log`
2. 当天上下文进 `daily memory`
3. 已稳定的抽象结论进 `MEMORY.md` 或 `knowledge`

---

## 3. 四类文件的边界

### 3.1 `memory/braindump.md`

定位：

- 原始收件箱

规则：

- append-only
- 不重写
- 不作为 digestion 的输出目标
- 追加新 entry 时，如果文件末尾不是换行，先补换行，再写入新的时间戳记录

### 3.2 `memory/YYYY-MM-DD.md`

定位：

- 近期上下文层
- digestion 的默认输出面

应写入：

- 最近几天仍有价值的讨论结果
- 当天推进、风险、观察、结论
- 尚未稳定到长期层，但明显比原始 braindump 更干净的内容

不应写入：

- 纯原始情绪噪音
- 完全重复的任务清单
- 已经足够稳定、应直接进入 `MEMORY.md` 的长期事实

建议结构：

```md
# Daily Memory - 2026-03-03

## Active Context
- 当前主线从 QMD 调参转向 OpenClaw 官方 memory 层
- live QMD 保持 `search`

## Decisions
- 不继续把 `query` 当默认交互路径
- 不把 `braindump.md` 作为第一优先级索引源

## Risks / Watchpoints
- 中文短 query 仍偏弱
- daily memory 还没形成连续产出

## Promotion Candidates
- “Markdown 是 source of truth，QMD 只是检索后端”
```

### 3.3 `MEMORY.md`

定位：

- 长期稳定记忆层

应写入：

- 用户长期偏好
- 长期项目方向
- 跨天稳定成立的原则与决策

不应写入：

- 单日实验现象
- 临时 TODO
- 还没验证稳定的技术判断

v1 规则：

- digestion 不默认自动改写 `MEMORY.md`
- 只有在“高置信 durable memory”场景下才更新
- 更稳的方式是先写 daily memory，再在后续 promotion pass 晋升

### 3.4 `memory/knowledge/*.md`

定位：

- 专题沉淀层

应写入：

- 可复用的项目知识
- 某个主题下的结构化结论
- 比 daily memory 更抽象、但又不必进入 `MEMORY.md` 的专题内容

不应写入：

- 单条任务
- 单日流水账
- 纯用户偏好

建议命名：

- `memory/knowledge/openclaw-memory.md`
- `memory/knowledge/vibe-os-digestion.md`
- `memory/knowledge/ai-native.md`

### 3.5 `memory/mission_log.md`

定位：

- 任务与跟进项层

应写入：

- 待做事项
- 待确认事项
- follow-up

不应写入：

- 大段知识说明
- 长期偏好
- 整段项目背景

---

## 4. digestion v1.5 默认输出策略

从下一阶段开始，digestion 的默认输出策略调整为：

1. 先识别任务项
   - 追加到 `memory/mission_log.md`
2. 再抽当日上下文
   - 追加到 `memory/YYYY-MM-DD.md`
3. 再识别明确专题知识
   - 追加到 `memory/knowledge/*.md`
4. `MEMORY.md`
   - 先保持高门槛，不作为默认写入口

换句话说：

- `daily memory` 是默认出口
- `MEMORY.md` 是晋升层，不是收件层

---

## 5. 晋升规则

### 5.1 从 daily memory 晋升到 `MEMORY.md`

至少满足一条：

- 用户明确说“记住这个”
- 同一结论跨天重复出现
- 已经被项目实践验证，不再是临时判断

### 5.2 从 daily memory 晋升到 `knowledge`

至少满足一条：

- 能归到明确主题
- 后续可能被重复检索
- 内容已经能脱离当天语境独立成立

### 5.3 不晋升的内容

以下内容留在 daily memory 即可：

- 一次性观察
- 短期风险提醒
- 当天临时想法

---

## 6. 反例

下面这些写法是错的。

### 6.1 把当天实验细节直接塞进 `MEMORY.md`

错误原因：

- 它们可能只是单次现象

### 6.2 把项目背景、结论、TODO 全部堆进 `mission_log`

错误原因：

- 会把任务层写成低密度记忆垃圾场

### 6.3 把原始 braindump 直接复制到 daily memory

错误原因：

- 这没有完成蒸馏，只是换了文件名

---

## 7. 当前执行建议

文档先收口到这个口径：

1. 保持 live QMD 不动
2. digestion 下一步默认开始产出 `memory/YYYY-MM-DD.md`
3. `mission_log` 继续保留任务视角
4. `MEMORY.md` 先高门槛更新
5. `knowledge` 继续做专题沉淀

一句话：

**Vibe-OS 下一步不是继续调检索器，而是把新增内容先写对地方。**
