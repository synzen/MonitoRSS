import { Alert, Box, Button, Flex, HStack, Stack } from "@chakra-ui/react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UserFeedRequestStatus } from "../../types";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import { useFeedScope } from "../../contexts/FeedScopeContext";
import { getErrorMessageForArticleRequestStatus } from "../../utils";
import { useCreateUserFeedManualRequest, useUserFeedRequestsWithPagination } from "../../hooks";
import ApiAdapterError from "../../../../utils/ApiAdapterError";
import { pages } from "../../../../constants";
import { UserFeedTabSearchParam } from "../../../../constants/userFeedTabSearchParam";
import { FixFeedRequestsCTA } from "../FixFeedRequestsCTA";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { UserFeedUrlRequestStatus } from "../../types/UserFeedUrlRequestStatus";

const RESOLVABLE_STATUS_CODES = [429, 403, 401];

export const UserFeedHealthAlert = () => {
  const { t } = useTranslation();
  const { userFeed } = useUserFeedContext();
  const { workspaceSlug } = useFeedScope();
  const scope = workspaceSlug ? { workspaceSlug } : undefined;
  const { data, status } = useUserFeedRequestsWithPagination({
    feedId: userFeed.id,
    data: {},
  });
  const { mutateAsync, status: manualRequestStatus } = useCreateUserFeedManualRequest();
  const { createErrorAlert, createSuccessAlert } = usePageAlertContext();
  const navigate = useNavigate();

  const handleManualAttempt = async () => {
    try {
      const {
        result: { requestStatus, requestStatusCode },
      } = await mutateAsync({
        feedId: userFeed.id,
      });

      if (requestStatus === UserFeedUrlRequestStatus.Success) {
        createSuccessAlert({
          title: "Request to feed was successful.",
        });
      } else {
        const message = getErrorMessageForArticleRequestStatus(requestStatus, requestStatusCode);
        createErrorAlert({
          title: "Request to feed was not successful.",
          description: t(message.ref),
        });
      }
    } catch (err) {
      if (err instanceof ApiAdapterError && err.statusCode === 422) {
        createErrorAlert({
          title: "Failed to make request",
          description: `Please wait ${err.body?.result?.minutesUntilNextRequest} minute(s) before trying again.`,
        });
      } else {
        createErrorAlert({
          title: "Failed to make request",
          description: (err as Error).message,
        });
      }
    }
  };

  const latestRequest = data?.result.requests?.[0];
  const isFailing = !!latestRequest && latestRequest.status !== UserFeedRequestStatus.OK;
  const nextRetryAt = data?.result.nextRetryAtIso ? dayjs(data.result.nextRetryAtIso) : null;

  // A disabled feed is not being polled, so the failing-requests warning (and its
  // retry CTA) would be misleading; the disabled alert already explains the state.
  if (!isFailing || status === "loading" || !!userFeed.disabledCode) {
    return null;
  }

  const fallbackNextRetryTimestamp = dayjs().add(userFeed.refreshRateSeconds, "seconds");

  const firstStatusCode = latestRequest?.response?.statusCode;

  return (
    <Stack>
      <Alert.Root status="warning">
        <Box>
          <Alert.Title>Requests are currently failing</Alert.Title>
          <Alert.Description display="block">
            <Flex flexDirection="column" gap={4}>
              We&apos;ve been unable to successfully fetch this feed. Attempts will continue
              automatically. The next earliest automatic attempt will be on{" "}
              {(nextRetryAt || fallbackNextRetryTimestamp).format("DD MMM YYYY, HH:mm:ss")}. You may
              also manually attempt a request via the button below.
              <HStack>
                <PrimaryActionButton
                  loading={manualRequestStatus === "loading"}
                  onClick={handleManualAttempt}
                >
                  <span>Retry feed request</span>
                </PrimaryActionButton>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      pages.userFeed(userFeed.id, {
                        tab: UserFeedTabSearchParam.Logs,
                        scope,
                      }),
                    )
                  }
                >
                  View request history
                </Button>
              </HStack>
            </Flex>
          </Alert.Description>
        </Box>
      </Alert.Root>
      {firstStatusCode && RESOLVABLE_STATUS_CODES.includes(firstStatusCode) && (
        <FixFeedRequestsCTA url={userFeed.url} />
      )}
    </Stack>
  );
};
