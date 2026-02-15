import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  Flex,
  HStack,
  Stack,
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UserFeedDisabledCode } from "../../types";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import {
  getErrorMessageForArticleRequestStatus,
  useCreateUserFeedManualRequest,
  useUserFeedRequestsWithPagination,
} from "../..";
import ApiAdapterError from "../../../../utils/ApiAdapterError";
import { pages } from "../../../../constants";
import { UserFeedTabSearchParam } from "../../../../constants/userFeedTabSearchParam";
import { FixFeedRequestsCTA } from "../FixFeedRequestsCTA";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { UserFeedUrlRequestStatus } from "../../types/UserFeedUrlRequestStatus";

const RESOLVABLE_STATUS_CODES = [429, 403, 401];

export const UserFeedHealthAlert = () => {
  const { t } = useTranslation();
  const { userFeed } = useUserFeedContext();
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

  const nextRetryTimestamp = data?.result.nextRetryTimestamp
    ? dayjs.unix(data.result.nextRetryTimestamp)
    : null;

  if (
    !nextRetryTimestamp ||
    status === "loading" ||
    userFeed.disabledCode === UserFeedDisabledCode.FailedRequests
  ) {
    return null;
  }

  const fallbackNextRetryTimestamp = dayjs().add(userFeed.refreshRateSeconds, "seconds");

  const firstStatusCode = data?.result.requests?.[0]?.response?.statusCode;

  return (
    <Stack>
      <Alert status="warning" borderRadius="md">
        <Box>
          <AlertTitle>Requests are currently failing</AlertTitle>
          <AlertDescription display="block">
            <Flex flexDirection="column" gap={4}>
              We&apos;ve been unable to successfully fetch this feed. Attempts will continue
              automatically. The next earliest automatic attempt will be on{" "}
              {(nextRetryTimestamp || fallbackNextRetryTimestamp).format("DD MMM YYYY, HH:mm:ss")}.
              You may also manually attempt a request via the button below.
              <HStack>
                <Button isLoading={manualRequestStatus === "loading"} onClick={handleManualAttempt}>
                  <span>Retry feed request</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      pages.userFeed(userFeed.id, {
                        tab: UserFeedTabSearchParam.Logs,
                      }),
                    )
                  }
                >
                  View request history
                </Button>
              </HStack>
            </Flex>
          </AlertDescription>
        </Box>
      </Alert>
      {firstStatusCode && RESOLVABLE_STATUS_CODES.includes(firstStatusCode) && (
        <FixFeedRequestsCTA url={userFeed.url} />
      )}
    </Stack>
  );
};
