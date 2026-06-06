import {
  Box,
  BreadcrumbCurrentLink,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbRoot,
  BreadcrumbSeparator,
  Button,
  Grid,
  Heading,
  HStack,
  Spinner,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { FaChevronDown } from "react-icons/fa6";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { BoxConstrained, CategoryText, DashboardContentV2 } from "@/components";
import { pages } from "@/constants";
import { DiscordChannelName, DiscordServerName } from "@/features/discordServers";
import {
  useUserFeed,
  UserFeedConnectionProvider,
  useUserFeedConnectionContext,
  UserFeedProvider,
  useUserFeedContext,
} from "@/features/feed";
import {
  LogicalFilterExpression,
  useDiscordChannelConnection,
  useUpdateDiscordChannelConnection,
  SendConnectionTestArticleButton,
  FiltersTabSection,
  MessageTabSection,
  ConnectionDisabledAlert,
  UpdateDiscordChannelConnectionInput,
} from "@/features/feedConnections";
import { CustomPlaceholdersTabSection } from "../CustomPlaceholdersTabSection";
import RouteParams from "@/types/RouteParams";
import { DeliveryRateLimitsTabSection } from "../DeliveryRateLimitsTabSection";
import { useDiscordWebhook } from "@/features/discordWebhooks";
import { DiscordChannelConnectionSettings } from "../ConnectionCard/DiscordChannelConnectionSettings";
import { UserFeedConnectionTabSearchParam } from "@/constants/userFeedConnectionTabSearchParam";

import { getConnectionDestinationLabel } from "../../utils/getPrettyConnectionName";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "@/contexts/PageAlertContext";
import { TabContentContainer } from "@/components/TabContentContainer";
import { FeedDiscordChannelConnection } from "@/types";
import { UserFeedTabSearchParam } from "@/constants/userFeedTabSearchParam";

const tabIndexBySearchParam = new Map<string, number>([
  [UserFeedConnectionTabSearchParam.Message, 0],
  [UserFeedConnectionTabSearchParam.Filters, 1],
  [UserFeedConnectionTabSearchParam.RateLimits, 2],
  [UserFeedConnectionTabSearchParam.CustomPlaceholders, 3],
]);

const tabValues = ["message", "filters", "rate-limits", "custom-placeholders"];

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

  const destinationLabel = getConnectionDestinationLabel(
    connection?.details?.channel?.type,
    connection?.details?.webhook?.type,
  );

  const { data: discordWebhookResult, status: discordWebhooksStatus } = useDiscordWebhook({
    webhookId: connection?.details.webhook?.id,
  });

  const matchingWebhook = discordWebhookResult?.result;

  const onUpdate = async (
    details: UpdateDiscordChannelConnectionInput["details"],
    updateLabel: string,
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
          paddingX: 4,
          pb: 4,
          pt: 0,
        }}
      />
      <Tabs.Root
        lazyMount
        variant="enclosed"
        fitted
        defaultValue={tabValues[tabIndex ?? 0]}
        value={tabIndex !== undefined ? tabValues[tabIndex] : undefined}
        width="100%"
      >
        <BoxConstrained.Wrapper>
          <BoxConstrained.Container gap={4} px={4}>
            <Stack gap={6}>
              <Stack gap={4}>
                <Stack>
                  <BreadcrumbRoot>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild color="text.link">
                          <RouterLink to={pages.userFeeds()}>Feeds</RouterLink>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild color="text.link">
                          <RouterLink to={pages.userFeed(feedId as string)}>
                            {feed?.title}
                          </RouterLink>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild color="text.link">
                          <RouterLink
                            to={pages.userFeed(feedId as string, {
                              tab: UserFeedTabSearchParam.Connections,
                            })}
                          >
                            Connections
                          </RouterLink>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbCurrentLink>{connection?.name}</BreadcrumbCurrentLink>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </BreadcrumbRoot>
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
                            <Button ref={actionsButtonRef} variant="outline">
                              <span>Connection Actions</span>
                              <FaChevronDown />
                            </Button>
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
                <Stack gap={6}>
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
                    <CategoryText title={destinationLabel} hidden={!connection?.details.channel}>
                      <DiscordChannelName
                        serverId={serverId}
                        channelId={connection?.details.channel?.id || ""}
                        hidden={!connection?.details.channel}
                      />
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
                          hidden={!matchingWebhook}
                        />
                      </HStack>
                    </CategoryText>
                    <CategoryText
                      title={destinationLabel}
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
                          hidden={!matchingWebhook}
                        />
                      </HStack>
                    </CategoryText>
                    <CategoryText title="Display Name" hidden={!connection?.details.webhook}>
                      {connection?.details.webhook?.name || "N/A"}
                    </CategoryText>
                    <CategoryText
                      title="Avatar URL"
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
            <Tabs.List overflow="auto">
              <Tabs.Trigger
                value="message"
                fontWeight={tabIndex === 0 ? "bold" : "semibold"}
                onClick={() => {
                  navigate({
                    search: UserFeedConnectionTabSearchParam.Message,
                  });
                }}
              >
                Message Format
              </Tabs.Trigger>
              <Tabs.Trigger
                value="filters"
                fontWeight={tabIndex === 1 ? "bold" : "semibold"}
                onClick={() => {
                  navigate({
                    search: UserFeedConnectionTabSearchParam.Filters,
                  });
                }}
              >
                Article Filters
              </Tabs.Trigger>
              <Tabs.Trigger
                value="rate-limits"
                fontWeight={tabIndex === 2 ? "bold" : "semibold"}
                onClick={() => navigate({ search: UserFeedConnectionTabSearchParam.RateLimits })}
              >
                Delivery Rate Limits
              </Tabs.Trigger>
              <Tabs.Trigger
                value="custom-placeholders"
                fontWeight={tabIndex === 3 ? "bold" : "semibold"}
                onClick={() => {
                  navigate({
                    search: UserFeedConnectionTabSearchParam.CustomPlaceholders,
                  });
                }}
              >
                Custom Placeholders
              </Tabs.Trigger>
            </Tabs.List>
          </BoxConstrained.Container>
        </BoxConstrained.Wrapper>
        <Tabs.ContentGroup width="100%" display="flex" justifyContent="center">
          <Tabs.Content value="message" padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container px={4}>
                <TabContentContainer>
                  <MessageTabSection
                    guildId={serverId}
                    onMessageUpdated={(data, extra) =>
                      onUpdate({ ...data, ...extra }, "message format")
                    }
                  />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </Tabs.Content>
          <Tabs.Content value="filters" padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container px={4}>
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
                        "filters",
                      )
                    }
                    filters={connection?.filters?.expression as LogicalFilterExpression}
                  />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </Tabs.Content>
          <Tabs.Content value="rate-limits" padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container px={4}>
                <TabContentContainer>
                  <DeliveryRateLimitsTabSection />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </Tabs.Content>
          <Tabs.Content value="custom-placeholders" padding={0} py={4} width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container px={4}>
                <TabContentContainer>
                  <CustomPlaceholdersTabSection />
                </TabContentContainer>
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </Tabs.Content>
        </Tabs.ContentGroup>
      </Tabs.Root>
    </>
  );
};
