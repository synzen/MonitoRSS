/* eslint-disable react/jsx-no-useless-fragment */
import {
  Alert, AlertDescription, AlertIcon, AlertTitle,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import ApiAdapterError from '@/utils/ApiAdapterError';
import { DashboardContent } from '@/components';

interface Props {
  error?: ApiAdapterError | null
  loading?: boolean
}

export const RequireServerBotAccess: React.FC<Props> = ({ error, children }) => {
  const { t } = useTranslation();

  if (error?.statusCode === 404 || error?.statusCode === 403) {
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
