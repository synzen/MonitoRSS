import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Heading,
  Skeleton,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { useCreateUserFeedManualRequest, useUserFeedRequestsWithPagination } from "../../../hooks";
import { UserFeedArticleRequestStatus, UserFeedRequestStatus } from "../../../types";
import { InlineErrorAlert } from "../../../../../components";
import { getErrorMessageForArticleRequestStatus } from "../../../utils";
import { notifySuccess } from "../../../../../utils/notifySuccess";
import { notifyError } from "../../../../../utils/notifyError";
import ApiAdapterError from "../../../../../utils/ApiAdapterError";

interface Props {
  feedId?: string;
}

const createStatusLabel = (
  status: UserFeedRequestStatus,
  response: {
    statusCode?: number | null;
  }
) => {
  switch (status) {
    case UserFeedRequestStatus.OK:
      return (
        <Badge fontSize="sm" colorScheme="green">
          {status}
        </Badge>
      );
    case UserFeedRequestStatus.BAD_STATUS_CODE:
      return (
        <Badge fontSize="sm" colorScheme="red">
          {status}
          {response.statusCode ? ` (${response.statusCode})` : ""}
        </Badge>
      );
    case UserFeedRequestStatus.FETCH_ERROR:
    case UserFeedRequestStatus.INTERNAL_ERROR:
    case UserFeedRequestStatus.PARSE_ERROR:
    case UserFeedRequestStatus.TIMED_OUT:
      return (
        <Badge fontSize="sm" colorScheme="red">
          {status}
        </Badge>
      );
    case UserFeedRequestStatus.FETCH_TIMEOUT:
      return (
        <Badge fontSize="sm" colorScheme="orange">
          {status}
        </Badge>
      );
    default:
      return "Unknown";
  }
};

export const RequestHistory = ({ feedId }: Props) => {
  const { data, status, error, skip, nextPage, prevPage, fetchStatus } =
    useUserFeedRequestsWithPagination({
      feedId,
      data: {},
    });
  const { t } = useTranslation();
  const { mutateAsync, status: manualRequestStatus } = useCreateUserFeedManualRequest();

  const onFirstPage = skip === 0;
  const nextRetryTimestamp = data?.result.nextRetryTimestamp;

  const handleManualAttempt = async () => {
    if (!feedId) {
      return;
    }

    try {
      const {
        result: { requestStatus, requestStatusCode },
      } = await mutateAsync({
        feedId,
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

  return (
    <Stack spacing={4} mb={8}>
      <Heading size="md">{t("features.userFeeds.components.requestsTable.title")}</Heading>
      {onFirstPage && typeof nextRetryTimestamp === "number" && (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>
              {t("features.userFeeds.components.requestsTable.alertFailingTitle")}
            </AlertTitle>
            <AlertDescription>
              <Flex flexDirection="column" gap={4}>
                {t("features.userFeeds.components.requestsTable.alertFailingDescription", {
                  nextAttemptDate: dayjs.unix(nextRetryTimestamp).format("DD MMM YYYY, HH:mm:ss"),
                })}
                <div>
                  <Button
                    isLoading={manualRequestStatus === "loading"}
                    onClick={handleManualAttempt}
                  >
                    Attempt request
                  </Button>
                </div>
              </Flex>
            </AlertDescription>
          </Box>
        </Alert>
      )}
      {status === "loading" && (
        <Center>
          <Spinner />
        </Center>
      )}
      {error && (
        <InlineErrorAlert
          title={t("common.errors.somethingWentWrong")}
          description={error.message}
        />
      )}
      {data && (
        <Stack>
          <Box border="solid 1px" borderColor="gray.600" borderRadius="md">
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>{t("features.userFeeds.components.requestsTable.tableHeaderDate")}</Th>
                    <Th>{t("features.userFeeds.components.requestsTable.tableHeaderStatus")}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {data?.result.requests.map((req) => (
                    <Tr key={req.id}>
                      <Td>
                        <Skeleton isLoaded={fetchStatus === "idle"}>
                          {dayjs.unix(req.createdAt).format("DD MMM YYYY, HH:mm:ss")}
                        </Skeleton>
                      </Td>
                      <Td>
                        <Skeleton isLoaded={fetchStatus === "idle"}>
                          {createStatusLabel(req.status, {
                            statusCode: req.response.statusCode,
                          })}
                        </Skeleton>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>
          <Flex justifyContent="flex-end">
            <HStack>
              <Button
                width="min-content"
                size="sm"
                onClick={prevPage}
                isDisabled={onFirstPage || fetchStatus === "fetching"}
              >
                {t("features.feedConnections.components.filtersTabSection.prevPage")}
              </Button>
              <Button
                width="min-content"
                size="sm"
                onClick={nextPage}
                isDisabled={fetchStatus === "fetching" || data?.result.requests.length === 0}
              >
                {t("features.feedConnections.components.filtersTabSection.nextPage")}
              </Button>
            </HStack>
          </Flex>
        </Stack>
      )}
    </Stack>
  );
};
