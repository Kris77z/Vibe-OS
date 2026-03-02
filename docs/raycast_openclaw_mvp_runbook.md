# Raycast x OpenClaw MVP Runbook

目标：在当前开发机上，把 `raycast-vibe-os` 扩展接到已经跑通的远程 `OpenClaw` 实例。

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

## 5. 填扩展 Preferences

打开扩展设置后，填这三项：

- `Gateway Base URL`
- `Gateway Token`
- `Agent ID`

建议值：

```text
Gateway Base URL: http://127.0.0.1:28789
Agent ID: main
```

## 6. 命令验收

### Ask Vibe-OS

输入：

```text
只回四个字：测试成功
```

通过标准：

- 能返回正常回答

### Dump To Vibe-OS

输入一段随手想法。

通过标准：

- 能返回简短确认句
- 不展开闲聊

### Rewrite With Vibe-OS

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
