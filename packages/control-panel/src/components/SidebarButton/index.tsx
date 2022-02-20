import { Button, useColorModeValue } from '@chakra-ui/react';

export const SidebarButton: React.FC = () => (
  <Button
    isFullWidth
    borderRadius="0"
    variant="ghost"
    size="lg"
    fontSize="sm"
    _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
    _active={{ bg: useColorModeValue('gray.300', 'gray.600') }}
    _focus={{ boxShadow: 'none' }}
    _focusVisible={{ boxShadow: 'outline' }}
  />
);
