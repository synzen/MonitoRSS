import {
  Alert, AlertIcon, Box, Flex,
} from '@chakra-ui/react';
import Loading from '../Loading';

interface Props {
  loading?: boolean
  error?: Error | null
}

const DashboardContent: React.FC<Props> = ({ loading, error, children }) => (
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
      {loading && (
        <Box textAlign="center" paddingY="5rem">
          <Loading />
        </Box>
      )}
      {error && (
        <Alert status="error">
          <AlertIcon />
          {error.message}
        </Alert>
      )}
      {!loading && !error && children}
    </Box>
  </Flex>
);

export default DashboardContent;
