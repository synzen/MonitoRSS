import {
  Box, Center, Heading, Stack, Text, useToast,
} from '@chakra-ui/react';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { WarningTwoIcon } from '@chakra-ui/icons';
import { Loading } from '@/components';
import { useAuth } from '../hooks';

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
        <Stack
          display="flex"
          flexDir="column"
          alignItems="center"
          justifyContent="center"
          height="100%"
          paddingBottom="25rem"
        >
          <WarningTwoIcon fontSize="12rem" color="red.500" />
          <Heading>Sorry, something went wrong.</Heading>
          <br />
          {' '}
          <Text>
            {error?.message}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (status === 'success' && authenticated) {
    return (
      <Box>
        {children}
      </Box>
    );
  }

  return <Navigate to="/" />;
};
