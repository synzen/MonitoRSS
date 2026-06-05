import React from "react";
import { FaChevronRight } from "react-icons/fa6";
import {
  Box,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbRoot,
  BreadcrumbSeparator,
  Flex,
  Icon,
  Text,
} from "@chakra-ui/react";
import NavbarBreadcrumbItem from "../../types/NavbarBreadcrumbItem";

interface Props {
  breadcrumbItems: Array<NavbarBreadcrumbItem>;
}

export const Navbar: React.FC<Props> = ({ breadcrumbItems }) => {
  const enabledItems = breadcrumbItems.filter(({ enabled }) => enabled);

  return (
    <Box as="header" bg="bg.panel" borderBottomWidth="1px" overflow="visible">
      <Box mx="auto" py="4" px={{ base: "6", md: "8" }} maxWidth="7xl" whiteSpace="nowrap">
        <Flex as="nav" justify="space-between">
          {/* {children} */}
          <BreadcrumbRoot>
            <BreadcrumbList gap="8px">
              {enabledItems.map(({ id, content }, index) => (
                <React.Fragment key={id}>
                  <BreadcrumbItem fontSize="lg">
                    {typeof content === "string" && <Text fontWeight="semibold">{content}</Text>}
                    {typeof content !== "string" && content}
                  </BreadcrumbItem>
                  {index < enabledItems.length - 1 && (
                    <BreadcrumbSeparator>
                      <Icon as={FaChevronRight} color="fg.subtle" />
                    </BreadcrumbSeparator>
                  )}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </BreadcrumbRoot>
        </Flex>
      </Box>
    </Box>
  );
};
