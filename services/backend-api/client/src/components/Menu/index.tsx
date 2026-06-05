import { Box, Flex } from "@chakra-ui/react";
import * as React from "react";
import { useColorModeValue as mode } from "@/components/ui/color-mode";
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

// TODO(chakra-v3 migration): v3 removed SlideFade. This renders/unmounts without the slide
// transition the v2 version had; restore an enter/exit animation if the UX regression matters.
export const Menu: React.FC<Props> = ({ onSelectedValue, items, shown, boxProps }) => {
  const onClickMenuItem = (value: string) => {
    onSelectedValue(value);
  };

  if (!shown) {
    return null;
  }

  return (
    <Box
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
