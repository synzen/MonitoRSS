import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
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
import { DashboardContent, ThemedSelect } from '@/components';
import RouteParams from '../types/RouteParams';
import { useDiscordServerRoles } from '@/features/discordServers';

const FeedSubscribers: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const { data, error, status } = useDiscordServerRoles({ serverId });
  const { t } = useTranslation();

  return (
    <Stack>
      <DashboardContent
        loading={status === 'loading' || status === 'idle'}
        error={error}
      >
        <Stack spacing="9">
          <Stack spacing="4">
            <Heading size="lg">{t('pages.subscribers.title')}</Heading>
            <HStack>
              <FormControl width={250}>
                <FormLabel htmlFor="subscriber-name">Subscribers</FormLabel>
                <ThemedSelect
                  id="subscriber-name"
                  onChange={console.log}
                  loading={status === 'loading' || status === 'idle'}
                  options={(data?.results || []).map((role) => ({
                    label: role.name,
                    value: role.id,
                    icon: <Box width={6} borderRadius="50%" height={6} bg={role.color} />,
                  }))}
                />
              </FormControl>
              <Button alignSelf="flex-end" minWidth="100" colorScheme="blue">
                Add
              </Button>
            </HStack>
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
                  <Th>Subscriber</Th>
                  <Th>Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(data?.results || []).map((subscriber) => (
                  <Tr key={subscriber.id}>
                    <Td>
                      <HStack alignItems="center">
                        <Box
                          borderRadius="50%"
                          height={6}
                          width={6}
                          background={subscriber.color}
                        />
                        <Text>
                          {`@${subscriber.name}`}
                        </Text>
                      </HStack>
                    </Td>
                    <Td>
                      <HStack>
                        <IconButton
                          icon={(
                            <EditIcon />
                      )}
                          aria-label={`Edit subscriber ${subscriber.name} filters`}
                          background="none"
                        />
                        <IconButton
                          icon={(
                            <DeleteIcon />
                      )}
                          aria-label={`Delete subscriber ${subscriber.name}`}
                          background="none"
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Stack>
        </Stack>
      </DashboardContent>
    </Stack>
  );
};

export default FeedSubscribers;
