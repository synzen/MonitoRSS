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
import { useParams, Link as RouterLink } from 'react-router-dom';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { CategoryText, DiscordMessageForm } from '@/components';
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
} from '../features/feedConnections';
import { useUserFeed } from '../features/feed';
import { DashboardContentV2 } from '../components/DashboardContentV2';
import { notifySuccess } from '../utils/notifySuccess';
import { notifyError } from '../utils/notifyError';
import { FeedConnectionDisabledCode, FeedConnectionType } from '../types';

export const ConnectionDiscordWebhookSettings: React.FC = () => {
  const { feedId, connectionId } = useParams<RouteParams>();
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
  const { mutateAsync } = useUpdateDiscordWebhookConnection();

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

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={feedStatus === 'loading'
      || connectionStatus === 'loading'}
    >
      <Tabs isLazy isFitted>
        <Stack
          width="100%"
          minWidth="100%"
          paddingTop={12}
          background="gray.700"
          paddingX={{ base: 4, lg: 12 }}
          alignItems="center"
          spacing={0}
        >
          <Stack
            maxWidth="1200px"
            width="100%"
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
                        to="/v2/feeds"
                      >
                        Feeds
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        as={RouterLink}
                        to={`/v2/feeds/${feedId}`}
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
                <Alert
                  status="error"
                  hidden={!connection
                    || connection.disabledCode !== FeedConnectionDisabledCode.BadFormat}
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
              <Tab>Message</Tab>
              <Tab>Filters</Tab>
              {/* <Tab>Settings</Tab> */}
            </TabList>
          </Stack>

        </Stack>
        <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
          <TabPanel maxWidth="1200px" width="100%">
            <Stack>
              <DiscordMessageForm
                onClickSave={onMessageUpdated}
                defaultValues={{
                  content: connection?.details.content,
                  embeds: connection?.details.embeds,
                }}
              />
            </Stack>
          </TabPanel>
          <TabPanel maxWidth="1200px" width="100%">
            <FiltersTabSection
              onFiltersUpdated={onFiltersUpdated}
              feedId={feedId}
              filters={connection?.filters?.expression as LogicalFilterExpression}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </DashboardContentV2>
  );
};
