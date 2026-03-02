# Vibe-OS Remote Mac Deploy Runbook

目标：把 `vibe-os` 作为**独立 OpenClaw 实例**部署到另一台常驻 Mac，并达到可开始联调和常驻运行的状态。

适用前提：

- 这台 Mac 将承担长期运行职责
- `vibe-os` 是其中一个项目实例
- 当前只落地 `vibe-os`，不同时处理其它项目实例

## 1. 部署目标

这次部署要同时满足：

1. `vibe-os` 拥有独立 workspace
2. `vibe-os` 拥有独立 state dir / config / token / logs
3. gateway 开放 `/v1/responses`
4. SuperCmd 可以通过远程地址连到它
5. 后续可以直接挂 launchd 常驻

## 2. 推荐部署布局

假设服务用户是 `openclaw-svc`：

```text
/Users/openclaw-svc/runtime/openclaw/                # OpenClaw runtime
/Users/openclaw-svc/instances/vibe-os/               # 实例根目录
/Users/openclaw-svc/instances/vibe-os/workspace/     # vibe-os workspace
/Users/openclaw-svc/instances/vibe-os/state/         # sessions / logs / creds / .env
/Users/openclaw-svc/instances/vibe-os/config/openclaw.json
```

建议：

- 使用专用服务账号，不要直接复用日常开发账号
- `vibe-os` 单独占用端口 `18789`
- `gateway.bind` 先保持 `loopback`
- 远程访问优先走 Tailscale / SSH tunnel

## 3. 部署前准备

部署机至少具备：

- Node.js
- pnpm
- OpenClaw runtime
- Docker Desktop 或可用的 Docker Engine
- 一个已登录 GUI session 的 macOS 用户

注意：

- `openclaw gateway install` 在 macOS 上依赖 GUI session
- 纯 SSH / headless 上直接安装 launchd 很容易翻车
- 当前 `vibe-os` 模板默认启用 Docker sandbox

## 3.1 构建 sandbox 镜像

在 OpenClaw runtime 根目录执行：

```bash
cd /Users/openclaw-svc/runtime/openclaw
./scripts/sandbox-setup.sh
```

预期：

- Docker 可正常工作
- 本地已构建 `openclaw-sandbox:bookworm-slim`

当前 `vibe-os` 模板已禁用 browser 工具，所以暂时不需要构建 browser sandbox 镜像。

## 4. 初始化实例目录

在部署机拿到仓库后，先执行：

```bash
cd /path/to/vibe-os
scripts/bootstrap-vibe-os-instance.sh \
  --instance-root /Users/openclaw-svc/instances/vibe-os \
  --workspace-root /Users/openclaw-svc/instances/vibe-os/workspace
```

这个脚本会准备：

- `workspace/`
- `state/`
- `config/openclaw.json`
- `state/.env`
- `vibe-os.instance.yaml`

参考文件：

- [bootstrap-vibe-os-instance.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/bootstrap-vibe-os-instance.sh)
- [openclaw.vibe-os.instance.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.example.json5)
- [vibe-os.instance.yaml](/Users/jungle/Desktop/dev/vibe-os/docs/instances/vibe-os.instance.yaml)

## 5. 同步 workspace

把当前仓库中的以下内容同步到部署机实例 workspace：

- [AGENTS.md](/Users/jungle/Desktop/dev/vibe-os/AGENTS.md)
- [MEMORY.md](/Users/jungle/Desktop/dev/vibe-os/MEMORY.md)
- [memory/](/Users/jungle/Desktop/dev/vibe-os/memory)

如果部署机上的 workspace 就是该仓库 checkout，也可以直接把 `workspace_root` 指向该 checkout 根目录。

要求：

- `AGENTS.md` 位于 workspace 根目录
- `MEMORY.md` 位于 workspace 根目录
- `memory/braindump.md`、`memory/mission_log.md` 可写

## 6. 配置实例

编辑：

- `config/openclaw.json`
- `state/.env`

至少确认以下项：

1. `gateway.port = 18789`
2. `gateway.bind = "loopback"`
3. `gateway.http.endpoints.responses.enabled = true`
4. `gateway.auth.token = "${OPENCLAW_GATEWAY_TOKEN}"`
5. `agents.defaults.workspace` 指向实例 workspace
6. `tools.fs.workspaceOnly = true`
7. `tools.elevated.enabled = false`
8. `sandbox.mode = "all"`
9. `sandbox.docker.image = "openclaw-sandbox:bookworm-slim"`
10. `sandbox.docker.network = "none"`

`.env` 至少填写：

```text
OPENCLAW_GATEWAY_TOKEN=replace-with-long-random-token
OPENAI_AUTH_KEY=...
```

当前 `vibe-os` 模板默认上游是你们的 GPT relay：

- `baseUrl = https://ai.co.link/openai/v1`
- 协议 = OpenAI-compatible `chat/completions`
- 鉴权头 = `x-auth-key`
- 默认模型 = `gpt-5.1`

