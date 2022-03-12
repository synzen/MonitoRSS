import {
  Box,
  Flex,
  Heading,
  SlideFade,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { Loading } from '@/components';
import { useFeedSubscriber } from '../../hooks';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useDiscordServerRoles } from '@/features/discordServers';

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
    </Stack>
  );
};
