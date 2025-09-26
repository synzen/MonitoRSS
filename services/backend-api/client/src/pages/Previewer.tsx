import React, { useState, useEffect } from "react";
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
  Stack,
  Heading,
  Highlight,
} from "@chakra-ui/react";
import { WarningIcon } from "@chakra-ui/icons";
import { useFormContext } from "react-hook-form";
import { useParams } from "react-router-dom";
import { DiscordMessagePreview } from "./Previewer/DiscordMessagePreview";
import { ComponentPropertiesPanel } from "./Previewer/ComponentPropertiesPanel";
import { ComponentTreeItem } from "./Previewer/ComponentTreeItem";
import { NavigableTreeItem } from "../components/NavigableTree";
import {
  NavigableTreeContext,
  NavigableTreeProvider,
  useNavigableTreeContext,
} from "../contexts/NavigableTreeContext";
import { PreviewerProvider, usePreviewerContext } from "./Previewer/PreviewerContext";
import { ProblemsSection } from "./Previewer/ProblemsSection";
import extractPreviewerProblems from "./Previewer/utils/extractPreviewerProblems";
import { convertConnectionToPreviewerState } from "./Previewer/utils/convertConnectionToPreviewerState";
import RouteParams from "../types/RouteParams";
import { Loading } from "../components";
import { UserFeedProvider } from "../contexts/UserFeedContext";
import {
  UserFeedConnectionContext,
  UserFeedConnectionProvider,
} from "../contexts/UserFeedConnectionContext";
import { FeedDiscordChannelConnection } from "../types";
import PreviewerFormState from "./Previewer/types/PreviewerFormState";
import { useUpdateDiscordChannelConnection } from "../features/feedConnections";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../contexts/PageAlertContext";
import { ComponentType } from "./Previewer/types";
import convertPreviewerStateToConnectionUpdate from "./Previewer/utils/convertPreviewerStateToConnectionUpdate";

const SIDE_PANEL_WIDTH = {
  base: "300px",
  "2xl": "400px",
};
const CENTER_PANEL_WIDTH = {
  base: "100vw",
  lg: `calc(min(100vw - ${300 * 2}px, 100%))`,
  "2xl": `calc(min(100vw - ${400 * 2}px, 100%))`,
};

