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
import { useTranslation } from "react-i18next";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { useRef } from "react";
import { BoxConstrained, CategoryText, ConfirmModal } from "@/components";
import RouteParams from "@/types/RouteParams";
import {
  EditConnectionWebhookDialog,
  LogicalFilterExpression,
  useDiscordWebhookConnection,
  useUpdateDiscordWebhookConnection,
  DeleteConnectionButton,
  SendConnectionTestArticleButton,
  FiltersTabSection,
  MessageTabSection,
  ConnectionDisabledAlert,
  UpdateDiscordWebhookConnectionInput,
} from "../features/feedConnections";
import { useUserFeed } from "../features/feed";
import { DashboardContentV2 } from "../components/DashboardContentV2";
import { notifySuccess } from "../utils/notifySuccess";
import { notifyError } from "../utils/notifyError";
import { FeedConnectionDisabledCode, FeedConnectionType } from "../types";
import { pages } from "../constants";
import { DiscordServerName } from "../features/discordServers";

enum TabSearchParam {
  Message = "?view=message",
  Filters = "?view=filters",
}

const tabIndexBySearchParam = new Map<string, number>([
  [TabSearchParam.Message, 0],
  [TabSearchParam.Filters, 1],
]);

export const ConnectionDiscordWebhookSettings: React.FC = () => {
  const { feedId, connectionId } = useParams<RouteParams>();
  const navigate = useNavigate();
  const { search: urlSearch } = useLocation();
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
  } = useDiscordWebhookConnection({
    feedId,
    connectionId,
  });
  const { t } = useTranslation();
  const { mutateAsync, status: updateStatus } = useUpdateDiscordWebhookConnection();
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  const onUpdate = async (details: UpdateDiscordWebhookConnectionInput["details"]) => {
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
    }
  };

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={feedStatus === "loading" || connectionStatus === "loading"}
    >
      {connection && (
        <EditConnectionWebhookDialog
          onCloseRef={actionsButtonRef}
          feedId={feedId}
          onUpdate={({ webhook }) =>
            onUpdate({
              webhook,
            })
          }
          isOpen={editIsOpen}
          onClose={editOnClose}
          defaultValues={{
            name: connection.name,
            webhook: {
              id: connection.details.webhook.id,
              iconUrl: connection.details.webhook.iconUrl,
              name: connection.details.webhook.name,
            },
            serverId: connection.details.webhook.guildId,
          }}
        />
      )}
      <Tabs isLazy isFitted defaultIndex={tabIndexBySearchParam.get(urlSearch) || 0}>
        <BoxConstrained.Wrapper paddingTop={10} background="gray.700" spacing={0}>
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
                    <Heading size="lg">{connection?.name}</Heading>
                    {connection && (
                      <HStack>
                        <SendConnectionTestArticleButton
                          connectionId={connection.id}
                          feedId={feedId as string}
                          type={FeedConnectionType.DiscordWebhook}
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
                            as={Button}
                            variant="outline"
                            ref={actionsButtonRef}
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
                                  "pages.discordWebhookConnection.manualDisableConfirmTitle"
                                )}
                                description={t(
                                  "pages.discordWebhookConnection" +
                                    ".manualDisableConfirmDescription"
                                )}
                                trigger={
                                  <MenuItem isDisabled={updateStatus === "loading"}>
                                    {t("common.buttons.disable")}
                                  </MenuItem>
                                }
                                okText={t("common.buttons.yes")}
                                okLoading={updateStatus === "loading"}
                                colorScheme="blue"
                                onConfirm={() =>
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
                              type={FeedConnectionType.DiscordWebhook}
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
                <Alert
                  status="error"
                  hidden={
                    !connection || connection.disabledCode !== FeedConnectionDisabledCode.BadFormat
                  }
                  borderRadius="md"
                >
                  <Box>
                    <AlertTitle>
                      {t("pages.discordWebhookConnection.disabledAlertBadFormatTitle")}
                    </AlertTitle>
                    <AlertDescription display="block">
                      {t("pages.discordWebhookConnection.disabledAlertBadFormatDescription")}
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
                <CategoryText title="Server">
                  <DiscordServerName serverId={connection?.details.webhook.guildId} />
                </CategoryText>
                <CategoryText title="Webhook">{connection?.details.webhook.id}</CategoryText>
                <CategoryText title="Custom name">
                  {connection?.details.webhook.name || "N/A"}
                </CategoryText>
                <CategoryText title="Custom icon">
                  {connection?.details.webhook.iconUrl || "N/A"}
                </CategoryText>
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
            </TabList>
          </BoxConstrained.Container>
        </BoxConstrained.Wrapper>
        <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <MessageTabSection
                  feedId={feedId as string}
                  onMessageUpdated={({ content, embeds }) =>
                    onUpdate({
                      content,
                      embeds,
                    })
                  }
                  defaultMessageValues={{
                    content: connection?.details.content,
                    embeds: connection?.details.embeds,
                    splitOptions: connection?.splitOptions || null,
                    formatter: connection?.details.formatter,
                  }}
                  articleFormatter={{
                    options: {
                      formatTables: connection?.details?.formatter?.formatTables || false,
                      stripImages: connection?.details?.formatter?.stripImages || false,
                      dateFormat: feed?.formatOptions?.dateFormat,
                      dateTimezone: feed?.formatOptions?.dateTimezone,
                    },
                  }}
                  connection={{
                    id: connectionId as string,
                    type: FeedConnectionType.DiscordWebhook,
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
                      formatTables: connection?.details.formatter.formatTables || false,
                      stripImages: connection?.details.formatter.stripImages || false,
                      dateFormat: feed?.formatOptions?.dateFormat,
                      dateTimezone: feed?.formatOptions?.dateTimezone,
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
