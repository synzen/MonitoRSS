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
  MenuGroup,
  Button,
  Icon,
} from "@chakra-ui/react";
import {
  FaPlus,
  FaEnvelope,
  FaClipboard,
  FaFile,
  FaHandPointer,
  FaFont,
  FaLayerGroup,
  FaMinus,
  FaCog,
  FaExclamationTriangle,
} from "react-icons/fa";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import type { Component, ActionRowComponent, SectionComponent } from "./types";
import { ComponentType } from "./types";
import {
  NavigableTreeItem,
  NavigableTreeItemExpandButton,
  NavigableTreeItemGroup,
} from "../../components/NavigableTree";
import { useNavigableTreeItemContext } from "../../contexts/NavigableTreeItemContext";
import { usePreviewerContext } from "./PreviewerContext";
import getChakraColor from "../../utils/getChakraColor";
import { SlidingConfigPanel } from "./SlidingConfigPanel";
import { useConfigPanel } from "../../hooks/useConfigPanel";

interface ComponentTreeItemProps {
  component: Component;
  depth?: number;
  scrollToComponentId?: string | null;
  componentIdsWithProblems: Set<string>;
}

const getComponentIcon = (type: Component["type"]) => {
  switch (type) {
    case ComponentType.Message:
      return FaEnvelope;
    case ComponentType.TextDisplay:
      return FaFont;
    case ComponentType.ActionRow:
      return FaClipboard;
    case ComponentType.Button:
      return FaHandPointer;
    case ComponentType.Section:
      return FaLayerGroup;
    case ComponentType.Divider:
      return FaMinus;
    default:
      return FaFile;
  }
};

