import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Divider,
  Flex,
  Heading,
  HStack,
  SlideFade,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { CategoryText, Loading } from '@/components';
import { useFeed } from '../../hooks';
import { FeedStatusIcon } from '../FeedStatusIcon';
import { RefreshButton } from '../RefreshButton';
import RouteParams from '@/types/RouteParams';
import { SettingsForm } from './SettingsForm';
import { ErrorAlert } from '@/components/ErrorAlert';

interface Props {
  feedId?: string;
}

export const FeedSidebar: React.FC<Props> = ({ feedId }) => {
  const { t } = useTranslation();
  const { serverId } = useParams<RouteParams>();
  const {
    feed, status, error, refetch,
  } = useFeed({
    feedId,
  });

  if (!feedId || !serverId) {
    return null;
  }

  if (status === 'loading') {
    return <Flex justifyContent="center" padding="20"><Loading /></Flex>;
  }

  if (status === 'error') {
    return (
      <Box height="100%">
        <ErrorAlert description={error?.message} />
      </Box>
    );
  }

  return (
    <Stack
      spacing={6}
      overflow="auto"
      padding="10"
      height="100%"
      as={SlideFade}
      in={!!feed}
      unmountOnExit
    >
      <Stack spacing={6}>
        <Stack>
          <HStack alignItems="center">
            <FeedStatusIcon status={feed?.status || 'ok'} />
            <Heading
              size="lg"
              marginRight={4}
            >
              {feed?.title}
            </Heading>
          </HStack>
          <Text>
            {feed?.url}
          </Text>
        </Stack>
        <Alert status="error" hidden={feed && feed.status !== 'failed'}>
          <Box>
            <AlertTitle>
              {t('pages.feed.connectionFailureTitle')}
            </AlertTitle>
            <AlertDescription display="block">
              {t('pages.feed.connectionFailureText', {
                reason: feed?.failReason || t('pages.feed.unknownReason'),
              })}
              <Box marginTop="1rem">
                {feed && (
                  <RefreshButton
                    feedId={feed.id}
                    onSuccess={() => refetch()}
                  />
                )}
              </Box>
            </AlertDescription>
          </Box>
        </Alert>
      </Stack>
      <Flex wrap="wrap">
        <CategoryText
          paddingRight="6"
          paddingBottom="6"
          title={t('pages.feed.channelLabel')}
        >
          {feed?.channel}

        </CategoryText>
        <CategoryText
          paddingRight="6"
          paddingBottom="6"
          title={t('pages.feed.refreshRateLabel')}
        >
          {t('pages.feed.refreshRateValue', {
            seconds: feed?.refreshRateSeconds,
          })}
        </CategoryText>
        <CategoryText
          paddingRight="6"
          paddingBottom="0"
          title={t('pages.feed.createdAtLabel')}
        >
          {feed?.createdAt}

        </CategoryText>
      </Flex>
      {/* <Divider /> */}
      <Stack>
        <Stack spacing={6}>
          <Heading as="h3" size="md" fontWeight="medium">
            {t('features.feed.components.sidebar.settings')}
          </Heading>
          <Divider />
          <SettingsForm feedId={feedId} serverId={serverId} />
        </Stack>
      </Stack>
    </Stack>
  );
};
