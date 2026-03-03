# Remote Digestion Launchd Runbook

> 目标：把控制器侧 `run_remote_digestion.mjs` 挂成稳定的本地定时任务，而不是继续依赖 OpenClaw 内建 cron 的 agent 直写。
> 日期：2026-03-03

---

## 0. 为什么不用内建 cron 直接写

2026-03-03 已验证：

- OpenClaw 内建 cron 的 scheduler 能正常工作
- `cron status / list / run` 都可用
- isolated session job 也能成功执行

但同一轮验证也发现：

- agent 直写 `memory/mission_log.md` 时，append discipline 不够稳定
- 实际出现过 `mission_log.md` 被压缩成只剩新条目的风险

所以当前正式路径改为：

```text
launchd
  -> scripts/run_remote_digestion.sh
    -> scripts/run_remote_digestion.mjs
      -> 远程 gateway
        -> agent 只负责 digestion 提炼
          -> controller 负责推进 digestion_state
```

这样做的好处：

- 定时器稳定
- 入口固定
- `digestion_state.json` 继续由控制器推进
- 不再把“幂等边界”全压给 agent prompt

---

## 1. 相关文件

- 入口脚本：[run_remote_digestion.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/run_remote_digestion.sh)
- 远程 runner：[run_remote_digestion.mjs](/Users/jungle/Desktop/dev/vibe-os/scripts/run_remote_digestion.mjs)
- 安装脚本：[install_remote_digestion_launch_agent.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/install_remote_digestion_launch_agent.sh)
- 卸载脚本：[uninstall_remote_digestion_launch_agent.sh](/Users/jungle/Desktop/dev/vibe-os/scripts/uninstall_remote_digestion_launch_agent.sh)

---

## 2. 安装

默认每 30 分钟执行一次：

```bash
scripts/install_remote_digestion_launch_agent.sh
```

如果要改频率，例如每 15 分钟：

```bash
DIGESTION_START_INTERVAL_SECONDS=900 scripts/install_remote_digestion_launch_agent.sh
```

安装后会生成：

- `~/Library/LaunchAgents/ai.vibe-os.remote-digestion.plist`
- `~/.vibe-os-controller/bin/run_remote_digestion.sh`
- `~/.vibe-os-controller/bin/run_remote_digestion.mjs`
- `~/.vibe-os-controller/bin/digestion_mvp.mjs`
- `~/.vibe-os-controller/bin/check_remote_digestion_status.mjs`
- `~/.vibe-os-controller/remote_digestion.env.example`
- `~/.vibe-os-controller/remote_digestion.env`

状态文件：

- `~/.vibe-os-controller/state/remote_digestion_last_run.json`
- `~/.vibe-os-controller/state/remote_digestion_last_success.json`
- `~/.vibe-os-controller/state/remote_digestion_last_failure.json`
- `~/.vibe-os-controller/state/remote_digestion_last_alert.json`
- `~/.vibe-os-controller/state/remote_digestion_runs.jsonl`

日志位置：

- `~/.vibe-os-controller/logs/remote_digestion.launchd.out.log`
- `~/.vibe-os-controller/logs/remote_digestion.launchd.err.log`

这样做是为了绕开 macOS 对 `Desktop/`、`Documents/` 等目录的 `launchd` 访问限制；即便仓库在 `~/Desktop/` 下，LaunchAgent 运行时也不再直接读取仓库脚本

运行特性：

- controller wrapper 会把最近一轮结果写入 `state/`
- 如果上一轮还没结束，本轮会写入 `skipped_locked`，避免重叠执行
- 非零退出会写 `last_alert`，并按 fingerprint + cooldown 抑制重复告警
- 默认启用本机 macOS 通知，可用 `DIGESTION_ENABLE_MACOS_NOTIFICATIONS=0` 关闭
- 默认 cooldown 为 6 小时，可用 `DIGESTION_ALERT_COOLDOWN_SECONDS` 调整
- controller runner 依赖本机直连 `Tailscale SSH`；像 `Shadowrocket` 这类代理如果劫持了 tailnet 流量，会直接导致 SSH timeout
- 可选外部告警读取 `~/.vibe-os-controller/remote_digestion.env`
- 当前支持：
  - 通用 webhook：`DIGESTION_ALERT_WEBHOOK_URL` / `DIGESTION_ALERT_WEBHOOK_BEARER`
  - Telegram Bot：`DIGESTION_ALERT_TELEGRAM_BOT_TOKEN` / `DIGESTION_ALERT_TELEGRAM_CHAT_ID`

