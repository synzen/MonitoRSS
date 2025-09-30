import React from "react";
import { Box, HStack, Text, VStack, UnorderedList, ListItem, Icon } from "@chakra-ui/react";
import { FaExclamationCircle } from "react-icons/fa";
import type { PreviewerProblem } from "./types";
import { usePreviewerContext } from "./PreviewerContext";

export const ProblemsSection: React.FC<{
  problems: PreviewerProblem[];
  onClickComponentPath: (componentId: string) => void;
}> = ({ problems, onClickComponentPath }) => {
  const { navigateToComponentId } = usePreviewerContext();

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
            ))}
          </UnorderedList>
        )}
      </Box>
    </VStack>
  );
};