const PreviewerContent: React.FC = () => {
  const { resetMessage } = usePreviewerContext();
  const { watch, handleSubmit, formState } = useFormContext<PreviewerFormState>();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const messageComponent = watch("messageComponent");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const { setExpandedIds } = useNavigableTreeContext();
  const [scrollToComponentId, setScrollToComponentId] = useState<string | null>(null);
  const { feedId, connectionId } = useParams<RouteParams>();
  const { mutateAsync: updateConnection, status: updateStatus } =
    useUpdateDiscordChannelConnection();
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();

  const problems = extractPreviewerProblems(formState.errors.messageComponent, messageComponent);
  const componentIdsWithProblems = new Set(problems.map((p) => p.componentId));

  // If the user attempts to close the tab with unsaved changes, ask for confirmation
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (formState.isDirty) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [formState.isDirty]);

  const handleSave = handleSubmit(async (data) => {
    if (
      updateStatus === "loading" ||
      !feedId ||
      !connectionId ||
      !data.messageComponent ||
      data.messageComponent.type !== ComponentType.LegacyRoot
    ) {
      return;
    }

    try {
      const connectionDetails = convertPreviewerStateToConnectionUpdate(data.messageComponent);

      await updateConnection({
        feedId,
        connectionId,
        details: connectionDetails,
      });

      createSuccessAlert({
        title: "Successfully saved message format",
        description: "Your Discord message format has been updated.",
      });
    } catch (error) {
      createErrorAlert({
        title: "Failed to save message format",
        description: (error as Error).message,
      });
    }
  });

  const handleDiscard = () => {
    if (!formState.isDirty) {
      return;
    }

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
    <NavigableTreeContext.Consumer>
      {({ currentSelectedId }) => {
        return (
          <Box position="relative" height="100%" bg="gray.900">
            <Flex direction="column" height="100%">
              {/* Top Bar */}
              <Stack bg="gray.800" borderBottom="1px" borderColor="gray.600" px={4} py={3}>
                <HStack justify="space-between" align="center" flexWrap="wrap">
                  <HStack>
                    <Text fontSize="lg" fontWeight="bold" color="white" as="h1">
                      Discord Message Builder
                    </Text>
                    {formState.isDirty && (
                      <Text fontSize="sm" fontWeight={600}>
                        <Highlight
                          query="You are previewing unsaved changes"
                          styles={{
                            bg: "orange.200",
                            rounded: "full",
                            px: "2",
                            py: "1",
                          }}
                        >
                          You are previewing unsaved changes
                        </Highlight>
                      </Text>
                    )}
                  </HStack>
                  <HStack spacing={3} flexWrap="wrap">
                    <Button
                      variant="outline"
                      colorScheme="red"
                      size="sm"
                      onClick={handleDiscard}
                      aria-disabled={formState.isDirty === false}
                    >
                      Discard Changes
                    </Button>
                    <Button
                      colorScheme="blue"
                      size="sm"
                      onClick={handleSave}
                      aria-disabled={updateStatus === "loading"}
                    >
                      {updateStatus === "loading" ? "Saving Changes..." : "Save Changes"}
                    </Button>
                  </HStack>
                </HStack>
                <PageAlertContextOutlet />
              </Stack>
              {/* Main Content */}
              <Flex flex={1} bg="gray.900" position="relative">
                {/* Left Panel - Component Tree */}
                <Box
                  minWidth={SIDE_PANEL_WIDTH}
                  maxWidth={SIDE_PANEL_WIDTH}
                  width={SIDE_PANEL_WIDTH}
                  display={{ base: "none", lg: "block" }}
                >
                  <Box
                    bg="gray.800"
                    borderRight="1px"
                    borderColor="gray.600"
                    height="100%"
                    width="100%"
                    overflowY="auto"
                  >
                    <VStack align="stretch" spacing={0} minWidth={200} height="100%">
                      <Box p={4} borderBottom="1px" borderColor="gray.600">
                        <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                          Components
                        </Text>
                      </Box>
                      {messageComponent && (
                        <div role="tree" aria-label="Message Components">
                          <NavigableTreeItem
                            isRootItem
                            id={messageComponent.id}
                            ariaLabel="Message Root"
                          >
                            <ComponentTreeItem
                              component={messageComponent}
                              scrollToComponentId={scrollToComponentId}
                              componentIdsWithProblems={componentIdsWithProblems}
                            />
                          </NavigableTreeItem>
                        </div>
                      )}
                    </VStack>
                  </Box>
                </Box>
                {/* Center Panel - Discord Preview and Problems */}
                <Flex flex={1} direction="column" bg="gray.800" maxW={CENTER_PANEL_WIDTH}>
                  {/* Discord Preview Section */}
                  <Box p={4} borderBottom="1px" borderColor="gray.600" srOnly>
                    <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                      Discord Message Preview
                    </Text>
                  </Box>
                  <Box p={4} overflow="hidden">
                    <DiscordMessagePreview />
                  </Box>
                  <Box
                    borderTop="1px"
                    borderColor="gray.600"
                    display={{ base: "none", lg: "block" }}
                  >
                    <Box p={4} borderBottom="1px" borderColor="gray.600">
                      <HStack spacing={2} align="center">
                        {problems.length > 0 && <WarningIcon color="orange.400" />}
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
                          Message Components ({messageComponent?.children?.length || 0})
                        </Tab>
                        <Tab
                          color="gray.300"
                          _selected={{ color: "white", borderColor: "blue.400" }}
                        >
                          <HStack>
                            {problems.length > 0 && <WarningIcon color="red.400" aria-hidden />}
                            <Text>Problems ({problems.length})</Text>
                          </HStack>
                        </Tab>
                      </TabList>
                      <TabPanels>
                        <TabPanel p={0}>
                          {messageComponent && (
                            <div role="tree" aria-label="Message Components">
                              <NavigableTreeItem
                                isRootItem
                                id={messageComponent.id}
                                ariaLabel="Message Components Root"
                              >
                                <ComponentTreeItem
                                  component={messageComponent}
                                  scrollToComponentId={scrollToComponentId}
                                  componentIdsWithProblems={componentIdsWithProblems}
                                />
                              </NavigableTreeItem>
                            </div>
                          )}
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
                  minWidth={SIDE_PANEL_WIDTH}
                  maxWidth={SIDE_PANEL_WIDTH}
                  display={{ base: "none", lg: "block" }}
                >
                  <Box
                    bg="gray.800"
                    borderLeft="1px"
                    borderColor="gray.600"
                    height="100%"
                    width="100%"
                    overflowY="auto"
                  >
                    {currentSelectedId && (
                      <ComponentPropertiesPanel selectedComponentId={currentSelectedId} />
                    )}
                  </Box>
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
  );
};

export const Previewer: React.FC = () => {
  const { feedId, connectionId } = useParams<RouteParams>();

  return (
    <NavigableTreeProvider>
      <UserFeedProvider
        feedId={feedId}
        loadingComponent={
          <Stack alignItems="center" justifyContent="center" height="100%" spacing="2rem">
            <Loading size="xl" />
            <Heading>Loading Feed...</Heading>
          </Stack>
        }
      >
        <UserFeedConnectionProvider feedId={feedId} connectionId={connectionId}>
          <UserFeedConnectionContext.Consumer>
            {(data) => {
              const connection = data?.connection as FeedDiscordChannelConnection;

              const previewerFormState: PreviewerFormState =
                convertConnectionToPreviewerState(connection);

              return (
                <PageAlertProvider>
                  <PreviewerProvider defaultValues={previewerFormState}>
                    <PreviewerContent />
                  </PreviewerProvider>
                </PageAlertProvider>
              );
            }}
          </UserFeedConnectionContext.Consumer>
        </UserFeedConnectionProvider>
      </UserFeedProvider>
    </NavigableTreeProvider>
  );
};
