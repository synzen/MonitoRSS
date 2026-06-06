import { HStack, Icon, Link as ChakraLink, LinkProps, Text } from "@chakra-ui/react";
import React from "react";
import { useColorModeValue as mode } from "@/components/ui/color-mode";
import { Tooltip } from "@/components/ui/tooltip";

interface NavLinkProps extends LinkProps {
  icon?: React.ElementType;
  disabled?: boolean;
  active?: boolean;
}

export const SidebarLink: React.FC<NavLinkProps> = ({
  icon,
  children,
  onClick,
  disabled,
  active,
}) => (
  <Tooltip disabled={!disabled} positioning={{ placement: "bottom-start" }} content="">
    <ChakraLink
      px="4"
      py="3"
      userSelect="none"
      onClick={disabled ? undefined : onClick}
      cursor={disabled ? "not-allowed" : "pointer"}
      borderRadius="l3"
      color={active ? "brand.contrast" : (disabled && "fg.subtle") || undefined}
      _hover={active || disabled ? {} : { bg: mode("gray.100", "bg.emphasized") }}
      background={active ? "brandSolid" : undefined}
      tabIndex={0}
    >
      <HStack justify="space-between">
        <HStack gap="3">
          {icon && <Icon as={icon} />}
          <Text as="span" fontSize="sm" lineHeight="1.25rem">
            {children}
          </Text>
        </HStack>
      </HStack>
    </ChakraLink>
  </Tooltip>
);
