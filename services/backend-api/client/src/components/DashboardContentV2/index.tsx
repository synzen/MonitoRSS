import { Alert, AlertIcon, Box, Flex } from "@chakra-ui/react";
import { Loading } from "../Loading";

interface Props {
  loading?: boolean;
  error?: Error | null;
  children?: React.ReactNode;
}

export const DashboardContentV2 = ({ loading, error, children }: Props) => (
  <Flex width="100%" justifyContent="center">
    <Box width="100%">
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
