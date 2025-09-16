import React from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import { AddIcon, ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
import type { Component, ComponentTreeItemProps, ActionRowComponent } from "./types";

export const ComponentTreeItem: React.FC<ComponentTreeItemProps> = ({
  component,
  selectedId,
  onSelect,
  onDelete,
  onAddChild,
  expandedComponents,
  onToggleExpanded,
  depth = 0,
}) => {
  const isSelected = selectedId === component.id;
  const hasChildren = component.children && component.children.length > 0;
  const isExpanded = expandedComponents.has(component.id);
  const canHaveChildren = component.type === "Message" || component.type === "ActionRow";

  const getComponentIcon = (type: Component["type"]) => {
    switch (type) {
      case "Message":
        return "📧";
      case "TextDisplay":
        return "📝";
      case "ActionRow":
        return "📋";
      case "Button":
        return "🔘";
      default:
        return "📄";
    }
  };

  return (
    <VStack align="stretch" spacing={0}>
      <HStack
        pl={2 + depth * 4}
        pr={2}
        py={2}
        cursor="pointer"
        bg={isSelected ? "blue.600" : "transparent"}
        _hover={{ bg: isSelected ? "blue.600" : "gray.700" }}
        onClick={() => onSelect(component.id)}
      >
        {canHaveChildren && (
          <IconButton
            icon={isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            size="xs"
            variant="ghost"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            color="gray.300"
            _hover={{ bg: "gray.600" }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded(component.id);
            }}
          />
        )}
        {!canHaveChildren && <Box w={6} />}
        <Text fontSize="xs" mr={2}>
          {getComponentIcon(component.type)}
        </Text>
        <Text fontSize="sm" flex={1} color="white">
          {component.name}
        </Text>
        {canHaveChildren && (
          <Menu>
            <MenuButton
              as={IconButton}
              icon={<AddIcon />}
              size="xs"
              variant="ghost"
              aria-label="Add Child Component"
              onClick={(e) => e.stopPropagation()}
            />
            <MenuList bg="gray.700" borderColor="gray.600">
              {component.type === "Message" && (
                <>
                  <MenuItem
                    bg="gray.700"
                    _hover={{ bg: "gray.600" }}
                    color="white"
                    onClick={() => onAddChild(component.id, "TextDisplay")}
                  >
                    Add Text Display
                  </MenuItem>
                  <MenuItem
                    bg="gray.700"
                    _hover={{ bg: "gray.600" }}
                    color="white"
                    onClick={() => onAddChild(component.id, "ActionRow")}
                  >
                    Add Action Row
                  </MenuItem>
                </>
              )}
              {component.type === "ActionRow" && (
                <MenuItem
                  bg="gray.700"
                  _hover={{ bg: "gray.600" }}
                  color="white"
                  onClick={() => onAddChild(component.id, "Button")}
                  isDisabled={(component as ActionRowComponent).children.length >= 5}
                >
                  Add Button ({(component as ActionRowComponent).children.length}/5)
                </MenuItem>
              )}
            </MenuList>
          </Menu>
        )}
      </HStack>
      {hasChildren && isExpanded && (
        <VStack align="stretch" spacing={0}>
          {component.children?.map((child) => (
            <ComponentTreeItem
              key={child.id}
              component={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onAddChild={onAddChild}
              expandedComponents={expandedComponents}
              onToggleExpanded={onToggleExpanded}
              depth={depth + 1}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
};
