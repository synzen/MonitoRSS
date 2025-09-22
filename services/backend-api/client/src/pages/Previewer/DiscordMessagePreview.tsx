import React from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  useColorModeValue,
  Avatar,
  Stack,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { useFormContext } from "react-hook-form";
import { Component, ComponentType, MessageComponent } from "./types";
import { ArticlePreviewBanner } from "./ArticlePreviewBanner";

export const DiscordMessagePreview: React.FC = () => {
  const { watch } = useFormContext<{ messageComponent: MessageComponent }>();
  const messageComponent = watch("messageComponent");
  const bgColor = useColorModeValue("#36393f", "#36393f");
  const textColor = useColorModeValue("#dcddde", "#dcddde");

  const renderComponent = (component: Component): React.ReactNode => {
    switch (component.type) {
      case ComponentType.Message:
        return (
          <VStack
            align="stretch"
            spacing={2}
            key={component.id}
            maxWidth="min(600px, 100%)"
            width="fit-content"
            alignItems="stretch"
          >
            {component.children.map(renderComponent)}
          </VStack>
        );
      case ComponentType.TextDisplay:
        return (
          <Box key={component.id}>
            <Text fontSize="sm">{component.content || "[missing text]"}</Text>
          </Box>
        );
      case ComponentType.Section:
        return (
          <HStack spacing={2} align="flex-start" key={component.id}>
            {component.children.map(renderComponent)}
            {component.accessory && renderComponent(component.accessory)}
          </HStack>
        );
      case ComponentType.ActionRow:
        return (
          <Box key={component.id}>
            <HStack spacing={2}>{component.children.map(renderComponent)}</HStack>
          </Box>
        );

      case ComponentType.Button: {
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
        const colors = buttonColors[component.style];

        const isLinkButton = component.style === "Link" && component.href;

        if (isLinkButton) {
          return (
            <Button
              key={component.id}
              as="a"
              href={component.href}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              borderColor={colors.border}
              borderWidth="1px"
              bg={colors.bg}
              color={colors.color}
              isDisabled={component.disabled}
              borderRadius="6px"
              fontWeight="medium"
              fontSize="14px"
              px={3}
              py={1.5}
              minH="32px"
              _hover={{ opacity: component.disabled ? 0.6 : 0.9 }}
              _disabled={{ opacity: 0.6 }}
              _active={{ transform: "translateY(0px)" }}
              rightIcon={<ExternalLinkIcon boxSize={4} />}
              textDecoration="none"
              _focus={{ textDecoration: "none" }}
            >
              {component.label || "Button"}
            </Button>
          );
        }

        return (
          <Button
            key={component.id}
            size="sm"
            borderColor={colors.border}
            borderWidth="1px"
            bg={colors.bg}
            color={colors.color}
            isDisabled={component.disabled}
            borderRadius="6px"
            fontWeight="medium"
            fontSize="14px"
            px={3}
            py={1.5}
            minH="32px"
            _hover={{ opacity: component.disabled ? 0.6 : 0.9 }}
            _disabled={{ opacity: 0.6 }}
            _active={{ transform: "translateY(0px)" }}
            rightIcon={component.style === "Link" ? <ExternalLinkIcon boxSize={4} /> : undefined}
          >
            {component.label || "Button"}
          </Button>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Stack spacing={0}>
      <ArticlePreviewBanner />
      {/* Discord Message Preview */}
      <Box
        bg={bgColor}
        color={textColor}
        p={4}
        borderRadius="md"
        fontFamily="Whitney, 'Helvetica Neue', Helvetica, Arial, sans-serif"
        maxW="100%"
        maxH={450}
        h="100%"
        overflow="auto"
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
          <Stack spacing={1} flex={1} maxW="calc(100% - 40px - 0.75rem)">
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
              <VStack align="stretch" spacing={3} maxW="min(600px, 100%)" w="fit-content">
                {messageComponent.children?.length === 0 ? (
                  <Text color="gray.400" fontSize="sm" fontStyle="italic">
                    No components added yet
                  </Text>
                ) : (
                  messageComponent.children?.map(renderComponent)
                )}
              </VStack>
            </Box>
          </Stack>
        </HStack>
      </Box>
    </Stack>
  );
};
