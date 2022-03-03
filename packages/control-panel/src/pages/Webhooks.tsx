import { Box, Heading, Stack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import RouteParams from '@/types/RouteParams';
import { useDiscordServerWebhooks } from '@/features/discordWebhooks';
import { DashboardContent } from '@/components';

interface Props {

}

const Webhooks: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { serverId } = useParams<RouteParams>();
  const { data, status, error } = useDiscordServerWebhooks({
    serverId,
  });

  return (
    <DashboardContent
      loading={status === 'loading' || status === 'idle'}
      error={error}
    >
      <Stack spacing="8">
        <Heading size="lg">Webhooks</Heading>
        <Box>
          Webhooks!
        </Box>
      </Stack>
    </DashboardContent>
  );
};

export default Webhooks;