如果部署时地址变化，再改 `models.providers.openai-relay.baseUrl`。

当前 `vibe-os` sandbox 口径：

- 所有 tool execution 进 Docker sandbox
- `scope = "agent"`
- `workspaceAccess = "rw"`
- `docker.network = "none"`
- browser / canvas / automation / nodes 仍然禁用

## 7. 前台启动验证

先不要急着装 launchd。先前台验证：

```bash
cd /Users/openclaw-svc/runtime/openclaw
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/openclaw-svc/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/openclaw-svc/instances/vibe-os/config/openclaw.json \
openclaw gateway --port 18789
```

另开一个终端做健康检查：

```bash
cd /Users/openclaw-svc/runtime/openclaw
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/openclaw-svc/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/openclaw-svc/instances/vibe-os/config/openclaw.json \
openclaw gateway status
```

目标状态：

- `Runtime: running`
- `RPC probe: ok`

再执行：

```bash
cd /Users/openclaw-svc/runtime/openclaw
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/openclaw-svc/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/openclaw-svc/instances/vibe-os/config/openclaw.json \
openclaw sandbox explain
```

目标：

- 显示 `mode = all`
- 显示当前 session 为 sandboxed
- 没有 Docker / sandbox runtime 错误

## 8. CLI 黑盒写盘测试

仍然用同一组环境变量，执行一次 agent 回合：

```bash
cd /Users/openclaw-svc/runtime/openclaw
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/openclaw-svc/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/openclaw-svc/instances/vibe-os/config/openclaw.json \
openclaw agent --agent main --message "刚想到一个切点：远程部署机已准备开始接管 vibe-os。"
```

验证：

1. 返回很短，不像客服
2. `memory/braindump.md` 被追加
3. 有时间戳

## 9. Responses API 验证

### 9.1 非流式

```bash
curl -sS http://127.0.0.1:18789/v1/responses \
  -H "Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw:main",
    "input": "用一句话回答：你是谁？",
    "stream": false
  }'
```

通过标准：

- 返回 `200`
- 返回合法 JSON

### 9.2 流式

```bash
curl -N http://127.0.0.1:18789/v1/responses \
  -H "Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw:main",
    "input": "测试流式输出，只回一句短话。",
    "stream": true
  }'
```

通过标准：

- `Content-Type` 带 `text/event-stream`
- 能看到 `response.output_text.delta`
- 末尾有 `response.completed`
- 末尾有 `[DONE]`

## 10. 安装 launchd 服务

前台验证通过后，再安装：

```bash
cd /Users/openclaw-svc/runtime/openclaw
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/openclaw-svc/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/openclaw-svc/instances/vibe-os/config/openclaw.json \
openclaw gateway install --force
```

然后检查：

```bash
cd /Users/openclaw-svc/runtime/openclaw
OPENCLAW_PROFILE=vibe-os \
OPENCLAW_STATE_DIR=/Users/openclaw-svc/instances/vibe-os/state \
OPENCLAW_CONFIG_PATH=/Users/openclaw-svc/instances/vibe-os/config/openclaw.json \
openclaw gateway status
```

这里的 `OPENCLAW_PROFILE=vibe-os` 主要用于：

- 固定 LaunchAgent label 为 `ai.openclaw.vibe-os`
- 让后续 `status / restart / stop` 命令始终打到同一个服务标签

真正隔离边界仍然由以下显式路径决定：

- `OPENCLAW_STATE_DIR`
- `OPENCLAW_CONFIG_PATH`
- workspace 路径

## 11. SuperCmd 联调

部署机准备完成后，开发机上的 SuperCmd 填：

1. `Provider = OpenClaw`
2. `Gateway Base URL = 远端部署机可达地址`
3. `Gateway Token = OPENCLAW_GATEWAY_TOKEN`
4. `Agent ID = main`

不要误填本机 `127.0.0.1`，除非你正在走 SSH tunnel。

## 12. 推荐远程访问方式

### 12.1 Tailscale

如果两台 Mac 在同一 tailnet：

- 直接使用部署机 tailnet IP 或域名
- 仍然保留 token auth

### 12.2 SSH Tunnel

如果先不想暴露端口：

```bash
ssh -N -L 18789:127.0.0.1:18789 user@remote-mac
```

此时开发机上的 SuperCmd 可以临时填：

```text
http://127.0.0.1:18789
```

## 13. 上线前检查清单

- workspace 路径正确
- `AGENTS.md` 已加载
- `MEMORY.md` 已加载
- `braindump.md` 可写
- `/v1/responses` 已开启
- token 生效
- 非流式 curl 成功
- 流式 curl 成功
- `openclaw gateway status` 正常
- launchd 安装成功
- SuperCmd 首轮和二轮上下文都正常

## 14. 当前不做的事

这份 runbook 暂时不覆盖：

- Telegram 正式接入
- 定时 digestion 任务上线
- 多项目统一编排
- 容器化隔离

这些后面再单独做，不和 `vibe-os` 首次部署绑一起。
