import {
  Flex,
  Heading,
  Box,
  HStack,
  Text,
  Stack,
  Button,
  Alert,
  Link as ChakraLink,
  IconButton,
  Portal,
  Skeleton,
  SimpleGrid,
  Icon,
} from "@chakra-ui/react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaPlus, FaCircleCheck, FaChevronDown, FaGear, FaTrash, FaCopy } from "react-icons/fa6";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  useFeedScope,
} from "../features/feed";
import type { FeedActionState } from "../features/feed";
import type { CuratedFeed } from "../features/feed/types";
import { useDeleteUserFeed } from "../features/feed/hooks/useDeleteUserFeed";
import { ApiErrorCode } from "../utils/getStandardErrorCodeMessage";
import ApiAdapterError from "../utils/ApiAdapterError";
import { pages } from "../constants";
import { BoxConstrained, ConfirmModal, Panel } from "../components";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { UserFeedStatusFilterContext, useMultiSelectUserFeedContext } from "@/features/feed";

import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../contexts/PageAlertContext";
import { CopyUserFeedSettingsDialog } from "../features/feed/components/CopyUserFeedSettingsDialog";
import { SetupChecklist } from "../features/feed/components/SetupChecklist";
import { useUnconfiguredFeeds } from "../features/feed/hooks/useUnconfiguredFeeds";
import { ReducedLimitAlert } from "@/features/subscriptionProducts";
import { useCurrentWorkspace, WorkspaceActivationEmptyState } from "@/features/workspaces";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";

