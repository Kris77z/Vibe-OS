# Raycast x OpenClaw MVP Runbook

目标：在当前开发机上，把 `raycast-vibe-os` 扩展接到已经跑通的远程 `OpenClaw` 实例。

## 0. 当前验证状态

截至 2026-03-02，这条链路已经在本机实测通过：

- `问问 Vibe-OS` 成功返回
- `倾倒到 Vibe-OS` 改为 SSH 直写 `memory/braindump.md`，并返回本地短确认句
- `用 Vibe-OS 改写` 成功返回改写结果

因此这份 runbook 现在不只是计划文档，也是当前可复用的成功路径。

## 1. 前提

- 远程 `OpenClaw gateway` 已可用
- 本机已安装 `Raycast`
- 本机可通过 `Tailscale + SSH` 访问部署机

当前建议连接参数：

- `baseUrl = http://127.0.0.1:28789`
- `agentId = main`

## 2. 建立 SSH Tunnel

在本机执行：

```bash
ssh -N -L 28789:127.0.0.1:18789 kris@annkimac.tail7f9f42.ts.net
```

这条命令应保持挂起。

## 3. 本机直连验证

在另一个本机终端执行：

```bash
curl -sS http://127.0.0.1:28789/v1/responses \
  -H "Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"model":"openclaw:main","input":"用一句中文回复：Raycast 前置验证。","stream":false}'
```

如果这里不通，不要继续折腾 Raycast。

## 4. 启动 Raycast 扩展开发

在仓库根目录执行：

```bash
cd raycast-vibe-os
npm install
npm run dev
```

说明：

- `raycast-vibe-os/.npmrc` 已固定使用官方 npm registry，避免继承全局 `npmmirror` 导致 Raycast 依赖安装卡住。
- `npm run dev` 成功后，Raycast 应该能看到这三个命令：
  - `问问 Vibe-OS`
  - `倾倒到 Vibe-OS`
  - `用 Vibe-OS 改写`

## 5. 填扩展 Preferences

打开扩展设置后，填以下字段：

- `Gateway Base URL`
- `Gateway Token`
- `Agent ID`
- `Dump SSH Target`
- `Dump SSH Key Path`
- `Dump Workspace Root`
- `Dump SSH Timeout Sec`

建议值：

```text
Gateway Base URL: http://127.0.0.1:28789
Agent ID: main
Dump SSH Target: kris@annkimac.tail7f9f42.ts.net
Dump SSH Key Path: ~/.ssh/id_ed25519_vibe_os_deploy
Dump Workspace Root: /Users/kris/instances/vibe-os/workspace
Dump SSH Timeout Sec: 8
```

## 6. 命令验收

### 问问 Vibe-OS

输入：

```text
只回四个字：测试成功
```

通过标准：

- 能返回正常回答

### 倾倒到 Vibe-OS

输入一段随手想法。

通过标准：

- 能返回简短确认句
- 远程 `memory/braindump.md` 文件大小单调增长
- 新条目独立成行，不黏连旧条目

### 用 Vibe-OS 改写

输入原文和改写要求。

通过标准：

- 返回纯文本结果
- 不寒暄
- 不带 Markdown 包装

## 7. 当前边界

- 当前版本默认走非流式 `/v1/responses`
- 不接 Raycast 内置 AI
- 不做 Telegram 管理
- 不做复杂本地会话管理
