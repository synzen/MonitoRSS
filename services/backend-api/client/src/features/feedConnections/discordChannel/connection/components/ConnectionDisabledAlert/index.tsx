import { Alert, Box, Icon, useDisclosure } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useContext, useRef } from "react";
import { FaArrowUp } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { FeedConnectionDisabledCode, FeedDiscordChannelConnection } from "@/types";
import { useUpdateDiscordChannelConnection } from "../../hooks";
import { useUserFeedConnectionContext } from "@/features/feed";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import { PricingDialogContext } from "@/features/subscriptionProducts";
import { EditConnectionDialogContent } from "../EditConnectionDialogContent";

export const ConnectionDisabledAlert = () => {
  const { t } = useTranslation();
  const { connection, userFeed } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { mutateAsync, status } = useUpdateDiscordChannelConnection();
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const { open: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const configureButtonRef = useRef<HTMLButtonElement>(null);
  const { disabledCode } = connection;

  const onClickEnable = async () => {
    try {
      await mutateAsync({
        feedId: userFeed.id,
        connectionId: connection.id,
        details: {
          disabledCode: null,
        },
      });
      createSuccessAlert({
        title: "Successfully re-enabled feed connection",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to re-enable connection",
        description: (err as Error).message,
      });
    }
  };

  if (disabledCode === FeedConnectionDisabledCode.Manual) {
    return (
      <Alert.Root status="info">
        <Alert.Content>
          <Alert.Title>
            {t("features.feedConnections.components.connectionDisabledAlert.manuallyDisabledTitle")}
          </Alert.Title>
          <Alert.Description display="block">
            {t(
              "features.feedConnections.components.connectionDisabledAlert.manuallyDisabledDescription",
            )}
            <Box marginTop="1rem">
              <PrimaryActionButton loading={status === "loading"} onClick={onClickEnable}>
                <span>{t("common.buttons.reEnable")}</span>
              </PrimaryActionButton>
            </Box>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === FeedConnectionDisabledCode.BadFormat) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Title>
            {t("features.feedConnections.components.connectionDisabledAlert.badFormatTitle")}
          </Alert.Title>
          <Alert.Description display="block">
            {t("features.feedConnections.components.connectionDisabledAlert.badFormatDescription")}
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === FeedConnectionDisabledCode.MissingMedium) {
    return (
      <>
        <EditConnectionDialogContent
          connection={connection}
          isOpen={editIsOpen}
          onClose={editOnClose}
          onCloseRef={configureButtonRef}
        />
        <Alert.Root status="error">
          <Alert.Content>
            <Alert.Title>
              {t("features.feedConnections.components.connectionDisabledAlert.missingMediumTitle")}
            </Alert.Title>
            <Alert.Description display="block">
              {t(
                "features.feedConnections.components.connectionDisabledAlert.missingMediumDescription",
              )}
              <Box marginTop="1rem">
                <PrimaryActionButton ref={configureButtonRef} onClick={editOnOpen}>
                  <span>{t("common.buttons.configure")}</span>
                </PrimaryActionButton>
              </Box>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      </>
    );
  }

  if (disabledCode === FeedConnectionDisabledCode.MissingPermissions) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Title>
            {t(
              "features.feedConnections.components.connectionDisabledAlert.missingPermissionsTitle",
            )}
          </Alert.Title>
          <Alert.Description display="block">
            {t(
              "features.feedConnections.components.connectionDisabledAlert.missingPermissionsDescription",
            )}
            <Box marginTop="1rem">
              <PrimaryActionButton loading={status === "loading"} onClick={onClickEnable}>
                <span>Attempt to re-enable</span>
              </PrimaryActionButton>
            </Box>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === FeedConnectionDisabledCode.NotPaidSubscriber) {
    return (
      <Alert.Root status="warning">
        <Alert.Content>
          <Alert.Title>Your branded delivery is paused</Alert.Title>
          <Alert.Description display="block">
            Articles are still being delivered, but without your custom name and avatar. Resubscribe
            to restore your branded delivery and make your content stand out.
            <Box marginTop="1rem">
              <PrimaryActionButton onClick={() => onOpenPricingDialog()}>
                <Icon as={FaArrowUp} transform="rotate(90deg)" />
                Restore branded delivery
              </PrimaryActionButton>
            </Box>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  return null;
};
