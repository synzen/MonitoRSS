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
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { EditIcon } from '@chakra-ui/icons';
import { CategoryText, DiscordMessageForm } from '@/components';
import { DiscordMessageFormData } from '@/types/discord';
import RouteParams from '@/types/RouteParams';
import {
  EditConnectionWebhookDialog,
  FilterExpression,
  FiltersForm,
  LogicalFilterExpression,
  useDiscordWebhookConnection,
  useUpdateDiscordWebhookConnection,
  DeleteConnectionButton,
} from '../features/feedConnections';
import { UserFeedHealthStatus, useUserFeed } from '../features/feed';
import { DashboardContentV2 } from '../components/DashboardContentV2';

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
        filters,
      },
    });
  };

  const onMessageUpdated = async (data: DiscordMessageFormData) => {
    if (!feedId || !connectionId) {
      return;
    }

    await mutateAsync({
      feedId,
      connectionId,
      details: {
        content: data.content,
        embeds: data.embeds,
      },
    });
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

    await mutateAsync({
      feedId,
      connectionId,
      details: {
        webhook,
        name,
      },
    });
  };

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={feedStatus === 'loading'
      || connectionStatus === 'loading'}
    >
      <Tabs isFitted>
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
                      <BreadcrumbLink href="#">Webhook</BreadcrumbLink>
                    </BreadcrumbItem>
                  </Breadcrumb>
                  <HStack alignItems="center" justifyContent="space-between">
                    <Heading
                      size="lg"
                    >
                      Stocks
                    </Heading>
                    <HStack>
                      {connection && (
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
                          <Button
                            aria-label="Edit"
                            variant="outline"
                            leftIcon={<EditIcon />}
                          >
                            {t('common.buttons.configure')}
                          </Button>
                        )}
                      />
                      )}
                      <DeleteConnectionButton
                        connectionId={connectionId as string}
                        feedId={feedId as string}
                      />
                    </HStack>
                  </HStack>
                </Box>
                <Alert
                  status="error"
                  hidden={!feed || feed.healthStatus !== UserFeedHealthStatus.Failed}
                >
                  <Box>
                    <AlertTitle>
                      {t('pages.feed.connectionFailureTitle')}
                    </AlertTitle>
                    <AlertDescription display="block">
                      {t('pages.feed.connectionFailureText', {
                        reason: feed?.healthStatus || t('pages.feed.unknownReason'),
                      })}
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
              <Tab>Settings</Tab>
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
            <FiltersForm
              onSave={onFiltersUpdated}
              expression={connection?.filters?.expression as LogicalFilterExpression}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </DashboardContentV2>
  );
};
