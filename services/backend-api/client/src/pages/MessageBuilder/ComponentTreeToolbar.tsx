import React, { useState } from "react";
import { Box, HStack, VStack, Button, Text } from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";
import { FaCog } from "react-icons/fa";
import { VscCollapseAll } from "react-icons/vsc";
import { ComponentType, Component, SectionComponent, canComponentHaveChildren } from "./types";
import { useMessageBuilderContext } from "./MessageBuilderContext";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";
import MessageBuilderFormState from "./types/MessageBuilderFormState";
import getMessageBuilderComponentLabel from "./utils/getMessageBuilderComponentLabel";
import { SlidingConfigPanel } from "./SlidingConfigPanel";
import { AddComponentButton } from "./AddComponentButton";
import { notifyInfo } from "../../utils/notifyInfo";
import { MESSAGE_BUILDER_MOBILE_BREAKPOINT } from "./constants/MessageBuilderMobileBreakpoint";
import { useIsMessageBuilderDesktop } from "../../hooks";

export const ComponentTreeToolbar: React.FC = () => {
  const { addChildComponent } = useMessageBuilderContext();
  const { currentSelectedId, setExpandedIds } = useNavigableTreeContext();
  const { watch } = useFormContext<MessageBuilderFormState>();
  const messageComponent = watch("messageComponent");
  const [isConfiguringComponent, setIsConfiguringComponent] = useState<boolean>(false);
  const isDesktop = useIsMessageBuilderDesktop();

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

  const canAddChildren = selectedComponent && canComponentHaveChildren(selectedComponent.type);

  const handleAddChild = (childType: ComponentType, isAccessory?: boolean) => {
    if (!selectedComponent) return;
    const added = addChildComponent(selectedComponent.id, childType as any, isAccessory);

    if (added) {
      notifyInfo(
        `Successfully added ${getMessageBuilderComponentLabel(
          childType
        )} component under ${getMessageBuilderComponentLabel(selectedComponent.type)}`
      );
    }
  };

  const handleConfigureComponent = () => {
    if (!selectedComponent) return;
    setIsConfiguringComponent(true);
  };

  const onCloseComponentConfigure = () => {
    setIsConfiguringComponent(false);
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
            <HStack
              align="center"
              width="100%"
              display={{ base: "flex", [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: "none" }}
              flexWrap="wrap"
            >
              <Text fontSize="md">
                Selected:{" "}
                <Text
                  display="inline"
                  fontWeight={selectedComponent ? "semibold" : undefined}
                  fontStyle={!selectedComponent ? "italic" : "normal"}
                >
                  {selectedComponent
                    ? getMessageBuilderComponentLabel(selectedComponent.type)
                    : "None"}
                </Text>
              </Text>
              <HStack spacing={2} flexWrap="wrap">
                {selectedComponent && (
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
                <Button
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
              </HStack>
            </HStack>
          )}
          {isDesktop && (
            <HStack spacing={2} flexWrap="wrap">
              <Button
                leftIcon={<VscCollapseAll />}
                variant="ghost"
                onClick={handleCollapseAll}
                isDisabled={!messageComponent}
              >
                Collapse all
              </Button>
            </HStack>
          )}
        </HStack>
      </Box>
      <SlidingConfigPanel onClose={onCloseComponentConfigure} isOpen={!!isConfiguringComponent} />
    </>
  );
};
