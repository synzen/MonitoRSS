import {
  As,
  HStack,
  Icon,
  Link as ChakraLink,
  LinkProps,
  Text,
  Tooltip,
  useColorModeValue as mode,
} from '@chakra-ui/react';
import React from 'react';

interface NavLinkProps extends LinkProps {
  icon?: As
  disabled?: boolean
  active?: boolean
}

export const SidebarLink: React.FC<NavLinkProps> = ({
  icon,
  children,
  onClick,
  disabled,
  active,
}) => (
  <Tooltip
    isDisabled={!disabled}
    placement="bottom-start"
  >
    <ChakraLink
      px="4"
      py="3"
      userSelect="none"
      onClick={disabled ? undefined : onClick}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      borderRadius="md"
      color={disabled ? 'gray.600' : undefined}
      _hover={active || disabled ? {} : { bg: mode('gray.100', 'gray.700') }}
      background={active ? 'blue.500' : undefined}
      tabIndex={0}
      _activeLink={{
        bg: 'gray.700',
        color: 'white',
      }}
    >
      <HStack justify="space-between">
        <HStack spacing="3">
          {icon && <Icon as={icon} />}
          <Text as="span" fontSize="sm" lineHeight="1.25rem">
            {children}
          </Text>
        </HStack>
      </HStack>
    </ChakraLink>
  </Tooltip>
);
