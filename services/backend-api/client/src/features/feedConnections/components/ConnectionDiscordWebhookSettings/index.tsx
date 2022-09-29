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
  TabPanel,
  TabPanels,
  Tabs,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { CategoryText, DiscordMessageForm } from '../../../../components';
import RouteParams from '../../../../types/RouteParams';
import { RefreshButton } from '../../../feed/components/RefreshButton';
import { useFeed } from '../../../feed/hooks';
import { FiltersForm } from '../FiltersForm';

export const ConnectionDiscordWebhookSettings: React.FC = () => {
  const { feedId, serverId } = useParams<RouteParams>();
  const {
    feed, refetch,
  } = useFeed({
    feedId,
  });
  const { t } = useTranslation();

  return (
    <Tabs isFitted>
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
                    <BreadcrumbLink
                      as={RouterLink}
                      to={`/v2/servers/${serverId}/feeds/${feedId}`}
                    >
                      {feed?.title}

                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem isCurrentPage>
                    <BreadcrumbLink href="#">Webhook</BreadcrumbLink>
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
              <CategoryText title="Webhook">
                John Doe
              </CategoryText>
              <CategoryText
                title="Custom name"
              >
                {feed?.createdAt}
              </CategoryText>
              <CategoryText title="Custom icon">N/A</CategoryText>
            </Grid>
          </Stack>
          <TabList>
            <Tab>Message</Tab>
            <Tab>Filters</Tab>
            <Tab>Settings</Tab>
          </TabList>
        </Stack>

      </Stack>
      <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
        <TabPanel maxWidth="1200px" width="100%">
          <Stack>
            <DiscordMessageForm
              defaultValues={{
                embedAuthorIconUrl: undefined,
                embedAuthorTitle: undefined,
                embedAuthorUrl: undefined,
                embedColor: undefined,
                embedDescription: undefined,
                embedFooterIconUrl: undefined,
                embedFooterText: undefined,
                embedImageUrl: undefined,
                embedThumbnailUrl: undefined,
                embedTitle: undefined,
                embedUrl: undefined,
                content: undefined,
              }}
              onClickSave={console.log}
            />
          </Stack>
        </TabPanel>
        <TabPanel maxWidth="1200px" width="100%">
          <FiltersForm />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};
