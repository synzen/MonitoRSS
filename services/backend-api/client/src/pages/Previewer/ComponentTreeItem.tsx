import React, { useState } from "react";
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
import { FaPlus, FaCog, FaExclamationCircle } from "react-icons/fa";
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
import getPreviewerComponentLabel from "./utils/getPreviewerComponentLabel";
import getPreviewerComponentIcon from "./utils/getPreviewerComponentIcon";

interface ComponentTreeItemProps {
  component: Component;
  depth?: number;
  scrollToComponentId?: string | null;
  componentIdsWithProblems: Set<string>;
}

export const ComponentTreeItem: React.FC<ComponentTreeItemProps> = ({
  component,
  depth = 0,
  scrollToComponentId,
  componentIdsWithProblems,
}) => {
  const { addChildComponent } = usePreviewerContext();
  const [configuringComponent, setConfiguringComponent] = useState<Component | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const componentChildrenCount = component.children?.length || 0;
  const hasChildren = component.children && component.children.length > 0;
  const hasAccessory =
    component.type === ComponentType.V2Section &&
    (component as SectionComponent).accessory !== undefined;
  const canHaveChildren =
    component.type === ComponentType.LegacyRoot ||
    component.type === ComponentType.LegacyEmbedContainer ||
    component.type === ComponentType.LegacyEmbed ||
    component.type === ComponentType.LegacyActionRow ||
    component.type === ComponentType.V2Root ||
    component.type === ComponentType.V2ActionRow ||
    component.type === ComponentType.V2Section;
  const { isFocused, isExpanded, isSelected } = useNavigableTreeItemContext();

  const onAddChildComponent = (...args: Parameters<typeof addChildComponent>) => {
    addChildComponent(...args);
  };

  const handleConfigureComponent = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfiguringComponent(component);
  };

  const onCloseComponentConfigure = () => {
    setConfiguringComponent(null);
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
            {React.createElement(getPreviewerComponentIcon(component.type))}
          </Box>
          <HStack flex={1} justifyContent="flex-start">
            <Text fontSize="sm" color="white">
              {getPreviewerComponentLabel(component.type)}
            </Text>
            {componentIdsWithProblems.has(component.id) && (
              <Icon
                as={FaExclamationCircle}
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
                {component.type === ComponentType.LegacyRoot && (
                  <>
                    <MenuGroup
                      title={`Text (${
                        component.children?.filter((c) => c.type === ComponentType.LegacyText)
                          .length || 0
                      }/1)`}
                    >
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          const hasText = component.children?.some(
                            (c) => c.type === ComponentType.LegacyText
                          );
                          if (hasText) return;
                          onAddChildComponent(component.id, ComponentType.LegacyText);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === ComponentType.LegacyText
                        )}
                      >
                        Add {getPreviewerComponentLabel(ComponentType.LegacyText)}
                      </MenuItem>
                    </MenuGroup>
                    <MenuGroup
                      title={`Embed Container (${
                        component.children?.filter(
                          (c) => c.type === ComponentType.LegacyEmbedContainer
                        ).length || 0
                      }/1)`}
                    >
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={(e) => {
                          const containerCount =
                            component.children?.filter(
                              (c) => c.type === ComponentType.LegacyEmbedContainer
                            ).length || 0;
                          if (containerCount >= 1) return;
                          onAddChildComponent(component.id, ComponentType.LegacyEmbedContainer);
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        isDisabled={
                          (component.children?.filter(
                            (c) => c.type === ComponentType.LegacyEmbedContainer
                          ).length || 0) >= 1
                        }
                      >
                        Add {getPreviewerComponentLabel(ComponentType.LegacyEmbedContainer)}
                      </MenuItem>
                    </MenuGroup>
                    <MenuGroup
                      title={`Action Rows (${
                        component.children?.filter((c) => c.type === ComponentType.LegacyActionRow)
                          .length || 0
                      }/5)`}
                    >
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          const actionRowCount =
                            component.children?.filter(
                              (c) => c.type === ComponentType.LegacyActionRow
                            ).length || 0;
                          if (actionRowCount >= 5) return;
                          onAddChildComponent(component.id, ComponentType.LegacyActionRow);
                        }}
                        isDisabled={
                          (component.children?.filter(
                            (c) => c.type === ComponentType.LegacyActionRow
                          ).length || 0) >= 5
                        }
                      >
                        Add {getPreviewerComponentLabel(ComponentType.LegacyActionRow)}
                      </MenuItem>
                    </MenuGroup>
                  </>
                )}
                {component.type === ComponentType.LegacyEmbed && (
                  <>
                    <MenuGroup title="Embed Components">
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, ComponentType.LegacyEmbedAuthor);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === ComponentType.LegacyEmbedAuthor
                        )}
                      >
                        Add Author
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, ComponentType.LegacyEmbedTitle);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === ComponentType.LegacyEmbedTitle
                        )}
                      >
                        Add Title
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, ComponentType.LegacyEmbedDescription);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === ComponentType.LegacyEmbedDescription
                        )}
                      >
                        Add Description
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, ComponentType.LegacyEmbedImage);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === ComponentType.LegacyEmbedImage
                        )}
                      >
                        Add Image
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, ComponentType.LegacyEmbedThumbnail);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === ComponentType.LegacyEmbedThumbnail
                        )}
                      >
                        Add Thumbnail
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, ComponentType.LegacyEmbedFooter);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === ComponentType.LegacyEmbedFooter
                        )}
                      >
                        Add Footer
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, ComponentType.LegacyEmbedTimestamp);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === ComponentType.LegacyEmbedTimestamp
                        )}
                      >
                        Add Timestamp
                      </MenuItem>
                    </MenuGroup>
                    <MenuGroup
                      title={`Embed Fields (${
                        component.children?.filter((c) => c.type === ComponentType.LegacyEmbedField)
                          .length || 0
                      }/25)`}
                    >
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          const fieldCount =
                            component.children?.filter(
                              (c) => c.type === ComponentType.LegacyEmbedField
                            ).length || 0;
                          if (fieldCount >= 25) return;
                          onAddChildComponent(component.id, ComponentType.LegacyEmbedField);
                        }}
                        isDisabled={
                          (component.children?.filter(
                            (c) => c.type === ComponentType.LegacyEmbedField
                          ).length || 0) >= 25
                        }
                      >
                        Add Field
                      </MenuItem>
                    </MenuGroup>
                  </>
                )}
                {component.type === ComponentType.LegacyEmbedContainer && (
                  <MenuGroup title={`Embeds (${componentChildrenCount}/9)`}>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if (componentChildrenCount >= 9) return;
                        onAddChildComponent(component.id, ComponentType.LegacyEmbed);
                      }}
                      isDisabled={componentChildrenCount >= 9}
                    >
                      Add Embed
                    </MenuItem>
                  </MenuGroup>
                )}
                {component.type === ComponentType.LegacyActionRow && (
                  <MenuGroup title={`Buttons (${componentChildrenCount}/5)`}>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if (componentChildrenCount >= 5) return;
                        onAddChildComponent(component.id, ComponentType.LegacyButton);
                      }}
                      isDisabled={componentChildrenCount >= 5}
                    >
                      Add Button
                    </MenuItem>
                  </MenuGroup>
                )}
                {component.type === ComponentType.V2Root && (
                  <MenuGroup title={`Components (${componentChildrenCount}/10)`}>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if ((component.children?.length || 0) >= 10) return;
                        onAddChildComponent(component.id, ComponentType.V2TextDisplay);
                      }}
                      isDisabled={(component.children?.length || 0) >= 10}
                    >
                      Add Text Display
                    </MenuItem>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        onAddChildComponent(component.id, ComponentType.V2ActionRow);
                      }}
                    >
                      Add Action Row
                    </MenuItem>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        onAddChildComponent(component.id, ComponentType.V2Section);
                      }}
                    >
                      Add Section
                    </MenuItem>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        onAddChildComponent(component.id, ComponentType.V2Divider);
                      }}
                    >
                      Add Divider
                    </MenuItem>
                  </MenuGroup>
                )}
                {component.type === ComponentType.V2ActionRow && (
                  <MenuGroup
                    title={`Components (${(component as ActionRowComponent).children.length}/5)`}
                  >
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        onAddChildComponent(component.id, ComponentType.V2Button);
                      }}
                    >
                      Add Button
                    </MenuItem>
                  </MenuGroup>
                )}
                {component.type === ComponentType.V2Section && (
                  <>
                    <MenuGroup title={`Components (${componentChildrenCount}/3)`}>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, ComponentType.V2TextDisplay);
                        }}
                      >
                        Add Text Display
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, ComponentType.V2Divider);
                        }}
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
                          onAddChildComponent(component.id, ComponentType.V2Button, true);
                        }}
                        isDisabled={hasAccessory}
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
      <SlidingConfigPanel onClose={onCloseComponentConfigure} component={configuringComponent} />
    </>
  );
};
