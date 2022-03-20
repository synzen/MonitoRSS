import {
  Center, Heading, Stack,
} from '@chakra-ui/react';
import { Navigate } from 'react-router-dom';
import { Loading } from '@/components';
import { useAuth } from '../hooks';
import { ErrorAlert } from '@/components/ErrorAlert';

export const RequireAuth: React.FC = ({ children }) => {
  const { status, error, authenticated } = useAuth();

  if (status === 'loading' || status === 'idle') {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        height="100%"
        spacing="2rem"
      >
        <Loading size="xl" />
        <Heading>Checking login...</Heading>
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

  if (status === 'success' && !authenticated) {
    window.location.href = '/api/v1/discord/login';

    return null;
  }

  if (status === 'success' && authenticated) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  return <Navigate to="/" />;
};
