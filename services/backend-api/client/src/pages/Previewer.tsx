import React, { useState } from "react";
import { Box, Flex, VStack, Text } from "@chakra-ui/react";
import { DiscordMessagePreview } from "./Previewer/DiscordMessagePreview";
import { ComponentPropertiesPanel } from "./Previewer/ComponentPropertiesPanel";
import { ComponentTreeItem } from "./Previewer/ComponentTreeItem";
import { Component, MessageComponent } from "./Previewer/types";

export const Previewer: React.FC = () => {
  const [messageComponent, setMessageComponent] = useState<MessageComponent>(() => ({
    id: "message-root",
    type: "Message",
    name: "Discord Message",
    children: [],
  }));
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>("message-root");
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(
    new Set(["message-root"])
  );

  const addChildComponent = (
    parentId: string,
    childType: "TextDisplay" | "ActionRow" | "Button"
  ) => {
    const newComponent = (() => {
      switch (childType) {
        case "TextDisplay":
          return {
            id: `text-${Date.now()}`,
            type: "TextDisplay" as const,
            name: `Text Display`,
            content: "Hello, Discord!",
          };
        case "ActionRow":
          return {
            id: `actionrow-${Date.now()}`,
            type: "ActionRow" as const,
            name: `Action Row`,
            children: [],
          };
        case "Button":
          return {
            id: `button-${Date.now()}`,
            type: "Button" as const,
            name: `Button`,
            label: "New Button",
            style: "Primary" as const,
            disabled: false,
            href: "",
          };
        default:
          throw new Error(`Unknown child type: ${childType}`);
      }
    })();

    const updateComponentTree = (component: Component): Component => {
      if (component.id === parentId) {
        return {
          ...component,
          children: [...(component.children || []), newComponent],
        } as Component;
      }

      if (component.children) {
        return {
          ...component,
          children: component.children.map(updateComponentTree),
        } as Component;
      }

      return component;
    };

    setMessageComponent(updateComponentTree(messageComponent) as MessageComponent);
    setSelectedComponentId(newComponent.id);

    // Auto-expand the parent component to show the new child
    setExpandedComponents((prev) => new Set([...prev, parentId]));
  };

  const deleteComponent = (id: string) => {
    if (id === "message-root") return; // Can't delete root

    const removeFromTree = (component: Component): Component | null => {
      if (component.children) {
        const filteredChildren = component.children
          .map(removeFromTree)
          .filter((child): child is Component => child !== null);

        return {
          ...component,
          children: filteredChildren,
        } as Component;
      }

      return component.id === id ? null : component;
    };

    const updatedComponent = removeFromTree(messageComponent);

    if (updatedComponent) {
      setMessageComponent(updatedComponent as MessageComponent);
    }

    if (selectedComponentId === id) {
      setSelectedComponentId("message-root");
    }
  };

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

      return component;
    };

    setMessageComponent(updateInTree(messageComponent) as MessageComponent);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedComponents);

    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }

    setExpandedComponents(newExpanded);
  };

  const findComponentById = (component: Component, id: string): Component | null => {
    if (component.id === id) {
      return component;
    }

    if (component.children) {
      const found = component.children
        .map((child) => findComponentById(child, id))
        .find((result) => result !== null);

      return found || null;
    }

    return null;
  };

  const selectedComponent = selectedComponentId
    ? findComponentById(messageComponent, selectedComponentId)
    : null;

  return (
    <Flex h="calc(100vh - 60px)" bg="gray.900">
      {/* Left Panel - Component Tree */}
      <Box w="300px" bg="gray.800" borderRight="1px" borderColor="gray.600" overflow="auto">
        <VStack align="stretch" spacing={0}>
          <Box p={4} borderBottom="1px" borderColor="gray.600">
            <Text fontSize="lg" fontWeight="bold" color="white" textAlign="center">
              Message Structure
            </Text>
          </Box>
          <ComponentTreeItem
            component={messageComponent}
            selectedId={selectedComponentId}
            onSelect={setSelectedComponentId}
            onDelete={deleteComponent}
            onAddChild={addChildComponent}
            expandedComponents={expandedComponents}
            onToggleExpanded={toggleExpanded}
          />
        </VStack>
      </Box>
      {/* Center Panel - Discord Preview */}
      <Box flex={1} p={4} overflow="auto" bg="gray.800">
        <VStack align="stretch" h="full">
          <Text fontSize="xl" fontWeight="bold" mb={4} color="white">
            Discord Message Preview
          </Text>
          <DiscordMessagePreview messageComponent={messageComponent} />
        </VStack>
      </Box>
      {/* Right Panel - Properties */}
      <Box w="350px" bg="gray.800" borderLeft="1px" borderColor="gray.600" overflow="auto">
        <ComponentPropertiesPanel
          selectedComponent={selectedComponent}
          onUpdateComponent={updateComponent}
          onDeleteComponent={deleteComponent}
        />
      </Box>
    </Flex>
  );
};
