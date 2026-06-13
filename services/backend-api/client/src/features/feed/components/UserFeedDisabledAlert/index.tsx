import { Alert, Box, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useUpdateUserFeed } from "../../hooks";
import { UserFeedDisabledCode } from "../../types";
import { UpdateUserFeedInput } from "../../api";
import { RefreshUserFeedButton } from "../RefreshUserFeedButton";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import { useFeedScope } from "../../contexts/FeedScopeContext";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

export const UserFeedDisabledAlert = () => {
  const { userFeed: feed } = useUserFeedContext();
  const { workspaceDormant } = useFeedScope();
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

  // A dormant workspace (limit 0) blocks re-enabling, so a retry button would
  // always fail; explain the subscription requirement instead.
  const retryAction =
    feed?.isWorkspaceFeed && workspaceDormant ? (
      <Text>
        This feed can&apos;t be re-enabled because the team is not subscribed. The team owner can
        activate a subscription from the team&apos;s Billing page.
      </Text>
    ) : (
      <RefreshUserFeedButton />
    );

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
            <Box marginTop="1rem">{retryAction}</Box>
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
            <Box marginTop="1rem">{retryAction}</Box>
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
            <Box marginTop="1rem">{retryAction}</Box>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    );
  }

  if (disabledCode === UserFeedDisabledCode.ExceededFeedLimit) {
    // Workspace feeds count against the workspace's limit, so the supporter
    // upsell in the personal copy does not apply.
    const isWorkspaceFeed = !!feed.isWorkspaceFeed;

    // A dormant workspace (limit 0) disables every feed; "over the limit"
    // would mislead — the real reason is the missing subscription.
    if (isWorkspaceFeed && workspaceDormant) {
      return (
        <Alert.Root status="error">
          <Alert.Content>
            <Alert.Title>This feed is disabled because the team is not subscribed.</Alert.Title>
            <Alert.Description display="block">
              <span>
                Feeds are restored automatically when the team owner activates a subscription from
                the team&apos;s Billing page.
              </span>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      );
    }

    return (
      <Alert.Root status="error">
        <Alert.Content>
          <Alert.Title>
            {isWorkspaceFeed
              ? t("pages.userFeed.exceededFeedLimitWorkspaceTitle")
              : t("pages.userFeed.exceededFeedLimitTitle")}
          </Alert.Title>
          <Alert.Description display="block">
            <span>
              {isWorkspaceFeed
                ? t("pages.userFeed.exceededFeedLimitWorkspaceText")
                : t("pages.userFeed.exceededFeedLimitText")}
            </span>
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
