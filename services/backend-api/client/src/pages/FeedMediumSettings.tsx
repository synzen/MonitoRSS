import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Grid,
  Heading,
  HStack,
  Stack,
  Tab,
  TabList,
  Tabs,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { CategoryText } from '../components';
import { DashboardContentV2 } from '../components/DashboardContentV2';
import { useFeed } from '../features/feed';
import { RefreshButton } from '../features/feed/components/RefreshButton';
import RouteParams from '../types/RouteParams';

export const FeedMediumSettings: React.FC = () => {
  const { feedId, serverId } = useParams<RouteParams>();
  const {
    feed, status, error, refetch,
  } = useFeed({
    feedId,
  });
  const { t } = useTranslation();

  return (
    <DashboardContentV2
      error={error}
      loading={status === 'loading' || status === 'idle'}
    >
      <Tabs>
        <Stack
          width="100%"
          minWidth="100%"
          paddingTop={12}
          background="gray.700"
          paddingX={{ base: 4, lg: 12 }}
          alignItems="center"
          spacing={0}
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
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">{feed?.title}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem isCurrentPage>
                      <BreadcrumbLink href="#">Medium</BreadcrumbLink>
                    </BreadcrumbItem>
                  </Breadcrumb>
                  <HStack alignItems="center">
                    <Heading
                      size="lg"
                      marginRight={4}
                    >
                      Stocks
                    </Heading>
                  </HStack>
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
              <Tab>Message</Tab>
              <Tab>Filters</Tab>
              <Tab>Comparisons</Tab>
              <Tab>Settings</Tab>
            </TabList>
          </Stack>
        </Stack>
      </Tabs>
    </DashboardContentV2>
  );
};
