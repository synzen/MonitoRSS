import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  useDisclosure,
  IconButton,
  Text,
} from "@chakra-ui/react";
import { cloneElement, useRef } from "react";
import { FaCopy, FaEllipsisVertical, FaGear, FaPause, FaPlay } from "react-icons/fa6";
import { IoDuplicate } from "react-icons/io5";
import { BiTransfer } from "react-icons/bi";
import { DeleteIcon } from "@chakra-ui/icons";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "../../../../types";
import { useUpdateDiscordChannelConnection } from "../../hooks";
import { CloneDiscordConnectionCloneDialog } from "../CloneDiscordConnectionCloneDialog";
import { ConfirmModal } from "../../../../components";
import { UpdateDiscordChannelConnectionInput } from "../../api";
import { EditConnectionWebhookDialog } from "../EditConnectionWebhookDialog";
import { DeleteConnectionButton } from "../DeleteConnectionButton";
import { CopyDiscordChannelConnectionSettingsDialog } from "../CopyDiscordChannelConnectingSettingsDialog";
import { EditConnectionDialogContent } from "../EditConnectionDialogContent";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

interface Props {
  feedId: string;
  connection: FeedDiscordChannelConnection;
  trigger?: React.ReactElement;
}

export const DiscordChannelConnectionSettings = ({ feedId, connection, trigger }: Props) => {
  const {
    mutateAsync,
    status: updateStatus,
    error,
    reset: resetErrorState,
  } = useUpdateDiscordChannelConnection();
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const { t } = useTranslation();
  const {
    isOpen: isConvertToWebhookIsOpen,
    onClose: isConvertToWebhookOnClose,
    onOpen: isConvertToWebhookOnOpen,
  } = useDisclosure();
  const {
    isOpen: isCopySettingsIsOpen,
    onClose: isCopySettingsOnClose,
    onOpen: isCopySettingsOnOpen,
  } = useDisclosure();
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const { createSuccessAlert } = usePageAlertContext();

  const onUpdate = async (details: UpdateDiscordChannelConnectionInput["details"]) => {
    await mutateAsync({
      feedId,
      connectionId: connection.id,
      details,
    });
  };

  return (
    <>
      <CopyDiscordChannelConnectionSettingsDialog
        feedId={feedId}
        connectionId={connection.id}
        isOpen={isCopySettingsIsOpen}
        onClose={isCopySettingsOnClose}
        onCloseRef={actionsButtonRef}
      />
      <EditConnectionDialogContent
        connection={connection}
        isOpen={editIsOpen}
        onClose={editOnClose}
        onCloseRef={actionsButtonRef}
      />
      {/** For converting a channel to webhook */}
      <EditConnectionWebhookDialog
        excludeName
        connectionId={connection.id}
        title="Add custom branding"
        isOpen={isConvertToWebhookIsOpen}
        onClose={isConvertToWebhookOnClose}
        onCloseRef={actionsButtonRef}
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
            aria-label={`${connection.name} connection actions`}
            variant="ghost"
            size="sm"
            icon={<FaEllipsisVertical />}
          />
        )}
        <MenuList>
          <MenuItem aria-label="Edit" onClick={editOnOpen} icon={<FaGear />}>
            {t("common.buttons.configure")}
          </MenuItem>
          <MenuItem aria-label="Edit" onClick={isCopySettingsOnOpen} icon={<FaCopy />}>
            Copy settings to...
          </MenuItem>
          <CloneDiscordConnectionCloneDialog
            trigger={<MenuItem icon={<IoDuplicate />}>Clone</MenuItem>}
            defaultValues={{
              name: `${connection.name} (Clone)`,
              targetFeedIds: [feedId],
            }}
            type={FeedConnectionType.DiscordChannel}
            connectionId={connection.id}
            feedId={feedId}
          />
          {!connection.disabledCode && (
            <ConfirmModal
              title={t("pages.discordChannelConnection.manualDisableConfirmTitle")}
              description={t("pages.discordChannelConnection.manualDisableConfirmDescription")}
              error={error?.message}
              trigger={
                <MenuItem isDisabled={updateStatus === "loading"} icon={<FaPause />}>
                  {t("common.buttons.disable")}
                </MenuItem>
              }
              okText={t("common.buttons.disable")}
              colorScheme="blue"
              onClosed={resetErrorState}
              onConfirm={async () => {
                await onUpdate({
                  disabledCode: FeedConnectionDisabledCode.Manual,
                });
                createSuccessAlert({
                  title: `Successfully disabled connection: ${connection.name}`,
                });
              }}
            />
          )}
          {connection.disabledCode === FeedConnectionDisabledCode.Manual && (
            <ConfirmModal
              title="Re-enable connection"
              description="Are you sure you want to re-enable this connection?"
              error={error?.message}
              trigger={
                <MenuItem isDisabled={updateStatus === "loading"} icon={<FaPlay />}>
                  Enable
                </MenuItem>
              }
              okText="Enable"
              colorScheme="blue"
              onClosed={resetErrorState}
              onConfirm={async () => {
                await onUpdate({
                  disabledCode: null,
                });
                createSuccessAlert({
                  title: `Successfully re-enabled connection: ${connection.name}`,
                });
              }}
            />
          )}
          {connection && connection.details.channel && (
            <MenuItem onClick={isConvertToWebhookOnOpen} icon={<BiTransfer />}>
              Add custom branding
            </MenuItem>
          )}
          <MenuDivider />
          <DeleteConnectionButton
            connectionId={connection.id}
            feedId={feedId}
            type={FeedConnectionType.DiscordChannel}
            trigger={
              <MenuItem icon={<DeleteIcon color="red.200" />}>
                <Text color="red.200">{t("common.buttons.delete")}</Text>
              </MenuItem>
            }
          />
        </MenuList>
      </Menu>
    </>
  );
};
