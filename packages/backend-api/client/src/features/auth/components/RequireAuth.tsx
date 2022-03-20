import {
  Center, Heading, Stack, useToast,
} from '@chakra-ui/react';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loading } from '@/components';
import { useAuth } from '../hooks';
import { ErrorAlert } from '@/components/ErrorAlert';

export const RequireAuth: React.FC = ({ children }) => {
  const { status, error, authenticated } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (status === 'success' && !authenticated) {
      toast({
        title: 'You are not authenticated',
        description: 'Please login to continue',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    }
  }, [status, authenticated]);

  if (status === 'loading' || status === 'idle') {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        height="100vh"
        spacing="2rem"
      >
        <Loading size="xl" />
        <Heading>Checking login...</Heading>
      </Stack>
    );
  }

  if (status === 'error') {
    return (
      <Center height="100vh">
        <ErrorAlert
          description={error?.message}
          withGoBack
        />
      </Center>
    );
  }

  if (status === 'success' && authenticated) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
  }

  return <Navigate to="/" />;
};
