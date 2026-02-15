/* eslint-disable no-await-in-loop */
import {
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Link,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  UnorderedList,
  ListItem,
  Divider,
  Textarea,
  Spinner,
  Progress,
  CloseButton,
  AlertTitle,
  Accordion,
  AccordionItem,
  AccordionButton,
  Flex,
  AccordionIcon,
  AccordionPanel,
  StackDivider,
  FormErrorMessage,
  Checkbox,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Alert,
} from "@chakra-ui/react";
import { ArrowLeftIcon, CheckIcon, CloseIcon, ExternalLinkIcon, TimeIcon } from "@chakra-ui/icons";
import { RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { BoxConstrained } from "../components";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { pages, ProductKey } from "../constants";
import { useCreateUserFeed, useUserFeeds } from "../features/feed";
import { useCreateUserFeedUrlValidation } from "../features/feed/hooks/useCreateUserFeedUrlValidation";
import { useDiscordUserMe, useUserMe } from "../features/discordUser";
import { PricingDialogContext } from "../contexts";
import { SourceFeedContext, SourceFeedProvider } from "../contexts/SourceFeedContext";
import { useCreateUserFeedDeduplicatedUrls } from "../features/feed/hooks/useCreateUserFeedDeduplicatedUrls";
import { notifyInfo } from "../utils/notifyInfo";
import { SourceFeedSelector } from "../components/SourceFeedSelector";

interface RowData {
  url: string;
  title?: string;
  status: "success" | "failed" | "prompt-url-change" | "pending";
  error?: string;
  alternateUrl?: string;
  controlPaneLink?: string;
}

const ResultTableRow = ({ title, url, status, error, alternateUrl, controlPaneLink }: RowData) => {
  return (
    <Tr>
      <Td whiteSpace="break-spaces">
        {controlPaneLink ? (
          <Box>
            <Link
              href={controlPaneLink}
              target="_blank"
              color="blue.300"
              display="flex"
              alignItems="center"
            >
              {title}
              <ExternalLinkIcon ml={1} />
            </Link>
          </Box>
        ) : (
          title || "-"
        )}
      </Td>
      <Td wordBreak="break-all" whiteSpace="break-spaces">
        {url}
      </Td>
      <Td whiteSpace="break-spaces">
        {status === "success" && (
          <HStack alignItems="center">
            <CheckIcon color="green.400" />
            <Text color="green.400">Succeeded</Text>
          </HStack>
        )}
        {status === "failed" && (
          <HStack alignItems="center">
            <CloseIcon color="red.400" />
            <Text color="red.400">Failed</Text>
          </HStack>
        )}
        {status === "prompt-url-change" && (
          <HStack alignItems="center">
            <CloseIcon color="red.400" />
            <Text color="red.400">Failed, but found alternate feed</Text>
          </HStack>
        )}
        {status === "pending" && (
          <HStack alignItems="center">
            <TimeIcon color="gray.400" />
            <Text color="gray.400">Pending</Text>
          </HStack>
        )}
      </Td>
      {alternateUrl && (
        <Td whiteSpace="break-spaces">
          <Stack>
            <Text>
              Invalid feed, but an alternate valid feed was found:{" "}
              <Link href={alternateUrl} target="_blank" color="blue.300">
                {alternateUrl} <ExternalLinkIcon aria-hidden />
              </Link>
            </Text>
          </Stack>
        </Td>
      )}
      {!alternateUrl && <Td whiteSpace="break-spaces">{error || "-"}</Td>}
    </Tr>
  );
};

const ProgressAlert = ({
  total,
  completed,
  closeFocusRef,
}: {
  total: number;
  completed: number;
  closeFocusRef: RefObject<HTMLHeadingElement>;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasCompleted = total === completed;
  const feedsRemaining = total - completed;
  const percentCompleted = (completed / total) * 100;

  const onClose = () => {
    if (!hasCompleted) {
      return;
    }

    setIsOpen(false);
    closeFocusRef.current?.focus();
  };

  return (
    <Alert status={hasCompleted ? "success" : "info"} borderRadius="md" hidden={!isOpen}>
      <HStack gap={4} width="100%">
        {!hasCompleted ? <Spinner size="md" /> : <CheckIcon fontSize={18} />}
        <Stack flex={1} spacing={1}>
          <AlertTitle id="processing-feeds">
            {!hasCompleted
              ? `Processing ${total} feeds...`
              : `Successfully processed ${total} feeds`}
          </AlertTitle>
          <AlertDescription flex={1}>
            {hasCompleted && <Text>See Summary for results</Text>}
            {!hasCompleted && (
              <Text>Do not navigate away from this page until processing is complete</Text>
            )}
            <HStack alignItems="center">
              <Progress
                value={Math.round(percentCompleted)}
                borderRadius="md"
                flex={1}
                colorScheme={hasCompleted ? "green" : "blue"}
                aria-labelledby="processing-feeds"
                aria-valuetext={`${Math.round(
                  percentCompleted
                )}%, ${feedsRemaining} feeds remaining`}
              />
              <Text>{Math.round(percentCompleted)}%</Text>
            </HStack>
          </AlertDescription>
        </Stack>
      </HStack>
      <CloseButton
        alignSelf="flex-start"
        position="relative"
        right={-1}
        top={-1}
        onClick={onClose}
        aria-disabled={!hasCompleted}
        aria-label="Close progress alert"
      />
    </Alert>
  );
};

const UploadProgressView = ({
  urls,
  onClickAddMoreFeeds,
}: {
  urls: string[];
  onClickAddMoreFeeds: () => void;
}) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [allResults, setAllResults] = useState<RowData[]>(
    urls.map((u) => ({
      url: u,
      status: "pending",
    }))
  );
  const totalSucceeded = allResults.filter((r) => r.status === "success").length;
  const totalFailed = allResults.filter(
    (r) => r.status === "failed" || r.status === "prompt-url-change"
  ).length;
  const { mutateAsync: createUserFeed } = useCreateUserFeed();
  const { mutateAsync: createUrlValidation } = useCreateUserFeedUrlValidation();
  const navigate = useNavigate();

  const total = allResults.length;
  const percentSucceeded = ((totalSucceeded / total) * 100).toFixed(2);
  const percentFailed = ((totalFailed / total) * 100).toFixed(2);

  const resultsWithAlternateUrls = allResults.filter((r) => r.alternateUrl);
  const alternateUrls = Array.from(
    new Set(allResults.filter((r) => r.alternateUrl).map((r) => r.alternateUrl))
  );
  const firstPendingIndex = allResults.findIndex((r) => r.status === "pending");
  const isInProgress = firstPendingIndex > -1;
  const hasCompleted = !isInProgress;

  // Access the source feed context
  const { sourceFeed } = useContext(SourceFeedContext);

  const fetchUrl = useCallback(
    async (url: string) => {
      const rowData: RowData = {
        status: "pending",
        url,
      };

      try {
        if (!/^https?:\/\//.test(url)) {
          throw new Error("Invalid feed link. Links must start with http:// or https://");
        }

        const {
          result: { resolvedToUrl },
        } = await createUrlValidation({
          details: {
            url,
          },
        });

        if (resolvedToUrl) {
          rowData.alternateUrl = resolvedToUrl;
          rowData.status = "prompt-url-change";
        } else {
          const {
            result: { title, id },
          } = await createUserFeed({
            details: {
              url,
              sourceFeedId: sourceFeed?.id,
            },
          });

          rowData.title = title;
          rowData.status = "success";
          rowData.controlPaneLink = pages.userFeed(id);
        }
      } catch (err) {
        rowData.status = "failed";
        rowData.error = (err as Error).message;
      }

      setAllResults((prev) =>
        prev.map((r) => {
          if (r.url === url) {
            return rowData;
          }

          return r;
        })
      );
    },
    [createUrlValidation, createUserFeed, sourceFeed?.id]
  );

  useEffect(() => {
    if (firstPendingIndex === -1) {
      return;
    }

    fetchUrl(urls[firstPendingIndex]);
  }, [firstPendingIndex, JSON.stringify(urls.length), fetchUrl]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [headingRef.current]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();

      e.returnValue = true;
    };

    if (hasCompleted) {
      return () => {};
    }

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [hasCompleted]);

  return (
    <Stack spacing={6}>
      <Box>
        <Heading ref={headingRef} as="h1" tabIndex={-1} aria-busy={isInProgress}>
          Add Feeds {isInProgress ? "In Progress" : "Complete"}
        </Heading>
      </Box>
      <ProgressAlert
        total={total}
        completed={totalSucceeded + totalFailed}
        closeFocusRef={headingRef}
      />
      <Stack spacing={6} aria-busy={isInProgress}>
        <Alert status="info" role={undefined} borderRadius="md">
          <AlertIcon />
          <AlertDescription>
            After you navigate away from this page, the following information will no longer be
            available.
          </AlertDescription>
        </Alert>
        <Stack mb={4} spacing={6}>
          <Heading as="h2" size="lg">
            Summary
          </Heading>
          <Box bg="gray.900" borderStyle="solid" borderWidth={1} borderRadius="md" p={4}>
            <UnorderedList listStyleType="none" margin={0} display="flex" gap={16}>
              <ListItem>
                <Text fontWeight="semibold">Succeeded</Text>
                <HStack alignItems="center">
                  {isInProgress && <TimeIcon color="gray.400" aria-label="In progress" />}
                  {hasCompleted && totalSucceeded > 0 && (
                    <CheckIcon color="green.400" aria-hidden />
                  )}
                  <Text color={hasCompleted && totalSucceeded > 0 ? "green.400" : ""}>
                    {totalSucceeded} ({percentSucceeded}%)
                  </Text>
                </HStack>
              </ListItem>
              <ListItem>
                <Text fontWeight="semibold">Failed</Text>
                <HStack alignItems="center">
                  {isInProgress && <TimeIcon color="gray.400" aria-label="In progress" />}
                  {hasCompleted && totalFailed > 0 && <CloseIcon color="red.400" aria-hidden />}
                  <Text color={hasCompleted && totalFailed > 0 ? "red.400" : ""}>
                    {totalFailed} ({percentFailed}%)
                  </Text>
                </HStack>
              </ListItem>
            </UnorderedList>
            {alternateUrls.length > 0 && hasCompleted && (
              <>
                <Divider my={4} />
                <Stack>
                  <Heading as="h3" size="md">
                    {alternateUrls.length} Alternate Feeds Found
                  </Heading>
                  <Text>
                    {resultsWithAlternateUrls.length} feeds could not be added because they were
                    invalid feeds, but alternative feeds were found that might be related. You can
                    choose to copy and use these feed links instead if they contain the content you
                    are looking for.
                  </Text>
                  <FormControl mt={4}>
                    <FormLabel>Alternate Feed Links</FormLabel>
                    <Textarea rows={6} value={alternateUrls.join("\n")} isReadOnly />
                    <Button
                      mt={2}
                      onClick={() => {
                        navigator.clipboard.writeText(alternateUrls.join("\n"));
                        notifyInfo("Successfully copied alternate feed links");
                      }}
                    >
                      Copy Links
                    </Button>
                  </FormControl>
                </Stack>
              </>
            )}
          </Box>
        </Stack>
        <Stack spacing={6}>
          <Stack>
            <Heading as="h2" size="lg" id="feed-results">
              Feed Results
            </Heading>
            <Text>
              Each feed must have their article destinations specified for articles to be sent to.
              Navigate to each feed&apos;s control panel link to add them. You can also copy a
              feed&apos;s connections to other feeds to avoid having to manually add the same
              connections to multiple feeds.
            </Text>
          </Stack>
          <TableContainer
            borderStyle="solid"
            borderWidth={1}
            borderColor="gray.700"
            borderRadius="md"
            bg="gray.900"
          >
            <Table size="sm" aria-labelledby="feed-results">
              <Thead>
                <Tr>
                  <Th>Control Panel Link</Th>
                  <Th>Feed Link</Th>
                  <Th>Status</Th>
                  <Th>Details</Th>
                </Tr>
              </Thead>
              <Tbody>
                {allResults.map((data) => (
                  <ResultTableRow {...data} key={data.url} />
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Stack>
        <HStack justifyContent="flex-end">
          <Button
            aria-disabled={!hasCompleted}
            onClick={() => {
              if (!hasCompleted) {
                return;
              }

              onClickAddMoreFeeds();
            }}
          >
            Add more feeds
          </Button>
          <Button
            aria-disabled={firstPendingIndex > -1}
            colorScheme="blue"
            onClick={() => {
              if (firstPendingIndex > -1) {
                return;
              }

              navigate(pages.userFeeds());
            }}
          >
            Close
          </Button>
        </HStack>
      </Stack>
    </Stack>
  );
};

const AddFormView = ({ onSubmitted }: { onSubmitted: (urls: string[]) => void }) => {
  const { data: discordUserMe } = useDiscordUserMe();
  const { data: userMe } = useUserMe();
  const { data: userFeedsResults } = useUserFeeds({
    limit: 1,
    offset: 0,
  });
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const [urls, setUrls] = useState<string[]>();
  const [ignoreExisting, setIgnoreExisting] = useState(false);
  const [error, setError] = useState<"EMPTY" | "WILL_EXCEED_LIMIT" | "FAILED_TO_DEDUPLICATE">();
  const {
    mutateAsync: deduplicateUrls,
    error: deduplicateError,
    status: deduplicateStatus,
  } = useCreateUserFeedDeduplicatedUrls();
  const navigate = useNavigate();

  const remainingFeedsAllowed =
    discordUserMe && userFeedsResults
      ? Math.max(discordUserMe.maxUserFeeds - userFeedsResults.total, 0)
      : 99999;
  const isAtFeedLimit = remainingFeedsAllowed <= 0;

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setError(undefined);
    setUrls(e.target.value.split("\n").filter((url) => url.trim().length > 0));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (deduplicateStatus === "loading") {
      return;
    }

    if (!urls || urls.length === 0) {
      setError("EMPTY");

      return;
    }

    if (ignoreExisting) {
      try {
        const {
          result: { urls: deduplicatedUrls },
        } = await deduplicateUrls({
          details: {
            urls,
          },
        });

        onSubmitted(deduplicatedUrls);
      } catch (err) {
        setError("FAILED_TO_DEDUPLICATE");
      }
    } else {
      onSubmitted(urls);
    }
  };

  return (
    <Stack>
      <Breadcrumb>
        <BreadcrumbItem>
          <BreadcrumbLink as={RouterLink} to={pages.userFeeds()}>
            Feeds
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink href="#">Add Feeds</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>
      <form onSubmit={onSubmit}>
        <Stack spacing={6}>
          <HStack alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Box>
              <Heading as="h1" tabIndex={-1}>
                Add Feeds
              </Heading>
            </Box>
          </HStack>
          <Stack gap={4}>
            <Stack
              flex={1}
              spacing={4}
              px={4}
              py={4}
              borderStyle="solid"
              borderWidth={1}
              borderRadius="md"
              borderColor="gray.700"
              as="aside"
            >
              <HStack
                justifyContent="space-between"
                alignItems="flex-start"
                flexWrap="wrap"
                gap={4}
                aria-labelledby="limits"
              >
                <Heading as="h2" size="md" id="limits">
                  Limits
                </Heading>
                <Button
                  variant="outline"
                  leftIcon={<ArrowLeftIcon transform="rotate(90deg)" />}
                  onClick={onOpenPricingDialog}
                >
                  Increase Limits
                </Button>
              </HStack>
              <HStack divider={<StackDivider />}>
                <Stack flex={1}>
                  <Heading as="h3" size="sm" fontWeight="semibold">
                    Feed Limit
                  </Heading>
                  <Text
                    hidden={!userFeedsResults || !discordUserMe}
                    color={isAtFeedLimit ? "red.400" : undefined}
                  >
                    {userFeedsResults?.total}/{discordUserMe?.maxUserFeeds}
                  </Text>
                  <Spinner hidden={!!userFeedsResults && !!discordUserMe} />
                </Stack>
                <Stack flex={1}>
                  <Heading as="h3" size="sm" fontWeight="semibold">
                    Daily Article Limit Per Feed
                  </Heading>
                  <Text>
                    {userMe && userMe.result.subscription.product.key !== ProductKey.Free && 1000}
                    {userMe && userMe.result.subscription.product.key === ProductKey.Free && 50}
                    {!userMe && <Spinner />}
                  </Text>
                </Stack>
              </HStack>
            </Stack>
            <Stack
              as="aside"
              aria-labelledby="faq-accordion"
              flex={1}
              spacing={6}
              p={4}
              borderStyle="solid"
              borderWidth={1}
              borderRadius="md"
              borderColor="gray.700"
            >
              <Heading as="h2" size="md" id="faq-accordion">
                Frequently Asked Questions
              </Heading>
              <Accordion allowToggle role="list">
                <AccordionItem role="listitem">
                  <AccordionButton>
                    <Flex flex="1" gap={4} alignItems="center" textAlign="left">
                      <AccordionIcon />
                      What is an RSS feed link?
                    </Flex>
                  </AccordionButton>
                  <AccordionPanel>
                    <Text>
                      An RSS feed link is a link to a specially-formatted webpage with XML text
                      that&apos;s designed to contain news articles. An example of an RSS feed link
                      is{" "}
                      <Link
                        href="https://www.ign.com/rss/articles/feed"
                        rel="noopener noreferrer"
                        color="blue.300"
                        target="_blank"
                      >
                        https://www.ign.com/rss/articles/feed
                      </Link>
                      .
                      <br />
                      <br />
                      To see if a link is a valid RSS feed, you may search for &quot;online feed
                      validators&quot; and input feed URLs to test.
                    </Text>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem role="listitem">
                  <AccordionButton>
                    <Flex flex="1" gap={4} alignItems="center" textAlign="left">
                      <AccordionIcon />
                      How do I find RSS feed links?
                    </Flex>
                  </AccordionButton>
                  <AccordionPanel>
                    <Text>
                      You can find links to RSS feed pages by searching for what you&apos;re looking
                      for, plus &quot;RSS feed&quot;, such as &quot;podcast RSS feeds&quot;. You may
                      also contact site owners for links to RSS feeds they may have. An example RSS
                      feed link is{" "}
                      <Link
                        href="https://www.ign.com/rss/articles/feed"
                        rel="noopener noreferrer"
                        color="blue.300"
                        target="_blank"
                      >
                        https://www.ign.com/rss/articles/feed
                      </Link>
                      .
                      <br />
                      <br />
                      You may also try submitting links to regular webpages and MonitoRSS will
                      attempt to find RSS feeds related to the webpage.
                    </Text>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem role="listitem">
                  <AccordionButton>
                    <Flex flex="1" gap={4} alignItems="center" textAlign="left">
                      <AccordionIcon />
                      How do I specify where articles get delivered to?
                    </Flex>
                  </AccordionButton>
                  <AccordionPanel>
                    <Text>
                      After a feed has been added, you can navigate to the feed&apos;s control panel
                      link and add connections. Connections are destinations where articles are sent
                      to, such as specific Discord channels or webhooks.
                      <br />
                      <br />
                      You can also copy a feed&apos;s connections to other feed to avoid having to
                      manually add the same connections to multiple feeds.
                    </Text>
                  </AccordionPanel>
                </AccordionItem>
                <AccordionItem role="listitem">
                  <AccordionButton>
                    <Flex flex="1" gap={4} alignItems="center" textAlign="left">
                      <AccordionIcon />
                      When do new articles get delivered?
                    </Flex>
                  </AccordionButton>
                  <AccordionPanel>
                    <Text>
                      With RSS, article delivery is not instant. New articles are checked on a
                      regular interval (every 20 minutes by default for free). Once new articles are
                      found, they are automatically delivered.
                    </Text>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </Stack>
          </Stack>
          <FormControl isInvalid={error === "EMPTY"} isRequired>
            <FormLabel>RSS Feed Links</FormLabel>
            <FormHelperText mb={3}>
              Add one RSS feed link per line. Feed titles will be automatically generated. Duplicate
              links will be ignored.
            </FormHelperText>
            <AutoResizeTextarea
              aria-invalid={!!error}
              bg="gray.900"
              minRows={10}
              onChange={onChange}
            />
            <Checkbox
              mt={2}
              w="100%"
              onChange={(e) => setIgnoreExisting(e.target.checked)}
              py={3}
              px={4}
              isRequired={false}
              borderStyle="solid"
              borderWidth={1}
              borderColor={ignoreExisting ? "blue.300" : "whiteAlpha.300"}
              borderRadius="md"
              bg="gray.900"
            >
              <Box ml={2}>
                <Text>Ignore feed links that are already added</Text>
                <Text fontSize="sm" color="gray.400">
                  If any of the input links have the same link as any of your existing feeds, they
                  will be ignored.
                </Text>
              </Box>
            </Checkbox>
            {/* <Checkbox onChange={(e) => setIgnoreExisting(e.target.checked)}>
              <Box ml={2}>
                <Text>Ignore feed links that that are the same link as any existing feeds</Text>
              </Box>
            </Checkbox> */}
            <FormErrorMessage>
              {error === "EMPTY" && "At least one feed link is required"}
              {/* {error === "WILL_EXCEED_LIMIT" &&
                `You can only add ${remainingFeedsAllowed} more feeds with your current limits. You are attempting to add ${
                  urls?.length || 0
                } feeds.`} */}
            </FormErrorMessage>
          </FormControl>
          <Stack spacing={4}>
            <Box>
              <Text>Source Feed</Text>
              <Text color="whiteAlpha.700">
                Optionally copy settings from an existing feed that will be applied to the new
                feeds.
              </Text>
            </Box>
            <Box>
              <SourceFeedSelector />
            </Box>
          </Stack>
          {error === "WILL_EXCEED_LIMIT" && (
            <Alert status="error">
              <AlertIcon />
              <Stack>
                <AlertTitle>
                  You can only add {remainingFeedsAllowed} more feeds with your current limits. You
                  are attempting to add {urls?.length || 0} feeds.
                </AlertTitle>
                <AlertDescription>
                  <Text>
                    You can increase your limits by choosing to support MonitoRSS&apos;s open-source
                    development and upgrading your plan.
                  </Text>
                  <Button
                    leftIcon={<ArrowLeftIcon transform="rotate(90deg)" />}
                    mt={2}
                    onClick={onOpenPricingDialog}
                  >
                    Upgrade Plan
                  </Button>
                </AlertDescription>
              </Stack>
            </Alert>
          )}
          {deduplicateError && (
            <Alert status="error">
              <AlertIcon />
              <AlertDescription>
                Failed to deduplicate feed links due to internal error: {deduplicateError.message}.
                Try again later, or try disabling deduplication.
              </AlertDescription>
            </Alert>
          )}
          <HStack justifyContent="flex-end">
            <Button variant="ghost" onClick={() => navigate(pages.userFeeds())}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              aria-disabled={deduplicateStatus === "loading"}
              aria-busy={deduplicateStatus === "loading"}
            >
              {deduplicateStatus === "loading" || deduplicateStatus === "success"
                ? "Deduplicating links..."
                : `Add ${urls?.length || 0} feeds`}
            </Button>
          </HStack>
        </Stack>
      </form>
    </Stack>
  );
};

const AddUserFeeds = () => {
  const [urls, setUrls] = useState<string[]>([]);

  const onClickAddMoreFeeds = () => {
    setUrls([]);
  };

  useEffect(() => {
    if (urls.length === 0) {
      // focus on h1 element after clicking on add more feeds
      const heading = document.querySelector("h1");

      if (heading) {
        heading.focus();
      }
    }
  }, [urls.length]);

  return (
    <SourceFeedProvider>
      <Box>
        <BoxConstrained.Wrapper justifyContent="flex-start" height="100%" overflow="visible">
          <BoxConstrained.Container paddingTop={6} spacing={6} height="100%" mb={12}>
            {urls.length === 0 && <AddFormView onSubmitted={setUrls} />}
            {urls.length > 0 && (
              <UploadProgressView urls={urls} onClickAddMoreFeeds={onClickAddMoreFeeds} />
            )}
          </BoxConstrained.Container>
        </BoxConstrained.Wrapper>
      </Box>
    </SourceFeedProvider>
  );
};

export default AddUserFeeds;
