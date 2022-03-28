import { Text, useColorModeValue } from '@chakra-ui/react';

export const SidebarHeading: React.FC = ({ children }) => (
  <Text
    as="h4"
    fontSize="xs"
    fontWeight="semibold"
    px="2"
    lineHeight="1.25"
    userSelect="none"
    color={useColorModeValue('gray.600', 'gray.400')}
  >
    {children}
  </Text>
);
