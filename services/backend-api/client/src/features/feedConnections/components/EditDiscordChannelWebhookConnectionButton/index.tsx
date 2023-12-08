import { useTranslation } from "react-i18next";
import { useDisclosure, Button } from "@chakra-ui/react";
import { useRef } from "react";
import { FeedDiscordChannelConnection } from "../../../../types";
import { useUpdateDiscordChannelConnection } from "../../hooks";
import { UpdateDiscordChannelConnectionInput } from "../../api";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { notifyError } from "../../../../utils/notifyError";
import { EditConnectionWebhookDialog } from "../EditConnectionWebhookDialog";

interface Props {
  feedId: string;
  connection: FeedDiscordChannelConnection;
}

export const EditDiscordChannelWebhookConnectionButton = ({ feedId, connection }: Props) => {
  const { mutateAsync, status: updateStatus } = useUpdateDiscordChannelConnection();
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const { t } = useTranslation();
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  const onUpdate = async (details: UpdateDiscordChannelConnectionInput["details"]) => {
    try {
      await mutateAsync({
        feedId,
        connectionId: connection.id,
        details,
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
      throw err;
    }
  };

  return (
    <>
      {connection?.details.webhook && (
        <EditConnectionWebhookDialog
          onCloseRef={actionsButtonRef}
          isOpen={editIsOpen}
          onClose={editOnClose}
          onUpdate={onUpdate}
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
      <Button onClick={editOnOpen} isLoading={updateStatus === "loading"}>
        Update webhook connection
      </Button>
    </>
  );
};
