import {
  Box,
  SlideFade,
  useBoolean,
  useColorModeValue as mode,
} from '@chakra-ui/react';
import * as React from 'react';
import MenuItem from '../MenuItem';

interface Link {
  href: string
  title: string
  description: string
  icon?: string
  new?: boolean
}

export const links: Link[] = [
  {
    href: '#',
    title: 'API Reference',
    description: 'Read the full documentation for our products',
  },
  {
    href: '#',
    title: 'Quickstarts',
    description: 'Get the fundamentals with tutorials',
  },
  {
    href: '#',
    title: 'API Status',
    description: 'Live monitoring of our APIs and services',
    new: true,
  },
  {
    href: '#',
    title: 'Changelog',
    description: 'See new additions and changes to our platform',
  },
  {
    href: '#',
    title: 'Changelog There',
    description: 'See new additions and changes to our platform',
  },
];

const Menu: React.FC = () => {
  const [show, { toggle }] = useBoolean(true);
  return (
    <Box
      as={SlideFade}
      unmountOnExit
      in={show}
      bg={mode('white', 'gray.700')}
      pt="2"
      rounded="lg"
      overflow="auto"
      shadow="lg"
    >
      <Box as="ul" listStyleType="none" px="2" pb="2">
        {links.map((link) => (
          <Box as="li" key={link.title}>
            <MenuItem href="#" title={link.title} isNew={link.new}>
              {link.description}
            </MenuItem>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default Menu;
