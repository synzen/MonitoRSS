/* eslint-disable react/no-unstable-nested-components */
import {
  Code,
  Heading,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { DashboardContent } from '@/components';
import RouteParams from '../types/RouteParams';
import { FeedDumpButton, useFeed } from '@/features/feed';
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
  } = useUpdateFeed();

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
    <DashboardContent
      error={error}
      loading={status === 'loading'}
    >
      <Stack spacing={9}>
        <Stack>
          <Heading
            size="lg"
            marginRight={4}
          >
            {t('pages.filters.title')}
          </Heading>
          <Text>
            {t('pages.filters.description')}
          </Text>
        </Stack>
        <Stack spacing={4}>
          <Stack>
            <Heading size="md">
              {t('pages.filters.specialCharactersSectionTitle')}
            </Heading>
            <Text>
              {t('pages.filters.specialCharactersSectionDescription')}
            </Text>
          </Stack>
          <Table
            marginBottom="5"
            background="gray.850"
            borderColor="gray.700"
            borderWidth="2px"
            boxShadow="lg"
          >
            <Thead>
              <Tr>
                <Th>{t('pages.filters.specialCharactersTableCharacterHeader')}</Th>
                <Th>{t('pages.filters.specialCharactersTableDescriptionHeader')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>
                  <Code>
                    ~
                  </Code>
                </Td>
                <Td>
                  {t('pages.filters.specialCharacterTildeDescription')}
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <Code>
                    !
                  </Code>
                </Td>
                <Td>
                  {t('pages.filters.specialCharacterNotDescription')}
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <Code>
                    !~
                  </Code>
                </Td>
                <Td>
                  {t('pages.filters.specialCharacterNotTildeDescription')}
                </Td>
              </Tr>
            </Tbody>
          </Table>
        </Stack>
        <Stack spacing={4}>
          <Stack>
            <Heading size="md">
              {t('pages.filters.currentFiltersSectionTitle')}
            </Heading>
            <Text>
              {t('pages.filters.currentFiltersSectionDescription')}
            </Text>
            <FeedDumpButton feedId={feedId} />
          </Stack>
          <FiltersTable
            data={tableData}
            onFiltersChanged={onFiltersChanged}
            isUpdating={updatingStatus === 'loading'}
            isLoading={status === 'loading'}
          />
        </Stack>
      </Stack>
    </DashboardContent>
  );
};

export default FeedFilters;
