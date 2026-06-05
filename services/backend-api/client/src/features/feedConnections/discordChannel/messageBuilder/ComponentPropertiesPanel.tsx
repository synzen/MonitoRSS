import React from "react";
import { Box, VStack, HStack, Text, Button, Alert } from "@chakra-ui/react";
import { FaTrash, FaChevronUp, FaChevronDown } from "react-icons/fa6";
import type { Component, ComponentPropertiesPanelProps } from "./types";
import { ComponentType, ROOT_COMPONENT_TYPES } from "./types";
import { InputWithInsertPlaceholder } from "./components/InputWithInsertPlaceholder";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";

import { useMessageBuilderContext } from "./MessageBuilderContext";
import { DiscordButtonStyle } from "./constants/DiscordButtonStyle";
import { LegacyRootProperties } from "./componentProperties/LegacyRootProperties";
import { LegacyTextProperties } from "./componentProperties/LegacyTextProperties";
import {
  LegacyEmbedFamilyProperties,
  isLegacyEmbedFamilyType,
} from "./componentProperties/LegacyEmbedFamilyProperties";
import {
  V2ComponentProperties,
  isV2ComponentType,
} from "./componentProperties/V2ComponentProperties";
import findMessageBuilderComponentById from "./utils/findMessageBuilderComponentById";
import getMessageBuilderFieldErrors from "./utils/getMessageBuilderFieldErrors";
import getMessageBuilderComponentLabel from "./utils/getMessageBuilderComponentLabel";
import { useUserFeedConnectionContext } from "@/features/feed";
import { FeedDiscordChannelConnection } from "@/types";
import { useMessageBuilderStateContext } from "./state";
import { EMPTY_STATE_PROMPTS } from "./constants/componentChildRules";

const NON_REPOSITIONABLE_COMPONENTS = new Set([
  ComponentType.LegacyEmbedContainer,
  ComponentType.LegacyText,
  ComponentType.LegacyEmbedAuthor,
  ComponentType.LegacyEmbedDescription,
  ComponentType.LegacyEmbedImage,
  ComponentType.LegacyEmbedThumbnail,
  ComponentType.LegacyEmbedTimestamp,
  ComponentType.LegacyEmbedTitle,
  ComponentType.LegacyEmbedFooter,
]);

