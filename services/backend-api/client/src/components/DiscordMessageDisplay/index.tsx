import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  useColorModeValue,
  Avatar,
  Stack,
  Progress,
  Divider,
  Image,
  SimpleGrid,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";

import DiscordView from "../DiscordView";
// @ts-ignore - markdown utils lack TypeScript definitions (established pattern)
import { parseAllowLinks, jumboify } from "../DiscordView/utils/markdown";
import { DiscordApiComponent } from "../../types/discord/DiscordApiPayload";
import { MentionResolvers } from "../../contexts/MentionDataContext";

// eslint-disable-next-line no-bitwise
const DISCORD_COMPONENTS_V2_FLAG = 1 << 15;

const DISCORD_V2_COMPONENT_TYPE = {
  ActionRow: 1,
  Button: 2,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  Separator: 14,
  Container: 17,
} as const;

const MONITORSS_AVATAR_URL =
  "https://cdn.discordapp.com/avatars/302050872383242240/1fb101f4b0fe104b6b8c53ec5e3d5af6.png";
const MONITORSS_USERNAME = "MonitoRSS";

const buttonColors: Record<string, { bg: string; color: string; border: string }> = {
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

const styleNumToName: Record<number, string> = {
  1: "Primary",
  2: "Secondary",
  3: "Success",
  4: "Danger",
  5: "Link",
};

interface DiscordMessage {
  content?: string | null;
  embeds?: Array<{
    title?: string | null;
    description?: string | null;
    url?: string | null;
    color?: number | null;
    footer?: {
      text: string;
      icon_url?: string | null;
    } | null;
    image?: {
      url: string | null;
    } | null;
    thumbnail?: {
      url: string | null;
    } | null;
    author?: {
      name: string;
      url?: string | null;
      icon_url?: string | null;
    } | null;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }> | null;
    timestamp?: string | null;
  }>;
  components?: DiscordApiComponent[] | null;
  flags?: number | null;
}

interface DiscordMessageDisplayProps {
  messages: DiscordMessage[];
  maxHeight?: string | number | Record<string, number>;
  isLoading?: boolean;
  emptyMessage?: string;
  mentionResolvers?: MentionResolvers;
}

// Shared button rendering logic to avoid duplication
const renderButtonElement = (
  btn: { style?: number; url?: string | null; disabled?: boolean; label?: string },
  key: string,
): React.ReactNode => {
  const styleName = styleNumToName[btn.style || 2] || "Secondary";
  const colors = buttonColors[styleName];
  const isLinkButton = styleName === "Link" && btn.url;

  return (
    <Button
      key={key}
      as={isLinkButton ? "a" : undefined}
      href={isLinkButton ? (btn.url ?? undefined) : undefined}
      target={isLinkButton ? "_blank" : undefined}
      rel={isLinkButton ? "noopener noreferrer" : undefined}
      size="sm"
      borderColor={colors.border}
      borderWidth="1px"
      bg={colors.bg}
      color={colors.color}
      isDisabled={btn.disabled}
      borderRadius="6px"
      fontWeight="medium"
      fontSize="14px"
      px={3}
      py={1.5}
      minH="32px"
      _hover={{ opacity: btn.disabled ? 0.6 : 0.9 }}
      _disabled={{ opacity: 0.6 }}
      _active={{ transform: "translateY(0px)" }}
      rightIcon={styleName === "Link" ? <ExternalLinkIcon boxSize={4} /> : undefined}
      textDecoration="none"
      _focus={{ textDecoration: "none" }}
    >
      {btn.label || "Button"}
    </Button>
  );
};

