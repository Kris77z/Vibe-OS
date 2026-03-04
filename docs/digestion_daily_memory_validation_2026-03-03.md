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
- 2026-03-04 已在部署机做了一轮本地实测，返回结果通过同口径校验（`valid = true`）
- 但还需要更多轮次观察，确认不是偶发正确

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

## 2026-03-04 复测记录（部署机本地）

### 背景

- 当天尝试直接执行 `node scripts/run_remote_digestion.mjs run` 仍被默认 SSH key 卡住：
  - `~/.ssh/id_ed25519_vibe_os_deploy` 在这台机不存在
- 因此改用部署机本地等价链路验证：
  - 本机 gateway `/v1/responses`
  - live workspace `memory/` 直接检查
  - 本地运行与 `run_remote_digestion.mjs` 同口径的 `task_result_v1` 校验逻辑

### 实测结果

1. braindump 黏连复测
   - 新增 `2026-03-04 09:52:00` 条目后，落盘为独立新行，没有再黏连到前一条
   - 但历史黏连记录（2026-03-03 10:21 + 20:45 拼接）仍保留在旧内容中

2. 新风险：dump 写入出现“覆盖成单条”现象
   - 紧接着再写 `2026-03-04 09:53:30` 条目时，`braindump.md` 一度被覆盖为只剩最新一条
   - 已在 live 现场恢复已知条目，并保留备份：
     - `memory/braindump.md.bak.2026-03-04-verify`
   - 这说明 append discipline 虽有改进，但写入路径仍存在高风险回归

3. digestion + contract 校验复测
   - 恢复后 `prepare` 正常识别新增区间（第 5 行）
   - 本轮 digestion 返回为严格数组结构：
     - `artifacts: []`
     - `actions: []`
     - `memoryWrites: []`
     - `nextActions: []`
     - `errors: []`
   - 用 controller 同口径校验后结果为：
     - `valid: true`
     - `errors: []`

4. 游标推进与复跑
   - 已执行 `commit --end-line 5`
   - `digestion_state.json` 当前为 `lastProcessedLine = 5`
   - 复跑 `prepare` 返回 `noop`

### 结论更新

- 正向：`task_result_v1` 至少在这轮实测里已达到 machine-valid
- 负向：braindump dump 模式仍存在“覆盖成单条”的高风险行为，优先级应高于 contract 优化

## Dump Append Stress Test（2026-03-04）

### 测试目标

- 在最新代码（包含 commit `61027b5`）下，验证统一写入器 `append_braindump_entry.mjs` 的本地稳定性
- 确认 Raycast dump 侧已切到统一写入器路径（只做配置与代码检查，不做 Raycast UI 交互）
- 给出连续 dump 压测数据、`wc -c` 每轮变化、首尾 tail 样本与验收结论

### 本地冒烟

测试文件：

- `/tmp/vibe-os-dump-stress/braindump.md`

初始状态（人为制造“末尾无换行”）：

- `wc -c = 43`
- 内容：`[seed] legacy line without trailing newline`（无末尾换行）

冒烟命令：

```bash
node scripts/append_braindump_entry.mjs \
  --file /tmp/vibe-os-dump-stress/braindump.md \
  --content 'smoke test: unified writer local append'
```

冒烟结果：

- 返回 `status: ok`
- `beforeBytes: 43`
- `afterBytes: 107`
- 文件最终按行表现正常，说明“末尾补换行再追加”逻辑生效

### Raycast dump 配置检查（只检查）

已确认：

- `raycast-vibe-os/src/dump-to-vibe-os.tsx` 已调用 `appendBraindumpEntry(...)`
- `raycast-vibe-os/src/lib/braindump-writer.ts` 已通过 SSH 执行统一脚本：
  - `${remoteWorkspaceRoot}/scripts/append_braindump_entry.mjs`
- `raycast-vibe-os/package.json` 已暴露 dump 专用配置项：
  - `dumpSshTarget`
  - `dumpSshKeyPath`
  - `dumpRemoteWorkspaceRoot`
  - `dumpSshConnectTimeoutSec`

