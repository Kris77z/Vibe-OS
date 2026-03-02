import {
  Action,
  ActionPanel,
  closeMainWindow,
  Form,
  Icon,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { useState } from "react";
import { callOpenClaw } from "./lib/openclaw";

export default function DumpToVibeOsCommand() {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    if (!content.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Nothing to dump" });
      return;
    }

    setIsLoading(true);
    try {
      const reply = await callOpenClaw({
        mode: "dump",
        prompt: content.trim(),
      });
      await closeMainWindow();
      await showHUD(reply);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Dump failed",
        message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Dump to Vibe-os"
            icon={Icon.Download}
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
        id="content"
        title="Braindump"
        placeholder="Drop the thought and move on..."
        value={content}
        onChange={setContent}
      />
    </Form>
  );
}
