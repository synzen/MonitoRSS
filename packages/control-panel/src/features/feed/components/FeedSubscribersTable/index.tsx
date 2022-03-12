import {
  Box,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { Loading } from '@/components';
import { useDiscordServerRoles } from '@/features/discordServers';
import { useFeedSubscribers } from '../../hooks';

interface Props {
  selectedSubscriberId: string
  onSelectedSubscriber: (subscriberId: string) => void
  serverId?: string;
  feedId?: string
}

export const FeedSubscribersTable: React.FC<Props> = ({
  selectedSubscriberId,
  onSelectedSubscriber,
  serverId,
  feedId,
}) => {
  const {
    status: rolesStatus,
    getRolebyId,
  } = useDiscordServerRoles({ serverId });
  const {
    data: feedSubscribersData,
  } = useFeedSubscribers({ feedId });

  return (
    <Table
      whiteSpace="nowrap"
      marginBottom="5"
      background="gray.850"
      borderColor="gray.700"
      borderWidth="2px"
      boxShadow="lg"
    >
      <Thead>
        <Tr>
          <Th>Type</Th>
          <Th>Subscriber</Th>
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
            <Tr
              key={subscriber.id}
              tabIndex={0}
              position="relative"
              bg={selectedSubscriberId === subscriber.id ? 'gray.700' : undefined}
              _hover={{
                bg: 'gray.700',
                cursor: 'pointer',
                boxShadow: 'outline',
              }}
              _focus={{
                boxShadow: 'outline',
                outline: 'none',
              }}
              onClick={() => onSelectedSubscriber(subscriber.id)}
            >
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
                  {rolesStatus === 'loading'
                    ? <Loading />
                    : (
                      <Text>
                        {details.name}
                      </Text>
                    )}
                </HStack>
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};
