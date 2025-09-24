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
import { FaPlus, FaCog, FaExclamationCircle } from "react-icons/fa";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
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
import MessageBuilderComponent from "./components/base";
import { DiscordComponentType } from "./constants/DiscordComponentType";
import MessageComponentV2Section from "./components/MessageComponentV2Section";

interface ComponentTreeItemProps {
  component: MessageBuilderComponent;
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
  const { isOpen, activeComponent, openConfig, closeConfig } = useConfigPanel();
  const ref = React.useRef<HTMLDivElement>(null);

  const componentChildrenCount = component.children?.length || 0;
  const hasChildren = component.children && component.children.length > 0;
  const hasAccessory =
    component.type === DiscordComponentType.V2Section &&
    (component as MessageComponentV2Section).accessory !== undefined;
  const canHaveChildren =
    component.type === DiscordComponentType.LegacyRoot ||
    component.type === DiscordComponentType.LegacyEmbed ||
    component.type === DiscordComponentType.LegacyActionRow ||
    component.type === DiscordComponentType.V2Root ||
    component.type === DiscordComponentType.V2ActionRow ||
    component.type === DiscordComponentType.V2Section;
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
            {React.createElement(component.icon)}
          </Box>
          <HStack flex={1} justifyContent="flex-start">
            <Text fontSize="sm" color="white">
              {component.label}
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
                {component.type === DiscordComponentType.LegacyRoot && (
                  <>
                    <MenuGroup
                      title={`Text (${
                        component.children?.filter(
                          (c) => c.type === DiscordComponentType.LegacyText
                        ).length || 0
                      }/1)`}
                    >
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          const hasText = component.children?.some(
                            (c) => c.type === DiscordComponentType.LegacyText
                          );
                          if (hasText) return;
                          onAddChildComponent(component.id, DiscordComponentType.LegacyText);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === DiscordComponentType.LegacyText
                        )}
                      >
                        Add Text
                      </MenuItem>
                    </MenuGroup>
                    <MenuGroup
                      title={`Embeds (${
                        component.children?.filter(
                          (c) => c.type === DiscordComponentType.LegacyEmbed
                        ).length || 0
                      }/9)`}
                    >
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          const embedCount =
                            component.children?.filter(
                              (c) => c.type === DiscordComponentType.LegacyEmbed
                            ).length || 0;
                          if (embedCount >= 9) return;
                          onAddChildComponent(component.id, DiscordComponentType.LegacyEmbed);
                        }}
                        aria-disabled={
                          (component.children?.filter(
                            (c) => c.type === DiscordComponentType.LegacyEmbed
                          ).length || 0) >= 9
                        }
                      >
                        Add Embed
                      </MenuItem>
                    </MenuGroup>
                    <MenuGroup
                      title={`Action Rows (${
                        component.children?.filter(
                          (c) => c.type === DiscordComponentType.LegacyActionRow
                        ).length || 0
                      }/5)`}
                    >
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          const actionRowCount =
                            component.children?.filter(
                              (c) => c.type === DiscordComponentType.LegacyActionRow
                            ).length || 0;
                          if (actionRowCount >= 5) return;
                          onAddChildComponent(component.id, DiscordComponentType.LegacyActionRow);
                        }}
                        aria-disabled={
                          (component.children?.filter(
                            (c) => c.type === DiscordComponentType.LegacyActionRow
                          ).length || 0) >= 5
                        }
                      >
                        Add Action Row
                      </MenuItem>
                    </MenuGroup>
                  </>
                )}
                {component.type === DiscordComponentType.LegacyEmbed && (
                  <>
                    <MenuGroup title="Embed Components">
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, DiscordComponentType.LegacyEmbedAuthor);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === DiscordComponentType.LegacyEmbedAuthor
                        )}
                      >
                        Add Author
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, DiscordComponentType.LegacyEmbedTitle);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === DiscordComponentType.LegacyEmbedTitle
                        )}
                      >
                        Add Title
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(
                            component.id,
                            DiscordComponentType.LegacyEmbedDescription
                          );
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === DiscordComponentType.LegacyEmbedDescription
                        )}
                      >
                        Add Description
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, DiscordComponentType.LegacyEmbedImage);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === DiscordComponentType.LegacyEmbedImage
                        )}
                      >
                        Add Image
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(
                            component.id,
                            DiscordComponentType.LegacyEmbedThumbnail
                          );
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === DiscordComponentType.LegacyEmbedThumbnail
                        )}
                      >
                        Add Thumbnail
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, DiscordComponentType.LegacyEmbedFooter);
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === DiscordComponentType.LegacyEmbedFooter
                        )}
                      >
                        Add Footer
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(
                            component.id,
                            DiscordComponentType.LegacyEmbedTimestamp
                          );
                        }}
                        isDisabled={component.children?.some(
                          (c) => c.type === DiscordComponentType.LegacyEmbedTimestamp
                        )}
                      >
                        Add Timestamp
                      </MenuItem>
                    </MenuGroup>
                    <MenuGroup
                      title={`Embed Fields (${
                        component.children?.filter(
                          (c) => c.type === DiscordComponentType.LegacyEmbedField
                        ).length || 0
                      }/25)`}
                    >
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          const fieldCount =
                            component.children?.filter(
                              (c) => c.type === DiscordComponentType.LegacyEmbedField
                            ).length || 0;
                          if (fieldCount >= 25) return;
                          onAddChildComponent(component.id, DiscordComponentType.LegacyEmbedField);
                        }}
                        aria-disabled={
                          (component.children?.filter(
                            (c) => c.type === DiscordComponentType.LegacyEmbedField
                          ).length || 0) >= 25
                        }
                      >
                        Add Field
                      </MenuItem>
                    </MenuGroup>
                  </>
                )}
                {component.type === DiscordComponentType.LegacyActionRow && (
                  <MenuGroup title={`Buttons (${componentChildrenCount}/5)`}>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if (componentChildrenCount >= 5) return;
                        onAddChildComponent(component.id, DiscordComponentType.LegacyButton);
                      }}
                      aria-disabled={componentChildrenCount >= 5}
                    >
                      Add Button
                    </MenuItem>
                  </MenuGroup>
                )}
                {component.type === DiscordComponentType.V2Root && (
                  <MenuGroup title={`Components (${componentChildrenCount}/10)`}>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        if ((component.children?.length || 0) >= 10) return;
                        onAddChildComponent(component.id, DiscordComponentType.V2TextDisplay);
                      }}
                      aria-disabled={(component.children?.length || 0) >= 10}
                    >
                      Add Text Display
                    </MenuItem>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        onAddChildComponent(component.id, DiscordComponentType.V2ActionRow);
                      }}
                    >
                      Add Action Row
                    </MenuItem>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        onAddChildComponent(component.id, DiscordComponentType.V2Section);
                      }}
                    >
                      Add Section
                    </MenuItem>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        onAddChildComponent(component.id, DiscordComponentType.V2Divider);
                      }}
                    >
                      Add Divider
                    </MenuItem>
                  </MenuGroup>
                )}
                {component.type === DiscordComponentType.V2ActionRow && (
                  <MenuGroup title={`Components (${component.children?.length || 0}/5)`}>
                    <MenuItem
                      bg="gray.700"
                      _hover={{ bg: "gray.600" }}
                      color="white"
                      onClick={() => {
                        onAddChildComponent(component.id, DiscordComponentType.V2Button);
                      }}
                    >
                      Add Button
                    </MenuItem>
                  </MenuGroup>
                )}
                {component.type === DiscordComponentType.V2Section && (
                  <>
                    <MenuGroup title={`Components (${componentChildrenCount}/3)`}>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, DiscordComponentType.V2TextDisplay);
                        }}
                      >
                        Add Text Display
                      </MenuItem>
                      <MenuItem
                        bg="gray.700"
                        _hover={{ bg: "gray.600" }}
                        color="white"
                        onClick={() => {
                          onAddChildComponent(component.id, DiscordComponentType.V2Divider);
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
                          onAddChildComponent(component.id, DiscordComponentType.V2Button, true);
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
                <NavigableTreeItem ariaLabel={child.label} id={child.id} key={child.id}>
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
                  ariaLabel={`${
                    (component as MessageComponentV2Section).accessory!.label
                  } (Accessory)`}
                  id={(component as MessageComponentV2Section).accessory!.id}
                  key={`accessory-${(component as MessageComponentV2Section).accessory!.id}`}
                >
                  <ComponentTreeItem
                    component={(component as MessageComponentV2Section).accessory!}
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
