import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
  Badge,
  IconButton,
  Alert,
  AlertDescription,
  MenuDivider,
  Wrap,
  AlertTitle,
  Box,
  AlertIcon,
  Tooltip,
  SimpleGrid,
} from "@chakra-ui/react";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AddIcon, ArrowLeftIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { useRef, useState } from "react";
import { BoxConstrained, CategoryText, ConfirmModal } from "@/components";
import {
  CloneUserFeedDialog,
  EditUserFeedDialog,
  UpdateUserFeedInput,
  useArticleDailyLimit,
  useCreateUserFeedLegacyRestore,
  useDeleteUserFeed,
  UserFeedDisabledAlert,
  UserFeedDisabledCode,
  useUpdateUserFeed,
  useUpdateUserFeedManagementInvite,
  useUserFeed,
} from "../features/feed";
import RouteParams from "../types/RouteParams";
import { DashboardContentV2 } from "../components/DashboardContentV2";
import {
  AddConnectionDialog,
  ComparisonsTabSection,
  UserFeedSettingsTabSection,
  ConnectionCard,
} from "../features/feedConnections";

import { notifySuccess } from "../utils/notifySuccess";
import { notifyError } from "../utils/notifyError";
import { UserFeedManagerStatus, pages } from "../constants";
import { UserFeedRequestsTable } from "../features/feed/components/UserFeedRequestsTable";

enum TabSearchParam {
  Connections = "?view=connections",
  Comparisons = "?view=comparisons",
  Logs = "?view=logs",
  Settings = "?view=settings",
}

const tabIndexBySearchParam = new Map<string, number>([
  [TabSearchParam.Connections, 0],
  [TabSearchParam.Comparisons, 1],
  [TabSearchParam.Settings, 2],
  [TabSearchParam.Logs, 3],
]);

