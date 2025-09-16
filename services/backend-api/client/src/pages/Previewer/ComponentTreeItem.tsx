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
  chakra,
} from "@chakra-ui/react";
import { AddIcon, ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
import type { Component, ComponentTreeItemProps, ActionRowComponent } from "./types";
import {
  NavigableTreeItem,
  NavigableTreeItemExpandButton,
  NavigableTreeItemGroup,
} from "../../components/NavigableTree";
import { useNavigableTreeItemContext } from "../../contexts/NavigableTreeItemContext";
import getChakraColor from "../../utils/getChakraColor";

export const ComponentTreeItem: React.FC<ComponentTreeItemProps> = ({
  component,
  onDelete,
  onAddChild,
  depth = 0,
}) => {
  // const isSelected = selectedId === component.id;
  const hasChildren = component.children && component.children.length > 0;
  // const isExpanded = expandedComponents.has(component.id);
  const canHaveChildren = component.type === "Message" || component.type === "ActionRow";
  const { isFocused, isExpanded, isSelected } = useNavigableTreeItemContext();

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
    <VStack align="stretch" spacing={0} position="relative">
      <HStack
        pl={2 + depth * 4}
        pr={2}
        py={2}
        cursor="pointer"
        bg={isSelected ? "blue.600" : "transparent"}
        _hover={{ bg: isSelected ? "blue.600" : "gray.700" }}
        // onClick={() => onSelect(component.id)}
        // outlineOffset={4}
        outline={isFocused ? `2px solid ${getChakraColor("blue.300")}` : undefined}
      >
        {canHaveChildren && isExpanded && <ChevronDownIcon />}
        {canHaveChildren && !isExpanded && <ChevronRightIcon />}
        {!canHaveChildren && <Box w={4} />}
        <Text fontSize="xs" mr={2}>
          {getComponentIcon(component.type)}
        </Text>
        <NavigableTreeItemExpandButton>
          {({ onClick }) => {
            return (
              <chakra.button
                onClick={onClick}
                flex={1}
                tabIndex={-1}
                textAlign="left"
                _before={{
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                }}
              >
                <Text fontSize="sm" flex={1} color="white">
                  {component.name}
                </Text>
              </chakra.button>
            );
          }}
        </NavigableTreeItemExpandButton>
        {canHaveChildren && (
          <Menu>
            <MenuButton
              as={IconButton}
              icon={<AddIcon />}
              size="xs"
              variant="ghost"
              aria-label="Add Child Component"
              onClick={(e) => e.stopPropagation()}
              zIndex={2}
            />
            <MenuList bg="gray.700" borderColor="gray.600" zIndex={3}>
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
          <NavigableTreeItemGroup>
            {component.children?.map((child) => (
              <NavigableTreeItem ariaLabel={child.name} id={child.id} key={child.id}>
                <ComponentTreeItem
                  component={child}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  depth={depth + 1}
                />
              </NavigableTreeItem>
            ))}
          </NavigableTreeItemGroup>
        </VStack>
      )}
    </VStack>
  );
};
