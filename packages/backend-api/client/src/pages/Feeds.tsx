import {
  Flex,
  Stack,
  Heading,
  useBreakpointValue,
  Box,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Text,
  IconButton,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from '@chakra-ui/icons';
import RouteParams from '../types/RouteParams';
import { RequireServerBotAccess, useDiscordServer } from '@/features/discordServers';
import { FeedSidebar } from '@/features/feed/components/FeedsTable/FeedSidebar';
import { FeedsTable } from '@/features/feed/components/FeedsTable';
import { useFeeds } from '@/features/feed';

const Feeds: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const sidebarEnabled = useBreakpointValue<boolean>({ base: true, '2xl': false });
  const [focusedFeedId, setFocusedFeedId] = useState('');
  const { t } = useTranslation();
  const { data: serverData } = useDiscordServer({ serverId });
  const { data: feedsData } = useFeeds({ serverId });

  useEffect(() => {
    setFocusedFeedId('');
  }, [serverId]);

  const onFeedDeleted = () => {
    setFocusedFeedId('');
  };

  const currentFeedCount = feedsData?.total || 0;
  const maxFeedsCount = serverData?.benefits.maxFeeds || 0;
  const feedCountIsAccessible = feedsData && serverData;

  return (
    <RequireServerBotAccess
      serverId={serverId}
    >
      <Flex
        width="100%"
        height="100%"
        overflow="auto"
      >
        <Stack
          spacing="6"
          flex="1"
          paddingX={{ base: 4, lg: 12 }}
          paddingBottom="12"
          width="100%"
          overflow="auto"
        >
          <Flex
            paddingTop="8"
            justifyContent="space-between"
            alignItems="center"
          >
            <Heading size="lg">{t('pages.feeds.title')}</Heading>
            {feedCountIsAccessible && (
            <Flex alignItems="center">
              <Text fontSize="xl" fontWeight={600}>
                {currentFeedCount}
                {' '}
                /
                {' '}
                {maxFeedsCount}
              </Text>
              <IconButton
                as="a"
                href="https://www.patreon.com/monitorss"
                target="_blank"
                rel="noreferrer noopener"
                marginLeft="4"
                aria-label="Increase feed limit"
                variant="outline"
                icon={<ArrowLeftIcon />}
                size="sm"
                transform="rotate(90deg)"
              />
            </Flex>
            )}
          </Flex>
          <FeedsTable
            onSelectedFeedId={setFocusedFeedId}
            selectedFeedId={focusedFeedId}
            serverId={serverId}
          />
        </Stack>
        {focusedFeedId && (
        <Box
          display={{ base: 'none', '2xl': 'block' }}
          borderLeftWidth="1px"
          marginLeft="0"
          marginInlineStart="0 !important"
          height="100%"
          width={{ base: 'none', '2xl': 'lg' }}
        >
          <FeedSidebar feedId={focusedFeedId} onDeleted={onFeedDeleted} />
        </Box>
        )}
        {sidebarEnabled && (
        <Drawer
          autoFocus={false}
          size="md"
          isOpen={!!focusedFeedId}
          onClose={() => {
            setFocusedFeedId('');
          }}
          placement="right"
        >
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <FeedSidebar feedId={focusedFeedId} onDeleted={onFeedDeleted} />
          </DrawerContent>
        </Drawer>
        )}
      </Flex>
    </RequireServerBotAccess>
  );
};

export default Feeds;
