import {
  Avatar, Button, Flex, Heading, HStack, Stack, Text,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import RouteParams from '@/types/RouteParams';
import { useDiscordWebhooks } from '@/features/discordWebhooks';
import { DashboardContent } from '@/components';

interface Props {

}

const Webhooks: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { serverId } = useParams<RouteParams>();
  const { data, status, error } = useDiscordWebhooks({
    serverId,
  });

  return (
    <DashboardContent
      loading={status === 'loading' || status === 'idle'}
      error={error}
    >
      <Stack spacing="8">
        <Flex justifyContent="space-between">
          <Heading size="lg">{t('pages.webhooks.title')}</Heading>
          <Button colorScheme="blue">{t('pages.webhooks.addNew')}</Button>
        </Flex>
        <Stack spacing="4">
          {data?.map((webhook) => (
            <HStack
              background="gray.700"
              borderRadius="lg"
              padding="4"
              justifyContent="space-between"
            >
              <HStack
                overflow="hidden"
                marginRight="10"
                spacing="4"
              >
                <Avatar
                  name={webhook.name}
                  src={webhook.avatarUrl}
                />
                <Text
                  textOverflow="ellipsis"
                  overflow="hidden"
                  display="block"
                >
                  {webhook.name}

                </Text>
              </HStack>
            </HStack>
          ))}
        </Stack>
      </Stack>
    </DashboardContent>
  );
};

export default Webhooks;
