import React from "react";
import { Button, VStack, Text, Box, HStack, List, Icon } from "@chakra-ui/react";
import { FaExclamationCircle, FaExclamationTriangle } from "react-icons/fa";
import { FaTriangleExclamation } from "react-icons/fa6";
import type { MessageBuilderProblem } from "./types";
import { useMessageBuilderContext } from "./MessageBuilderContext";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <DialogRoot
      role="alertdialog"
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      size="lg"
      initialFocusEl={() => cancelRef.current}
    >
      <DialogContent maxHeight="80vh">
        <DialogHeader fontSize="lg" fontWeight="bold">
          <HStack gap={2}>
            <Icon as={FaTriangleExclamation} color="text.error" />
            <DialogTitle>Failed to Save Changes</DialogTitle>
          </HStack>
        </DialogHeader>
        <DialogBody overflowY="auto">
          <VStack align="stretch" gap={4}>
            <Text>
              Your message has {problems.length} problem
              {problems.length === 1 ? "" : "s"} that must be fixed before saving:
            </Text>
            <Box
              borderRadius="l3"
              border="1px"
              borderColor="border"
              bg="bg.panel"
              maxHeight="300px"
              overflowY="auto"
            >
              <Box p={4}>
                <List.Root gap={3} listStyle="none" ml={0}>
                  {problems.map((problem) => {
                    const isWarning = problem.severity === "warning";

                    return (
                      <List.Item key={`${problem.message}-${problem.path}`}>
                        <VStack align="stretch" gap={1}>
                          <HStack gap={2} align="center">
                            <Icon
                              as={isWarning ? FaExclamationTriangle : FaExclamationCircle}
                              color={isWarning ? "text.warning" : "text.error"}
                              flexShrink={0}
                              size="sm"
                              aria-hidden
                            />
                            <Text fontSize="sm" color="fg">
                              {problem.message}
                            </Text>
                          </HStack>
                          <Text
                            fontSize="xs"
                            color="text.link"
                            fontFamily="mono"
                            ml={6}
                            cursor="pointer"
                            _hover={{
                              color: "text.link",
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
                      </List.Item>
                    );
                  })}
                </List.Root>
              </Box>
            </Box>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button ref={cancelRef} onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
