# SuperCmd x OpenClaw Remote Checklist

目标：让当前开发机上的 SuperCmd 成功连接到另一台 Mac 上部署的 OpenClaw gateway，并完成最小联调验证。

## 1. 先明确这次联调在验证什么

当前要验证的不是“这台开发机能不能长期跑 OpenClaw”，而是：

1. SuperCmd 是否能通过 HTTP 连接远端 OpenClaw
2. SuperCmd 的聊天链路是否能正确消费 OpenClaw 的流式输出
3. 多轮聊天是否能在同一个会话里保持上下文连续

换句话说，这次联调是在验证 **前端壳和 brain service 的连接关系**。

## 2. 为什么部署机要先准备好

SuperCmd 现在新增的 `OpenClaw` provider 调用的是：

- `POST /v1/responses`

因此部署机必须先具备一个可访问的 OpenClaw gateway。否则当前开发机上的前端即使配置完成，也没有真实后端可以连。

因果关系如下：

1. 远端 gateway 不可用
2. SuperCmd 无法建立请求
3. 前端无法区分是 UI 问题、网络问题还是 OpenClaw 配置问题

所以联调前必须先把部署机准备好。

## 3. 部署机必须具备的条件

### 3.1 OpenClaw 能正常运行

需要满足：

- OpenClaw 已安装
- gateway 可以启动

原因：

- SuperCmd 不直接调用模型 API，而是调用 OpenClaw gateway

### 3.2 开启 Responses HTTP 接口

需要满足：

- `gateway.http.endpoints.responses.enabled = true`

原因：

- SuperCmd 当前接的是 OpenClaw 的 `/v1/responses`
- 如果这个接口未开启，前端请求不会命中正确入口

### 3.3 有明确的认证方式

需要满足：

- gateway 已配置 token 或其他认证方式
- 如果使用 token，SuperCmd 需要填同一个 token

原因：

- 前端和后端之间必须完成认证，否则链路会在入口层就失败

### 3.4 Workspace 已挂到正确目录

需要满足：

- `agents.defaults.workspace` 指向你的 Vibe-OS workspace

原因：

- `AGENTS.md`
- `MEMORY.md`
- `memory/braindump.md`

这些行为和记忆文件都依赖 workspace 路径是否正确。

如果 workspace 挂错，即使远端 gateway 能回复，也不代表 Vibe-OS 行为真正生效。

### 3.5 至少有一个可用 agent

建议：

- 使用 `main`

原因：

- SuperCmd 会把 agent id 编进 `model: openclaw:<agentId>`
- 如果 agent id 不存在，请求会在路由层失败

## 4. 部署机上优先确认的配置项

联调前建议先核对：

1. `agents.defaults.workspace`
2. `gateway.http.endpoints.responses.enabled`
3. `gateway.auth.token` 或等价环境变量
4. 可用的 `agentId`

原因：

- 这四项分别决定：
- 读哪个 workspace
- 是否开放 HTTP 响应接口
- 前端是否能通过认证
- 请求最终会路由到哪个 agent

## 5. 部署机上的基础验证顺序

### 5.1 先确认 gateway 已启动

原因：

- 如果 gateway 没起来，后面的 HTTP 联调没有意义

### 5.2 先用 curl 打非流式请求

原因：

- 先验证“接口是否存在 + 认证是否正确 + agent 是否可用”
- 这样可以把“后端不可用”与“前端消费流式失败”分开

至少需要确认：

- 返回 `200`
- 返回结构是合法响应

### 5.3 再用 curl 打流式请求

原因：

- SuperCmd 依赖流式 SSE 事件
- 非流式成功不代表前端联调一定成功

至少需要确认：

- `Content-Type` 包含 `text/event-stream`
- 能收到 `response.output_text.delta`
- 最后有 `response.completed`
- 最后有 `[DONE]`

## 6. 网络层必须确认的事

### 6.1 开发机必须能访问部署机地址

原因：

- SuperCmd 的 `openclawBaseUrl` 只负责请求，不负责网络穿透

### 6.2 地址不能误填成本机 localhost

如果 OpenClaw 跑在另一台 Mac，上当前开发机时：

- 不要把 `baseUrl` 写成 `http://127.0.0.1:18789`

原因：

- 这会把请求打回开发机自己，而不是部署机

### 6.3 如果中间经过 Tailscale / 反代 / 防火墙

需要确认：

- 端口可达
- 路径仍然是 `/v1/responses`

原因：

- 前端改造当前假设的是标准 OpenClaw Responses API 路径

## 7. SuperCmd 侧该填什么

在设置页里需要填写：

1. `Provider = OpenClaw`
2. `Gateway Base URL = 远端部署机可访问地址`
3. `Gateway Token = 远端 token`
4. `Agent ID = main` 或指定 agent

这些字段的作用分别是：

- `Base URL`：决定请求发到哪里
- `Gateway Token`：决定认证能否通过
- `Agent ID`：决定请求最终由哪个 OpenClaw agent 响应

## 8. 最小 smoke test

### 8.1 第一轮：问一个简单问题

目标：

- 验证请求能到达远端 OpenClaw
- 验证流式返回能被 SuperCmd 消费

通过标准：

- UI 能流式显示文本
- 没有立即报错

### 8.2 第二轮：紧接着追问一个依赖上一轮上下文的问题

目标：

- 验证会话连续性

原因：

- 当前 SuperCmd 已为聊天面板增加 `sessionId` 透传
- 如果第二轮上下文断掉，说明会话标识没有正确传到 OpenClaw

### 8.3 第三轮：取消一次请求

目标：

- 验证现有取消链路没有因为接 OpenClaw 而失效

## 9. 如果联调失败，按什么顺序排查

### 9.1 先排后端，再排前端

第一步先问：

- `curl /v1/responses` 成功了吗？

如果没有成功：

- 先修部署机，不要先动 SuperCmd

原因：

- 前端只是调用方
- 后端接口不通时，前端现象都是次生问题

### 9.2 再按错误类型分流

#### `401` / `403`

优先检查：

- token 是否正确

#### `404` / `405`

优先检查：

- `responses.enabled` 是否打开
- URL 路径是否正确

#### 连接超时 / ECONNREFUSED

优先检查：

- `baseUrl` 是否写对
- 部署机端口是否可达
- 是否误填了本机 localhost

#### 能回复但不像 Vibe-OS

优先检查：

- workspace 是否挂对
- `AGENTS.md` / `MEMORY.md` 是否在部署机生效

#### 第一轮能回复，第二轮断上下文

优先检查：

- SuperCmd 是否在同一次聊天中复用了同一个 session
- OpenClaw 是否把该 `user/session` 视作同一会话

## 10. 在新会话里最值得优先做的事

建议你在新会话里直接让我做三件事：

1. 先给部署机出最小 OpenClaw 配置
2. 再给一组 `curl` 验证命令
3. 最后给 SuperCmd 联调通过的验收标准

这样推进最快，因为它符合真正的因果链：

1. 先让部署机有一个正确可访问的 brain
2. 再让开发机上的前端连上它
3. 最后再做产品层行为验证