const renderApiAccessory = (
  accessory: DiscordApiComponent["accessory"],
  key: string,
): React.ReactNode => {
  if (!accessory) return null;

  if (accessory.type === DISCORD_V2_COMPONENT_TYPE.Thumbnail) {
    return (
      <Box
        key={key}
        borderRadius="md"
        overflow="hidden"
        maxW="80px"
        maxH="80px"
        flexShrink={0}
        position="relative"
      >
        {accessory.spoiler && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.800"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="xs"
            color="gray.300"
            zIndex={1}
            role="img"
            aria-label="Content hidden: spoiler"
          >
            SPOILER
          </Box>
        )}
        <Image
          src={accessory.media?.url || ""}
          alt={accessory.description || "Thumbnail"}
          objectFit="cover"
          w="80px"
          h="80px"
          fallback={
            <Box
              w="80px"
              h="80px"
              bg="gray.700"
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontSize="xs"
              color="gray.400"
            >
              No Image
            </Box>
          }
        />
      </Box>
    );
  }

  return renderButtonElement(accessory, key);
};

const renderApiButton = (btn: DiscordApiComponent["accessory"], key: string): React.ReactNode => {
  if (!btn) return null;

  return renderButtonElement(btn, key);
};

const renderApiComponent = (
  comp: DiscordApiComponent,
  index: number,
  mentionResolvers?: MentionResolvers,
): React.ReactNode => {
  const { type } = comp;
  const parserState = mentionResolvers ? { mentionResolvers } : {};

  if (type === DISCORD_V2_COMPONENT_TYPE.Section) {
    return (
      <HStack
        spacing={2}
        align="center"
        justify="space-between"
        width="100%"
        key={`section-${index}`}
      >
        <VStack align="start" spacing={1} flex={1}>
          {comp.components?.map((td, i) => (
            <Box key={`text-${index}-${i}`} fontSize="sm" className="markup">
              {td.content
                ? parseAllowLinks(td.content, false, parserState, jumboify)
                : "[missing text]"}
            </Box>
          ))}
        </VStack>
        {comp.accessory && renderApiAccessory(comp.accessory, `acc-${index}`)}
      </HStack>
    );
  }

  if (type === DISCORD_V2_COMPONENT_TYPE.ActionRow) {
    return (
      <Box key={`actionrow-${index}`}>
        <HStack spacing={2}>
          {comp.components?.map((btn, i) => renderApiButton(btn, `btn-${index}-${i}`))}
        </HStack>
      </Box>
    );
  }

  if (type === DISCORD_V2_COMPONENT_TYPE.Separator) {
    const showDivider = comp.divider !== false;
    const spacing = (comp.spacing || 1) * 2;

    return (
      <Box key={`separator-${index}`} my={`${spacing}px`}>
        {showDivider && <Divider borderColor="hsl(240 calc(1*4%) 60.784%/0.2)" />}
      </Box>
    );
  }

  if (type === DISCORD_V2_COMPONENT_TYPE.TextDisplay) {
    const { content } = comp as { content?: string };

    return (
      <Box key={`textdisplay-${index}`} fontSize="sm" className="markup">
        {content ? parseAllowLinks(content, false, parserState, jumboify) : "[missing text]"}
      </Box>
    );
  }

  if (type === DISCORD_V2_COMPONENT_TYPE.MediaGallery) {
    const items =
      (
        comp as {
          items?: Array<{ media?: { url: string }; spoiler?: boolean; description?: string }>;
        }
      ).items || [];
    const itemCount = items.length;

    const renderGalleryItem = (
      item: { media?: { url: string }; spoiler?: boolean; description?: string },
      i: number,
      height?: string,
    ) => (
      <Box
        key={`gallery-item-${index}-${i}`}
        position="relative"
        borderRadius="md"
        overflow="hidden"
        bg="gray.800"
        height={height}
        width="100%"
      >
        {item.spoiler && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.800"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="xs"
            color="gray.300"
            zIndex={1}
            role="img"
            aria-label="Content hidden: spoiler"
          >
            SPOILER
          </Box>
        )}
        <Image
          src={item.media?.url || ""}
          alt={item.description || "Gallery image"}
          objectFit="cover"
          width="100%"
          height={height || "auto"}
          minHeight="60px"
          maxHeight={height ? undefined : "200px"}
          fallback={
            <Box
              width="100%"
              height={height || "80px"}
              bg="gray.700"
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontSize="xs"
              color="gray.500"
            >
              {item.media?.url ? "Loading..." : "No image"}
            </Box>
          }
        />
      </Box>
    );

    if (itemCount === 3) {
      return (
        <Box
          key={`mediagallery-${index}`}
          display="grid"
          gridTemplateColumns="2fr 1fr"
          gridTemplateRows="1fr 1fr"
          gap="4px"
          width="100%"
          maxWidth="600px"
          sx={{
            aspectRatio: "3/2",
          }}
        >
          <Box gridRow="1 / 3" overflow="hidden" borderRadius="md">
            {renderGalleryItem(items[0], 0, "100%")}
          </Box>
          <Box overflow="hidden" borderRadius="md">
            {renderGalleryItem(items[1], 1, "100%")}
          </Box>
          <Box overflow="hidden" borderRadius="md">
            {renderGalleryItem(items[2], 2, "100%")}
          </Box>
        </Box>
      );
    }

    if (itemCount === 5) {
      return (
        <Box
          key={`mediagallery-${index}`}
          display="grid"
          gridTemplateColumns="1fr 1fr"
          gap={1}
          width="600px"
          maxWidth="100%"
        >
          <Box aspectRatio="1/1">{renderGalleryItem(items[0], 0, "100%")}</Box>
          <Box aspectRatio="1/1">{renderGalleryItem(items[1], 1, "100%")}</Box>
          <Box gridColumn="1 / -1" display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={1}>
            <Box aspectRatio="1/1">{renderGalleryItem(items[2], 2, "100%")}</Box>
            <Box aspectRatio="1/1">{renderGalleryItem(items[3], 3, "100%")}</Box>
            <Box aspectRatio="1/1">{renderGalleryItem(items[4], 4, "100%")}</Box>
          </Box>
        </Box>
      );
    }

    if (itemCount === 7) {
      return (
        <Box
          key={`mediagallery-${index}`}
          display="grid"
          gridTemplateColumns="1fr 1fr 1fr"
          gap={1}
          width="600px"
          maxWidth="100%"
        >
          <Box gridColumn="1 / -1" height="250px">
            {renderGalleryItem(items[0], 0, "250px")}
          </Box>
          <Box aspectRatio="1/1">{renderGalleryItem(items[1], 1, "100%")}</Box>
          <Box aspectRatio="1/1">{renderGalleryItem(items[2], 2, "100%")}</Box>
          <Box aspectRatio="1/1">{renderGalleryItem(items[3], 3, "100%")}</Box>
          <Box aspectRatio="1/1">{renderGalleryItem(items[4], 4, "100%")}</Box>
          <Box aspectRatio="1/1">{renderGalleryItem(items[5], 5, "100%")}</Box>
          <Box aspectRatio="1/1">{renderGalleryItem(items[6], 6, "100%")}</Box>
        </Box>
      );
    }

    if (itemCount === 8) {
      return (
        <Box
          key={`mediagallery-${index}`}
          display="grid"
          gridTemplateColumns="1fr 1fr"
          gap={1}
          width="600px"
          maxWidth="100%"
        >
          <Box aspectRatio="1/1">{renderGalleryItem(items[0], 0, "100%")}</Box>
          <Box aspectRatio="1/1">{renderGalleryItem(items[1], 1, "100%")}</Box>
          <Box gridColumn="1 / -1" display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={1}>
            <Box aspectRatio="1/1">{renderGalleryItem(items[2], 2, "100%")}</Box>
            <Box aspectRatio="1/1">{renderGalleryItem(items[3], 3, "100%")}</Box>
            <Box aspectRatio="1/1">{renderGalleryItem(items[4], 4, "100%")}</Box>
          </Box>
          <Box gridColumn="1 / -1" display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={1}>
            <Box aspectRatio="1/1">{renderGalleryItem(items[5], 5, "100%")}</Box>
            <Box aspectRatio="1/1">{renderGalleryItem(items[6], 6, "100%")}</Box>
            <Box aspectRatio="1/1">{renderGalleryItem(items[7], 7, "100%")}</Box>
          </Box>
        </Box>
      );
    }

    if (itemCount === 10) {
      return (
        <Box
          key={`mediagallery-${index}`}
          display="grid"
          gridTemplateColumns="1fr 1fr 1fr"
          gridTemplateRows="300px 150px 150px 150px"
          gap={1}
          width="600px"
          maxWidth="100%"
        >
          <Box gridColumn="1 / -1" height="300px">
            {renderGalleryItem(items[0], 0, "300px")}
          </Box>
          <Box height="150px">{renderGalleryItem(items[1], 1, "150px")}</Box>
          <Box height="150px">{renderGalleryItem(items[2], 2, "150px")}</Box>
          <Box height="150px">{renderGalleryItem(items[3], 3, "150px")}</Box>
          <Box height="150px">{renderGalleryItem(items[4], 4, "150px")}</Box>
          <Box height="150px">{renderGalleryItem(items[5], 5, "150px")}</Box>
          <Box height="150px">{renderGalleryItem(items[6], 6, "150px")}</Box>
          <Box height="150px">{renderGalleryItem(items[7], 7, "150px")}</Box>
          <Box height="150px">{renderGalleryItem(items[8], 8, "150px")}</Box>
          <Box height="150px">{renderGalleryItem(items[9], 9, "150px")}</Box>
        </Box>
      );
    }

    if (itemCount === 2) {
      return (
        <Box
          key={`mediagallery-${index}`}
          display="grid"
          gridTemplateColumns="1fr 1fr"
          gap="4px"
          width="100%"
          maxWidth="600px"
        >
          <Box aspectRatio="1/1">{renderGalleryItem(items[0], 0, "100%")}</Box>
          <Box aspectRatio="1/1">{renderGalleryItem(items[1], 1, "100%")}</Box>
        </Box>
      );
    }

    const getColumns = () => {
      if (itemCount === 1) return 1;
      if (itemCount <= 4) return 2;

      return 3;
    };

    const width = itemCount > 3 ? "600px" : undefined;
    const maxWidth = itemCount > 3 ? "100%" : undefined;
    const gridItemHeight = itemCount > 3 ? "180px" : undefined;

    return (
      <SimpleGrid
        key={`mediagallery-${index}`}
        columns={getColumns()}
        spacing={1}
        width={width}
        maxWidth={maxWidth}
      >
        {items.map((item, i) => renderGalleryItem(item, i, gridItemHeight))}
      </SimpleGrid>
    );
  }

  if (type === DISCORD_V2_COMPONENT_TYPE.Container) {
    const containerComp = comp as {
      accent_color?: number | null;
      spoiler?: boolean;
      components?: DiscordApiComponent[];
    };
    const accentColor = containerComp.accent_color
      ? `#${Number(containerComp.accent_color).toString(16).padStart(6, "0")}`
      : undefined;

    return (
      <Box
        key={`container-${index}`}
        position="relative"
        bg="hsl(240 calc(1*4.762%) 92.157%/0.06)"
        borderRadius="md"
        borderWidth="1px"
        borderColor="hsl(240 calc(1*4%) 60.784%/0.2)"
        overflow="hidden"
        p="16px"
      >
        {accentColor && (
          <Box position="absolute" left={0} top={0} bottom={0} width="4px" bg={accentColor} />
        )}
        {containerComp.spoiler && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.800"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="xs"
            color="gray.300"
            zIndex={1}
            role="img"
            aria-label="Content hidden: spoiler"
          >
            SPOILER
          </Box>
        )}
        <VStack align="stretch" spacing={2} pl={accentColor ? 2 : 0}>
          {containerComp.components?.map((child, i) =>
            renderApiComponent(child, i, mentionResolvers),
          )}
        </VStack>
      </Box>
    );
  }

  return null;
};

