import { Alert, AlertDescription, AlertTitle, Box, Button } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useUpdateUserFeed } from "../../hooks";
import { UserFeedDisabledCode } from "../../types";
import { UpdateUserFeedInput } from "../../api";
import { RefreshUserFeedButton } from "../RefreshUserFeedButton";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

export const UserFeedDisabledAlert = () => {
  const { userFeed: feed } = useUserFeedContext();
  const { t } = useTranslation();
  const { mutateAsync: mutateAsyncUserFeed, status: updatingStatus } = useUpdateUserFeed();
  const { createErrorAlert, createSuccessAlert } = usePageAlertContext();

  const onUpdateFeed = async ({ url, ...rest }: UpdateUserFeedInput["data"]) => {
    try {
      await mutateAsyncUserFeed({
        feedId: feed.id,
        data: {
          url: url === feed?.url ? undefined : url,
          ...rest,
        },
      });
      createSuccessAlert({
        title: "Successfully re-enabled feed",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to re-enable feed",
        description: (err as Error).message,
      });
    }
  };

  const disabledCode = feed?.disabledCode;

  if (!disabledCode) {
    return null;
  }

  if (disabledCode === UserFeedDisabledCode.Manual) {
    return (
      <Alert status="info" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.manuallyDisabledTitle")}</AlertTitle>
          <AlertDescription display="block">
            {t("pages.userFeed.manuallyDisabledDescription")}
            <Box marginTop="1rem">
              <Button
                isLoading={updatingStatus === "loading"}
                onClick={() =>
                  onUpdateFeed({
                    disabledCode: null,
                  })
                }
              >
                <span>{t("pages.userFeed.manuallyDisabledEnableButtonText")}</span>
              </Button>
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.InvalidFeed) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.invalidFeedFailureTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.invalidFeedFailureText")}</span>
            <Box marginTop="1rem">
              <RefreshUserFeedButton />
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.BadFormat) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.invalidFeedFailureTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.invalidFeedFailureText")}</span>
            <Box marginTop="1rem">
              <RefreshUserFeedButton />
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.FailedRequests) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.connectionFailureTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.connectionFailureText")}</span>
            <Box marginTop="1rem">
              <RefreshUserFeedButton />
            </Box>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.ExceededFeedLimit) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.exceededFeedLimitTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.exceededFeedLimitText")}</span>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.FeedTooLarge) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.feedTooLargeTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.feedTooLargeText")}</span>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  if (disabledCode === UserFeedDisabledCode.ExcessivelyActive) {
    return (
      <Alert status="error" borderRadius="md">
        <Box>
          <AlertTitle>{t("pages.userFeed.adminDisabledTitle")}</AlertTitle>
          <AlertDescription display="block">
            <span>{t("pages.userFeed.adminDisabledText")}</span>
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return (
    <Alert status="error" borderRadius="md">
      <Box>
        <AlertTitle>{t("pages.userFeed.unknownTitle")}</AlertTitle>
        <AlertDescription display="block">
          <span>{t("pages.userFeed.unknownText")}</span>
        </AlertDescription>
      </Box>
    </Alert>
  );
};
