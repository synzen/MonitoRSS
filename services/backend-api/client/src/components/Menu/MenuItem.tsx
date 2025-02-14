import { Avatar, Box, chakra, HStack, Text, useColorModeValue as mode } from "@chakra-ui/react";

interface MenuItemProps {
  title: string;
  icon?: string;
  children?: React.ReactNode;
  onClick: () => void;
}

export const MenuItem: React.FC<MenuItemProps> = (props: MenuItemProps) => {
  const { title, children, icon, onClick } = props;

  return (
    <chakra.a
      as="button"
      display="block"
      px="5"
      py="3"
      width="100%"
      rounded="lg"
      transition="0.2s background"
      onClick={onClick}
      textAlign="left"
      _hover={{ bg: mode("gray.50", "gray.600") }}
    >
      <HStack spacing={4}>
        {icon && <Avatar name="Dan" aria-hidden src={icon} />}
        <Box>
          <Text
            display="inline-block"
            textAlign="left"
            fontWeight="semibold"
            transition="0.2s all"
            _groupHover={{ color: "blue.500" }}
          >
            {title}
          </Text>
          <Text as="dd" fontSize="sm" color={mode("gray.600", "gray.400")}>
            {children}
          </Text>
        </Box>
      </HStack>
    </chakra.a>
  );
};
