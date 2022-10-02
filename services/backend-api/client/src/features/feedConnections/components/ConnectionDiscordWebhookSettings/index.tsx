import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
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
import { EditIcon } from '@chakra-ui/icons';
import { CategoryText, DiscordMessageForm } from '@/components';
import { DiscordMessageFormData } from '@/types/discord';
import RouteParams from '@/types/RouteParams';
import { RefreshButton } from '../../../feed/components/RefreshButton';
import { useFeed } from '../../../feed/hooks';
import { useUpdateDiscordWebhookConnection } from '../../hooks';
import {
  FilterExpression,
} from '../../types';
import { FiltersForm } from '../FiltersForm';
import { EditConnectionWebhookDialog } from './EditConnectionWebhookDialog';

export const ConnectionDiscordWebhookSettings: React.FC = () => {
  const { feedId, serverId, connectionId } = useParams<RouteParams>();
  const {
    feed, refetch,
  } = useFeed({
    feedId,
  });
  const { t } = useTranslation();
  const { mutateAsync } = useUpdateDiscordWebhookConnection();

  const onFiltersUpdated = async (filters: FilterExpression | null) => {
    if (!feedId || !connectionId) {
      return;
    }

    await mutateAsync({
      feedId,
      connectionId,
      details: {
        filters,
      },
    });
  };

  const onMessageUpdated = async (data: DiscordMessageFormData) => {
    if (!feedId || !connectionId) {
      return;
    }

    await mutateAsync({
      feedId,
      connectionId,
      details: {
        content: data.content,
        embeds: data.embeds,
      },
    });
  };

  const onWebhookUpdated = async (data: { webhookId: string, name?: string, iconUrl?: string }) => {
    if (!feedId || !connectionId) {
      return;
    }

    await mutateAsync({
      feedId,
      connectionId,
      details: {
        webhookId: data.webhookId,
      },
    });
  };

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
                <HStack alignItems="center" justifyContent="space-between">
                  <Heading
                    size="lg"
                  >
                    Stocks
                  </Heading>
                  <EditConnectionWebhookDialog
                    feedId={feedId}
                    serverId={serverId}
                    onUpdate={onWebhookUpdated}
                    defaultValues={{
                      webhookId: '1',
                      iconUrl: 'icon-url',
                      name: 'name',
                    }}
                    trigger={(
                      <Button
                        aria-label="Edit"
                        variant="outline"
                        leftIcon={<EditIcon />}
                      >
                        {t('common.buttons.configure')}
                      </Button>
                    )}
                  />
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
              onClickSave={onMessageUpdated}
            />
          </Stack>
        </TabPanel>
        <TabPanel maxWidth="1200px" width="100%">
          <FiltersForm
            onSave={onFiltersUpdated}
          />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};
