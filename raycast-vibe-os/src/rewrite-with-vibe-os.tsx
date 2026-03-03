/* eslint-disable @raycast/prefer-title-case */
import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useState } from "react";
import { callOpenClaw, toUserFacingError } from "./lib/openclaw";

const DEFAULT_INSTRUCTION = "把这段话改得更短、更清楚，保留原意。";

export default function RewriteWithVibeOsCommand() {
  const [sourceText, setSourceText] = useState("");
  const [instruction, setInstruction] = useState(DEFAULT_INSTRUCTION);
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    if (!sourceText.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "原文还是空的",
      });
      return;
    }

    const rewriteInstruction = instruction.trim() || DEFAULT_INSTRUCTION;
    const prompt = `请改写下面这段文本。\n\n改写要求：${rewriteInstruction}\n\n原文：\n${sourceText.trim()}`;

    setIsLoading(true);
    try {
      const nextResult = await callOpenClaw({
        mode: "rewrite",
        prompt,
        sessionId: "raycast-rewrite-with-vibe-os",
      });
      setResult(nextResult);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "改写失败",
        message: toUserFacingError(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (result !== null) {
    return (
      <Detail
        markdown={["```text", result, "```"].join("\n")}
        actions={
          <ActionPanel>
            <Action
              title="Rewrite Again"
              icon={Icon.ArrowLeft}
              onAction={() => setResult(null)}
            />
            <Action.CopyToClipboard title="Copy Result" content={result} />
            <Action
              title="Open Preferences"
              icon={Icon.Gear}
              onAction={openExtensionPreferences}
            />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="用 Vibe-OS 改写"
            icon={Icon.Pencil}
            onSubmit={submit}
          />
          <Action
            title="Open Preferences"
            icon={Icon.Gear}
            onAction={openExtensionPreferences}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="sourceText"
        title="原文"
        placeholder="贴进来要改的文本。"
        value={sourceText}
        onChange={setSourceText}
      />
      <Form.TextArea
        id="instruction"
        title="要求"
        placeholder={DEFAULT_INSTRUCTION}
        value={instruction}
        onChange={setInstruction}
      />
    </Form>
  );
}