export const DiscordMessageDisplay: React.FC<DiscordMessageDisplayProps> = ({
  messages,
  maxHeight,
  isLoading,
  emptyMessage,
  mentionResolvers,
}) => {
  const bgColor = useColorModeValue("#36393f", "#36393f");
  const textColor = useColorModeValue("#dcddde", "#dcddde");

  if (!messages || messages.length === 0) {
    return (
      <Box
        bg={bgColor}
        color={textColor}
        p={4}
        borderRadius="md"
        fontFamily="Whitney, 'Helvetica Neue', Helvetica, Arial, sans-serif"
        maxW="100%"
        maxH={maxHeight || { base: 300, lg: 450 }}
        h="100%"
        overflow="auto"
        position="relative"
      >
        <HStack align="flex-start" spacing={3}>
          <Avatar
            size="sm"
            src={MONITORSS_AVATAR_URL}
            name={MONITORSS_USERNAME}
            borderRadius="50%"
            w={10}
            h={10}
          />
          <Stack spacing={1} flex={1} maxW="calc(100% - 40px - 0.75rem)">
            <HStack spacing={2} align="center">
              <Text fontSize="sm" fontWeight="semibold" color="white">
                {MONITORSS_USERNAME}
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
            <Text color="gray.400" fontSize="sm" fontStyle="italic">
              {emptyMessage || "No components added yet"}
            </Text>
          </Stack>
        </HStack>
      </Box>
    );
  }

  const firstMessage = messages[0];
  // eslint-disable-next-line no-bitwise
  const isV2Components = firstMessage && (firstMessage.flags ?? 0) & DISCORD_COMPONENTS_V2_FLAG;
  const v2Components = isV2Components ? firstMessage.components : null;

  const legacyMessages = isV2Components
    ? []
    : (messages as Array<{
        content?: string | null;
        embeds?: Array<{
          title?: string;
          description?: string;
          url?: string;
          color?: number;
        }>;
        components?: Array<{
          type: number;
          components: Array<{
            type: number;
            style: number;
            label: string;
            url?: string;
          }>;
        }> | null;
      }>);

  return (
    <Box
      bg={bgColor}
      color={textColor}
      p={4}
      borderRadius="md"
      fontFamily="Whitney, 'Helvetica Neue', Helvetica, Arial, sans-serif"
      maxW="100%"
      maxH={maxHeight || { base: 300, lg: 450 }}
      h="100%"
      overflow="auto"
      position="relative"
    >
      {isLoading && (
        <Progress
          position="absolute"
          top={0}
          left={0}
          right={0}
          size="sm"
          colorScheme="blue"
          isIndeterminate
          zIndex={2}
          aria-label="Updating message preview"
        />
      )}
      <HStack align="flex-start" spacing={3}>
        <Avatar
          size="sm"
          src={MONITORSS_AVATAR_URL}
          name={MONITORSS_USERNAME}
          borderRadius="50%"
          w={10}
          h={10}
        />
        <Stack spacing={1} flex={1} maxW="calc(100% - 40px - 0.75rem)">
          <HStack spacing={2} align="center">
            <Text fontSize="sm" fontWeight="semibold" color="white">
              {MONITORSS_USERNAME}
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
            <VStack align="start" spacing={3} maxW="min(600px, 100%)">
              {legacyMessages.length > 0 && (
                <DiscordView
                  darkTheme
                  username={MONITORSS_USERNAME}
                  avatar_url={MONITORSS_AVATAR_URL}
                  messages={legacyMessages}
                  excludeHeader
                  mentionResolvers={mentionResolvers}
                />
              )}
              {isV2Components && v2Components && v2Components.length > 0 && (
                <Box width="fit-content" maxW="100%">
                  <VStack align="stretch" spacing={2}>
                    {v2Components.map((comp, i) => renderApiComponent(comp, i, mentionResolvers))}
                  </VStack>
                </Box>
              )}
            </VStack>
          </Box>
        </Stack>
      </HStack>
    </Box>
  );
};

export default DiscordMessageDisplay;
