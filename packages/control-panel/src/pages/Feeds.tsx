import {
  Box,
  Flex,
  Stack,
  Heading,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useBreakpointValue,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import RouteParams from '../types/RouteParams';
import { FeedSidebar } from '@/features/feed/components/FeedSidebar';
import { FeedsTable } from '@/features/feed/components/FeedsTable';

const Feeds: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const sidebarEnabled = useBreakpointValue<boolean>({ base: true, xl: false });
  const [focusedFeedId, setFocusedFeedId] = useState('');

  return (
    <Flex height="100%">
      <Stack spacing="6" flex="1" paddingX="12" paddingBottom="12" overflow="auto">
        <Heading size="lg" paddingTop="8">Feeds</Heading>
        <Stack spacing="4">
          <Flex justifyContent="space-between" flexWrap="wrap">
            {/* <InputGroup>
              <InputLeftElement
                pointerEvents="none"
              >
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input width="sm" placeholder={t('pages.feeds.tableSearch')} />
            </InputGroup> */}
            {/* <Button colorScheme="blue">{t('pages.feeds.add')}</Button> */}
          </Flex>
          <FeedsTable
            onSelectedFeedId={setFocusedFeedId}
            selectedFeedId={focusedFeedId}
            serverId={serverId}
          />
        </Stack>
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
  );
};

export default Feeds;
