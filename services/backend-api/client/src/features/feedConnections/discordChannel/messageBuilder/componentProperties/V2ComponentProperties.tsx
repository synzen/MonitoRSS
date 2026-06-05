import React from "react";
import { Button, HStack, IconButton, Text, VStack, Icon } from "@chakra-ui/react";
import { FaXmark } from "react-icons/fa6";
import { SketchPicker } from "react-color";
import { InputWithInsertPlaceholder } from "../components/InputWithInsertPlaceholder";
import { EmojiPicker } from "../components/EmojiPicker";
import { useMessageBuilderStateContext } from "../state";
import getMessageBuilderFieldErrors from "../utils/getMessageBuilderFieldErrors";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import { Component, ComponentType } from "../types";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PopoverRoot, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { NativeSelectRoot, NativeSelectField } from "@/components/ui/native-select";

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
        invalid={!!contentError}
        required
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
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={component.label}
          onChange={(value) => onChange({ ...component, label: value })}
          label="Button Label"
          placeholder="Enter button label"
          error={labelError?.message}
          invalid={!!labelError}
          as="input"
          required={!component.emoji}
          guildId={guildId}
        />
        <Field>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Emoji
          </Text>
          <EmojiPicker
            value={component.emoji}
            onChange={(emoji) => onChange({ ...component, emoji })}
            guildId={guildId}
          />
        </Field>
        <Field invalid={!!styleError} errorText={styleError?.message} required>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Button Style
          </Text>
          <NativeSelectRoot>
            <NativeSelectField
              aria-label="Button Style"
              value={component.style}
              onChange={(e) =>
                onChange({ ...component, style: e.target.value as DiscordButtonStyle })
              }
            >
              <option value={DiscordButtonStyle.Primary}>Primary</option>
              <option value={DiscordButtonStyle.Secondary}>Secondary</option>
              <option value={DiscordButtonStyle.Success}>Success</option>
              <option value={DiscordButtonStyle.Danger}>Danger</option>
              <option value={DiscordButtonStyle.Link}>Link</option>
            </NativeSelectField>
          </NativeSelectRoot>
        </Field>
        {component.style === DiscordButtonStyle.Link && (
          <InputWithInsertPlaceholder
            value={component.href || ""}
            onChange={(value) => onChange({ ...component, href: value })}
            label="Link URL"
            placeholder="https://example.com"
            error={hrefError?.message}
            invalid={!!hrefError}
            as="input"
            guildId={guildId}
          />
        )}
        <Field>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Is Disabled?
          </Text>
          <Switch
            checked={component.disabled}
            onCheckedChange={(e) => onChange({ ...component, disabled: e.checked })}
            colorPalette="brand"
          />
        </Field>
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
      <VStack align="stretch" gap={6}>
        <Field invalid={!!spacingError} errorText={spacingError?.message}>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Spacing
          </Text>
          <NativeSelectRoot>
            <NativeSelectField
              value={component.spacing ?? 1}
              onChange={(e) =>
                onChange({ ...component, spacing: parseInt(e.target.value, 10) as 1 | 2 })
              }
            >
              <option value={1}>Small padding</option>
              <option value={2}>Large padding</option>
            </NativeSelectField>
          </NativeSelectRoot>
        </Field>
        <Field invalid={!!visualError} errorText={visualError?.message}>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Visual Divider
          </Text>
          <Checkbox
            checked={component.visual ?? true}
            onCheckedChange={(e) => onChange({ ...component, visual: e.checked })}
            colorPalette="brand"
          >
            <Text fontSize="sm" color="fg">
              Show visual divider line
            </Text>
          </Checkbox>
        </Field>
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
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={component.mediaUrl || ""}
          onChange={(value) => onChange({ ...component, mediaUrl: value })}
          label="Image URL"
          placeholder="https://example.com/image.png"
          error={mediaUrlError?.message}
          invalid={!!mediaUrlError}
          as="input"
          required
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.description || ""}
          onChange={(value) => onChange({ ...component, description: value })}
          label="Description (Alt Text)"
          placeholder="Description for the thumbnail"
          error={descriptionError?.message}
          invalid={!!descriptionError}
          as="input"
          guildId={guildId}
        />
        <Field helperText="Description is used for accessibility and is displayed when the image cannot be loaded.">
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Spoiler
          </Text>
          <Checkbox
            checked={component.spoiler ?? false}
            onCheckedChange={(e) => onChange({ ...component, spoiler: e.checked })}
            colorPalette="brand"
          >
            <Text fontSize="sm" color="fg">
              Blur image until clicked
            </Text>
          </Checkbox>
        </Field>
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
      <VStack align="stretch" gap={6}>
        <Field
          invalid={!!accentColorError}
          errorText={accentColorError?.message}
          helperText="A colored bar on the left side of the container."
        >
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Accent Color
          </Text>
          <HStack>
            <HStack width="100%">
              <PopoverRoot>
                <PopoverTrigger asChild>
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
                    borderColor="border"
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
                <PopoverContent width="min-content">
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
              </PopoverRoot>
              <IconButton
                size="sm"
                aria-label="Clear accent color"
                disabled={!(component as any).accentColor}
                onClick={() =>
                  onChange({
                    ...component,
                    accentColor: undefined,
                  })
                }
              >
                <Icon as={FaXmark} />
              </IconButton>
            </HStack>
          </HStack>
        </Field>
        <Field>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Spoiler
          </Text>
          <Checkbox
            checked={component.spoiler ?? false}
            onCheckedChange={(e) => onChange({ ...component, spoiler: e.checked })}
            colorPalette="brand"
          >
            <Text fontSize="sm" color="fg">
              Blur container content until clicked
            </Text>
          </Checkbox>
        </Field>
      </VStack>
    );
  }

  if (component.type === ComponentType.V2MediaGallery) {
    return (
      <VStack align="stretch" gap={6}>
        <Text fontSize="sm" color="fg.muted">
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
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={(component as any).mediaUrl || ""}
          onChange={(value) => onChange({ ...component, mediaUrl: value })}
          label="Media URL"
          placeholder="https://example.com/image.png"
          error={mediaUrlError?.message}
          invalid={!!mediaUrlError}
          as="input"
          required
          helperText="Items with empty URLs are removed. If all items are empty, the gallery is omitted."
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={(component as any).description || ""}
          onChange={(value) => onChange({ ...component, description: value })}
          label="Description"
          placeholder="Optional image description"
          error={descriptionError?.message}
          invalid={!!descriptionError}
          as="input"
          guildId={guildId}
        />
        <Field>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Spoiler
          </Text>
          <Checkbox
            checked={(component as any).spoiler ?? false}
            onCheckedChange={(e) => onChange({ ...component, spoiler: e.checked })}
            colorPalette="brand"
          >
            <Text fontSize="sm" color="fg">
              Blur image until clicked
            </Text>
          </Checkbox>
        </Field>
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
