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
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import type { Component, ComponentPropertiesPanelProps } from "./types";
import { ComponentType, ButtonStyle } from "./types";

import { usePreviewerContext } from "./PreviewerContext";

export const ComponentPropertiesPanel: React.FC<ComponentPropertiesPanelProps> = ({
  selectedComponent,
}) => {
  const { updateComponent, deleteComponent } = usePreviewerContext();

  if (!selectedComponent) {
    return (
      <Box p={4}>
        <Text color="gray.400">Select a component to edit its properties</Text>
      </Box>
    );
  }

  const renderPropertiesForComponent = (component: Component) => {
    switch (component.type) {
      case ComponentType.TextDisplay:
        return (
          <Box>
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
              borderColor="gray.600"
              _focus={{ borderColor: "blue.400" }}
            />
          </Box>
        );
      case ComponentType.ActionRow:
        return (
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2} color="gray.200">
              This Action Row contains {component.children.length} button
              {component.children.length !== 1 ? "s" : ""} (max 5).
            </Text>
            <Text fontSize="sm" color="gray.400">
              Select individual buttons in the tree to edit their properties.
            </Text>
          </Box>
        );
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
      {renderPropertiesForComponent(selectedComponent)}
    </VStack>
  );
};
