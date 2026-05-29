import type { RefObject } from "react";
import { FeedConnectionType } from "@/types";
import { DiscordTextChannelConnectionDialogContent } from "../discordChannel/connection/components/AddConnectionDialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  feedId?: string;
  finalFocusRef?: RefObject<HTMLElement>;
  /**
   * Which destination's connection dialog to render. Defaults to DiscordChannel today.
   * When destination #2 ships, this becomes the dispatch axis to its dialog.
   * See client/docs/adr/004-destination-extensibility.md.
   */
  connectionType?: FeedConnectionType;
}

const assertNever = (value: never): never => {
  throw new Error(`Unhandled connectionType: ${String(value)}`);
};

export const AddConnectionDialog = ({
  isOpen,
  onClose,
  feedId,
  finalFocusRef,
  connectionType = FeedConnectionType.DiscordChannel,
}: Props) => {
  switch (connectionType) {
    case FeedConnectionType.DiscordChannel:
      return (
        <DiscordTextChannelConnectionDialogContent
          onClose={onClose}
          isOpen={isOpen}
          feedId={feedId}
          finalFocusRef={finalFocusRef}
        />
      );
    default:
      return assertNever(connectionType);
  }
};
