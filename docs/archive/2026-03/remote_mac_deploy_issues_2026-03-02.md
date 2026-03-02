# Remote Mac Deploy Issues 2026-03-02

本文记录 `scripts/deploy-remote-mac.sh` 在真实机器上的一次启动与修复过程，重点保留会复发的问题、判断依据和已验证的处理办法。

## 1. 本次环境结论

- 时间：2026-03-02
- 机器：本地 macOS
- `openclaw` 版本：`2026.3.1`
- `node` 版本：`v25.7.0`
- Docker Desktop：可用
- 实例目录：`/Users/kris/instances/vibe-os`

## 2. 实际遇到的问题

### 2.1 全局安装 `openclaw` 阶段耗时很长

现象：

- `npm install -g openclaw@latest` 长时间无结构化输出
- 最终并非卡死，而是正常安装完成

结论：

- 这是包体较大和依赖较多导致的慢，不是脚本逻辑死锁
- 首次部署时应预期这一步可能要 1 分钟以上

## 2.2 第 6 步 Docker sandbox 检查失败

原始报错：

```text
[FAIL] 未找到沙盒构建脚本：/opt/homebrew/lib/node_modules/openclaw/scripts/sandbox-setup.sh
```

根因：

- 部署脚本假设全局 npm 安装目录里仍然存在 `scripts/sandbox-setup.sh`
- 当前 `openclaw 2026.3.1` 的全局安装产物里已经没有这个脚本
- 文档、部署脚本、全局发布产物三者存在版本错位

进一步确认：

- 全局包里能看到新的 `sandbox` 命令和文档
- 当前源码仓库里的脚本位置变成了 `openclaw/scripts/sandbox-setup.sh`
- 当前源码里 `ensureDockerImage()` 的默认逻辑，已经不是“必须执行脚本构建”，而是：
  `docker pull debian:bookworm-slim` 后再 `docker tag openclaw-sandbox:bookworm-slim`

## 2.3 直接构建 sandbox 镜像时，Docker Hub 鉴权链路失败

尝试：

```bash
cd /Users/kris/Desktop/vibe-os/openclaw
bash scripts/sandbox-setup.sh
```

失败现象：

```text
failed to fetch oauth token: Post "https://auth.docker.io/token": ... connection reset by peer
```

结论：

- 不是 `Dockerfile.sandbox` 本身有错
- 是 Docker 拉取 `debian:bookworm-slim` 时碰到了外部网络 / Docker Hub 鉴权链路问题

## 2.4 重新跑部署脚本时，`git fetch --all --prune` 长时间无输出

现象：

- 第二次执行脚本时，第 3 步停在现有仓库的远端同步检查
- 没有明确报错，但长时间没有任何新输出

结论：

- 该问题和 sandbox 修复无直接关系
- 属于仓库同步链路问题，需单独诊断 `git remote`、认证和网络

## 2.5 Gateway 能启动，但存在非阻塞告警

验证结果：

- `openclaw gateway --port 18789` 能正常启动
- `openclaw gateway status` 返回 `RPC probe: ok`

仍有告警：

- `qmd` 未安装，日志包含 `spawn qmd ENOENT`
- `doctor` 提示 state/config 权限偏宽
- `doctor` 提示 `sessions` 和 `credentials` 目录缺失
- gateway service 尚未安装

这些问题不会阻止 gateway 前台启动，但会影响长期运行质量。

## 3. 已验证有效的处理办法

### 3.1 手动补齐默认 sandbox 镜像

当前 `openclaw` 默认镜像名：

```text
openclaw-sandbox:bookworm-slim
```

已验证可行的最小补齐方案：

```bash
docker pull debian:bookworm-slim
docker tag debian:bookworm-slim openclaw-sandbox:bookworm-slim
docker run --rm openclaw-sandbox:bookworm-slim bash -lc 'echo sandbox-ok'
```

验证结果：

- 镜像 tag 存在
- 容器可成功启动
- `sandbox-ok` 正常输出

说明：

- 这和当前 OpenClaw 源码中的 `ensureDockerImage()` 逻辑一致
- 对默认 sandbox 镜像来说，这比强依赖旧脚本更稳

### 3.2 现阶段更合理的 sandbox 补齐顺序

推荐顺序：

1. 先检查 `docker image inspect openclaw-sandbox:bookworm-slim`
2. 不存在时，先走 `docker pull debian:bookworm-slim && docker tag ...`
3. 若拉取失败，再退回源码仓库中的 `openclaw/scripts/sandbox-setup.sh`

原因：

- 对默认镜像，当前 OpenClaw 运行时本身就允许这种最小 provisioning
- 可以避开“全局 npm 安装物里脚本丢失”的问题
- 也能避开部分仓库路径变更导致的耦合

## 4. 已落地的脚本修复

已修改文件：

- [deploy-remote-mac.sh](/Users/kris/Desktop/Dev/Vibe-OS/scripts/deploy-remote-mac.sh)

修复内容：

- 删除对全局 npm 安装目录下 `scripts/sandbox-setup.sh` 的依赖
- 第 6 步优先按当前 OpenClaw 默认逻辑补默认镜像
- 如果直接 pull/tag 失败，再尝试执行克隆仓库中的：
  `openclaw/scripts/sandbox-setup.sh`
- 对修复后的脚本执行了 `bash -n`，语法通过

## 5. 本次最终验证状态

已完成：

- `openclaw` 安装成功
- `openclaw-sandbox:bookworm-slim` 已补齐
- sandbox 镜像可运行
- gateway 可前台启动
- `openclaw gateway status` 返回 `RPC probe: ok`

未完成：

- 部署脚本整链路重跑成功
- `git fetch --all --prune` 挂起问题定位
- qmd 安装
- doctor 报的权限/目录问题修复
- `gateway install --force` 后台服务安装

## 6. 后续建议

- 把 `git fetch` 挂起问题单独定位，不要和 sandbox 问题混在一起
- 为远程部署脚本补一段“当前 OpenClaw 版本兼容说明”
- 在 runbook 中把默认 sandbox 的最小补齐方案写成显式步骤
- 后续部署完成后再补一轮：
  `openclaw doctor --repair`
