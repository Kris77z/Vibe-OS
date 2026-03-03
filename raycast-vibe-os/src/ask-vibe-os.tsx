/* eslint-disable @raycast/prefer-title-case */
import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  LocalStorage,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { callOpenClaw, toUserFacingError } from "./lib/openclaw";

const ASK_SESSION_STORAGE_KEY = "ask-session-id";
const DEFAULT_ASK_SESSION_ID = "raycast-ask-vibe-os";

export default function AskVibeOsCommand() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(DEFAULT_ASK_SESSION_ID);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionId() {
      const stored = await LocalStorage.getItem<string>(
        ASK_SESSION_STORAGE_KEY,
      );
      if (cancelled) return;

      if (stored?.trim()) {
        setSessionId(stored.trim());
        return;
      }

      await LocalStorage.setItem(
        ASK_SESSION_STORAGE_KEY,
        DEFAULT_ASK_SESSION_ID,
      );
    }

    void loadSessionId();

    return () => {
      cancelled = true;
    };
  }, []);

  async function resetSession() {
    const nextSessionId = `raycast-ask-vibe-os-${Date.now()}`;
    await LocalStorage.setItem(ASK_SESSION_STORAGE_KEY, nextSessionId);
    setSessionId(nextSessionId);
    setAnswer(null);
    await showToast({
      style: Toast.Style.Success,
      title: "已新开一轮",
    });
  }

  async function submit() {
    if (!question.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "还没写问题",
      });
      return;
    }

    setIsLoading(true);
    try {
      const nextAnswer = await callOpenClaw({
        mode: "ask",
        prompt: question.trim(),
        sessionId,
      });
      setAnswer(nextAnswer);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "提问失败",
        message: toUserFacingError(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (answer !== null) {
    return (
      <Detail
        markdown={answer}
        actions={
          <ActionPanel>
            <Action
              title="Ask Again"
              icon={Icon.ArrowLeft}
              onAction={() => setAnswer(null)}
            />
            <Action
              title="新开一轮"
              icon={Icon.RotateAntiClockwise}
              onAction={resetSession}
            />
            <Action.CopyToClipboard title="Copy Answer" content={answer} />
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
            title="问问 Vibe-OS"
            icon={Icon.Bubble}
            onSubmit={submit}
          />
          <Action
            title="新开一轮"
            icon={Icon.RotateAntiClockwise}
            onAction={resetSession}
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
        id="question"
        title="问题"
        placeholder="问点什么，或者调记忆。"
        value={question}
        onChange={setQuestion}
      />
    </Form>
  );
}
