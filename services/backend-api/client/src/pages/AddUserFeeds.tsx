/* eslint-disable no-await-in-loop */
import {
  Alert,
  Box,
  Button,
  Heading,
  HStack,
  Link,
  List,
  Stack,
  Table,
  Text,
  Separator,
  Textarea,
  Spinner,
  ProgressRoot,
  ProgressTrack,
  ProgressRange,
  BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbCurrentLink,
  BreadcrumbSeparator,
  Flex,
} from "@chakra-ui/react";
import {
  FaArrowUp,
  FaCheck,
  FaXmark,
  FaUpRightFromSquare,
  FaClock,
  FaChevronRight,
} from "react-icons/fa6";
import { RefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { BoxConstrained } from "../components";
import { Panel } from "@/components/Panel";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { pages, ProductKey } from "../constants";
import { ensureUrlScheme, useCreateUserFeed, useUserFeeds } from "../features/feed";
import { useCreateUserFeedUrlValidation } from "../features/feed/hooks/useCreateUserFeedUrlValidation";
import { useDiscordUserMe, useUserMe } from "../features/discordUser";
import { PricingDialogContext } from "@/features/subscriptionProducts";
import { SourceFeedContext, SourceFeedProvider, SourceFeedSelector } from "@/features/feed";
import { useCreateUserFeedDeduplicatedUrls } from "../features/feed/hooks/useCreateUserFeedDeduplicatedUrls";
import { notifyInfo } from "../utils/notifyInfo";
import { CloseButton } from "@/components/ui/close-button";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AccordionRoot,
  AccordionItem,
  AccordionItemTrigger,
  AccordionItemContent,
} from "@/components/ui/accordion";

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
    <Table.Row>
      <Table.Cell whiteSpace="break-spaces">
        {controlPaneLink ? (
          <Box>
            <Link
              href={controlPaneLink}
              target="_blank"
              color="text.link"
              display="flex"
              alignItems="center"
            >
              {title}
              <FaUpRightFromSquare style={{ marginLeft: "4px" }} />
            </Link>
          </Box>
        ) : (
          title || "-"
        )}
      </Table.Cell>
      <Table.Cell wordBreak="break-all" whiteSpace="break-spaces">
        {url}
      </Table.Cell>
      <Table.Cell whiteSpace="break-spaces">
        {status === "success" && (
          <HStack alignItems="center">
            <FaCheck color="text.success" />
            <Text color="text.success">Succeeded</Text>
          </HStack>
        )}
        {status === "failed" && (
          <HStack alignItems="center">
            <FaXmark color="text.error" />
            <Text color="text.error">Failed</Text>
          </HStack>
        )}
        {status === "prompt-url-change" && (
          <HStack alignItems="center">
            <FaXmark color="text.error" />
            <Text color="text.error">Failed, but found alternate feed</Text>
          </HStack>
        )}
        {status === "pending" && (
          <HStack alignItems="center">
            <FaClock color="fg.muted" />
            <Text color="fg.muted">Pending</Text>
          </HStack>
        )}
      </Table.Cell>
      {alternateUrl && (
        <Table.Cell whiteSpace="break-spaces">
          <Stack>
            <Text>
              Invalid feed, but an alternate valid feed was found:{" "}
              <Link href={alternateUrl} target="_blank" color="text.link">
                {alternateUrl} <FaUpRightFromSquare aria-hidden />
              </Link>
            </Text>
          </Stack>
        </Table.Cell>
      )}
      {!alternateUrl && <Table.Cell whiteSpace="break-spaces">{error || "-"}</Table.Cell>}
    </Table.Row>
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
    <Alert.Root status={hasCompleted ? "success" : "info"} hidden={!isOpen}>
      <HStack gap={4} width="100%">
        {!hasCompleted ? <Spinner size="md" /> : <FaCheck fontSize={18} />}
        <Stack flex={1} gap={1}>
          <Alert.Title id="processing-feeds">
            {!hasCompleted
              ? `Processing ${total} feeds...`
              : `Successfully processed ${total} feeds`}
          </Alert.Title>
          <Alert.Description flex={1}>
            {hasCompleted && <Text>See Summary for results</Text>}
            {!hasCompleted && (
              <Text>Do not navigate away from this page until processing is complete</Text>
            )}
            <HStack alignItems="center">
              <ProgressRoot
                value={Math.round(percentCompleted)}
                borderRadius="l3"
                flex={1}
                colorPalette={hasCompleted ? "green" : "brand"}
                aria-labelledby="processing-feeds"
                aria-valuetext={`${Math.round(
                  percentCompleted,
                )}%, ${feedsRemaining} feeds remaining`}
              >
                <ProgressTrack>
                  <ProgressRange />
                </ProgressTrack>
              </ProgressRoot>
              <Text>{Math.round(percentCompleted)}%</Text>
            </HStack>
          </Alert.Description>
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
    </Alert.Root>
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
    })),
  );
  const totalSucceeded = allResults.filter((r) => r.status === "success").length;
  const totalFailed = allResults.filter(
    (r) => r.status === "failed" || r.status === "prompt-url-change",
  ).length;
  const { mutateAsync: createUserFeed } = useCreateUserFeed();
  const { mutateAsync: createUrlValidation } = useCreateUserFeedUrlValidation();
  const navigate = useNavigate();

  const total = allResults.length;
  const percentSucceeded = ((totalSucceeded / total) * 100).toFixed(2);
  const percentFailed = ((totalFailed / total) * 100).toFixed(2);

  const resultsWithAlternateUrls = allResults.filter((r) => r.alternateUrl);
  const alternateUrls = Array.from(
    new Set(allResults.filter((r) => r.alternateUrl).map((r) => r.alternateUrl)),
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
        }),
      );
    },
    [createUrlValidation, createUserFeed, sourceFeed?.id],
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
    <Stack gap={6}>
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
      <Stack gap={6} aria-busy={isInProgress}>
        <Alert.Root status="info" role={undefined}>
          <Alert.Indicator />
          <Alert.Description>
            After you navigate away from this page, the following information will no longer be
            available.
          </Alert.Description>
        </Alert.Root>
        <Stack mb={4} gap={6}>
          <Heading as="h2" size="lg">
            Summary
          </Heading>
          <Panel p={4}>
            <List.Root listStyleType="none" margin={0} display="flex" gap={16}>
              <List.Item>
                <Text fontWeight="semibold">Succeeded</Text>
                <HStack alignItems="center">
                  {isInProgress && <FaClock color="fg.muted" aria-label="In progress" />}
                  {hasCompleted && totalSucceeded > 0 && (
                    <FaCheck color="text.success" aria-hidden />
                  )}
                  <Text color={hasCompleted && totalSucceeded > 0 ? "text.success" : ""}>
                    {totalSucceeded} ({percentSucceeded}%)
                  </Text>
                </HStack>
              </List.Item>
              <List.Item>
                <Text fontWeight="semibold">Failed</Text>
                <HStack alignItems="center">
                  {isInProgress && <FaClock color="fg.muted" aria-label="In progress" />}
                  {hasCompleted && totalFailed > 0 && <FaXmark color="text.error" aria-hidden />}
                  <Text color={hasCompleted && totalFailed > 0 ? "text.error" : ""}>
                    {totalFailed} ({percentFailed}%)
                  </Text>
                </HStack>
              </List.Item>
            </List.Root>
            {alternateUrls.length > 0 && hasCompleted && (
              <>
                <Separator my={4} />
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
                  <Field mt={4} label="Alternate Feed Links">
                    <Textarea rows={6} value={alternateUrls.join("\n")} readOnly />
                    <Button
                      mt={2}
                      onClick={() => {
                        navigator.clipboard.writeText(alternateUrls.join("\n"));
                        notifyInfo("Successfully copied alternate feed links");
                      }}
                    >
                      Copy Links
                    </Button>
                  </Field>
                </Stack>
              </>
            )}
          </Panel>
        </Stack>
        <Stack gap={6}>
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
          <Panel overflow="hidden">
            <Table.ScrollArea>
              <Table.Root size="sm" aria-labelledby="feed-results">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Control Panel Link</Table.ColumnHeader>
                    <Table.ColumnHeader>Feed Link</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader>Details</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {allResults.map((data) => (
                    <ResultTableRow {...data} key={data.url} />
                  ))}
                </Table.Body>
              </Table.Root>
            </Table.ScrollArea>
          </Panel>
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
          <PrimaryActionButton
            aria-disabled={firstPendingIndex > -1}
            onClick={() => {
              if (firstPendingIndex > -1) {
                return;
              }

              navigate(pages.userFeeds());
            }}
          >
            Close
          </PrimaryActionButton>
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
    setUrls(
      e.target.value
        .split("\n")
        .filter((url) => url.trim().length > 0)
        .map(ensureUrlScheme),
    );
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
      <BreadcrumbRoot>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <RouterLink to={pages.userFeeds()}>Feeds</RouterLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <FaChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbCurrentLink>Add Feeds</BreadcrumbCurrentLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </BreadcrumbRoot>
      <form onSubmit={onSubmit}>
        <Stack gap={6}>
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
              gap={4}
              px={4}
              py={4}
              borderStyle="solid"
              borderWidth={1}
              borderRadius="l3"
              borderColor="border"
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
                <Button variant="outline" onClick={onOpenPricingDialog}>
                  <FaArrowUp />
                  Increase Limits
                </Button>
              </HStack>
              <HStack separator={<Separator orientation="vertical" />}>
                <Stack flex={1}>
                  <Heading as="h3" size="sm" fontWeight="semibold">
                    Feed Limit
                  </Heading>
                  <Text
                    hidden={!userFeedsResults || !discordUserMe}
                    color={isAtFeedLimit ? "text.error" : undefined}
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
              gap={6}
              p={4}
              borderStyle="solid"
              borderWidth={1}
              borderRadius="l3"
              borderColor="border"
            >
              <Heading as="h2" size="md" id="faq-accordion">
                Frequently Asked Questions
              </Heading>
              <AccordionRoot collapsible role="list">
                <AccordionItem value="what-is-rss" role="listitem">
                  <AccordionItemTrigger>
                    <Flex flex="1" gap={4} alignItems="center" textAlign="left">
                      What is an RSS feed link?
                    </Flex>
                  </AccordionItemTrigger>
                  <AccordionItemContent>
                    <Text>
                      An RSS feed link is a link to a specially-formatted webpage with XML text
                      that&apos;s designed to contain news articles. An example of an RSS feed link
                      is{" "}
                      <Link
                        href="https://www.ign.com/rss/articles/feed"
                        rel="noopener noreferrer"
                        color="text.link"
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
                  </AccordionItemContent>
                </AccordionItem>
                <AccordionItem value="how-to-find-rss" role="listitem">
                  <AccordionItemTrigger>
                    <Flex flex="1" gap={4} alignItems="center" textAlign="left">
                      How do I find RSS feed links?
                    </Flex>
                  </AccordionItemTrigger>
                  <AccordionItemContent>
                    <Text>
                      You can find links to RSS feed pages by searching for what you&apos;re looking
                      for, plus &quot;RSS feed&quot;, such as &quot;podcast RSS feeds&quot;. You may
                      also contact site owners for links to RSS feeds they may have. An example RSS
                      feed link is{" "}
                      <Link
                        href="https://www.ign.com/rss/articles/feed"
                        rel="noopener noreferrer"
                        color="text.link"
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
                  </AccordionItemContent>
                </AccordionItem>
                <AccordionItem value="how-to-deliver" role="listitem">
                  <AccordionItemTrigger>
                    <Flex flex="1" gap={4} alignItems="center" textAlign="left">
                      How do I specify where articles get delivered to?
                    </Flex>
                  </AccordionItemTrigger>
                  <AccordionItemContent>
                    <Text>
                      After a feed has been added, you can navigate to the feed&apos;s control panel
                      link and add connections. Connections are destinations where articles are sent
                      to, such as specific Discord channels.
                      <br />
                      <br />
                      You can also copy a feed&apos;s connections to other feed to avoid having to
                      manually add the same connections to multiple feeds.
                    </Text>
                  </AccordionItemContent>
                </AccordionItem>
                <AccordionItem value="when-delivered" role="listitem">
                  <AccordionItemTrigger>
                    <Flex flex="1" gap={4} alignItems="center" textAlign="left">
                      When do new articles get delivered?
                    </Flex>
                  </AccordionItemTrigger>
                  <AccordionItemContent>
                    <Text>
                      With RSS, article delivery is not instant. New articles are checked on a
                      regular interval (every 20 minutes by default for free). Once new articles are
                      found, they are automatically delivered.
                    </Text>
                  </AccordionItemContent>
                </AccordionItem>
              </AccordionRoot>
            </Stack>
          </Stack>
          <Stack gap={2}>
            <Field
              invalid={error === "EMPTY"}
              required
              label="RSS Feed Links"
              errorText={error === "EMPTY" ? "At least one feed link is required" : undefined}
              helperText={
                <Text mb={3}>
                  Add one RSS feed link per line. Feed titles will be automatically generated.
                  Duplicate links will be ignored.
                </Text>
              }
            >
              <AutoResizeTextarea aria-invalid={!!error} minRows={10} onChange={onChange} />
            </Field>
            <Checkbox
              w="100%"
              onCheckedChange={(details) => setIgnoreExisting(!!details.checked)}
              py={3}
              px={4}
              required={false}
              borderStyle="solid"
              borderWidth={1}
              borderColor={ignoreExisting ? "brand.focusRing" : "border"}
              borderRadius="l3"
              bg="bg.panel"
            >
              <Box ml={2}>
                <Text>Ignore feed links that are already added</Text>
                <Text fontSize="sm" color="fg.muted">
                  If any of the input links have the same link as any of your existing feeds, they
                  will be ignored.
                </Text>
              </Box>
            </Checkbox>
          </Stack>
          <Stack gap={4}>
            <Box>
              <Text>Source Feed</Text>
              <Text color="fg.muted">
                Optionally copy settings from an existing feed that will be applied to the new
                feeds.
              </Text>
            </Box>
            <Box>
              <SourceFeedSelector />
            </Box>
          </Stack>
          {error === "WILL_EXCEED_LIMIT" && (
            <Alert.Root status="error">
              <Alert.Indicator />
              <Stack>
                <Alert.Title>
                  You can only add {remainingFeedsAllowed} more feeds with your current limits. You
                  are attempting to add {urls?.length || 0} feeds.
                </Alert.Title>
                <Alert.Description>
                  <Text>
                    You can increase your limits by choosing to support MonitoRSS&apos;s open-source
                    development and upgrading your plan.
                  </Text>
                  <Button mt={2} onClick={onOpenPricingDialog}>
                    <FaArrowUp />
                    Upgrade Plan
                  </Button>
                </Alert.Description>
              </Stack>
            </Alert.Root>
          )}
          {deduplicateError && (
            <Alert.Root status="error">
              <Alert.Indicator />
              <Alert.Description>
                Failed to deduplicate feed links due to internal error: {deduplicateError.message}.
                Try again later, or try disabling deduplication.
              </Alert.Description>
            </Alert.Root>
          )}
          <HStack justifyContent="flex-end">
            <Button variant="ghost" onClick={() => navigate(pages.userFeeds())}>
              Cancel
            </Button>
            <PrimaryActionButton
              type="submit"
              aria-disabled={deduplicateStatus === "loading"}
              aria-busy={deduplicateStatus === "loading"}
            >
              {deduplicateStatus === "loading" || deduplicateStatus === "success"
                ? "Deduplicating links..."
                : `Add ${urls?.length || 0} feeds`}
            </PrimaryActionButton>
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
          <BoxConstrained.Container paddingTop={6} gap={6} height="100%" mb={12}>
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
