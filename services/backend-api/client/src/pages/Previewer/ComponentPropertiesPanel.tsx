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
import type { Component, ComponentPropertiesPanelProps, TextDisplayComponent } from "./types";
import { ComponentType, ROOT_COMPONENT_TYPES } from "./types";
import { InsertPlaceholderDialog } from "./InsertPlaceholderDialog";

import { usePreviewerContext } from "./PreviewerContext";
import { DiscordButtonStyle } from "./constants/DiscordButtonStyle";
import PreviewerFormState from "./types/PreviewerFormState";

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

function findComponentById(root: Component, id: string): Component | null {
  if (root.id === id) {
    return root;
  }

  if (root.children) {
    for (let i = 0; i < root.children.length; i += 1) {
      const child = root.children[i];
      const result = findComponentById(child, id);
      if (result) return result;
    }
  }

  // Handle accessory for sections
  if (root.type === ComponentType.V2Section && (root as any).accessory) {
    const accessory = (root as any).accessory as Component;
    const result = findComponentById(accessory, id);
    if (result) return result;
  }

  return null;
}

function getComponentFormPathById(
  root: Component,
  id: string,
  basePath: string = "messageComponent"
): string | null {
  if (root.id === id) {
    return basePath;
  }

  if (root.children) {
    for (let i = 0; i < root.children.length; i += 1) {
      const child = root.children[i];
      const childPath = getComponentFormPathById(child, id, `${basePath}.children.${i}`);
      if (childPath) return childPath;
    }
  }

  // Handle accessory for sections
  if (root.type === ComponentType.V2Section && (root as any).accessory) {
    const accessory = (root as any).accessory as Component;
    const accessoryPath = getComponentFormPathById(accessory, id, `${basePath}.accessory`);
    if (accessoryPath) return accessoryPath;
  }

  return null;
}

export const ComponentPropertiesPanel: React.FC<ComponentPropertiesPanelProps> = ({
  selectedComponentId,
  hideTitle,
}) => {
  const { deleteComponent, moveComponentUp, moveComponentDown } = usePreviewerContext();
  const { watch, formState, setValue } = useFormContext<PreviewerFormState>();
  const messageComponent = watch("messageComponent");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeTextareaRef, setActiveTextareaRef] = React.useState<HTMLTextAreaElement | null>(
    null
  );
  const [currentComponent, setCurrentComponent] = React.useState<Component | null>(null);

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

  const handleInsertMergeTag = (tag: string) => {
    if (activeTextareaRef && currentComponent) {
      const textarea = activeTextareaRef;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = (currentComponent as TextDisplayComponent).content || "";
      const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end);

      // Update the component through the proper onChange handler
      const updatedComponent = { ...currentComponent, content: newValue };
      updateValue(updatedComponent);

      // Set cursor position after the inserted tag
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    }
  };

  const renderPropertiesForComponent = (component: Component, onChange: (value: any) => void) => {
    switch (component.type) {
      case ComponentType.LegacyText: {
        const contentError = getFieldError(component.id, "content");

        return (
          <VStack align="stretch" spacing={4}>
            <FormControl isInvalid={!!contentError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Text Content
              </FormLabel>
              <Textarea
                ref={(ref) => {
                  setActiveTextareaRef(ref);
                  setCurrentComponent(component);
                }}
                value={component.content}
                onChange={(e) => onChange({ ...component, content: e.target.value })}
                placeholder="Enter text content"
                rows={4}
                bg="gray.700"
                color="white"
              />
              {contentError?.message && <FormErrorMessage>{contentError.message}</FormErrorMessage>}
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

      case ComponentType.LegacyEmbed: {
        const colorError = getFieldError(component.id, "color");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.LegacyEmbedAuthor: {
        const nameError = getFieldError(component.id, "authorName");
        const urlError = getFieldError(component.id, "authorUrl");
        const iconUrlError = getFieldError(component.id, "authorIconUrl");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.LegacyEmbedTitle: {
        const titleError = getFieldError(component.id, "title");
        const titleUrlError = getFieldError(component.id, "titleUrl");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.LegacyEmbedDescription: {
        const descriptionError = getFieldError(component.id, "description");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.LegacyEmbedImage: {
        const imageUrlError = getFieldError(component.id, "imageUrl");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.LegacyEmbedThumbnail: {
        const thumbnailUrlError = getFieldError(component.id, "thumbnailUrl");

        return (
          <VStack align="stretch" spacing={4}>
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
              {thumbnailUrlError && (
                <FormErrorMessage>{thumbnailUrlError.message}</FormErrorMessage>
              )}
            </FormControl>
          </VStack>
        );
      }

      case ComponentType.LegacyEmbedFooter: {
        const footerTextError = getFieldError(component.id, "footerText");
        const footerIconUrlError = getFieldError(component.id, "footerIconUrl");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.LegacyEmbedField: {
        const fieldNameError = getFieldError(component.id, "fieldName");
        const fieldValueError = getFieldError(component.id, "fieldValue");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.LegacyEmbedTimestamp: {
        const timestampError = getFieldError(component.id, "timestamp");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.V2TextDisplay: {
        const contentError = getFieldError(component.id, "content");

        return (
          <VStack align="stretch" spacing={4}>
            <FormControl isInvalid={!!contentError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Text Content
              </FormLabel>
              <Textarea
                ref={(ref) => {
                  setActiveTextareaRef(ref);
                  setCurrentComponent(component);
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

      case ComponentType.V2Button: {
        const labelError = getFieldError(component.id, "label");
        const hrefError = getFieldError(component.id, "href");
        const styleError = getFieldError(component.id, "style");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.V2Divider: {
        const spacingError = getFieldError(component.id, "spacing");
        const visualError = getFieldError(component.id, "visual");

        return (
          <VStack align="stretch" spacing={4}>
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

      case ComponentType.LegacyButton: {
        const labelError = getFieldError(component.id, "label");
        const styleError = getFieldError(component.id, "style");
        const urlError = getFieldError(component.id, "url");

        return (
          <VStack align="stretch" spacing={4}>
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

      default:
        return null;
    }
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
    ? getComponentFormPathById(messageComponent, selectedComponentId)
    : null;
  const component = messageComponent
    ? findComponentById(messageComponent, selectedComponentId)
    : null;

  if (!formPath || !component) {
    return null;
  }

  const positionInfo = component ? getComponentPosition(component) : null;
  const canMoveUp = positionInfo && positionInfo.index > 0;
  const canMoveDown = positionInfo && positionInfo.index < positionInfo.total - 1;

  const updateValue = (value: Component) => {
    setValue(formPath as any, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const nameFieldError = getFieldError(component.id, "name");
  const isRootComponent = ROOT_COMPONENT_TYPES.includes(component.type);

  return (
    <>
      <VStack align="stretch" spacing={4} p={4} minWidth={250}>
        {(!hideTitle || !isRootComponent) && (
          <HStack justify="space-between" align="center" flexWrap="wrap" spacing={4}>
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
