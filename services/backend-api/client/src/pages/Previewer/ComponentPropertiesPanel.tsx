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
} from "@chakra-ui/react";
import { DeleteIcon, ChevronUpIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { useFormContext } from "react-hook-form";
import type { Component, ComponentPropertiesPanelProps, MessageComponent } from "./types";
import { ComponentType, ButtonStyle } from "./types";

import { usePreviewerContext } from "./PreviewerContext";

export const ComponentPropertiesPanel: React.FC<ComponentPropertiesPanelProps> = ({
  selectedComponent,
}) => {
  const { deleteComponent, moveComponentUp, moveComponentDown } = usePreviewerContext();
  const { setValue, getValues, watch, formState } = useFormContext<{
    messageComponent: MessageComponent;
  }>();
  const messageComponent = watch("messageComponent");

  const updateComponent = (id: string, updates: Partial<Component>) => {
    const updateInTree = (component: Component): Component => {
      if (component.id === id) {
        return { ...component, ...updates } as Component;
      }

      if (component.children) {
        return {
          ...component,
          children: component.children.map(updateInTree),
        } as Component;
      }

      // Handle accessory updates for sections
      if (component.type === ComponentType.Section && component.accessory?.id === id) {
        return {
          ...component,
          accessory: { ...component.accessory, ...updates } as Component,
        };
      }

      return component;
    };

    const currentMessage = getValues("messageComponent");
    setValue("messageComponent", updateInTree(currentMessage) as MessageComponent, {
      shouldValidate: true,
    });
  };

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

  if (!selectedComponent) {
    return (
      <Box p={4}>
        <Text color="gray.400">Select a component to edit its properties</Text>
      </Box>
    );
  }

  const renderPropertiesForComponent = (component: Component) => {
    switch (component.type) {
      case ComponentType.TextDisplay: {
        const contentError = getFieldError(component.id, "content");

        return (
          <FormControl isInvalid={!!contentError}>
            <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              Text Content
            </Text>
            <Textarea
              value={component.content}
              onChange={(e) => updateComponent(component.id, { content: e.target.value })}
              placeholder="Enter text content"
              rows={4}
              bg="gray.700"
              color="white"
            />
            {contentError && <FormErrorMessage>Text content cannot be empty</FormErrorMessage>}
          </FormControl>
        );
      }

      case ComponentType.Button:
        return (
          <VStack align="stretch" spacing={4}>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Button Label
              </Text>
              <Input
                value={component.label}
                onChange={(e) => updateComponent(component.id, { label: e.target.value })}
                placeholder="Enter button label"
                bg="gray.700"
                color="white"
                borderColor="gray.600"
                _focus={{ borderColor: "blue.400" }}
              />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Button Style
              </Text>
              <Select
                value={component.style}
                onChange={(e) =>
                  updateComponent(component.id, {
                    style: e.target.value as ButtonStyle,
                  })
                }
                bg="gray.700"
                color="white"
                borderColor="gray.600"
                _focus={{ borderColor: "blue.400" }}
              >
                <option value={ButtonStyle.Primary}>Primary</option>
                <option value={ButtonStyle.Secondary}>Secondary</option>
                <option value={ButtonStyle.Success}>Success</option>
                <option value={ButtonStyle.Danger}>Danger</option>
                <option value={ButtonStyle.Link}>Link</option>
              </Select>
            </Box>
            {component.style === ButtonStyle.Link && (
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                  Link URL
                </Text>
                <Input
                  value={component.href || ""}
                  onChange={(e) => updateComponent(component.id, { href: e.target.value })}
                  placeholder="https://example.com"
                  bg="gray.700"
                  color="white"
                  borderColor="gray.600"
                  _focus={{ borderColor: "blue.400" }}
                />
              </Box>
            )}
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Button State
              </Text>
              <Button
                size="sm"
                variant={component.disabled ? "solid" : "outline"}
                colorScheme={component.disabled ? "red" : "green"}
                onClick={() => updateComponent(component.id, { disabled: !component.disabled })}
              >
                {component.disabled ? "Disabled" : "Enabled"}
              </Button>
            </Box>
          </VStack>
        );
      case ComponentType.Divider:
        return (
          <VStack align="stretch" spacing={4}>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Spacing
              </Text>
              <Select
                value={component.spacing ?? 1}
                onChange={(e) =>
                  updateComponent(component.id, {
                    spacing: parseInt(e.target.value, 10) as 1 | 2,
                  })
                }
                bg="gray.700"
                color="white"
                borderColor="gray.600"
                _focus={{ borderColor: "blue.400" }}
              >
                <option value={1}>Small padding</option>
                <option value={2}>Large padding</option>
              </Select>
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
                Visual Divider
              </Text>
              <Checkbox
                isChecked={component.visual ?? true}
                onChange={(e) => updateComponent(component.id, { visual: e.target.checked })}
                colorScheme="blue"
              >
                <Text fontSize="sm" color="gray.300">
                  Show visual divider line
                </Text>
              </Checkbox>
            </Box>
          </VStack>
        );
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

  const positionInfo = selectedComponent ? getComponentPosition(selectedComponent) : null;
  const canMoveUp = positionInfo && positionInfo.index > 0;
  const canMoveDown = positionInfo && positionInfo.index < positionInfo.total - 1;

  return (
    <VStack align="stretch" spacing={4} p={4}>
      <HStack justify="space-between" align="center">
        <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
          {selectedComponent.type} Properties
        </Text>
        {selectedComponent.type !== ComponentType.Message && (
          <Button
            size="sm"
            colorScheme="red"
            variant="outline"
            leftIcon={<DeleteIcon />}
            onClick={() => deleteComponent(selectedComponent.id)}
          >
            Delete
          </Button>
        )}
      </HStack>
      <Box>
        <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
          Component Name
        </Text>
        <Input
          value={selectedComponent.name}
          onChange={(e) => updateComponent(selectedComponent.id, { name: e.target.value })}
          placeholder="Enter component name"
          bg="gray.700"
          color="white"
          borderColor="gray.600"
          _focus={{ borderColor: "blue.400" }}
        />
      </Box>
      {positionInfo && selectedComponent.type !== ComponentType.Message && (
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
            <HStack spacing={2} w="full">
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
              >
                Move Down
              </Button>
            </HStack>
          </VStack>
        </Box>
      )}
      {renderPropertiesForComponent(selectedComponent)}
    </VStack>
  );
};
