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

function buildInstructions(mode: BrainMode, instructions?: string): string | undefined {
  if (instructions?.trim()) return instructions.trim();

  switch (mode) {
    case "dump":
      return "Treat this as a brain dump. Persist it first if needed, then reply with one short Chinese confirmation sentence no longer than 15 characters. Do not ask follow-up questions.";
    case "rewrite":
      return "Return only the rewritten text. No preface, no bullets, no markdown fences.";
    default:
      return undefined;
  }
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

export async function callOpenClaw(options: OpenClawRequestOptions): Promise<string> {
  const prefs = getOpenClawPreferences();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

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
        "Authorization": `Bearer ${prefs.gatewayToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenClaw request timed out after 30 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenClaw request failed (${response.status}): ${text || response.statusText}`);
  }

  const envelope = (await response.json()) as OpenClawResponseEnvelope;
  const text = extractOutputText(envelope);
  if (!text) {
    throw new Error("OpenClaw returned an empty response.");
  }
  return text;
}
