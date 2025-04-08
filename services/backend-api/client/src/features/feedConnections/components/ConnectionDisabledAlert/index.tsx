import { Alert, AlertDescription, AlertTitle, Box, Button } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useContext } from "react";
import { ArrowLeftIcon } from "@chakra-ui/icons";
import { FeedConnectionDisabledCode } from "../../../../types";
import { useUpdateDiscordChannelConnection } from "../../hooks";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { PricingDialogContext } from "../../../../contexts";

export const ConnectionDisabledAlert = () => {
  const { t } = useTranslation();
  const { connection, userFeed } = useUserFeedConnectionContext();
  const { mutateAsync, status } = useUpdateDiscordChannelConnection();
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
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
      <Alert status="info" borderRadius="md">
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
      <Alert status="error" borderRadius="md">
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
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>
            {t("features.feedConnections.components.connectionDisabledAlert.missingMediumTitle")}
          </AlertTitle>
          <AlertDescription display="block">
            {t(
              "features.feedConnections.components.connectionDisabledAlert.missingMediumDescription"
            )}
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === FeedConnectionDisabledCode.MissingPermissions) {
    return (
      <Alert status="error" borderRadius="md">
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
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>
            This webhook connection has been disabled because you are not currently a paid
            subscriber to be able to access webhooks.
          </AlertTitle>
          <AlertDescription display="block">
            Consider supporting MonitoRSS&apos;s open-source development by subscribing to a paid
            plan and get access to this feature.
            <Box marginTop="1rem">
              <Button
                variant="outline"
                leftIcon={<ArrowLeftIcon transform="rotate(90deg)" />}
                onClick={onOpenPricingDialog}
              >
                Upgrade to a paid plan
              </Button>
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return null;
};
