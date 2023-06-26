import { Box } from "@chakra-ui/react";
import { FeedConnectionType } from "@/types";
import { DiscordChannelConnectionDialogContent } from "./DiscordChannelConnectionDialogContent";
import { DiscordWebhookConnectionDialogContent } from "./DiscordWebhookConnectionDialogContent";
import { DiscordChannelThreadConnectionDialogContent } from "./DiscordChannelThreadConnectionDialogContent";

interface Props {
  type?: FeedConnectionType;
  isOpen: boolean;
  onClose: () => void;
  isChannelThread?: boolean;
}

export const AddConnectionDialog = ({ type, isOpen, onClose, isChannelThread }: Props) => {
  let modalContent: React.ReactNode;

  if (type === FeedConnectionType.DiscordChannel) {
    if (isChannelThread) {
      modalContent = (
        <DiscordChannelThreadConnectionDialogContent onClose={onClose} isOpen={isOpen} />
      );
    } else {
      modalContent = <DiscordChannelConnectionDialogContent onClose={onClose} isOpen={isOpen} />;
    }
  } else if (type === FeedConnectionType.DiscordWebhook) {
    modalContent = <DiscordWebhookConnectionDialogContent onClose={onClose} isOpen={isOpen} />;
  }

  return <Box>{modalContent}</Box>;
};
