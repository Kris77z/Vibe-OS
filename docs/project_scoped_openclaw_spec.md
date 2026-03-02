# Project-Scoped OpenClaw Spec

目标：把 OpenClaw 从“一个总脑挂多个角色”升级为“一个项目一套独立 brain runtime”。

当前结论：

- `vibe-os` 只是第一个项目实例，不是唯一实例。
- 未来每个项目都应拥有自己的 OpenClaw gateway / state / workspace / secrets / tool policy。
- `profile` 只是一层实例管理手段，不应被当成最终安全边界。

配套模板文件：

- `docs/instances/vibe-os.instance.yaml`
- `docs/openclaw.vibe-os.instance.example.json5`
- `docs/contracts/task_run.request.schema.json`
- `docs/contracts/task_result_v1.schema.json`

## 1. 核心决策

采用：

- **一个项目 = 一个 gateway = 一个 OpenClaw 实例**

不采用：

- 单一 gateway 下混多个项目 workspace
- 仅靠 persona / agent 区分不同项目
- 仅靠 prompt 隔离不同项目的权限与状态

原因：

1. OpenClaw 默认安全模型是 **一个 gateway = 一个 trusted operator boundary**。
2. 多项目通常不仅要分 prompt，还要分：
   - workspace
   - secrets
   - session history
   - tools policy
   - browser / auth state
   - 故障域
3. 单 gateway 多 agent 适合“同一信任边界下的多脑分工”，不适合项目级强隔离。

## 2. 实例边界

每个项目实例必须独立拥有以下资源：

| 边界项 | 是否独立 | 说明 |
| --- | --- | --- |
| `OPENCLAW_CONFIG_PATH` | 必须 | 每个实例独立配置文件 |
| `OPENCLAW_STATE_DIR` | 必须 | sessions / logs / creds / caches 独立 |
| `agents.defaults.workspace` | 必须 | 项目文件、记忆、协议独立 |
| `gateway.port` | 必须 | HTTP / WS / Responses API 独立入口 |
| 派生端口 | 必须 | browser / CDP / canvas 不能冲突 |
| `.env` / secrets | 必须 | provider key / token / bot secrets 不共用 |
| browser profile | 建议 | 避免账号登录态串线 |
| tool policy | 必须 | 每个项目独立 allow / deny / sandbox |
| logs | 必须 | 便于审计、排障、归档 |
| OS user / container | 强建议 | 需要更强信任隔离时上升到系统边界 |

## 3. 三层隔离模型

### 3.1 Workspace 隔离

目标：

- 项目知识、记忆、任务、协议、skills 不互相污染

至少做到：

- 每个实例一个独立 workspace 根目录
- 不共享 `AGENTS.md`、`MEMORY.md`、`memory/`
- 不共享项目私有 hooks、生成物、临时文件

### 3.2 Tool 权限隔离

目标：

- 不同项目只拿到完成其工作所需的最小工具集

至少做到：

- 每个实例独立 `tools.profile`
- 每个实例独立 `tools.allow` / `tools.deny`
- 明确 `sandbox.mode`
- 明确 `workspaceAccess`
- 默认关闭 elevated

建议把工具能力分成 3 档：

| 档位 | 用途 | 建议策略 |
| --- | --- | --- |
| `trusted-dev` | 可信 coding 项目 | `tools.profile: "coding"`，允许 `group:fs`、`group:runtime`，默认无 elevated |
| `standard-project` | 一般项目自动化 | `tools.profile: "coding"`，`sandbox.mode: "all"`，`workspaceAccess: "rw"`，按需禁用 browser / automation |
| `restricted-review` | 审阅/检索/总结 | 只给 `read`、`memory_*`、有限 sessions，禁用 `exec`、`apply_patch`、`write`、`browser` |

说明：

- `tool policy` 决定“能不能用”
- `sandbox` 决定“在哪里用”
- 两者都要配，不能只配一边

### 3.3 Runtime / Trust Boundary 隔离

目标：

- 项目 A 的运行故障、泄露、账号状态不要波及项目 B

按强度从低到高：

1. 同一 macOS 用户下多个 OpenClaw profile
2. 同一台 Mac 上多个专用 service user
3. 每实例独立容器
4. 每实例独立主机 / VPS

如果项目之间存在以下任一情况，建议至少升级到 **独立 service user 或容器**：

- 不同业务方
- 不同客户
- 公司脑 vs 个人脑
- 不同浏览器登录态
- 不同敏感 secrets 域

## 4. 目录拓扑

推荐把“runtime”和“project instance”分开：

```text
/Users/openclaw-svc/runtime/openclaw/            # OpenClaw runtime 源码或安装目录
/Users/openclaw-svc/instances/vibe-os/
/Users/openclaw-svc/instances/vibe-os/workspace/
/Users/openclaw-svc/instances/vibe-os/state/
/Users/openclaw-svc/instances/vibe-os/config/openclaw.json

/Users/openclaw-svc/instances/spacebot-like/
/Users/openclaw-svc/instances/spacebot-like/workspace/
/Users/openclaw-svc/instances/spacebot-like/state/
/Users/openclaw-svc/instances/spacebot-like/config/openclaw.json
```

每个实例目录最少包含：

