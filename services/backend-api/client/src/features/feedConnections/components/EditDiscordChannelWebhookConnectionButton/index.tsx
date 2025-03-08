import { useDisclosure, Button } from "@chakra-ui/react";
import { useRef } from "react";
import { FeedDiscordChannelConnection } from "../../../../types";
import { EditConnectionWebhookDialog } from "../EditConnectionWebhookDialog";

interface Props {
  connection: FeedDiscordChannelConnection;
}

export const EditDiscordChannelWebhookConnectionButton = ({ connection }: Props) => {
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      {connection?.details.webhook && (
        <EditConnectionWebhookDialog
          connectionId={connection.id}
          onCloseRef={actionsButtonRef}
          isOpen={editIsOpen}
          onClose={editOnClose}
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
      <Button onClick={editOnOpen}>
        <span>Update webhook connection</span>
      </Button>
    </>
  );
};
