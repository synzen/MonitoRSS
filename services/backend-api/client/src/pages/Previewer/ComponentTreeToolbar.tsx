import React, { useState } from "react";
import {
  Box,
  HStack,
  VStack,
  Button,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuGroup,
  Text,
  Tooltip,
  MenuDivider,
} from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";
import { AddIcon } from "@chakra-ui/icons";
import { FaCog } from "react-icons/fa";
import { VscCollapseAll } from "react-icons/vsc";
import { ComponentType, Component, SectionComponent } from "./types";
import { usePreviewerContext } from "./PreviewerContext";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";
import PreviewerFormState from "./types/PreviewerFormState";
import getPreviewerComponentLabel from "./utils/getPreviewerComponentLabel";
import { SlidingConfigPanel } from "./SlidingConfigPanel";

export const ComponentTreeToolbar: React.FC = () => {
  const { addChildComponent } = usePreviewerContext();
  const { currentSelectedId, setCurrentSelectedId, setExpandedIds } = useNavigableTreeContext();
  const { watch } = useFormContext<PreviewerFormState>();
  const messageComponent = watch("messageComponent");
  const [configuringComponent, setConfiguringComponent] = useState<Component | null>(null);

  // Find the selected component recursively
  const findComponentById = (component: Component | null, id: string): Component | null => {
    if (!component) return null;
    if (component.id === id) return component;

    if (component.children) {
      // eslint-disable-next-line no-restricted-syntax
      for (const child of component.children) {
        const found = findComponentById(child, id);
        if (found) return found;
      }
    }

    if (component.type === ComponentType.V2Section) {
      const sectionComponent = component as SectionComponent;

      if (sectionComponent.accessory) {
        const found = findComponentById(sectionComponent.accessory, id);
        if (found) return found;
      }
    }

    return null;
  };

  const handleCollapseAll = () => {
    setExpandedIds(() => new Set());
  };

  const selectedComponent = currentSelectedId
    ? findComponentById(messageComponent || null, currentSelectedId)
    : null;

  const canAddChildren =
    selectedComponent &&
    (selectedComponent.type === ComponentType.LegacyRoot ||
      selectedComponent.type === ComponentType.LegacyEmbedContainer ||
      selectedComponent.type === ComponentType.LegacyEmbed ||
      selectedComponent.type === ComponentType.LegacyActionRow ||
      selectedComponent.type === ComponentType.V2Root ||
      selectedComponent.type === ComponentType.V2ActionRow ||
      selectedComponent.type === ComponentType.V2Section);

  const handleAddChild = (childType: ComponentType) => {
    if (!selectedComponent) return;
    const added = addChildComponent(selectedComponent.id, childType as any);

    if (added) {
      setCurrentSelectedId(added.id);
    }
  };

  const handleConfigureComponent = () => {
    if (!selectedComponent) return;
    setConfiguringComponent(selectedComponent);
  };

  const onCloseComponentConfigure = () => {
    setConfiguringComponent(null);
  };

  return (
    <>
      <Box p={3} borderBottom="1px" borderColor="gray.600">
        <HStack justify="space-between" align="center" flexWrap="wrap">
          <VStack align="start" spacing={1} display={{ base: "none", lg: "block" }}>
            <Text fontSize="md" fontWeight="bold" color="white" as="h2">
              Components
            </Text>
            <Text fontSize="sm" color="gray.400" display="inline">
              Selected:{" "}
              <Text
                display="inline"
                fontWeight={selectedComponent ? "semibold" : undefined}
                fontStyle={!selectedComponent ? "italic" : "normal"}
              >
                {selectedComponent ? getPreviewerComponentLabel(selectedComponent.type) : "None"}
              </Text>
            </Text>
          </VStack>
          <VStack align="start" spacing={1} display={{ base: "block", lg: "none" }}>
            <Text fontSize="md" display="inline">
              Selected:{" "}
              <Text
                display="inline"
                fontWeight={selectedComponent ? "semibold" : undefined}
                fontStyle={!selectedComponent ? "italic" : "normal"}
              >
                {selectedComponent ? getPreviewerComponentLabel(selectedComponent.type) : "None"}
              </Text>
            </Text>
          </VStack>
          <HStack spacing={2} flexWrap="wrap">
            <Tooltip label="Collapse all components" placement="top">
              <IconButton
                icon={<VscCollapseAll />}
                size={{ base: "md", lg: "sm" }}
                variant="ghost"
                onClick={handleCollapseAll}
                isDisabled={!messageComponent}
                aria-label="Collapse all components"
              />
            </Tooltip>
            <Button
              display={{
                base: "inline-flex",
                lg: "none",
              }}
              leftIcon={<FaCog />}
              size="md"
              variant="ghost"
              onClick={() => {
                if (!selectedComponent) {
                  return;
                }

                handleConfigureComponent();
              }}
              aria-disabled={!selectedComponent}
            >
              Configure
            </Button>
            <Menu>
              <MenuButton
                as={Button}
                leftIcon={<AddIcon />}
                size={{ base: "md", lg: "sm" }}
                variant="ghost"
                aria-disabled={!canAddChildren}
                data-tour-target="add-component-button"
                onClick={(e) => {
                  if (!canAddChildren) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                New Component
              </MenuButton>
              <MenuList bg="gray.700" borderColor="gray.600">
                {selectedComponent?.type === ComponentType.LegacyRoot && (
                  <>
                    <MenuGroup
                      title={`Text (${
                        selectedComponent?.children?.filter(
                          (c) => c.type === ComponentType.LegacyText
                        ).length || 0
                      }/1)`}
                    >
                      <MenuItem
                        color="white"
                        onClick={() => handleAddChild(ComponentType.LegacyText)}
                        isDisabled={selectedComponent?.children?.some(
                          (c) => c.type === ComponentType.LegacyText
                        )}
                      >
                        Add {getPreviewerComponentLabel(ComponentType.LegacyText)}
                      </MenuItem>
                    </MenuGroup>
                    <MenuDivider />
                    <MenuGroup
                      title={`Embed Container (${
                        selectedComponent?.children?.filter(
                          (c) => c.type === ComponentType.LegacyEmbedContainer
                        ).length || 0
                      }/1)`}
                    >
                      <MenuItem
                        color="white"
                        onClick={() => handleAddChild(ComponentType.LegacyEmbedContainer)}
                        isDisabled={selectedComponent?.children?.some(
                          (c) => c.type === ComponentType.LegacyEmbedContainer
                        )}
                      >
                        Add {getPreviewerComponentLabel(ComponentType.LegacyEmbedContainer)}
                      </MenuItem>
                    </MenuGroup>
                    <MenuDivider />
                    <MenuGroup
                      title={`Action Rows (${
                        selectedComponent?.children?.filter(
                          (c) => c.type === ComponentType.LegacyActionRow
                        ).length || 0
                      }/5)`}
                    >
                      <MenuItem
                        color="white"
                        onClick={() => handleAddChild(ComponentType.LegacyActionRow)}
                        isDisabled={
                          (selectedComponent?.children?.filter(
                            (c) => c.type === ComponentType.LegacyActionRow
                          ).length || 0) >= 5
                        }
                      >
                        Add {getPreviewerComponentLabel(ComponentType.LegacyActionRow)}
                      </MenuItem>
                    </MenuGroup>
                  </>
                )}
                {selectedComponent?.type === ComponentType.LegacyEmbed && (
                  <MenuGroup title="Embed Components">
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyEmbedAuthor)}
                      isDisabled={selectedComponent?.children?.some(
                        (c) => c.type === ComponentType.LegacyEmbedAuthor
                      )}
                    >
                      Add Author
                    </MenuItem>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyEmbedTitle)}
                      isDisabled={selectedComponent?.children?.some(
                        (c) => c.type === ComponentType.LegacyEmbedTitle
                      )}
                    >
                      Add Title
                    </MenuItem>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyEmbedDescription)}
                      isDisabled={selectedComponent?.children?.some(
                        (c) => c.type === ComponentType.LegacyEmbedDescription
                      )}
                    >
                      Add Description
                    </MenuItem>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyEmbedImage)}
                      isDisabled={selectedComponent?.children?.some(
                        (c) => c.type === ComponentType.LegacyEmbedImage
                      )}
                    >
                      Add Image
                    </MenuItem>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyEmbedThumbnail)}
                      isDisabled={selectedComponent?.children?.some(
                        (c) => c.type === ComponentType.LegacyEmbedThumbnail
                      )}
                    >
                      Add Thumbnail
                    </MenuItem>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyEmbedFooter)}
                      isDisabled={selectedComponent?.children?.some(
                        (c) => c.type === ComponentType.LegacyEmbedFooter
                      )}
                    >
                      Add Footer
                    </MenuItem>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyEmbedTimestamp)}
                      isDisabled={selectedComponent?.children?.some(
                        (c) => c.type === ComponentType.LegacyEmbedTimestamp
                      )}
                    >
                      Add Timestamp
                    </MenuItem>
                  </MenuGroup>
                )}
                {selectedComponent?.type === ComponentType.LegacyEmbed && (
                  <MenuGroup
                    title={`Embed Fields (${
                      selectedComponent?.children?.filter(
                        (c) => c.type === ComponentType.LegacyEmbedField
                      ).length || 0
                    }/25)`}
                  >
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyEmbedField)}
                      isDisabled={
                        (selectedComponent?.children?.filter(
                          (c) => c.type === ComponentType.LegacyEmbedField
                        ).length || 0) >= 25
                      }
                    >
                      Add Field
                    </MenuItem>
                  </MenuGroup>
                )}
                {selectedComponent?.type === ComponentType.LegacyEmbedContainer && (
                  <MenuGroup title={`Embeds (${selectedComponent?.children?.length || 0}/9)`}>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyEmbed)}
                      isDisabled={(selectedComponent?.children?.length || 0) >= 9}
                    >
                      Add Embed
                    </MenuItem>
                  </MenuGroup>
                )}
                {selectedComponent?.type === ComponentType.LegacyActionRow && (
                  <MenuGroup title={`Buttons (${selectedComponent?.children?.length || 0}/5)`}>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.LegacyButton)}
                      isDisabled={(selectedComponent?.children?.length || 0) >= 5}
                    >
                      Add Button
                    </MenuItem>
                  </MenuGroup>
                )}
                {selectedComponent?.type === ComponentType.V2Root && (
                  <MenuGroup title={`Components (${selectedComponent?.children?.length || 0}/10)`}>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.V2TextDisplay)}
                      isDisabled={(selectedComponent?.children?.length || 0) >= 10}
                    >
                      Add Text Display
                    </MenuItem>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.V2ActionRow)}
                    >
                      Add Action Row
                    </MenuItem>
                    <MenuItem color="white" onClick={() => handleAddChild(ComponentType.V2Section)}>
                      Add Section
                    </MenuItem>
                  </MenuGroup>
                )}
                {selectedComponent?.type === ComponentType.V2ActionRow && (
                  <MenuGroup title={`Buttons (${selectedComponent?.children?.length || 0}/5)`}>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.V2Button)}
                      isDisabled={(selectedComponent?.children?.length || 0) >= 5}
                    >
                      Add Button
                    </MenuItem>
                  </MenuGroup>
                )}
                {selectedComponent?.type === ComponentType.V2Section && (
                  <MenuGroup title={`Components (${selectedComponent?.children?.length || 0}/3)`}>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.V2TextDisplay)}
                      isDisabled={(selectedComponent?.children?.length || 0) >= 3}
                    >
                      Add Text Display
                    </MenuItem>
                    <MenuItem
                      color="white"
                      onClick={() => handleAddChild(ComponentType.V2Divider)}
                      isDisabled={(selectedComponent?.children?.length || 0) >= 3}
                    >
                      Add Divider
                    </MenuItem>
                  </MenuGroup>
                )}
              </MenuList>
            </Menu>
          </HStack>
        </HStack>
      </Box>
      <SlidingConfigPanel onClose={onCloseComponentConfigure} component={configuringComponent} />
    </>
  );
};
