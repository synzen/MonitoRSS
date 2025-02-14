import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Grid,
  Heading,
  HStack,
  MenuButton,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { BoxConstrained, CategoryText, DashboardContentV2 } from "../components";
import { pages } from "../constants";
import { DiscordChannelName, DiscordServerName } from "../features/discordServers";
import { useUserFeed } from "../features/feed";
import {
  LogicalFilterExpression,
  useDiscordChannelConnection,
  useUpdateDiscordChannelConnection,
  SendConnectionTestArticleButton,
  FiltersTabSection,
  MessageTabSection,
  ConnectionDisabledAlert,
  UpdateDiscordChannelConnectionInput,
} from "../features/feedConnections";
import { CustomPlaceholdersTabSection } from "../features/feedConnections/components/CustomPlaceholdersTabSection";
import { FeedDiscordChannelConnection } from "../types";
import RouteParams from "../types/RouteParams";
import { notifyError } from "../utils/notifyError";
import { notifySuccess } from "../utils/notifySuccess";
import { DeliveryRateLimitsTabSection } from "../features/feedConnections/components/DeliveryRateLimitsTabSection";
import { useDiscordWebhook } from "../features/discordWebhooks";
import { DiscordChannelConnectionSettings } from "../features/feedConnections/components/ConnectionCard/DiscordChannelConnectionSettings";
import { UserFeedConnectionTabSearchParam } from "../constants/userFeedConnectionTabSearchParam";
import { UserFeedConnectionProvider } from "../contexts/UserFeedConnectionContext";
import { UserFeedProvider } from "../contexts/UserFeedContext";

const tabIndexBySearchParam = new Map<string, number>([
  [UserFeedConnectionTabSearchParam.Message, 0],
  [UserFeedConnectionTabSearchParam.Filters, 1],
  [UserFeedConnectionTabSearchParam.RateLimits, 2],
  [UserFeedConnectionTabSearchParam.CustomPlaceholders, 3],
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
  const { mutateAsync } = useUpdateDiscordChannelConnection();

  const serverId = connection?.details?.channel?.guildId || connection?.details?.webhook?.guildId;

  const { data: discordWebhookResult, status: discordWebhooksStatus } = useDiscordWebhook({
    webhookId: connection?.details.webhook?.id,
  });

  const matchingWebhook = discordWebhookResult?.result;

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

  const tabIndex = tabIndexBySearchParam.get(urlSearch);

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={feedStatus === "loading" || connectionStatus === "loading"}
    >
      <UserFeedProvider feedId={feedId}>
        <UserFeedConnectionProvider feedId={feedId} connectionId={connectionId}>
          <Tabs isLazy isFitted defaultIndex={tabIndex ?? 0} index={tabIndex ?? undefined}>
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
                        <Heading size="lg" marginRight={4} tabIndex={-1} as="h1">
                          {connection?.name}
                        </Heading>
                        {connection && (
                          <HStack>
                            <SendConnectionTestArticleButton />
                            <DiscordChannelConnectionSettings
                              connection={connection}
                              redirectOnCloneSuccess
                              trigger={
                                <MenuButton
                                  ref={actionsButtonRef}
                                  as={Button}
                                  variant="outline"
                                  rightIcon={<ChevronDownIcon />}
                                  aria-label="Connection actions"
                                >
                                  {t("common.buttons.actions")}
                                </MenuButton>
                              }
                              feedId={feedId as string}
                            />
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
                    <CategoryText
                      title={t("pages.discordChannelConnection.channelNameLabel")}
                      hidden={!connection?.details.channel}
                    >
                      <DiscordChannelName
                        serverId={serverId}
                        channelId={connection?.details.channel?.id || ""}
                        hidden={!connection?.details.channel}
                      />
                    </CategoryText>
                    <CategoryText
                      title={t("pages.discordChannelConnection.channelTypeLabel")}
                      hidden={!!connection?.details.webhook}
                    >
                      <Text>{getPrettyChannelType(connection?.details)}</Text>
                    </CategoryText>
                    <CategoryText
                      title="Webhook"
                      hidden={
                        !connection?.details.webhook ||
                        connection.details.webhook.isApplicationOwned
                      }
                    >
                      {discordWebhooksStatus === "loading" ? <Spinner size="sm" /> : null}
                      <HStack>
                        <Text>{matchingWebhook?.name}</Text>
                        <DiscordChannelName
                          serverId={serverId}
                          channelId={matchingWebhook?.channelId || ""}
                          parenthesis
                          spinnerSize="sm"
                          hidden={!matchingWebhook}
                        />
                      </HStack>
                    </CategoryText>
                    <CategoryText
                      title="Webhook Channel"
                      hidden={
                        !connection?.details.webhook ||
                        !connection.details.webhook.isApplicationOwned
                      }
                    >
                      {discordWebhooksStatus === "loading" ? <Spinner size="sm" /> : null}
                      <HStack>
                        <DiscordChannelName
                          serverId={serverId}
                          channelId={matchingWebhook?.channelId || ""}
                          spinnerSize="sm"
                          hidden={!matchingWebhook}
                        />
                      </HStack>
                    </CategoryText>
                    <CategoryText title="Webhook name" hidden={!connection?.details.webhook}>
                      {connection?.details.webhook?.name || "N/A"}
                    </CategoryText>
                    <CategoryText title="Webhook icon" hidden={!connection?.details.webhook}>
                      {connection?.details.webhook?.iconUrl || "N/A"}
                    </CategoryText>
                  </Grid>
                </Stack>
                <TabList>
                  <Tab
                    fontWeight="semibold"
                    onClick={() => {
                      navigate({
                        search: UserFeedConnectionTabSearchParam.Message,
                      });
                    }}
                  >
                    Message Format
                  </Tab>
                  <Tab
                    fontWeight="semibold"
                    onClick={() => {
                      navigate({
                        search: UserFeedConnectionTabSearchParam.Filters,
                      });
                    }}
                  >
                    Filters
                  </Tab>
                  <Tab
                    fontWeight="semibold"
                    onClick={() =>
                      navigate({ search: UserFeedConnectionTabSearchParam.RateLimits })
                    }
                  >
                    Delivery Rate Limits
                  </Tab>
                  <Tab
                    fontWeight="semibold"
                    onClick={() => {
                      navigate({
                        search: UserFeedConnectionTabSearchParam.CustomPlaceholders,
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
                      guildId={serverId}
                      onMessageUpdated={(data) => onUpdate(data)}
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
                      filters={connection?.filters?.expression as LogicalFilterExpression}
                    />
                  </BoxConstrained.Container>
                </BoxConstrained.Wrapper>
              </TabPanel>
              <TabPanel width="100%">
                <BoxConstrained.Wrapper>
                  <BoxConstrained.Container>
                    <DeliveryRateLimitsTabSection />
                  </BoxConstrained.Container>
                </BoxConstrained.Wrapper>
              </TabPanel>
              <TabPanel width="100%">
                <BoxConstrained.Wrapper>
                  <BoxConstrained.Container>
                    <CustomPlaceholdersTabSection />
                  </BoxConstrained.Container>
                </BoxConstrained.Wrapper>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </UserFeedConnectionProvider>
      </UserFeedProvider>
    </DashboardContentV2>
  );
};