export const ComponentTreeItem: React.FC<ComponentTreeItemProps> = ({
  component,
  depth = 0,
  scrollToComponentId,
  componentIdsWithProblems,
}) => {
  const { addChildComponent } = usePreviewerContext();
  const { isOpen, activeComponent, openConfig, closeConfig } = useConfigPanel();
  const ref = React.useRef<HTMLDivElement>(null);

  const componentChildrenCount = component.children?.length || 0;
  const hasChildren = component.children && component.children.length > 0;
  const hasAccessory =
    component.type === ComponentType.Section &&
    (component as SectionComponent).accessory !== undefined;
  const canHaveChildren =
    component.type === ComponentType.Message ||
    component.type === ComponentType.ActionRow ||
    component.type === ComponentType.Section;
  const { isFocused, isExpanded, isSelected, setIsExpanded } = useNavigableTreeItemContext();

  const onAddChildComponent = (...args: Parameters<typeof addChildComponent>) => {
    addChildComponent(...args);

    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  const handleConfigureComponent = (e: React.MouseEvent) => {
    e.stopPropagation();
    openConfig(component);
  };

  React.useEffect(() => {
    if (scrollToComponentId === component.id && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [scrollToComponentId]);

  return (
    <>
      <VStack align="stretch" spacing={0} position="relative" ref={ref}>
        <HStack
          pl={2 + depth * 4}
          pr={2}
          py={2}
          cursor="pointer"
          bg={isSelected ? "blue.600" : "transparent"}
          _hover={{ bg: isSelected ? "blue.600" : "gray.700" }}
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
          <HStack flex={1} justifyContent="flex-start">
            <Text fontSize="sm" color="white">
              {component.name}
            </Text>
            {componentIdsWithProblems.has(component.id) && (
              <Icon
                as={FaExclamationTriangle}
                color={isSelected ? "white" : "red.400"}
                flexShrink={0}
                size="sm"
                aria-label="Problem detected"
                title="Problem detected"
              />
            )}
          </HStack>
          {/* Configure Button */}
          <Button
            display={{
              base: "inline-flex",
              lg: "none",
            }}
            leftIcon={<FaCog />}
            size="xs"
            variant="ghost"
            onClick={handleConfigureComponent}
            mr={1}
            _hover={{ color: "white", bg: "gray.600" }}
          >
            Configure
          </Button>
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
                _hover={{ color: "white", bg: "gray.600" }}
              />
              <MenuList bg="gray.700" borderColor="gray.600" zIndex={3}>
                {component.type === ComponentType.Message && (
                  <MenuGroup title={`Components (${componentChildrenCount}/10)`}>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if ((component.children.length || 0) >= 10) return;
                        onAddChildComponent(component.id, ComponentType.TextDisplay);
                      }}
                      aria-disabled={(component.children.length || 0) >= 10}
                    >
                      Add Text Display
                    </MenuItem>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if ((component.children.length || 0) >= 10) return;
                        onAddChildComponent(component.id, ComponentType.ActionRow);
                      }}
                      aria-disabled={(component.children.length || 0) >= 10}
                    >
                      Add Action Row
                    </MenuItem>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if ((component.children.length || 0) >= 10) return;
                        onAddChildComponent(component.id, ComponentType.Section);
                      }}
                      aria-disabled={(component.children.length || 0) >= 10}
                    >
                      Add Section
                    </MenuItem>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if ((component.children.length || 0) >= 10) return;
                        onAddChildComponent(component.id, ComponentType.Divider);
                      }}
                      aria-disabled={(component.children.length || 0) >= 10}
                    >
                      Add Divider
                    </MenuItem>
                  </MenuGroup>
                )}
                {component.type === ComponentType.ActionRow && (
                  <MenuGroup
                    title={`Components (${(component as ActionRowComponent).children.length}/5)`}
                  >
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if ((component as ActionRowComponent).children.length >= 5) return;
                        onAddChildComponent(component.id, ComponentType.Button);
                      }}
                      aria-disabled={(component as ActionRowComponent).children.length >= 5}
                    >
                      Add Button
                    </MenuItem>
                  </MenuGroup>
                )}
                {component.type === ComponentType.Section && (
                  <>
                    <MenuGroup title={`Components (${componentChildrenCount}/3)`}>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          if ((component.children?.length || 0) >= 3) return;
                          onAddChildComponent(component.id, ComponentType.TextDisplay);
                        }}
                        aria-disabled={(component.children?.length || 0) >= 3}
                      >
                        Add Text Display
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          if ((component.children?.length || 0) >= 3) return;
                          onAddChildComponent(component.id, ComponentType.Divider);
                        }}
                        aria-disabled={(component.children?.length || 0) >= 3}
                      >
                        Add Divider
                      </MenuItem>
                    </MenuGroup>
                    <MenuGroup title={`Accessory (Required - ${hasAccessory ? "1" : "0"}/1)`}>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          if (hasAccessory) return;
                          onAddChildComponent(component.id, ComponentType.Button, true);
                        }}
                        aria-disabled={hasAccessory}
                      >
                        Add Button
                      </MenuItem>
                    </MenuGroup>
                  </>
                )}
              </MenuList>
            </Menu>
          )}
        </HStack>
        {(hasChildren || hasAccessory) && isExpanded && (
          <VStack align="stretch" spacing={0}>
            <NavigableTreeItemGroup>
              {component.children?.map((child) => (
                <NavigableTreeItem ariaLabel={child.name} id={child.id} key={child.id}>
                  <ComponentTreeItem
                    component={child}
                    depth={depth + 1}
                    scrollToComponentId={scrollToComponentId}
                    componentIdsWithProblems={componentIdsWithProblems}
                  />
                </NavigableTreeItem>
              ))}
              {hasAccessory && (
                <NavigableTreeItem
                  ariaLabel={`${(component as SectionComponent).accessory!.name} (Accessory)`}
                  id={(component as SectionComponent).accessory!.id}
                  key={`accessory-${(component as SectionComponent).accessory!.id}`}
                >
                  <ComponentTreeItem
                    component={(component as SectionComponent).accessory!}
                    depth={depth + 1}
                    scrollToComponentId={scrollToComponentId}
                    componentIdsWithProblems={componentIdsWithProblems}
                  />
                </NavigableTreeItem>
              )}
            </NavigableTreeItemGroup>
          </VStack>
        )}
      </VStack>
      {/* Sliding Config Panel */}
      <SlidingConfigPanel isOpen={isOpen} onClose={closeConfig} component={activeComponent} />
    </>
  );
};
