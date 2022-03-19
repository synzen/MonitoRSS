import {
  Box,
  Divider,
  Flex,
  Heading,
  SlideFade,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Loading } from '@/components';
import { useFeedSubscriber } from '../../hooks';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useDiscordServerRoles } from '@/features/discordServers';
import { FiltersTable } from '../FiltersTable';
import { useUpdateFeedSubscriber } from '../../hooks/useUpdateFeedSubscriber';
import { notifyError } from '@/utils/notifyError';

interface Props {
  serverId?: string
  feedId?: string;
  subscriberId?: string
}

export const SubscriberSidebar: React.FC<Props> = ({
  serverId,
  feedId,
  subscriberId,
}) => {
  const { t } = useTranslation();
  const {
    data, status, error,
  } = useFeedSubscriber({
    feedId,
    subscriberId,
  });
  const { getRolebyId } = useDiscordServerRoles({ serverId });
  const {
    mutateAsync,
    status: updatingStatus,
  } = useUpdateFeedSubscriber();

  const filtersData = useMemo(() => {
    const filters = data?.filters || [];

    return filters.map((filter) => ({
      category: filter.category,
      value: filter.value,
    }));
  }, [data]);

  const onFiltersChanged = async (filters: Array<{ category: string, value: string }>) => {
    if (!feedId || !subscriberId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        subscriberId,
        details: {
          filters,
        },
      });
    } catch (err) {
      notifyError('Failed to update', err as Error);
    }
  };

  if (status === 'error') {
    return (
      <Box height="100%">
        <ErrorAlert description={error?.message} />
      </Box>
    );
  }

  if (status === 'loading' || !data) {
    return <Flex justifyContent="center" padding="20"><Loading /></Flex>;
  }

  return (
    <Stack
      spacing={6}
      overflow="auto"
      padding="10"
      height="100%"
      as={SlideFade}
      in={!!data}
      unmountOnExit
    >
      <Stack>
        <Text color="gray.500">
          {data.type === 'role' ? 'Role Subscriber' : 'User Subscriber'}
        </Text>
        <Heading>
          {data.type === 'role' && (getRolebyId(data.discordId)?.name || data.discordId)}
          {data.type === 'user' && data.discordId}
        </Heading>
      </Stack>
      <Divider />
      <Stack spacing={6}>
        <Heading size="md" as="h2">
          Filters
        </Heading>
        <FiltersTable
          data={filtersData}
          onFiltersChanged={onFiltersChanged}
          isUpdating={updatingStatus === 'loading'}
        />
      </Stack>
    </Stack>
  );
};