export const UserFeed: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { search: urlSearch } = useLocation();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [addConnectionType, setAddConnectionType] = useState<
    { type: "discord-channel" | "discord-webhook"; isChannelThread?: boolean } | undefined
  >(undefined);
  const { data: dailyLimit } = useArticleDailyLimit({
    feedId,
  });
  const { feed, status, error } = useUserFeed({
    feedId,
  });
  const { mutateAsync: mutateAsyncUserFeed, status: updatingStatus } = useUpdateUserFeed();

  const { mutateAsync, status: deleteingStatus } = useDeleteUserFeed();
  const { mutateAsync: restoreLegacyFeed } = useCreateUserFeedLegacyRestore();
  const { mutateAsync: updateInvite } = useUpdateUserFeedManagementInvite();

  const onAddConnection = (
    type: "discord-channel" | "discord-webhook",
    isChannelThread?: boolean
  ) => {
    setAddConnectionType({ type, isChannelThread });
    onOpen();
  };

  const isAtLimit = dailyLimit ? dailyLimit.current >= dailyLimit.max : false;

  const onDeleteFeed = async () => {
    if (!feedId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
      });
      notifySuccess(t("common.success.deleted"));
      navigate(pages.userFeeds());
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const onUpdateFeed = async ({ url, ...rest }: UpdateUserFeedInput["data"]) => {
    if (!feedId) {
      return;
    }

    try {
      await mutateAsyncUserFeed({
        feedId,
        data: {
          url: url === feed?.url ? undefined : url,
          ...rest,
        },
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
      throw err;
    }
  };

  const onRestoreLegacyFeed = async () => {
    if (!feedId) {
      return;
    }

    try {
      await restoreLegacyFeed({
        feedId,
      });
      navigate("/servers");
      notifySuccess("Successfully restored");
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
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

      notifySuccess(t("common.success.savedChanges"));
      navigate(pages.userFeeds());
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const addConnectionButtons = (
    <Flex gap={4} flexWrap="wrap">
      <Button
        variant="outline"
        onClick={() => onAddConnection("discord-channel")}
        leftIcon={<AddIcon fontSize="sm" />}
      >
        Add Discord channel
      </Button>
      <Button
        variant="outline"
        onClick={() => onAddConnection("discord-channel", true)}
        leftIcon={<AddIcon fontSize="sm" />}
      >
        Add Discord thread
      </Button>
      <Button
        variant="outline"
        onClick={() => onAddConnection("discord-webhook")}
        leftIcon={<AddIcon fontSize="sm" />}
      >
        Add Discord webhook
      </Button>
    </Flex>
  );

  return (
    <DashboardContentV2 error={error} loading={status === "loading"}>
      <AddConnectionDialog
        isOpen={isOpen}
        type={addConnectionType?.type}
        isChannelThread={addConnectionType?.isChannelThread}
        onClose={onClose}
      />
      <EditUserFeedDialog
        onCloseRef={menuButtonRef}
        isOpen={editIsOpen}
        onClose={editOnClose}
        defaultValues={{
          title: feed?.title as string,
          url: feed?.url as string,
        }}
        onUpdate={onUpdateFeed}
      />
      <Tabs isLazy isFitted defaultIndex={tabIndexBySearchParam.get(urlSearch) || 0}>
        <Stack
          width="100%"
          minWidth="100%"
          paddingTop={10}
          background="gray.700"
          alignItems="center"
        >
          <Stack maxWidth="1400px" width="100%" paddingX={{ base: 4, lg: 12 }} spacing={6}>
            <Stack spacing={6}>
              <Stack spacing={4}>
                {/* <HStack justifyContent="space-between"> */}
                <Stack flex={1}>
                  <Breadcrumb>
                    <BreadcrumbItem>
                      <BreadcrumbLink as={RouterLink} to={pages.userFeeds()}>
                        Feeds
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem isCurrentPage>
                      <BreadcrumbLink href="#">{feed?.title}</BreadcrumbLink>
                    </BreadcrumbItem>
                  </Breadcrumb>
                  <Stack flex={1}>
                    <HStack alignItems="flex-start" justifyContent="space-between">
                      <Stack>
                        <Flex alignItems="center" gap={0}>
                          <Heading size="lg" marginRight={4}>
                            {feed?.title}
                          </Heading>
                          {feed && feed?.sharedAccessDetails?.inviteId && (
                            <Tooltip
                              label={`This feed is shared with you by someone else, and currently counts towards your feed
                            limit. You can remove your access through the Actions dropdown.`}
                            >
                              <Badge>Shared</Badge>
                            </Tooltip>
                          )}
                        </Flex>
                        <Link
                          color="gray.400"
                          _hover={{
                            color: "gray.200",
                          }}
                          href={feed?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {feed?.url}
                        </Link>
                      </Stack>
                      <Menu>
                        <MenuButton
                          as={Button}
                          variant="outline"
                          ref={menuButtonRef}
                          rightIcon={<ChevronDownIcon />}
                        >
                          {t("pages.userFeed.actionsButtonText")}
                        </MenuButton>
                        <MenuList>
                          <MenuItem aria-label="Edit" onClick={editOnOpen}>
                            {t("common.buttons.configure")}
                          </MenuItem>
                          {feed && (
                            <CloneUserFeedDialog
                              trigger={<MenuItem>Clone</MenuItem>}
                              defaultValues={{
                                title: feed.title,
                                url: feed.url,
                              }}
                              feedId={feed.id}
                              redirectOnSuccess
                            />
                          )}
                          {feed?.sharedAccessDetails?.inviteId && (
                            <ConfirmModal
                              title="Remove my shared access"
                              description="Are you sure you want to remove your access to this feed? You will no longer be able to view or manage this feed."
                              trigger={
                                <MenuItem isDisabled={updatingStatus === "loading"}>
                                  Remove my shared access
                                </MenuItem>
                              }
                              okText={t("common.buttons.yes")}
                              colorScheme="red"
                              onConfirm={onRemoveMyAccess}
                            />
                          )}
                          {feed && !feed.disabledCode && (
                            <ConfirmModal
                              title={t("pages.userFeed.disableFeedConfirmTitle")}
                              description={t("pages.userFeed.disableFeedConfirmDescription")}
                              trigger={
                                <MenuItem isDisabled={updatingStatus === "loading"}>
                                  {t("pages.userFeed.disableFeedButtonText")}
                                </MenuItem>
                              }
                              okText={t("common.buttons.yes")}
                              colorScheme="blue"
                              onConfirm={async () =>
                                onUpdateFeed({
                                  disabledCode: UserFeedDisabledCode.Manual,
                                })
                              }
                            />
                          )}
                          <MenuDivider />
                          {feed?.isLegacyFeed && (
                            <ConfirmModal
                              title="Restore legacy feed"
                              size="xl"
                              descriptionNode={
                                <Stack>
                                  <Text fontWeight={800} color="red.300">
                                    Only proceed if absolutely required!
                                  </Text>
                                  <Stack>
                                    <Text>
                                      If you are currently facing issues with personal feeds, you
                                      may convert this feed back to a legacy feed.
                                    </Text>
                                    <Text>
                                      Legacy feeds are still scheduled to be permanently disabled.
                                      If you are facing issues, please reach out to Support for
                                      remediation so that you can convert this back to a personal
                                      feed as soon as possible.
                                    </Text>
                                    <Text>
                                      After this feed has been restored, this personal feed will be
                                      deleted.
                                    </Text>
                                    <Wrap mt={4}>
                                      <Button
                                        as={Link}
                                        href="https://discord.gg/pudv7Rx"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        variant="ghost"
                                      >
                                        Discord Support Server
                                      </Button>
                                      <Button
                                        as={Link}
                                        href="https://support.monitorss.xyz"
                                        target="_blank"
                                        variant="ghost"
                                      >
                                        File a Support ticket
                                      </Button>
                                    </Wrap>
                                  </Stack>
                                </Stack>
                              }
                              onConfirm={onRestoreLegacyFeed}
                              colorScheme="red"
                              okText="Restore legacy feed"
                              trigger={<MenuItem>Restore legacy feed</MenuItem>}
                            />
                          )}
                          {feedId && (
                            <ConfirmModal
                              title={t("pages.userFeed.deleteConfirmTitle")}
                              description={t("pages.userFeed.deleteConfirmDescription")}
                              trigger={
                                <MenuItem isDisabled={deleteingStatus === "loading"}>
                                  {t("common.buttons.delete")}
                                </MenuItem>
                              }
                              okText={t("pages.userFeed.deleteConfirmOk")}
                              colorScheme="red"
                              onConfirm={onDeleteFeed}
                            />
                          )}
                        </MenuList>
                      </Menu>
                    </HStack>
                  </Stack>
                </Stack>
                <UserFeedDisabledAlert feedId={feedId} />
              </Stack>
              <Grid
                templateColumns={{
                  base: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(4, fit-content(320px))",
                }}
                columnGap="20"
                rowGap={{ base: "8", lg: "14" }}
              >
                <CategoryText title={t("pages.feed.refreshRateLabel")}>
                  {t("pages.feed.refreshRateValue", {
                    seconds: feed?.userRefreshRateSeconds || feed?.refreshRateSeconds,
                  })}
                </CategoryText>
                <CategoryText title={t("pages.feed.createdAtLabel")}>
                  {feed?.createdAt}
                </CategoryText>
                <CategoryText
                  title={t("pages.feed.articleDailyLimit")}
                  helpTooltip={{
                    description: t("pages.feed.articleDailyLimitHint"),
                  }}
                >
                  <HStack>
                    <Text color={isAtLimit ? "red.300" : ""} display="block">
                      {dailyLimit && `${dailyLimit.current}/${dailyLimit.max}`}
                    </Text>
                    {dailyLimit && (
                      <IconButton
                        as="a"
                        href="https://www.patreon.com/monitorss"
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label="Increase article daily limit"
                        variant="ghost"
                        icon={<ArrowLeftIcon />}
                        size="xs"
                        transform="rotate(90deg)"
                      />
                    )}
                    {!dailyLimit && <Spinner display="block" size="sm" />}
                  </HStack>
                </CategoryText>
              </Grid>
            </Stack>
            <TabList>
              <Tab
                onClick={() =>
                  navigate({
                    search: TabSearchParam.Connections,
                  })
                }
              >
                {t("pages.userFeeds.tabConnections")}
              </Tab>
              <Tab
                onClick={() =>
                  navigate({
                    search: TabSearchParam.Comparisons,
                  })
                }
              >
                {t("pages.userFeeds.tabComparisons")}
              </Tab>
              <Tab
                onClick={() =>
                  navigate({
                    search: TabSearchParam.Settings,
                  })
                }
              >
                {t("pages.userFeeds.settings")}
              </Tab>
              <Tab
                onClick={() =>
                  navigate({
                    search: TabSearchParam.Logs,
                  })
                }
              >
                {t("pages.userFeeds.tabLogs")}
              </Tab>
            </TabList>
          </Stack>
        </Stack>
        <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
          <TabPanel width="100%">
            {/**
             * https://github.com/chakra-ui/chakra-ui/issues/5636
             * There is a bug with Chakra where the connection card settings dropdown will cause
             * an overflow scroll on the tab panel.
             */}
            <BoxConstrained.Wrapper overflow="visible">
              <BoxConstrained.Container>
                <Stack spacing={6} mb={16}>
                  <Stack spacing={3}>
                    <Flex justifyContent="space-between" alignItems="flex-start">
                      <Heading size="md" as="h3">
                        {t("pages.userFeeds.tabConnections")}
                      </Heading>
                      <Menu placement="bottom-end">
                        <MenuButton colorScheme="blue" as={Button} rightIcon={<ChevronDownIcon />}>
                          {t("pages.feed.addConnectionButtonText")}
                        </MenuButton>
                        <MenuList maxWidth="300px">
                          <MenuItem onClick={() => onAddConnection("discord-channel")}>
                            <Stack spacing={1}>
                              <Text>{t("pages.feed.discordChannelMenuItem")}</Text>
                              <Text fontSize={13} color="whiteAlpha.600" whiteSpace="normal">
                                Send articles as messages authored by the bot to a Discord channel,
                                or as a thread in a forum channel.
                              </Text>
                            </Stack>
                          </MenuItem>
                          <MenuItem onClick={() => onAddConnection("discord-channel", true)}>
                            <Stack spacing={1}>
                              <Text>{t("pages.feed.discordThreadMenuItem")}</Text>
                              <Text fontSize={13} color="whiteAlpha.600">
                                Send articles authored by the bot as a message to an existing
                                thread.
                              </Text>
                            </Stack>
                          </MenuItem>
                          <MenuItem onClick={() => onAddConnection("discord-webhook")}>
                            <Stack spacing={1}>
                              <Text>{t("pages.feed.discordWebhookMenuItem")}</Text>
                              <Text fontSize={13} color="whiteAlpha.600">
                                Send articles authored by a webhook with a custom name and avatar as
                                a message to a Discord channel
                              </Text>
                            </Stack>
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Flex>
                    <Text>{t("pages.feed.connectionSectionDescription")}</Text>
                  </Stack>
                  {feed && !feed.connections.length && (
                    <Stack>
                      <Alert status="warning">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>You have no connections set up!</AlertTitle>
                          <AlertDescription>
                            <Stack>
                              <Text>
                                You&apos;ll need to set up at least one connection to tell the bot
                                where to send new articles!
                              </Text>
                              {addConnectionButtons}
                            </Stack>
                          </AlertDescription>
                        </Box>
                      </Alert>
                    </Stack>
                  )}
                  {feed?.connections.length && (
                    <SimpleGrid spacing={4} templateColumns="repeat(auto-fill, minmax(320px, 1fr))">
                      {feed?.connections?.map((connection) => {
                        return <ConnectionCard connection={connection} feedId={feedId as string} />;
                      })}
                    </SimpleGrid>
                  )}
                  {feed?.connections.length && addConnectionButtons}
                </Stack>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <ComparisonsTabSection
                  feedId={feedId as string}
                  passingComparisons={feed?.passingComparisons}
                  blockingComparisons={feed?.blockingComparisons}
                  onUpdate={({ passingComparisons, blockingComparisons }) =>
                    onUpdateFeed({
                      passingComparisons,
                      blockingComparisons,
                    })
                  }
                />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <UserFeedSettingsTabSection feedId={feedId as string} />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <UserFeedRequestsTable feedId={feedId} />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </DashboardContentV2>
  );
};
