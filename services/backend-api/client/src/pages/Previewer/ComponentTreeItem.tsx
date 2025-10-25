import React, { useEffect } from "react";
import { Box, VStack, HStack, Text, IconButton, Icon } from "@chakra-ui/react";
import { FaExclamationCircle } from "react-icons/fa";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { AddComponentButton } from "./AddComponentButton";
import type { Component, SectionComponent } from "./types";
import { ComponentType } from "./types";
import {
  NavigableTreeItem,
  NavigableTreeItemExpandButton,
  NavigableTreeItemGroup,
} from "../../components/NavigableTree";
import { useNavigableTreeItemContext } from "../../contexts/NavigableTreeItemContext";
import { usePreviewerContext } from "./PreviewerContext";

import getChakraColor from "../../utils/getChakraColor";
import getPreviewerComponentLabel from "./utils/getPreviewerComponentLabel";
import getPreviewerComponentIcon from "./utils/getPreviewerComponentIcon";
import { notifyInfo } from "../../utils/notifyInfo";
import { useIsPreviewerDesktop } from "../../hooks";

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
  const ref = React.useRef<HTMLDivElement>(null);
  const { onExpanded } = useNavigableTreeItemContext();
  const { addChildComponent } = usePreviewerContext();
  const isDesktop = useIsPreviewerDesktop();

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

  const handleAddChild = (childType: ComponentType) => {
    const added = addChildComponent(component.id, childType as any);

    if (added) {
      notifyInfo(
        `Successfully added ${getPreviewerComponentLabel(
          childType
        )} component under ${getPreviewerComponentLabel(component.type)}`
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
          {React.createElement(getPreviewerComponentIcon(component.type))}
        </Box>
        <HStack flex={1} justifyContent="space-between" position="relative">
          <HStack>
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
  );
};
