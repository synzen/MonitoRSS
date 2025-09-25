import React from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  FormControl,
  FormErrorMessage,
  Alert,
  AlertIcon,
  FormLabel,
  Switch,
  useDisclosure,
  Radio,
  RadioGroup,
  Stack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  IconButton,
} from "@chakra-ui/react";
import { DeleteIcon, ChevronUpIcon, ChevronDownIcon, AddIcon, CloseIcon } from "@chakra-ui/icons";
import { SketchPicker } from "react-color";
import { FieldError, useFormContext } from "react-hook-form";
import type { Component, ComponentPropertiesPanelProps } from "./types";
import { ComponentType, ROOT_COMPONENT_TYPES } from "./types";
import { InsertPlaceholderDialog } from "./InsertPlaceholderDialog";

import { usePreviewerContext } from "./PreviewerContext";
import { DiscordButtonStyle } from "./constants/DiscordButtonStyle";
import PreviewerFormState from "./types/PreviewerFormState";
import { LegacyRootProperties } from "./componentProperties/LegacyRootProperties";
import { LegacyTextProperties } from "./componentProperties/LegacyTextProperties";
import findPreviewerComponentById from "./utils/findPreviewerComponentById";
import getPreviewerComponentFormPathsById from "./utils/getPreviewerComponentFormPathsById";
import getPreviewerFieldErrors from "./utils/getPreviewerFieldErrors";

// Mock article data - in a real app this would come from props or context
const getCurrentArticle = () => ({
  title: "Breaking: New JavaScript Framework Released",
  description:
    "A revolutionary new framework promises to change how we build web applications forever.A revolutionary new framework promises to change how we build web applications forever.A revolutionary new framework promises to change how we build web applications forever.A revolutionary new framework promises to change how we build web applications forever.A revolutionary new framework promises to change how we build web applications forever.A revolutionary new framework promises to change how we build web applications forever.A revolutionary new framework promises to change how we build web applications forever.",
  url: "https://example.com/article1",
  author: "Jane Developer",
  publishedAt: "2024-01-15T10:30:00Z",
  feedTitle: "Tech News Daily",
});

