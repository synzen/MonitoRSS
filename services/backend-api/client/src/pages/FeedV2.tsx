import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Divider,
  Flex,
  Grid,
  Heading,
  HStack,
  Link,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Spinner,
  Stack,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { useState } from 'react';
import { CategoryText, ConfirmModal } from '@/components';
import {
  EditUserFeedDialog,
  RefreshUserFeedButton,
  useArticleDailyLimit,
  useDeleteUserFeed,
  UserFeedDisabledCode,
  useUpdateUserFeed,
  useUserFeed,
} from '../features/feed';
import RouteParams from '../types/RouteParams';
import { DashboardContentV2 } from '../components/DashboardContentV2';
import { AddConnectionDialog } from '../features/feedConnections';
import { FeedConnectionType } from '../types';
import { notifySuccess } from '../utils/notifySuccess';
import { notifyError } from '../utils/notifyError';

const PRETTY_CONNECTION_NAMES: Record<FeedConnectionType, string> = {
  [FeedConnectionType.DiscordChannel]: 'Discord Channel',
  [FeedConnectionType.DiscordWebhook]: 'Discord Webhook',
};

const getConnectionUrlByType = (type: FeedConnectionType) => {
  switch (type) {
    case FeedConnectionType.DiscordChannel:
      return '/discord-channel-connections';
    case FeedConnectionType.DiscordWebhook:
      return '/discord-webhook-connections';
    default:
      return '';
  }
};

