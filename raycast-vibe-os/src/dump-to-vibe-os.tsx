/* eslint-disable @raycast/prefer-title-case */
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
import {
  appendBraindumpEntry,
  buildDumpAckMessage,
  toDumpWriteError,
} from "./lib/braindump-writer";

export default function DumpToVibeOsCommand() {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    if (!content.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "还没写内容" });
      return;
    }

    setIsLoading(true);
    try {
      const normalized = content.trim();
      await appendBraindumpEntry(normalized);
      await closeMainWindow();
      await showHUD(buildDumpAckMessage(normalized));
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "倾倒失败",
        message: toDumpWriteError(error),
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
            title="倾倒到 Vibe-OS"
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
        title="倾倒内容"
        placeholder="把想法丢进来，回车就走。"
        value={content}
        onChange={setContent}
      />
    </Form>
  );
}
