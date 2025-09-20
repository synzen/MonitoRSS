import React from "react";
import { Box, HStack, Text, VStack, UnorderedList, ListItem, Icon } from "@chakra-ui/react";
import { FaExclamationTriangle } from "react-icons/fa";
import { useFormContext } from "react-hook-form";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";
import type { MessageComponent, Component } from "./types";
import { ComponentType } from "./types";

export const ProblemsSection: React.FC = () => {
  const { formState, watch } = useFormContext<{ messageComponent: MessageComponent }>();
  const messageComponent = watch("messageComponent");
  const { setCurrentSelectedId, setExpandedIds } = useNavigableTreeContext();

  const getComponentPath = (
    component: Component,
    targetId: string,
    currentPath = ""
  ): string | null => {
    interface StackItem {
      component: Component;
      path: string;
    }

    const stack: StackItem[] = [{ component, path: currentPath || component.name }];

    while (stack.length > 0) {
      const { component: currentComponent, path } = stack.pop()!;

      if (currentComponent.id === targetId) {
        return path;
      }

      // Add accessory to stack (will be processed first due to stack LIFO nature)
      if (currentComponent.type === ComponentType.Section && currentComponent.accessory) {
        const accessoryPath = `${path} > ${currentComponent.accessory.name} (accessory)`;
        stack.push({ component: currentComponent.accessory, path: accessoryPath });
      }

      // Add children to stack in reverse order to maintain left-to-right processing
      if (currentComponent.children) {
        for (let i = currentComponent.children.length - 1; i >= 0; i -= 1) {
          const child = currentComponent.children[i];
          const childPath = `${path} > ${child.name}`;
          stack.push({ component: child, path: childPath });
        }
      }
    }

    return null;
  };

  const extractProblems = () => {
    const problems: Array<{ message: string; path: string; componentId: string }> = [];

    const processErrors = (errors: Record<string, any>, component: Component, currentPath = "") => {
      if (!errors || typeof errors !== "object") return;

      Object.keys(errors).forEach((key) => {
        // Example key would be "content" for a text display component
        if (typeof errors[key] === "object" && errors[key].message) {
          // This is a direct error message for the current component
          problems.push({
            message: errors[key].message,
            path: getComponentPath(messageComponent, component.id) || component.name,
            componentId: component.id,
          });
        }

        if (key === "children" && Array.isArray(errors[key])) {
          errors.children.forEach((childError: any, index: number) => {
            if (childError && component.children?.[index]) {
              processErrors(childError, component.children[index], currentPath);
            }
          });
        }

        if (
          key === "accessory" &&
          errors[key] &&
          component.type === ComponentType.Section &&
          component.accessory
        ) {
          processErrors(errors.accessory, component.accessory, currentPath);
        }
      });
    };

    if (formState.errors?.messageComponent) {
      processErrors(formState.errors.messageComponent, messageComponent);
    }

    return problems;
  };

  const problems = extractProblems();

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
      <Box p={4} borderBottom="1px" borderColor="gray.600">
        <HStack spacing={2} align="center">
          <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
            Problems
          </Text>
          <Text color="gray.400">({problems.length})</Text>
        </HStack>
      </Box>
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
