import React from "react";
import { Box, HStack, Text, VStack, UnorderedList, ListItem, Icon } from "@chakra-ui/react";
import { FaExclamationTriangle } from "react-icons/fa";
import { usePreviewerContext } from "./PreviewerContext";
import { useNavigableTreeContext } from "../../contexts/NavigableTreeContext";

export const ProblemsSection: React.FC = () => {
  const { problems } = usePreviewerContext();
  const { setCurrentSelectedId } = useNavigableTreeContext();

  const handlePathClick = (componentId: string) => {
    setCurrentSelectedId(componentId);
  };

  return (
    <VStack align="stretch" spacing={0}>
      <Box p={4} borderBottom="1px" borderColor="gray.600">
        <HStack spacing={2} align="center">
          <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
            Problems
          </Text>
          <Text fontSize="sm" color="gray.400">
            ({problems.length})
          </Text>
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
