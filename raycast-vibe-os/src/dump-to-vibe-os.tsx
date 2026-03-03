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
import { callOpenClaw, toUserFacingError } from "./lib/openclaw";

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
      const reply = await callOpenClaw({
        mode: "dump",
        prompt: content.trim(),
      });
      await closeMainWindow();
      await showHUD(reply);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "倾倒失败",
        message: toUserFacingError(error),
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
