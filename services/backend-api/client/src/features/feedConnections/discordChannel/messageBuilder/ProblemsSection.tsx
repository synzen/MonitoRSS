import React from "react";
import { Box, HStack, List, Text, VStack, Icon } from "@chakra-ui/react";
import { FaExclamationCircle, FaExclamationTriangle } from "react-icons/fa";
import type { MessageBuilderProblem } from "./types";
import { useMessageBuilderContext } from "./MessageBuilderContext";

export const ProblemsSection: React.FC<{
  problems: MessageBuilderProblem[];
  onClickComponentPath: (componentId: string) => void;
}> = ({ problems, onClickComponentPath }) => {
  const { navigateToComponentId } = useMessageBuilderContext();

  return (
    <VStack align="stretch" gap={0}>
      <Box p={4}>
        {problems.length === 0 ? (
          <Text fontSize="sm" color="fg.muted" fontStyle="italic">
            No problems found
          </Text>
        ) : (
          <List.Root display="flex" flexDir="column" gap={2} listStyleType="none" ml={0}>
            {problems.map((problem) => {
              const isWarning = problem.severity === "warning";

              return (
                <List.Item key={`${problem.message}-${problem.path}`}>
                  <VStack align="stretch" gap={0} flex={1}>
                    <HStack gap={2} align="center">
                      <Icon color={isWarning ? "orange.400" : "red.400"} flexShrink={0} aria-hidden>
                        {isWarning ? <FaExclamationTriangle /> : <FaExclamationCircle />}
                      </Icon>
                      <Text fontSize="sm" color="fg">
                        <Box as="span" srOnly>
                          {isWarning ? "Warning: " : "Error: "}
                        </Box>
                        {problem.message}
                      </Text>
                    </HStack>
                    <HStack>
                      <Text
                        fontSize="xs"
                        color="text.link"
                        fontFamily="mono"
                        ml={6}
                        cursor="pointer"
                        _hover={{ color: "brand.fg", textDecoration: "underline" }}
                        onClick={() => {
                          navigateToComponentId(problem.componentId);
                          onClickComponentPath(problem.componentId);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            navigateToComponentId(problem.componentId);
                            onClickComponentPath(problem.componentId);
                          }
                        }}
                      >
                        {problem.path}
                      </Text>
                    </HStack>
                  </VStack>
                </List.Item>
              );
            })}
          </List.Root>
        )}
      </Box>
    </VStack>
  );
};
