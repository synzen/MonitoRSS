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
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Alert
      status="info"
      hidden={disabledCode !== FeedConnectionDisabledCode.Manual}
      borderRadius="md"
    >
      <Box>
        <AlertTitle>
          {t("features.feedConnections.components.manuallyDisabledAlert.title")}
        </AlertTitle>
        <AlertDescription display="block">
          {t("features.feedConnections.components.manuallyDisabledAlert.description")}
          <Box marginTop="1rem">
            <Button isLoading={isUpdating} onClick={onClickEnable}>
              {t("common.buttons.reEnable")}
            </Button>
          </Box>
        </AlertDescription>
      </Box>
    </Alert>
  );
};
