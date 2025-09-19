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
import { FaPlus, FaEnvelope, FaFileAlt, FaClipboard, FaCircle, FaFile } from "react-icons/fa";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import type { Component, ActionRowComponent } from "./types";
import { ComponentType } from "./types";
import {
  NavigableTreeItem,
  NavigableTreeItemExpandButton,
  NavigableTreeItemGroup,
} from "../../components/NavigableTree";
import { useNavigableTreeItemContext } from "../../contexts/NavigableTreeItemContext";
import { usePreviewerContext } from "./PreviewerContext";
import getChakraColor from "../../utils/getChakraColor";

interface ComponentTreeItemProps {
  component: Component;
  depth?: number;
}

export const ComponentTreeItem: React.FC<ComponentTreeItemProps> = ({ component, depth = 0 }) => {
  const { addChildComponent, deleteComponent } = usePreviewerContext();
  const hasChildren = component.children && component.children.length > 0;
  const canHaveChildren =
    component.type === ComponentType.Message || component.type === ComponentType.ActionRow;
  const { isFocused, isExpanded, isSelected } = useNavigableTreeItemContext();

  const getComponentIcon = (type: Component["type"]) => {
    switch (type) {
      case ComponentType.Message:
        return FaEnvelope;
      case ComponentType.TextDisplay:
        return FaFileAlt;
      case ComponentType.ActionRow:
        return FaClipboard;
      case ComponentType.Button:
        return FaCircle;
      default:
        return FaFile;
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
        {canHaveChildren && (
          <NavigableTreeItemExpandButton>
            {({ onClick }) => {
              return (
                <IconButton
                  tabIndex={-1}
                  icon={isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                  size="xs"
                  variant="ghost"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                  onClick={onClick}
                />
              );
            }}
          </NavigableTreeItemExpandButton>
        )}
        {!canHaveChildren && <Box w={6} />}
        <Box fontSize="xs" mr={2} color="gray.400">
          {React.createElement(getComponentIcon(component.type))}
        </Box>
        <Text fontSize="sm" flex={1} color="white">
          {component.name}
        </Text>
        {canHaveChildren && (
          <Menu>
            <MenuButton
              as={IconButton}
              icon={<FaPlus />}
              size="xs"
              variant="ghost"
              aria-label="Add Child Component"
              onClick={(e) => e.stopPropagation()}
              zIndex={2}
            />
            <MenuList bg="gray.700" borderColor="gray.600" zIndex={3}>
              {component.type === ComponentType.Message && (
                <>
                  <MenuItem
                    bg="gray.700"
                    _hover={{ bg: "gray.600" }}
                    color="white"
                    onClick={() => addChildComponent(component.id, ComponentType.TextDisplay)}
                  >
                    Add Text Display
                  </MenuItem>
                  <MenuItem
                    bg="gray.700"
                    _hover={{ bg: "gray.600" }}
                    color="white"
                    onClick={() => addChildComponent(component.id, ComponentType.ActionRow)}
                  >
                    Add Action Row
                  </MenuItem>
                </>
              )}
              {component.type === ComponentType.ActionRow && (
                <MenuItem
                  bg="gray.700"
                  _hover={{ bg: "gray.600" }}
                  color="white"
                  onClick={() => addChildComponent(component.id, ComponentType.Button)}
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
                <ComponentTreeItem component={child} depth={depth + 1} />
              </NavigableTreeItem>
            ))}
          </NavigableTreeItemGroup>
        </VStack>
      )}
    </VStack>
  );
};
