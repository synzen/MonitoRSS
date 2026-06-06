import { Alert, Box } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useUpdateUserFeed } from "../../hooks";
import { UserFeedDisabledCode } from "../../types";
import { UpdateUserFeedInput } from "../../api";
import { RefreshUserFeedButton } from "../RefreshUserFeedButton";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
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
      <Alert.Root status="info">
        <Alert.Content>
          <Alert.Title>{t("pages.userFeed.manuallyDisabledTitle")}</Alert.Title>
          <Alert.Description display="block">
            {t("pages.userFeed.manuallyDisabledDescription")}
            <Box marginTop="1rem">
              <PrimaryActionButton
                loading={updatingStatus === "loading"}
                onClick={() =>
                  onUpdateFeed({
                    disabledCode: null,
                  })
                }
              >
                <span>{t("pages.userFeed.manuallyDisabledEnableButtonText")}</span>
              </PrimaryActionButton>
            </Box>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === UserFeedDisabledCode.InvalidFeed) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Title>{t("pages.userFeed.invalidFeedFailureTitle")}</Alert.Title>
          <Alert.Description display="block">
            <span>{t("pages.userFeed.invalidFeedFailureText")}</span>
            <Box marginTop="1rem">
              <RefreshUserFeedButton />
            </Box>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === UserFeedDisabledCode.BadFormat) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Title>{t("pages.userFeed.invalidFeedFailureTitle")}</Alert.Title>
          <Alert.Description display="block">
            <span>{t("pages.userFeed.invalidFeedFailureText")}</span>
            <Box marginTop="1rem">
              <RefreshUserFeedButton />
            </Box>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === UserFeedDisabledCode.FailedRequests) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Title>{t("pages.userFeed.connectionFailureTitle")}</Alert.Title>
          <Alert.Description display="block">
            <span>{t("pages.userFeed.connectionFailureText")}</span>
            <Box marginTop="1rem">
              <RefreshUserFeedButton />
            </Box>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === UserFeedDisabledCode.ExceededFeedLimit) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Title>{t("pages.userFeed.exceededFeedLimitTitle")}</Alert.Title>
          <Alert.Description display="block">
            <span>{t("pages.userFeed.exceededFeedLimitText")}</span>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === UserFeedDisabledCode.FeedTooLarge) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Title>{t("pages.userFeed.feedTooLargeTitle")}</Alert.Title>
          <Alert.Description display="block">
            <span>{t("pages.userFeed.feedTooLargeText")}</span>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === UserFeedDisabledCode.ExcessivelyActive) {
    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Title>{t("pages.userFeed.adminDisabledTitle")}</Alert.Title>
          <Alert.Description display="block">
            <span>{t("pages.userFeed.adminDisabledText")}</span>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  return (
    <Alert.Root status="error">
      <Alert.Content>
        <Alert.Title>{t("pages.userFeed.unknownTitle")}</Alert.Title>
        <Alert.Description display="block">
          <span>{t("pages.userFeed.unknownText")}</span>
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
};
