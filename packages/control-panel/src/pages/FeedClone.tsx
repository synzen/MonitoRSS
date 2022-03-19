import {
  Box,
  Button,
  Checkbox,
  Heading,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardContent, ThemedSelect } from '@/components';
import RouteParams from '../types/RouteParams';
import {
  FeedCloneProperties, useCloneFeed, useFeed, useFeeds,
} from '@/features/feed';
import { notifyError } from '@/utils/notifyError';
import { notifySuccess } from '@/utils/notifySuccess';

const FeedClone: React.FC = () => {
  const { feedId, serverId } = useParams<RouteParams>();
  const [properties, setProperties] = useState<FeedCloneProperties[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string>('');
  const { t } = useTranslation();
  const { mutateAsync, status: cloningStatus } = useCloneFeed();
  const {
    setSearch,
    data,
    status,
  } = useFeeds({
    serverId,
  });
  const { feed, status: feedStatus, error: feedError } = useFeed({
    feedId,
  });
  const loadingFeeds = status === 'idle' || status === 'loading';

  const onInputChange = (newVal: string) => {
    setSearch(newVal);
  };

  const onCheckboxChange = (key: FeedCloneProperties, checked: boolean) => {
    if (checked) {
      setProperties([...properties, key]);
    } else {
      setProperties(properties.filter((prop) => prop !== key));
    }
  };

  const onFeedSelected = (selectedId: string) => {
    setSelectedFeedId(selectedId);
  };

  const onSubmit = async () => {
    if (!feedId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        details: {
          properties,
          targetFeedIds: [selectedFeedId],
        },
      });
      notifySuccess(t('pages.cloneFeed.success'));
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  const checkboxOptions: Array<{ label: string, key: FeedCloneProperties }> = [{
    label: t('pages.cloneFeed.checkboxMessageLabel'),
    key: FeedCloneProperties.MESSAGE,
  }, {
    label: t('pages.cloneFeed.checkboxFiltersLabel'),
    key: FeedCloneProperties.FITLERS,
  }, {
    label: t('pages.cloneFeed.checkboxMiscOptionsLabel'),
    key: FeedCloneProperties.MISC_OPTIONS,
  }, {
    label: t('pages.cloneFeed.checkboxComparisonsLabel'),
    key: FeedCloneProperties.COMPARISONS,
  }, {
    label: t('pages.cloneFeed.checkboxWebhookLabel'),
    key: FeedCloneProperties.WEBHOOK,
  }];

  return (
    <DashboardContent
      loading={feedStatus === 'loading' || feedStatus === 'idle'}
      error={feedError}
    >
      <Stack spacing={12}>
        <Stack>
          <Heading size="lg">{t('pages.cloneFeed.title')}</Heading>
          <Text>{t('pages.cloneFeed.description')}</Text>
        </Stack>
        <Stack spacing={9}>
          <Stack spacing={3}>
            <Heading size="md">{t('pages.cloneFeed.propertiesSectionTitle')}</Heading>
            {checkboxOptions.map((option) => (
              <Checkbox onChange={(e) => onCheckboxChange(option.key, e.target.checked)}>
                {option.label}
              </Checkbox>
            ))}
          </Stack>
          <Stack spacing={3}>
            <Stack>
              <Heading size="md">{t('pages.cloneFeed.sourceFeedSectionTitle')}</Heading>
              <Text>{t('pages.cloneFeed.sourceFeedSectionDescription')}</Text>
            </Stack>
            <Box>
              <Text color="gray.500">{t('pages.cloneFeed.sourceFeedTitleLabel')}</Text>
              <Text>{feed?.title}</Text>
            </Box>
            <Box>
              <Text color="gray.500">{t('pages.cloneFeed.sourceFeedUrlLabel')}</Text>
              <Text>{feed?.url}</Text>
            </Box>
          </Stack>
          <Stack spacing={3}>
            <Heading size="md">{t('pages.cloneFeed.targetFeedSectionTitle')}</Heading>
            <ThemedSelect
              onChange={onFeedSelected}
              loading={loadingFeeds}
              onInputChange={onInputChange}
              value={selectedFeedId}
              options={data?.results.map((f) => ({
                value: f.id,
                label: f.title,
              })) || []}
            />
          </Stack>
        </Stack>
        <HStack justifyContent="flex-end">
          <Button
            onClick={onSubmit}
            isLoading={cloningStatus === 'loading'}
            disabled={!selectedFeedId
              || !properties.length
              || cloningStatus === 'loading'
              || loadingFeeds}
            colorScheme="blue"
          >
            {t('pages.cloneFeed.cloneButtonLabel')}
          </Button>
        </HStack>
      </Stack>
    </DashboardContent>
  );
};

export default FeedClone;
