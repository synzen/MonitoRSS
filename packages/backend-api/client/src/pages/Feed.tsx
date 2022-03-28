import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box, Grid, Heading, HStack, Stack, Text,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CategoryText, DashboardContent } from '@/components';
import { useFeed } from '../features/feed';
import RouteParams from '../types/RouteParams';
import { RefreshButton } from '@/features/feed/components/RefreshButton';

const Feed: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();

  const {
    feed, status, error, refetch,
  } = useFeed({
    feedId,
  });

  return (
    <Stack>
      <DashboardContent
        error={error}
        loading={status === 'loading' || status === 'idle'}
      >
        <Stack spacing={12}>
          <Stack spacing={6}>
            <Stack>
              <HStack alignItems="center">
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
            <CategoryText title={t('pages.feed.channelLabel')}>{feed?.channel}</CategoryText>
            <CategoryText title={t('pages.feed.refreshRateLabel')}>
              {t('pages.feed.refreshRateValue', {
                seconds: feed?.refreshRateSeconds,
              })}
            </CategoryText>
            <CategoryText title={t('pages.feed.createdAtLabel')}>{feed?.createdAt}</CategoryText>
          </Grid>
        </Stack>
        {/* <Stack width="min">
          <Button as={Link} to="message">Edit Message</Button>
          <Button as={Link} to="filters">Edit Filters</Button>
          <Button as={Link} to="misc-options">Edit Misc Options</Button>
        </Stack> */}
      </DashboardContent>
    </Stack>
  );
};

export default Feed;
