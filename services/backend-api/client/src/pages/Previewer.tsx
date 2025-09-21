import React, { useState } from "react";
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
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from "@chakra-ui/react";
import { FieldError, FieldErrorsImpl, Merge, useFormContext } from "react-hook-form";
import { DiscordMessagePreview } from "./Previewer/DiscordMessagePreview";
import { ComponentPropertiesPanel } from "./Previewer/ComponentPropertiesPanel";
import { ComponentTreeItem } from "./Previewer/ComponentTreeItem";
import {
  MESSAGE_ROOT_ID,
  ComponentType,
  Component,
  MessageComponent,
  PreviewerProblem,
} from "./Previewer/types";
import { NavigableTreeItem } from "../components/NavigableTree";
import {
  NavigableTreeContext,
  NavigableTreeProvider,
  useNavigableTreeContext,
} from "../contexts/NavigableTreeContext";
import { PreviewerProvider, usePreviewerContext } from "./Previewer/PreviewerContext";
import { ProblemsSection } from "./Previewer/ProblemsSection";

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

const extractProblems = (
  formStateErrors: Merge<FieldError, FieldErrorsImpl<any>> | undefined,
  messageComponent: MessageComponent
) => {
  const problems: Array<PreviewerProblem> = [];

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

  if (formStateErrors) {
    processErrors(formStateErrors, messageComponent);
  }

  return problems;
};

const PreviewerContent: React.FC = () => {
  const { resetMessage } = usePreviewerContext();
  const { watch, handleSubmit, formState } = useFormContext<{
    messageComponent: MessageComponent;
  }>();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const messageComponent = watch("messageComponent");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const { setExpandedIds } = useNavigableTreeContext();
  const [scrollToComponentId, setScrollToComponentId] = useState<string | null>(null);

  const problems = extractProblems(formState.errors.messageComponent, messageComponent);
  const componentIdsWithProblems = new Set(problems.map((p) => p.componentId));

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
    onClose();
  };

  const handlePathClick = (componentIdsToExpand: string[]) => {
    setExpandedIds((prev) => new Set([...prev, ...componentIdsToExpand]));
    setSelectedTabIndex(0);

    if (componentIdsToExpand.length > 0) {
      setScrollToComponentId(componentIdsToExpand[componentIdsToExpand.length - 1]);
      setTimeout(() => {
        setScrollToComponentId(null);
      }, 0);
    }
  };

  return (
    <NavigableTreeProvider>
      <NavigableTreeContext.Consumer>
        {({ currentSelectedId }) => {
          return (
            <Box position="relative" height="100%" bg="gray.900">
              <Flex direction="column" height="100%">
                {/* Top Bar */}
                <Box bg="gray.800" borderBottom="1px" borderColor="gray.600" px={4} py={3}>
                  <HStack justify="space-between" align="center" flexWrap="wrap">
                    <Text fontSize="lg" fontWeight="bold" color="white" as="h1">
                      Discord Message Builder
                    </Text>
                    <HStack spacing={3} flexWrap="wrap">
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
                <Flex flex={1} bg="gray.900" position="relative">
                  {/* Left Panel - Component Tree */}
                  <Box
                    w="300px"
                    bg="gray.800"
                    borderRight="1px"
                    borderColor="gray.600"
                    display={{ base: "none", lg: "block" }}
                  >
                    <VStack align="stretch" spacing={0} minWidth={250}>
                      <Box p={4} borderBottom="1px" borderColor="gray.600">
                        <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                          Components
                        </Text>
                      </Box>
                      <div role="tree" aria-label="Message Components">
                        <NavigableTreeItem isRootItem id={MESSAGE_ROOT_ID} ariaLabel="Message Root">
                          <ComponentTreeItem
                            component={messageComponent}
                            scrollToComponentId={scrollToComponentId}
                            componentIdsWithProblems={componentIdsWithProblems}
                          />
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
                    <Box
                      borderTop="1px"
                      borderColor="gray.600"
                      display={{ base: "none", lg: "block" }}
                    >
                      <Box p={4} borderBottom="1px" borderColor="gray.600">
                        <HStack spacing={2} align="center">
                          <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                            Problems
                          </Text>
                          <Text color="gray.400">({problems.length})</Text>
                        </HStack>
                      </Box>
                      <ProblemsSection problems={problems} onClickComponentPath={handlePathClick} />
                    </Box>
                    {/* Problems Section - Mobile Tabs */}
                    <Box
                      borderTop="1px"
                      borderColor="gray.600"
                      display={{ base: "block", lg: "none" }}
                      transition="padding-bottom 0.3s ease"
                      // flex={1}
                    >
                      <Tabs
                        colorScheme="blue"
                        variant="line"
                        index={selectedTabIndex}
                        onChange={setSelectedTabIndex}
                      >
                        <TabList borderBottom="1px" borderColor="gray.600" bg="gray.700">
                          <Tab
                            color="gray.300"
                            _selected={{ color: "white", borderColor: "blue.400" }}
                          >
                            Message Components ({messageComponent.children.length})
                          </Tab>
                          <Tab
                            color="gray.300"
                            _selected={{ color: "white", borderColor: "blue.400" }}
                          >
                            Problems ({problems.length})
                          </Tab>
                        </TabList>
                        <TabPanels>
                          <TabPanel p={0}>
                            <div role="tree" aria-label="Message Components">
                              <NavigableTreeItem
                                isRootItem
                                id={MESSAGE_ROOT_ID}
                                ariaLabel="Message Components Root"
                              >
                                <ComponentTreeItem
                                  component={messageComponent}
                                  scrollToComponentId={scrollToComponentId}
                                  componentIdsWithProblems={componentIdsWithProblems}
                                />
                              </NavigableTreeItem>
                            </div>
                          </TabPanel>
                          <TabPanel p={0}>
                            <ProblemsSection
                              problems={problems}
                              onClickComponentPath={handlePathClick}
                            />
                          </TabPanel>
                        </TabPanels>
                      </Tabs>
                    </Box>
                  </Flex>
                  {/* Right Panel - Properties */}
                  <Box
                    w="350px"
                    bg="gray.800"
                    borderLeft="1px"
                    borderColor="gray.600"
                    display={{ base: "none", lg: "block" }}
                  >
                    {currentSelectedId && (
                      <ComponentPropertiesPanel selectedComponentId={currentSelectedId} />
                    )}
                  </Box>
                </Flex>
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
            </Box>
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
