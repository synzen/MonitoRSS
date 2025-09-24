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
import { Component, ComponentType, MessageComponentRoot, PreviewerFormState } from "./types";
import { ArticlePreviewBanner } from "./ArticlePreviewBanner";
import DiscordView from "../../components/DiscordView";
import { DiscordViewEmbed } from "../../types/DiscordViewEmbed";
import { usePreviewerContext } from "./PreviewerContext";

const convertLegacyEmbedToDiscordViewEmbed = (
  embedComponent: Component,
  currentArticle?: { publishedAt?: string }
): DiscordViewEmbed | null => {
  if (embedComponent.type !== ComponentType.LegacyEmbed) {
    return null;
  }

  const embed: DiscordViewEmbed = {};

  // Get color from embed component itself
  if ((embedComponent as any).color) {
    embed.color = (embedComponent as any).color;
  }

  // Process embed subcomponents
  embedComponent.children?.forEach((subComponent) => {
    if (subComponent.type === ComponentType.LegacyEmbedAuthor) {
      embed.author = {
        name: subComponent.authorName || null,
        url: subComponent.authorUrl || null,
        icon_url: subComponent.authorIconUrl || null,
      };
    } else if (subComponent.type === ComponentType.LegacyEmbedTitle) {
      embed.title = subComponent.title || null;
      embed.url = subComponent.titleUrl || null;
    } else if (subComponent.type === ComponentType.LegacyEmbedDescription) {
      embed.description = subComponent.description || null;
    } else if (subComponent.type === ComponentType.LegacyEmbedImage) {
      embed.image = {
        url: subComponent.imageUrl || null,
      };
    } else if (subComponent.type === ComponentType.LegacyEmbedThumbnail) {
      embed.thumbnail = {
        url: subComponent.thumbnailUrl || null,
      };
    } else if (subComponent.type === ComponentType.LegacyEmbedFooter) {
      embed.footer = {
        text: subComponent.footerText || null,
        icon_url: subComponent.footerIconUrl || null,
      };
    } else if (subComponent.type === ComponentType.LegacyEmbedField) {
      if (!embed.fields) {
        embed.fields = [];
      }

      embed.fields.push({
        name: subComponent.fieldName || null,
        value: subComponent.fieldValue || null,
        inline: subComponent.inline || null,
      });
    } else if (subComponent.type === ComponentType.LegacyEmbedTimestamp) {
      // Handle the new timestamp radio select values
      if (!subComponent.timestamp) {
        embed.timestamp = null; // No timestamp
      } else if (subComponent.timestamp === "article") {
        embed.timestamp = currentArticle?.publishedAt || null; // Use article's published date
      } else if (subComponent.timestamp === "now") {
        embed.timestamp = new Date().toISOString(); // Use current time
      } else {
        embed.timestamp = subComponent.timestamp || null;
      }
    }
  });

  return embed;
};

// Convert legacy components to DiscordView format
const convertLegacyToDiscordView = (
  rootComponent?: MessageComponentRoot,
  currentArticle?: { publishedAt?: string }
) => {
  if (!rootComponent) {
    return null;
  }

  if (rootComponent.type !== ComponentType.LegacyRoot) {
    return null;
  }

  let content = "";
  const embeds: DiscordViewEmbed[] = [];

  // Process children
  rootComponent.children?.forEach((child) => {
    if (child.type === ComponentType.LegacyText) {
      content = child.content || "";
    } else if (child.type === ComponentType.LegacyEmbed) {
      const embed = convertLegacyEmbedToDiscordViewEmbed(child, currentArticle);

      if (embed) {
        embeds.push(embed);
      }
    }
  });

  return {
    content,
    embeds,
  };
};

export const DiscordMessagePreview: React.FC = () => {
  const { watch } = useFormContext<PreviewerFormState>();
  const messageComponent = watch("messageComponent");
  const bgColor = useColorModeValue("#36393f", "#36393f");
  const textColor = useColorModeValue("#dcddde", "#dcddde");
  const { currentArticle } = usePreviewerContext();

  const renderComponent = (component: Component): React.ReactNode => {
    switch (component.type) {
      case ComponentType.V2Root:
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
      case ComponentType.V2TextDisplay:
        return (
          <Box key={component.id}>
            <Text fontSize="sm">{component.content || "[missing text]"}</Text>
          </Box>
        );
      case ComponentType.V2Section:
        return (
          <HStack spacing={2} align="flex-start" key={component.id}>
            {component.children.map(renderComponent)}
            {component.accessory && renderComponent(component.accessory)}
          </HStack>
        );
      case ComponentType.V2ActionRow:
        return (
          <Box key={component.id}>
            <HStack spacing={2}>{component.children.map(renderComponent)}</HStack>
          </Box>
        );

      case ComponentType.V2Button: {
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

  const legacyMessageData = convertLegacyToDiscordView(messageComponent, currentArticle);

  // Use custom rendering for V2 components
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
                {!legacyMessageData &&
                  !!messageComponent &&
                  messageComponent.children.length === 0 && (
                    <Text color="gray.400" fontSize="sm" fontStyle="italic">
                      No components added yet
                    </Text>
                  )}
                {!legacyMessageData &&
                  !!messageComponent &&
                  messageComponent.children.length > 0 &&
                  messageComponent.children?.map(renderComponent)}
                {legacyMessageData && (
                  <DiscordView
                    darkTheme
                    username="MonitoRSS"
                    avatar_url="https://cdn.discordapp.com/avatars/302050872383242240/1fb101f4b0fe104b6b8c53ec5e3d5af6.png"
                    messages={[legacyMessageData]}
                    excludeHeader
                  />
                )}
              </VStack>
            </Box>
          </Stack>
        </HStack>
      </Box>
    </Stack>
  );
};
