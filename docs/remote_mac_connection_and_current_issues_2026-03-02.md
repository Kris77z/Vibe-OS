# Remote Mac Connection And Current Issues 2026-03-02

本文记录 2026-03-02 当前 `vibe-os` 远程实例的可用状态、已验证结论、剩余问题，以及另一台 Mac 的连接方式。

文档文件路径：

- `/Users/kris/Desktop/Dev/Vibe-OS/docs/remote_mac_connection_and_current_issues_2026-03-02.md`

## 1. 当前状态

当前实例已经完成以下步骤：

- `scripts/deploy-remote-mac.sh` 已按最新 runbook 跑通
- OpenClaw gateway 已安装为后台 LaunchAgent
- gateway 正在运行
- Docker sandbox 已补齐并可用
- `memory.backend` 已从 `qmd` 改为 `builtin`
- `OPENCLAW_GATEWAY_TOKEN` 已生成并写入实例 `.env`
- 实例目录权限和缺失目录已由 `openclaw doctor --fix` 修复

当前实例路径：

- 实例根目录：`/Users/kris/instances/vibe-os`
- 配置文件：`/Users/kris/instances/vibe-os/config/openclaw.json`
- 环境变量文件：`/Users/kris/instances/vibe-os/state/.env`

当前连接标识：

- Host: `annkiMac.local`
- User: `kris`
- Tailscale IPv4: `100.69.219.29`
- Tailscale MagicDNS: `annkimac.tail7f9f42.ts.net`
- OpenClaw Gateway: `http://127.0.0.1:18789`
- OpenClaw Gateway Token: `92eb28a7f0c831faaf079067833e1a7e5770c6e6d68f53662f67f45659bf7383`

## 2. 已验证成功的部分

### 2.1 Gateway 本身可用

已验证：

- `openclaw gateway status` 返回 `Runtime: running`
- `openclaw gateway status` 返回 `RPC probe: ok`
- LaunchAgent 已加载并常驻

说明：

- OpenClaw gateway 本身没有挂
- 端口和本地服务侧没有阻塞问题

### 2.2 Sandbox 可用

已验证：

- 默认 sandbox 镜像 `openclaw-sandbox:bookworm-slim` 已存在
- `openclaw sandbox explain` 显示运行时为 `sandboxed`
- `mode = all`
- `scope = agent`

### 2.3 上游 relay 直连可用

已直接验证以下请求成功：

```bash
curl -sS https://ai.co.link/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-auth-key: <OPENAI_AUTH_KEY>" \
  -H "Authorization: Bearer dummy" \
  -d '{
    "model": "gpt-5.1",
    "messages": [{"role": "user", "content": "用一句中文回复：relay直连验证。"}]
  }'
```

结果：

- relay 正常返回
- `OPENAI_AUTH_KEY` 可用
- relay 地址和 `/chat/completions` 口径可用

## 3. 当前剩余问题

### 3.1 `/v1/responses` 403 已解决

当前已经验证以下请求成功：

```bash
curl -sS http://127.0.0.1:28789/v1/responses \
  -H "Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw:main",
    "input": "用一句中文回复：连接验证。",
    "stream": false
  }'
```

说明：

- 本机通过 SSH tunnel 访问远程 gateway 成功
- OpenClaw 再调上游 relay 成功
- 之前记录的 `403 forbidden` 已经不是当前问题

### 3.2 Raycast 前端链路已验证成功

当前已经在本机 Raycast development 模式下验证成功：

- `Ask Vibe-OS`
- `Dump to Vibe-OS`
- `Rewrite with Vibe-OS`

说明：

- 当前桌面主入口已经不再依赖 `SuperCmd`
- 远程 OpenClaw + 本地 Raycast 的主线路已经闭环

### 3.3 Telegram allowlist 仍有一条非阻塞告警

`gateway status` / `doctor` 当前仍提示：

- `channels.telegram.groupPolicy = "allowlist"` 但 `groupAllowFrom` 为空

影响：

- 只影响 Telegram 群消息接收策略
- 不影响当前远程 gateway 连通性

### 3.4 仓库里仍有若干非主线文档未处理

说明：

- 这不影响当前远程实例运行
- 主要是一些过程文档和后续整理项

## 4. 连接另一台 Mac 的正确方式

### 4.1 优先使用 Tailscale 建立 SSH 隧道

因为当前 gateway 绑定的是 `loopback`，另一台 Mac 不能直接访问公网地址，必须先建隧道：

```bash
ssh -N -L 28789:127.0.0.1:18789 kris@annkimac.tail7f9f42.ts.net
```

说明：

- `28789` 是本地映射端口
- 远端实际访问目标仍然是远程机器自己的 `127.0.0.1:18789`
- 如果 MagicDNS 不稳定，也可以直接用 Tailscale IP：

```bash
ssh -N -L 28789:127.0.0.1:18789 kris@100.69.219.29
```

### 4.2 在另一台 Mac 中填写的连接参数

在 Raycast 或其它接 OpenClaw 的客户端里，填写：

- Provider: `OpenClaw`
- Gateway Base URL: `http://127.0.0.1:28789`
- Gateway Token: 读取远程实例 `.env` 里的 `OPENCLAW_GATEWAY_TOKEN`
- Agent ID: `main`

其中 Token 文件位置：

- [`/Users/kris/instances/vibe-os/state/.env`](/Users/kris/instances/vibe-os/state/.env)

### 4.3 路径不要混淆

当前有两层路径，不能混在一起：

客户端访问 OpenClaw gateway：

- `http://127.0.0.1:28789/v1/responses`

OpenClaw 再访问上游 relay：

- `https://ai.co.link/openai/v1/chat/completions`

结论：

- 另一台 Mac 不应该直连 relay
- 另一台 Mac 应该连 OpenClaw gateway 的 `/v1/responses`
- 即使已经装好 Tailscale，只要 `gateway.bind = "loopback"`，也仍然应该通过 Tailscale 上的 SSH 隧道访问

## 5. 关键文件

实例配置：

- [`/Users/kris/instances/vibe-os/config/openclaw.json`](/Users/kris/instances/vibe-os/config/openclaw.json)

实例环境变量：

- [`/Users/kris/instances/vibe-os/state/.env`](/Users/kris/instances/vibe-os/state/.env)

部署 runbook：

- [`/Users/kris/Desktop/Dev/Vibe-OS/docs/vibe_os_remote_mac_deploy_runbook.md`](/Users/kris/Desktop/Dev/Vibe-OS/docs/vibe_os_remote_mac_deploy_runbook.md)

转发服务说明：

- [`/Users/kris/Desktop/Dev/Vibe-OS/docs/自定义转发服务配置说明.md`](/Users/kris/Desktop/Dev/Vibe-OS/docs/自定义转发服务配置说明.md)

问题记录：

- [`/Users/kris/Desktop/Dev/Vibe-OS/docs/archive/2026-03/remote_mac_deploy_issues_2026-03-02.md`](/Users/kris/Desktop/Dev/Vibe-OS/docs/archive/2026-03/remote_mac_deploy_issues_2026-03-02.md)

## 6. 当前可操作结论

如果你现在只想从另一台 Mac 连上这台远程机：

- 可以开始连
- gateway 通路已经没问题

如果你现在想真正跑出模型回答：

- 已经可以
- `OpenClaw -> relay -> Raycast` 当前主线路已验证通过
