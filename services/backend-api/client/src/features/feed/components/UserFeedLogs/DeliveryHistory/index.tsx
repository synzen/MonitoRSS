/* eslint-disable @typescript-eslint/dot-notation */
import {
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
  Link as ChakraLink,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  chakra,
  Tooltip,
  Divider,
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Search2Icon } from "@chakra-ui/icons";
import { useUserFeedArticles, useUserFeedDeliveryLogsWithPagination } from "../../../hooks";
import { UserFeedDeliveryLogStatus } from "../../../types";
import { InlineErrorAlert } from "../../../../../components";
import { pages } from "../../../../../constants";
import { FeedConnectionType } from "../../../../../types";
import { useUserFeedContext } from "../../../../../contexts/UserFeedContext";

const createStatusLabel = ({ status }: { status: UserFeedDeliveryLogStatus }) => {
  if (status === UserFeedDeliveryLogStatus.DELIVERED) {
    return (
      <Badge fontSize="sm" colorScheme="green">
        Delivered
      </Badge>
    );
  }

  if (status === UserFeedDeliveryLogStatus.PARTIALLY_DELIVERED) {
    return (
      <Badge fontSize="sm" colorScheme="yellow">
        Partially Delivered
      </Badge>
    );
  }

  if (status === UserFeedDeliveryLogStatus.FAILED) {
    return (
      <Badge fontSize="sm" colorScheme="red">
        Internal Error
      </Badge>
    );
  }

  if (status === UserFeedDeliveryLogStatus.ARTICLE_RATE_LIMITED) {
    return (
      <Badge fontSize="sm" colorScheme="orange">
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
      <Badge fontSize="sm" colorScheme="red">
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
    <Stack spacing={4} mb={16} border="solid 1px" borderColor="gray.700" borderRadius="md">
      <Modal isOpen={!!detailsData} onClose={onCloseDetailsModal} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delivery Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <chakra.pre overflow="auto" padding={2} bg="gray.800">
              {detailsData}
            </chakra.pre>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onCloseDetailsModal}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Box>
        <Stack px={4} py={4}>
          <Heading as="h3" size="sm" m={0} id="delivery-history-table-title">
            Article Delivery History
          </Heading>
          <Text color="whiteAlpha.700" fontSize="sm">
            Delivery attempts for articles across all connections.
          </Text>
        </Stack>
        <Box px={4}>
          <Divider />
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
            <Text color="whiteAlpha.700">
              There have been no delivery attempts. Attempts will be logged as soon as new articles
              are found on the feed for delivery to enabled connections.
            </Text>
          </Box>
        )}
        {data?.result && !hasNoData && (
          <Stack>
            <Box>
              <TableContainer>
                <Table size="sm" variant="simple" aria-labelledby="delivery-history-table-title">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Connection</Th>
                      <Th>Article Title</Th>
                      <Th>Status</Th>
                      <Th>Details</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.result.logs.map((item) => {
                      const connection = userFeed.connections.find((c) => c.id === item.mediumId);
                      const matchedArticle = articles?.result.articles.find(
                        (a) => a.idHash === item.articleIdHash,
                      );

                      // @ts-ignore
                      const articleTitle = matchedArticle?.["title"] || item.articleData?.title;

                      return (
                        <Tr key={item.id}>
                          <Td>
                            <Skeleton isLoaded={fetchStatus === "idle"}>
                              {dayjs(item.createdAt).format("DD MMM YYYY, HH:mm:ss")}
                            </Skeleton>
                          </Td>
                          <Td>
                            <Skeleton isLoaded={fetchStatus === "idle"}>
                              {!connection && (
                                <Text color="whiteAlpha.700" fontStyle="italic">
                                  (deleted connection)
                                </Text>
                              )}
                              {connection && (
                                <ChakraLink
                                  as={Link}
                                  fontWeight="semibold"
                                  to={pages.userFeedConnection({
                                    feedId: userFeed.id,
                                    connectionType: connection?.key as FeedConnectionType,
                                    connectionId: item.mediumId,
                                  })}
                                  color="blue.300"
                                >
                                  {connection?.name || item.mediumId}
                                </ChakraLink>
                              )}
                            </Skeleton>
                          </Td>
                          <Td maxWidth="300px">
                            <Skeleton
                              overflow="hidden"
                              textOverflow="ellipsis"
                              isLoaded={
                                fetchStatus === "idle" &&
                                !!(
                                  matchedArticle ||
                                  articlesError ||
                                  (articlesFetchStatus === "idle" && !matchedArticle)
                                )
                              }
                            >
                              {articleTitle || (
                                <Tooltip label="The referenced article either no longer exists on the feed or has no title">
                                  <Text color="whiteAlpha.700" fontStyle="italic">
                                    (unknown article title)
                                  </Text>
                                </Tooltip>
                              )}
                            </Skeleton>
                          </Td>
                          <Td>
                            <Skeleton isLoaded={fetchStatus === "idle"}>
                              {createStatusLabel({ status: item.status })}
                            </Skeleton>
                          </Td>
                          <Td>
                            <Skeleton isLoaded={fetchStatus === "idle"}>
                              <HStack>
                                <span>{item.details?.message}</span>
                                {item.details?.data && (
                                  <Button
                                    leftIcon={<Search2Icon />}
                                    size="xs"
                                    variant="outline"
                                    onClick={() =>
                                      setDetailsData(JSON.stringify(item.details?.data, null, 2))
                                    }
                                  >
                                    View Details
                                  </Button>
                                )}
                              </HStack>
                            </Skeleton>
                          </Td>
                        </Tr>
                      );
                    })}
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
                  isDisabled={fetchStatus === "fetching" || data?.result.logs.length === 0}
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
