import { RefObject } from "react";
import { FeedDiscordChannelConnection } from "@/types";
import { DiscordTextChannelConnectionDialogContent } from "../AddConnectionDialog";

interface Props {
  connection: FeedDiscordChannelConnection;
  isOpen: boolean;
  onClose: () => void;
  onCloseRef?: RefObject<HTMLButtonElement>;
}

export const EditConnectionDialogContent = ({ connection, isOpen, onClose, onCloseRef }: Props) => {
  return (
    <DiscordTextChannelConnectionDialogContent
      connection={connection}
      isOpen={isOpen}
      onClose={onClose}
      finalFocusRef={onCloseRef}
    />
  );
};
