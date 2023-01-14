import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Grid,
  Heading,
  HStack,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useDisclosure,
} from "@chakra-ui/react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { BoxConstrained, CategoryText, ConfirmModal, DashboardContentV2 } from "../components";
import { pages } from "../constants";
import { DiscordChannelName } from "../features/discordServers";
import { useUserFeed } from "../features/feed";
import {
  DeleteConnectionButton,
  FilterExpression,
  LogicalFilterExpression,
  useDiscordChannelConnection,
  useUpdateDiscordChannelConnection,
  SendConnectionTestArticleButton,
  FiltersTabSection,
  MessageTabSection,
  ConnectionDisabledAlert,
  EditConnectionChannelDialog,
} from "../features/feedConnections";
import { FeedConnectionDisabledCode, FeedConnectionType } from "../types";
import { DiscordMessageFormData } from "../types/discord";
import RouteParams from "../types/RouteParams";
import { notifyError } from "../utils/notifyError";
import { notifySuccess } from "../utils/notifySuccess";

const getDefaultTabIndex = (search: string) => {
  if (search.includes("view=message")) {
    return 0;
  }

  if (search.includes("view=filters")) {
    return 1;
  }

  return 0;
};

export const ConnectionDiscordChannelSettings: React.FC = () => {
  const { feedId, connectionId } = useParams<RouteParams>();
  const navigate = useNavigate();
  const { search: urlSearch } = useLocation();
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  const {
    feed,
    status: feedStatus,
    error: feedError,
  } = useUserFeed({
    feedId,
  });
  const {
    connection,
    status: connectionStatus,
    error: connectionError,
  } = useDiscordChannelConnection({
    connectionId,
    feedId,
  });
  const { t } = useTranslation();
  const { mutateAsync, status: updateStatus } = useUpdateDiscordChannelConnection();

  const serverId = connection?.details.channel.guildId;

  const onFiltersUpdated = async (filters: FilterExpression | null) => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details: {
          filters: filters
            ? {
                expression: filters,
              }
            : null,
        },
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), err as Error);
      throw err;
    }
  };

  const onMessageUpdated = async (data: DiscordMessageFormData) => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details: {
          content: data.content,
          embeds: data.embeds,
        },
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const onChannelUpdated = async (data: { channelId?: string; name?: string }) => {
    if (!feedId || !connectionId) {
      return;
    }

    await mutateAsync({
      feedId,
      connectionId,
      details: {
        name: data.name,
        channelId: data.channelId,
      },
    });
  };

  const onDisabled = async () => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details: {
          disabledCode: FeedConnectionDisabledCode.Manual,
        },
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const onEnabled = async () => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details: {
          disabledCode: null,
        },
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={feedStatus === "loading" || connectionStatus === "loading"}
    >
      <EditConnectionChannelDialog
        onCloseRef={actionsButtonRef}
        defaultValues={{
          channelId: connection.details.channel.id,
          name: connection.name,
          serverId,
        }}
        onUpdate={onChannelUpdated}
        isOpen={editIsOpen}
        onClose={editOnClose}
      />
      <Tabs isLazy isFitted defaultIndex={getDefaultTabIndex(urlSearch)}>
        <BoxConstrained.Wrapper paddingTop={10} background="gray.700">
          <BoxConstrained.Container spacing={12}>
            <Stack spacing={6}>
              <Stack spacing={4}>
                <Box>
                  <Breadcrumb>
                    <BreadcrumbItem>
                      <BreadcrumbLink as={RouterLink} to={pages.userFeeds()}>
                        Feeds
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem>
                      <BreadcrumbLink as={RouterLink} to={pages.userFeed(feedId as string)}>
                        {feed?.title}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem isCurrentPage>
                      <BreadcrumbLink href="#">{connection?.name}</BreadcrumbLink>
                    </BreadcrumbItem>
                  </Breadcrumb>
                  <HStack alignItems="center" justifyContent="space-between">
                    <Heading size="lg" marginRight={4}>
                      {connection?.name}
                    </Heading>
                    {connection && (
                      <HStack>
                        <SendConnectionTestArticleButton
                          connectionId={connectionId as string}
                          feedId={feedId as string}
                          type={FeedConnectionType.DiscordChannel}
                        />
                        <Menu>
                          <MenuButton
                            ref={actionsButtonRef}
                            as={Button}
                            variant="outline"
                            rightIcon={<ChevronDownIcon />}
                          >
                            {t("common.buttons.actions")}
                          </MenuButton>
                          <MenuList>
                            <MenuItem aria-label="Edit" onClick={editOnOpen}>
                              {t("common.buttons.configure")}
                            </MenuItem>
                            {connection && !connection.disabledCode && (
                              <ConfirmModal
                                title={t(
                                  "pages.discordChannelConnection.manualDisableConfirmTitle"
                                )}
                                description={t(
                                  "pages.discordChannelConnection" +
                                    ".manualDisableConfirmDescription"
                                )}
                                trigger={
                                  <MenuItem disabled={updateStatus === "loading"}>
                                    {t("common.buttons.disable")}
                                  </MenuItem>
                                }
                                okText={t("common.buttons.yes")}
                                okLoading={updateStatus === "loading"}
                                colorScheme="blue"
                                onConfirm={() => onDisabled()}
                              />
                            )}
                            <MenuDivider />
                            <DeleteConnectionButton
                              connectionId={connectionId as string}
                              feedId={feedId as string}
                              type={FeedConnectionType.DiscordChannel}
                              trigger={<MenuItem>{t("common.buttons.delete")}</MenuItem>}
                            />
                          </MenuList>
                        </Menu>
                      </HStack>
                    )}
                  </HStack>
                </Box>
                <ConnectionDisabledAlert
                  disabledCode={connection?.disabledCode}
                  onEnable={onEnabled}
                />
                <Alert
                  status="error"
                  hidden={
                    !connection || connection.disabledCode !== FeedConnectionDisabledCode.BadFormat
                  }
                  borderRadius="md"
                >
                  <Box>
                    <AlertTitle>
                      {t("pages.discordChannelConnection.disabledAlertBadFormatTitle")}
                    </AlertTitle>
                    <AlertDescription display="block">
                      {t("pages.discordChannelConnection.disabledAlertBadFormatDescription")}
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
                <CategoryText title="Channel">
                  <DiscordChannelName
                    serverId={serverId}
                    channelId={connection?.details.channel.id as string}
                  />
                </CategoryText>
              </Grid>
            </Stack>
            <TabList>
              <Tab
                onClick={() => {
                  navigate({
                    search: "?view=message",
                  });
                }}
              >
                Message
              </Tab>
              <Tab
                onClick={() => {
                  navigate({
                    search: "?view=filters",
                  });
                }}
              >
                Filters
              </Tab>
            </TabList>
          </BoxConstrained.Container>
        </BoxConstrained.Wrapper>
        <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
          <TabPanel>
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <MessageTabSection
                  feedId={feedId}
                  onMessageUpdated={onMessageUpdated}
                  defaultMessageValues={{
                    content: connection?.details.content,
                    embeds: connection?.details.embeds,
                  }}
                />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <FiltersTabSection
                  onFiltersUpdated={onFiltersUpdated}
                  feedId={feedId}
                  filters={connection?.filters?.expression as LogicalFilterExpression}
                />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </DashboardContentV2>
  );
};
