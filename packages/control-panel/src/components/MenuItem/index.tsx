import {
  Avatar,
  Badge, Box, chakra, HStack, Text, useColorModeValue as mode,
} from '@chakra-ui/react';

interface MenuItemProps {
  href: string
  title: string
  isNew?: boolean
  icon?: string
  children?: React.ReactNode
}

const MenuItem: React.FC<MenuItemProps> = (props: MenuItemProps) => {
  const {
    title, children, href, isNew, icon,
  } = props;

  return (
    <chakra.a
      display="block"
      px="5"
      py="3"
      href={href}
      rounded="lg"
      transition="0.2s background"
      textAlign="left"
      _hover={{ bg: mode('gray.50', 'gray.600') }}
    >
      <HStack spacing={4}>
        <Avatar name="Dan" src="https://bit.ly/dan-abramov" />
        <Box as="dl">
          <Text
            display="inline-block"
            textAlign="left"
            as="dt"
            fontWeight="semibold"
            transition="0.2s all"
            _groupHover={{ color: 'blue.500' }}
          >
            {title}
          </Text>
          {isNew && (
          <Badge aria-hidden variant="solid" fontSize="10px" mt="-1" ms="2" colorScheme="blue">
            New
          </Badge>
          )}
          <Text as="dd" fontSize="sm" color={mode('gray.600', 'gray.400')}>
            {children}
          </Text>
        </Box>
      </HStack>
    </chakra.a>
  );
};

export default MenuItem;
