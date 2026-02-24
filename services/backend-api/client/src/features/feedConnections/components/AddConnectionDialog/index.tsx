import type { RefObject } from "react";
import { Box } from "@chakra-ui/react";
import { DiscordForumChannelConnectionDialogContent } from "./DiscordForumChannelConnectionDialogContent";
import { DiscordTextChannelConnectionDialogContent } from "./DiscordTextChannelConnectionDialogContent";
import { DiscordApplicationWebhookConnectionDialogContent } from "./DiscordApplicationWebhookConnectionDialogContent";

interface Props {
  type?: "discord-webhook" | "discord-channel" | "discord-forum";
  isOpen: boolean;
  onClose: () => void;
  feedId?: string;
  finalFocusRef?: RefObject<HTMLElement>;
}

export const AddConnectionDialog = ({ type, isOpen, onClose, feedId, finalFocusRef }: Props) => {
  let modalContent: React.ReactNode;

  if (type === "discord-channel") {
    modalContent = (
      <DiscordTextChannelConnectionDialogContent
        onClose={onClose}
        isOpen={isOpen}
        feedId={feedId}
        finalFocusRef={finalFocusRef}
      />
    );
  } else if (type === "discord-forum") {
    modalContent = (
      <DiscordForumChannelConnectionDialogContent
        onClose={onClose}
        isOpen={isOpen}
        feedId={feedId}
        finalFocusRef={finalFocusRef}
      />
    );
  } else if (type === "discord-webhook") {
    modalContent = (
      <DiscordApplicationWebhookConnectionDialogContent
        onClose={onClose}
        isOpen={isOpen}
        feedId={feedId}
        finalFocusRef={finalFocusRef}
      />
    );
  }

  return <Box>{modalContent}</Box>;
};
