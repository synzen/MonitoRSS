/* eslint-disable react/no-unstable-nested-components */
import {
  Heading,
  Stack,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { DashboardContent } from '@/components';
import RouteParams from '../types/RouteParams';
import { useFeed } from '@/features/feed';
import { useUpdateFeed } from '@/features/feed/hooks/useUpdateFeed';
import { FiltersTable } from '@/features/feed/components/FiltersTable';

const FeedFilters: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const {
    feed, status, error,
  } = useFeed({
    feedId,
  });
  const {
    mutateAsync,
    status: updatingStatus,
  } = useUpdateFeed({ feedId } as { feedId: string });

  const tableData = useMemo(() => {
    if (!feed?.filters) {
      return [];
    }

    return feed.filters.map((filter) => ({
      category: filter.category,
      value: filter.value,
    }));
  }, [feed]);

  const onFiltersChanged = async (filters: Array<{ category: string, value: string }>) => {
    if (!feedId) {
      return;
    }

    await mutateAsync({
      feedId,
      details: {
        filters,
      },
    });
  };

  return (
    <Stack>
      <DashboardContent
        error={error}
        loading={status === 'loading' || status === 'idle'}
      >
        <Heading
          size="lg"
          marginRight={4}
        >
          {t('pages.filters.title')}
        </Heading>
        <FiltersTable
          data={tableData}
          onFiltersChanged={onFiltersChanged}
          isUpdating={updatingStatus === 'loading'}
          isLoading={status === 'loading' || status === 'idle'}
        />
      </DashboardContent>
    </Stack>
  );
};

export default FeedFilters;
