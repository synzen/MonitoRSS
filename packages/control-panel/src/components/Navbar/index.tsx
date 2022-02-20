import { ChevronRightIcon } from '@chakra-ui/icons';
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Flex,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import NavbarBreadcrumbItem from '../../types/NavbarBreadcrumbItem';

interface Props {
  breadcrumbItems: Array<NavbarBreadcrumbItem>;
}

export const Navbar: React.FC<Props> = ({ breadcrumbItems }) => (
  <Box as="header" bg={useColorModeValue('white', 'gray.800')} borderBottomWidth="1px">
    <Box mx="auto" py="4" px={{ base: '6', md: '8' }} maxWidth="7xl">
      <Flex as="nav" justify="space-between">
        {/* {children} */}
        <Breadcrumb spacing="8px" separator={<ChevronRightIcon color="gray.500" />}>
          {breadcrumbItems.map(({ id, content, enabled }) => {
            if (!enabled) {
              return null;
            }

            return (
              <BreadcrumbItem key={id} fontSize="lg">
                {typeof content === 'string' && (
                  <Text
                    fontWeight="semibold"
                  >
                    {content}
                  </Text>
                )}
                {typeof content !== 'string' && content}
              </BreadcrumbItem>
            );
          })}
        </Breadcrumb>
      </Flex>
    </Box>
  </Box>
);
