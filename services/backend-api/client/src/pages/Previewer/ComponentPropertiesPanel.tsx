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
import type { ComponentPropertiesPanelProps } from "./types";
import { InsertPlaceholderDialog } from "./InsertPlaceholderDialog";

import { usePreviewerContext } from "./PreviewerContext";
import { DiscordButtonStyle } from "./constants/DiscordButtonStyle";
import { DiscordComponentType } from "./constants/DiscordComponentType";
import MessageComponentV2TextDisplay from "./components/MessageComponentV2TextDisplay";
import PreviewerFormState from "./types/PreviewerFormState";
import MessageBuilderComponent from "./components/base";
import MessageComponentLegacyText from "./components/MessageComponentLegacyText";
import MessageComponentLegacyEmbed from "./components/MessageComponentLegacyEmbed";
import MessageComponentLegacyEmbedAuthor from "./components/MessageComponentLegacyEmbedAuthor";
import MessageComponentLegacyEmbedTitle from "./components/MessageComponentLegacyEmbedTitle";
import MessageComponentLegacyEmbedDescription from "./components/MessageComponentLegacyEmbedDescription";
import MessageComponentLegacyEmbedImage from "./components/MessageComponentLegacyEmbedImage";
import MessageComponentLegacyEmbedThumbnail from "./components/MessageComponentLegacyEmbedThumbnail";
import MessageComponentLegacyEmbedFooter from "./components/MessageComponentLegacyEmbedFooter";
import MessageComponentLegacyEmbedField from "./components/MessageComponentLegacyEmbedField";
import MessageComponentLegacyEmbedTimestamp from "./components/MessageComponentLegacyEmbedTimestamp";
import MessageComponentV2Button from "./components/MessageComponentV2Button";
import MessageComponentV2Divider from "./components/MessageComponentV2Divider";
import MessageComponentLegacyButton from "./components/MessageComponentLegacyButton";

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

function findComponentById(
  root: MessageBuilderComponent,
  id: string
): MessageBuilderComponent | null {
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

  return null;
}

