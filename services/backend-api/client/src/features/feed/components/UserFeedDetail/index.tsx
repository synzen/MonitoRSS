import {
  BreadcrumbCurrentLink,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbRoot,
  BreadcrumbSeparator,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Link,
  Spinner,
  Stack,
  Tabs,
  Text,
  useDisclosure,
  Badge,
  IconButton,
  Box,
  SimpleGrid,
} from "@chakra-ui/react";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FaPlus,
  FaArrowLeft,
  FaChevronDown,
  FaTrash,
  FaUpRightFromSquare,
  FaCircleQuestion,
  FaGear,
  FaPause,
  FaUserSlash,
} from "react-icons/fa6";
import { useContext, useEffect, useRef } from "react";
import { FaCopy } from "react-icons/fa";
import { IoDuplicate } from "react-icons/io5";
import { BoxConstrained, CategoryText, ConfirmModal } from "@/components";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { TabContentContainer } from "@/components/TabContentContainer";
import {
  AddConnectionDialog,
  ComparisonsTabSection,
  UserFeedMiscSettingsTabSection,
  ConnectionCard,
  ExternalPropertiesTabSection,
} from "@/features/feedConnections";
import { useUserMe } from "@/features/discordUser";
import { PricingDialogContext } from "@/features/subscriptionProducts";
import RouteParams from "@/types/RouteParams";
import { FeedConnectionDisabledCode } from "@/types";
import { UserFeedManagerStatus, pages } from "@/constants";
import { UserFeedTabSearchParam } from "@/constants/userFeedTabSearchParam";
import { PageAlertContextOutlet, usePageAlertContext } from "@/contexts/PageAlertContext";
import {
  formatRefreshRateSeconds,
  getEffectiveRefreshRateSeconds,
} from "@/utils/formatRefreshRateSeconds";
import {
  useArticleDailyLimit,
  useDeleteUserFeed,
  useUpdateUserFeed,
  useUpdateUserFeedManagementInviteStatus,
} from "../../hooks";
import { useUserFeedContext } from "../../contexts";
import { useFeedScope } from "../../contexts/FeedScopeContext";
import { UpdateUserFeedInput } from "../../api";
import { UserFeedDisabledCode } from "../../types";
import { CloneUserFeedDialog } from "../CloneUserFeedDialog";
import { EditUserFeedDialog } from "../EditUserFeedDialog";
import { UserFeedDisabledAlert } from "../UserFeedDisabledAlert";
import { UserFeedLogs } from "../UserFeedLogs";
import { UserFeedHealthAlert } from "../UserFeedHealthAlert";
import { CopyUserFeedSettingsDialog } from "../CopyUserFeedSettingsDialog";
import { Tooltip } from "@/components/ui/tooltip";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverCloseTrigger,
  PopoverBody,
} from "@/components/ui/popover";
import { Alert } from "@/components/ui/alert";

const tabIndexBySearchParam = new Map<string, number>([
  [UserFeedTabSearchParam.Connections, 0],
  [UserFeedTabSearchParam.Comparisons, 1],
  [UserFeedTabSearchParam.ExternalProperties, 2],
  [UserFeedTabSearchParam.Settings, 3],
  [UserFeedTabSearchParam.Logs, 4],
]);

const tabLabelsByIndex = new Map<number, string>([
  [0, "Connections"],
  [1, "Comparisons"],
  [2, "External Properties"],
  [3, "Settings"],
  [4, "Logs"],
]);

const tabValues = ["connections", "comparisons", "external-properties", "settings", "logs"];

