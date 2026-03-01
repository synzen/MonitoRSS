import type { RefObject } from "react";
import { Box } from "@chakra-ui/react";
import { DiscordTextChannelConnectionDialogContent } from "./DiscordTextChannelConnectionDialogContent";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  feedId?: string;
  finalFocusRef?: RefObject<HTMLElement>;
}

export const AddConnectionDialog = ({ isOpen, onClose, feedId, finalFocusRef }: Props) => {
  return (
    <Box>
      <DiscordTextChannelConnectionDialogContent
        onClose={onClose}
        isOpen={isOpen}
        feedId={feedId}
        finalFocusRef={finalFocusRef}
      />
    </Box>
  );
};
