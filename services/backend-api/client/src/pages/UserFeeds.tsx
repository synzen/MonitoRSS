import {
  Flex,
  Heading,
  Box,
  HStack,
  Text,
  Stack,
  Button,
  Link as ChakraLink,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  IconButton,
  Portal,
  Skeleton,
  SimpleGrid,
} from "@chakra-ui/react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AddIcon, CheckCircleIcon, ChevronDownIcon, DeleteIcon } from "@chakra-ui/icons";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FaCopy } from "react-icons/fa6";
import { FaPause, FaPlay } from "react-icons/fa";
import { IoDuplicate } from "react-icons/io5";
import { useUserMe, useDiscordUserMe } from "../features/discordUser";
import {
  BrowseFeedsModal,
  CategoryGrid,
  CloneUserFeedDialog,
  FeedDiscoverySearch,
  FeedLimitBar,
  FeedManagementInvitesDialog,
  useCreateUserFeed,
  useCuratedFeeds,
  useDeleteUserFeeds,
  useDisableUserFeeds,
  useEnableUserFeeds,
  UserFeedComputedStatus,
  UserFeedDisabledCode,
  UserFeedsTable,
  useUserFeedManagementInvitesCount,
  useUserFeeds,
} from "../features/feed";
import type { FeedActionState } from "../features/feed";
import type { CuratedFeed } from "../features/feed/types";
import { useDeleteUserFeed } from "../features/feed/hooks/useDeleteUserFeed";
import { ApiErrorCode } from "../utils/getStandardErrorCodeMessage copy";
import ApiAdapterError from "../utils/ApiAdapterError";
import { pages } from "../constants";
import { BoxConstrained, ConfirmModal } from "../components";
import { UserFeedStatusFilterContext } from "../contexts";
import { useMultiSelectUserFeedContext } from "../contexts/MultiSelectUserFeedContext";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../contexts/PageAlertContext";
import { CopyUserFeedSettingsDialog } from "../features/feed/components/CopyUserFeedSettingsDialog";
import { SetupChecklist } from "../features/feed/components/SetupChecklist";
import { useUnconfiguredFeeds } from "../features/feed/hooks/useUnconfiguredFeeds";
import { ReducedLimitAlert } from "../components/ReducedLimitAlert";

export const UserFeeds = () => {
  return (
    <BoxConstrained.Wrapper justifyContent="flex-start" height="100%" overflow="visible">
      <BoxConstrained.Container spacing={6} height="100%">
        <PageAlertProvider>
          <UserFeedsInner />
        </PageAlertProvider>
      </BoxConstrained.Container>
    </BoxConstrained.Wrapper>
  );
};

const CopyUserFeedSettingsMenuItem = ({
  selectedFeedId,
  onSuccess,
}: {
  selectedFeedId?: string;
  onSuccess: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <MenuItem isDisabled={!selectedFeedId} icon={<FaCopy />} onClick={() => setIsOpen(true)}>
        Copy settings to...
      </MenuItem>
      <Portal>
        <CopyUserFeedSettingsDialog
          feedId={selectedFeedId}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSuccess={onSuccess}
        />
      </Portal>
    </>
  );
};

