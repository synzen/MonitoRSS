import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
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
import { QuestionOutlineIcon, Search2Icon } from "@chakra-ui/icons";
import { forwardRef, useEffect, useState } from "react";
import { useUserFeedRequestsWithPagination } from "../../../hooks";
import { UserFeedRequestStatus } from "../../../types";
import { InlineErrorAlert } from "../../../../../components";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";
import { RequestDetails } from "./RequestDetails";
import { GetUserFeedRequestsInput } from "../../../api";
import { DismissableAlert } from "../../../../../components/DismissableAlert";

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
  const [startDate, setStartDate] = useState<string>();
  const [endDate, setEndDate] = useState<string>();
  const [requestData, setRequestData] = useState<Partial<GetUserFeedRequestsInput["data"]>>({});
  const { data, status, error, skip, nextPage, prevPage, fetchStatus, limit } =
    useUserFeedRequestsWithPagination({
      feedId,
      data: requestData,
    });
  const [isInvalidDateRange, setIsInvalidDateRange] = useState(false);
  const { t } = useTranslation();

  const onFirstPage = skip === 0;
  const hasNoData = data?.result.requests.length === 0 && skip === 0;

  useEffect(() => {
    setIsInvalidDateRange(false);
  }, [fetchStatus]);

  const onApplyDateRange = () => {
    if (fetchStatus === "fetching") {
      return;
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setIsInvalidDateRange(true);
    } else {
      const newDateRange = {
        ...requestData,
        afterDate: startDate ? new Date(startDate).toISOString() : undefined,
        beforeDate: endDate ? new Date(endDate).toISOString() : undefined,
      };
      setRequestData(newDateRange);
      setIsInvalidDateRange(false);
    }
  };

  const dateRangeForm = (
    <Stack
      as="form"
      onSubmit={(e) => {
        e.preventDefault();
        onApplyDateRange();
      }}
    >
      <HStack flexWrap="wrap">
        <FormControl flex={1}>
          <FormLabel>Start Date Range</FormLabel>
          <Input
            bg="gray.900"
            type="datetime-local"
            size="sm"
            onChange={(e) => {
              setStartDate(e.target.value);
            }}
          />
        </FormControl>
        <FormControl flex={1}>
          <FormLabel>End Date Range</FormLabel>
          <Input
            bg="gray.900"
            type="datetime-local"
            size="sm"
            onChange={(e) => {
              setEndDate(e.target.value);
            }}
          />
        </FormControl>
      </HStack>
      {isInvalidDateRange && (
        <DismissableAlert
          status="error"
          title="Invalid Date Range"
          description="The start date must be before the end date."
          onClosed={() => setIsInvalidDateRange(false)}
        />
      )}
      <Box>
        <Button
          size="sm"
          onClick={onApplyDateRange}
          aria-disabled={fetchStatus === "fetching"}
          type="submit"
        >
          Apply Date Range
        </Button>
      </Box>
    </Stack>
  );

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
      <Box px={4} pb={4}>
        <Box srOnly aria-live="polite">
          {status === "loading" && (
            <span>
              Loading request history rows {skip + 1} through {skip + limit}
            </span>
          )}
          {status === "success" && (
            <span>
              Finished loading request history rows {skip + 1} through {skip + limit}
            </span>
          )}
          {status === "success" && fetchStatus === "fetching" && (
            <span>
              Loading request history rows {skip + 1} through {skip + limit}
            </span>
          )}
        </Box>
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
          <Stack>
            {dateRangeForm}
            <Text color="whiteAlpha.700">No requests found.</Text>
          </Stack>
        )}
        {data && !hasNoData && (
          <Stack>
            {dateRangeForm}
            <Box>
              <TableContainer>
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
                                The duration, determined by the feed host, for which the contents of
                                a particular request will be re-used before a new request is made.
                                This is necessary to comply with polling requirements, and so it
                                overrides this feed&apos;s refresh rate.
                              </Text>
                            </PopoverBody>
                          </PopoverContent>
                        </Popover>
                      </Th>
                      <Th>Details</Th>
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
                        <Td>
                          <Skeleton isLoaded={fetchStatus === "idle"}>
                            <RequestDetails
                              trigger={
                                <Button
                                  leftIcon={<Search2Icon />}
                                  variant="outline"
                                  size="xs"
                                  onClick={() => {}}
                                >
                                  View Details
                                </Button>
                              }
                              request={req}
                            />
                          </Skeleton>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>
            <Flex pt={4}>
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
      </Box>
    </Stack>
  );
};
