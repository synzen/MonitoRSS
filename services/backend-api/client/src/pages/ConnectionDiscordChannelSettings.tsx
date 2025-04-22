import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Box,
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
import RouteParams from "../types/RouteParams";
import { DeliveryRateLimitsTabSection } from "../features/feedConnections/components/DeliveryRateLimitsTabSection";
import { useDiscordWebhook } from "../features/discordWebhooks";
import { DiscordChannelConnectionSettings } from "../features/feedConnections/components/ConnectionCard/DiscordChannelConnectionSettings";
import { UserFeedConnectionTabSearchParam } from "../constants/userFeedConnectionTabSearchParam";
import {
  UserFeedConnectionProvider,
  useUserFeedConnectionContext,
} from "../contexts/UserFeedConnectionContext";
import { UserFeedProvider, useUserFeedContext } from "../contexts/UserFeedContext";
import { getPrettyConnectionName } from "../utils/getPrettyConnectionName";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../contexts/PageAlertContext";
import { TabContentContainer } from "../components/TabContentContainer";
import { FeedDiscordChannelConnection } from "../types";

const tabIndexBySearchParam = new Map<string, number>([
  [UserFeedConnectionTabSearchParam.Message, 0],
  [UserFeedConnectionTabSearchParam.Filters, 1],
  [UserFeedConnectionTabSearchParam.RateLimits, 2],
  [UserFeedConnectionTabSearchParam.CustomPlaceholders, 3],
]);

export const ConnectionDiscordChannelSettings: React.FC = () => {
  const { feedId, connectionId } = useParams<RouteParams>();
  const { status: feedStatus, error: feedError } = useUserFeed({
    feedId,
  });
  const { status: connectionStatus, error: connectionError } = useDiscordChannelConnection({
    connectionId,
    feedId,
  });

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={feedStatus === "loading" || connectionStatus === "loading"}
    >
      <UserFeedProvider feedId={feedId}>
        <UserFeedConnectionProvider feedId={feedId} connectionId={connectionId}>
          <Box display="flex" flexDirection="column" pt={4} alignItems="center" isolation="isolate">
            <PageAlertProvider>
              <ConnectionDiscordChannelSettingsInner />
            </PageAlertProvider>
          </Box>
        </UserFeedConnectionProvider>
      </UserFeedProvider>
    </DashboardContentV2>
  );
};

const ConnectionDiscordChannelSettingsInner: React.FC = () => {
  const { feedId, connectionId } = useParams<RouteParams>();
  const navigate = useNavigate();
  const { search: urlSearch } = useLocation();
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const { userFeed: feed } = useUserFeedContext();
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { t } = useTranslation();
  const { mutateAsync } = useUpdateDiscordChannelConnection();
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();

  const serverId = connection?.details?.channel?.guildId || connection?.details?.webhook?.guildId;

  const { data: discordWebhookResult, status: discordWebhooksStatus } = useDiscordWebhook({
    webhookId: connection?.details.webhook?.id,
  });

  const matchingWebhook = discordWebhookResult?.result;

  const onUpdate = async (
    details: UpdateDiscordChannelConnectionInput["details"],
    updateLabel: string
  ) => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details,
      });

      createSuccessAlert({
        title: `Successfully updated ${updateLabel}.`,
      });
    } catch (err) {
      createErrorAlert({
        title: `Failed to update ${updateLabel}.`,
        description: (err as Error).message,
      });

      throw err;
    }
  };

  const tabIndex = tabIndexBySearchParam.get(urlSearch);

  return (
    <>
      <PageAlertContextOutlet
        containerProps={{
          maxW: "1400px",
          w: "100%",
          display: "flex",
          justifyContent: "center",
          paddingX: [4, 4, 8, 12],
          pb: 4,
          pt: 0,
        }}
      />
      <Tabs isLazy isFitted defaultIndex={tabIndex ?? 0} index={tabIndex ?? undefined} width="100%">
        <BoxConstrained.Wrapper>
          <BoxConstrained.Container spacing={4} px={4}>
            <Stack spacing={6}>
              <Stack spacing={4}>
                <Stack>
                  <Breadcrumb>
                    <BreadcrumbItem>
                      <BreadcrumbLink as={RouterLink} to={pages.userFeeds()} color="blue.300">
                        Feeds
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        as={RouterLink}
                        to={pages.userFeed(feedId as string)}
                        color="blue.300"
                      >
                        {feed?.title}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem isCurrentPage>
                      <BreadcrumbLink href="#">{connection?.name}</BreadcrumbLink>
                    </BreadcrumbItem>
                  </Breadcrumb>
                  <HStack
                    alignItems="center"
                    justifyContent="space-between"
                    flexWrap="wrap"
                    gap={3}
                  >
                    <Heading size="lg" marginRight={4} tabIndex={-1} as="h1">
                      {connection?.name}
                    </Heading>
                    {connection && (
                      <HStack flexWrap="wrap">
                        <SendConnectionTestArticleButton />
                        <DiscordChannelConnectionSettings
                          connection={connection}
                          trigger={
                            <MenuButton
                              ref={actionsButtonRef}
                              as={Button}
                              variant="outline"
                              rightIcon={<ChevronDownIcon />}
                            >
                              <span>Connection Actions</span>
                            </MenuButton>
                          }
                          feedId={feedId as string}
                        />
                      </HStack>
                    )}
                  </HStack>
                </Stack>
                <ConnectionDisabledAlert />
              </Stack>
              <TabContentContainer>
                <Stack spacing={6}>
                  <Heading as="h2" size="md">
                    Connection Overview
                  </Heading>
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
                      <Text>{connection ? getPrettyConnectionName(connection) : ""}</Text>
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
                    <CategoryText
                      title="Webhook icon"
                      hidden={!connection?.details.webhook}
                      valueContainerProps={{
                        wordBreak: "break-all",
                      }}
                    >
                      {connection?.details.webhook?.iconUrl || "N/A"}
                    </CategoryText>
                  </Grid>
                </Stack>
              </TabContentContainer>
            </Stack>
            <TabList overflow="auto">
              <Tab
                fontWeight={tabIndex === 0 ? "bold" : "semibold"}
                onClick={() => {
                  navigate({
                    search: UserFeedConnectionTabSearchParam.Message,
                  });
                }}
              >
                Message Format
              </Tab>
              <Tab
                fontWeight={tabIndex === 1 ? "bold" : "semibold"}
                onClick={() => {
                  navigate({
                    search: UserFeedConnectionTabSearchParam.Filters,
                  });
                }}
              >
                Article Filters
              </Tab>
              <Tab
                fontWeight={tabIndex === 2 ? "bold" : "semibold"}
                onClick={() => navigate({ search: UserFeedConnectionTabSearchParam.RateLimits })}
              >
                Delivery Rate Limits
              </Tab>
              <Tab
                fontWeight={tabIndex === 3 ? "bold" : "semibold"}
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
        <TabPanels width="100%" display="flex" justifyContent="center">
          <TabPanel padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <TabContentContainer>
                  <MessageTabSection
                    guildId={serverId}
                    onMessageUpdated={(data) => onUpdate(data, "message format")}
                  />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <TabContentContainer>
                  <FiltersTabSection
                    onFiltersUpdated={(filters) =>
                      onUpdate(
                        {
                          filters: filters
                            ? {
                                expression: filters,
                              }
                            : null,
                        },
                        "filters"
                      )
                    }
                    filters={connection?.filters?.expression as LogicalFilterExpression}
                  />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <TabContentContainer>
                  <DeliveryRateLimitsTabSection />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <TabContentContainer>
                  <CustomPlaceholdersTabSection />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  );
};
