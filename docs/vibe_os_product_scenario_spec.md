# Vibe-OS 产品场景与 MVP 规格

这份文档用于统一三类信息：

- [README.md](/Users/jungle/Desktop/dev/vibe-os/README.md) 里的产品愿景
- [implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md) 里的工程落地路径
- [cali_twitter_analysis.md](/Users/jungle/Desktop/dev/vibe-os/docs/cali_twitter_analysis.md) 里的记忆系统第一性原理

它不是新的蓝图，而是对当前真实需求场景的一次收束。

## 1. 一句话定义

Vibe-OS 是一个持续在线的个人外脑：

- 前台负责零阻力收集灵感碎片
- 后台负责自动整理、任务提纯和长期记忆沉淀
- 在需要时，能把你自己早已忘掉的上下文重新递回来

## 2. 当前真实需求场景

当前最重要的不是“做一个很炫的 AI 启动器”，而是解决以下四类高频场景。

### 2.1 随时倾倒

目标：

- 在脑内出现一个想法时，几乎零阻力地把它扔进去
- 不打断心流
- 不要求先分类、命名、整理

典型例子：

- 一个产品切点
- 一句交易观察
- 一条健身感受
- 一个看似不成熟的碎片灵感

系统行为：

- 直接收下
- 追加写入 `memory/braindump.md`
- 返回极短确认句

这就是当前桌面端最核心的入口。

### 2.2 任务调度

目标：

- 不靠手工整理 braindump
- 让 AI 自动从碎片里识别行动项

系统行为：

- 定期读取 `memory/braindump.md`
- 提取 TODO、跟进项、待确认事项
- 更新 `memory/mission_log.md`

这不是一个前台命令，而是后台自动整理能力。

### 2.3 深入分析

目标：

- 当你不是“倾倒”，而是真的要借脑子时，系统能基于已有上下文帮你判断下一步

典型例子：

- `这周我们做什么更合适？`
- `帮我想想最近哪些切点更值得追。`
- `我们之前关于这个方向聊到哪了？`

系统行为：

- 读取当前问题
- 结合 `MEMORY.md`
- 检索 `memory/` 里的历史切片
- 组织成推演式回答

这就是当前问答入口的职责。

### 2.4 长期知识提取

目标：

- 让早期零散抱怨、观察、灵感，在几周或几个月后仍然能被召回
- 不只是“搜得到”，而是“在合适语境里被递回来”

典型例子：

两个月后你在聊出海电商赛道，你问：

`帮我想想出海电商的痛点。`

系统不只给泛泛答案，还能补一句：

`你在 2 月 20 号抱怨过“发票转存很难搞”，如果你要做 B2B 支付或企业服务，这可能是一个切入点。`

这类能力依赖的是：

- 历史 braindump 的持续保留
- 后台提炼和索引
- 检索时的上下文融合

这正是 [cali_twitter_analysis.md](/Users/jungle/Desktop/dev/vibe-os/docs/cali_twitter_analysis.md) 里强调的“主动状态唤醒”。

## 3. 当前产品抽象

结合以上场景，Vibe-OS 当前可以抽成两层。

### 3.1 前台两类核心动作

严格说，当前 MVP 只需要两类主命令：

1. `倾倒`
2. `发问`

它们分别对应：

- `倾倒` -> 随时倾倒
- `发问` -> 深入分析 / 检索 / 调脑子

`改写` 这类能力可以保留为增强功能，但不是当前需求闭环的核心。

### 3.2 后台两类核心能力

后台必须逐步补齐两类能力：

1. `自动整理`
2. `长期召回`

它们分别对应：

- `自动整理` -> 任务调度
- `长期召回` -> 长期知识提取

## 4. 当前架构映射

当前实际落地架构已经非常清晰：

```text
Raycast
  -> SSH Tunnel (127.0.0.1:28789)
    -> Remote OpenClaw Gateway
      -> Workspace / MEMORY / braindump / mission_log
      -> Relay / LLM
      -> Docker sandbox
```

角色分工：

- `Raycast`：桌面前台壳
- `OpenClaw`：大脑 runtime
- `memory/braindump.md`：碎片收件箱
- `memory/mission_log.md`：任务整理结果
- `memory/knowledge/`：长期沉淀区

## 5. 与 README 的关系

[README.md](/Users/jungle/Desktop/dev/vibe-os/README.md) 说的是愿景：

- 无感倾倒
- 无声消化
- 长期记忆唤醒

这份文档把愿景进一步压成了可执行定义：

- 前台先做两类主动作
- 后台补自动整理和长期召回

所以 README 不算错，但它还偏概念层。

## 6. 与 Implementation Plan 的关系

[implementation_plan.md](/Users/jungle/Desktop/dev/vibe-os/docs/implementation_plan.md) 说的是工程阶段：

1. 跑通 OpenClaw
2. 接桌面入口
3. 再做 digestion / QMD / Telegram

这份文档给出的补充是：

- 阶段二不再执着于 `SuperCmd`
- 当前桌面入口已经由 `Raycast` 接住
- MVP 判断标准不再是“前端炫不炫”，而是四类核心场景有没有被覆盖

## 7. 当前 MVP 是否已完成

如果按“前台 MVP”来判断，当前已经基本完成：

- `倾倒` 已通
- `发问` 已通
- 远程 OpenClaw 已通
- Raycast 已通

如果按“完整系统 MVP”来判断，还没有完全完成。

还缺的关键部分是：

- braindump -> mission log 的自动整理
- 更稳定的长期知识提取链路
- 后续 QMD / 索引 / Telegram 的正式接入

所以更准确的说法是：

- `桌面输入 MVP`：已完成
- `个人外脑系统 MVP`：已完成前半段，后台自动化仍待补齐

## 8. 下一步建议

接下来最合理的节奏不是继续扩桌面命令，而是补后台。

优先级建议：

1. 明确 `倾倒` 和 `发问` 作为两类主命令的长期口径
2. 设计 braindump 自动整理到 `mission_log.md` 的调度链路
3. 设计长期知识沉淀和召回规则
4. 最后再讨论 `改写` 是否保留为第三命令
