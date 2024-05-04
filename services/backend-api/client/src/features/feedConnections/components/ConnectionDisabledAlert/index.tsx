import { Alert, AlertDescription, AlertTitle, Box, Button } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FeedConnectionDisabledCode } from "../../../../types";

interface Props {
  disabledCode?: FeedConnectionDisabledCode | null;
  onEnable: () => Promise<void>;
}

export const ConnectionDisabledAlert = ({ disabledCode, onEnable }: Props) => {
  const { t } = useTranslation();
  const [isUpdating, setIsUpdating] = useState(false);

  const onClickEnable = async () => {
    try {
      setIsUpdating(true);
      await onEnable();
    } catch (err) {
      // do nothing - this is handled in onEnable()
    } finally {
      setIsUpdating(false);
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
              <Button isLoading={isUpdating} onClick={onClickEnable}>
                {t("common.buttons.reEnable")}
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
              <Button isLoading={isUpdating} onClick={onClickEnable}>
                {t("common.buttons.reEnable")}
              </Button>
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return null;
};
