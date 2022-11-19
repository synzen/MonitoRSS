import {
  Center, Heading, Stack,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { Loading } from '@/components';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useDiscordServers } from '../../hooks';

interface Props {
  children?: React.ReactNode
}

export const RequireDiscordServers = ({ children }: Props) => {
  const { status, error } = useDiscordServers();
  const { t } = useTranslation();

  if (status === 'loading') {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        height="100%"
        spacing="2rem"
      >
        <Loading size="xl" />
        <Heading>{t('pages.loadingServers.title')}</Heading>
      </Stack>
    );
  }

  if (status === 'error') {
    return (
      <Center height="100%">
        <ErrorAlert
          description={error?.message}
          withGoBack
        />
      </Center>
    );
  }

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{children}</>;
};
