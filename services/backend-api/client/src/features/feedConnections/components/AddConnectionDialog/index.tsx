import { Box } from "@chakra-ui/react";
import { DiscordChannelConnectionDialogContent } from "./DiscordChannelConnectionDialogContent";
import { DiscordWebhookConnectionDialogContent } from "./DiscordWebhookConnectionDialogContent";
import { DiscordChannelThreadConnectionDialogContent } from "./DiscordChannelThreadConnectionDialogContent";

interface Props {
  type?: "discord-webhook" | "discord-channel";
  isOpen: boolean;
  onClose: () => void;
  isChannelThread?: boolean;
}

export const AddConnectionDialog = ({ type, isOpen, onClose, isChannelThread }: Props) => {
  let modalContent: React.ReactNode;

  if (type === "discord-channel") {
    if (isChannelThread) {
      modalContent = (
        <DiscordChannelThreadConnectionDialogContent onClose={onClose} isOpen={isOpen} />
      );
    } else {
      modalContent = <DiscordChannelConnectionDialogContent onClose={onClose} isOpen={isOpen} />;
    }
  } else if (type === "discord-webhook") {
    modalContent = <DiscordWebhookConnectionDialogContent onClose={onClose} isOpen={isOpen} />;
  }

  return <Box>{modalContent}</Box>;
};
