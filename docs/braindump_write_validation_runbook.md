# Braindump 写盘验证 Runbook

> 用途：验证 Raycast `倾倒到 Vibe-OS` 是否真的把内容追加写入远程部署机的 `memory/braindump.md`。
> 日期：2026-03-03

这个 runbook 只解决一个问题：

```text
Raycast Dump
  -> local SSH tunnel
    -> remote OpenClaw /v1/responses
      -> agent main
        -> append memory/braindump.md
```

如果这条链路不成立，后续 digestion 不要继续推进。

当前状态：

- 2026-03-03 已通过远程本地 API 验证
- 2026-03-03 已通过 Raycast 实测验证
- 2026-03-04 已完成本机 Raycast live E2E 双次追加写入验证（部署机落盘确认）
- 本文档后续主要用于回归检查，而不是首次验证

---

## 0. 通过标准

一次验证通过，必须同时满足：

1. Raycast `倾倒到 Vibe-OS` 返回极简确认句
2. 远程部署机的真实 workspace 文件新增目标文本
3. 新增内容带时间戳
4. 内容写入的是 `memory/braindump.md`，不是其他路径

---

## 1. 前提条件

执行前先确认：

- 远程 OpenClaw gateway 已在部署机上运行
- 本机 Raycast 扩展 `raycast-vibe-os` 可正常打开
- 你持有可用的 gateway token
- 本机到部署机的 SSH / Tailscale 通路正常

建议参数：

- `baseUrl = http://127.0.0.1:28789`
- `agentId = main`

---

## 2. 建立本机 tunnel

在本机终端执行：

```bash
ssh -N -L 28789:127.0.0.1:18789 kris@annkimac.tail7f9f42.ts.net
```

这条命令需要保持挂起。

如果你已经有长期可用的 tunnel，可以跳过这一步。

---

## 3. 先做 API 级预检

不要一上来就怪 Raycast。

先在本机另一个终端执行：

```bash
curl -sS http://127.0.0.1:28789/v1/responses \
  -H "Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw:main",
    "input": "用一句中文回复：braindump 写盘预检。",
    "stream": false
  }'
```

通过标准：

- 返回 `200`
- 返回合法 JSON
- `output` 中能看到正常文本

如果这里不通，先修 tunnel / token / gateway，不要继续做 Raycast 验证。

---

## 4. 准备唯一验证文本

为了避免和历史内容混淆，先准备一段唯一文本。

建议直接用：

```text
测试写盘：第一缕意识注入 2026-03-03 21:00
```

如果你在别的时间执行，也建议把时间改成实际时间，但保留足够唯一的关键词。

---

## 5. 记录远程文件验证前状态

SSH 到部署机，先看写盘前的尾部内容：

```bash
ssh kris@annkimac.tail7f9f42.ts.net
tail -n 20 /Users/kris/instances/vibe-os/workspace/memory/braindump.md
```

目的：

- 确认目标文件路径正确
- 记住写盘前末尾内容
- 避免把旧内容误判成新写入

如果这里提示文件不存在，先不要继续 Dump，先修 workspace 路径问题。

---

## 6. 执行 Raycast Dump

在 Raycast 里运行 `倾倒到 Vibe-OS`。

输入第 4 步准备好的唯一文本：

```text
测试写盘：第一缕意识注入 2026-03-03 21:00
```

预期行为：

- Raycast 很快返回极简确认句
- 窗口自动收起
- 不展开长对话

如果这里直接报错，记下报错内容，转到“失败排查”章节。

---

## 7. 检查远程文件是否新增

再次 SSH 到部署机，执行：

```bash
tail -n 40 /Users/kris/instances/vibe-os/workspace/memory/braindump.md
```

或者更明确地搜唯一文本：

```bash
grep -n "第一缕意识注入 2026-03-03 21:00" /Users/kris/instances/vibe-os/workspace/memory/braindump.md
```

通过标准：

- 能搜到唯一文本
- 文本出现在新增区域
- 同一条记录里能看见时间戳

如果 `grep` 没结果，再手动 `tail` 一次确认，不要只凭一次 grep 就下结论。

