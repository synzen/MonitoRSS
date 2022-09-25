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
  Flex,
  Grid,
  Heading,
  HStack,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { CategoryText } from '@/components';
import {
  useFeed,
  AddMediumDiscordChannelDialog,
  AddMediumDiscordWebhookDialog,
} from '../features/feed';
import RouteParams from '../types/RouteParams';
import { RefreshButton } from '@/features/feed/components/RefreshButton';
import { DashboardContentV2 } from '../components/DashboardContentV2';

export const FeedV2: React.FC = () => {
  const { feedId, serverId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const { isOpen, onClose, onOpen } = useDisclosure();
  const {
    isOpen: isOpenDiscordWebhook,
    onClose: onCloseDiscordWebhook,
    onOpen: onOpenDiscordWebhook,
  } = useDisclosure();

  const {
    feed, status, error, refetch,
  } = useFeed({
    feedId,
  });

  return (
    <DashboardContentV2
      error={error}
      loading={status === 'loading' || status === 'idle'}
    >
      <AddMediumDiscordChannelDialog isOpen={isOpen} onClose={onClose} />
      <AddMediumDiscordWebhookDialog
        isOpen={isOpenDiscordWebhook}
        onClose={onCloseDiscordWebhook}
      />
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
                        to={`/v2/servers/${serverId}/feeds`}
                      >
                        Feeds
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem isCurrentPage>
                      <BreadcrumbLink href="#">{feed?.title}</BreadcrumbLink>
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
                <Alert status="error" hidden={feed?.status !== 'failed'}>
                  <Box>
                    <AlertTitle>
                      {t('pages.feed.connectionFailureTitle')}
                    </AlertTitle>
                    <AlertDescription display="block">
                      {t('pages.feed.connectionFailureText', {
                        reason: feed?.failReason || t('pages.feed.unknownReason'),
                      })}
                      <Box marginTop="1rem">
                        {feedId && (
                        <RefreshButton
                          feedId={feedId}
                          onSuccess={() => refetch()}
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
                <CategoryText title={t('pages.feed.dailyLimit')}>N/A</CategoryText>
              </Grid>
            </Stack>
            <TabList>
              <Tab>{t('pages.feed.connectionsTab')}</Tab>
              <Tab>{t('pages.feed.comparisonsTab')}</Tab>
            </TabList>
          </Stack>
        </Stack>
        <TabPanels>
          <TabPanel>
            <Flex justifyContent="center" width="100%">
              <Stack width="100%" maxWidth="1200px" spacing={12}>
                <Stack>
                  <Text>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
                    sollicitudin
                    varius quam vitae facilisis. Donec nec feugiat lacus.
                  </Text>
                </Stack>
                <Stack>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Heading size="md">13 connections</Heading>
                    <Menu>
                      <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                        {t('pages.feed.addConnectionButtonText')}
                      </MenuButton>
                      <MenuList>
                        <MenuItem onClick={onOpen}>
                          {t('pages.feed.discordChannelMenuItem')}
                        </MenuItem>
                        <MenuItem onClick={onOpenDiscordWebhook}>
                          {t('pages.feed.discordWebhookMenuItem')}
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </Flex>
                  <Link
                    as={RouterLink}
                    to={`/v2/servers/${serverId}/feeds/${feedId}/mediums/123`}
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
                          Discord Channel
                        </Text>
                        <Text>Delivers to #hello world</Text>
                      </Stack>
                    </Flex>
                  </Link>
                  <Link
                    as={RouterLink}
                    to={`/v2/servers/${serverId}/feeds/${feedId}/mediums/123`}
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
                          Discord Channel
                        </Text>
                        <Text>Delivers to #hello world</Text>
                      </Stack>
                    </Flex>
                  </Link>
                  <Link
                    as={RouterLink}
                    to={`/v2/servers/${serverId}/feeds/${feedId}/mediums/123`}
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
                          Discord Channel
                        </Text>
                        <Text>Delivers to #hello world</Text>
                      </Stack>
                    </Flex>
                  </Link>
                  <Link
                    as={RouterLink}
                    to={`/v2/servers/${serverId}/feeds/${feedId}/mediums/123`}
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
                          Discord Channel
                        </Text>
                        <Text>Delivers to #hello world</Text>
                      </Stack>
                    </Flex>
                  </Link>
                  <Link
                    as={RouterLink}
                    to={`/v2/servers/${serverId}/feeds/${feedId}/mediums/123`}
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
                          Discord Channel
                        </Text>
                        <Text>Delivers to #hello world</Text>
                      </Stack>
                    </Flex>
                  </Link>
                  <Link
                    as={RouterLink}
                    to={`/v2/servers/${serverId}/feeds/${feedId}/mediums/123`}
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
                          Discord Channel
                        </Text>
                        <Text>Delivers to #hello world</Text>
                      </Stack>
                    </Flex>
                  </Link>
                </Stack>
              </Stack>
            </Flex>
          </TabPanel>
          <TabPanel>
            Hello world
          </TabPanel>
        </TabPanels>
      </Tabs>
    </DashboardContentV2>
  );
};
