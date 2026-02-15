import React, { useEffect, useState } from "react";
import { Box, VStack, HStack, Text, IconButton, Icon, Button } from "@chakra-ui/react";
import { FaExclamationCircle, FaExclamationTriangle, FaCog } from "react-icons/fa";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { AddComponentButton } from "./AddComponentButton";
import type { Component, SectionComponent } from "./types";
import { ComponentType, canComponentHaveChildren } from "./types";
import {
  NavigableTreeItem,
  NavigableTreeItemExpandButton,
  NavigableTreeItemGroup,
} from "../../components/NavigableTree";
import { useNavigableTreeItemContext } from "../../contexts/NavigableTreeItemContext";
import { useMessageBuilderContext } from "./MessageBuilderContext";
import { SlidingConfigPanel } from "./SlidingConfigPanel";

import getChakraColor from "../../utils/getChakraColor";
import getMessageBuilderComponentLabel from "./utils/getMessageBuilderComponentLabel";
import getMessageBuilderComponentIcon from "./utils/getMessageBuilderComponentIcon";
import { notifyInfo } from "../../utils/notifyInfo";
import { useIsMessageBuilderDesktop } from "../../hooks";

interface ComponentTreeItemProps {
  component: Component;
  depth?: number;
  scrollToComponentId?: string | null;
  componentIdsWithErrors: Set<string>;
  componentIdsWithWarnings: Set<string>;
  isAccessory?: boolean;
}

export const ComponentTreeItem: React.FC<ComponentTreeItemProps> = ({
  component,
  depth = 0,
  scrollToComponentId,
  componentIdsWithErrors,
  componentIdsWithWarnings,
  isAccessory = false,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const { onExpanded } = useNavigableTreeItemContext();
  const { addChildComponent } = useMessageBuilderContext();
  const isDesktop = useIsMessageBuilderDesktop();
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

  const hasChildren = component.children && component.children.length > 0;
  const hasAccessory =
    component.type === ComponentType.V2Section &&
    (component as SectionComponent).accessory !== undefined;
  const canHaveChildren = canComponentHaveChildren(component.type);
  const { isFocused, isExpanded, isSelected } = useNavigableTreeItemContext();

  const handleAddChild = (childType: ComponentType, asAccessory?: boolean) => {
    const added = addChildComponent(component.id, childType as any, asAccessory);

    if (added) {
      notifyInfo(
        `Successfully added ${getMessageBuilderComponentLabel(
          childType,
        )} component under ${getMessageBuilderComponentLabel(component.type)}`,
      );
    }
  };

  React.useEffect(() => {
    if (scrollToComponentId === component.id && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [scrollToComponentId]);

  useEffect(() => {
    onExpanded();
  }, []);

  const showMobileActions = isSelected;

  return (
    <VStack align="stretch" spacing={0} position="relative" ref={ref}>
      <HStack
        pl={2 + depth * 4}
        pr={2}
        py={2}
        cursor="pointer"
        bg={isSelected ? "blue.600" : "transparent"}
        _hover={{ bg: isSelected ? "blue.600" : "gray.700" }}
        outline={isFocused ? `2px solid ${getChakraColor("blue.300")}` : undefined}
        data-tour-target={isSelected ? "selected-component" : undefined}
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
          {React.createElement(getMessageBuilderComponentIcon(component.type))}
        </Box>
        <HStack flex={1} justifyContent="space-between" position="relative">
          <HStack>
            <Text fontSize="sm" color="white">
              {isAccessory && (
                <Text as="span" color={isSelected ? "white" : "gray.400"} fontWeight="normal">
                  [Accessory]{" "}
                </Text>
              )}
              {getMessageBuilderComponentLabel(component.type)}
            </Text>
            {componentIdsWithErrors.has(component.id) && (
              <Icon
                as={FaExclamationCircle}
                color={isSelected ? "white" : "red.400"}
                flexShrink={0}
                size="sm"
                aria-label="Error detected"
                title="Error detected"
              />
            )}
            {!componentIdsWithErrors.has(component.id) &&
              componentIdsWithWarnings.has(component.id) && (
                <Icon
                  as={FaExclamationTriangle}
                  color={isSelected ? "white" : "orange.400"}
                  flexShrink={0}
                  size="sm"
                  aria-label="Warning detected"
                  title="Warning detected"
                />
              )}
          </HStack>
        </HStack>{" "}
        {isSelected && isDesktop && (
          <Box position="absolute" right="5px" top="5px">
            <AddComponentButton
              component={component}
              canHaveChildren={canHaveChildren}
              onAddChild={handleAddChild}
            />
          </Box>
        )}
      </HStack>
      {/* Mobile inline action buttons - only show on pointer interaction, not keyboard focus */}
      {!isDesktop && showMobileActions && (
        <HStack pl={2 + depth * 4 + 6} pr={2} py={2} spacing={2} bg="gray.750">
          <AddComponentButton
            component={component}
            canHaveChildren={canHaveChildren}
            onAddChild={handleAddChild}
            buttonProps={{
              size: "sm",
              variant: "solid",
            }}
          />
          <Button
            leftIcon={<FaCog />}
            size="sm"
            variant="solid"
            onClick={() => setIsConfigPanelOpen(true)}
          >
            Configure
          </Button>
        </HStack>
      )}
      {!isDesktop && (
        <SlidingConfigPanel
          isOpen={isConfigPanelOpen}
          onClose={() => setIsConfigPanelOpen(false)}
        />
      )}
      {(hasChildren || hasAccessory) && isExpanded && (
        <VStack align="stretch" spacing={0}>
          <NavigableTreeItemGroup>
            {component.children?.map((child) => (
              <NavigableTreeItem ariaLabel={child.name} id={child.id} key={child.id}>
                <ComponentTreeItem
                  component={child}
                  depth={depth + 1}
                  scrollToComponentId={scrollToComponentId}
                  componentIdsWithErrors={componentIdsWithErrors}
                  componentIdsWithWarnings={componentIdsWithWarnings}
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
                  componentIdsWithErrors={componentIdsWithErrors}
                  componentIdsWithWarnings={componentIdsWithWarnings}
                  isAccessory
                />
              </NavigableTreeItem>
            )}
          </NavigableTreeItemGroup>
        </VStack>
      )}
    </VStack>
  );
};