export const UserFeeds = () => {
  return (
    <BoxConstrained.Wrapper justifyContent="flex-start" height="100%" overflow="visible">
      <BoxConstrained.Container gap={6} height="100%">
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
      <MenuItem disabled={!selectedFeedId} value="copy-settings" onClick={() => setIsOpen(true)}>
        <FaCopy />
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

type BulkAction = "enable" | "disable" | "delete";

const UserFeedsInner: React.FC = () => {
  const { t } = useTranslation();
  const { state } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspaceSlug, workspaceDormant } = useFeedScope();
  const scope = useMemo(() => (workspaceSlug ? { workspaceSlug } : undefined), [workspaceSlug]);
  const currentWorkspace = useCurrentWorkspace();
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
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkAction | null>(null);
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
  const navigatedAlertDescription = state?.alertDescription;

  useEffect(() => {
    if (navigatedAlertTitle) {
      createSuccessAlert({
        title: navigatedAlertTitle,
        description: navigatedAlertDescription,
      });
    }
  }, [navigatedAlertTitle, navigatedAlertDescription]);

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

  const addedFeedKeys = useMemo(
    () =>
      Object.entries(feedActionStates)
        .filter(([, s]) => s.status === "added" || s.status === "remove-error")
        .map(([key]) => key),
    [feedActionStates],
  );

  const handleCuratedFeedAdd = useCallback(
    async (feed: CuratedFeed) => {
      setFeedActionStates((prev) => ({ ...prev, [feed.id]: { status: "adding" } }));

      try {
        const { result } = await createUserFeed({
          details: { curatedFeedId: feed.id, title: feed.title },
        });
        setFeedActionStates((prev) => ({
          ...prev,
          [feed.id]: {
            status: "added",
            settingsUrl: pages.userFeed(result.id, { scope }),
            feedId: result.id,
          },
        }));
        setModalSessionAddCount((prev) => prev + 1);
      } catch (err) {
        const apiError = err as ApiAdapterError;

        if (apiError.errorCode === ApiErrorCode.FEED_LIMIT_REACHED) {
          setFeedActionStates((prev) => ({ ...prev, [feed.id]: { status: "limit-reached" } }));

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
            [feed.id]: {
              status: "error",
              message: apiError.message,
              errorCode: apiError.errorCode,
            },
          }));
        }
      }
    },
    [createUserFeed, createInfoAlert, discordUserMe?.maxUserFeeds, scope],
  );

  const handleCuratedFeedRemove = useCallback(
    async (feedKey: string) => {
      const currentState = feedActionStates[feedKey];

      if (
        !currentState ||
        (currentState.status !== "added" && currentState.status !== "remove-error")
      ) {
        return;
      }

      const { feedId, settingsUrl } = currentState;

      setFeedActionStates((prev) => ({ ...prev, [feedKey]: { status: "removing" } }));

      try {
        await deleteUserFeed({ feedId });
        setFeedActionStates((prev) => {
          const next = { ...prev };
          delete next[feedKey];

          return next;
        });
        setModalSessionAddCount((prev) => Math.max(prev - 1, 0));
      } catch (err) {
        setFeedActionStates((prev) => ({
          ...prev,
          [feedKey]: {
            status: "remove-error",
            message: (err as Error).message,
            settingsUrl,
            feedId,
          },
        }));
      }
    },
    [feedActionStates, deleteUserFeed],
  );

  const handleUrlFeedAdded = useCallback(
    (_feedId: string, feedUrl: string) => {
      setFeedActionStates((prev) => ({
        ...prev,
        [feedUrl]: {
          status: "added",
          settingsUrl: pages.userFeed(_feedId, { scope }),
          feedId: _feedId,
        },
      }));
      setModalSessionAddCount((prev) => prev + 1);
    },
    [scope],
  );

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

  // Pay-at-blocked-intent: a dormant workspace with no feeds shows the
  // activation empty state instead of the add-feed experience (which the
  // server would reject anyway). With existing (disabled) feeds, the list
  // stays visible so nothing looks deleted; the banner carries the message.
  if (workspaceDormant && userFeedsResults && userFeedsResults.total === 0) {
    return (
      <Stack gap={4}>
        {currentWorkspace && (
          <Flex alignItems="center" justifyContent="space-between" gap={4} flexWrap="wrap" mt={4}>
            <Heading as="h1" size="lg" tabIndex={-1}>
              {currentWorkspace.name}
            </Heading>
            <Button asChild variant="outline" size="sm">
              <Link to={pages.workspaceSettings(currentWorkspace.slug)}>
                <FaGear aria-hidden="true" />
                Team settings
              </Link>
            </Button>
          </Flex>
        )}
        <WorkspaceActivationEmptyState />
      </Stack>
    );
  }

  return (
    <>
      <Stack gap={4}>
        {/* In-scope settings affordance: once inside a workspace, its settings are one
            visible on-page click rather than buried in the header switcher menu. */}
        {currentWorkspace && (
          <Flex alignItems="center" justifyContent="space-between" gap={4} flexWrap="wrap" mt={4}>
            <Heading as="h1" size="lg" tabIndex={-1}>
              {currentWorkspace.name}
            </Heading>
            <Button asChild variant="outline" size="sm">
              <Link to={pages.workspaceSettings(currentWorkspace.slug)}>
                <FaGear aria-hidden="true" />
                Team settings
              </Link>
            </Button>
          </Flex>
        )}
        <Stack gap={2}>
          <PageAlertContextOutlet
            containerProps={{
              mt: 4,
            }}
          />
          <ReducedLimitAlert />
          {totalFeedsRequiringAttention !== undefined && totalFeedsRequiringAttention > 0 && (
            <Alert.Root status="warning" mt={2}>
              <Alert.Indicator />
              <Box>
                <Alert.Title>
                  {totalFeedsRequiringAttention} feed
                  {totalFeedsRequiringAttention > 1 ? "s" : ""} require
                  {totalFeedsRequiringAttention > 1 ? "" : "s"} your attention!
                </Alert.Title>
                <Alert.Description>
                  Article delivery may be fully or partially paused.{" "}
                  <ChakraLink
                    textAlign="left"
                    as="button"
                    color="text.link"
                    onClick={onApplyRequiresAttentionFilters}
                  >
                    Click here to apply filters and see which ones they are.
                  </ChakraLink>
                  {hasFailedFeedAlertsDisabled && (
                    <>
                      {" "}
                      You can also{" "}
                      <ChakraLink asChild color="text.link">
                        <Link to={pages.userSettings()}>get notified when failures occur</Link>
                      </ChakraLink>
                      .
                    </>
                  )}
                </Alert.Description>
              </Box>
            </Alert.Root>
          )}
          <Alert.Root
            hidden={!totalManagementInvites}
            mt={2}
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={4}
          >
            <Alert.Indicator />
            <Alert.Title flex={1}>
              You have {totalManagementInvites} pending feed management invites
            </Alert.Title>
            <FeedManagementInvitesDialog
              trigger={
                <Button variant="outline">
                  <span>View pending management invites</span>
                </Button>
              }
            />
          </Alert.Root>
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
                <Heading as={currentWorkspace ? "h2" : "h1"} size="lg" tabIndex={-1}>
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
                <MenuRoot>
                  <MenuTrigger asChild>
                    <Button
                      variant="outline"
                      aria-disabled={selectedFeeds.length === 0}
                      data-disabled={selectedFeeds.length === 0 ? "" : undefined}
                    >
                      Feed Actions
                      <FaChevronDown />
                    </Button>
                  </MenuTrigger>
                  <MenuContent zIndex={2}>
                    <MenuItem
                      disabled={
                        !selectedFeeds.length ||
                        !selectedFeeds.some((f) => f.disabledCode === UserFeedDisabledCode.Manual)
                      }
                      value="enable"
                      onClick={() => setPendingBulkAction("enable")}
                    >
                      <FaPlay />
                      Enable
                    </MenuItem>
                    <MenuItem
                      disabled={
                        !selectedFeeds.length ||
                        selectedFeeds.every(
                          (r) =>
                            !!r.disabledCode &&
                            r.disabledCode !== UserFeedDisabledCode.ExceededFeedLimit,
                        )
                      }
                      value="disable"
                      onClick={() => setPendingBulkAction("disable")}
                    >
                      <FaPause />
                      Disable
                    </MenuItem>
                    <CloneUserFeedDialog
                      feedId={selectedFeeds[0]?.id}
                      trigger={
                        <MenuItem disabled={selectedFeeds.length !== 1} value="clone">
                          <IoDuplicate />
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
                    <MenuSeparator />
                    <MenuItem
                      value="delete"
                      disabled={!selectedFeeds.length}
                      onClick={() => setPendingBulkAction("delete")}
                    >
                      <FaTrash color="text.error" />
                      <Text color="text.error">Delete</Text>
                    </MenuItem>
                  </MenuContent>
                </MenuRoot>
                <ConfirmModal
                  open={pendingBulkAction === "enable"}
                  onOpenChange={(open) => !open && setPendingBulkAction(null)}
                  title={`Are you sure you want to enable ${selectedFeeds.length} feed(s)?`}
                  description="Only feeds that were manually disabled will be enabled."
                  onConfirm={onEnableSelectedFeeds}
                  colorScheme="blue"
                />
                <ConfirmModal
                  open={pendingBulkAction === "disable"}
                  onOpenChange={(open) => !open && setPendingBulkAction(null)}
                  title={`Are you sure you want to disable ${selectedFeeds.length} feed(s)?`}
                  description="Only feeds that are not currently disabled will be affected."
                  onConfirm={onDisableSelectedFeeds}
                  colorScheme="blue"
                />
                <ConfirmModal
                  open={pendingBulkAction === "delete"}
                  onOpenChange={(open) => !open && setPendingBulkAction(null)}
                  title={`Are you sure you want to delete ${selectedFeeds.length} feed(s)?`}
                  description="This action cannot be undone."
                  onConfirm={onDeleteSelectedFeeds}
                  colorScheme="red"
                  okText={t("common.buttons.delete")}
                />
                <HStack gap={1}>
                  <PrimaryActionButton
                    borderRightRadius={0}
                    onClick={() => handleOpenBrowseModal(undefined)}
                  >
                    <FaPlus />
                    Add Feed
                  </PrimaryActionButton>
                  <MenuRoot>
                    <MenuTrigger asChild>
                      <IconButton
                        variant="solid"
                        colorPalette="brand"
                        aria-label="Additional add feed options"
                        borderLeftRadius={0}
                      >
                        <FaChevronDown fontSize={24} />
                      </IconButton>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem value="add-multiple" asChild>
                        <Link to={pages.addFeeds(scope)}>
                          <FaPlus />
                          Add multiple feeds
                        </Link>
                      </MenuItem>
                    </MenuContent>
                  </MenuRoot>
                </HStack>
              </HStack>
            </Flex>
            <HStack gap={6}>
              <Text>
                Every feed represents a news source that you can subscribe to. After adding a feed,
                you may then specify where you want articles for that feed to be sent to.
              </Text>
            </HStack>
          </>
        )}
      </Stack>
      {isInDiscoveryMode && (
        <Box>
          <Stack gap={6} py={8}>
            <Stack textAlign="center" gap={2} role="status" aria-live="polite">
              {addedFeedKeys.length > 0 ? (
                <Panel
                  display="flex"
                  flexDirection="column"
                  textAlign="center"
                  gap={3}
                  p={6}
                  alignItems="center"
                >
                  <Icon as={FaCircleCheck} color="text.success" boxSize={8} aria-hidden="true" />
                  <Heading as="h2" size="lg">
                    {addedFeedKeys.length} feed{addedFeedKeys.length !== 1 ? "s" : ""} added!
                  </Heading>
                  <Text color="fg.muted">
                    Add more feeds below, or view your feeds to set up delivery.
                  </Text>
                  <Box>
                    <PrimaryActionButton size="sm" onClick={handleExitDiscovery}>
                      View your feeds{" "}
                      <Box as="span" aria-hidden="true">
                        &rarr;
                      </Box>
                    </PrimaryActionButton>
                  </Box>
                </Panel>
              ) : (
                <>
                  <Heading as="h2" size="lg">
                    Get news delivered to your Discord
                  </Heading>
                  <Text color="fg.muted">
                    Browse popular feeds to get started, or paste a URL to check any website.
                  </Text>
                </>
              )}
            </Stack>
            <Stack gap={2}>
              {/* Keyed by scope: a search submitted just before a scope switch commits is
                  validated against the OLD scope's credentials. Remounting on scope change
                  guarantees no cross-scope search state (query, result, Add button) is ever
                  shown under the new scope. */}
              <FeedDiscoverySearch
                key={workspaceSlug ?? "personal"}
                feedActionStates={feedActionStates}
                isAtLimit={isAtLimit}
                onAdd={handleCuratedFeedAdd}
                onRemove={handleCuratedFeedRemove}
                onSearchChange={handleSearchChange}
                onFeedAdded={handleUrlFeedAdded}
                onFeedRemoved={handleUrlFeedRemoved}
              />
              {!isSearchActive && (
                <Text color="fg.muted" fontSize="sm" textAlign="center">
                  Many websites support feeds - try pasting a YouTube channel, subreddit, blog, or
                  news site URL
                </Text>
              )}
              <FeedLimitBar showOnlyWhenConstrained />
            </Stack>
            {curatedLoading && !isSearchActive && (
              <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={4}>
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} height="80px" borderRadius="l3" />
                ))}
              </SimpleGrid>
            )}
            {!!curatedError && !curatedLoading && (
              <Alert.Root status="error">
                <Alert.Indicator />
                <Alert.Description>
                  Failed to load feeds.{" "}
                  <Button
                    variant="plain"
                    textDecoration="underline"
                    onClick={() => curatedRefetch()}
                    colorPalette="brand"
                  >
                    Retry
                  </Button>
                </Alert.Description>
              </Alert.Root>
            )}
            {!isSearchActive && curatedData && !curatedLoading && curatedData.feeds.length > 0 && (
              <CategoryGrid
                categories={curatedData.categories}
                totalFeedCount={curatedData.feeds.length ?? 0}
                getCategoryPreviewText={getCategoryPreviewText}
                onSelectCategory={handleOpenBrowseModal}
              />
            )}
          </Stack>
        </Box>
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
