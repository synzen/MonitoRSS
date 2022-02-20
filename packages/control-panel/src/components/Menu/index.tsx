import {
  Box,
  SlideFade,
  useColorModeValue as mode,
} from '@chakra-ui/react';
import * as React from 'react';
import { MenuItem } from './MenuItem';

interface Props {
  onSelectedValue: (value: string) => void
  shown?: boolean
  items: Array<{
    id: string,
    title: string,
    description?: string,
    value: string,
    icon?: string
  }>
}

export const Menu: React.FC<Props> = ({
  onSelectedValue, items, shown,
}) => {
  const onClickMenuItem = (value: string) => {
    onSelectedValue(value);
  };

  return (
    <Box
      as={SlideFade}
      unmountOnExit
      in={shown}
      bg={mode('white', 'gray.700')}
      rounded="lg"
      overflow="auto"
      paddingTop={1}
      minWidth="xs"
    >
      <Box
        as="ul"
        listStyleType="none"
        px="2"
        pb="2"
      >
        {items.map((item) => (
          <Box
            as="li"
            key={item.id}
          >
            <MenuItem
              onClick={() => onClickMenuItem(item.value)}
              title={item.title}
              icon={item.icon}
            >
              {item.description}
            </MenuItem>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
