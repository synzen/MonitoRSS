import React from "react";
import { Box, HStack, Text, VStack, UnorderedList, ListItem, Icon } from "@chakra-ui/react";
import { FaExclamationCircle, FaExclamationTriangle } from "react-icons/fa";
import type { MessageBuilderProblem } from "./types";
import { useMessageBuilderContext } from "./MessageBuilderContext";

export const ProblemsSection: React.FC<{
  problems: MessageBuilderProblem[];
  onClickComponentPath: (componentId: string) => void;
}> = ({ problems, onClickComponentPath }) => {
  const { navigateToComponentId } = useMessageBuilderContext();

  return (
    <VStack align="stretch" spacing={0}>
      <Box p={4}>
        {problems.length === 0 ? (
          <Text fontSize="sm" color="gray.400" fontStyle="italic">
            No problems found
          </Text>
        ) : (
          <UnorderedList spacing={2} styleType="none" ml={0}>
            {problems.map((problem) => {
              const isWarning = problem.severity === "warning";

              return (
                <ListItem key={`${problem.message}-${problem.path}`}>
                  <VStack align="stretch" spacing={0} flex={1}>
                    <HStack spacing={2} align="center">
                      <Icon
                        as={isWarning ? FaExclamationTriangle : FaExclamationCircle}
                        color={isWarning ? "orange.400" : "red.400"}
                        flexShrink={0}
                        size="sm"
                        aria-hidden
                      />
                      <Text fontSize="sm" color="white">
                        <Box as="span" srOnly>
                          {isWarning ? "Warning: " : "Error: "}
                        </Box>
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
                </ListItem>
              );
            })}
          </UnorderedList>
        )}
      </Box>
    </VStack>
  );
};