export const FeedV2: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const [addConnectionType, setAddConnectionType] = useState<FeedConnectionType | undefined>(
    undefined,
  );
  const {
    data: dailyLimit,
  } = useArticleDailyLimit({
    feedId,
  });
  const {
    feed, status, error,
  } = useUserFeed({
    feedId,
  });
  const {
    mutateAsync: mutateAsyncUserFeed,
    status: updatingStatus,
  } = useUpdateUserFeed();

  const {
    mutateAsync,
    status: deleteingStatus,
  } = useDeleteUserFeed();

  const onAddConnection = (type: FeedConnectionType) => {
    setAddConnectionType(type);
    onOpen();
  };

  const onDeleteFeed = async () => {
    if (!feedId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
      });
      notifySuccess(t('common.success.deleted'));
      navigate('/v2/feeds');
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  const onUpdateFeed = async ({
    title,
    url,
    disabledCode,
  }: { title?: string, url?: string, disabledCode?: UserFeedDisabledCode.Manual | null }) => {
    if (!feedId) {
      return;
    }

    try {
      await mutateAsyncUserFeed({
        feedId,
        data: {
          title,
          url: url === feed?.url ? undefined : url,
          disabledCode,
        },
      });
      notifySuccess(t('common.success.savedChanges'));
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
      throw err;
    }
  };

  return (
    <DashboardContentV2
      error={error}
      loading={status === 'loading'}
    >
      <AddConnectionDialog isOpen={isOpen} type={addConnectionType} onClose={onClose} />
      <Tabs isFitted>
        <Stack
          width="100%"
          minWidth="100%"
          paddingTop={12}
          background="gray.800"
          paddingX={{ base: 4, lg: 12 }}
          alignItems="center"
        >
          <Stack
            maxWidth="1200px"
            width="100%"
            spacing={6}
          >
            <Stack spacing={6}>
              <Stack
                spacing={4}
              >
                <HStack justifyContent="space-between">
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
                      <BreadcrumbItem isCurrentPage>
                        <BreadcrumbLink href="#">
                          {feed?.title}
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                    </Breadcrumb>
                    <HStack alignItems="center">
                      <Heading
                        size="lg"
                        marginRight={4}
                      >
                        {feed?.title}
                      </Heading>
                    </HStack>
                    <Link
                      color="gray.400"
                      _hover={{
                        color: 'gray.200',
                      }}
                      href={feed?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {feed?.url}
                    </Link>
                  </Box>
                  <Menu>
                    <MenuButton
                      as={Button}
                      variant="outline"
                      rightIcon={<ChevronDownIcon />}
                    >
                      {t('pages.userFeed.actionsButtonText')}
                    </MenuButton>
                    <MenuList>
                      <EditUserFeedDialog
                        trigger={(
                          <MenuItem
                            aria-label="Edit"
                          >
                            {t('common.buttons.configure')}
                          </MenuItem>
                        )}
                        defaultValues={{
                          title: feed?.title as string,
                          url: feed?.url as string,
                        }}
                        onUpdate={onUpdateFeed}
                      />
                      {
                      feed && !feed.disabledCode && (
                      <ConfirmModal
                        title={t('pages.userFeed.disableFeedConfirmTitle')}
                        description={t('pages.userFeed.disableFeedConfirmDescription')}
                        trigger={(
                          <MenuItem
                            disabled={updatingStatus === 'loading'}
                          >
                            {t('pages.userFeed.disableFeedButtonText')}
                          </MenuItem>
                      )}
                        okText={t('common.buttons.yes')}
                        okLoading={updatingStatus === 'loading'}
                        colorScheme="blue"
                        onConfirm={() => onUpdateFeed({
                          disabledCode: UserFeedDisabledCode.Manual,
                        })}
                      />
                      )
                      }
                      <MenuDivider />
                      {
                      feedId && (
                      <ConfirmModal
                        title={t('pages.userFeed.deleteConfirmTitle')}
                        description={t('pages.userFeed.deleteConfirmDescription')}
                        trigger={(
                          <MenuItem
                            disabled={deleteingStatus === 'loading'}
                          >
                            {t('common.buttons.delete')}
                          </MenuItem>
                        )}
                        okText={t('pages.userFeed.deleteConfirmOk')}
                        okLoading={deleteingStatus === 'loading'}
                        colorScheme="red"
                        onConfirm={onDeleteFeed}
                      />
                      )
                    }
                    </MenuList>
                  </Menu>
                </HStack>
                <Alert
                  status="info"
                  hidden={!feed || feed.disabledCode !== UserFeedDisabledCode.Manual}
                >
                  <Box>
                    <AlertTitle>
                      {t('pages.userFeed.manuallyDisabledTitle')}
                    </AlertTitle>
                    <AlertDescription display="block">
                      {t('pages.userFeed.manuallyDisabledDescription')}
                      <Box marginTop="1rem">
                        <Button
                          isLoading={updatingStatus === 'loading'}
                          onClick={() => onUpdateFeed({
                            disabledCode: null,
                          })}
                        >
                          {t('pages.userFeed.manuallyDisabledEnableButtonText')}
                        </Button>
                      </Box>
                    </AlertDescription>
                  </Box>
                </Alert>
                <Alert
                  status="error"
                  hidden={!feed || feed.disabledCode !== UserFeedDisabledCode.FailedRequests}
                >
                  <Box>
                    <AlertTitle>
                      {t('pages.feed.connectionFailureTitle')}
                    </AlertTitle>
                    <AlertDescription display="block">
                      {t('pages.feed.connectionFailureText', {
                        reason: feed?.healthStatus,
                      })}
                      <Box marginTop="1rem">
                        {feedId && (
                        <RefreshUserFeedButton
                          feedId={feedId}
                        />
                        )}
                      </Box>
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
                <CategoryText title={t('pages.feed.refreshRateLabel')}>
                  {t('pages.feed.refreshRateValue', {
                    seconds: feed?.refreshRateSeconds,
                  })}
                </CategoryText>
                <CategoryText
                  title={t('pages.feed.createdAtLabel')}
                >
                  {feed?.createdAt}
                </CategoryText>
                <CategoryText title={t('pages.feed.articleDailyLimit')}>
                  {dailyLimit && `${dailyLimit.current}/${dailyLimit.max}`}
                  {!dailyLimit && <Spinner size="sm" />}
                </CategoryText>
              </Grid>
            </Stack>
            <Divider />
            <Stack spacing={6}>
              <Stack>
                <Flex justifyContent="space-between" alignItems="center">
                  <Heading size="md">Connections</Heading>
                  <Menu>
                    <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                      {t('pages.feed.addConnectionButtonText')}
                    </MenuButton>
                    <MenuList>
                      <MenuItem
                        onClick={() => onAddConnection(FeedConnectionType.DiscordChannel)}
                      >
                        {t('pages.feed.discordChannelMenuItem')}
                      </MenuItem>
                      <MenuItem
                        onClick={() => onAddConnection(FeedConnectionType.DiscordWebhook)}
                      >
                        {t('pages.feed.discordWebhookMenuItem')}
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </Flex>
                <Text>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
                  sollicitudin
                  varius quam vitae facilisis. Donec nec feugiat lacus.
                </Text>
              </Stack>
              <Stack>
                {feed?.connections?.map((connection) => (
                  <Link
                    key={connection.id}
                    as={RouterLink}
                    to={`/v2/feeds/${feedId}${
                      getConnectionUrlByType(connection.key)
                    }/${connection.id}`}
                  >
                    <Flex
                      background="gray.700"
                      paddingX={8}
                      paddingY={4}
                      borderRadius="md"
                      flexDirection="column"
                    >
                      <Stack spacing="1">
                        <Text
                          color="gray.500"
                          fontSize="sm"
                        >
                          {PRETTY_CONNECTION_NAMES[connection.key]}

                        </Text>
                        <Stack spacing="0">
                          <Text
                            fontWeight={600}
                          >
                            {connection.name}
                          </Text>
                        </Stack>
                      </Stack>
                    </Flex>
                  </Link>
                ))}
              </Stack>
            </Stack>
            <Stack spacing={6}>
              Hello world
            </Stack>
          </Stack>
        </Stack>
        <TabPanels>
          <TabPanel />
          <TabPanel>
            Hello world
          </TabPanel>
        </TabPanels>
      </Tabs>
    </DashboardContentV2>
  );
};