---

## 3. 检查

查看 LaunchAgent：

```bash
launchctl print gui/$(id -u)/ai.vibe-os.remote-digestion
```

手动触发一轮：

```bash
launchctl kickstart -k gui/$(id -u)/ai.vibe-os.remote-digestion
```

看最近日志：

```bash
tail -n 50 ~/.vibe-os-controller/logs/remote_digestion.launchd.out.log
tail -n 50 ~/.vibe-os-controller/logs/remote_digestion.launchd.err.log
```

看最近状态：

```bash
node scripts/check_remote_digestion_status.mjs
```

或直接用 controller copy：

```bash
~/.vibe-os-controller/bin/check_remote_digestion_status.mjs
```

如需演练失败路径但不弹通知：

```bash
DIGESTION_FORCE_FAILURE=1 \
DIGESTION_FORCE_FAILURE_MESSAGE='test alert path' \
DIGESTION_ENABLE_MACOS_NOTIFICATIONS=0 \
scripts/run_remote_digestion.sh
```

如果要启用外部告警，先编辑：

```bash
~/.vibe-os-controller/remote_digestion.env
```

最小 webhook 示例：

```bash
DIGESTION_ALERT_WEBHOOK_URL=https://example.com/hooks/vibe-os-digestion
DIGESTION_ALERT_WEBHOOK_BEARER=replace-with-bearer-token
```

最小 Telegram 示例：

```bash
DIGESTION_ALERT_TELEGRAM_BOT_TOKEN=123456:replace-with-bot-token
DIGESTION_ALERT_TELEGRAM_CHAT_ID=123456789
```

---

## 4. 卸载

```bash
scripts/uninstall_remote_digestion_launch_agent.sh
```

---

## 5. 当前边界

- 这条调度链仍然依赖本机能 SSH 到部署机
- 当前没有外部告警，但已经补了本地状态文件与运行历史
- 当前失败会走本机 macOS 通知，不依赖第三方 webhook
- 如已配置 `remote_digestion.env`，当前失败也可同时发 webhook / Telegram
- 当前没有多批次重试策略

排查顺序建议：

1. 先看 `node scripts/check_remote_digestion_status.mjs`
2. 如果摘要是 `ssh: connect ... timed out`，先检查本机代理 / VPN / Shadowrocket
3. 确认 `ssh -o ConnectTimeout=5 kris@100.69.219.29` 能直连后，再看远端 gateway

下一步更合适的是先补失败观察面，再决定是否接告警。

---

## 6. 2026-03-03 实测状态

当前结果：

- LaunchAgent 已安装：`~/Library/LaunchAgents/ai.vibe-os.remote-digestion.plist`
- 当前 `launchctl print gui/$(id -u)/ai.vibe-os.remote-digestion` 最近退出码为 `0`
- 已完成一次手动 `kickstart -k` 验证
- 本轮 stdout：

```json
{
  "status": "noop",
  "summary": "没有新的 braindump 条目需要消化。"
}
```

- 本轮 stderr 为空
- `check_remote_digestion_status.mjs` 已能读到 `lastRun / lastSuccess / recentRuns`
- 失败告警已接到 controller wrapper，重复错误会被 cooldown 抑制
- controller 安装目录已包含外部告警 env 模板

这说明：

- 调度器能被 `launchd` 正常拉起
- controller copy 方案已经绕开 `Desktop` 目录的访问限制
- 当前定时链路已具备“可运行 + 可观察”的基线
