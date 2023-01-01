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
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import {
  useParams, Link as RouterLink, useNavigate, useLocation,
} from 'react-router-dom';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { BoxConstrained, CategoryText, ConfirmModal } from '@/components';
import { DiscordMessageFormData } from '@/types/discord';
import RouteParams from '@/types/RouteParams';
import {
  EditConnectionWebhookDialog,
  FilterExpression,
  LogicalFilterExpression,
  useDiscordWebhookConnection,
  useUpdateDiscordWebhookConnection,
  DeleteConnectionButton,
  SendConnectionTestArticleButton,
  FiltersTabSection,
  MessageTabSection,
  ConnectionDisabledAlert,
} from '../features/feedConnections';
import { useUserFeed } from '../features/feed';
import { DashboardContentV2 } from '../components/DashboardContentV2';
import { notifySuccess } from '../utils/notifySuccess';
import { notifyError } from '../utils/notifyError';
import { FeedConnectionDisabledCode, FeedConnectionType } from '../types';
import { pages } from '../constants';

const getDefaultTabIndex = (search: string) => {
  if (search.includes('view=message')) {
    return 0;
  }

  if (search.includes('view=filters')) {
    return 1;
  }

  return -1;
};

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

  const onFiltersUpdated = async (filters: FilterExpression | null) => {
    if (!feedId || !connectionId) {
      return;
    }

    await mutateAsync({
      feedId,
      connectionId,
      details: {
        filters: filters ? {
          expression: filters,
        } : null,
      },
    });
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
      notifySuccess(t('common.success.savedChanges'));
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  const onWebhookUpdated = async ({
    webhook,
    name,
  }: {
    webhook?: {
      id?: string,
      name?: string,
      iconUrl?: string
    },
    name?: string }) => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details: {
          webhook,
          name,
        },
      });
      notifySuccess(t('common.success.savedChanges'));
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
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
      notifySuccess(t('common.success.savedChanges'));
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
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
      notifySuccess(t('common.success.savedChanges'));
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={feedStatus === 'loading'
      || connectionStatus === 'loading'}
    >
      <Tabs isLazy isFitted defaultIndex={getDefaultTabIndex(urlSearch)}>
        <BoxConstrained.Wrapper
          paddingTop={10}
          background="gray.700"
          spacing={0}
        >
          <BoxConstrained.Container
            spacing={12}
          >
            <Stack spacing={6}>
              <Stack
                spacing={4}
              >
                <Box>
                  <Breadcrumb>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        as={RouterLink}
                        to={pages.userFeeds()}
                      >
                        Feeds
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        as={RouterLink}
                        to={pages.userFeed(feedId as string)}
                      >
                        {feed?.title}

                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem isCurrentPage>
                      <BreadcrumbLink href="#">{connection?.name}</BreadcrumbLink>
                    </BreadcrumbItem>
                  </Breadcrumb>
                  <HStack alignItems="center" justifyContent="space-between">
                    <Heading
                      size="lg"
                    >
                      {connection?.name}
                    </Heading>
                    {connection && (
                    <HStack>
                      <SendConnectionTestArticleButton
                        connectionId={connection.id}
                        feedId={feedId as string}
                        type={FeedConnectionType.DiscordWebhook}
                      />
                      <Menu>
                        <MenuButton
                          as={Button}
                          variant="outline"
                          rightIcon={<ChevronDownIcon />}
                        >
                          {t('common.buttons.actions')}
                        </MenuButton>
                        <MenuList>
                          <EditConnectionWebhookDialog
                            feedId={feedId}
                            onUpdate={onWebhookUpdated}
                            defaultValues={{
                              name: connection.name,
                              webhook: {
                                id: connection.details.webhook.id,
                                iconUrl: connection.details.webhook.iconUrl,
                                name: connection.details.webhook.name,
                              },
                              serverId: connection.details.webhook.guildId,
                            }}
                            trigger={(
                              <MenuItem
                                aria-label="Edit"
                              >
                                {t('common.buttons.configure')}
                              </MenuItem>
                        )}
                          />
                          {
                            connection && !connection.disabledCode && (
                            <ConfirmModal
                              title={t('pages.discordWebhookConnection.manualDisableConfirmTitle')}
                              description={t('pages.discordWebhookConnection'
                                + '.manualDisableConfirmDescription')}
                              trigger={(
                                <MenuItem
                                  disabled={updateStatus === 'loading'}
                                >
                                  {t('common.buttons.disable')}
                                </MenuItem>
                            )}
                              okText={t('common.buttons.yes')}
                              okLoading={updateStatus === 'loading'}
                              colorScheme="blue"
                              onConfirm={() => onDisabled()}
                            />
                            )
                            }
                          <MenuDivider />
                          <DeleteConnectionButton
                            connectionId={connectionId as string}
                            feedId={feedId as string}
                            type={FeedConnectionType.DiscordWebhook}
                            trigger={(
                              <MenuItem>
                                {t('common.buttons.delete')}
                              </MenuItem>
                          )}
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
                  hidden={!connection
                    || connection.disabledCode !== FeedConnectionDisabledCode.BadFormat}
                  borderRadius="md"
                >
                  <Box>
                    <AlertTitle>
                      {t('pages.discordWebhookConnection.disabledAlertBadFormatTitle')}
                    </AlertTitle>
                    <AlertDescription display="block">
                      {t('pages.discordWebhookConnection.disabledAlertBadFormatDescription')}
                    </AlertDescription>
                  </Box>
                </Alert>
              </Stack>
              <Grid
                templateColumns={{
                  base: '1fr',
                  sm: 'repeat(2, 1fr)',
                  lg: 'repeat(4, fit-content(320px))',
                }}
                columnGap="20"
                rowGap={{ base: '8', lg: '14' }}
              >
                <CategoryText title="Webhook">
                  {connection?.details.webhook.id}
                </CategoryText>
                <CategoryText
                  title="Custom name"
                >
                  {connection?.details.webhook.name || 'N/A'}
                </CategoryText>
                <CategoryText title="Custom icon">
                  {connection?.details.webhook.iconUrl || 'N/A'}
                </CategoryText>
              </Grid>
            </Stack>
            <TabList>
              <Tab onClick={() => {
                navigate({
                  search: '?view=message',
                });
              }}
              >
                Message
              </Tab>
              <Tab onClick={() => {
                navigate({
                  search: '?view=filters',
                });
              }}
              >
                Filters
              </Tab>
              {/* <Tab>Settings</Tab> */}
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