const UserFeedsInner: React.FC = () => {
  const { t } = useTranslation();
  const { state } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: userMeData } = useUserMe();
  const { data: userFeedsRequireAttentionResults } = useUserFeeds({
    limit: 1,
    offset: 0,
    filters: {
      computedStatuses: [UserFeedComputedStatus.RequiresAttention],
    },
  });
  const { data: managementInvitesCount } = useUserFeedManagementInvitesCount();
  const { data: userFeedsResults, refetch: refetchUserFeedsSummary } = useUserFeeds({
    limit: 1,
    offset: 0,
  });
  const { statusFilters, setStatusFilters } = useContext(UserFeedStatusFilterContext);
  const { selectedFeeds, clearSelection } = useMultiSelectUserFeedContext();
  const { mutateAsync: enableUserFeeds } = useEnableUserFeeds();
  const { mutateAsync: disableUserFeeds } = useDisableUserFeeds();
  const { mutateAsync: deleteUserFeeds } = useDeleteUserFeeds();
  const { createSuccessAlert, createErrorAlert, createInfoAlert } = usePageAlertContext();
  const { data: discordUserMe } = useDiscordUserMe();
  const { mutateAsync: createUserFeed } = useCreateUserFeed();
  const { mutateAsync: deleteUserFeed } = useDeleteUserFeed();
  const {
    data: curatedData,
    getCategoryPreviewText,
    isLoading: curatedLoading,
    error: curatedError,
    refetch: curatedRefetch,
  } = useCuratedFeeds();

  const [isInDiscoveryMode, setIsInDiscoveryMode] = useState<boolean | null>(null);
  const [feedActionStates, setFeedActionStates] = useState<Record<string, FeedActionState>>({});
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);
  const [browseModalInitialCategory, setBrowseModalInitialCategory] = useState<
    string | undefined
  >();
  const [browseModalInitialSearchQuery, setBrowseModalInitialSearchQuery] = useState<
    string | undefined
  >();
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [modalSessionAddCount, setModalSessionAddCount] = useState(0);
  const limitAlertShownRef = useRef(false);
  const addFeedParamConsumed = useRef(false);

  const totalFeedCount = userFeedsResults?.total;
  const feedsWithoutConnections = userFeedsResults?.feedsWithoutConnections ?? 0;
  const [setupDismissed, setSetupDismissed] = useState(false);
  const hadUnconfiguredFeeds = useRef(false);

  if (feedsWithoutConnections > 0) {
    hadUnconfiguredFeeds.current = true;
  }

  const { data: unconfiguredFeedsData, refetch: refetchUnconfiguredFeeds } = useUnconfiguredFeeds({
    enabled: feedsWithoutConnections > 0 || (hadUnconfiguredFeeds.current && !setupDismissed),
  });

  const hasCompletedSetup =
    !setupDismissed &&
    hadUnconfiguredFeeds.current &&
    unconfiguredFeedsData !== undefined &&
    unconfiguredFeedsData.results.length === 0;
  const unconfiguredFeedsLoaded = unconfiguredFeedsData !== undefined;
  const showSetupChecklist =
    (feedsWithoutConnections > 0 && unconfiguredFeedsLoaded) || hasCompletedSetup;
  const navigatedAlertTitle = state?.alertTitle;

  useEffect(() => {
    if (navigatedAlertTitle) {
      createSuccessAlert({
        title: navigatedAlertTitle,
      });
    }
  }, [navigatedAlertTitle]);

  useEffect(() => {
    const addFeedQuery = searchParams.get("addFeed");
    if (addFeedQuery && !addFeedParamConsumed.current) {
      addFeedParamConsumed.current = true;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("addFeed");
          return next;
        },
        { replace: true },
      );
      setBrowseModalInitialSearchQuery(addFeedQuery);
      setModalSessionAddCount(0);
      setIsBrowseModalOpen(true);
    } else if (!addFeedQuery) {
      addFeedParamConsumed.current = false;
    }
  }, [searchParams]);

  useEffect(() => {
    if (isInDiscoveryMode === null && userFeedsResults) {
      setIsInDiscoveryMode(userFeedsResults.total === 0);
    } else if (isInDiscoveryMode === false && userFeedsResults && userFeedsResults.total === 0) {
      setIsInDiscoveryMode(true);
      setFeedActionStates({});
      setIsSearchActive(false);
      limitAlertShownRef.current = false;
    }
  }, [userFeedsResults, isInDiscoveryMode]);

  const isAtLimit = !!(
    userFeedsResults &&
    discordUserMe &&
    userFeedsResults.total >= discordUserMe.maxUserFeeds
  );

  const addedFeedUrls = useMemo(
    () =>
      Object.entries(feedActionStates)
        .filter(([, s]) => s.status === "added")
        .map(([url]) => url),
    [feedActionStates],
  );

  const handleCuratedFeedAdd = useCallback(
    async (feed: CuratedFeed) => {
      setFeedActionStates((prev) => ({ ...prev, [feed.url]: { status: "adding" } }));
      try {
        const { result } = await createUserFeed({ details: { url: feed.url, title: feed.title } });
        setFeedActionStates((prev) => ({
          ...prev,
          [feed.url]: {
            status: "added",
            settingsUrl: pages.userFeed(result.id),
            feedId: result.id,
          },
        }));
        setModalSessionAddCount((prev) => prev + 1);
      } catch (err) {
        const apiError = err as ApiAdapterError;
        if (apiError.errorCode === ApiErrorCode.FEED_LIMIT_REACHED) {
          setFeedActionStates((prev) => ({ ...prev, [feed.url]: { status: "limit-reached" } }));
          if (!limitAlertShownRef.current) {
            limitAlertShownRef.current = true;
            createInfoAlert({
              title: "Feed limit reached",
              description: `You've used all ${
                discordUserMe?.maxUserFeeds ?? ""
              } of your available feeds.`,
            });
          }
        } else {
          setFeedActionStates((prev) => ({
            ...prev,
            [feed.url]: {
              status: "error",
              message: apiError.message,
              errorCode: apiError.errorCode,
            },
          }));
        }
      }
    },
    [createUserFeed, createInfoAlert, discordUserMe?.maxUserFeeds],
  );

  const handleCuratedFeedRemove = useCallback(
    async (feedUrl: string) => {
      const currentState = feedActionStates[feedUrl];
      if (!currentState || currentState.status !== "added") return;

      const { feedId } = currentState;

      setFeedActionStates((prev) => ({ ...prev, [feedUrl]: { status: "removing" } }));

      try {
        await deleteUserFeed({ feedId });
        setFeedActionStates((prev) => {
          const next = { ...prev };
          delete next[feedUrl];
          return next;
        });
        setModalSessionAddCount((prev) => Math.max(prev - 1, 0));
      } catch (err) {
        setFeedActionStates((prev) => ({
          ...prev,
          [feedUrl]: currentState,
        }));
        createErrorAlert({
          title: "Failed to remove feed",
          description: (err as Error).message,
        });
      }
    },
    [feedActionStates, deleteUserFeed, createErrorAlert],
  );

  const handleUrlFeedAdded = useCallback((_feedId: string, feedUrl: string) => {
    setFeedActionStates((prev) => ({
      ...prev,
      [feedUrl]: { status: "added", settingsUrl: pages.userFeed(_feedId), feedId: _feedId },
    }));
    setModalSessionAddCount((prev) => prev + 1);
  }, []);

  const handleUrlFeedRemoved = useCallback((feedUrl: string) => {
    setFeedActionStates((prev) => {
      const next = { ...prev };
      delete next[feedUrl];
      return next;
    });
    setModalSessionAddCount((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleExitDiscovery = useCallback(() => {
    setIsInDiscoveryMode(false);
  }, []);

  const handleSetupConnectionCreated = useCallback(() => {
    refetchUnconfiguredFeeds();
    refetchUserFeedsSummary();
  }, [refetchUnconfiguredFeeds, refetchUserFeedsSummary]);

  const handleSetupDismiss = useCallback(() => {
    setSetupDismissed(true);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setIsSearchActive(query.length > 0);
  }, []);

  const handleBrowseModalClose = useCallback(() => {
    setIsBrowseModalOpen(false);
    if (!isInDiscoveryMode && modalSessionAddCount > 0) {
      createSuccessAlert({
        title: `${modalSessionAddCount} feed${modalSessionAddCount !== 1 ? "s" : ""} added`,
        description: "Open a feed to set up where articles are delivered.",
      });
    }
  }, [modalSessionAddCount, createSuccessAlert, isInDiscoveryMode]);

  const handleOpenBrowseModal = useCallback((categoryId?: string) => {
    setBrowseModalInitialCategory(categoryId);
    setBrowseModalInitialSearchQuery(undefined);
    setModalSessionAddCount(0);
    setIsBrowseModalOpen(true);
  }, []);

  const onApplyRequiresAttentionFilters = useCallback(() => {
    if (
      statusFilters.length === 1 &&
      statusFilters.includes(UserFeedComputedStatus.RequiresAttention)
    ) {
      createInfoAlert({
        title: "You are already viewing feeds that require your attention.",
      });
    } else {
      createSuccessAlert({
        title: `Successfully applied filters. You are now viewing feeds that require your attention.`,
      });
      setStatusFilters([UserFeedComputedStatus.RequiresAttention]);
    }
  }, [statusFilters, setStatusFilters]);

  const hasFailedFeedAlertsDisabled =
    userMeData && !userMeData.result?.preferences?.alertOnDisabledFeeds;

  const onEnableSelectedFeeds = async () => {
    const feedIds = selectedFeeds.map((f) => f.id);

    try {
      await enableUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      clearSelection();

      createSuccessAlert({
        title: "Successfully enabled feeds.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to enable feeds.",
        description: (err as Error).message,
      });
    }
  };

  const onDisableSelectedFeeds = async () => {
    const feedIds = selectedFeeds.map((f) => f.id);

    try {
      await disableUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      clearSelection();

      createSuccessAlert({
        title: "Successfully disabled feeds.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to disable feeds.",
        description: (err as Error).message,
      });
    }
  };

  const onDeleteSelectedFeeds = async () => {
    const feedIds = selectedFeeds.map((f) => f.id);

    try {
      await deleteUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      clearSelection();
      createSuccessAlert({
        title: "Successfully deleted feeds.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to delete feeds.",
        description: (err as Error).message,
      });
    }
  };

  const totalFeedsRequiringAttention = userFeedsRequireAttentionResults?.total || 0;
  const totalManagementInvites = managementInvitesCount?.total || 0;

  return (
    <>
      <Stack spacing={4}>
        <Stack spacing={2}>
          <PageAlertContextOutlet
            containerProps={{
              mt: 4,
            }}
          />
          <ReducedLimitAlert />
          {totalFeedsRequiringAttention !== undefined && totalFeedsRequiringAttention > 0 && (
            <Alert status="warning" mt={2}>
              <AlertIcon />
              <Box>
                <AlertTitle>
                  {totalFeedsRequiringAttention} feed
                  {totalFeedsRequiringAttention > 1 ? "s" : ""} require
                  {totalFeedsRequiringAttention > 1 ? "" : "s"} your attention!
                </AlertTitle>
                <AlertDescription>
                  Article delivery may be fully or partially paused.{" "}
                  <ChakraLink
                    textAlign="left"
                    as="button"
                    color="blue.300"
                    onClick={onApplyRequiresAttentionFilters}
                  >
                    Click here to apply filters and see which ones they are.
                  </ChakraLink>
                  {hasFailedFeedAlertsDisabled && (
                    <>
                      {" "}
                      You can also{" "}
                      <ChakraLink as={Link} to={pages.userSettings()} color="blue.300">
                        get notified when failures occur
                      </ChakraLink>
                      .
                    </>
                  )}
                </AlertDescription>
              </Box>
            </Alert>
          )}
          <Alert hidden={!totalManagementInvites} mt={2}>
            <HStack
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={4}
              w="100%"
            >
              <Flex>
                <AlertIcon />
                <AlertTitle flex={1}>
                  You have {totalManagementInvites} pending feed management invites
                </AlertTitle>
              </Flex>
              <AlertDescription>
                <Flex>
                  <FeedManagementInvitesDialog
                    trigger={
                      <Button variant="outline">
                        <span>View pending management invites</span>
                      </Button>
                    }
                  />
                </Flex>
              </AlertDescription>
            </HStack>
          </Alert>
          {isInDiscoveryMode === false && showSetupChecklist && (
            <SetupChecklist
              feeds={(unconfiguredFeedsData?.results ?? []).map((f) => ({
                id: f.id,
                title: f.title,
                url: f.url,
                connectionCount: f.connectionCount,
              }))}
              onConnectionCreated={handleSetupConnectionCreated}
              onDismiss={handleSetupDismiss}
            />
          )}
        </Stack>
        {isInDiscoveryMode === false && (
          <>
            <Flex alignItems="center" justifyContent="space-between" gap="4" flexWrap="wrap">
              <Flex alignItems="center" gap={4}>
                <Heading as="h1" size="lg" tabIndex={-1}>
                  {t("pages.userFeeds.title")}{" "}
                  <span>
                    {totalFeedCount !== undefined &&
                      selectedFeeds.length > 0 &&
                      `(${selectedFeeds.length}/${totalFeedCount})`}
                  </span>
                  <span>
                    {totalFeedCount !== undefined && !selectedFeeds.length && `(${totalFeedCount})`}
                  </span>
                </Heading>
              </Flex>
              <HStack flexWrap="wrap">
                <Menu>
                  <MenuButton
                    as={Button}
                    rightIcon={<ChevronDownIcon />}
                    variant="outline"
                    // isDisabled={selectedFeeds.length === 0}
                  >
                    Feed Actions
                  </MenuButton>
                  <MenuList zIndex={2}>
                    <ConfirmModal
                      trigger={
                        <MenuItem
                          isDisabled={
                            !selectedFeeds.length ||
                            !selectedFeeds.some(
                              (f) => f.disabledCode === UserFeedDisabledCode.Manual,
                            )
                          }
                          icon={<FaPlay />}
                        >
                          Enable
                        </MenuItem>
                      }
                      title={`Are you sure you want to enable ${selectedFeeds.length} feed(s)?`}
                      description="Only feeds that were manually disabled will be enabled."
                      onConfirm={onEnableSelectedFeeds}
                      colorScheme="blue"
                    />
                    <ConfirmModal
                      trigger={
                        <MenuItem
                          isDisabled={
                            !selectedFeeds.length ||
                            selectedFeeds.every(
                              (r) =>
                                !!r.disabledCode &&
                                r.disabledCode !== UserFeedDisabledCode.ExceededFeedLimit,
                            )
                          }
                          icon={<FaPause />}
                        >
                          Disable
                        </MenuItem>
                      }
                      title={`Are you sure you want to disable ${selectedFeeds.length} feed(s)?`}
                      description="Only feeds that are not currently disabled will be affected."
                      onConfirm={onDisableSelectedFeeds}
                      colorScheme="blue"
                    />
                    <CloneUserFeedDialog
                      feedId={selectedFeeds[0]?.id}
                      trigger={
                        <MenuItem isDisabled={selectedFeeds.length !== 1} icon={<IoDuplicate />}>
                          Clone
                        </MenuItem>
                      }
                      defaultValues={{
                        title: `${selectedFeeds[0]?.title} (Clone)`,
                        url: selectedFeeds[0]?.url,
                      }}
                    />
                    <CopyUserFeedSettingsMenuItem
                      selectedFeedId={selectedFeeds.length === 1 ? selectedFeeds[0]?.id : undefined}
                      onSuccess={() => {
                        clearSelection();
                      }}
                    />
                    <MenuDivider />
                    <ConfirmModal
                      trigger={
                        <MenuItem
                          icon={<DeleteIcon color="red.200" />}
                          isDisabled={!selectedFeeds.length}
                        >
                          <Text color="red.200">Delete</Text>
                        </MenuItem>
                      }
                      title={`Are you sure you want to delete ${selectedFeeds.length} feed(s)?`}
                      description="This action cannot be undone."
                      onConfirm={onDeleteSelectedFeeds}
                      colorScheme="red"
                      okText={t("common.buttons.delete")}
                    />
                  </MenuList>
                </Menu>
                <HStack gap={1}>
                  <Button
                    colorScheme="blue"
                    leftIcon={<AddIcon />}
                    borderRightRadius={0}
                    onClick={() => handleOpenBrowseModal(undefined)}
                  >
                    Add Feed
                  </Button>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      colorScheme="blue"
                      icon={<ChevronDownIcon fontSize={24} />}
                      aria-label="Additional add feed options"
                      borderLeftRadius={0}
                    />
                    <MenuList>
                      <MenuItem icon={<AddIcon />} as={Link} to={pages.addFeeds()}>
                        Add multiple feeds
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </HStack>
              </HStack>
            </Flex>
            <HStack spacing={6}>
              <Text>
                Every feed represents a news source that you can subscribe to. After adding a feed,
                you may then specify where you want articles for that feed to be sent to.
              </Text>
            </HStack>
          </>
        )}
      </Stack>
      {isInDiscoveryMode && (
        <>
          <Box>
            <Stack spacing={6} py={8}>
              <Stack textAlign="center" spacing={2} role="status" aria-live="polite">
                {addedFeedUrls.length > 0 ? (
                  <Stack
                    textAlign="center"
                    spacing={3}
                    bg="gray.800"
                    borderWidth="1px"
                    borderColor="whiteAlpha.200"
                    borderRadius="md"
                    p={6}
                    alignItems="center"
                  >
                    <CheckCircleIcon color="green.400" boxSize={8} aria-hidden="true" />
                    <Heading as="h2" size="lg">
                      {addedFeedUrls.length} feed{addedFeedUrls.length !== 1 ? "s" : ""} added!
                    </Heading>
                    <Text color="gray.400">
                      Add more feeds below, or view your feeds to set up delivery.
                    </Text>
                    <Box>
                      <Button colorScheme="blue" size="sm" onClick={handleExitDiscovery}>
                        View your feeds{" "}
                        <Box as="span" aria-hidden="true">
                          &rarr;
                        </Box>
                      </Button>
                    </Box>
                  </Stack>
                ) : (
                  <>
                    <Heading as="h2" size="lg">
                      Get news delivered to your Discord
                    </Heading>
                    <Text color="gray.400">
                      Browse popular feeds to get started, or paste a URL to check any website.
                    </Text>
                  </>
                )}
              </Stack>

              <Stack spacing={2}>
                <FeedDiscoverySearch
                  feedActionStates={feedActionStates}
                  isAtLimit={isAtLimit}
                  onAdd={handleCuratedFeedAdd}
                  onRemove={handleCuratedFeedRemove}
                  onSearchChange={handleSearchChange}
                  onFeedAdded={handleUrlFeedAdded}
                  onFeedRemoved={handleUrlFeedRemoved}
                />
                {!isSearchActive && (
                  <Text color="gray.400" fontSize="sm" textAlign="center">
                    Many websites support feeds - try pasting a YouTube channel, subreddit, blog, or
                    news site URL
                  </Text>
                )}
                <FeedLimitBar showOnlyWhenConstrained />
              </Stack>

              {curatedLoading && !isSearchActive && (
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} height="80px" borderRadius="md" />
                  ))}
                </SimpleGrid>
              )}
              {!!curatedError && !curatedLoading && (
                <Alert status="error">
                  <AlertIcon />
                  <AlertDescription>
                    Failed to load feeds.{" "}
                    <Button variant="link" onClick={() => curatedRefetch()} colorScheme="blue">
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {!isSearchActive &&
                curatedData &&
                !curatedLoading &&
                curatedData.feeds.length > 0 && (
                  <CategoryGrid
                    categories={curatedData.categories}
                    totalFeedCount={curatedData.feeds.length ?? 0}
                    getCategoryPreviewText={getCategoryPreviewText}
                    onSelectCategory={handleOpenBrowseModal}
                  />
                )}
            </Stack>
          </Box>
        </>
      )}
      {isInDiscoveryMode === false && <UserFeedsTable />}
      <BrowseFeedsModal
        isOpen={isBrowseModalOpen}
        onClose={handleBrowseModalClose}
        initialCategory={browseModalInitialCategory}
        initialSearchQuery={browseModalInitialSearchQuery}
        feedActionStates={feedActionStates}
        isAtLimit={isAtLimit}
        onAdd={handleCuratedFeedAdd}
        onRemove={handleCuratedFeedRemove}
        onFeedAdded={handleUrlFeedAdded}
        onFeedRemoved={handleUrlFeedRemoved}
      />
    </>
  );
};
