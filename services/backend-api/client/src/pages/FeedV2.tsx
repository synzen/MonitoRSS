import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
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
  UserFeedHealthStatus,
  useUpdateUserFeed,
  useUserFeed,
} from '../features/feed';
import RouteParams from '../types/RouteParams';
import { DashboardContentV2 } from '../components/DashboardContentV2';
import { AddConnectionDialog } from '../features/feedConnections';
import { FeedConnectionType } from '../types';
import { notifySuccess } from '../utils/notifySuccess';
import { notifyError } from '../utils/notifyError';

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
  }: { title?: string, url?: string }) => {
    if (!feedId) {
      return;
    }

    try {
      await mutateAsyncUserFeed({
        feedId,
        data: {
          title,
          url: url === feed?.url ? undefined : url,
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
      loading={status === 'loading' || status === 'idle'}
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
                  <HStack>
                    <EditUserFeedDialog
                      trigger={(
                        <Button
                          aria-label="Edit"
                          variant="outline"
                          leftIcon={<EditIcon />}
                        >
                          {t('common.buttons.configure')}
                        </Button>
                      )}
                      defaultValues={{
                        title: feed?.title as string,
                        url: feed?.url as string,
                      }}
                      onUpdate={onUpdateFeed}
                    />
                    {
                    feedId && (
                    <ConfirmModal
                      title={t('pages.userFeed.deleteConfirmTitle')}
                      description={t('pages.userFeed.deleteConfirmDescription')}
                      trigger={(
                        <Button
                          variant="outline"
                          disabled={deleteingStatus === 'loading'}
                          leftIcon={<DeleteIcon />}
                        >
                          {t('common.buttons.delete')}
                        </Button>
                      )}
                      okText={t('pages.userFeed.deleteConfirmOk')}
                      okLoading={deleteingStatus === 'loading'}
                      colorScheme="red"
                      onConfirm={onDeleteFeed}
                    />
                    )
                  }
                  </HStack>
                </HStack>
                <Alert
                  status="error"
                  hidden={!feed || feed.healthStatus !== UserFeedHealthStatus.Ok}
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
                      alignItems="center"
                      borderRadius="md"
                    >
                      <Avatar name="Go" />
                      <Stack marginLeft={4}>
                        <Text
                          fontWeight={600}
                        >
                          {connection.name}
                        </Text>
                        <Text>Delivers to #hello world</Text>
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
