import { Box, Flex, SlideFade, useColorModeValue as mode } from "@chakra-ui/react";
import * as React from "react";
import { MenuItem } from "./MenuItem";

interface Props {
  onSelectedValue: (value: string) => void;
  shown?: boolean;
  items: Array<{
    id: string;
    title: string;
    description?: string;
    value: string;
    icon?: string;
  }>;
  boxProps?: React.ComponentProps<typeof Box>;
}

export const Menu: React.FC<Props> = ({ onSelectedValue, items, shown, boxProps }) => {
  const onClickMenuItem = (value: string) => {
    onSelectedValue(value);
  };

  return (
    <Box
      as={SlideFade}
      unmountOnExit
      in={shown}
      bg={mode("white", "gray.700")}
      rounded="lg"
      overflow="auto"
      paddingY="2"
      paddingX="2"
      minWidth="xs"
      {...boxProps}
    >
      <Box as="ul" listStyleType="none">
        {items.map((item) => (
          <Flex as="li" key={item.id} flexDirection="column" gap="2">
            <MenuItem
              onClick={() => onClickMenuItem(item.value)}
              title={item.title}
              icon={item.icon}
            >
              {item.description}
            </MenuItem>
          </Flex>
        ))}
      </Box>
    </Box>
  );
};
