/* eslint-disable react/jsx-no-useless-fragment */
import {
  Alert, AlertDescription, AlertIcon, AlertTitle, Center,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { DashboardContent, Loading } from '@/components';
import { useDiscordServerAccessStatus } from '../../hooks';
import { ErrorAlert } from '@/components/ErrorAlert';

interface Props {
  serverId?: string
}

export const RequireServerBotAccess: React.FC<Props> = ({ serverId, children }) => {
  const { t } = useTranslation();
  const { data, error, status } = useDiscordServerAccessStatus({ serverId });

  if (status === 'loading' || status === 'idle') {
    return (
      <Center width="100%" paddingY="32" paddingX="8">
        <Loading size="lg" />
      </Center>
    );
  }

  if (status === 'error') {
    return <ErrorAlert description={error?.message} />;
  }

  if (data && !data.result.authorized) {
    return (
      <DashboardContent>
        <Alert
          status="warning"
          variant="subtle"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          height="200px"
        >
          <AlertIcon boxSize="40px" mr={0} />
          <AlertTitle mt={4} mb={1} fontSize="lg">
            {t('common.api.missingBotAccessTitle')}
          </AlertTitle>
          <AlertDescription>
            {t('common.api.missingBotAccessMessage')}
          </AlertDescription>
        </Alert>
      </DashboardContent>
    );
  }

  return <>{children}</>;
};
