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
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RouteParams from '../types/RouteParams';
import { RequireServerBotAccess } from '@/features/discordServers';
import { FeedSidebar } from '@/features/feed/components/FeedSidebar';
import { FeedsTable } from '@/features/feed/components/FeedsTable';

const Feeds: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const sidebarEnabled = useBreakpointValue<boolean>({ base: true, '2xl': false });
  const [focusedFeedId, setFocusedFeedId] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    setFocusedFeedId('');
  }, [serverId]);

  const onFeedDeleted = () => {
    setFocusedFeedId('');
  };

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
        >
          <Heading size="lg" paddingTop="8">{t('pages.feeds.title')}</Heading>
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