export const ComponentPropertiesPanel: React.FC<ComponentPropertiesPanelProps> = ({
  selectedComponentId,
  hideTitle,
}) => {
  const { deleteComponent, moveComponentUp, moveComponentDown } = usePreviewerContext();
  const { watch, formState, setValue } = useFormContext<PreviewerFormState>();
  const messageComponent = watch("messageComponent");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const getFieldError = (componentId: string, fieldName: string): FieldError | undefined => {
    if (!messageComponent) return undefined;

    const getNestedError = (obj: any, path: string) => {
      return path.split(".").reduce((current, key) => {
        return current && current[key];
      }, obj);
    };

    interface StackItem {
      component: Component;
      path: string;
    }

    const stack: StackItem[] = [{ component: messageComponent, path: "messageComponent" }];

    while (stack.length > 0) {
      const { component, path } = stack.pop()!;

      if (component.id === componentId) {
        const errorPath = `${path}.${fieldName}`;
        const error = getNestedError(formState.errors, errorPath);

        return error;
      }

      if (component.children) {
        for (let i = component.children.length - 1; i >= 0; i -= 1) {
          stack.push({
            component: component.children[i],
            path: `${path}.children.${i}`,
          });
        }
      }

      if (component.type === ComponentType.V2Section && component.accessory) {
        stack.push({
          component: component.accessory,
          path: `${path}.accessory`,
        });
      }
    }

    return undefined;
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
        <LegacyTextProperties
          component={component}
          onChange={onChange}
          onOpenPlaceholderDialog={onOpen}
          getFieldError={getFieldError}
        />
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
                        (component as any).color
                          ? `#${Number((component as any).color)
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
          <FormControl isInvalid={!!nameError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Name
            </FormLabel>
            <Input
              value={component.authorName || ""}
              onChange={(e) => onChange({ ...component, authorName: e.target.value })}
              placeholder="Name"
              bg="gray.700"
            />
            {nameError && <FormErrorMessage>{nameError.message}</FormErrorMessage>}
          </FormControl>
          <FormControl isInvalid={!!urlError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              URL
            </FormLabel>
            <Input
              value={component.authorUrl || ""}
              onChange={(e) => onChange({ ...component, authorUrl: e.target.value })}
              placeholder="https://example.com"
              bg="gray.700"
            />
            {urlError && <FormErrorMessage>{urlError.message}</FormErrorMessage>}
          </FormControl>
          <FormControl isInvalid={!!iconUrlError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Icon URL
            </FormLabel>
            <Input
              value={component.authorIconUrl || ""}
              onChange={(e) => onChange({ ...component, authorIconUrl: e.target.value })}
              placeholder="https://example.com/icon.png"
              bg="gray.700"
            />
            {iconUrlError && <FormErrorMessage>{iconUrlError.message}</FormErrorMessage>}
          </FormControl>
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
          <FormControl isInvalid={!!titleError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Text
            </FormLabel>
            <Input
              value={component.title || ""}
              onChange={(e) => onChange({ ...component, title: e.target.value })}
              placeholder="Embed title"
              bg="gray.700"
            />
            {titleError && <FormErrorMessage>{titleError.message}</FormErrorMessage>}
          </FormControl>
          <FormControl isInvalid={!!titleUrlError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              URL
            </FormLabel>
            <Input
              value={component.titleUrl || ""}
              onChange={(e) => onChange({ ...component, titleUrl: e.target.value })}
              placeholder="https://example.com"
              bg="gray.700"
            />
            {titleUrlError && <FormErrorMessage>{titleUrlError.message}</FormErrorMessage>}
          </FormControl>
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
          <FormControl isInvalid={!!descriptionError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Description
            </FormLabel>
            <Textarea
              value={component.description || ""}
              onChange={(e) => onChange({ ...component, description: e.target.value })}
              placeholder="Embed description"
              rows={3}
              bg="gray.700"
              color="white"
            />
            {descriptionError && <FormErrorMessage>{descriptionError.message}</FormErrorMessage>}
          </FormControl>
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
          <FormControl isInvalid={!!imageUrlError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              URL
            </FormLabel>
            <Input
              value={component.imageUrl || ""}
              onChange={(e) => onChange({ ...component, imageUrl: e.target.value })}
              placeholder="https://example.com/image.png"
              bg="gray.700"
            />
            {imageUrlError && <FormErrorMessage>{imageUrlError.message}</FormErrorMessage>}
          </FormControl>
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
          <FormControl isInvalid={!!thumbnailUrlError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              URL
            </FormLabel>
            <Input
              value={component.thumbnailUrl || ""}
              onChange={(e) => onChange({ ...component, thumbnailUrl: e.target.value })}
              placeholder="https://example.com/thumbnail.png"
              bg="gray.700"
            />
            {thumbnailUrlError && <FormErrorMessage>{thumbnailUrlError.message}</FormErrorMessage>}
          </FormControl>
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
          <FormControl isInvalid={!!footerTextError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Text
            </FormLabel>
            <Input
              value={component.footerText || ""}
              onChange={(e) => onChange({ ...component, footerText: e.target.value })}
              placeholder="Footer text"
              bg="gray.700"
            />
            {footerTextError && <FormErrorMessage>{footerTextError.message}</FormErrorMessage>}
          </FormControl>
          <FormControl isInvalid={!!footerIconUrlError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Icon URL
            </FormLabel>
            <Input
              value={component.footerIconUrl || ""}
              onChange={(e) => onChange({ ...component, footerIconUrl: e.target.value })}
              placeholder="https://example.com/icon.png"
              bg="gray.700"
            />
            {footerIconUrlError && (
              <FormErrorMessage>{footerIconUrlError.message}</FormErrorMessage>
            )}
          </FormControl>
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
          <FormControl isInvalid={!!fieldNameError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Field Name
            </FormLabel>
            <Input
              value={component.fieldName}
              onChange={(e) => onChange({ ...component, fieldName: e.target.value })}
              placeholder="Field name"
              bg="gray.700"
            />
            {fieldNameError && <FormErrorMessage>{fieldNameError.message}</FormErrorMessage>}
          </FormControl>
          <FormControl isInvalid={!!fieldValueError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Field Value
            </FormLabel>
            <Textarea
              value={component.fieldValue}
              onChange={(e) => onChange({ ...component, fieldValue: e.target.value })}
              placeholder="Field value"
              rows={2}
              bg="gray.700"
              color="white"
            />
            {fieldValueError && <FormErrorMessage>{fieldValueError.message}</FormErrorMessage>}
          </FormControl>
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
        <VStack align="stretch" spacing={6}>
          <FormControl isInvalid={!!contentError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Text Content
            </FormLabel>
            <Textarea
              ref={(ref) => {
                textareaRef.current = ref;
              }}
              value={component.content}
              onChange={(e) => onChange({ ...component, content: e.target.value })}
              placeholder="Enter text content"
              rows={4}
              bg="gray.700"
              color="white"
            />
            {contentError && <FormErrorMessage>Text content cannot be empty</FormErrorMessage>}
          </FormControl>
          <Button
            leftIcon={<AddIcon />}
            size="sm"
            variant="outline"
            colorScheme="blue"
            onClick={onOpen}
            alignSelf="flex-start"
          >
            Insert Placeholder
          </Button>
        </VStack>
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
          <FormControl isInvalid={!!labelError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Button Label
            </FormLabel>
            <Input
              value={component.label}
              onChange={(e) => onChange({ ...component, label: e.target.value })}
              placeholder="Enter button label"
              bg="gray.700"
            />
            {labelError && <FormErrorMessage>{labelError.message}</FormErrorMessage>}
          </FormControl>
          <FormControl isInvalid={!!styleError}>
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
            <FormControl isInvalid={!!hrefError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Link URL
              </FormLabel>
              <Input
                value={component.href || ""}
                onChange={(e) => onChange({ ...component, href: e.target.value })}
                placeholder="https://example.com"
                bg="gray.700"
              />
              {hrefError && <FormErrorMessage>{hrefError.message}</FormErrorMessage>}
            </FormControl>
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
      const [labelError, styleError, urlError] = getPreviewerFieldErrors(
        formState.errors,
        messageComponent,
        component.id,
        ["label", "style", "url"]
      );

      return (
        <VStack align="stretch" spacing={6}>
          <FormControl isInvalid={!!labelError}>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Button Label
            </FormLabel>
            <Input
              value={component.label}
              onChange={(e) => onChange({ ...component, label: e.target.value })}
              placeholder="Enter button label"
              bg="gray.700"
            />
            {labelError && <FormErrorMessage>{labelError.message}</FormErrorMessage>}
          </FormControl>
          <FormControl isInvalid={!!styleError}>
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
            <FormControl isInvalid={!!urlError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Link URL
              </FormLabel>
              <Input
                value={component.url || ""}
                onChange={(e) => onChange({ ...component, url: e.target.value })}
                placeholder="https://example.com"
                bg="gray.700"
              />
              {urlError && <FormErrorMessage>{urlError.message}</FormErrorMessage>}
            </FormControl>
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

  let component: Component | null = null;

  if (messageComponent) {
    component = findPreviewerComponentById(messageComponent, selectedComponentId);
  }

  if (!component) {
    return null;
  }

  const updateValue = (value: Component) => {
    setValue(formPath as any, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const handleInsertMergeTag = React.useCallback(
    (tag: string) => {
      if (textareaRef.current && component) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = (component as any).content || "";
        const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end);

        // Update the component through the proper onChange handler
        const updatedComponent = { ...component, content: newValue };
        updateValue(updatedComponent);

        // Set cursor position after the inserted tag
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 0);
      }
    },
    [component, updateValue]
  );

  const positionInfo = component ? getComponentPosition(component) : null;
  const canMoveUp = positionInfo && positionInfo.index > 0;
  const canMoveDown = positionInfo && positionInfo.index < positionInfo.total - 1;

  const [nameFieldError] = getPreviewerFieldErrors(
    formState.errors,
    messageComponent,
    component.id,
    ["name"]
  );
  const isRootComponent = ROOT_COMPONENT_TYPES.includes(component.type);

  return (
    <>
      <VStack align="stretch" spacing={6} p={4} minWidth={250}>
        {(!hideTitle || !isRootComponent) && (
          <HStack justify="space-between" align="center" flexWrap="wrap" spacing={6}>
            {!hideTitle && (
              <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                {component.type} Properties
              </Text>
            )}
            {!isRootComponent && (
              <Button
                size="sm"
                colorScheme="red"
                variant="outline"
                leftIcon={<DeleteIcon />}
                onClick={() => deleteComponent(component.id)}
              >
                Delete
              </Button>
            )}
          </HStack>
        )}
        {(component.type === ComponentType.LegacyActionRow ||
          component.type === ComponentType.V2ActionRow) &&
          component.children.length === 0 && (
            <Alert status="error" borderRadius="md" role={undefined}>
              <AlertIcon />
              At least one child component is required for Action Rows.
            </Alert>
          )}
        {component.type === ComponentType.V2Section && component.children.length === 0 && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            At least one child component is required for Sections.
          </Alert>
        )}
        {component.type === ComponentType.V2Section && component.children.length > 3 && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            Sections can have at most 3 child components. {component.children.length - 3} child
            components must be deleted.
          </Alert>
        )}
        {component.type === ComponentType.V2Section && !component.accessory && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            An accessory component is required for Sections.
          </Alert>
        )}
        {component.type === ComponentType.V2ActionRow && component.children.length > 5 && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            Action Rows can have at most 5 child components. {component.children.length - 5} child
            components must be deleted.
          </Alert>
        )}
        <FormControl isInvalid={!!nameFieldError}>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Component Name
          </FormLabel>
          <Input
            value={component.name}
            onChange={(e) => updateValue({ ...component, name: e.target.value })}
            placeholder="Enter component name"
            bg="gray.700"
          />
          {nameFieldError && <FormErrorMessage>{nameFieldError?.message}</FormErrorMessage>}
        </FormControl>
        {positionInfo && !isRootComponent && (
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
                    moveComponentUp(component.id);
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
                    moveComponentDown(component.id);
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
        {renderPropertiesForComponent(component, updateValue)}
      </VStack>
      <InsertPlaceholderDialog
        isOpen={isOpen}
        onClose={onClose}
        onSelectTag={handleInsertMergeTag}
        currentArticle={getCurrentArticle()}
      />
    </>
  );
};