function getComponentFormPathById(
  root: MessageBuilderComponent,
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
  const [currentComponent, setCurrentComponent] = React.useState<MessageBuilderComponent | null>(
    null
  );

  const getFieldError = (componentId: string, fieldName: string): FieldError | undefined => {
    if (!messageComponent) return undefined;

    const getNestedError = (obj: any, path: string) => {
      return path.split(".").reduce((current, key) => {
        return current && current[key];
      }, obj);
    };

    interface StackItem {
      component: MessageBuilderComponent;
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
    }

    return undefined;
  };

  const handleInsertMergeTag = (tag: string) => {
    if (activeTextareaRef && currentComponent) {
      const textarea = activeTextareaRef;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = (currentComponent as MessageComponentV2TextDisplay)?.data?.content || "";
      const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end);

      // Update the component through the proper onChange handler
      // const updatedComponent = { ...currentComponent, content: newValue };
      updateValue(
        currentComponent.clone({
          content: newValue,
        })
      );

      // Set cursor position after the inserted tag
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    }
  };

  const renderPropertiesForComponent = (
    component: MessageBuilderComponent,
    onChange: (value: any) => void
  ) => {
    switch (component.type) {
      case DiscordComponentType.LegacyText: {
        const casted = component as MessageComponentLegacyText;
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
                value={casted.data.content}
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

      case DiscordComponentType.LegacyEmbed: {
        const casted = component as MessageComponentLegacyEmbed;
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
                          casted.data?.color
                            ? `#${Number(casted.data?.color).toString(16).padStart(6, "0")}`
                            : "black"
                        }
                        flex={1}
                        borderStyle="solid"
                        borderWidth="1px"
                        borderColor="whiteAlpha.400"
                        aria-label="Pick color"
                        size="sm"
                        _hover={{
                          background: casted.data?.color
                            ? `#${Number(casted.data?.color).toString(16).padStart(6, "0")}`
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
                          casted.data?.color
                            ? `#${Number(casted.data?.color).toString(16).padStart(6, "0")}`
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

      case DiscordComponentType.LegacyEmbedAuthor: {
        const casted = component as MessageComponentLegacyEmbedAuthor;
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
                value={casted.data?.authorName || ""}
                onChange={(e) => onChange({ ...casted, authorName: e.target.value })}
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
                value={casted.data?.authorUrl || ""}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, authorUrl: e.target.value }))
                }
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
                value={casted.data?.authorIconUrl || ""}
                onChange={(e) => onChange({ ...component, authorIconUrl: e.target.value })}
                placeholder="https://example.com/icon.png"
                bg="gray.700"
              />
              {iconUrlError && <FormErrorMessage>{iconUrlError.message}</FormErrorMessage>}
            </FormControl>
          </VStack>
        );
      }

      case DiscordComponentType.LegacyEmbedTitle: {
        const casted = component as MessageComponentLegacyEmbedTitle;
        const titleError = getFieldError(component.id, "title");
        const titleUrlError = getFieldError(component.id, "titleUrl");

        return (
          <VStack align="stretch" spacing={4}>
            <FormControl isInvalid={!!titleError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Text
              </FormLabel>
              <Input
                value={casted.data?.title || ""}
                onChange={(e) => onChange(casted.clone({ ...casted.data, title: e.target.value }))}
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
                value={casted.data?.titleUrl || ""}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, titleUrl: e.target.value }))
                }
                placeholder="https://example.com"
                bg="gray.700"
              />
              {titleUrlError && <FormErrorMessage>{titleUrlError.message}</FormErrorMessage>}
            </FormControl>
          </VStack>
        );
      }

      case DiscordComponentType.LegacyEmbedDescription: {
        const casted = component as MessageComponentLegacyEmbedDescription;
        const descriptionError = getFieldError(component.id, "description");

        return (
          <VStack align="stretch" spacing={4}>
            <FormControl isInvalid={!!descriptionError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Description
              </FormLabel>
              <Textarea
                value={casted.data?.description || ""}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, description: e.target.value }))
                }
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

      case DiscordComponentType.LegacyEmbedImage: {
        const casted = component as MessageComponentLegacyEmbedImage;
        const imageUrlError = getFieldError(component.id, "imageUrl");

        return (
          <VStack align="stretch" spacing={4}>
            <FormControl isInvalid={!!imageUrlError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                URL
              </FormLabel>
              <Input
                value={casted.data?.imageUrl || ""}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, imageUrl: e.target.value }))
                }
                placeholder="https://example.com/image.png"
                bg="gray.700"
              />
              {imageUrlError && <FormErrorMessage>{imageUrlError.message}</FormErrorMessage>}
            </FormControl>
          </VStack>
        );
      }

      case DiscordComponentType.LegacyEmbedThumbnail: {
        const casted = component as MessageComponentLegacyEmbedThumbnail;
        const thumbnailUrlError = getFieldError(component.id, "thumbnailUrl");

        return (
          <VStack align="stretch" spacing={4}>
            <FormControl isInvalid={!!thumbnailUrlError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                URL
              </FormLabel>
              <Input
                value={casted.data?.thumbnailUrl || ""}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, thumbnailUrl: e.target.value }))
                }
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

      case DiscordComponentType.LegacyEmbedFooter: {
        const casted = component as MessageComponentLegacyEmbedFooter;
        const footerTextError = getFieldError(component.id, "footerText");
        const footerIconUrlError = getFieldError(component.id, "footerIconUrl");

        return (
          <VStack align="stretch" spacing={4}>
            <FormControl isInvalid={!!footerTextError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Text
              </FormLabel>
              <Input
                value={casted.data?.footerText || ""}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, footerText: e.target.value }))
                }
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
                value={casted.data?.footerIconUrl || ""}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, footerIconUrl: e.target.value }))
                }
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

      case DiscordComponentType.LegacyEmbedField: {
        const casted = component as MessageComponentLegacyEmbedField;
        const fieldNameError = getFieldError(component.id, "fieldName");
        const fieldValueError = getFieldError(component.id, "fieldValue");

        return (
          <VStack align="stretch" spacing={4}>
            <FormControl isInvalid={!!fieldNameError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Field Name
              </FormLabel>
              <Input
                value={casted.data?.fieldName || ""}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, fieldName: e.target.value }))
                }
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
                value={casted.data?.fieldValue || ""}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, fieldValue: e.target.value }))
                }
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
                isChecked={casted.data?.inline || false}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, inline: e.target.checked }))
                }
                colorScheme="blue"
              />
            </FormControl>
          </VStack>
        );
      }

      case DiscordComponentType.LegacyEmbedTimestamp: {
        const casted = component as MessageComponentLegacyEmbedTimestamp;
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
                value={casted.data?.timestamp || ""}
                onChange={(value) =>
                  onChange(casted.clone({ ...casted.data, timestamp: value as never }))
                }
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

      case DiscordComponentType.V2TextDisplay: {
        const casted = component as MessageComponentV2TextDisplay;
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
                value={casted.data?.content}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, content: e.target.value }))
                }
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

      case DiscordComponentType.V2Button: {
        const casted = component as MessageComponentV2Button;
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
                value={casted.data.buttonLabel}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, buttonLabel: e.target.value }))
                }
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
                value={casted.data.style}
                onChange={(e) =>
                  onChange(
                    casted.clone({ ...casted.data, style: e.target.value as DiscordButtonStyle })
                  )
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
            {casted.data.style === DiscordButtonStyle.Link && (
              <FormControl isInvalid={!!hrefError}>
                <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                  Link URL
                </FormLabel>
                <Input
                  value={casted.data.href || ""}
                  onChange={(e) => onChange(casted.clone({ ...casted.data, href: e.target.value }))}
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
                isChecked={casted.data.disabled}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, disabled: e.target.checked }))
                }
                colorScheme="blue"
              />
            </FormControl>
          </VStack>
        );
      }

      case DiscordComponentType.V2Divider: {
        const casted = component as MessageComponentV2Divider;
        const spacingError = getFieldError(component.id, "spacing");
        const visualError = getFieldError(component.id, "visual");

        return (
          <VStack align="stretch" spacing={4}>
            <FormControl isInvalid={!!spacingError}>
              <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Spacing
              </FormLabel>
              <Select
                value={casted.data.spacing ?? 1}
                onChange={(e) =>
                  onChange(
                    casted.clone({ ...casted.data, spacing: parseInt(e.target.value, 10) as 1 | 2 })
                  )
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
                isChecked={casted.data.visual ?? true}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, visual: e.target.checked }))
                }
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

      case DiscordComponentType.LegacyActionRow: {
        return (
          <VStack align="stretch" spacing={4}>
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Text fontSize="sm">
                Action Row contains buttons. Use the component tree to add or configure buttons.
              </Text>
            </Alert>
          </VStack>
        );
      }

      case DiscordComponentType.LegacyButton: {
        const casted = component as MessageComponentLegacyButton;
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
                value={casted.data.buttonLabel}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, buttonLabel: e.target.value }))
                }
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
                value={casted.data.style}
                onChange={(e) =>
                  onChange(
                    casted.clone({ ...casted.data, style: e.target.value as DiscordButtonStyle })
                  )
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
            {casted.data.style === DiscordButtonStyle.Link && (
              <FormControl isInvalid={!!urlError}>
                <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                  Link URL
                </FormLabel>
                <Input
                  value={casted.data.url || ""}
                  onChange={(e) => onChange(casted.clone({ ...casted.data, url: e.target.value }))}
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
                isChecked={casted.data.disabled}
                onChange={(e) =>
                  onChange(casted.clone({ ...casted.data, disabled: e.target.checked }))
                }
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

  const getComponentPosition = (component: MessageBuilderComponent) => {
    if (!messageComponent) return null;

    const findParentAndIndex = (
      comp: MessageBuilderComponent,
      targetId: string
    ): { parent: MessageBuilderComponent; index: number; total: number } | null => {
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

  const updateValue = (value: MessageBuilderComponent) => {
    setValue(formPath as any, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const labelFieldError = getFieldError(component.id, "label");
  const isRootComponent = component.isRoot();

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
        {component.type === DiscordComponentType.V2ActionRow && !component.children?.length && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            At least one child component is required for Action Rows.
          </Alert>
        )}
        {component.type === DiscordComponentType.V2Section && !component.children?.length && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            At least one child component is required for Sections.
          </Alert>
        )}
        {component.type === DiscordComponentType.V2Section &&
          component.children &&
          component.children.length > 3 && (
            <Alert status="error" borderRadius="md" role={undefined}>
              <AlertIcon />
              Sections can have at most 3 child components. {component.children.length - 3} child
              components must be deleted.
            </Alert>
          )}
        {/* {component.type === DiscordComponentType.V2Section && !component.children.find && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            An accessory component is required for Sections.
          </Alert>
        )} */}
        {component.type === DiscordComponentType.V2ActionRow &&
          component.children &&
          component.children.length > 5 && (
            <Alert status="error" borderRadius="md" role={undefined}>
              <AlertIcon />
              Action Rows can have at most 5 child components. {component.children.length - 5} child
              components must be deleted.
            </Alert>
          )}
        <FormControl isInvalid={!!labelFieldError}>
          <FormLabel fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
            Component Label
          </FormLabel>
          <Input
            value={component.label}
            onChange={(e) => updateValue(component.clone())}
            placeholder="Enter component label"
            bg="gray.700"
          />
          {labelFieldError && <FormErrorMessage>{labelFieldError?.message}</FormErrorMessage>}
        </FormControl>
        {positionInfo && !isRootComponent && (
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Position
            </Text>
            <VStack spacing={2}>
              <Box bg="gray.700" p={3} borderRadius="md" w="full">
                <Text fontSize="sm" color="white">
                  {positionInfo.index + 1} of {positionInfo.total} in {positionInfo.parent.label}
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
