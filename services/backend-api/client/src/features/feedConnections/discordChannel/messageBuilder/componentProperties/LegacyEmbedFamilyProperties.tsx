import React from "react";
import {
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { SketchPicker } from "react-color";
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
      <VStack align="stretch" spacing={6}>
        <FormControl isInvalid={!!colorError}>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Embed Color
          </FormLabel>
          <HStack>
            <HStack width="100%">
              <Popover>
                <PopoverTrigger>
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
                    borderColor="whiteAlpha.400"
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
                <PopoverContent backgroundColor="gray.700" width="min-content">
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
              </Popover>
              <IconButton
                size="sm"
                aria-label="Clear color"
                icon={<CloseIcon />}
                isDisabled={!(component as any).color}
                onClick={() =>
                  onChange({
                    ...component,
                    color: undefined,
                  })
                }
              />
            </HStack>
          </HStack>
          {colorError && <FormErrorMessage>{colorError.message}</FormErrorMessage>}
        </FormControl>
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
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={component.authorName || ""}
          onChange={(value) => onChange({ ...component, authorName: value })}
          label="Name"
          placeholder="Name"
          error={nameError?.message}
          isInvalid={!!nameError}
          as="input"
          isRequired
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.authorUrl || ""}
          onChange={(value) => onChange({ ...component, authorUrl: value })}
          label="URL"
          placeholder="https://example.com"
          error={urlError?.message}
          isInvalid={!!urlError}
          as="input"
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.authorIconUrl || ""}
          onChange={(value) => onChange({ ...component, authorIconUrl: value })}
          label="Icon URL"
          placeholder="https://example.com/icon.png"
          error={iconUrlError?.message}
          isInvalid={!!iconUrlError}
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
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={component.title || ""}
          onChange={(value) => onChange({ ...component, title: value })}
          label="Text"
          placeholder="Embed title"
          error={titleError?.message}
          isInvalid={!!titleError}
          as="input"
          isRequired
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.titleUrl || ""}
          onChange={(value) => onChange({ ...component, titleUrl: value })}
          label="URL"
          placeholder="https://example.com"
          error={titleUrlError?.message}
          isInvalid={!!titleUrlError}
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
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={component.description || ""}
          onChange={(value) => onChange({ ...component, description: value })}
          label="Description"
          placeholder="Embed description"
          error={descriptionError?.message}
          isInvalid={!!descriptionError}
          as="textarea"
          rows={3}
          isRequired
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
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={component.imageUrl || ""}
          onChange={(value) => onChange({ ...component, imageUrl: value })}
          label="Image URL"
          placeholder="https://example.com/image.png"
          error={imageUrlError?.message}
          isInvalid={!!imageUrlError}
          as="input"
          isRequired
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
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={component.thumbnailUrl || ""}
          onChange={(value) => onChange({ ...component, thumbnailUrl: value })}
          label="Image URL"
          placeholder="https://example.com/thumbnail.png"
          error={thumbnailUrlError?.message}
          isInvalid={!!thumbnailUrlError}
          as="input"
          isRequired
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
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={component.footerText || ""}
          onChange={(value) => onChange({ ...component, footerText: value })}
          label="Text"
          placeholder="Footer text"
          error={footerTextError?.message}
          isInvalid={!!footerTextError}
          as="input"
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.footerIconUrl || ""}
          onChange={(value) => onChange({ ...component, footerIconUrl: value })}
          label="Icon URL"
          placeholder="https://example.com/icon.png"
          error={footerIconUrlError?.message}
          isInvalid={!!footerIconUrlError}
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
      <VStack align="stretch" spacing={6}>
        <InputWithInsertPlaceholder
          value={component.fieldName}
          onChange={(value) => onChange({ ...component, fieldName: value })}
          label="Field Name"
          placeholder="Field name"
          error={fieldNameError?.message}
          isInvalid={!!fieldNameError}
          as="input"
          isRequired
          guildId={guildId}
        />
        <InputWithInsertPlaceholder
          value={component.fieldValue}
          onChange={(value) => onChange({ ...component, fieldValue: value })}
          label="Field Value"
          placeholder="Field value"
          error={fieldValueError?.message}
          isInvalid={!!fieldValueError}
          as="textarea"
          rows={2}
          isRequired
          guildId={guildId}
        />
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Inline Field
          </FormLabel>
          <Switch
            isChecked={component.inline || false}
            onChange={(e) => onChange({ ...component, inline: e.target.checked })}
            colorScheme="blue"
          />
          <FormHelperText>
            This will affect the layout of the fields to be either horizontal or vertical depending
            on how many fields are set to be inline.
          </FormHelperText>
        </FormControl>
      </VStack>
    );
  }

  if (component.type === ComponentType.LegacyEmbedTimestamp) {
    const [timestampError] = getMessageBuilderFieldErrors(errors, messageComponent, component.id, [
      "timestamp",
    ]);

    return (
      <VStack align="stretch" spacing={6}>
        <FormControl isInvalid={!!timestampError}>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200" id="timestamp-label">
            Timestamp Value
          </FormLabel>
          <RadioGroup
            value={component.timestamp || ""}
            onChange={(value) => onChange({ ...component, timestamp: value })}
            aria-labelledby="timestamp-label"
          >
            <Stack>
              <Radio value="">
                None
                <br />
                <Text fontSize="xs" color="gray.400" margin="0">
                  No timestamp will be displayed.
                </Text>
              </Radio>
              <Radio value="article">
                Article
                <br />
                <Text fontSize="xs" color="gray.400" margin="0">
                  Use the article&apos;s published date.
                </Text>
              </Radio>
              <Radio value="now">
                Now
                <br />
                <Text fontSize="xs" color="gray.400" margin="0">
                  Use the current date and time of when the article is delivered. Useful if article
                  has no published date.
                </Text>
              </Radio>
            </Stack>
          </RadioGroup>
          {timestampError && <FormErrorMessage>{timestampError.message}</FormErrorMessage>}
        </FormControl>
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
