import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  useDisclosure,
  IconButton,
} from "@chakra-ui/react";
import { cloneElement, useRef } from "react";
import { FaEllipsisVertical } from "react-icons/fa6";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "../../../../types";
import { useUpdateDiscordChannelConnection } from "../../hooks";
import { CloneDiscordConnectionCloneDialog } from "../CloneDiscordConnectionCloneDialog";
import { ConfirmModal } from "../../../../components";
import { UpdateDiscordChannelConnectionInput } from "../../api";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { notifyError } from "../../../../utils/notifyError";
import { EditConnectionWebhookDialog } from "../EditConnectionWebhookDialog";
import { DeleteConnectionButton } from "../DeleteConnectionButton";
import { EditConnectionChannelDialog } from "../EditConnectionChannelDialog";

interface Props {
  feedId: string;
  connection: FeedDiscordChannelConnection;
  trigger?: React.ReactElement;
  redirectOnCloneSuccess?: boolean;
}

export const DiscordChannelConnectionSettings = ({
  feedId,
  connection,
  trigger,
  redirectOnCloneSuccess,
}: Props) => {
  const { mutateAsync, status: updateStatus } = useUpdateDiscordChannelConnection();
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const { t } = useTranslation();
  const {
    isOpen: isConvertToWebhookIsOpen,
    onClose: isConvertToWebhookOnClose,
    onOpen: isConvertToWebhookOnOpen,
  } = useDisclosure();
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
      {connection.details.channel && (
        <EditConnectionChannelDialog
          onCloseRef={actionsButtonRef}
          defaultValues={{
            channelId: connection.details.channel.id,
            name: connection.name,
            serverId: connection.details.channel.id,
          }}
          onUpdate={({ channelId: updatedChannelId, name }) =>
            onUpdate({
              channelId: updatedChannelId,
              name,
            })
          }
          isOpen={editIsOpen}
          onClose={editOnClose}
        />
      )}
      {connection?.details.webhook && (
        <EditConnectionWebhookDialog
          feedId={feedId}
          onCloseRef={actionsButtonRef}
          isOpen={editIsOpen}
          onClose={editOnClose}
          onUpdate={({ applicationWebhook }) =>
            onUpdate({
              applicationWebhook,
            })
          }
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
      {/** For converting a channel to webhook */}
      <EditConnectionWebhookDialog
        excludeName
        title="Convert to Discord Webhook"
        feedId={feedId}
        isOpen={isConvertToWebhookIsOpen}
        onClose={isConvertToWebhookOnClose}
        onCloseRef={actionsButtonRef}
        onUpdate={({ applicationWebhook }) =>
          onUpdate({
            applicationWebhook,
          })
        }
      />
      <Menu>
        {trigger ? (
          cloneElement(trigger, {
            ref: actionsButtonRef,
          })
        ) : (
          <MenuButton
            as={IconButton}
            ref={actionsButtonRef}
            aria-label="Connection settings"
            variant="ghost"
            size="sm"
            icon={<FaEllipsisVertical />}
          />
        )}
        <MenuList>
          <MenuItem aria-label="Edit" onClick={editOnOpen}>
            {t("common.buttons.configure")}
          </MenuItem>
          <CloneDiscordConnectionCloneDialog
            trigger={<MenuItem>Clone</MenuItem>}
            redirectOnSuccess={redirectOnCloneSuccess}
            defaultValues={{
              name: `${connection.name} (Clone)`,
            }}
            type={FeedConnectionType.DiscordChannel}
            connectionId={connection.id}
            feedId={feedId}
          />
          {!connection.disabledCode && (
            <ConfirmModal
              title={t("pages.discordChannelConnection.manualDisableConfirmTitle")}
              description={t("pages.discordChannelConnection.manualDisableConfirmDescription")}
              trigger={
                <MenuItem isDisabled={updateStatus === "loading"}>
                  {t("common.buttons.disable")}
                </MenuItem>
              }
              okText={t("common.buttons.disable")}
              colorScheme="blue"
              onConfirm={async () =>
                onUpdate({
                  disabledCode: FeedConnectionDisabledCode.Manual,
                })
              }
            />
          )}
          {connection.disabledCode === FeedConnectionDisabledCode.Manual && (
            <ConfirmModal
              title="Re-enable connection"
              description="Are you sure you want to re-enable this connection?"
              trigger={<MenuItem isDisabled={updateStatus === "loading"}>Enable</MenuItem>}
              okText="Enable"
              colorScheme="blue"
              onConfirm={async () =>
                onUpdate({
                  disabledCode: null,
                })
              }
            />
          )}
          {connection && connection.details.channel && (
            <MenuItem onClick={isConvertToWebhookOnOpen}>Convert to Discord Webhook</MenuItem>
          )}
          <MenuDivider />
          <DeleteConnectionButton
            connectionId={connection.id}
            feedId={feedId}
            type={FeedConnectionType.DiscordChannel}
            trigger={<MenuItem>{t("common.buttons.delete")}</MenuItem>}
          />
        </MenuList>
      </Menu>
    </>
  );
};
