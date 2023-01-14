import { Text, useColorModeValue } from "@chakra-ui/react";

interface Props {
  children?: React.ReactNode;
}

export const SidebarHeading = ({ children }: Props) => (
  <Text
    as="h4"
    fontSize="xs"
    fontWeight="semibold"
    px="2"
    lineHeight="1.25"
    userSelect="none"
    color={useColorModeValue("gray.600", "gray.400")}
  >
    {children}
  </Text>
);
