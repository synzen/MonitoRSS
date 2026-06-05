import React from "react";
import { Button, HStack, IconButton, Stack, Text, VStack, Icon } from "@chakra-ui/react";
import { FaXmark } from "react-icons/fa6";
import { SketchPicker } from "react-color";
import { Field } from "@/components/ui/field";
import { PopoverRoot, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Radio, RadioGroup } from "@/components/ui/radio";
import { Switch } from "@/components/ui/switch";
import { InputWithInsertPlaceholder } from "../components/InputWithInsertPlaceholder";
import { useMessageBuilderStateContext } from "../state";
import getMessageBuilderFieldErrors from "../utils/getMessageBuilderFieldErrors";
import { Component, ComponentType, LegacyEmbedComponent } from "../types";

interface Props {
  component: Component;
  onChange: (value: any) => void;
  guildId?: string;
}

/**
 * Renders the properties panel for any LegacyEmbed* component type.
 * The container component (LegacyEmbed) renders a color picker; the others render
 * their text/URL fields with placeholder insertion. Returns null for non-embed types.
 *
 * Extracted from ComponentPropertiesPanel.tsx in Phase 6 (audit §8).
 */
export const LegacyEmbedFamilyProperties: React.FC<Props> = ({ component, onChange, guildId }) => {
  const { messageComponent, errors } = useMessageBuilderStateContext();

  if (component.type === ComponentType.LegacyEmbed) {
    const [colorError] = getMessageBuilderFieldErrors(errors, messageComponent, component.id, [
      "color",
    ]);

    return (
      <VStack align="stretch" gap={6}>
        <Field invalid={!!colorError} errorText={colorError?.message}>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Embed Color
          </Text>
          <HStack>
            <HStack width="100%">
              <PopoverRoot>
                <PopoverTrigger asChild>
                  <Button
                    backgroundColor={
                      (component as any).color
                        ? `#${Number((component as any).color)
                            .toString(16)
                            .padStart(6, "0")}`
                        : "black"
                    }
                    flex={1}
                    borderStyle="solid"
                    borderWidth="1px"
                    borderColor="border"
                    aria-label="Pick color"
                    size="sm"
                    _hover={{
                      background: (component as any).color
                        ? `#${Number((component as any).color)
                            .toString(16)
                            .padStart(6, "0")}`
                        : "black",
                      outline: "solid 2px #3182ce",
                      transition: "outline 0.2s",
                    }}
                  />
                </PopoverTrigger>
                <PopoverContent bg="bg.subtle" width="min-content">
                  <SketchPicker
                    presetColors={[]}
                    disableAlpha
                    color={
                      (component as LegacyEmbedComponent).color
                        ? `#${Number((component as LegacyEmbedComponent).color)
                            .toString(16)
                            .padStart(6, "0")}`
                        : "#000000"
                    }
                    onChange={(c) => {
                      const hexColorAsNumberString = parseInt(
                        c.hex.replace("#", ""),
                        16,
                      ).toString();
                      onChange({
                        ...component,
                        color: hexColorAsNumberString,
                      });
                    }}
                  />
                </PopoverContent>
              </PopoverRoot>
              <IconButton
                size="sm"
                aria-label="Clear color"
                disabled={!(component as any).color}
                onClick={() =>
                  onChange({
                    ...component,
                    color: undefined,
                  })
                }
              >
                <Icon as={FaXmark} />
              </IconButton>
            </HStack>
          </HStack>
        </Field>
      </VStack>
    );
  }

  if (component.type === ComponentType.LegacyEmbedAuthor) {
    const [nameError, urlError, iconUrlError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["authorName", "authorUrl", "authorIconUrl"],
    );

    return (
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={component.authorName || ""}
          onChange={(value) => onChange({ ...component, authorName: value })}
          label="Name"
          placeholder="Name"
          error={nameError?.message}
          invalid={!!nameError}
          as="input"
          required
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.authorUrl || ""}
          onChange={(value) => onChange({ ...component, authorUrl: value })}
          label="URL"
          placeholder="https://example.com"
          error={urlError?.message}
          invalid={!!urlError}
          as="input"
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.authorIconUrl || ""}
          onChange={(value) => onChange({ ...component, authorIconUrl: value })}
          label="Icon URL"
          placeholder="https://example.com/icon.png"
          error={iconUrlError?.message}
          invalid={!!iconUrlError}
          as="input"
          guildId={guildId}
        />
      </VStack>
    );
  }

  if (component.type === ComponentType.LegacyEmbedTitle) {
    const [titleError, titleUrlError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["title", "titleUrl"],
    );

    return (
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={component.title || ""}
          onChange={(value) => onChange({ ...component, title: value })}
          label="Text"
          placeholder="Embed title"
          error={titleError?.message}
          invalid={!!titleError}
          as="input"
          required
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.titleUrl || ""}
          onChange={(value) => onChange({ ...component, titleUrl: value })}
          label="URL"
          placeholder="https://example.com"
          error={titleUrlError?.message}
          invalid={!!titleUrlError}
          as="input"
          guildId={guildId}
        />
      </VStack>
    );
  }

  if (component.type === ComponentType.LegacyEmbedDescription) {
    const [descriptionError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["description"],
    );

    return (
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={component.description || ""}
          onChange={(value) => onChange({ ...component, description: value })}
          label="Description"
          placeholder="Embed description"
          error={descriptionError?.message}
          invalid={!!descriptionError}
          as="textarea"
          rows={3}
          required
          guildId={guildId}
        />
      </VStack>
    );
  }

  if (component.type === ComponentType.LegacyEmbedImage) {
    const [imageUrlError] = getMessageBuilderFieldErrors(errors, messageComponent, component.id, [
      "imageUrl",
    ]);

    return (
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={component.imageUrl || ""}
          onChange={(value) => onChange({ ...component, imageUrl: value })}
          label="Image URL"
          placeholder="https://example.com/image.png"
          error={imageUrlError?.message}
          invalid={!!imageUrlError}
          as="input"
          required
          guildId={guildId}
        />
      </VStack>
    );
  }

  if (component.type === ComponentType.LegacyEmbedThumbnail) {
    const [thumbnailUrlError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["thumbnailUrl"],
    );

    return (
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={component.thumbnailUrl || ""}
          onChange={(value) => onChange({ ...component, thumbnailUrl: value })}
          label="Image URL"
          placeholder="https://example.com/thumbnail.png"
          error={thumbnailUrlError?.message}
          invalid={!!thumbnailUrlError}
          as="input"
          required
          guildId={guildId}
        />
      </VStack>
    );
  }

  if (component.type === ComponentType.LegacyEmbedFooter) {
    const [footerTextError, footerIconUrlError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["footerText", "footerIconUrl"],
    );

    return (
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={component.footerText || ""}
          onChange={(value) => onChange({ ...component, footerText: value })}
          label="Text"
          placeholder="Footer text"
          error={footerTextError?.message}
          invalid={!!footerTextError}
          as="input"
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.footerIconUrl || ""}
          onChange={(value) => onChange({ ...component, footerIconUrl: value })}
          label="Icon URL"
          placeholder="https://example.com/icon.png"
          error={footerIconUrlError?.message}
          invalid={!!footerIconUrlError}
          as="input"
          guildId={guildId}
        />
      </VStack>
    );
  }

  if (component.type === ComponentType.LegacyEmbedField) {
    const [fieldNameError, fieldValueError] = getMessageBuilderFieldErrors(
      errors,
      messageComponent,
      component.id,
      ["fieldName", "fieldValue"],
    );

    return (
      <VStack align="stretch" gap={6}>
        <InputWithInsertPlaceholder
          value={component.fieldName}
          onChange={(value) => onChange({ ...component, fieldName: value })}
          label="Field Name"
          placeholder="Field name"
          error={fieldNameError?.message}
          invalid={!!fieldNameError}
          as="input"
          required
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.fieldValue}
          onChange={(value) => onChange({ ...component, fieldValue: value })}
          label="Field Value"
          placeholder="Field value"
          error={fieldValueError?.message}
          invalid={!!fieldValueError}
          as="textarea"
          rows={2}
          required
          guildId={guildId}
        />
        <Field>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg">
            Inline Field
          </Text>
          <Switch
            inputProps={{ "aria-label": "Inline Field" }}
            checked={component.inline || false}
            onCheckedChange={(e) => onChange({ ...component, inline: e.checked })}
            colorPalette="brand"
          />
          <Text fontSize="sm" color="fg.muted" mt={2}>
            This will affect the layout of the fields to be either horizontal or vertical depending
            on how many fields are set to be inline.
          </Text>
        </Field>
      </VStack>
    );
  }

  if (component.type === ComponentType.LegacyEmbedTimestamp) {
    const [timestampError] = getMessageBuilderFieldErrors(errors, messageComponent, component.id, [
      "timestamp",
    ]);

    return (
      <VStack align="stretch" gap={6}>
        <Field invalid={!!timestampError} errorText={timestampError?.message}>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="fg" id="timestamp-label">
            Timestamp Value
          </Text>
          <RadioGroup
            value={component.timestamp || ""}
            onValueChange={(details) => onChange({ ...component, timestamp: details.value })}
            aria-labelledby="timestamp-label"
          >
            <Stack>
              <Radio value="">
                None
                <br />
                <Text fontSize="xs" color="fg.muted" margin="0">
                  No timestamp will be displayed.
                </Text>
              </Radio>
              <Radio value="article">
                Article
                <br />
                <Text fontSize="xs" color="fg.muted" margin="0">
                  Use the article&apos;s published date.
                </Text>
              </Radio>
              <Radio value="now">
                Now
                <br />
                <Text fontSize="xs" color="fg.muted" margin="0">
                  Use the current date and time of when the article is delivered. Useful if article
                  has no published date.
                </Text>
              </Radio>
            </Stack>
          </RadioGroup>
        </Field>
      </VStack>
    );
  }

  return null;
};

/** Type guard — returns true if the component should be rendered by LegacyEmbedFamilyProperties. */
export const isLegacyEmbedFamilyType = (type: ComponentType): boolean => {
  return (
    type === ComponentType.LegacyEmbed ||
    type === ComponentType.LegacyEmbedAuthor ||
    type === ComponentType.LegacyEmbedTitle ||
    type === ComponentType.LegacyEmbedDescription ||
    type === ComponentType.LegacyEmbedImage ||
    type === ComponentType.LegacyEmbedThumbnail ||
    type === ComponentType.LegacyEmbedFooter ||
    type === ComponentType.LegacyEmbedField ||
    type === ComponentType.LegacyEmbedTimestamp
  );
};
