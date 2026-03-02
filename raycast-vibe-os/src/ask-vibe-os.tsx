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
import { callOpenClaw } from "./lib/openclaw";

export default function AskVibeOsCommand() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    if (!question.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Question is empty",
      });
      return;
    }

    setIsLoading(true);
    try {
      const nextAnswer = await callOpenClaw({
        mode: "ask",
        prompt: question.trim(),
        sessionId: "raycast-ask-vibe-os",
      });
      setAnswer(nextAnswer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Ask failed",
        message,
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
            title="Ask Vibe-os"
            icon={Icon.Bubble}
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
        id="question"
        title="Question"
        placeholder="Ask your remote Vibe-OS brain..."
        value={question}
        onChange={setQuestion}
      />
    </Form>
  );
}
