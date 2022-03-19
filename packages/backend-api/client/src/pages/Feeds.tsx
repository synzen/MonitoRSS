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
import RouteParams from '../types/RouteParams';
import { RequireServerBotAccess } from '@/features/discordServers';
import { FeedSidebar } from '@/features/feed/components/FeedSidebar';
import { FeedsTable } from '@/features/feed/components/FeedsTable';

const Feeds: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const sidebarEnabled = useBreakpointValue<boolean>({ base: true, xl: false });
  const [focusedFeedId, setFocusedFeedId] = useState('');
  // Pre-fetch channels

  useEffect(() => {
    setFocusedFeedId('');
  }, [serverId]);

  return (
    <RequireServerBotAccess
      serverId={serverId}
    >
      <Flex height="100%">
        <Stack spacing="6" flex="1" paddingX="12" paddingBottom="12" overflow="auto">
          <Heading size="lg" paddingTop="8">Feeds</Heading>
          <FeedsTable
            onSelectedFeedId={setFocusedFeedId}
            selectedFeedId={focusedFeedId}
            serverId={serverId}
          />
        </Stack>
        {focusedFeedId && (
        <Box
          display={{ base: 'none', xl: 'block' }}
          borderLeftWidth="1px"
          marginLeft="0"
          marginInlineStart="0 !important"
          height="100%"
          minWidth={{ base: 'none', xl: 'md', '2xl': 'lg' }}
          width={{ base: 'none', xl: 'md', '2xl': 'lg' }}
        >
          <FeedSidebar feedId={focusedFeedId} />
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
            <FeedSidebar feedId={focusedFeedId} />
          </DrawerContent>
        </Drawer>
        )}
      </Flex>
    </RequireServerBotAccess>
  );
};

export default Feeds;
