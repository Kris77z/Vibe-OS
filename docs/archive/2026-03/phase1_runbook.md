# Phase 1 Runbook

目标：在不接 Telegram、不改 SuperCmd 的前提下，先跑通 Vibe-OS 的后端最小闭环，验证 Agent 能否遵守根目录 `AGENTS.md`，并将脑洞倾倒追加到 `memory/braindump.md`。

> 当前文档按“开发机模式”编写：本机只做开发和最小验证，不承担长期常驻服务。

## 0. 当前约定

- OpenClaw 引擎源码目录：`/Users/jungle/Desktop/dev/vibe-os/openclaw`
- Vibe-OS Workspace 目录：`/Users/jungle/Desktop/dev/vibe-os`
- Workspace 主协议：`/Users/jungle/Desktop/dev/vibe-os/AGENTS.md`
- 长期记忆主文件：`/Users/jungle/Desktop/dev/vibe-os/MEMORY.md`

## 1. 准备 OpenClaw 配置

将样例文件 [openclaw.local.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.local.example.json5) 的内容复制到：

```text
~/.openclaw/openclaw.json
```

至少确认以下项正确：

- `agents.defaults.workspace` 指向 `/Users/jungle/Desktop/dev/vibe-os`
- `agents.defaults.repoRoot` 指向 `/Users/jungle/Desktop/dev/vibe-os`
- `agents.defaults.skipBootstrap` 为 `true`
- `agents.defaults.model.primary` 已替换成你本地可用的模型

如果你暂时不测 Telegram，保持 `channels.telegram.enabled: false` 即可。对于开发机，这是推荐状态。

## 2. 安装并启动 Gateway（仅用于开发验证）

在 `openclaw/` 目录执行：

```bash
pnpm install
pnpm gateway:watch
```

如果你不需要热重载，也可以直接前台启动：

```bash
pnpm openclaw gateway
```

## 3. 做健康检查

启动后在 `openclaw/` 目录执行：

```bash
pnpm openclaw status
pnpm openclaw health
```

目标状态：

- Gateway 正常启动
- 配置文件已加载
- Workspace 路径指向 `/Users/jungle/Desktop/dev/vibe-os`

## 4. 执行第一次黑盒写盘测试

仍在 `openclaw/` 目录，执行一次 Agent 回合：

```bash
pnpm openclaw agent --agent main --message "刚想到一个切点：先用 CLI 验证 braindump 追加，再接 Telegram。"
```

验证标准：

1. 终端返回的是一句很短的回应，而不是客服式长回复。
2. [braindump.md](/Users/jungle/Desktop/dev/vibe-os/memory/braindump.md) 追加了一条新记录。
3. 新记录包含原始输入和明确时间戳。

如果第 1 条失败，优先检查根目录 [AGENTS.md](/Users/jungle/Desktop/dev/vibe-os/AGENTS.md) 是否被正确加载。
如果第 2 条或第 3 条失败，优先检查 Agent 是否拥有对 Workspace 的写权限，以及实际使用的 Workspace 路径是否正确。

## 5. 通过后再做什么

只有在 CLI 黑盒写盘通过后，才进入下一个动作：

1. 继续 SuperCmd 对接或接口改造开发
2. 将 Workspace 和 `~/.openclaw/openclaw.json` 迁移到后续部署机
3. 在部署机上打开 Telegram Channel 配置并完成正式闭环验证

当前机器上不需要为此长期保持 Gateway 常驻。
