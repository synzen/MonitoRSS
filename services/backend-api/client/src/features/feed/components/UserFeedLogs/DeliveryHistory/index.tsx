/* eslint-disable @typescript-eslint/dot-notation */
import {
  Badge,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Heading,
  Icon,
  Skeleton,
  Spinner,
  Stack,
  Table,
  Text,
  Link as ChakraLink,
  chakra,
  Separator,
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { useState } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { useUserFeedArticles, useUserFeedDeliveryLogsWithPagination } from "../../../hooks";
import { UserFeedDeliveryLogStatus } from "../../../types";
import { InlineErrorAlert } from "../../../../../components";
import { pages } from "../../../../../constants";
import { FeedConnectionType } from "../../../../../types";
import { useUserFeedContext } from "../../../contexts/UserFeedContext";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseTrigger,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";

const createStatusLabel = ({ status }: { status: UserFeedDeliveryLogStatus }) => {
  if (status === UserFeedDeliveryLogStatus.DELIVERED) {
    return (
      <Badge fontSize="sm" colorPalette="green">
        Delivered
      </Badge>
    );
  }

  if (status === UserFeedDeliveryLogStatus.PARTIALLY_DELIVERED) {
    return (
      <Badge fontSize="sm" colorPalette="yellow">
        Partially Delivered
      </Badge>
    );
  }

  if (status === UserFeedDeliveryLogStatus.FAILED) {
    return (
      <Badge fontSize="sm" colorPalette="red">
        Internal Error
      </Badge>
    );
  }

  if (status === UserFeedDeliveryLogStatus.ARTICLE_RATE_LIMITED) {
    return (
      <Badge fontSize="sm" colorPalette="orange">
        Rate Limited (Article Daily Limit)
      </Badge>
    );
  }

  if (status === UserFeedDeliveryLogStatus.MEDIUM_RATE_LIMITED) {
    return <Badge fontSize="sm">Rate Limited (Delivery rate limits)</Badge>;
  }

  if (status === UserFeedDeliveryLogStatus.FILTERED_OUT) {
    return <Badge fontSize="sm">Blocked by filters</Badge>;
  }

  if (status === UserFeedDeliveryLogStatus.REJECTED) {
    return (
      <Badge fontSize="sm" colorPalette="red">
        Failed
      </Badge>
    );
  }

  if (status === UserFeedDeliveryLogStatus.PENDING_DELIVERY) {
    return <Badge fontSize="sm">Pending Delivery</Badge>;
  }

  return null;
};

export const DeliveryHistory = () => {
  const [detailsData, setDetailsData] = useState("");
  const { articleFormatOptions, userFeed } = useUserFeedContext();
  const { data, status, error, skip, nextPage, prevPage, fetchStatus, limit } =
    useUserFeedDeliveryLogsWithPagination({
      feedId: userFeed.id,
      data: {},
    });
  const {
    data: articles,
    error: articlesError,
    fetchStatus: articlesFetchStatus,
  } = useUserFeedArticles({
    feedId: userFeed.id,
    disabled: !data?.result.logs.length,
    data: {
      filters: {
        articleIdHashes: data?.result.logs.map((l) => l.articleIdHash),
      },
      formatOptions: articleFormatOptions,
      limit: 25,
      skip: 0,
      selectProperties: ["title", "idHash"],
    },
  });

  const onCloseDetailsModal = () => {
    setDetailsData("");
  };

  const onFirstPage = skip === 0;
  const hasNoData = data?.result.logs.length === 0 && skip === 0;

  return (
    <Stack gap={4} mb={16} border="solid 1px" borderColor="border" borderRadius="l3">
      <DialogRoot
        open={!!detailsData}
        onOpenChange={(e) => {
          if (!e.open) {
            onCloseDetailsModal();
          }
        }}
        size="xl"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delivery Details</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody>
            <chakra.pre overflow="auto" padding={2} bg="bg.subtle">
              {detailsData}
            </chakra.pre>
          </DialogBody>
          <DialogFooter>
            <Button onClick={onCloseDetailsModal}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
      <Box>
        <Stack px={4} py={4}>
          <Heading as="h3" size="sm" m={0} id="delivery-history-table-title">
            Article Delivery History
          </Heading>
          <Text color="fg.muted" fontSize="sm">
            Delivery attempts for articles across all connections.
          </Text>
        </Stack>
        <Box px={4}>
          <Separator />
        </Box>
      </Box>
      <Box px={4} pb={4}>
        <Box srOnly aria-live="polite">
          {status === "loading" && (
            <span>
              Loading article delivery history rows ${skip + 1} through ${skip + limit}
            </span>
          )}
          {status === "success" && (
            <span>
              Finished loading article delivery history rows ${skip + 1} through ${skip + limit}
            </span>
          )}
          {status === "success" && fetchStatus === "fetching" && (
            <span>
              Loading article delivery history rows ${skip + 1} through ${skip + limit}
            </span>
          )}
        </Box>
        {status === "loading" && (
          <Center>
            <Spinner />
          </Center>
        )}
        {error && (
          <InlineErrorAlert title="Failed to get delivery logs" description={error.message} />
        )}
        {hasNoData && (
          <Box>
            <Text color="fg.muted">
              There have been no delivery attempts. Attempts will be logged as soon as new articles
              are found on the feed for delivery to enabled connections.
            </Text>
          </Box>
        )}
        {data?.result && !hasNoData && (
          <Stack>
            <Box>
              <Table.ScrollArea>
                <Table.Root size="sm" variant="line" aria-labelledby="delivery-history-table-title">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Date</Table.ColumnHeader>
                      <Table.ColumnHeader>Connection</Table.ColumnHeader>
                      <Table.ColumnHeader>Article Title</Table.ColumnHeader>
                      <Table.ColumnHeader>Status</Table.ColumnHeader>
                      <Table.ColumnHeader>Details</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {data.result.logs.map((item) => {
                      const connection = userFeed.connections.find((c) => c.id === item.mediumId);
                      const matchedArticle = articles?.result.articles.find(
                        (a) => a.idHash === item.articleIdHash,
                      );

                      // @ts-ignore
                      const articleTitle = matchedArticle?.["title"] || item.articleData?.title;

                      return (
                        <Table.Row key={item.id}>
                          <Table.Cell>
                            <Skeleton loading={fetchStatus !== "idle"}>
                              {dayjs(item.createdAt).format("DD MMM YYYY, HH:mm:ss")}
                            </Skeleton>
                          </Table.Cell>
                          <Table.Cell>
                            <Skeleton loading={fetchStatus !== "idle"}>
                              {!connection && (
                                <Text color="fg.muted" fontStyle="italic">
                                  (deleted connection)
                                </Text>
                              )}
                              {connection && (
                                <ChakraLink asChild fontWeight="semibold" color="text.link">
                                  <Link
                                    to={pages.userFeedConnection({
                                      feedId: userFeed.id,
                                      connectionType: connection?.key as FeedConnectionType,
                                      connectionId: item.mediumId,
                                    })}
                                  >
                                    {connection?.name || item.mediumId}
                                  </Link>
                                </ChakraLink>
                              )}
                            </Skeleton>
                          </Table.Cell>
                          <Table.Cell maxWidth="300px">
                            <Skeleton
                              overflow="hidden"
                              textOverflow="ellipsis"
                              loading={
                                !(
                                  fetchStatus === "idle" &&
                                  !!(
                                    matchedArticle ||
                                    articlesError ||
                                    (articlesFetchStatus === "idle" && !matchedArticle)
                                  )
                                )
                              }
                            >
                              {articleTitle || (
                                <Tooltip content="The referenced article either no longer exists on the feed or has no title">
                                  <Text color="fg.muted" fontStyle="italic">
                                    (unknown article title)
                                  </Text>
                                </Tooltip>
                              )}
                            </Skeleton>
                          </Table.Cell>
                          <Table.Cell>
                            <Skeleton loading={fetchStatus !== "idle"}>
                              {createStatusLabel({ status: item.status })}
                            </Skeleton>
                          </Table.Cell>
                          <Table.Cell>
                            <Skeleton loading={fetchStatus !== "idle"}>
                              <HStack>
                                <span>{item.details?.message}</span>
                                {item.details?.data && (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() =>
                                      setDetailsData(JSON.stringify(item.details?.data, null, 2))
                                    }
                                  >
                                    <Icon as={FaMagnifyingGlass} />
                                    View Details
                                  </Button>
                                )}
                              </HStack>
                            </Skeleton>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              </Table.ScrollArea>
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
                  <span>Previous Page</span>
                </Button>
                <Button
                  width="min-content"
                  size="sm"
                  onClick={() => {
                    if (fetchStatus === "fetching" || data?.result.logs.length === 0) {
                      return;
                    }

                    nextPage();
                  }}
                  disabled={fetchStatus === "fetching" || data?.result.logs.length === 0}
                >
                  <span>Next Page</span>
                </Button>
              </HStack>
            </Flex>
          </Stack>
        )}
      </Box>
    </Stack>
  );
};
