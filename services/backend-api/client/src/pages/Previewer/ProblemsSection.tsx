import React from "react";
import { Box, HStack, Text, VStack, UnorderedList, ListItem, Icon } from "@chakra-ui/react";
import { FaExclamationTriangle } from "react-icons/fa";
import { useFormContext } from "react-hook-form";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";
import type { MessageComponent, Component, PreviewerProblem } from "./types";
import { ComponentType } from "./types";

export const ProblemsSection: React.FC<{ problems: PreviewerProblem[] }> = ({ problems }) => {
  const { watch } = useFormContext<{ messageComponent: MessageComponent }>();
  const messageComponent = watch("messageComponent");
  const { setCurrentSelectedId, setExpandedIds } = useNavigableTreeContext();

  const getParentIds = (
    component: Component,
    targetId: string,
    parents: string[] = []
  ): string[] | null => {
    if (component.id === targetId) {
      return parents;
    }

    if (component.children) {
      for (let i = 0; i < component.children.length; i += 1) {
        const child = component.children[i];
        const result = getParentIds(child, targetId, [...parents, component.id]);
        if (result) return result;
      }
    }

    if (component.type === ComponentType.Section && component.accessory) {
      const result = getParentIds(component.accessory, targetId, [...parents, component.id]);
      if (result) return result;
    }

    return null;
  };

  const handlePathClick = (componentId: string) => {
    setCurrentSelectedId(componentId);
    const parentIds = getParentIds(messageComponent, componentId);

    if (parentIds) {
      setExpandedIds((prev) => new Set([...prev, ...parentIds]));
    }
  };

  return (
    <VStack align="stretch" spacing={0}>
      <Box p={4} maxH="200px" overflow="auto">
        {problems.length === 0 ? (
          <Text fontSize="sm" color="gray.400" fontStyle="italic">
            No problems found
          </Text>
        ) : (
          <UnorderedList spacing={2} styleType="none" ml={0}>
            {problems.map((problem) => (
              <ListItem key={`${problem.message}-${problem.path}`}>
                <VStack align="stretch" spacing={0} flex={1}>
                  <HStack spacing={2} align="center">
                    <Icon
                      as={FaExclamationTriangle}
                      color="red.400"
                      flexShrink={0}
                      size="sm"
                      aria-label="Error"
                    />
                    <Text fontSize="sm" color="white">
                      {problem.message}
                    </Text>
                  </HStack>
                  <HStack>
                    <Text
                      fontSize="xs"
                      color="blue.300"
                      fontFamily="mono"
                      ml={6}
                      cursor="pointer"
                      _hover={{ color: "blue.200", textDecoration: "underline" }}
                      onClick={() => handlePathClick(problem.componentId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handlePathClick(problem.componentId);
                        }
                      }}
                    >
                      {problem.path}
                    </Text>
                  </HStack>
                </VStack>
              </ListItem>
            ))}
          </UnorderedList>
        )}
      </Box>
    </VStack>
  );
};
