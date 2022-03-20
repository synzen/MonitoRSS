import { Button } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { notifyError } from '@/utils/notifyError';
import { getLogout } from '../api';

export const LogoutButton: React.FC = () => {
  const { t } = useTranslation();
  const [loggingOut, setLoggingOut] = useState(false);

  const onClickLogout = async () => {
    try {
      setLoggingOut(true);
      await getLogout();
      window.location.href = '/';
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Button
      justifySelf="flex-end"
      marginTop="4"
      variant="ghost"
      mx="6"
      isLoading={loggingOut}
      disabled={loggingOut}
      onClick={onClickLogout}
    >
      Logout
    </Button>
  );
};
