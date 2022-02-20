import { Box, Flex } from '@chakra-ui/react';

const DashboardContent: React.FC = ({ children }) => (
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

export default DashboardContent;
