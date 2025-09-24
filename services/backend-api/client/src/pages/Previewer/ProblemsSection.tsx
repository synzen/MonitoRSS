import React from "react";
import { Box, HStack, Text, VStack, UnorderedList, ListItem, Icon } from "@chakra-ui/react";
import { FaExclamationCircle } from "react-icons/fa";
import { useFormContext } from "react-hook-form";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";
import type { Component, PreviewerProblem } from "./types";
import { ComponentType } from "./types";
import PreviewerFormState from "./types/PreviewerFormState";

export const ProblemsSection: React.FC<{
  problems: PreviewerProblem[];
  onClickComponentPath: (componentIdsToExpand: string[]) => void;
}> = ({ problems, onClickComponentPath }) => {
  const { watch } = useFormContext<PreviewerFormState>();
  const messageComponent = watch("messageComponent");
  const { setCurrentSelectedId, setExpandedIds } = useNavigableTreeContext();

  const getParentIds = (
    component: Component | undefined,
    targetId: string,
    parents: string[] = []
  ): string[] | null => {
    if (!component) return null;

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

    if (component.type === ComponentType.V2Section && component.accessory) {
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
      <Box p={4}>
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
                      as={FaExclamationCircle}
                      color="red.400"
                      flexShrink={0}
                      size="sm"
                      aria-hidden
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
                      onClick={() => {
                        handlePathClick(problem.componentId);
                        const parentIds = getParentIds(messageComponent, problem.componentId);

                        if (parentIds) {
                          onClickComponentPath(parentIds);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handlePathClick(problem.componentId);
                          const parentIds = getParentIds(messageComponent, problem.componentId);

                          if (parentIds) {
                            onClickComponentPath(parentIds);
                          }
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
