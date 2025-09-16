import React from "react";
import { Box, VStack, HStack, Text, Button, useColorModeValue, Avatar } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import type { Component, DiscordMessagePreviewProps } from "./types";

export const DiscordMessagePreview: React.FC<DiscordMessagePreviewProps> = ({
  messageComponent,
}) => {
  const bgColor = useColorModeValue("#36393f", "#36393f");
  const textColor = useColorModeValue("#dcddde", "#dcddde");

  const renderComponent = (component: Component): React.ReactNode => {
    switch (component.type) {
      case "Message":
        return (
          <VStack align="stretch" spacing={2} key={component.id}>
            {component.children.map(renderComponent)}
          </VStack>
        );
      case "TextDisplay":
        return (
          <Box key={component.id}>
            <Text fontSize="sm">{component.content || "Text Display Component"}</Text>
          </Box>
        );
      case "ActionRow":
        return (
          <Box key={component.id}>
            <HStack spacing={2} wrap="wrap">
              {component.children.map((button) => {
                const buttonColors = {
                  Primary: {
                    bg: "#5865f2",
                    color: "white",
                    border: "hsl(0 calc(1*0%) 100%/0.0784313725490196)",
                  },
                  Secondary: {
                    bg: "hsl(240 calc(1*4%) 60.784%/0.12156862745098039)",
                    color: "hsl(240 calc(1*5.263%) 92.549%/1)",
                    border:
                      "color-mix(in oklab,hsl(240 calc(1*4%) 60.784%/0.0392156862745098) 100%,hsl(0 0% 0%/0.0392156862745098) 0%)",
                  },
                  Success: {
                    bg: "#248046",
                    color: "white",
                    border: "hsl(0 calc(1*0%) 100%/0.0784313725490196)",
                  },
                  Danger: {
                    bg: "#da373c",
                    color: "white",
                    border: "hsl(0 calc(1*0%) 100%/0.0784313725490196)",
                  },
                  Link: {
                    bg: "hsl(240 calc(1*4%) 60.784%/0.12156862745098039)",
                    color: "hsl(240 calc(1*5.263%) 92.549%/1)",
                    border:
                      "color-mix(in oklab,hsl(240 calc(1*4%) 60.784%/0.0392156862745098) 100%,hsl(0 0% 0%/0.0392156862745098) 0%)",
                  },
                };
                const colors = buttonColors[button.style];

                const isLinkButton = button.style === "Link" && button.href;

                if (isLinkButton) {
                  return (
                    <Button
                      key={button.id}
                      as="a"
                      href={button.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      borderColor={colors.border}
                      borderWidth="1px"
                      bg={colors.bg}
                      color={colors.color}
                      isDisabled={button.disabled}
                      borderRadius="6px"
                      fontWeight="medium"
                      fontSize="14px"
                      px={3}
                      py={1.5}
                      minH="32px"
                      _hover={{ opacity: button.disabled ? 0.6 : 0.9 }}
                      _disabled={{ opacity: 0.6 }}
                      _active={{ transform: "translateY(0px)" }}
                      rightIcon={<ExternalLinkIcon boxSize={4} />}
                      textDecoration="none"
                      _focus={{ textDecoration: "none" }}
                    >
                      {button.label || "Button"}
                    </Button>
                  );
                }

                return (
                  <Button
                    key={button.id}
                    size="sm"
                    borderColor={colors.border}
                    borderWidth="1px"
                    bg={colors.bg}
                    color={colors.color}
                    isDisabled={button.disabled}
                    borderRadius="6px"
                    fontWeight="medium"
                    fontSize="14px"
                    px={3}
                    py={1.5}
                    minH="32px"
                    _hover={{ opacity: button.disabled ? 0.6 : 0.9 }}
                    _disabled={{ opacity: 0.6 }}
                    _active={{ transform: "translateY(0px)" }}
                    rightIcon={
                      button.style === "Link" ? <ExternalLinkIcon boxSize={4} /> : undefined
                    }
                  >
                    {button.label || "Button"}
                  </Button>
                );
              })}
            </HStack>
          </Box>
        );
      case "Button":
        // This shouldn't render directly as buttons should be in ActionRows
        return null;
      default:
        return null;
    }
  };

  return (
    <Box
      bg={bgColor}
      color={textColor}
      p={4}
      borderRadius="md"
      minH="400px"
      fontFamily="Whitney, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    >
      <HStack align="flex-start" spacing={3}>
        <Avatar
          size="sm"
          src="https://cdn.discordapp.com/avatars/302050872383242240/1fb101f4b0fe104b6b8c53ec5e3d5af6.png"
          name="MonitoRSS"
          borderRadius="50%"
          w={10}
          h={10}
        />
        <VStack align="stretch" spacing={1} flex={1}>
          <HStack spacing={2} align="center">
            <Text fontSize="sm" fontWeight="semibold" color="white">
              MonitoRSS
            </Text>
            <Box
              fontSize="xs"
              bg="#5865f2"
              color="white"
              px={1}
              py={0.5}
              borderRadius="sm"
              fontWeight="bold"
              lineHeight="1"
            >
              ✓ APP
            </Box>
            <Text fontSize="xs" color="#a3a6aa" ml={1}>
              Today at 12:04 PM
            </Text>
          </HStack>
          <Box>
            {messageComponent ? (
              renderComponent(messageComponent)
            ) : (
              <Text fontSize="sm" color="#72767d" fontStyle="italic">
                No message configured yet.
              </Text>
            )}
          </Box>
        </VStack>
      </HStack>
    </Box>
  );
};
