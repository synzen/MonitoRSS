import { Alert, AlertDescription, AlertTitle, Box, Button, Flex, HStack } from "@chakra-ui/react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UserFeedArticleRequestStatus, UserFeedHealthStatus } from "../../types";
import { useUserFeedContext } from "../../../../contexts/UserFeedContext";
import {
  getErrorMessageForArticleRequestStatus,
  useCreateUserFeedManualRequest,
  useUserFeedRequestsWithPagination,
} from "../..";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { notifyError } from "../../../../utils/notifyError";
import ApiAdapterError from "../../../../utils/ApiAdapterError";
import { pages } from "../../../../constants";
import { UserFeedTabSearchParam } from "../../../../constants/userFeedTabSearchParam";

export const UserFeedHealthAlert = () => {
  const { t } = useTranslation();
  const { userFeed } = useUserFeedContext();
  const { data, status } = useUserFeedRequestsWithPagination({
    feedId: userFeed.id,
    data: {},
    disabled: userFeed.healthStatus !== UserFeedHealthStatus.Failing,
  });
  const { mutateAsync, status: manualRequestStatus } = useCreateUserFeedManualRequest();
  const navigate = useNavigate();

  const handleManualAttempt = async () => {
    try {
      const {
        result: { requestStatus, requestStatusCode },
      } = await mutateAsync({
        feedId: userFeed.id,
      });

      if (requestStatus === UserFeedArticleRequestStatus.Success) {
        notifySuccess(`Request was successful`);
      } else {
        const message = getErrorMessageForArticleRequestStatus(requestStatus, requestStatusCode);
        notifyError(`Request to feed was not successful`, t(message.ref));
      }
    } catch (err) {
      if (err instanceof ApiAdapterError && err.statusCode === 422) {
        notifyError(
          `Failed to make request`,
          `Please wait ${err.body?.result?.minutesUntilNextRequest} minute(s) before trying again.`
        );
      } else {
        notifyError(`Failed to make request`, (err as Error).message);
      }
    }
  };

  if (userFeed.healthStatus !== UserFeedHealthStatus.Failing || status === "loading") {
    return null;
  }

  const nextRetryTimestamp = data?.result.nextRetryTimestamp
    ? dayjs.unix(data.result.nextRetryTimestamp)
    : null;
  const fallbackNextRetryTimestamp = dayjs().add(userFeed.refreshRateSeconds, "seconds");

  return (
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
                <span>Attempt request</span>
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    pages.userFeed(userFeed.id, {
                      tab: UserFeedTabSearchParam.Logs,
                    })
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
  );
};
