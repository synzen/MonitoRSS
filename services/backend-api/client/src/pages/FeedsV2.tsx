import {
  Flex,
  Stack,
  Heading,
  Text,
  IconButton,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from '@chakra-ui/icons';
import RouteParams from '../types/RouteParams';
import { RequireServerBotAccess, useDiscordServer } from '@/features/discordServers';
import { useFeeds } from '@/features/feed';
import { FeedsTableV2 } from '../features/feed/components/FeedsTableV2';

const FeedsV2: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const [focusedFeedId, setFocusedFeedId] = useState('');
  const { t } = useTranslation();
  const { data: serverData } = useDiscordServer({ serverId });
  const { data: feedsData } = useFeeds({ serverId });

  useEffect(() => {
    setFocusedFeedId('');
  }, [serverId]);

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
          <FeedsTableV2
            onSelectedFeedId={setFocusedFeedId}
            selectedFeedId={focusedFeedId}
            serverId={serverId}
          />
        </Stack>
      </Flex>
    </RequireServerBotAccess>
  );
};

export default FeedsV2;
