import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
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
} from "@chakra-ui/react";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, WarningIcon } from "@chakra-ui/icons";
import { useRef, useState } from "react";
import { BoxConstrained, CategoryText, ConfirmModal } from "@/components";
import {
  EditUserFeedDialog,
  RefreshUserFeedButton,
  UpdateUserFeedInput,
  useArticleDailyLimit,
  useDeleteUserFeed,
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
import { FeedConnectionDisabledCode, FeedConnectionType } from "../types";
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
  [TabSearchParam.Logs, 2],
]);

const PRETTY_CONNECTION_NAMES: Record<FeedConnectionType, string> = {
  [FeedConnectionType.DiscordChannel]: "Discord Channel",
  [FeedConnectionType.DiscordWebhook]: "Discord Webhook",
};

export const UserFeed: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { search: urlSearch } = useLocation();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [addConnectionType, setAddConnectionType] = useState<FeedConnectionType | undefined>(
    undefined
  );
  const { data: dailyLimit } = useArticleDailyLimit({
    feedId,
  });
  const { feed, status, error } = useUserFeed({
    feedId,
  });
  const { mutateAsync: mutateAsyncUserFeed, status: updatingStatus } = useUpdateUserFeed();

  const { mutateAsync, status: deleteingStatus } = useDeleteUserFeed();

  const onAddConnection = (type: FeedConnectionType) => {
    setAddConnectionType(type);
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

  return (
    <DashboardContentV2 error={error} loading={status === "loading"}>
      <AddConnectionDialog isOpen={isOpen} type={addConnectionType} onClose={onClose} />
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
                            <MenuItem disabled={updatingStatus === "loading"}>
                              {t("pages.userFeed.disableFeedButtonText")}
                            </MenuItem>
                          }
                          okText={t("common.buttons.yes")}
                          okLoading={updatingStatus === "loading"}
                          colorScheme="blue"
                          onConfirm={() =>
                            onUpdateFeed({
                              disabledCode: UserFeedDisabledCode.Manual,
                            })
                          }
                        />
                      )}
                      <MenuDivider />
                      {feedId && (
                        <ConfirmModal
                          title={t("pages.userFeed.deleteConfirmTitle")}
                          description={t("pages.userFeed.deleteConfirmDescription")}
                          trigger={
                            <MenuItem disabled={deleteingStatus === "loading"}>
                              {t("common.buttons.delete")}
                            </MenuItem>
                          }
                          okText={t("pages.userFeed.deleteConfirmOk")}
                          okLoading={deleteingStatus === "loading"}
                          colorScheme="red"
                          onConfirm={onDeleteFeed}
                        />
                      )}
                    </MenuList>
                  </Menu>
                </HStack>
                <Alert
                  status="info"
                  hidden={!feed || feed.disabledCode !== UserFeedDisabledCode.Manual}
                  borderRadius="md"
                >
                  <Box>
                    <AlertTitle>{t("pages.userFeed.manuallyDisabledTitle")}</AlertTitle>
                    <AlertDescription display="block">
                      {t("pages.userFeed.manuallyDisabledDescription")}
                      <Box marginTop="1rem">
                        <Button
                          isLoading={updatingStatus === "loading"}
                          onClick={() =>
                            onUpdateFeed({
                              disabledCode: null,
                            })
                          }
                        >
                          {t("pages.userFeed.manuallyDisabledEnableButtonText")}
                        </Button>
                      </Box>
                    </AlertDescription>
                  </Box>
                </Alert>
                <Alert
                  status="error"
                  hidden={!feed || feed.disabledCode !== UserFeedDisabledCode.InvalidFeed}
                  borderRadius="md"
                >
                  <Box>
                    <AlertTitle>{t("pages.userFeed.invalidFeedFailureTitle")}</AlertTitle>
                    <AlertDescription display="block">
                      {t("pages.userFeed.invalidFeedFailureText")}
                      <Box marginTop="1rem">
                        {feedId && <RefreshUserFeedButton feedId={feedId} />}
                      </Box>
                    </AlertDescription>
                  </Box>
                </Alert>
                <Alert
                  status="error"
                  hidden={!feed || feed.disabledCode !== UserFeedDisabledCode.FailedRequests}
                  borderRadius="md"
                >
                  <Box>
                    <AlertTitle>{t("pages.userFeed.connectionFailureTitle")}</AlertTitle>
                    <AlertDescription display="block">
                      {t("pages.userFeed.connectionFailureText")}
                      <Box marginTop="1rem">
                        {feedId && <RefreshUserFeedButton feedId={feedId} />}
                      </Box>
                    </AlertDescription>
                  </Box>
                </Alert>
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
                  <Text color={isAtLimit ? "red.300" : ""} display="block">
                    {dailyLimit && `${dailyLimit.current}/${dailyLimit.max}`}
                  </Text>
                  {!dailyLimit && <Spinner display="block" size="sm" />}
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
                    search: TabSearchParam.Logs,
                  })
                }
              >
                {t("pages.userFeeds.settings")}
              </Tab>
              <Tab
                onClick={() =>
                  navigate({
                    search: TabSearchParam.Settings,
                  })
                }
              >
                {t("pages.userFeeds.tabLogs")}
              </Tab>
            </TabList>
          </Stack>
        </Stack>
        <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
          <TabPanel width="100%" tabIndex={-1}>
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <Stack spacing={6}>
                  <Stack spacing={3}>
                    <Flex justifyContent="space-between" alignItems="center">
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
                            onClick={() => onAddConnection(FeedConnectionType.DiscordWebhook)}
                          >
                            {t("pages.feed.discordWebhookMenuItem")}
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Flex>
                    <Text>{t("pages.feed.connectionSectionDescription")}</Text>
                  </Stack>
                  <Stack>
                    {feed?.connections?.map((connection) => (
                      <Link
                        key={connection.id}
                        as={RouterLink}
                        to={pages.userFeedConnection({
                          feedId: feedId as string,
                          connectionType: connection.key,
                          connectionId: connection.id,
                        })}
                        textDecoration="none"
                        _hover={{
                          textDecoration: "none",
                          color: "blue.300",
                        }}
                      >
                        <Flex
                          background="gray.700"
                          paddingX={8}
                          paddingY={4}
                          borderRadius="md"
                          flexDirection="column"
                        >
                          <Stack spacing="1">
                            <Text color="gray.500" fontSize="sm">
                              {PRETTY_CONNECTION_NAMES[connection.key]}
                            </Text>
                            <Stack spacing="0">
                              <HStack alignItems="flex-end">
                                {connection.disabledCode &&
                                  connection.disabledCode !== FeedConnectionDisabledCode.Manual && (
                                    <WarningIcon color={`${getChakraColor("red.500")}`} />
                                  )}
                                <Text fontWeight={600}>{connection.name}</Text>
                              </HStack>
                            </Stack>
                          </Stack>
                        </Flex>
                      </Link>
                    ))}
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
