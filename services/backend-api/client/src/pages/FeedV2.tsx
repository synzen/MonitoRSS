import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
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
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@chakra-ui/icons';
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
import { pages } from '../constants';

const PRETTY_CONNECTION_NAMES: Record<FeedConnectionType, string> = {
  [FeedConnectionType.DiscordChannel]: 'Discord Channel',
  [FeedConnectionType.DiscordWebhook]: 'Discord Webhook',
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

  const isAtLimit = dailyLimit ? dailyLimit.current >= dailyLimit.max : false;

  const onDeleteFeed = async () => {
    if (!feedId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
      });
      notifySuccess(t('common.success.deleted'));
      navigate(pages.userFeeds());
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
          background="gray.700"
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
                          to={pages.userFeeds()}
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
                      {t('pages.userFeed.connectionFailureTitle')}
                    </AlertTitle>
                    <AlertDescription display="block">
                      {t('pages.userFeed.connectionFailureText')}
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
                <CategoryText
                  title={t('pages.feed.articleDailyLimit')}
                  helpTooltip={{
                    description: t('pages.feed.articleDailyLimitHint'),
                  }}
                >
                  <Box>
                    <Text color={isAtLimit ? 'red.300' : ''}>
                      {dailyLimit && `${dailyLimit.current}/${dailyLimit.max}`}
                    </Text>
                    {!dailyLimit && <Spinner size="sm" />}
                  </Box>
                </CategoryText>
              </Grid>
            </Stack>
            <TabList>
              <Tab>
                {t('pages.feed.connectionSectionTitle')}
              </Tab>
            </TabList>
          </Stack>
        </Stack>
        <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
          <TabPanel maxWidth="1200px" width="100%" tabIndex={-1}>
            <Stack spacing={6}>
              <Stack>
                <Flex justifyContent="space-between" alignItems="center">
                  <Heading size="md">
                    {t('pages.feed.connectionSectionTitle')}
                  </Heading>
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
                  {t('pages.feed.connectionSectionDescription')}
                </Text>
              </Stack>
              <Stack>
                {feed?.connections?.map((connection) => (
                  <Link
                    key={connection.id}
                    as={RouterLink}
                    to={pages.userFeedConnection({
                      feedId: feedId as string,
                      connectionType: connection.key,
                      connectionId: connection.id,
                    })}
                    textDecoration="none"
                    _hover={{
                      textDecoration: 'none',
                      color: 'blue.300',
                    }}
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
          </TabPanel>
        </TabPanels>
      </Tabs>
    </DashboardContentV2>
  );
};
