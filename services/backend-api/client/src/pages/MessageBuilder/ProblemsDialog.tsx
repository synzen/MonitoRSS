import React from "react";
import {
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Button,
  VStack,
  Text,
  Box,
  HStack,
  UnorderedList,
  ListItem,
  Icon,
} from "@chakra-ui/react";
import { WarningIcon } from "@chakra-ui/icons";
import { FaExclamationCircle } from "react-icons/fa";
import type { MessageBuilderProblem } from "./types";
import { useMessageBuilderContext } from "./MessageBuilderContext";

interface ProblemsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  problems: MessageBuilderProblem[];
  onClickComponentPath: (componentId: string) => void;
}

export const ProblemsDialog: React.FC<ProblemsDialogProps> = ({
  isOpen,
  onClose,
  problems,
  onClickComponentPath,
}) => {
  const { navigateToComponentId } = useMessageBuilderContext();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const handleProblemClick = (problemComponentId: string) => {
    navigateToComponentId(problemComponentId);
    onClickComponentPath(problemComponentId);
    onClose();
  };

  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} size="lg">
      <AlertDialogOverlay>
        <AlertDialogContent maxHeight="80vh">
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            <HStack spacing={2}>
              <WarningIcon color="red.400" />
              <Text>Failed to Save Changes</Text>
            </HStack>
          </AlertDialogHeader>
          <AlertDialogBody overflowY="auto">
            <VStack align="stretch" spacing={4}>
              <Text>
                Your message has {problems.length} problem
                {problems.length === 1 ? "" : "s"} that must be fixed before saving:
              </Text>
              <Box
                borderRadius="md"
                border="1px"
                borderColor="gray.600"
                bg="gray.50"
                _dark={{ bg: "gray.800" }}
                maxHeight="300px"
                overflowY="auto"
              >
                <Box p={4}>
                  <UnorderedList spacing={3} styleType="none" ml={0}>
                    {problems.map((problem) => (
                      <ListItem key={`${problem.message}-${problem.path}`}>
                        <VStack align="stretch" spacing={1}>
                          <HStack spacing={2} align="center">
                            <Icon
                              as={FaExclamationCircle}
                              color="red.400"
                              flexShrink={0}
                              size="sm"
                              aria-hidden
                            />
                            <Text fontSize="sm" color="gray.900" _dark={{ color: "white" }}>
                              {problem.message}
                            </Text>
                          </HStack>
                          <Text
                            fontSize="xs"
                            color="blue.500"
                            _dark={{ color: "blue.300" }}
                            fontFamily="mono"
                            ml={6}
                            cursor="pointer"
                            _hover={{
                              color: "blue.600",
                              _dark: { color: "blue.200" },
                              textDecoration: "underline",
                            }}
                            onClick={() => handleProblemClick(problem.componentId)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                handleProblemClick(problem.componentId);
                              }
                            }}
                          >
                            {problem.path}
                          </Text>
                        </VStack>
                      </ListItem>
                    ))}
                  </UnorderedList>
                </Box>
              </Box>
            </VStack>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose}>
              Close
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};
