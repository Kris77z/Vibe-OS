# Deployment Handoff

目标：明确开发机与部署机的职责边界，保证后续迁移到常驻 Mac 时不需要重新整理 Workspace。

## 当前开发机负责什么

- 维护 Workspace 内容：
  - [AGENTS.md](/Users/jungle/Desktop/dev/vibe-os/AGENTS.md)
  - [MEMORY.md](/Users/jungle/Desktop/dev/vibe-os/MEMORY.md)
  - [memory/braindump.md](/Users/jungle/Desktop/dev/vibe-os/memory/braindump.md)
  - [memory/mission_log.md](/Users/jungle/Desktop/dev/vibe-os/memory/mission_log.md)
- 维护方案和运行文档
- 改造 SuperCmd 对接本地/远程 OpenClaw
- 按需做一次性的本地 smoke test

## 后续部署机负责什么

- 长期运行 OpenClaw Gateway
- 挂载正式的 Telegram Bot Token
- 运行 QMD 后台索引和后续 Cron 消化任务
- 承担 24/7 消息入口和记忆服务

## 迁移时要带走哪些东西

1. 整个 Vibe-OS Workspace 目录
2. `~/.openclaw/openclaw.json`
3. 相关环境变量或 `~/.openclaw/.env`
4. 后续如有 Telegram/QMD 额外配置，也一并迁移

## 推荐迁移顺序

1. 在部署机上准备 Node / pnpm / OpenClaw 运行环境
2. 将当前仓库同步到部署机
3. 把 OpenClaw 的 `workspace` 指向该仓库目录
4. 先做一次 CLI 写盘测试
5. 再接 Telegram
6. 最后启用常驻服务和自动化任务

## 新的项目级部署参考

如果按“一个项目一个 OpenClaw 实例”的新方案推进，优先看：

- [project_scoped_openclaw_spec.md](/Users/jungle/Desktop/dev/vibe-os/docs/project_scoped_openclaw_spec.md)
- [vibe_os_remote_mac_deploy_runbook.md](/Users/jungle/Desktop/dev/vibe-os/docs/vibe_os_remote_mac_deploy_runbook.md)
- [vibe-os.instance.yaml](/Users/jungle/Desktop/dev/vibe-os/docs/instances/vibe-os.instance.yaml)
- [openclaw.vibe-os.instance.example.json5](/Users/jungle/Desktop/dev/vibe-os/docs/openclaw.vibe-os.instance.example.json5)
