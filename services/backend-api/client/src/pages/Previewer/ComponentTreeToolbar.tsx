import React, { useState } from "react";
import { Box, HStack, VStack, Button, Text } from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";
import { FaCog } from "react-icons/fa";
import { VscCollapseAll } from "react-icons/vsc";
import { ComponentType, Component, SectionComponent } from "./types";
import { usePreviewerContext } from "./PreviewerContext";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";
import PreviewerFormState from "./types/PreviewerFormState";
import getPreviewerComponentLabel from "./utils/getPreviewerComponentLabel";
import { SlidingConfigPanel } from "./SlidingConfigPanel";
import { AddComponentButton } from "./AddComponentButton";
import { notifyInfo } from "../../utils/notifyInfo";
import { MESSAGE_BUILDER_MOBILE_BREAKPOINT } from "./constants/MessageBuilderMobileBreakpoint";
import { useIsPreviewerDesktop } from "../../hooks";

export const ComponentTreeToolbar: React.FC = () => {
  const { addChildComponent } = usePreviewerContext();
  const { currentSelectedId, setExpandedIds } = useNavigableTreeContext();
  const { watch } = useFormContext<PreviewerFormState>();
  const messageComponent = watch("messageComponent");
  const [configuringComponent, setConfiguringComponent] = useState<Component | null>(null);
  const isDesktop = useIsPreviewerDesktop();

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
      notifyInfo(
        `Successfully added ${getPreviewerComponentLabel(
          childType
        )} component under ${getPreviewerComponentLabel(selectedComponent.type)}`
      );
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
          {isDesktop && (
            <VStack align="start" spacing={1}>
              <Text fontSize="md" fontWeight="bold" color="white" as="h2">
                Components
              </Text>
            </VStack>
          )}
          {!isDesktop && (
            <VStack
              align="start"
              spacing={1}
              display={{ base: "block", [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: "none" }}
            >
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
          )}
          <HStack spacing={2} flexWrap="wrap">
            {isDesktop && (
              <Button
                leftIcon={<VscCollapseAll />}
                size="sm"
                variant="ghost"
                onClick={handleCollapseAll}
                isDisabled={!messageComponent}
              >
                Collapse all
              </Button>
            )}
            {selectedComponent && !isDesktop && (
              <Box>
                <AddComponentButton
                  component={selectedComponent}
                  canHaveChildren={!!canAddChildren}
                  onAddChild={handleAddChild}
                  buttonProps={{
                    variant: "solid",
                    colorScheme: undefined,
                    size: "sm",
                  }}
                />
              </Box>
            )}
            {!isDesktop && (
              <Button
                display={{
                  base: "inline-flex",
                  [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: "none",
                }}
                leftIcon={<FaCog />}
                size="sm"
                variant="solid"
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
            )}
          </HStack>
        </HStack>
      </Box>
      <SlidingConfigPanel onClose={onCloseComponentConfigure} component={configuringComponent} />
    </>
  );
};
