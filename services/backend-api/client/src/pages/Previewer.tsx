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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  chakra,
  Alert,
} from "@chakra-ui/react";
import { WarningIcon, SettingsIcon, InfoIcon } from "@chakra-ui/icons";
import { useFormContext } from "react-hook-form";
import { useParams, Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaRightFromBracket } from "react-icons/fa6";
import { DiscordMessagePreview } from "./Previewer/DiscordMessagePreview";
import { ComponentPropertiesPanel } from "./Previewer/ComponentPropertiesPanel";
import { ComponentTreeItem } from "./Previewer/ComponentTreeItem";
import { ComponentTreeToolbar } from "./Previewer/ComponentTreeToolbar";
import { NavigableTreeItem } from "../components/NavigableTree";
import { NavigableTreeContext, NavigableTreeProvider } from "../contexts/NavigableTreeContext";
import { PreviewerProvider, usePreviewerContext } from "./Previewer/PreviewerContext";
import { ProblemsSection } from "./Previewer/ProblemsSection";
import { ProblemsDialog } from "./Previewer/ProblemsDialog";
import extractPreviewerProblems from "./Previewer/utils/extractPreviewerProblems";
import RouteParams from "../types/RouteParams";
import { Loading } from "../components";
import { SearchFeedsModal } from "../components/SearchFeedsModal";
import { LogoutButton } from "../features/auth";
import { useDiscordBot, useDiscordUserMe } from "../features/discordUser";
import { UserFeedProvider } from "../contexts/UserFeedContext";
import {
  UserFeedConnectionProvider,
  useUserFeedConnectionContext,
} from "../contexts/UserFeedConnectionContext";
import { FeedConnectionType } from "../types";
import PreviewerFormState from "./Previewer/types/PreviewerFormState";
import { useUpdateDiscordChannelConnection } from "../features/feedConnections";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../contexts/PageAlertContext";
import { ComponentType } from "./Previewer/types";
import convertPreviewerStateToConnectionUpdate from "./Previewer/utils/convertPreviewerStateToConnectionUpdate";
import { pages } from "../constants";
import { UserFeedTabSearchParam } from "../constants/userFeedTabSearchParam";
import { PreviewerTour } from "../components/PreviewerTour";
import { usePreviewerTour, useIsPreviewerDesktop } from "../hooks";

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
  const {
    isOpen: isProblemsDialogOpen,
    onOpen: onProblemsDialogOpen,
    onClose: onProblemsDialogClose,
  } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const [scrollToComponentId, setScrollToComponentId] = useState<string | null>(null);
  const { feedId, connectionId } = useParams<RouteParams>();
  const { mutateAsync: updateConnection, status: updateStatus } =
    useUpdateDiscordChannelConnection();
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();
  const { userFeed, connection } = useUserFeedConnectionContext();
  const { resetTour, resetTrigger } = usePreviewerTour();
  const isDesktop = useIsPreviewerDesktop();

  // Header hooks
  const { data: discordBotData, status: botStatus, error: botError } = useDiscordBot();
  const { data: discordUserMe } = useDiscordUserMe();
  const { t } = useTranslation();
  const navigate = useNavigate();

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

  const handleSave = handleSubmit(
    async (data) => {
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
    },
    (_errors) => {
      // Show problems dialog when there are validation errors
      if (problems.length > 0) {
        onProblemsDialogOpen();
      }
    }
  );

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

  const handlePathClick = (componentId: string) => {
    setSelectedTabIndex(0);

    setScrollToComponentId(componentId);
    setTimeout(() => {
      setScrollToComponentId(null);
    }, 2000);
  };

  return (
    <NavigableTreeContext.Consumer>
      {({ currentSelectedId }) => {
        return (
          <Box position="relative" height="100%" bg="gray.900">
            <Flex direction="column" height="100%">
              {/* Header */}
              <Box bg="gray.800" borderBottom="1px" borderColor="gray.700" width="full">
                <Flex
                  width="100%"
                  justifyContent="space-between"
                  paddingX={4}
                  paddingY={{ base: 3 }}
                  alignItems="center"
                >
                  <HStack gap={8}>
                    <Flex alignItems="center" overflow="hidden">
                      {discordBotData && (
                        <RouterLink to={pages.userFeeds()} aria-label="MonitoRSS Home">
                          <Flex alignItems="center" paddingBottom="1" overflow="hidden">
                            <Avatar
                              src={discordBotData.result.avatar || undefined}
                              size="sm"
                              name={discordBotData.result.username}
                              marginRight="2"
                              backgroundColor="transparent"
                            />
                            <chakra.span
                              fontSize="xl"
                              whiteSpace="nowrap"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              fontWeight="bold"
                              title="MonitoRSS"
                              color="white"
                            >
                              MonitoRSS
                            </chakra.span>
                          </Flex>
                        </RouterLink>
                      )}
                      {botStatus === "loading" && (
                        <Box>
                          <Loading />
                        </Box>
                      )}
                      {botError && <Alert status="error">{botError.message}</Alert>}
                    </Flex>
                    <Box display={{ base: "none", sm: "block" }}>
                      <SearchFeedsModal />
                    </Box>
                  </HStack>
                  <Flex alignItems="center">
                    <Menu placement="bottom-end">
                      <MenuButton
                        as={Button}
                        size="sm"
                        variant="link"
                        aria-label="Account settings"
                      >
                        <Avatar
                          src={discordUserMe?.iconUrl}
                          size="sm"
                          name={discordUserMe?.username}
                          backgroundColor="transparent"
                          title={discordUserMe?.username}
                          aria-hidden
                        />
                      </MenuButton>
                      <MenuList>
                        <Box overflow="hidden" paddingX={2} title={discordUserMe?.username}>
                          <Text
                            overflow="hidden"
                            maxWidth={300}
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                          >
                            {discordUserMe?.username}
                          </Text>
                          <Text fontSize="sm" color="whiteAlpha.600">
                            Discord ID: {discordUserMe?.id}
                          </Text>
                        </Box>
                        <MenuDivider />
                        <MenuItem
                          icon={<SettingsIcon />}
                          onClick={() => navigate(pages.userSettings())}
                        >
                          Account Settings
                        </MenuItem>
                        <MenuItem
                          alignItems="center"
                          icon={<InfoIcon />}
                          onClick={() => {
                            window.open("https://discord.gg/pudv7Rx", "_blank");
                          }}
                        >
                          Discord Support Server
                        </MenuItem>
                        <LogoutButton
                          trigger={
                            <MenuItem icon={<FaRightFromBracket />}>
                              {t("components.pageContentV2.logout")}
                            </MenuItem>
                          }
                        />
                      </MenuList>
                    </Menu>
                  </Flex>
                </Flex>
              </Box>
              {/* Navigation */}
              <Box bg="gray.800" px={4} py={3}>
                <Breadcrumb>
                  <BreadcrumbItem>
                    <BreadcrumbLink as={RouterLink} to={pages.userFeeds()} color="blue.300">
                      Feeds
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      as={RouterLink}
                      to={pages.userFeed(userFeed.id)}
                      color="blue.300"
                    >
                      {userFeed.title}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      as={RouterLink}
                      to={pages.userFeed(userFeed.id, {
                        tab: UserFeedTabSearchParam.Connections,
                      })}
                      color="blue.300"
                    >
                      Connections
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      as={RouterLink}
                      to={pages.userFeedConnection({
                        feedId: userFeed.id,
                        connectionType: FeedConnectionType.DiscordChannel,
                        connectionId: connection.id,
                      })}
                      color="blue.300"
                    >
                      {connection.name}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem isCurrentPage>
                    <BreadcrumbLink>Message Builder</BreadcrumbLink>
                  </BreadcrumbItem>
                </Breadcrumb>
              </Box>
              {/* Top Bar */}
              <Stack bg="gray.800" borderBottom="1px" borderColor="gray.600" px={4} pb={3}>
                <HStack justify="space-between" align="center" flexWrap="wrap">
                  <HStack>
                    <Text fontSize="lg" fontWeight="bold" color="white" as="h1" tabIndex={-1}>
                      Message Builder
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
                    {isDesktop && (
                      <Button
                        variant="outline"
                        colorScheme="gray"
                        size="sm"
                        onClick={resetTour}
                        leftIcon={<InfoIcon />}
                      >
                        Take Tour
                      </Button>
                    )}
                    <HStack spacing={3} data-tour-target="save-discard-buttons">
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
                        aria-disabled={updateStatus === "loading" || !formState.isDirty}
                      >
                        {updateStatus === "loading" ? "Saving Changes..." : "Save Changes"}
                      </Button>
                    </HStack>
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
                    data-tour-target="components-section"
                  >
                    <VStack align="stretch" spacing={0} minWidth={200} height="100%">
                      <ComponentTreeToolbar />
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
                  <Box p={4} overflow="hidden" data-tour-target="discord-preview">
                    <DiscordMessagePreview />
                  </Box>
                  <Box
                    borderTop="1px"
                    borderColor="gray.600"
                    display={{ base: "none", lg: "block" }}
                    data-tour-target="problems-section"
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
                          <ComponentTreeToolbar />
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
                    data-tour-target="properties-panel"
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
            {/* Problems Dialog */}
            <ProblemsDialog
              isOpen={isProblemsDialogOpen}
              onClose={onProblemsDialogClose}
              problems={problems}
              onClickComponentPath={handlePathClick}
            />
            {/* Tour Component */}
            <PreviewerTour resetTrigger={resetTrigger} />
          </Box>
        );
      }}
    </NavigableTreeContext.Consumer>
  );
};

export const Previewer: React.FC = () => {
  const { feedId, connectionId } = useParams<RouteParams>();

  return (
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
        <NavigableTreeProvider>
          <PageAlertProvider>
            <PreviewerProvider>
              <PreviewerContent />
            </PreviewerProvider>
          </PageAlertProvider>
        </NavigableTreeProvider>
      </UserFeedConnectionProvider>
    </UserFeedProvider>
  );
};
