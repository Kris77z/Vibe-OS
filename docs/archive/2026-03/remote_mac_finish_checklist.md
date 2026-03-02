# Vibe-OS Remote Mac Finish Checklist

用途：给远程 Mac 上的 Codex / Claude 一份可以直接照着执行的收尾清单。

这份文档是 [vibe_os_remote_mac_deploy_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/vibe_os_remote_mac_deploy_runbook.md) 的执行版，不重复解释架构背景，只保留必须动作。

## 1. 执行约束

- 不要改架构。
- 不要把 `gateway.bind` 改成 `lan`。
- 不要安装或启用 `qmd`。
- `memory.backend` 必须保持为 `builtin`。
- 保持 Docker sandbox 开启。
- 如果命令失败，先保留原始报错，再做最小修复，不要大改配置。

## 2. 目标路径

假设部署机实际用户是 `kris`，实例路径如下：

```text
/Users/kris/instances/vibe-os/
```

如果实际用户名不是 `kris`，把下面命令里的路径替换成真实路径。

## 3. 准备环境变量

在部署机开一个终端，执行：

```bash
export OPENCLAW_PROFILE=vibe-os
export OPENCLAW_STATE_DIR=/Users/kris/instances/vibe-os/state
export OPENCLAW_CONFIG_PATH=/Users/kris/instances/vibe-os/config/openclaw.json
export OPENCLAW_GATEWAY_TOKEN="$(awk -F= '$1=="OPENCLAW_GATEWAY_TOKEN"{print $2}' "$OPENCLAW_STATE_DIR/.env")"
```

## 4. 先检查配置

确认 memory backend：

```bash
rg -n 'backend' "$OPENCLAW_CONFIG_PATH"
```

要求：

- `memory.backend` 是 `builtin`

如果仍然是 `qmd`，把配置改成：

```json5
memory: {
  backend: "builtin",
  citations: "auto"
}
```

再确认 sandbox 镜像存在：

```bash
docker image inspect openclaw-sandbox:bookworm-slim >/dev/null
```

如果不存在，按最小补齐方案执行：

```bash
docker pull debian:bookworm-slim
docker tag debian:bookworm-slim openclaw-sandbox:bookworm-slim
docker run --rm openclaw-sandbox:bookworm-slim bash -lc 'echo sandbox-ok'
```

## 5. 前台启动 gateway

仍在部署机第一个终端里执行：

```bash
openclaw gateway --port 18789
```

保持这个终端不退出。

## 6. 第二终端验证

在部署机打开第二个终端，重新设置同样的环境变量：

```bash
export OPENCLAW_PROFILE=vibe-os
export OPENCLAW_STATE_DIR=/Users/kris/instances/vibe-os/state
export OPENCLAW_CONFIG_PATH=/Users/kris/instances/vibe-os/config/openclaw.json
export OPENCLAW_GATEWAY_TOKEN="$(awk -F= '$1=="OPENCLAW_GATEWAY_TOKEN"{print $2}' "$OPENCLAW_STATE_DIR/.env")"
```

先做运行状态检查：

```bash
openclaw gateway status
openclaw sandbox explain
```

通过标准：

- `openclaw gateway status` 显示 `RPC probe: ok`
- `openclaw sandbox explain` 显示 `mode = all`
- 没有 Docker / sandbox runtime 错误

## 7. 黑盒写盘测试

在第二终端执行：

```bash
openclaw agent --agent main --message "刚想到一个切点：远程部署机已准备开始接管 vibe-os。"
```

通过标准：

- 返回很短，不像客服
- `memory/braindump.md` 被追加
- 有时间戳

可直接检查：

```bash
tail -n 20 /Users/kris/instances/vibe-os/workspace/memory/braindump.md
```

## 8. Responses API 验证

非流式：

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

流式：

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

- 非流式返回 `200` 和合法 JSON
- 流式返回 `text/event-stream`
- 流式末尾能看到 `response.completed`
- 流式末尾有 `[DONE]`

## 9. 安装后台服务

前面的检查都通过后，在第二终端执行：

```bash
openclaw gateway install --force
openclaw gateway status
openclaw doctor --repair
```

目标：

- `gateway install --force` 成功
- `gateway status` 仍然正常
- `doctor --repair` 修复缺失目录或权限问题

## 10. 本机连接方式

在你的主力 Mac 上执行：

```bash
ssh -N -L 18789:127.0.0.1:18789 kris@<remote-mac>
```

然后让 SuperCmd 使用：

```text
Gateway Base URL: http://127.0.0.1:18789
Gateway Token:    远程机 state/.env 里的 OPENCLAW_GATEWAY_TOKEN
Agent ID:         main
```

## 11. 执行后汇报格式

远程 Codex / Claude 完成后，至少汇报：

- 实际实例路径
- 实际 workspace 路径
- 实际 config 路径
- 实际 state 路径
- `memory.backend` 当前值
- sandbox 镜像是否存在
- `openclaw gateway status` 结果
- `openclaw sandbox explain` 结果
- 黑盒写盘是否成功
- 非流式 Responses 是否成功
- 流式 Responses 是否成功
- `openclaw doctor --repair` 结果
- 是否已安装 launchd 服务
- 任何阻塞点
