import { SearchIcon } from '@chakra-ui/icons';
import {
  Box,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Alert,
  AlertIcon,
  Heading,
  HStack,
  Table,
  Thead,
  Tr,
  Th,
  Text,
  Tbody,
  Td,
  Badge,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useBreakpointValue,
} from '@chakra-ui/react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { FiChevronRight } from 'react-icons/fi';
import { Loading } from '@/components';
import { FeedSummary, useFeeds } from '../features/feed';
import RouteParams from '../types/RouteParams';
import { FeedSidebar } from '@/features/feed/components/FeedSidebar';
import getChakraColor from '@/utils/getChakraColor';

const Feeds: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const sidebarEnabled = useBreakpointValue<boolean>({ base: true, xl: false });

  const { data, status, error } = useFeeds({
    serverId,
  });

  const [focusedFeedId, setFocusedFeedId] = useState('');

  const navigate = useNavigate();

  const onClickFeedRow = (feed: FeedSummary) => {
    // navigate(feed.id);
    setFocusedFeedId(feed.id);
  };

  const navigateToFeed = (feedId: string) => {
    navigate(feedId);
  };

  return (
    <HStack height="100%" alignItems="flex-start">
      {(status === 'loading') && (
        <Box textAlign="center" paddingY="5rem">
          <Loading size="lg" />
        </Box>
      )}
      {status === 'error' && (
        <Alert status="error">
          <AlertIcon />
          {error?.message}
        </Alert>
      )}
      {status === 'success' && data && (
        <Stack spacing="6" flex="1" overflow="auto">
          <Heading size="lg" paddingX="8" paddingTop="8">Feeds</Heading>
          <Stack spacing="4">
            <Flex justifyContent="space-between" flexWrap="wrap" paddingX="8">
              <InputGroup>
                <InputLeftElement
                  pointerEvents="none"
                >
                  <SearchIcon color="gray.400" />
                </InputLeftElement>
                <Input width="sm" placeholder={t('pages.feeds.search')} />
              </InputGroup>
              {/* <Button colorScheme="blue">{t('pages.feeds.add')}</Button> */}
            </Flex>
            <Box overflow="auto">
              <Table whiteSpace="nowrap" marginBottom="5">
                <Thead>
                  <Tr>
                    <Th>{t('pages.feeds.tableStatus')}</Th>
                    <Th>
                      {t('pages.feeds.tableTitle')}
                    </Th>
                    <Th>{t('pages.feeds.tableUrl')}</Th>
                    <Th>{t('pages.feeds.tableChannel')}</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {data.results.map((feed) => (
                    <Tr
                      key={feed.id}
                      tabIndex={0}
                      bg={focusedFeedId === feed.id ? 'gray.700' : undefined}
                      // outline={focusedFeedId === feed.id
                      //   ? `solid 2px ${getChakraColor('gray.500')}`
                      //   : undefined}
                      _hover={{
                        bg: 'gray.700',
                        cursor: 'pointer',
                      }}
                      _focus={{
                        outline: `solid 2px ${getChakraColor('gray.500')}`,
                      }}
                      onClick={() => onClickFeedRow(feed)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onClickFeedRow(feed);
                        }
                      }}
                    >
                      <Td>
                        <Badge
                          size="sm"
                          colorScheme={feed.status === 'ok' ? 'green' : 'red'}
                        >
                          {feed.status}
                        </Badge>
                      </Td>
                      <Td>
                        {feed.title}
                      </Td>
                      <Td
                        maxWidth="30rem"
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {feed.url}
                      </Td>
                      <Td>
                        <Text color="muted">{feed.channel}</Text>
                      </Td>
                      <Td>
                        <IconButton
                          icon={<FiChevronRight fontSize="1.25rem" />}
                          onClick={() => navigateToFeed(feed.id)}
                          aria-label="Customize"
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Stack>
        </Stack>
      )}
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
    </HStack>
  );
};

export default Feeds;
