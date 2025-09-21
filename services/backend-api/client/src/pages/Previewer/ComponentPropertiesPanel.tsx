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
} from "@chakra-ui/react";
import { DeleteIcon, ChevronUpIcon, ChevronDownIcon, AddIcon } from "@chakra-ui/icons";
import { useFormContext } from "react-hook-form";
import type {
  Component,
  ComponentPropertiesPanelProps,
  MessageComponent,
  TextDisplayComponent,
} from "./types";
import { ComponentType, ButtonStyle } from "./types";
import { InsertPlaceholderDialog } from "./InsertPlaceholderDialog";

import { usePreviewerContext } from "./PreviewerContext";

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
  if (root.type === ComponentType.Section && (root as any).accessory) {
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
  if (root.type === ComponentType.Section && (root as any).accessory) {
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
  const { watch, formState, setValue } = useFormContext<{
    messageComponent: MessageComponent;
  }>();
  const messageComponent = watch("messageComponent");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeTextareaRef, setActiveTextareaRef] = React.useState<HTMLTextAreaElement | null>(
    null
  );
  const [currentComponent, setCurrentComponent] = React.useState<Component | null>(null);

  const getFieldError = (componentId: string, fieldName: string) => {
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

      if (component.type === ComponentType.Section && component.accessory) {
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
      case ComponentType.TextDisplay: {
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

      case ComponentType.Button: {
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
                onChange={(e) => onChange({ ...component, style: e.target.value as ButtonStyle })}
                bg="gray.700"
              >
                <option value={ButtonStyle.Primary}>Primary</option>
                <option value={ButtonStyle.Secondary}>Secondary</option>
                <option value={ButtonStyle.Success}>Success</option>
                <option value={ButtonStyle.Danger}>Danger</option>
                <option value={ButtonStyle.Link}>Link</option>
              </Select>
              {styleError && <FormErrorMessage>{styleError.message}</FormErrorMessage>}
            </FormControl>
            {component.style === ButtonStyle.Link && (
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

      case ComponentType.Divider: {
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

      default:
        return null;
    }
  };

  const getComponentPosition = (component: Component) => {
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

  const formPath = getComponentFormPathById(messageComponent, selectedComponentId);
  const component = findComponentById(messageComponent, selectedComponentId);

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

  return (
    <>
      <VStack align="stretch" spacing={4} p={4} minWidth={250}>
        {(!hideTitle || component.type !== ComponentType.Message) && (
          <HStack justify="space-between" align="center" flexWrap="wrap" spacing={4}>
            {!hideTitle && (
              <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                {component.type} Properties
              </Text>
            )}
            {component.type !== ComponentType.Message && (
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
        {component.type === ComponentType.ActionRow && component.children.length === 0 && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            At least one child component is required for Action Rows.
          </Alert>
        )}
        {component.type === ComponentType.Section && component.children.length === 0 && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            At least one child component is required for Sections.
          </Alert>
        )}
        {component.type === ComponentType.Section && component.children.length > 3 && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            Sections can have at most 3 child components. {component.children.length - 3} child
            components must be deleted.
          </Alert>
        )}
        {component.type === ComponentType.Section && !component.accessory && (
          <Alert status="error" borderRadius="md" role={undefined}>
            <AlertIcon />
            An accessory component is required for Sections.
          </Alert>
        )}
        {component.type === ComponentType.ActionRow && component.children.length > 5 && (
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
        {positionInfo && component.type !== ComponentType.Message && (
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
