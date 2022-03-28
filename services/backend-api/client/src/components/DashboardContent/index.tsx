import {
  Alert, AlertIcon, Box, Flex,
} from '@chakra-ui/react';
import { Loading } from '../Loading';

interface Props {
  loading?: boolean
  error?: Error | null
}

export const DashboardContent: React.FC<Props> = ({ loading, error, children }) => (
  <Flex
    width="100%"
    justifyContent="center"
  >
    <Box
      maxWidth="7xl"
      width="100%"
      paddingX={{ base: 4, lg: 12 }}
      paddingTop="8"
      paddingBottom="16"
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
