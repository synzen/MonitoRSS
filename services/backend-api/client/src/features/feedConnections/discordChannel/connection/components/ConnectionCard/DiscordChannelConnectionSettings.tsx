import { useTranslation } from "react-i18next";
import { IconButton, Text, useDisclosure } from "@chakra-ui/react";
import { cloneElement, useRef } from "react";
import { FaCopy, FaEllipsisVertical, FaGear, FaPause, FaPlay, FaTrash } from "react-icons/fa6";
import { IoDuplicate } from "react-icons/io5";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "@/types";
import { useUpdateDiscordChannelConnection } from "../../hooks";
import { CloneDiscordConnectionCloneDialog } from "../CloneDiscordConnectionCloneDialog";
import { ConfirmModal } from "@/components";
import { UpdateDiscordChannelConnectionInput } from "../../api";
import { DeleteConnectionButton } from "../DeleteConnectionButton";
import { CopyDiscordChannelConnectionSettingsDialog } from "../CopyDiscordChannelConnectingSettingsDialog";
import { EditConnectionDialogContent } from "../EditConnectionDialogContent";
import { usePageAlertContext } from "@/contexts/PageAlertContext";

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
  const { open: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const { t } = useTranslation();
  const {
    open: isCopySettingsIsOpen,
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
      <MenuRoot lazyMount={false} unmountOnExit={false}>
        {trigger ? (
          <MenuTrigger asChild>
            {cloneElement(trigger, {
              ref: actionsButtonRef,
            })}
          </MenuTrigger>
        ) : (
          <MenuTrigger asChild>
            <IconButton
              ref={actionsButtonRef}
              aria-label={`${connection.name} connection actions`}
              variant="ghost"
              size="sm"
            >
              <FaEllipsisVertical />
            </IconButton>
          </MenuTrigger>
        )}
        <MenuContent>
          <MenuItem value="configure" aria-label="Edit" onClick={editOnOpen}>
            <FaGear />
            {t("common.buttons.configure")}
          </MenuItem>
          <MenuItem value="copy-settings" aria-label="Edit" onClick={isCopySettingsOnOpen}>
            <FaCopy />
            Copy settings to...
          </MenuItem>
          <CloneDiscordConnectionCloneDialog
            trigger={
              <MenuItem value="clone">
                <IoDuplicate />
                Clone
              </MenuItem>
            }
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
                <MenuItem value="disable" disabled={updateStatus === "loading"}>
                  <FaPause />
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
                <MenuItem value="enable" disabled={updateStatus === "loading"}>
                  <FaPlay />
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
          <MenuSeparator />
          <DeleteConnectionButton
            connectionId={connection.id}
            feedId={feedId}
            type={FeedConnectionType.DiscordChannel}
            trigger={
              <MenuItem value="delete" color="text.error" _icon={{ color: "text.error" }}>
                <FaTrash />
                <Text>{t("common.buttons.delete")}</Text>
              </MenuItem>
            }
          />
        </MenuContent>
      </MenuRoot>
    </>
  );
};
