import { ChevronDownIcon } from '@chakra-ui/icons';
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
import { CategoryText, DashboardContentV2 } from '../components';
import { pages } from '../constants';
import { DiscordChannelName } from '../features/discordServers';
import { useUserFeed } from '../features/feed';
import {
  DeleteConnectionButton,
  EditConnectionChannelDialog,
  FilterExpression,
  LogicalFilterExpression,
  useDiscordChannelConnection,
  useUpdateDiscordChannelConnection,
  SendConnectionTestArticleButton,
  FiltersTabSection,
  MessageTabSection,
} from '../features/feedConnections';
import { FeedConnectionDisabledCode, FeedConnectionType } from '../types';
import { DiscordMessageFormData } from '../types/discord';
import RouteParams from '../types/RouteParams';
import { notifyError } from '../utils/notifyError';
import { notifySuccess } from '../utils/notifySuccess';

export const ConnectionDiscordChannelSettings: React.FC = () => {
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
  } = useDiscordChannelConnection({
    connectionId,
    feedId,
  });
  const { t } = useTranslation();
  const {
    mutateAsync,
  } = useUpdateDiscordChannelConnection();

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
          filters: filters ? {
            expression: filters,
          } : null,
        },
      });
      notifySuccess(t('common.success.savedChanges'));
    } catch (err) {
      notifyError(t('common.errors.failedToSave'), err as Error);
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
      notifySuccess(t('common.success.savedChanges'));
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  const onChannelUpdated = async (data: { channelId?: string, name?: string }) => {
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

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={
        feedStatus === 'loading'
          || connectionStatus === 'loading'
      }
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
                      marginRight={4}
                    >
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
                          as={Button}
                          variant="outline"
                          rightIcon={<ChevronDownIcon />}
                        >
                          {t('common.buttons.actions')}
                        </MenuButton>
                        <MenuList>
                          <EditConnectionChannelDialog
                            defaultValues={{
                              channelId: connection.details.channel.id,
                              name: connection.name,
                              serverId,
                            }}
                            onUpdate={onChannelUpdated}
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
                            type={FeedConnectionType.DiscordChannel}
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
                      {t('pages.discordChannelConnection.disabledAlertBadFormatTitle')}
                    </AlertTitle>
                    <AlertDescription display="block">
                      {t('pages.discordChannelConnection.disabledAlertBadFormatDescription')}
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
                <CategoryText title="Channel">
                  <DiscordChannelName
                    serverId={serverId}
                    channelId={connection
                      ?.details.channel.id as string}
                  />
                </CategoryText>
              </Grid>
            </Stack>
            <TabList>
              <Tab>Message</Tab>
              <Tab>Filters</Tab>
            </TabList>
          </Stack>
        </Stack>
        <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
          <TabPanel maxWidth="1200px" width="100%">
            <MessageTabSection
              feedId={feedId}
              onMessageUpdated={onMessageUpdated}
              defaultMessageValues={{
                content: connection?.details.content,
                embeds: connection?.details.embeds,
              }}
            />
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
