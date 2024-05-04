/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react/jsx-props-no-spreading */
import {
  Alert,
  AlertIcon,
  ButtonGroup,
  Center,
  Flex,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Table,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Box,
  InputRightElement,
  Spinner,
  HStack,
  Tooltip,
  Button,
  Link as ChakraLink,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { useEffect, useMemo } from "react";
import { useTable, usePagination, Column, useGlobalFilter } from "react-table";
import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "@chakra-ui/icons";
import { debounce } from "lodash";
import { Link } from "react-router-dom";
import {
  useCreateServerLegacyFeedBulkConversion,
  useFeeds,
  useLegacyFeedCount,
  useSeverLegacyFeedBulkConversion,
} from "../../hooks";
import { Feed } from "@/types";
import { ConfirmModal, Loading } from "@/components";
import { DiscordChannelName } from "@/features/discordServers/components/DiscordChannelName";
import { FeedStatusTag } from "./FeedStatusTag";
import { pages } from "../../../../constants";
import { BulkLegacyFeedConversionDialog } from "../BulkLegacyFeedConversionDialog";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { notifyError } from "../../../../utils/notifyError";

interface Props {
  serverId?: string;
  selectedFeedId?: string;
  onSelectedFeedId?: (feedId: string) => void;
}

const DEFAULT_MAX_PER_PAGE = 10;

const maxPerPage = DEFAULT_MAX_PER_PAGE;

export const FeedsTable: React.FC<Props> = ({ serverId, selectedFeedId, onSelectedFeedId }) => {
  const { t } = useTranslation();
  const { data, status, error, setOffset, isFetchingNewPage, search, setSearch, isFetching } =
    useFeeds({
      serverId,
      initialLimit: maxPerPage,
    });
  const { data: legacyFeedCountData, status: legacyFeedCountStatus } = useLegacyFeedCount({
    serverId,
  });
  const { data: legacyConversionData, status: legacyConversionStatus } =
    useSeverLegacyFeedBulkConversion(
      {
        serverId,
      },
      {
        disablePolling: true,
      }
    );
  const { mutateAsync: createConvert, status: createConvertStatus } =
    useCreateServerLegacyFeedBulkConversion();

  const onStartBulkConversion = async () => {
    try {
      if (!serverId) {
        return;
      }

      await createConvert({ serverId });
      notifySuccess("Conversion has started for this server. This may take a while.");
    } catch (err) {
      notifyError("Failed to start conversion", (err as Error).message);
    }
  };

  const tableData = useMemo(
    () =>
      (data?.results || []).map((feed) => ({
        id: feed.id,
        status: feed.status,
        title: feed.title,
        url: feed.url,
        channel: feed.channel,
      })),
    [data]
  );

  const total = data?.total || 0;

  const columns = useMemo<Column<Pick<Feed, "status" | "title" | "url" | "channel" | "id">>[]>(
    () => [
      {
        Header: t("pages.feeds.tableStatus") as string,
        accessor: "status", // accessor is the "key" in the data
        Cell: ({ cell: { value } }) => <FeedStatusTag status={value} />,
      },
      {
        Header: t("pages.feeds.tableTitle") as string,
        accessor: "title",
      },
      {
        Header: t("pages.feeds.tableUrl") as string,
        accessor: "url",
      },
      {
        Header: t("pages.feeds.tableChannel") as string,
        accessor: "channel",
        Cell: ({ cell: { value } }) => <DiscordChannelName serverId={serverId} channelId={value} />,
      },
    ],
    [serverId]
  );

  const tableInstance = useTable(
    {
      columns,
      data: tableData,
      manualPagination: true,
      manualGlobalFilter: true,
      pageCount: Math.ceil(total / maxPerPage),
      initialState: {
        pageSize: maxPerPage,
      },
    },
    useGlobalFilter,
    usePagination
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    nextPage,
    canNextPage,
    previousPage,
    canPreviousPage,
    page,
    setGlobalFilter,
    state: { pageIndex },
  } = tableInstance;

  useEffect(() => {
    setOffset(pageIndex * maxPerPage);
  }, [pageIndex]);

  const onClickFeedRow = (feedId: string) => {
    onSelectedFeedId?.(feedId);
  };

  const onSearchChange = debounce((value: string) => {
    setGlobalFilter(value);
    setSearch(value);
  }, 500);

  if (
    status === "loading" ||
    legacyFeedCountStatus === "loading" ||
    legacyConversionStatus === "loading"
  ) {
    return (
      <Center width="100%" height="100%">
        <Loading size="lg" />
      </Center>
    );
  }

  if (status === "error") {
    return (
      <Alert status="error">
        <AlertIcon />
        {error?.message}
      </Alert>
    );
  }

  return (
    <Stack>
      <Box mb={2}>
        <Text>
          Legacy feeds can no longer be added.{" "}
          <ChakraLink as={Link} to={pages.userFeeds()} color="blue.300">
            Please transition to personal feeds instead.
          </ChakraLink>
        </Text>
      </Box>
      {legacyFeedCountData?.result?.total && (
        <Alert status="error" borderRadius="md" overflow="visible" mb={4}>
          <AlertIcon />
          <Stack>
            <Box>
              <AlertTitle>You have unconverted legacy feeds in this server!</AlertTitle>
              <AlertDescription>
                On October 1 2023, legacy feeds will start getting disabled to complete the
                transition to personal feeds. By November 1 2023, all legacy feeds will be disabled.
                To prevent disruption to article delivery, please convert all legacy feeds to
                personal feeds as soon as possible. To convert an individual feed, you may click on
                one in the table below to see the option to do so.
              </AlertDescription>
            </Box>
            {legacyConversionData &&
              (legacyConversionData.status === "NOT_STARTED" ||
                legacyConversionData.status === "PARTIALLY_COMPLETED") && (
                <ConfirmModal
                  trigger={
                    <Button
                      width="min-content"
                      variant="outline"
                      isLoading={createConvertStatus === "loading"}
                    >
                      <span>Convert Server Feeds</span>
                    </Button>
                  }
                  title="Heads up!"
                  size="lg"
                  onConfirm={onStartBulkConversion}
                  okText="Convert Server Feeds"
                  colorScheme="purple"
                  descriptionNode={
                    <Stack>
                      <Alert status="warning">
                        <AlertIcon fontSize={24} />
                        <Stack>
                          <AlertTitle>This may not be a perfect conversion!</AlertTitle>
                          <AlertDescription>
                            Double check that everything is as expected afterwards, or feeds may get
                            disabled due to errors during delivery attempts. There is a high
                            likelyhood that some manual adjustments are needed. If you enounter any
                            major issues, you create a thread in the{" "}
                            <ChakraLink
                              href="https://discord.com/invite/pudv7Rx"
                              target="_blank"
                              rel="noreferrer"
                              color="blue.300"
                            >
                              support server
                            </ChakraLink>{" "}
                            for help.
                          </AlertDescription>
                        </Stack>
                      </Alert>
                      <br />
                      <Text>
                        Legacy feeds will be permanently disabled after the conversion, and subject
                        to deletion once all legacy feeds have been converted to personal feeds.
                      </Text>
                      <Text>
                        If multiple people manage this server&apos;s feeds, you converting them will
                        make them only visible to you. Make sure the right person is converting the
                        feeds!
                      </Text>
                      <Text>
                        <Button variant="link" as={Link} to={pages.userFeedsFaq()} color="blue.300">
                          Click here to see more information on what personal feeds are.
                        </Button>
                      </Text>
                    </Stack>
                  }
                />
              )}
            {legacyConversionData &&
              (legacyConversionData.status === "IN_PROGRESS" ||
                legacyConversionData.status === "COMPLETED" ||
                legacyConversionData.status === "COMPLETED_WITH_FAILED") && (
                <BulkLegacyFeedConversionDialog
                  trigger={
                    <Button display="block" width="min-content" variant="outline">
                      View Conversion Progress
                    </Button>
                  }
                  serverId={serverId}
                />
              )}
            {/* <BulkLegacyFeedConversionDialog />} */}
          </Stack>
        </Alert>
      )}
      <HStack justifyContent="space-between" flexWrap="wrap">
        <InputGroup width="min-content">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            onChange={({ target: { value } }) => {
              onSearchChange(value);
            }}
            minWidth="325px"
            placeholder={t("pages.feeds.tableSearch")}
          />
          <InputRightElement>{search && isFetching && <Spinner size="sm" />}</InputRightElement>
        </InputGroup>
        <Tooltip label="Legacy feeds can no longer be added. Please transition to personal feeds instead.">
          <Button colorScheme="blue" isDisabled>
            {t("features.feed.components.addFeedDialog.addButton")}
          </Button>
        </Tooltip>
      </HStack>
      <Box overflow="auto">
        <Table
          {...getTableProps()}
          whiteSpace="nowrap"
          marginBottom="5"
          background="gray.850"
          borderColor="gray.700"
          borderWidth="2px"
          boxShadow="lg"
        >
          <Thead>
            {headerGroups.map((headerGroup) => (
              <Tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map((column) => (
                  <Th {...column.getHeaderProps()}>{column.render("Header")}</Th>
                ))}
              </Tr>
            ))}
          </Thead>
          <tbody {...getTableBodyProps()}>
            {page.map((row) => {
              prepareRow(row);
              const feed = row.original;

              return (
                <Tr
                  {...row.getRowProps()}
                  tabIndex={0}
                  zIndex={100}
                  position="relative"
                  bg={selectedFeedId === feed.id ? "gray.700" : undefined}
                  _hover={{
                    bg: "gray.700",
                    cursor: "pointer",
                    boxShadow: "outline",
                  }}
                  _focus={{
                    boxShadow: "outline",
                    outline: "none",
                  }}
                  onClick={() => onClickFeedRow(feed.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onClickFeedRow(feed.id);
                    }
                  }}
                >
                  {row.cells.map((cell) => (
                    <Td
                      {...cell.getCellProps()}
                      maxWidth="250px"
                      overflow="hidden"
                      textOverflow="ellipsis"
                    >
                      {cell.render("Cell")}
                    </Td>
                  ))}
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Box>
      <Flex justifyContent="space-between" flexWrap="wrap">
        <Text marginBottom="4">
          {t("pages.feeds.tableResults", {
            start: pageIndex * maxPerPage + 1,
            end: Math.min((pageIndex + 1) * maxPerPage, total),
            total,
          })}
        </Text>
        <ButtonGroup>
          <IconButton
            icon={<ChevronLeftIcon />}
            aria-label="Previous page"
            onClick={previousPage}
            isDisabled={isFetchingNewPage || !canPreviousPage}
          />
          <Flex alignItems="center">
            <Text>{pageIndex + 1}</Text>
            <span>/</span>
            <Text>{Math.ceil(total / maxPerPage)}</Text>
          </Flex>
          <IconButton
            icon={<ChevronRightIcon />}
            aria-label="Next page"
            onClick={nextPage}
            isDisabled={isFetchingNewPage || !canNextPage}
            isLoading={isFetchingNewPage}
          />
        </ButtonGroup>
      </Flex>
    </Stack>
  );
};
