import {
  Alert,
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
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { useUserFeedRequestsWithPagination } from "../../../hooks";
import { UserFeedRequestStatus } from "../../../types";
import { InlineErrorAlert } from "../../../../../components";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";

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

export const RequestHistory = () => {
  const {
    userFeed: { id: feedId },
  } = useUserFeedContext();
  const { data, status, error, skip, nextPage, prevPage, fetchStatus } =
    useUserFeedRequestsWithPagination({
      feedId,
      data: {},
    });
  const { t } = useTranslation();

  const onFirstPage = skip === 0;
  const hasNoData = data?.result.requests.length === 0 && skip === 0;

  return (
    <Stack spacing={4} mb={8}>
      <Heading size="md">{t("features.userFeeds.components.requestsTable.title")}</Heading>
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
      {data?.result.feedHostGlobalRateLimit && (
        <Alert rounded="md">
          To stay in compliance with rate limits, MonitoRSS is forced to globally limit the number
          of requests made to this feed&apos;s host to have a maximum of{" "}
          {data.result.feedHostGlobalRateLimit.requestLimit} request(s) per{" "}
          {data.result.feedHostGlobalRateLimit.intervalSec} seconds.
        </Alert>
      )}
      {hasNoData && (
        <Text color="whiteAlpha.700">
          No historical requests found. This is likely because the feed has not been polled yet -
          please check back later.
        </Text>
      )}
      {data && !hasNoData && (
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