---

## 8. 可选：用远程 CLI 做二次交叉验证

如果你怀疑问题在 Raycast transport，而不是 Agent 写盘能力，可以在部署机上直接做一次 CLI 黑盒写盘测试。

参考 [vibe_os_remote_mac_deploy_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/vibe_os_remote_mac_deploy_runbook.md#L215) 的思路执行，但要用部署机上的真实 runtime 路径，而不是照抄旧路径。

```bash
cd <部署机上的 openclaw runtime 目录>
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/kris/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/kris/instances/vibe-os/config/openclaw.json \
openclaw agent --agent main --message "测试写盘：CLI 二次交叉验证 2026-03-03"
```

如果 CLI 能写盘，但 Raycast 不能，问题大概率在：

- Raycast Dump instruction contract
- Raycast 请求参数
- Raycast 请求到 gateway 的模式差异

如果 CLI 也不能写盘，问题大概率在：

- Agent 工具能力
- workspace 路径
- sandbox 挂载
- `AGENTS.md` 加载

---

## 9. 结果判定

### 2026-03-03 本次验证结果

结果：通过

已确认：

- 远程本地 API 可触发 `main` agent 写入 `braindump.md`
- Raycast `倾倒到 Vibe-OS` 可实际写入远程 workspace

本次可定位到的新增样例：

```text
[2026-03-03 22:00] 测试写盘：Codex 远程 API 验证 2026-03-03 22:00
[2026-03-03T00:00:00] 3月3号，我狠狠测一下你
```

附带观察：

- Raycast 侧等待响应仍偏慢
- 时间戳格式目前存在不一致，后续应继续观察

### 2026-03-04 本次验证结果

结果：通过

已确认：

- 部署机写入器脚本路径固定为 `/Users/kris/Desktop/Dev/Vibe-OS/scripts/append_braindump_entry.mjs`
- 写入脚本参数契约为 `--file`（不是 `--workspace-root`）
- 部署机非交互 shell 下 `node` 不在 `PATH`，但 fallback 到 `/opt/homebrew/bin/node` 可稳定写入
- 本机 Raycast `倾倒到 Vibe-OS` 连续两次成功，部署机 `memory/braindump.md` 新增：
  - `[2026-03-04T06:12:39Z] e2e 测试 01`
  - `[2026-03-04T06:12:44Z] e2e 测试 01`

### 判定为通过

满足以下全部条件时，才能算通过：

- Raycast Dump 返回短确认句
- 远程 `memory/braindump.md` 可见新增唯一文本
- 有时间戳
- 内容落在正确 workspace 路径

通过后，下一步才进入：

1. Raycast instruction contract 收口
2. Digestion MVP 设计与实现

### 判定为失败

以下任一情况都算失败：

- Raycast 报错
- Raycast 返回确认句，但远程文件无新增
- 文本被写到错误文件
- 文件新增了内容，但没有目标文本

失败后不要直接跳去做 digestion。

---

## 10. 失败排查顺序

按顺序查，别并发乱试：

1. tunnel 是否还活着
2. gateway token 是否正确
3. 远程 workspace 路径是否正确
4. Agent 是否具备文件写入工具
5. Docker sandbox 挂载是否覆盖 `memory/`
6. `AGENTS.md` 是否被正确加载
7. Dump instruction 是否过于模糊，只让模型“说已保存”

如果需要确认 `AGENTS.md` 是否生效，可以先用 Ask 做一次行为探测，而不是直接问“你的系统提示词是什么”。

更稳的探测方式是发一个明显应该触发 braindump 模式的输入，看它是否仍然长篇回复。

---

## 11. 建议记录格式

为了后面追踪，建议把这次验证结果按下面格式记在临时笔记里：

```text
Braindump Write Validation
Date: 2026-03-03
Tunnel: pass / fail
API preflight: pass / fail
Raycast dump reply: <实际返回>
Remote file append: pass / fail
Timestamp present: yes / no
Conclusion: pass / fail
Notes: <异常信息>
```

这样后面排查不会只剩一句“好像测过了”。