```text
instance/
├── workspace/
│   ├── AGENTS.md
│   ├── MEMORY.md
│   └── memory/
├── state/
│   ├── .env
│   ├── logs/
│   ├── agents/
│   ├── credentials/
│   └── ...
└── config/
    └── openclaw.json
```

## 5. 端口规划

规则：

- 一个实例一个 base port
- 实例间至少相差 `20`
- 不要手动把多个实例的 browser / CDP 端口钉死在相同值

推荐：

| 实例 | Base Port |
| --- | --- |
| `vibe-os` | `18789` |
| `project-b` | `18889` |
| `project-c` | `18989` |
| `rescue-*` | `19789+` |

## 6. Structured I/O Contract

这个部分参考 Spacebot 的思路：worker 不应该直接接整段聊天噪音，而应该接 **聚焦任务 + 明确约束 + 结构化输出**。

### 6.1 输入信封

建议所有自动化入口最终收敛到统一输入对象：

```json
{
  "requestId": "req_20260302_001",
  "instanceId": "vibe-os",
  "kind": "task_run",
  "objective": "整理新增 braindump 并更新 mission_log",
  "context": {
    "source": "cron",
    "workspaceRoot": "/abs/path/to/workspace",
    "files": [
      "memory/braindump.md",
      "memory/mission_log.md"
    ]
  },
  "constraints": {
    "writeScope": [
      "memory/mission_log.md",
      "memory/knowledge/"
    ],
    "maxDurationSec": 300,
    "toolProfile": "standard-project"
  },
  "expectedOutput": {
    "format": "json",
    "schema": "task_result_v1"
  }
}
```

字段约定：

- `kind`: `brain_dump` / `query` / `task_run` / `review` / `spec_run`
- `objective`: 本轮唯一目标
- `context.files`: 本轮允许重点读取的文件
- `constraints.writeScope`: 本轮允许写入的路径范围
- `expectedOutput`: 输出 contract，而不是“随便回答”

### 6.2 输出信封

建议所有非纯聊天场景统一输出：

```json
{
  "status": "ok",
  "summary": "已整理 3 条 TODO，沉淀 1 条长期知识",
  "artifacts": [
    {
      "type": "file_update",
      "path": "memory/mission_log.md"
    }
  ],
  "actions": [
    {
      "type": "append",
      "target": "memory/mission_log.md",
      "count": 3
    }
  ],
  "memoryWrites": [
    {
      "target": "memory/knowledge/productivity.md",
      "reason": "long_term_knowledge"
    }
  ],
  "errors": []
}
```

### 6.3 适用场景区分

| 场景 | 交互方式 | 输出要求 |
| --- | --- | --- |
| 日常聊天 | 自然语言 | 可自由文本 |
| Brain dump | append-only 写盘 | 极简确认句 |
| 自动任务 | 结构化输入 | 结构化 JSON |
| 项目执行 | task/spec 驱动 | `status + artifacts + next_actions` |
| 代码审阅 | review contract | findings-first |

结论：

- `聊天` 可以保留自然语言
- `自动化` 和 `多项目 orchestration` 必须走结构化 contract

## 7. 推荐实例清单格式

建议后续为每个项目维护一个实例说明文件，例如：

```yaml
id: vibe-os
owner: jungle
workspace: /Users/openclaw-svc/instances/vibe-os/workspace
stateDir: /Users/openclaw-svc/instances/vibe-os/state
configPath: /Users/openclaw-svc/instances/vibe-os/config/openclaw.json
port: 18789
toolProfile: standard-project
sandboxMode: all
workspaceAccess: rw
structuredIO: true
channels:
  - supercmd
  - telegram
```

作用：

- 让实例注册信息可审计
- 让新项目复制模板即可上线
- 让后续 wrapper / dashboard / deploy script 有稳定输入

## 8. macOS 服务拓扑

推荐部署形态：

1. 一台专用主服务 Mac
2. 一个 OpenClaw runtime 安装目录
3. 多个项目实例目录
4. 每个实例一个 launchd service
5. 每个实例独立 `OPENCLAW_CONFIG_PATH`、`OPENCLAW_STATE_DIR`、`port`

如果项目之间存在明显信任边界，升级为：

- 每个项目一个 macOS service user
- 每个 service user 登录自己的 GUI session
- 每个 service user 管自己的 launchd / browser / keychain / state dir

注意：

- `openclaw gateway install` 在 macOS 上依赖 GUI session
- 不适合把“强隔离生产服务”建立在一个随手登录的日常用户上

## 9. Vibe-OS 作为首个模板实例

`vibe-os` 先作为第一号模板实例落地，职责如下：

- 验证项目级 workspace 隔离
- 验证 brain-dump / retrieval / digestion 这套项目协议
- 验证 SuperCmd 通过远程 `/v1/responses` 接入
- 验证结构化任务入口可运行

后续新项目应复制的是：

- 目录结构
- config 模板
- tool policy 模板
- structured I/O contract

而不是直接复用 `vibe-os` 的 workspace 内容。

## 10. 下一步

建议按以下顺序继续：

1. 为 `vibe-os` 定义第一版实例 manifest
2. 为 `vibe-os` 写第一版独立 `openclaw.json` 模板
3. 为 `vibe-os` 写第一版 structured task contract
4. 再抽一层通用实例脚手架，服务后续新项目
