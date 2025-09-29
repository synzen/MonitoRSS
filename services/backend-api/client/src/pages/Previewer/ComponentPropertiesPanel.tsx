import React from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Select,
  Checkbox,
  FormControl,
  FormErrorMessage,
  Alert,
  AlertIcon,
  FormLabel,
  Switch,
  Radio,
  RadioGroup,
  Stack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  IconButton,
} from "@chakra-ui/react";
import { DeleteIcon, ChevronUpIcon, ChevronDownIcon, CloseIcon } from "@chakra-ui/icons";
import { SketchPicker } from "react-color";
import { useFormContext } from "react-hook-form";
import type { Component, ComponentPropertiesPanelProps, LegacyEmbedComponent } from "./types";
import { ComponentType, ROOT_COMPONENT_TYPES } from "./types";
import { InputWithInsertPlaceholder } from "../../components/InputWithInsertPlaceholder";

import { usePreviewerContext } from "./PreviewerContext";
import { DiscordButtonStyle } from "./constants/DiscordButtonStyle";
import PreviewerFormState from "./types/PreviewerFormState";
import { LegacyRootProperties } from "./componentProperties/LegacyRootProperties";
import { LegacyTextProperties } from "./componentProperties/LegacyTextProperties";
import findPreviewerComponentById from "./utils/findPreviewerComponentById";
import getPreviewerComponentFormPathsById from "./utils/getPreviewerComponentFormPathsById";
import getPreviewerFieldErrors from "./utils/getPreviewerFieldErrors";
import getPreviewerComponentLabel from "./utils/getPreviewerComponentLabel";

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
  const { deleteComponent, moveComponentUp, moveComponentDown } = usePreviewerContext();
  const { watch, formState, setValue } = useFormContext<PreviewerFormState>();
  const messageComponent = watch("messageComponent");
  const { target: selectedComponent } = findPreviewerComponentById(
    messageComponent,
    selectedComponentId
  );

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

    if (component.type === ComponentType.LegacyEmbed) {
      const [colorError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["color"]
      );

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
                          16
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
      const [nameError, urlError, iconUrlError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["authorName", "authorUrl", "authorIconUrl"]
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
          />
          <InputWithInsertPlaceholder
            value={component.authorUrl || ""}
            onChange={(value) => onChange({ ...component, authorUrl: value })}
            label="URL"
            placeholder="https://example.com"
            error={urlError?.message}
            isInvalid={!!urlError}
            as="input"
          />
          <InputWithInsertPlaceholder
            value={component.authorIconUrl || ""}
            onChange={(value) => onChange({ ...component, authorIconUrl: value })}
            label="Icon URL"
            placeholder="https://example.com/icon.png"
            error={iconUrlError?.message}
            isInvalid={!!iconUrlError}
            as="input"
          />
        </VStack>
      );
    }

    if (component.type === ComponentType.LegacyEmbedTitle) {
      const [titleError, titleUrlError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["title", "titleUrl"]
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
          />
          <InputWithInsertPlaceholder
            value={component.titleUrl || ""}
            onChange={(value) => onChange({ ...component, titleUrl: value })}
            label="URL"
            placeholder="https://example.com"
            error={titleUrlError?.message}
            isInvalid={!!titleUrlError}
            as="input"
          />
        </VStack>
      );
    }

    if (component.type === ComponentType.LegacyEmbedDescription) {
      const [descriptionError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["description"]
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
          />
        </VStack>
      );
    }

    if (component.type === ComponentType.LegacyEmbedImage) {
      const [imageUrlError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["imageUrl"]
      );

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
          />
        </VStack>
      );
    }

    if (component.type === ComponentType.LegacyEmbedThumbnail) {
      const [thumbnailUrlError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["thumbnailUrl"]
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
          />
        </VStack>
      );
    }

    if (component.type === ComponentType.LegacyEmbedFooter) {
      const [footerTextError, footerIconUrlError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["footerText", "footerIconUrl"]
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
          />
          <InputWithInsertPlaceholder
            value={component.footerIconUrl || ""}
            onChange={(value) => onChange({ ...component, footerIconUrl: value })}
            label="Icon URL"
            placeholder="https://example.com/icon.png"
            error={footerIconUrlError?.message}
            isInvalid={!!footerIconUrlError}
            as="input"
          />
        </VStack>
      );
    }

    if (component.type === ComponentType.LegacyEmbedField) {
      const [fieldNameError, fieldValueError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["fieldName", "fieldValue"]
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
          </FormControl>
        </VStack>
      );
    }

    if (component.type === ComponentType.LegacyEmbedTimestamp) {
      const [timestampError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["timestamp"]
      );

      return (
        <VStack align="stretch" spacing={6}>
          <FormControl isInvalid={!!timestampError}>
            <FormLabel
              fontSize="sm"
              fontWeight="medium"
              mb={2}
              color="gray.200"
              id="timestamp-label"
            >
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
                    Use the current date and time of when the article is delivered. Useful if
                    article has no published date.
                  </Text>
                </Radio>
              </Stack>
            </RadioGroup>
            {timestampError && <FormErrorMessage>{timestampError.message}</FormErrorMessage>}
          </FormControl>
        </VStack>
      );
    }

    if (component.type === ComponentType.V2TextDisplay) {
      const [contentError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["content"]
      );

      return (
        <InputWithInsertPlaceholder
          value={component.content}
          onChange={(value) => onChange({ ...component, content: value })}
          label="Text Content"
          error={contentError?.message}
          isInvalid={!!contentError}
          isRequired
        />
      );
    }

    if (component.type === ComponentType.V2Button) {
      const [labelError, hrefError, styleError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["label", "href", "style"]
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
            isRequired
          />
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
      const [spacingError, visualError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["spacing", "visual"]
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

    if (component.type === ComponentType.LegacyButton) {
      const [labelError, urlError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["label", "url"]
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
            isRequired
          />
          {component.style === DiscordButtonStyle.Link && (
            <InputWithInsertPlaceholder
              value={component.url || ""}
              onChange={(value) => onChange({ ...component, url: value })}
              label="Link URL"
              placeholder="https://example.com"
              error={urlError?.message}
              isInvalid={!!urlError}
              as="input"
              isRequired
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

    return null;
  };

  const getComponentPosition = (component: Component) => {
    if (!messageComponent) return null;

    const findParentAndIndex = (
      comp: Component,
      targetId: string
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

  const formPath = messageComponent
    ? getPreviewerComponentFormPathsById(messageComponent, selectedComponentId)
    : null;

  const updateValue = (value: Component) => {
    setValue(formPath as any, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
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

  if (!selectedComponent) {
    return null;
  }

  return (
    <VStack align="stretch" spacing={6} p={4} minWidth={250}>
      {(!hideTitle || !isRootComponent) && (
        <HStack justify="space-between" align="center" flexWrap="wrap" spacing={6}>
          {!hideTitle && (
            <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
              {getPreviewerComponentLabel(selectedComponent.type)} Properties
            </Text>
          )}
          {!isRootComponent && (
            <Button
              size="sm"
              colorScheme="red"
              variant="outline"
              leftIcon={<DeleteIcon />}
              onClick={() => {
                deleteComponent(selectedComponent.id);
                onDeleted?.();
              }}
            >
              Delete Component
            </Button>
          )}
        </HStack>
      )}
      {(selectedComponent.type === ComponentType.LegacyActionRow ||
        selectedComponent.type === ComponentType.V2ActionRow) &&
        selectedComponent.children.length === 0 && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            At least one child component is required for Action Rows.
          </Alert>
        )}
      {selectedComponent.type === ComponentType.V2Section &&
        selectedComponent.children.length === 0 && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            At least one child component is required for Sections.
          </Alert>
        )}
      {selectedComponent.type === ComponentType.V2Section && selectedComponent.children.length > 3 && (
        <Alert status="error" borderRadius="md" role={undefined}>
          <AlertIcon />
          Sections can have at most 3 child components. {selectedComponent.children.length - 3}{" "}
          child components must be deleted.
        </Alert>
      )}
      {selectedComponent.type === ComponentType.V2Section && !selectedComponent.accessory && (
        <Alert status="error" borderRadius="md" role={undefined}>
          <AlertIcon />
          An accessory component is required for Sections.
        </Alert>
      )}
      {selectedComponent.type === ComponentType.V2ActionRow &&
        selectedComponent.children.length > 5 && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            Action Rows can have at most 5 child components. {selectedComponent.children.length -
              5}{" "}
            child components must be deleted.
          </Alert>
        )}
      {canBeRepositioned && positionInfo && !isRootComponent && (
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Position
          </Text>
          <VStack spacing={2}>
            <Box bg="gray.700" p={3} borderRadius="md" w="full">
              <Text fontSize="sm" color="white">
                {positionInfo.index + 1} of {positionInfo.total} in {positionInfo.parent.name}
              </Text>
            </Box>
            <HStack spacing={2} w="full" flexWrap="wrap">
              <Button
                size="sm"
                leftIcon={<ChevronUpIcon />}
                aria-disabled={!canMoveUp}
                onClick={() => {
                  if (!canMoveUp) return;
                  moveComponentUp(selectedComponent.id);
                }}
                variant="outline"
                colorScheme="blue"
                flex={1}
                minWidth={125}
              >
                Move Up
              </Button>
              <Button
                size="sm"
                leftIcon={<ChevronDownIcon />}
                aria-disabled={!canMoveDown}
                onClick={() => {
                  if (!canMoveDown) return;
                  moveComponentDown(selectedComponent.id);
                }}
                variant="outline"
                colorScheme="blue"
                flex={1}
                minWidth={125}
              >
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
