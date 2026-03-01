import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  useDisclosure,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useContext, useRef } from "react";
import { ArrowLeftIcon } from "@chakra-ui/icons";
import { FeedConnectionDisabledCode, FeedDiscordChannelConnection } from "../../../../types";
import { useUpdateDiscordChannelConnection } from "../../hooks";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { PricingDialogContext } from "../../../../contexts";
import { EditConnectionDialogContent } from "../EditConnectionDialogContent";

export const ConnectionDisabledAlert = () => {
  const { t } = useTranslation();
  const { connection, userFeed } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { mutateAsync, status } = useUpdateDiscordChannelConnection();
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
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
      <Alert status="info" borderRadius="md" alignItems="flex-start">
        <AlertIcon />
        <Box>
          <AlertTitle>
            {t("features.feedConnections.components.connectionDisabledAlert.manuallyDisabledTitle")}
          </AlertTitle>
          <AlertDescription display="block">
            {t(
              "features.feedConnections.components.connectionDisabledAlert.manuallyDisabledDescription"
            )}
            <Box marginTop="1rem">
              <Button isLoading={status === "loading"} onClick={onClickEnable}>
                <span>{t("common.buttons.reEnable")}</span>
              </Button>
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === FeedConnectionDisabledCode.BadFormat) {
    return (
      <Alert status="error" borderRadius="md" alignItems="flex-start">
        <AlertIcon />
        <Box>
          <AlertTitle>
            {t("features.feedConnections.components.connectionDisabledAlert.badFormatTitle")}
          </AlertTitle>
          <AlertDescription display="block">
            {t("features.feedConnections.components.connectionDisabledAlert.badFormatDescription")}
          </AlertDescription>
        </Box>
      </Alert>
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
        <Alert status="error" borderRadius="md" alignItems="flex-start">
          <AlertIcon />
          <Box>
            <AlertTitle>
              {t("features.feedConnections.components.connectionDisabledAlert.missingMediumTitle")}
            </AlertTitle>
            <AlertDescription display="block">
              {t(
                "features.feedConnections.components.connectionDisabledAlert.missingMediumDescription"
              )}
              <Box marginTop="1rem">
                <Button ref={configureButtonRef} onClick={editOnOpen}>
                  <span>{t("common.buttons.configure")}</span>
                </Button>
              </Box>
            </AlertDescription>
          </Box>
        </Alert>
      </>
    );
  }

  if (disabledCode === FeedConnectionDisabledCode.MissingPermissions) {
    return (
      <Alert status="error" borderRadius="md" alignItems="flex-start">
        <AlertIcon />
        <Box>
          <AlertTitle>
            {t(
              "features.feedConnections.components.connectionDisabledAlert.missingPermissionsTitle"
            )}
          </AlertTitle>
          <AlertDescription display="block">
            {t(
              "features.feedConnections.components.connectionDisabledAlert.missingPermissionsDescription"
            )}
            <Box marginTop="1rem">
              <Button isLoading={status === "loading"} onClick={onClickEnable}>
                <span>Attempt to re-enable</span>
              </Button>
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === FeedConnectionDisabledCode.NotPaidSubscriber) {
    return (
      <Alert status="warning" borderRadius="md" alignItems="flex-start">
        <AlertIcon />
        <Box>
          <AlertTitle>Your branded delivery is paused</AlertTitle>
          <AlertDescription display="block">
            Articles are still being delivered, but without your custom name and avatar. Resubscribe
            to restore your branded delivery and make your content stand out.
            <Box marginTop="1rem">
              <Button
                colorScheme="blue"
                leftIcon={<ArrowLeftIcon transform="rotate(90deg)" />}
                onClick={onOpenPricingDialog}
              >
                Restore branded delivery
              </Button>
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return null;
};
