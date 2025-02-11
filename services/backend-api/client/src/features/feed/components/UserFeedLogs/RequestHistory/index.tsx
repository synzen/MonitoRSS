import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  HStack,
  Heading,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverTrigger,
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
import { QuestionOutlineIcon } from "@chakra-ui/icons";
import { forwardRef } from "react";
import { useUserFeedRequestsWithPagination } from "../../../hooks";
import { UserFeedRequestStatus } from "../../../types";
import { InlineErrorAlert } from "../../../../../components";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";

const QuestionOutlineComponent = forwardRef<any>((props, ref) => (
  <QuestionOutlineIcon fontSize={12} tabIndex={-1} ref={ref} aria-hidden {...props} />
));

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
  const { data, status, error, skip, nextPage, prevPage, fetchStatus, limit } =
    useUserFeedRequestsWithPagination({
      feedId,
      data: {},
    });
  const { t } = useTranslation();

  const onFirstPage = skip === 0;
  const hasNoData = data?.result.requests.length === 0 && skip === 0;

  return (
    <Stack spacing={4} mb={8} border="solid 1px" borderColor="gray.700" borderRadius="md">
      <Box>
        <Stack px={4} py={4}>
          <Heading size="sm" as="h3" m={0} id="request-history-table-title">
            {t("features.userFeeds.components.requestsTable.title")}
          </Heading>
          <Text>Outgoing HTTP requests to the feed URL along with their response details.</Text>
        </Stack>
        <Box px={4}>
          <Divider />
        </Box>
      </Box>
      <Box srOnly aria-live="polite">
        {fetchStatus === "fetching" && `Loading rows ${skip} through ${skip + limit}`}
        {data && `Finished loading rows ${skip} through ${skip + limit}`}
      </Box>
      {status === "loading" && (
        <Center pb={8}>
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
          <Box>
            <TableContainer px={4}>
              <Table size="sm" variant="simple" aria-labelledby="request-history-table-title">
                <Thead>
                  <Tr>
                    <Th>{t("features.userFeeds.components.requestsTable.tableHeaderDate")}</Th>
                    <Th>{t("features.userFeeds.components.requestsTable.tableHeaderStatus")}</Th>
                    <Th>
                      Cache Duration{" "}
                      <Popover>
                        <PopoverTrigger>
                          <Button variant="ghost" size="xs" aria-label="What is cache duration?">
                            <QuestionOutlineComponent />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent>
                          <PopoverArrow />
                          <PopoverCloseButton />
                          <PopoverBody>
                            <Text
                              fontFamily="var(--chakra-fonts-body)"
                              whiteSpace="initial"
                              textTransform="none"
                              fontWeight="normal"
                              color="var(--chakra-colors-chakra-body-text)"
                              fontSize={14}
                              lineHeight="var(--chakra-lineHeights-base)"
                            >
                              The duration, determined by the feed host, for which the contents of a
                              particular request will be re-used before a new request is made. This
                              is necessary to comply with polling requirements, and so it overrides
                              this feed&apos;s refresh rate.
                            </Text>
                          </PopoverBody>
                        </PopoverContent>
                      </Popover>
                    </Th>
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
                      <Td>
                        <Skeleton isLoaded={fetchStatus === "idle"}>
                          {req.freshnessLifetimeMs
                            ? dayjs.duration(req.freshnessLifetimeMs, "ms").humanize()
                            : "N/A"}
                        </Skeleton>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>
          <Flex p={4}>
            <HStack>
              <Button
                width="min-content"
                size="sm"
                onClick={() => {
                  if (onFirstPage || fetchStatus === "fetching") {
                    return;
                  }

                  prevPage();
                }}
                aria-disabled={onFirstPage || fetchStatus === "fetching"}
              >
                Previous Page
              </Button>
              <Button
                width="min-content"
                size="sm"
                onClick={() => {
                  if (fetchStatus === "fetching" || data?.result.requests.length === 0) {
                    return;
                  }

                  nextPage();
                }}
                aria-disabled={fetchStatus === "fetching" || data?.result.requests.length === 0}
              >
                Next Page
              </Button>
            </HStack>
          </Flex>
        </Stack>
      )}
    </Stack>
  );
};
