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
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  chakra,
  Tooltip,
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Search2Icon } from "@chakra-ui/icons";
import {
  useUserFeed,
  useUserFeedArticles,
  useUserFeedDeliveryLogsWithPagination,
} from "../../../hooks";
import { UserFeedDeliveryLogStatus } from "../../../types";
import { InlineErrorAlert } from "../../../../../components";
import { pages } from "../../../../../constants";
import { FeedConnectionType } from "../../../../../types";

interface Props {
  feedId?: string;
}

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

export const DeliveryHistory = ({ feedId }: Props) => {
  const [detailsData, setDetailsData] = useState("");
  const { feed, error: feedError } = useUserFeed({ feedId });
  const { data, status, error, skip, nextPage, prevPage, fetchStatus } =
    useUserFeedDeliveryLogsWithPagination({
      feedId,
      data: {},
    });
  const { data: articles, error: articlesError } = useUserFeedArticles({
    feedId,
    disabled: !data?.result.logs.length,
    data: {
      filters: {
        articleIdHashes: data?.result.logs.map((l) => l.articleIdHash),
      },
      formatter: {
        options: {
          dateFormat: feed?.formatOptions?.dateFormat,
          dateTimezone: feed?.formatOptions?.dateTimezone,
          formatTables: false,
          stripImages: false,
          disableImageLinkPreviews: false,
        },
        customPlaceholders: [],
      },
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
    <Stack spacing={4} mb={16}>
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
      <Heading size="md">Article Delivery History</Heading>
      {status === "loading" && (
        <Center>
          <Spinner />
        </Center>
      )}
      {error && (
        <InlineErrorAlert title="Failed to get delivery logs" description={error.message} />
      )}
      {hasNoData && (
        <Text color="whiteAlpha.700">
          There have been no delivery attempts. Attempts will be logged as soon as new articles are
          found on the feed for delivery to enabled connections.
        </Text>
      )}
      {data?.result && !hasNoData && (
        <Stack>
          <Box border="solid 1px" borderColor="gray.600" borderRadius="md">
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Connection</Th>
                    <Th>Article</Th>
                    <Th>Status</Th>
                    <Th>Details</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {data.result.logs.map((item) => {
                    const connection = feed?.connections.find((c) => c.id === item.mediumId);
                    const matchedArticle = articles?.result.articles.find(
                      (a) => a.idHash === item.articleIdHash
                    );

                    return (
                      <Tr key={item.id}>
                        <Td>{dayjs(item.createdAt).format("DD MMM YYYY, HH:mm:ss")}</Td>
                        <Td>
                          <Skeleton isLoaded={!!(feed || feedError)}>
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
                                  feedId: feedId as string,
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
                              !!(matchedArticle || articlesError || (articles && !matchedArticle))
                            }
                          >
                            {!matchedArticle && (
                              <Tooltip label="The referenced article either no longer exists on the feed or has no title">
                                <Text color="whiteAlpha.700" fontStyle="italic">
                                  (unknown article)
                                </Text>
                              </Tooltip>
                            )}
                            {matchedArticle &&
                              // @ts-ignore
                              matchedArticle?.["title"] &&
                              // @ts-ignore
                              matchedArticle?.["title"]}
                            {/* @ts-ignore */}
                            {matchedArticle && !matchedArticle?.["title"] && (
                              <Text color="whiteAlpha.700" fontStyle="italic">
                                (no title)
                              </Text>
                            )}
                          </Skeleton>
                        </Td>
                        <Td>{createStatusLabel({ status: item.status })}</Td>
                        <Td>
                          {item.details?.message}
                          {item.details?.data && (
                            <IconButton
                              aria-label="View details"
                              ml={1}
                              icon={<Search2Icon />}
                              size="xs"
                              variant="link"
                              onClick={() =>
                                setDetailsData(JSON.stringify(item.details?.data, null, 2))
                              }
                            />
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
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
                Previous
              </Button>
              <Button
                width="min-content"
                size="sm"
                onClick={nextPage}
                isDisabled={fetchStatus === "fetching" || data?.result.logs.length === 0}
              >
                Next
              </Button>
            </HStack>
          </Flex>
        </Stack>
      )}
    </Stack>
  );
};
