import React from "react";
import {
  Box,
  Flex,
  VStack,
  Text,
  HStack,
  Button,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useDisclosure,
} from "@chakra-ui/react";
import { useFormContext } from "react-hook-form";
import { DiscordMessagePreview } from "./Previewer/DiscordMessagePreview";
import { ComponentPropertiesPanel } from "./Previewer/ComponentPropertiesPanel";
import { ComponentTreeItem } from "./Previewer/ComponentTreeItem";
import { ProblemsSection } from "./Previewer/ProblemsSection";
import {
  MESSAGE_ROOT_ID,
  ComponentType,
  Component,
  SectionComponent,
  MessageComponent,
} from "./Previewer/types";
import { NavigableTreeItem } from "../components/NavigableTree";
import { NavigableTreeContext, NavigableTreeProvider } from "../contexts/NavigableTreeContext";
import { PreviewerProvider, usePreviewerContext } from "./Previewer/PreviewerContext";

const findComponentById = (component: Component, id: string): Component | null => {
  if (component.id === id) {
    return component;
  }

  if (component.children) {
    const found = component.children
      .map((child: Component) => findComponentById(child, id))
      .find((result: Component | null) => result !== null);

    if (found) return found;
  }

  // Check accessory component for Section types
  if (component.type === ComponentType.Section && (component as SectionComponent).accessory) {
    const accessoryFound = findComponentById((component as SectionComponent).accessory!, id);
    if (accessoryFound) return accessoryFound;
  }

  return null;
};

const PreviewerContent: React.FC = () => {
  const { resetMessage } = usePreviewerContext();
  const { watch, handleSubmit } = useFormContext<{ messageComponent: MessageComponent }>();
  const messageComponent = watch("messageComponent");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  return (
    <NavigableTreeProvider>
      <NavigableTreeContext.Consumer>
        {({ currentSelectedId, setCurrentSelectedId }) => {
          const selectedComponent = currentSelectedId
            ? findComponentById(messageComponent, currentSelectedId)
            : null;

          const handleSave = handleSubmit((data) => {
            // TODO: Implement save functionality
            // eslint-disable-next-line no-console
            console.log("Saving message component:", data.messageComponent);
          });

          const handleDiscard = () => {
            onOpen();
          };

          const confirmDiscard = () => {
            resetMessage();
            setCurrentSelectedId(MESSAGE_ROOT_ID);
            onClose();
          };

          return (
            <Flex direction="column" h="calc(100vh - 60px)" bg="gray.900">
              {/* Top Bar */}
              <Box bg="gray.800" borderBottom="1px" borderColor="gray.600" px={4} py={3}>
                <HStack justify="space-between" align="center">
                  <Text fontSize="lg" fontWeight="bold" color="white" as="h1">
                    Discord Message Builder
                  </Text>
                  <HStack spacing={3}>
                    <Button variant="outline" colorScheme="red" size="sm" onClick={handleDiscard}>
                      Discard Changes
                    </Button>
                    <Button colorScheme="blue" size="sm" onClick={handleSave}>
                      Save Changes
                    </Button>
                  </HStack>
                </HStack>
              </Box>
              {/* Main Content */}
              <Flex flex={1} bg="gray.900">
                {/* Left Panel - Component Tree */}
                <Box
                  w="300px"
                  bg="gray.800"
                  borderRight="1px"
                  borderColor="gray.600"
                  overflow="auto"
                >
                  <VStack align="stretch" spacing={0} minWidth={250}>
                    <Box p={4} borderBottom="1px" borderColor="gray.600">
                      <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                        Components
                      </Text>
                    </Box>
                    <div role="tree" aria-label="Message Components">
                      <NavigableTreeItem isRootItem id={MESSAGE_ROOT_ID} ariaLabel="Message Root">
                        <ComponentTreeItem component={messageComponent} />
                      </NavigableTreeItem>
                    </div>
                  </VStack>
                </Box>
                {/* Center Panel - Discord Preview and Problems */}
                <Flex flex={1} direction="column" bg="gray.800">
                  {/* Discord Preview Section */}
                  <Box p={4} borderBottom="1px" borderColor="gray.600" srOnly>
                    <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                      Discord Message Preview
                    </Text>
                  </Box>
                  <Box p={4} overflow="auto">
                    <DiscordMessagePreview />
                  </Box>
                  {/* Problems Section */}
                  <Box borderTop="1px" borderColor="gray.600">
                    <ProblemsSection />
                  </Box>
                </Flex>
                {/* Right Panel - Properties */}
                <Box
                  w="350px"
                  bg="gray.800"
                  borderLeft="1px"
                  borderColor="gray.600"
                  overflow="auto"
                >
                  <ComponentPropertiesPanel selectedComponent={selectedComponent} />
                </Box>
              </Flex>
              {/* Discard Confirmation Modal */}
              <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
                <AlertDialogOverlay>
                  <AlertDialogContent>
                    <AlertDialogHeader fontSize="lg" fontWeight="bold">
                      Discard Changes
                    </AlertDialogHeader>
                    <AlertDialogBody>
                      Are you sure you want to discard all changes? This action cannot be undone and
                      all your changes will be lost.
                    </AlertDialogBody>
                    <AlertDialogFooter>
                      <Button ref={cancelRef} onClick={onClose}>
                        Cancel
                      </Button>
                      <Button colorScheme="red" onClick={confirmDiscard} ml={3}>
                        Discard Changes
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialogOverlay>
              </AlertDialog>
            </Flex>
          );
        }}
      </NavigableTreeContext.Consumer>
    </NavigableTreeProvider>
  );
};

export const Previewer: React.FC = () => {
  return (
    <PreviewerProvider>
      <PreviewerContent />
    </PreviewerProvider>
  );
};
