import { Box, chakra, HStack, Text } from "@chakra-ui/react";
import { useColorModeValue as mode } from "@/components/ui/color-mode";
import { Avatar } from "@/components/ui/avatar";

interface MenuItemProps {
  title: string;
  icon?: string;
  children?: React.ReactNode;
  onClick: () => void;
}

export const MenuItem: React.FC<MenuItemProps> = (props: MenuItemProps) => {
  const { title, children, icon, onClick } = props;

  return (
    <chakra.button
      type="button"
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
      <HStack gap={4}>
        {icon && <Avatar name={title} aria-hidden src={icon} />}
        <Box>
          <Text
            display="inline-block"
            textAlign="left"
            fontWeight="semibold"
            transition="0.2s all"
            _groupHover={{ color: "brand.fg" }}
          >
            {title}
          </Text>
          <Text as="dd" fontSize="sm" color={mode("gray.600", "gray.400")}>
            {children}
          </Text>
        </Box>
      </HStack>
    </chakra.button>
  );
};
