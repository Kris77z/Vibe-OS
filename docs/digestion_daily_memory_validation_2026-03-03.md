# Digestion Daily Memory Validation

日期：2026-03-03

## 目的

验证 digestion v1.5 新口径是否已经能在 live instance 上真实产出 `memory/YYYY-MM-DD.md`，同时保持：

- 不改 Telegram
- 不改 Raycast
- 不继续改 QMD `query`
- 不继续碰 `mission_log` 白名单

## 结果

验证已通过。

live instance 上新增文件：

- `memory/2026-03-03.md`

同时确认：

- `mission_log.md` 仍保持任务视角
- `MEMORY.md` 未被改写
- `digestion_state.json` 已推进到本轮新增条目之后
- 复跑 `node scripts/digestion_mvp.mjs prepare` 返回 `noop`

## 本轮暴露的问题

### 1. braindump 换行边界会影响增量识别

live `braindump.md` 中有一条历史记录没有以换行结束，导致第一条 validation entry 被拼进旧记录，`prepare` 最初未识别为新条目。

这说明：

- `braindump.md` 的 append-only 没问题
- 但追加写入时必须保证 entry 边界清晰

### 2. agent 返回结果仍未完全贴合 `task_result_v1`

本轮 gateway 返回的 `status = ok`，也确实写出了 daily memory，但 JSON 结构仍有偏差：

- `artifacts` 被写成对象，而不是数组
- `actions` 被写成字符串数组，而不是带 `type` 的对象数组
- `memoryWrites` 使用了自定义字段组合，而不是 contract 中的 `target + reason`

结论：

- 写盘能力已成立
- 结构化 contract 仍需继续收口

### 3. knowledge 文件命名需要强约束

本轮 agent 额外产出了：

- `memory/knowledge/vibe-os-digestion.md`

而 workspace 中原本已有：

- `memory/knowledge/vibe_os_digestion.md`

这说明如果不明确限制，agent 会为同主题生成两种命名风格。

本轮处理：

- 已把内容合并回 `vibe_os_digestion.md`
- 已删除重复的连字符版本
- 仓库 prompt 已补 snake_case 约束

## 遗留问题与处理口径

### A. `task_result_v1` 仍未做到 machine-strict

当前状态：

- prompt 已补“严格输出 contract”约束
- 但尚未再次完成一轮 live 验证，证明 agent 一定会持续返回完全合法的 schema

开发口径：

- 后续优先继续收口返回结果格式
- 在返回 contract 稳定前，不把这层结果当成强依赖自动化接口

### B. braindump 追加器需要保证 entry 前后边界

当前状态：

- 这轮已确认：如果上一条记录末尾没有换行，新 entry 可能被并入旧 entry

开发口径：

- 所有 braindump 写入口都应保证“必要时先补换行，再追加新记录”
- 这应视为 append discipline 的一部分，而不是临时修补

### C. live workspace 已包含 validation 痕迹

当前状态：

- `memory/2026-03-03.md` 中包含本轮验证写入的 daily memory 内容
- `memory/braindump.md` 中保留了本轮 validation 条目

处理口径：

- 这些内容属于真实运行期间产生的验证痕迹，不在本轮清理范围内
- 后续如果要做 memory 内容清洗，应单独作为一次显式操作处理，不在这轮代码收口里顺手修改

## 当前结论

这轮之后，可以确认两件事：

1. digestion 主线已经从“只写 `mission_log + knowledge`”推进到“默认产出 daily memory”
2. 下一步应该继续收口返回 contract，而不是回头继续折腾 QMD 检索参数

一句话：

**daily memory 落盘已经通了，接下来该收的是结果协议，不是检索器。**
