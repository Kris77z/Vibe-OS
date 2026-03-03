import { getPreferenceValues } from "@raycast/api";

type BrainMode = "ask" | "dump" | "rewrite";

interface OpenClawPreferences {
  baseUrl: string;
  gatewayToken: string;
  agentId: string;
}

interface OpenClawRequestOptions {
  mode: BrainMode;
  prompt: string;
  instructions?: string;
  sessionId?: string;
}

interface OpenClawResponseEnvelope {
  id?: string;
  status?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

export function getOpenClawPreferences(): OpenClawPreferences {
  return getPreferenceValues<OpenClawPreferences>();
}

function getRequestTimeoutMs(mode: BrainMode): number {
  switch (mode) {
    case "ask":
      return 45000;
    case "rewrite":
      return 30000;
    case "dump":
      return 20000;
    default:
      return 30000;
  }
}

function buildInstructions(
  mode: BrainMode,
  instructions?: string,
): string | undefined {
  if (instructions?.trim()) return instructions.trim();

  switch (mode) {
    case "dump":
      return [
        "Treat this input as a brain dump.",
        "Append it verbatim to memory/braindump.md in the workspace.",
        "Do not rewrite, summarize, or delete existing content.",
        "Keep memory/braindump.md append-only.",
        "After the append succeeds, reply with one short Chinese confirmation sentence no longer than 15 characters.",
        "Do not ask follow-up questions.",
      ].join(" ");
    case "rewrite":
      return "Return only the rewritten text. No preface, no bullets, no markdown fences.";
    default:
      return undefined;
  }
}

export function toUserFacingError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.trim();

  if (!message) return "请求失败，请稍后再试。";
  if (message.includes("缺少 Gateway Base URL"))
    return "请先在 Raycast 设置里填写 Gateway 地址。";
  if (message.includes("缺少 Gateway Token"))
    return "请先在 Raycast 设置里填写 Gateway Token。";
  if (message.includes("timed out")) return "请求超时了，远程大脑这次有点慢。";
  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("Unauthorized")
  ) {
    return "鉴权失败，请检查 Gateway Token。";
  }
  if (
    message.includes("Failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("NetworkError") ||
    message.includes("ECONNREFUSED")
  ) {
    return "连不上远程大脑，请先检查 tunnel 和 gateway。";
  }
  if (message.includes("empty response")) return "远程大脑这次没回内容。";

  return `请求失败：${message}`;
}

function resolveResponsesUrl(baseUrl: string): string {
  const raw = String(baseUrl || "").trim() || "http://127.0.0.1:28789";
  const normalized = raw.includes("://") ? raw : `http://${raw}`;
  const url = new URL(normalized);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (!pathname) {
    url.pathname = "/v1/responses";
  } else if (pathname.endsWith("/v1/responses")) {
    url.pathname = pathname;
  } else if (pathname.endsWith("/v1")) {
    url.pathname = `${pathname}/responses`;
  } else {
    url.pathname = `${pathname}/v1/responses`;
  }

  return url.toString();
}

function extractOutputText(envelope: OpenClawResponseEnvelope): string {
  const parts: string[] = [];
  for (const item of envelope.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("").trim();
}

export async function callOpenClaw(
  options: OpenClawRequestOptions,
): Promise<string> {
  const prefs = getOpenClawPreferences();
  if (!String(prefs.baseUrl || "").trim()) {
    throw new Error("缺少 Gateway Base URL");
  }
  if (!String(prefs.gatewayToken || "").trim()) {
    throw new Error("缺少 Gateway Token");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    getRequestTimeoutMs(options.mode),
  );

  const body = {
    model: `openclaw:${prefs.agentId || "main"}`,
    input: options.prompt,
    stream: false,
    instructions: buildInstructions(options.mode, options.instructions),
    user: options.sessionId,
  };

  let response: Response;
  try {
    response = await fetch(resolveResponsesUrl(prefs.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${prefs.gatewayToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenClaw request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `OpenClaw request failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const envelope = (await response.json()) as OpenClawResponseEnvelope;
  const text = extractOutputText(envelope);
  if (!text) {
    throw new Error("OpenClaw returned an empty response.");
  }
  return text;
}
