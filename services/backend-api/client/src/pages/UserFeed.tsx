import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Link,
  Menu,
  MenuButton,
  MenuDivider,
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
  Wrap,
} from "@chakra-ui/react";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { useRef, useState } from "react";
import { BoxConstrained, CategoryText, ConfirmModal } from "@/components";
import {
  EditUserFeedDialog,
  UpdateUserFeedInput,
  useArticleDailyLimit,
  useCreateUserFeedLegacyRestore,
  useDeleteUserFeed,
  UserFeedDisabledAlert,
  UserFeedDisabledCode,
  useUpdateUserFeed,
  useUserFeed,
} from "../features/feed";
import RouteParams from "../types/RouteParams";
import { DashboardContentV2 } from "../components/DashboardContentV2";
import {
  AddConnectionDialog,
  ComparisonsTabSection,
  UserFeedSettingsTabSection,
} from "../features/feedConnections";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  FeedDiscordChannelConnection,
  FeedDiscordWebhookConnection,
} from "../types";
import { notifySuccess } from "../utils/notifySuccess";
import { notifyError } from "../utils/notifyError";
import { pages } from "../constants";
import { UserFeedRequestsTable } from "../features/feed/components/UserFeedRequestsTable";
import getChakraColor from "../utils/getChakraColor";

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

function getPrettyConnectionName(
  connection: FeedDiscordChannelConnection | FeedDiscordWebhookConnection
) {
  const { key } = connection;

  if (key === FeedConnectionType.DiscordChannel) {
    const casted = connection as FeedDiscordChannelConnection;

    if (casted.details.channel.type === "thread") {
      return "Discord Thread";
    }

    if (casted.details.channel.type === "forum") {
      return "Discord Forum";
    }

    return "Discord Channel";
  }

  if (key === FeedConnectionType.DiscordWebhook) {
    return "Discord Webhook";
  }

  return "Unknown";
}

const DISABLED_CODES_FOR_ERROR = [
  FeedConnectionDisabledCode.MissingMedium,
  FeedConnectionDisabledCode.MissingPermissions,
  FeedConnectionDisabledCode.BadFormat,
];

export const UserFeed: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { search: urlSearch } = useLocation();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [addConnectionType, setAddConnectionType] = useState<
    { type: FeedConnectionType; isChannelThread?: boolean } | undefined
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

  const onAddConnection = (type: FeedConnectionType, isChannelThread?: boolean) => {
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
                <HStack justifyContent="space-between">
                  <Box>
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
                    <HStack alignItems="center">
                      <Heading size="lg" marginRight={4}>
                        {feed?.title}
                      </Heading>
                    </HStack>
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
                  </Box>
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
                                  If you are currently facing issues with personal feeds, you may
                                  convert this feed back to a legacy feed.
                                </Text>
                                <Text>
                                  Legacy feeds are still scheduled to be permanently disabled. If
                                  you are facing issues, please reach out to Support for remediation
                                  so that you can convert this back to a personal feed as soon as
                                  possible.
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
                    seconds: feed?.refreshRateSeconds,
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
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <Stack spacing={6}>
                  <Stack spacing={3}>
                    <Flex justifyContent="space-between" alignItems="flex-start">
                      <Heading size="md" as="h3">
                        {t("pages.userFeeds.tabConnections")}
                      </Heading>
                      <Menu>
                        <MenuButton colorScheme="blue" as={Button} rightIcon={<ChevronDownIcon />}>
                          {t("pages.feed.addConnectionButtonText")}
                        </MenuButton>
                        <MenuList>
                          <MenuItem
                            onClick={() => onAddConnection(FeedConnectionType.DiscordChannel)}
                          >
                            {t("pages.feed.discordChannelMenuItem")}
                          </MenuItem>
                          <MenuItem
                            onClick={() => onAddConnection(FeedConnectionType.DiscordChannel, true)}
                          >
                            {t("pages.feed.discordThreadMenuItem")}
                          </MenuItem>
                          <MenuItem
                            onClick={() => onAddConnection(FeedConnectionType.DiscordWebhook)}
                          >
                            {t("pages.feed.discordWebhookMenuItem")}
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Flex>
                    <Text>{t("pages.feed.connectionSectionDescription")}</Text>
                  </Stack>
                  <Stack spacing={2} mb={4}>
                    {feed?.connections?.map((connection) => {
                      const isError = DISABLED_CODES_FOR_ERROR.includes(
                        connection.disabledCode as FeedConnectionDisabledCode
                      );

                      return (
                        <Link
                          key={connection.id}
                          as={RouterLink}
                          to={pages.userFeedConnection({
                            feedId: feedId as string,
                            connectionType: connection.key,
                            connectionId: connection.id,
                          })}
                          border={`solid 2px ${
                            isError ? getChakraColor("red.300") : "transparent"
                          }`}
                          borderRadius="md"
                          textDecoration="none"
                          _hover={{
                            textDecoration: "none",
                            color: "blue.300",
                            border: `solid 2px ${getChakraColor("blue.300")}`,
                            borderRadius: "md",
                          }}
                          boxShadow="lg"
                        >
                          <Flex
                            background="gray.700"
                            paddingX={8}
                            paddingY={4}
                            borderRadius="md"
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Stack spacing="1">
                              <HStack>
                                <Text color="gray.500" fontSize="sm">
                                  {getPrettyConnectionName(connection as never)}
                                </Text>
                                {connection.disabledCode === FeedConnectionDisabledCode.Manual && (
                                  <Badge fontSize="x-small" colorScheme="blue">
                                    Disabled
                                  </Badge>
                                )}
                                {isError && (
                                  <Badge fontSize="x-small" colorScheme="red">
                                    Error
                                  </Badge>
                                )}
                              </HStack>
                              <Stack spacing="0">
                                <HStack alignItems="flex-end">
                                  <Text fontWeight={600}>{connection.name}</Text>
                                </HStack>
                              </Stack>
                            </Stack>
                            <Icon
                              as={ChevronRightIcon}
                              alignSelf="flex-end"
                              fontSize="xx-large"
                              style={{
                                alignSelf: "center",
                              }}
                            />
                          </Flex>
                        </Link>
                      );
                    })}
                  </Stack>
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