### 连续 dump 压测（20 轮）

压测输入：

- 每轮内容模板：`stress round XX: append discipline and size monotonic check`
- 总轮次：20

验收标准：

1. 每轮 `afterBytes > beforeBytes`
2. 每轮 `wc -c` 与写入器返回 `afterBytes` 一致
3. 新条目独立成行，不黏连上一行
4. 全轮次无报错

汇总结果：

- `allDeltaPositive = true`
- `allWcMatchAfter = true`
- `min_delta = 83`
- `max_delta = 83`
- 总增量：`1660 bytes`

每轮数据（`wc -c` 变化）：

| round | before | after | delta | wc_after | wc_match |
| --- | ---: | ---: | ---: | ---: | :--- |
| 1 | 107 | 190 | 83 | 190 | true |
| 2 | 190 | 273 | 83 | 273 | true |
| 3 | 273 | 356 | 83 | 356 | true |
| 4 | 356 | 439 | 83 | 439 | true |
| 5 | 439 | 522 | 83 | 522 | true |
| 6 | 522 | 605 | 83 | 605 | true |
| 7 | 605 | 688 | 83 | 688 | true |
| 8 | 688 | 771 | 83 | 771 | true |
| 9 | 771 | 854 | 83 | 854 | true |
| 10 | 854 | 937 | 83 | 937 | true |
| 11 | 937 | 1020 | 83 | 1020 | true |
| 12 | 1020 | 1103 | 83 | 1103 | true |
| 13 | 1103 | 1186 | 83 | 1186 | true |
| 14 | 1186 | 1269 | 83 | 1269 | true |
| 15 | 1269 | 1352 | 83 | 1352 | true |
| 16 | 1352 | 1435 | 83 | 1435 | true |
| 17 | 1435 | 1518 | 83 | 1518 | true |
| 18 | 1518 | 1601 | 83 | 1601 | true |
| 19 | 1601 | 1684 | 83 | 1684 | true |
| 20 | 1684 | 1767 | 83 | 1767 | true |

首尾两段 tail 输出：

首段（轮次 1 后）：

```text
[seed] legacy line without trailing newline
[2026-03-04T03:48:41Z] smoke test: unified writer local append
[2026-03-04T03:49:13Z] stress round 01: append discipline and size monotonic check
```

尾段（轮次 20 后）：

```text
[2026-03-04T03:49:14Z] stress round 13: append discipline and size monotonic check
[2026-03-04T03:49:14Z] stress round 14: append discipline and size monotonic check
[2026-03-04T03:49:14Z] stress round 15: append discipline and size monotonic check
[2026-03-04T03:49:14Z] stress round 16: append discipline and size monotonic check
[2026-03-04T03:49:14Z] stress round 17: append discipline and size monotonic check
[2026-03-04T03:49:14Z] stress round 18: append discipline and size monotonic check
[2026-03-04T03:49:14Z] stress round 19: append discipline and size monotonic check
[2026-03-04T03:49:14Z] stress round 20: append discipline and size monotonic check
```

验收结论：

- **PASS（限定范围）**
- 本次 PASS 仅覆盖“统一写入器本地链路”（`append_braindump_entry.mjs`）
- 仍缺一轮“Raycast UI -> live workspace braindump.md”的端到端压测，完成后才算 dump 写盘链路完全收尾

## 当前结论

这轮之后，可以确认三件事：

1. digestion 主线已经从“只写 `mission_log + knowledge`”推进到“默认产出 daily memory”
2. 统一写入器本地链路已经稳定，能满足 append-only 的核心验收口径
3. 但 live E2E（Raycast UI 真实写盘）还没完成，下一步应先补这一轮再继续收口 contract

一句话：

**daily memory 落盘已通，统一写入器本地已稳；当前首要动作是补完 Raycast live E2E 写盘验收，再继续收口结果协议。**
