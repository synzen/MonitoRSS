import { ChevronDownIcon } from "@chakra-ui/icons";
import {
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
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { BoxConstrained, CategoryText, ConfirmModal, DashboardContentV2 } from "../components";
import { pages } from "../constants";
import { DiscordChannelName, DiscordServerName } from "../features/discordServers";
import { useUserFeed } from "../features/feed";
import {
  DeleteConnectionButton,
  LogicalFilterExpression,
  useDiscordChannelConnection,
  useUpdateDiscordChannelConnection,
  SendConnectionTestArticleButton,
  FiltersTabSection,
  MessageTabSection,
  ConnectionDisabledAlert,
  EditConnectionChannelDialog,
  UpdateDiscordChannelConnectionInput,
  CloneDiscordConnectionCloneDialog,
  EditConnectionWebhookDialog,
} from "../features/feedConnections";
import { CustomPlaceholdersTabSection } from "../features/feedConnections/components/CustomPlaceholdersTabSection";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "../types";
import RouteParams from "../types/RouteParams";
import { notifyError } from "../utils/notifyError";
import { notifySuccess } from "../utils/notifySuccess";
import { DeliveryRateLimitsTabSection } from "../features/feedConnections/components/DeliveryRateLimitsTabSection";
import { useDiscordWebhooks } from "../features/discordWebhooks";

enum TabSearchParam {
  Message = "?view=message",
  Filters = "?view=filters",
  RateLimits = "?view=rate-limits",
  CustomPlaceholders = "?view=custom-placeholders",
}

const tabIndexBySearchParam = new Map<string, number>([
  [TabSearchParam.Message, 0],
  [TabSearchParam.Filters, 1],
  [TabSearchParam.RateLimits, 2],
  [TabSearchParam.CustomPlaceholders, 3],
]);

const getPrettyChannelType = (details?: FeedDiscordChannelConnection["details"]) => {
  const { t } = useTranslation();

  if (details?.webhook) {
    const { type } = details.webhook;

    if (type === "forum") {
      return t("pages.discordChannelConnection.channelTypeForum");
    }

    return "Discord Webhook";
  }

  if (details?.channel) {
    const { type } = details.channel;

    if (type === "thread") {
      return t("pages.discordChannelConnection.channelTypeThread");
    }

    if (type === "forum") {
      return t("pages.discordChannelConnection.channelTypeForum");
    }

    return t("pages.discordChannelConnection.channelTypeTextChannel");
  }

  return "";
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

  const serverId = connection?.details?.channel?.guildId || connection?.details?.webhook?.guildId;

  const { data: discordWebhooks, status: discordWebhooksStatus } = useDiscordWebhooks({
    serverId,
    isWebhooksEnabled: !!connection?.details.webhook,
  });

  const matchingWebhook =
    connection?.details.webhook &&
    discordWebhooks?.find((webhook) => webhook.id === connection.details.webhook?.id);

  const onUpdate = async (details: UpdateDiscordChannelConnectionInput["details"]) => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details,
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
      throw err;
    }
  };

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={feedStatus === "loading" || connectionStatus === "loading"}
    >
      {connection?.details.channel && (
        <EditConnectionChannelDialog
          onCloseRef={actionsButtonRef}
          defaultValues={{
            channelId: connection.details.channel.id,
            name: connection.name,
            serverId: connection.details.channel.id,
          }}
          onUpdate={({ channelId: updatedChannelId, name }) =>
            onUpdate({
              channelId: updatedChannelId,
              name,
            })
          }
          isOpen={editIsOpen}
          onClose={editOnClose}
        />
      )}
      {connection?.details.webhook && (
        <EditConnectionWebhookDialog
          feedId={feedId}
          onCloseRef={actionsButtonRef}
          isOpen={editIsOpen}
          onClose={editOnClose}
          onUpdate={({ webhook }) =>
            onUpdate({
              webhook: {
                id: webhook.id,
                name: webhook.name,
                iconUrl: webhook.iconUrl,
              },
            })
          }
          defaultValues={{
            name: connection.name,
            serverId: connection.details.webhook.guildId,
            webhook: {
              id: connection.details.webhook.id,
              iconUrl: connection.details.webhook.iconUrl,
              name: connection.details.webhook.name,
            },
          }}
        />
      )}
      <Tabs isLazy isFitted defaultIndex={tabIndexBySearchParam.get(urlSearch) || 0}>
        <BoxConstrained.Wrapper paddingTop={10} background="gray.700">
          <BoxConstrained.Container spacing={12}>
            <Stack spacing={6}>
              <Stack spacing={4}>
                <Stack>
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
                          articleFormatter={{
                            options: {
                              formatTables: connection?.details.formatter?.formatTables || false,
                              stripImages: connection?.details.formatter?.stripImages || false,
                              dateFormat: feed?.formatOptions?.dateFormat,
                              dateTimezone: feed?.formatOptions?.dateTimezone,
                            },
                          }}
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
                            {connection && (
                              <CloneDiscordConnectionCloneDialog
                                trigger={<MenuItem>Clone</MenuItem>}
                                defaultValues={{
                                  name: `${connection.name} (Clone)`,
                                }}
                                type={FeedConnectionType.DiscordChannel}
                                connectionId={connectionId as string}
                                feedId={feedId as string}
                              />
                            )}
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
                                  <MenuItem isDisabled={updateStatus === "loading"}>
                                    {t("common.buttons.disable")}
                                  </MenuItem>
                                }
                                okText={t("common.buttons.yes")}
                                colorScheme="blue"
                                onConfirm={async () =>
                                  onUpdate({
                                    disabledCode: FeedConnectionDisabledCode.Manual,
                                  })
                                }
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
                </Stack>
                <ConnectionDisabledAlert
                  disabledCode={connection?.disabledCode}
                  onEnable={() =>
                    onUpdate({
                      disabledCode: null,
                    })
                  }
                />
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
                <CategoryText title={t("pages.discordChannelConnection.serverLabel")}>
                  <DiscordServerName serverId={serverId} />
                </CategoryText>
                {connection?.details.channel && (
                  <>
                    <CategoryText title={t("pages.discordChannelConnection.channelNameLabel")}>
                      <DiscordChannelName
                        serverId={serverId}
                        channelId={connection.details.channel.id}
                      />
                    </CategoryText>
                    <CategoryText title={t("pages.discordChannelConnection.channelTypeLabel")}>
                      <Text>{getPrettyChannelType(connection?.details)}</Text>
                    </CategoryText>
                  </>
                )}
                {connection?.details.webhook && (
                  <>
                    <CategoryText title="Webhook">
                      {discordWebhooksStatus === "loading" ? <Spinner size="sm" /> : null}
                      {matchingWebhook && (
                        <HStack>
                          <Text>{matchingWebhook.name}</Text>
                          <DiscordChannelName
                            serverId={serverId}
                            channelId={matchingWebhook.channelId}
                            parenthesis
                            spinnerSize="sm"
                          />
                        </HStack>
                      )}
                    </CategoryText>
                    <CategoryText title="Custom name">
                      {connection?.details.webhook.name || "N/A"}
                    </CategoryText>
                    <CategoryText title="Custom icon">
                      {connection?.details.webhook.iconUrl || "N/A"}
                    </CategoryText>
                  </>
                )}
              </Grid>
            </Stack>
            <TabList>
              <Tab
                onClick={() => {
                  navigate({
                    search: TabSearchParam.Message,
                  });
                }}
              >
                Message
              </Tab>
              <Tab
                onClick={() => {
                  navigate({
                    search: TabSearchParam.Filters,
                  });
                }}
              >
                Filters
              </Tab>
              <Tab onClick={() => navigate({ search: TabSearchParam.RateLimits })}>
                Delivery Rate Limits
              </Tab>
              <Tab
                onClick={() => {
                  navigate({
                    search: TabSearchParam.CustomPlaceholders,
                  });
                }}
              >
                Custom Placeholders
              </Tab>
            </TabList>
          </BoxConstrained.Container>
        </BoxConstrained.Wrapper>
        <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <MessageTabSection
                  feedId={feedId as string}
                  guildId={serverId}
                  onMessageUpdated={(data) => onUpdate(data)}
                  defaultMessageValues={{
                    content: connection?.details.content,
                    splitOptions: connection?.splitOptions || null,
                    forumThreadTitle: connection?.details.forumThreadTitle,
                    forumThreadTags: connection?.details.forumThreadTags || [],
                    mentions: connection?.mentions,
                    customPlaceholders: connection?.customPlaceholders,
                    ...connection?.details,
                  }}
                  articleFormatter={{
                    customPlaceholders: connection?.customPlaceholders,
                    options: {
                      formatTables: connection?.details.formatter?.formatTables || false,
                      stripImages: connection?.details.formatter?.stripImages || false,
                      dateFormat: feed?.formatOptions?.dateFormat,
                      dateTimezone: feed?.formatOptions?.dateTimezone,
                      ...feed?.formatOptions,
                    },
                  }}
                  connection={{
                    id: connectionId as string,
                    type: FeedConnectionType.DiscordChannel,
                  }}
                  include={{
                    forumThreadTitle:
                      connection?.details.channel?.type === "forum" ||
                      connection?.details.webhook?.type === "forum",
                    forumThreadTags: connection?.details.channel?.type === "forum",
                  }}
                />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <FiltersTabSection
                  onFiltersUpdated={(filters) =>
                    onUpdate({
                      filters: filters
                        ? {
                            expression: filters,
                          }
                        : null,
                    })
                  }
                  feedId={feedId}
                  filters={connection?.filters?.expression as LogicalFilterExpression}
                  articleFormatter={{
                    options: {
                      formatTables: connection?.details.formatter?.formatTables || false,
                      stripImages: connection?.details.formatter?.stripImages || false,
                      dateFormat: feed?.formatOptions?.dateFormat,
                      dateTimezone: feed?.formatOptions?.dateTimezone,
                    },
                  }}
                />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <DeliveryRateLimitsTabSection
                  connectionId={connectionId as string}
                  feedId={feedId as string}
                  connectionType={FeedConnectionType.DiscordChannel}
                />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <CustomPlaceholdersTabSection
                  connectionId={connectionId as string}
                  feedId={feedId as string}
                  connectionType={FeedConnectionType.DiscordChannel}
                  articleFormat={{
                    customPlaceholders: connection?.customPlaceholders,
                    options: {
                      formatTables: connection?.details.formatter?.formatTables || false,
                      stripImages: connection?.details.formatter?.stripImages || false,
                      dateFormat: feed?.formatOptions?.dateFormat,
                      dateTimezone: feed?.formatOptions?.dateTimezone,
                      ...feed?.formatOptions,
                    },
                  }}
                />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </DashboardContentV2>
  );
};