export const ComponentPropertiesPanel: React.FC<ComponentPropertiesPanelProps> = ({
  selectedComponentId,
  hideTitle,
  onDeleted,
}) => {
  const { deleteComponent, moveComponentUp, moveComponentDown, addChildComponent } =
    useMessageBuilderContext();
  const { messageComponent, errors, dispatch } = useMessageBuilderStateContext();
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const guildId = connection?.details.channel?.guildId || connection?.details.webhook?.guildId;
  const { target: selectedComponent } = findMessageBuilderComponentById(
    messageComponent,
    selectedComponentId,
  );

  const renderComponentDescription = (component: Component) => {
    let description = "";

    // Legacy component descriptions
    if (component.type === ComponentType.LegacyEmbedContainer) {
      description =
        "A container that holds a re-orderable list of embeds for rich message formatting.";
    } else if (component.type === ComponentType.LegacyEmbed) {
      description =
        "A rich embed that can contain various elements like title, description, fields, images, and more.";
    } else if (component.type === ComponentType.LegacyActionRow) {
      description = "A row that holds buttons for user interactions in Discord messages.";
    } else if (component.type === ComponentType.LegacyEmbedField) {
      description = "A field that can display a name and value, with optional inline layout.";
    } else if (component.type === ComponentType.LegacyText) {
      description = "Plain text content that appears above embeds in your message.";
    } else if (component.type === ComponentType.LegacyButton) {
      description = "A clickable button that links to an external URL.";
    }
    // V2 component descriptions
    else if (component.type === ComponentType.V2Container) {
      description =
        "A styled container that groups components together with an optional accent color and spoiler effect.";
    } else if (component.type === ComponentType.V2Section) {
      description =
        "A layout component that displays text content alongside an accessory (thumbnail or button).";
    } else if (component.type === ComponentType.V2ActionRow) {
      description = "A horizontal row that holds up to 5 interactive buttons.";
    } else if (component.type === ComponentType.V2TextDisplay) {
      description = "A text block that supports markdown formatting for rich text content.";
    } else if (component.type === ComponentType.V2Divider) {
      description =
        "A visual separator that creates space between components with an optional line.";
    } else if (component.type === ComponentType.V2Thumbnail) {
      description = "A small image displayed as an accessory within a section.";
    } else if (component.type === ComponentType.V2Button) {
      description = "An interactive button that can link to URLs or trigger actions.";
    } else if (component.type === ComponentType.V2MediaGallery) {
      description = "A gallery component that displays multiple images in a grid layout.";
    } else if (component.type === ComponentType.V2MediaGalleryItem) {
      description = "An individual image item within a media gallery.";
    }

    if (!description) {
      return null;
    }

    return (
      <Box>
        <Text fontSize="sm" color="fg.muted" mb={2}>
          {description}
        </Text>
      </Box>
    );
  };

  const renderPropertiesForComponent = (component: Component, onChange: (value: any) => void) => {
    if (component.type === ComponentType.LegacyRoot) {
      return <LegacyRootProperties />;
    }

    if (component.type === ComponentType.V2Root) {
      return <LegacyRootProperties />;
    }

    if (component.type === ComponentType.LegacyText) {
      return (
        <LegacyTextProperties root={messageComponent} component={component} onChange={onChange} />
      );
    }

    if (isLegacyEmbedFamilyType(component.type)) {
      return (
        <LegacyEmbedFamilyProperties component={component} onChange={onChange} guildId={guildId} />
      );
    }

    if (isV2ComponentType(component.type)) {
      return <V2ComponentProperties component={component} onChange={onChange} guildId={guildId} />;
    }

    if (component.type === ComponentType.LegacyButton) {
      const [labelError, urlError] = getMessageBuilderFieldErrors(
        errors,
        messageComponent,
        component.id,
        ["label", "url"],
      );

      return (
        <VStack align="stretch" gap={6}>
          <InputWithInsertPlaceholder
            value={component.label}
            onChange={(value) => onChange({ ...component, label: value })}
            label="Button Label"
            placeholder="Enter button label"
            error={labelError?.message}
            invalid={!!labelError}
            as="input"
            required
            guildId={guildId}
          />
          {component.style === DiscordButtonStyle.Link && (
            <InputWithInsertPlaceholder
              value={component.url || ""}
              onChange={(value) => onChange({ ...component, url: value })}
              label="Link URL"
              placeholder="https://example.com"
              error={urlError?.message}
              invalid={!!urlError}
              as="input"
              required
              guildId={guildId}
            />
          )}
        </VStack>
      );
    }

    return null;
  };

  const getComponentPosition = (component: Component) => {
    if (!messageComponent) return null;

    const findParentAndIndex = (
      comp: Component,
      targetId: string,
    ): { parent: Component; index: number; total: number } | null => {
      if (comp.children) {
        for (let i = 0; i < comp.children.length; i += 1) {
          const child = comp.children[i];

          if (child.id === targetId) {
            return {
              parent: comp,
              index: i,
              total: comp.children.length,
            };
          }

          const result = findParentAndIndex(child, targetId);
          if (result) return result;
        }
      }

      return null;
    };

    return findParentAndIndex(messageComponent, component.id);
  };

  const countDescendants = (component: Component): number => {
    let count = 0;

    if (component.children) {
      count += component.children.length;

      for (const child of component.children) {
        count += countDescendants(child);
      }
    }

    if (component.type === ComponentType.V2Section && component.accessory) {
      count += 1;
    }

    return count;
  };

  const updateValue = (value: Component) => {
    dispatch({ type: "UPDATE_COMPONENT", componentId: selectedComponentId, component: value });
  };

  const positionInfo = selectedComponent ? getComponentPosition(selectedComponent) : null;
  const canBeRepositioned = selectedComponent
    ? !NON_REPOSITIONABLE_COMPONENTS.has(selectedComponent.type)
    : false;
  const canMoveUp = positionInfo && positionInfo.index > 0;
  const canMoveDown = positionInfo && positionInfo.index < positionInfo.total - 1;

  const isRootComponent = selectedComponent
    ? ROOT_COMPONENT_TYPES.includes(selectedComponent.type)
    : false;

  const descendantCount = selectedComponent ? countDescendants(selectedComponent) : 0;

  if (!selectedComponent) {
    return null;
  }

  return (
    <VStack align="stretch" gap={6} p={4} minWidth={250}>
      {(!hideTitle || !isRootComponent) && (
        <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
          {!hideTitle && (
            <Text fontSize="lg" fontWeight="bold" color="fg" as="h2">
              {getMessageBuilderComponentLabel(selectedComponent.type)} Properties
            </Text>
          )}
          {!isRootComponent &&
            (descendantCount > 0 ? (
              <ConfirmModal
                trigger={
                  <DestructiveActionButton size="sm">
                    <FaTrash />
                    Delete Component
                  </DestructiveActionButton>
                }
                title="Delete Component?"
                description={`This will also delete ${descendantCount} nested component${
                  descendantCount === 1 ? "" : "s"
                }.`}
                colorScheme="red"
                okText="Delete"
                onConfirm={() => {
                  deleteComponent(selectedComponent.id);
                  onDeleted?.();
                }}
              />
            ) : (
              <DestructiveActionButton
                size="sm"
                onClick={() => {
                  deleteComponent(selectedComponent.id);
                  onDeleted?.();
                }}
              >
                <FaTrash />
                Delete Component
              </DestructiveActionButton>
            ))}
        </HStack>
      )}
      {(EMPTY_STATE_PROMPTS[selectedComponent.type] ?? [])
        .filter((prompt) => prompt.isMissing(selectedComponent))
        .map((prompt) => (
          <Alert.Root key={prompt.key} status="info">
            <Alert.Indicator />
            <Box flex="1">
              <Text>{prompt.message}</Text>
              <HStack mt={2} gap={2} flexWrap="wrap">
                {prompt.actions.map((action) => (
                  <PrimaryActionButton
                    key={action.label}
                    size="sm"
                    onClick={() =>
                      addChildComponent(selectedComponent.id, action.type, action.isAccessory)
                    }
                  >
                    {action.label}
                  </PrimaryActionButton>
                ))}
              </HStack>
            </Box>
          </Alert.Root>
        ))}
      {selectedComponent.type === ComponentType.V2Section &&
        selectedComponent.children.length > 3 && (
          <Alert.Root status="error" role={undefined}>
            <Alert.Indicator />
            <Alert.Content>
              Sections can have at most 3 child components. {selectedComponent.children.length - 3}{" "}
              child components must be deleted.
            </Alert.Content>
          </Alert.Root>
        )}
      {selectedComponent.type === ComponentType.V2ActionRow &&
        selectedComponent.children.length > 5 && (
          <Alert.Root status="error" role={undefined}>
            <Alert.Indicator />
            <Alert.Content>
              Action Rows can have at most 5 child components.{" "}
              {selectedComponent.children.length - 5} child components must be deleted.
            </Alert.Content>
          </Alert.Root>
        )}
      {selectedComponent.type === ComponentType.V2MediaGallery &&
        selectedComponent.children.length > 10 && (
          <Alert.Root status="error" role={undefined}>
            <Alert.Indicator />
            <Alert.Content>
              Media Galleries can have at most 10 items. {selectedComponent.children.length - 10}{" "}
              items must be deleted.
            </Alert.Content>
          </Alert.Root>
        )}
      {renderComponentDescription(selectedComponent)}
      {canBeRepositioned && positionInfo && !isRootComponent && (
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Position
          </Text>
          <VStack gap={2}>
            <Box bg="bg.emphasized" p={3} borderRadius="l3" w="full">
              <Text fontSize="sm" color="fg">
                {positionInfo.index + 1} of {positionInfo.total} in {positionInfo.parent.name}
              </Text>
            </Box>
            <HStack gap={2} w="full" flexWrap="wrap">
              <Button
                size="sm"
                aria-disabled={!canMoveUp}
                onClick={() => {
                  if (!canMoveUp) return;
                  moveComponentUp(selectedComponent.id);
                }}
                flex={1}
                minWidth={125}
              >
                <FaChevronUp />
                Move Up
              </Button>
              <Button
                size="sm"
                aria-disabled={!canMoveDown}
                onClick={() => {
                  if (!canMoveDown) return;
                  moveComponentDown(selectedComponent.id);
                }}
                flex={1}
                minWidth={125}
              >
                <FaChevronDown />
                Move Down
              </Button>
            </HStack>
          </VStack>
        </Box>
      )}
      {renderPropertiesForComponent(selectedComponent, updateValue)}
    </VStack>
  );
};
