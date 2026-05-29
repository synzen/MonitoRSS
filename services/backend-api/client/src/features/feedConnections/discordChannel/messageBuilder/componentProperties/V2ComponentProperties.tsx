import React from "react";
import {
  Button,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { SketchPicker } from "react-color";
import { InputWithInsertPlaceholder } from "../components/InputWithInsertPlaceholder";
import { EmojiPicker } from "../components/EmojiPicker";
import { useMessageBuilderStateContext } from "../state";
import getMessageBuilderFieldErrors from "../utils/getMessageBuilderFieldErrors";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import { Component, ComponentType } from "../types";

interface Props {
  component: Component;
  onChange: (value: any) => void;
  guildId?: string;
}

export const V2ComponentProperties: React.FC<Props> = ({ component, onChange, guildId }) => {
  const { messageComponent, errors } = useMessageBuilderStateContext();

  if (component.type === ComponentType.V2TextDisplay) {
    const [contentError] = getMessageBuilderFieldErrors(errors, messageComponent, component.id, [
      "content",
    ]);

    return (
      <InputWithInsertPlaceholder
        value={component.content}
        onChange={(value) => onChange({ ...component, content: value })}
        label="Text Content"
        error={contentError?.message}
        isInvalid={!!contentError}
        isRequired
        guildId={guildId}
      />
    );
  }

  if (component.type === ComponentType.V2Button) {
    const [labelError, hrefError, styleError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["label", "href", "style"],
    );

    return (
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={component.label}
          onChange={(value) => onChange({ ...component, label: value })}
          label="Button Label"
          placeholder="Enter button label"
          error={labelError?.message}
          isInvalid={!!labelError}
          as="input"
          isRequired={!component.emoji}
          guildId={guildId}
        />
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Emoji
          </FormLabel>
          <EmojiPicker
            value={component.emoji}
            onChange={(emoji) => onChange({ ...component, emoji })}
            guildId={guildId}
          />
        </FormControl>
        <FormControl isInvalid={!!styleError} isRequired>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Button Style
          </FormLabel>
          <Select
            value={component.style}
            onChange={(e) =>
              onChange({ ...component, style: e.target.value as DiscordButtonStyle })
            }
            bg="gray.700"
          >
            <option value={DiscordButtonStyle.Primary}>Primary</option>
            <option value={DiscordButtonStyle.Secondary}>Secondary</option>
            <option value={DiscordButtonStyle.Success}>Success</option>
            <option value={DiscordButtonStyle.Danger}>Danger</option>
            <option value={DiscordButtonStyle.Link}>Link</option>
          </Select>
          {styleError && <FormErrorMessage>{styleError.message}</FormErrorMessage>}
        </FormControl>
        {component.style === DiscordButtonStyle.Link && (
          <InputWithInsertPlaceholder
            value={component.href || ""}
            onChange={(value) => onChange({ ...component, href: value })}
            label="Link URL"
            placeholder="https://example.com"
            error={hrefError?.message}
            isInvalid={!!hrefError}
            as="input"
            guildId={guildId}
          />
        )}
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Is Disabled?
          </FormLabel>
          <Switch
            isChecked={component.disabled}
            onChange={(e) => onChange({ ...component, disabled: e.target.checked })}
            colorScheme="blue"
          />
        </FormControl>
      </VStack>
    );
  }

  if (component.type === ComponentType.V2Divider) {
    const [spacingError, visualError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["spacing", "visual"],
    );

    return (
      <VStack align="stretch" spacing={6}>
        <FormControl isInvalid={!!spacingError}>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Spacing
          </FormLabel>
          <Select
            value={component.spacing ?? 1}
            onChange={(e) =>
              onChange({ ...component, spacing: parseInt(e.target.value, 10) as 1 | 2 })
            }
            bg="gray.700"
          >
            <option value={1}>Small padding</option>
            <option value={2}>Large padding</option>
          </Select>
          {spacingError && <FormErrorMessage>{spacingError.message}</FormErrorMessage>}
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Visual Divider
          </FormLabel>
          <Checkbox
            isChecked={component.visual ?? true}
            onChange={(e) => onChange({ ...component, visual: e.target.checked })}
            colorScheme="blue"
          >
            <Text fontSize="sm" color="gray.300">
              Show visual divider line
            </Text>
          </Checkbox>
          {visualError && <FormErrorMessage>{visualError.message}</FormErrorMessage>}
        </FormControl>
      </VStack>
    );
  }

  if (component.type === ComponentType.V2Thumbnail) {
    const [mediaUrlError, descriptionError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["mediaUrl", "description"],
    );

    return (
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={component.mediaUrl || ""}
          onChange={(value) => onChange({ ...component, mediaUrl: value })}
          label="Image URL"
          placeholder="https://example.com/image.png"
          error={mediaUrlError?.message}
          isInvalid={!!mediaUrlError}
          as="input"
          isRequired
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.description || ""}
          onChange={(value) => onChange({ ...component, description: value })}
          label="Description (Alt Text)"
          placeholder="Description for the thumbnail"
          error={descriptionError?.message}
          isInvalid={!!descriptionError}
          as="input"
          guildId={guildId}
        />
        <FormControl>
          <FormHelperText color="gray.400" fontSize="xs">
            Description is used for accessibility and is displayed when the image cannot be loaded.
          </FormHelperText>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Spoiler
          </FormLabel>
          <Checkbox
            isChecked={component.spoiler ?? false}
            onChange={(e) => onChange({ ...component, spoiler: e.target.checked })}
            colorScheme="blue"
          >
            <Text fontSize="sm" color="gray.300">
              Blur image until clicked
            </Text>
          </Checkbox>
        </FormControl>
      </VStack>
    );
  }

  if (component.type === ComponentType.V2Container) {
    const [accentColorError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["accentColor"],
    );

    return (
      <VStack align="stretch" spacing={6}>
        <FormControl isInvalid={!!accentColorError}>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Accent Color
          </FormLabel>
          <HStack>
            <HStack width="100%">
              <Popover>
                <PopoverTrigger>
                  <Button
                    backgroundColor={
                      (component as any).accentColor
                        ? `#${Number((component as any).accentColor)
                            .toString(16)
                            .padStart(6, "0")}`
                        : "black"
                    }
                    flex={1}
                    borderStyle="solid"
                    borderWidth="1px"
                    borderColor="whiteAlpha.400"
                    aria-label="Pick accent color"
                    size="sm"
                    _hover={{
                      background: (component as any).accentColor
                        ? `#${Number((component as any).accentColor)
                            .toString(16)
                            .padStart(6, "0")}`
                        : "black",
                      outline: "solid 2px #3182ce",
                      transition: "outline 0.2s",
                    }}
                  />
                </PopoverTrigger>
                <PopoverContent backgroundColor="gray.700" width="min-content">
                  <SketchPicker
                    presetColors={[]}
                    disableAlpha
                    color={
                      (component as any).accentColor
                        ? `#${Number((component as any).accentColor)
                            .toString(16)
                            .padStart(6, "0")}`
                        : "#000000"
                    }
                    onChange={(c) => {
                      const hexColorAsNumber = parseInt(c.hex.replace("#", ""), 16);
                      onChange({
                        ...component,
                        accentColor: hexColorAsNumber,
                      });
                    }}
                  />
                </PopoverContent>
              </Popover>
              <IconButton
                size="sm"
                aria-label="Clear accent color"
                icon={<CloseIcon />}
                isDisabled={!(component as any).accentColor}
                onClick={() =>
                  onChange({
                    ...component,
                    accentColor: undefined,
                  })
                }
              />
            </HStack>
          </HStack>
          <FormHelperText color="gray.400" fontSize="xs">
            A colored bar on the left side of the container.
          </FormHelperText>
          {accentColorError && <FormErrorMessage>{accentColorError.message}</FormErrorMessage>}
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Spoiler
          </FormLabel>
          <Checkbox
            isChecked={component.spoiler ?? false}
            onChange={(e) => onChange({ ...component, spoiler: e.target.checked })}
            colorScheme="blue"
          >
            <Text fontSize="sm" color="gray.300">
              Blur container content until clicked
            </Text>
          </Checkbox>
        </FormControl>
      </VStack>
    );
  }

  if (component.type === ComponentType.V2MediaGallery) {
    return (
      <VStack align="stretch" spacing={6}>
        <Text fontSize="sm" color="gray.400">
          Add gallery items as children using the + button in the component tree. Each item can
          display an image with an optional description.
        </Text>
      </VStack>
    );
  }

  if (component.type === ComponentType.V2MediaGalleryItem) {
    const [mediaUrlError, descriptionError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["mediaUrl", "description"],
    );

    return (
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={(component as any).mediaUrl || ""}
          onChange={(value) => onChange({ ...component, mediaUrl: value })}
          label="Media URL"
          placeholder="https://example.com/image.png"
          error={mediaUrlError?.message}
          isInvalid={!!mediaUrlError}
          as="input"
          isRequired
          helperText="Items with empty URLs are removed. If all items are empty, the gallery is omitted."
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={(component as any).description || ""}
          onChange={(value) => onChange({ ...component, description: value })}
          label="Description"
          placeholder="Optional image description"
          error={descriptionError?.message}
          isInvalid={!!descriptionError}
          as="input"
          guildId={guildId}
        />
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Spoiler
          </FormLabel>
          <Checkbox
            isChecked={(component as any).spoiler ?? false}
            onChange={(e) => onChange({ ...component, spoiler: e.target.checked })}
            colorScheme="blue"
          >
            <Text fontSize="sm" color="gray.300">
              Blur image until clicked
            </Text>
          </Checkbox>
        </FormControl>
      </VStack>
    );
  }

  return null;
};

export const isV2ComponentType = (type: ComponentType): boolean => {
  return (
    type === ComponentType.V2TextDisplay ||
    type === ComponentType.V2Button ||
    type === ComponentType.V2Divider ||
    type === ComponentType.V2Thumbnail ||
    type === ComponentType.V2Container ||
    type === ComponentType.V2MediaGallery ||
    type === ComponentType.V2MediaGalleryItem
  );
};
