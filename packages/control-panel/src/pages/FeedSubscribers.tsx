import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
  Box,
  Heading,
  HStack,
  IconButton,
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
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { DashboardContent } from '@/components';
import RouteParams from '../types/RouteParams';
import { useDiscordServerRoles } from '@/features/discordServers';
import { useFeedSubscribers } from '@/features/feed';
import { ErrorAlert } from '@/components/ErrorAlert';
import { AddSubscriberControls } from '@/features/feed/components/AddSubscriberControls';

const FeedSubscribers: React.FC = () => {
  const { serverId, feedId } = useParams<RouteParams>();
  const {
    data: rolesData,
    error: rolesError,
    status: rolesStatus,
    getRolebyId,
  } = useDiscordServerRoles({ serverId });
  const {
    data: feedSubscribersData,
    status: feedSubscribersStatus,
    error: feedSubscribersError,
  } = useFeedSubscribers({ feedId });
  const { t } = useTranslation();

  if (rolesError || feedSubscribersError) {
    return (
      <ErrorAlert
        description={rolesError?.message
      || feedSubscribersError?.message}
      />
    );
  }

  const allFeedSubscribeDiscordIds = useMemo(
    () => new Set(feedSubscribersData?.results
      ?.map((subscriber) => subscriber.discordId) || []),
    [feedSubscribersData],
  );

  const addableRoles = useMemo(
    () => rolesData?.results
      ?.filter((role) => !allFeedSubscribeDiscordIds.has(role.id)) || [],
    [rolesData, allFeedSubscribeDiscordIds],
  );

  return (
    <Stack>
      <DashboardContent
        loading={rolesStatus === 'loading'
          || rolesStatus === 'idle'
          || feedSubscribersStatus === 'loading'
          || feedSubscribersStatus === 'idle'}
        error={rolesError}
      >
        <Stack spacing="9">
          <Stack spacing="4">
            <Heading size="lg">{t('pages.subscribers.title')}</Heading>
            <AddSubscriberControls
              roles={addableRoles}
              feedId={feedId as string}
              loading={rolesStatus === 'loading' || rolesStatus === 'idle'}
            />
          </Stack>
          <Stack spacing="4">
            <Table
              whiteSpace="nowrap"
              marginBottom="5"
              background="gray.850"
              borderColor="gray.700"
              borderWidth="2px"
              boxShadow="lg"
              size="sm"
            >
              <Thead>
                <Tr>
                  <Th>Type</Th>
                  <Th>Subscriber</Th>
                  <Th>Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(feedSubscribersData?.results || []).map((subscriber) => {
                  const details = {
                    name: subscriber.discordId,
                    color: '#000000',
                  };

                  if (subscriber.type === 'role') {
                    const role = getRolebyId(subscriber.discordId);
                    details.name = `@${role?.name || details.name}`;
                    details.color = role?.color || details.color;
                  }

                  return (
                    <Tr key={subscriber.id}>
                      <Td>
                        <Text>{subscriber.type}</Text>
                      </Td>
                      <Td>
                        <HStack alignItems="center">
                          <Box
                            borderRadius="50%"
                            height={6}
                            width={6}
                            background={details.color}
                          />
                          <Text>
                            {details.name}
                          </Text>
                        </HStack>
                      </Td>
                      <Td>
                        <HStack>
                          <IconButton
                            icon={(
                              <EditIcon />
                            )}
                            aria-label={`Edit subscriber ${details.name} filters`}
                            background="none"
                          />
                          <IconButton
                            icon={(
                              <DeleteIcon />
                            )}
                            aria-label={`Delete subscriber ${details.name}`}
                            background="none"
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Stack>
        </Stack>
      </DashboardContent>
    </Stack>
  );
};

export default FeedSubscribers;
