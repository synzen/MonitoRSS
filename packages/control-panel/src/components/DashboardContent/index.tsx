import {
  Alert, AlertIcon, Box, Flex,
} from '@chakra-ui/react';
import Loading from '../Loading';

interface Props {
  loading?: boolean
  error?: Error | null
}

const DashboardContent: React.FC<Props> = ({ loading, error, children }) => {
  if (loading) {
    return (
      <Box textAlign="center" paddingY="5rem">
        <Loading />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        {error.message}
      </Alert>
    );
  }

  return (
    <Flex
      width="100%"
      justifyContent="center"
    >
      <Box
        maxWidth="7xl"
        width="100%"
        px="8"
        paddingY="6"
      >
        {children}
      </Box>
    </Flex>
  );
};

export default DashboardContent;