export const UserFeedDetail: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  // Keep navigation in the current (workspace) scope when rendered under a workspace route.
  const { workspaceSlug } = useFeedScope();
  const scope = workspaceSlug ? { workspaceSlug } : undefined;
  const { open: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const {
    open: copySettingsIsOpen,
    onClose: copySettingsOnClose,
    onOpen: copySettingsOnOpen,
  } = useDisclosure();
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { search: urlSearch, state } = useLocation();
  const { open: isOpen, onClose, onOpen } = useDisclosure();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { data: dailyLimit } = useArticleDailyLimit({
    feedId,
  });
  const { userFeed: feed } = useUserFeedContext();
  const { data: userMe } = useUserMe();
  const feedTitle = feed?.title;
  const {
    mutateAsync: mutateAsyncUserFeed,
    status: updatingStatus,
    error: updateError,
    reset: resetUpdateError,
  } = useUpdateUserFeed();

  const {
    mutateAsync,
    status: deleteingStatus,
    error: deleteError,
    reset: resetDeleteError,
  } = useDeleteUserFeed();
  const { mutateAsync: updateInvite } = useUpdateUserFeedManagementInviteStatus();
  const isSharedWithMe = !!feed?.sharedAccessDetails?.inviteId;
  const isNewFeed = state?.isNewFeed as boolean | undefined;

  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();

  const onAddConnection = () => {
    onOpen();
  };

  useEffect(() => {
    if (isNewFeed) {
      createSuccessAlert({
        title: "Successfully added feed.",
        description: " Add connections to specify where articles should be sent to.",
      });
    }
  }, [isNewFeed]);

  useEffect(() => {
    if (feedTitle) {
      document.title = `${feedTitle} | MonitoRSS`;
    }
  }, [feedTitle]);

  const isAtLimit = dailyLimit ? dailyLimit.current >= dailyLimit.max : false;

  const onDeleteFeed = async () => {
    if (!feedId) {
      return;
    }

    await mutateAsync({
      feedId,
    });
    navigate(pages.userFeeds(), {
      state: {
        alertTitle: `Successfully deleted feed: ${feed.title}`,
      },
    });
  };

  const onUpdateFeed = async ({ url, ...rest }: UpdateUserFeedInput["data"]) => {
    if (!feedId) {
      return;
    }

    await mutateAsyncUserFeed({
      feedId,
      data: {
        url: url === feed?.url ? undefined : url,
        ...rest,
      },
    });
    createSuccessAlert({
      title: "Successfully updated feed.",
    });
  };

  const onRemoveMyAccess = async () => {
    if (!feed?.sharedAccessDetails?.inviteId) {
      return;
    }

    try {
      await updateInvite({
        id: feed.sharedAccessDetails?.inviteId,
        data: {
          status: UserFeedManagerStatus.Declined,
        },
      });

      navigate(pages.userFeeds(), {
        state: {
          alertTitle: `Successfully removed shared access to feed: ${feed.title}`,
        },
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to remove shared access.",
        description: (err as Error).message,
      });
    }
  };

  const addConnectionButtons = isSharedWithMe ? null : (
    <Flex gap={4} flexWrap="wrap">
      <Button variant="outline" onClick={onAddConnection}>
        <FaPlus fontSize="sm" />
        Add Discord connection
      </Button>
    </Flex>
  );

  const disabledConnections = feed?.connections.filter(
    (c) => c.disabledCode === FeedConnectionDisabledCode.Manual,
  );

  const tabIndex = tabIndexBySearchParam.get(urlSearch);

  const urlIsDifferentFromInput = feed?.inputUrl && feed?.url !== feed?.inputUrl;

  return (
    <>
      <PageAlertContextOutlet
        containerProps={{
          maxW: "1400px",
          w: "100%",
          display: "flex",
          justifyContent: "center",
          px: [4, 4, 8, 12],
          pt: 0,
          pb: 4,
        }}
      />
      <Tabs.Root
        lazyMount
        fitted
        variant="enclosed"
        defaultValue={tabValues[tabIndex ?? 0]}
        value={tabIndex !== undefined ? tabValues[tabIndex] : undefined}
        width="100%"
      >
        <AddConnectionDialog isOpen={isOpen} onClose={onClose} />
        <EditUserFeedDialog
          onCloseRef={menuButtonRef}
          isOpen={editIsOpen}
          onClose={() => {
            editOnClose();
            resetUpdateError();
          }}
          defaultValues={{
            title: feed?.title as string,
            url: feed?.url as string,
          }}
          onUpdate={onUpdateFeed}
          error={updateError}
        />
        <CopyUserFeedSettingsDialog
          isOpen={copySettingsIsOpen}
          onClose={copySettingsOnClose}
          onCloseRef={menuButtonRef}
          feedId={feedId}
        />
        <Stack width="100%" minWidth="100%" alignItems="center">
          <Stack maxWidth="1400px" width="100%" paddingX={{ base: 4, md: 8, lg: 12 }} gap={4}>
            <Stack gap={6}>
              <Stack gap={4}>
                <Stack flex={1}>
                  <BreadcrumbRoot>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild color="text.link">
                          <RouterLink to={pages.userFeeds(scope)}>Feeds</RouterLink>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild color="text.link">
                          <RouterLink
                            to={pages.userFeed(feed.id, {
                              tab: UserFeedTabSearchParam.Connections,
                              scope,
                            })}
                          >
                            {feed?.title}
                          </RouterLink>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbCurrentLink>
                          {tabLabelsByIndex.get(tabIndex || 0) ?? "Connections"}
                        </BreadcrumbCurrentLink>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </BreadcrumbRoot>
                  <Stack flex={1}>
                    <HStack
                      alignItems="flex-start"
                      justifyContent="space-between"
                      flexWrap="wrap"
                      gap={3}
                    >
                      <Stack width="fit-content">
                        <Flex alignItems="center" gap={0}>
                          <Heading as="h1" size="lg" marginRight={4} tabIndex={-1}>
                            {feed?.title}
                          </Heading>
                          {feed && feed?.sharedAccessDetails?.inviteId && (
                            <Tooltip
                              content={`This feed is shared with you by someone else, and currently counts towards your feed
                            limit. You can remove your access through the Actions dropdown.`}
                            >
                              <Badge>Shared</Badge>
                            </Tooltip>
                          )}
                        </Flex>
                      </Stack>
                      <MenuRoot lazyMount={false} unmountOnExit={false}>
                        <MenuTrigger asChild>
                          <Button variant="outline" ref={menuButtonRef}>
                            <span>Feed Actions</span>
                            <FaChevronDown />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem aria-label="Edit" onClick={editOnOpen} value="configure">
                            <FaGear />
                            {t("common.buttons.configure")}
                          </MenuItem>
                          <MenuItem onClick={copySettingsOnOpen} value="copy-settings">
                            <FaCopy />
                            Copy settings to...
                          </MenuItem>
                          {feed && (
                            <CloneUserFeedDialog
                              trigger={
                                <MenuItem value="clone">
                                  <IoDuplicate />
                                  <span>Clone</span>
                                </MenuItem>
                              }
                              defaultValues={{
                                title: feed.title,
                                url: feed.url,
                              }}
                              feedId={feed.id}
                            />
                          )}
                          {feed?.sharedAccessDetails?.inviteId && (
                            <ConfirmModal
                              title="Remove my shared access"
                              description="Are you sure you want to remove your access to this feed? You will no longer be able to view or manage this feed."
                              trigger={
                                <MenuItem
                                  disabled={updatingStatus === "loading"}
                                  value="remove-access"
                                >
                                  <FaUserSlash />
                                  <span>Remove my shared access</span>
                                </MenuItem>
                              }
                              okText={t("common.buttons.yes")}
                              colorScheme="red"
                              onConfirm={onRemoveMyAccess}
                              onClosed={resetUpdateError}
                              error={updateError?.message}
                            />
                          )}
                          {feed && feed.disabledCode !== UserFeedDisabledCode.Manual && (
                            <ConfirmModal
                              title={t("pages.userFeed.disableFeedConfirmTitle")}
                              description={t("pages.userFeed.disableFeedConfirmDescription")}
                              trigger={
                                <MenuItem
                                  disabled={updatingStatus === "loading"}
                                  value="disable-feed"
                                >
                                  <FaPause />
                                  <span>{t("pages.userFeed.disableFeedButtonText")}</span>
                                </MenuItem>
                              }
                              okText="Disable feed"
                              colorScheme="blue"
                              onConfirm={async () =>
                                onUpdateFeed({
                                  disabledCode: UserFeedDisabledCode.Manual,
                                })
                              }
                              onClosed={resetUpdateError}
                              error={updateError?.message}
                            />
                          )}
                          <MenuSeparator />
                          {feedId && (
                            <ConfirmModal
                              title={t("pages.userFeed.deleteConfirmTitle")}
                              description={t("pages.userFeed.deleteConfirmDescription")}
                              trigger={
                                <MenuItem
                                  disabled={deleteingStatus === "loading"}
                                  value="delete-feed"
                                  color="text.error"
                                  _icon={{ color: "text.error" }}
                                >
                                  <FaTrash />
                                  <Text>{t("common.buttons.delete")}</Text>
                                </MenuItem>
                              }
                              okText={t("pages.userFeed.deleteConfirmOk")}
                              colorScheme="red"
                              onConfirm={onDeleteFeed}
                              error={deleteError?.message}
                              onClosed={resetDeleteError}
                            />
                          )}
                        </MenuContent>
                      </MenuRoot>
                    </HStack>
                  </Stack>
                </Stack>
                <UserFeedHealthAlert />
                <UserFeedDisabledAlert />
              </Stack>
              <TabContentContainer>
                <Stack gap={6}>
                  <Heading as="h2" size="md">
                    Feed Overview
                  </Heading>
                  <CategoryText title="Feed Link">
                    <Stack gap={1}>
                      <Link
                        href={feed?.inputUrl || feed?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        wordBreak="break-all"
                        color="text.link"
                        display="flex"
                        alignItems="center"
                        gap={2}
                      >
                        {feed?.inputUrl || feed?.url} <FaUpRightFromSquare />
                      </Link>
                      {urlIsDifferentFromInput && (
                        <Flex alignItems="center">
                          <Text color="fg.muted" fontSize="sm" display="inline">
                            Resolved to{" "}
                            <Link
                              color="fg.muted"
                              href={feed?.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              fontSize="sm"
                              wordBreak="break-all"
                            >
                              {feed?.url}
                            </Link>
                          </Text>
                          <PopoverRoot>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="xs"
                                aria-label="What is cache duration?"
                              >
                                <FaCircleQuestion fontSize={12} tabIndex={-1} aria-hidden />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent>
                              <PopoverArrow />
                              <PopoverCloseTrigger />
                              <PopoverBody>
                                <Text>
                                  The feed link that is actually being used since the original link
                                  was not a valid RSS feed feed.
                                </Text>
                              </PopoverBody>
                            </PopoverContent>
                          </PopoverRoot>
                        </Flex>
                      )}
                    </Stack>
                  </CategoryText>
                  <Grid
                    templateColumns={{
                      base: "1fr",
                      sm: "repeat(2, 1fr)",
                      lg: "repeat(4, fit-content(320px))",
                    }}
                    columnGap="20"
                    rowGap={{ base: "8", lg: "14" }}
                    as="ul"
                  >
                    <CategoryText title={t("pages.feed.refreshRateLabel")}>
                      {feed ? formatRefreshRateSeconds(getEffectiveRefreshRateSeconds(feed)) : null}
                    </CategoryText>
                    <CategoryText title={t("pages.feed.createdAtLabel")}>
                      {feed?.createdAt}
                    </CategoryText>
                    <CategoryText
                      title={t("pages.feed.articleDailyLimit")}
                      helpTooltip={{
                        description: t("pages.feed.articleDailyLimitHint"),
                        buttonLabel: "What is article daily limit?",
                      }}
                    >
                      <HStack>
                        <Text color={isAtLimit ? "text.error" : ""} display="block">
                          {dailyLimit && `${dailyLimit.current}/${dailyLimit.max}`}
                        </Text>
                        {dailyLimit && !userMe?.result.enableBilling && (
                          <IconButton
                            asChild
                            aria-label="Increase article daily limit"
                            variant="ghost"
                            size="xs"
                            transform="rotate(90deg)"
                          >
                            <a
                              href="https://www.patreon.com/monitorss"
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              <FaArrowLeft />
                            </a>
                          </IconButton>
                        )}
                        {dailyLimit && userMe?.result.enableBilling && (
                          <IconButton
                            aria-label="Increase article daily limit"
                            variant="ghost"
                            size="xs"
                            transform="rotate(90deg)"
                            onClick={onOpenPricingDialog}
                          >
                            <FaArrowLeft />
                          </IconButton>
                        )}
                        {!dailyLimit && <Spinner display="block" size="sm" />}
                      </HStack>
                    </CategoryText>
                  </Grid>
                </Stack>
              </TabContentContainer>
            </Stack>
            <Box overflow="auto" display="flex">
              <Tabs.List w="max-content" flex={1}>
                <Tabs.Trigger
                  value="connections"
                  fontWeight="semibold"
                  _selected={{ fontWeight: "bold" }}
                  onClick={() =>
                    navigate({
                      search: UserFeedTabSearchParam.Connections,
                    })
                  }
                >
                  {t("pages.userFeeds.tabConnections")}
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="comparisons"
                  fontWeight="semibold"
                  _selected={{ fontWeight: "bold" }}
                  onClick={() =>
                    navigate({
                      search: UserFeedTabSearchParam.Comparisons,
                    })
                  }
                >
                  {t("pages.userFeeds.tabComparisons")}
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="external-properties"
                  fontWeight="semibold"
                  _selected={{ fontWeight: "bold" }}
                  onClick={() =>
                    navigate({
                      search: UserFeedTabSearchParam.ExternalProperties,
                    })
                  }
                >
                  External Properties
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="settings"
                  fontWeight="semibold"
                  _selected={{ fontWeight: "bold" }}
                  onClick={() =>
                    navigate({
                      search: UserFeedTabSearchParam.Settings,
                    })
                  }
                >
                  {t("pages.userFeeds.settings")}
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="logs"
                  fontWeight="semibold"
                  _selected={{ fontWeight: "bold" }}
                  onClick={() =>
                    navigate({
                      search: UserFeedTabSearchParam.Logs,
                    })
                  }
                >
                  {t("pages.userFeeds.tabLogs")}
                </Tabs.Trigger>
              </Tabs.List>
            </Box>
          </Stack>
        </Stack>
        <Tabs.ContentGroup width="100%" display="flex" justifyContent="center">
          <Tabs.Content value="connections" padding={0} py={4} width="100%">
            {/**
             * https://github.com/chakra-ui/chakra-ui/issues/5636
             * There is a bug with Chakra where the connection card settings dropdown will cause
             * an overflow scroll on the tab panel.
             */}
            <BoxConstrained.Wrapper overflow="visible">
              <BoxConstrained.Container>
                <TabContentContainer>
                  <Stack gap={6} mb={16}>
                    <Stack gap={3}>
                      <Flex
                        justifyContent="space-between"
                        alignItems="flex-start"
                        flexWrap="wrap"
                        gap={4}
                      >
                        <Heading size="md" as="h2">
                          {t("pages.userFeeds.tabConnections")}
                        </Heading>
                        <PrimaryActionButton onClick={onAddConnection}>
                          <FaPlus fontSize="sm" />
                          Add connection
                        </PrimaryActionButton>
                      </Flex>
                      <Text>{t("pages.feed.connectionSectionDescription")}</Text>
                    </Stack>
                    {feed && !feed.connections.length && !isSharedWithMe && (
                      <Stack>
                        <Alert status="warning" title="You have no connections set up!">
                          <Stack>
                            <Text>
                              You&apos;ll need to set up at least one connection to tell the bot
                              where to send new articles!
                            </Text>
                            {addConnectionButtons}
                          </Stack>
                        </Alert>
                      </Stack>
                    )}
                    {!!feed?.connections.length && (
                      <SimpleGrid
                        gap={4}
                        templateColumns={[
                          "repeat(auto-fill, minmax(225px, 1fr))",
                          "repeat(auto-fill, minmax(320px, 1fr))",
                        ]}
                      >
                        {feed?.connections
                          ?.filter((c) => c.disabledCode !== FeedConnectionDisabledCode.Manual)
                          ?.map((connection) => {
                            return (
                              <ConnectionCard
                                key={connection.id}
                                connection={connection}
                                feedId={feedId as string}
                              />
                            );
                          })}
                      </SimpleGrid>
                    )}
                    {disabledConnections?.length ? (
                      <Stack gap={4} mt={2}>
                        <Heading size="sm" as="h3" fontWeight={600} color="fg">
                          Disabled Connections
                        </Heading>
                        <SimpleGrid
                          gap={4}
                          templateColumns={[
                            "repeat(auto-fill, minmax(225px, 1fr))",
                            "repeat(auto-fill, minmax(320px, 1fr))",
                          ]}
                        >
                          {disabledConnections?.map((connection) => {
                            return (
                              <ConnectionCard
                                key={connection.id}
                                connection={connection}
                                feedId={feedId as string}
                              />
                            );
                          })}
                        </SimpleGrid>
                      </Stack>
                    ) : null}
                    {!!feed?.connections.length && addConnectionButtons}
                  </Stack>
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </Tabs.Content>
          <Tabs.Content value="comparisons" padding={0} py={4} width="100%" tabIndex={-1}>
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <TabContentContainer>
                  <ComparisonsTabSection
                    passingComparisons={feed?.passingComparisons}
                    blockingComparisons={feed?.blockingComparisons}
                    updateError={updateError?.message}
                    onUpdate={({ passingComparisons, blockingComparisons }) =>
                      onUpdateFeed({
                        passingComparisons,
                        blockingComparisons,
                      })
                    }
                  />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </Tabs.Content>
          <Tabs.Content value="external-properties" padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <TabContentContainer>
                  <ExternalPropertiesTabSection />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </Tabs.Content>
          <Tabs.Content value="settings" padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <TabContentContainer>
                  <UserFeedMiscSettingsTabSection feedId={feedId as string} />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </Tabs.Content>
          <Tabs.Content value="logs" padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <TabContentContainer>
                  <UserFeedLogs />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </Tabs.Content>
        </Tabs.ContentGroup>
      </Tabs.Root>
    </>
  );
};
