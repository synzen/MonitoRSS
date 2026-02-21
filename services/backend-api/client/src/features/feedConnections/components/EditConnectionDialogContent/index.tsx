import { RefObject } from "react";
import { FeedDiscordChannelConnection } from "../../../../types";
import { DiscordTextChannelConnectionDialogContent } from "../AddConnectionDialog/DiscordTextChannelConnectionDialogContent";
import { DiscordForumChannelConnectionDialogContent } from "../AddConnectionDialog/DiscordForumChannelConnectionDialogContent";
import { EditConnectionWebhookDialog } from "../EditConnectionWebhookDialog";

interface Props {
  connection: FeedDiscordChannelConnection;
  isOpen: boolean;
  onClose: () => void;
  onCloseRef?: RefObject<HTMLButtonElement>;
}

export const EditConnectionDialogContent = ({ connection, isOpen, onClose, onCloseRef }: Props) => {
  const isForum =
    connection.details.channel?.type === "forum" ||
    connection.details.channel?.type === "forum-thread";

  return (
    <>
      {connection.details.channel && !isForum && (
        <DiscordTextChannelConnectionDialogContent
          connection={connection}
          isOpen={isOpen}
          onClose={onClose}
        />
      )}
      {connection.details.channel && isForum && (
        <DiscordForumChannelConnectionDialogContent
          connection={connection}
          isOpen={isOpen}
          onClose={onClose}
        />
      )}
      {connection.details.webhook && onCloseRef && (
        <EditConnectionWebhookDialog
          connectionId={connection.id}
          isOpen={isOpen}
          onClose={onClose}
          onCloseRef={onCloseRef}
          defaultValues={{
            name: connection.name,
            serverId: connection.details.webhook.guildId,
            applicationWebhook: {
              iconUrl: connection.details.webhook.iconUrl,
              name: connection.details.webhook.name || "",
              threadId: connection.details.webhook.threadId,
              channelId: connection.details.webhook.channelId || "",
            },
          }}
        />
      )}
    </>
  );
};
