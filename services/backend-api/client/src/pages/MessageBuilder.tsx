import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Icon,
} from "@chakra-ui/react";
import { WarningIcon, SettingsIcon, InfoIcon } from "@chakra-ui/icons";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { HiTemplate } from "react-icons/hi";
import { useFormContext } from "react-hook-form";
import { useParams, Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaRightFromBracket } from "react-icons/fa6";
import { DiscordMessagePreview } from "./MessageBuilder/DiscordMessagePreview";
import { ComponentPropertiesPanel } from "./MessageBuilder/ComponentPropertiesPanel";
import { ComponentTreeItem } from "./MessageBuilder/ComponentTreeItem";
import { ComponentTreeToolbar } from "./MessageBuilder/ComponentTreeToolbar";
import { NavigableTreeItem } from "../components/NavigableTree";
import {
  NavigableTreeContext,
  NavigableTreeProvider,
  useNavigableTreeContext,
} from "../contexts/NavigableTreeContext";
import {
  MessageBuilderProvider,
  useMessageBuilderContext,
} from "./MessageBuilder/MessageBuilderContext";
import { ProblemsSection } from "./MessageBuilder/ProblemsSection";
import { ProblemsDialog } from "./MessageBuilder/ProblemsDialog";
import useMessageBuilderProblems from "./MessageBuilder/hooks/useMessageBuilderProblems";
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
import { FeedConnectionType, FeedDiscordChannelConnection } from "../types";
import MessageBuilderFormState from "./MessageBuilder/types/MessageBuilderFormState";
import { useUpdateDiscordChannelConnection } from "../features/feedConnections";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../contexts/PageAlertContext";
import convertMessageBuilderStateToConnectionUpdate from "./MessageBuilder/utils/convertMessageBuilderStateToConnectionUpdate";
import { pages } from "../constants";
import { UserFeedTabSearchParam } from "../constants/userFeedTabSearchParam";
import { MessageBuilderTour } from "../components/MessageBuilderTour";
import { useMessageBuilderTour, useIsMessageBuilderDesktop } from "../hooks";
import { MESSAGE_BUILDER_MOBILE_BREAKPOINT } from "./MessageBuilder/constants/MessageBuilderMobileBreakpoint";
import { useUserFeedArticles } from "../features/feed/hooks";
import { TemplateGalleryModal } from "../features/templates/components/TemplateGalleryModal";
import { TEMPLATES, getTemplateById, DEFAULT_TEMPLATE } from "../features/templates/constants";
import { detectFields } from "../features/templates/utils";
import { useTemplateFeedFields } from "../features/templates/hooks";
import type { Component } from "./MessageBuilder/types";

// When the tree container remounts (key change for Google Translate compatibility),
// DOM focus is lost to <body>. This component restores focus to the currently
// selected tree item so keyboard users aren't stranded.
function TreeFocusRestorer({ treeRef }: { treeRef: React.RefObject<HTMLDivElement> }) {
  const { currentSelectedId } = useNavigableTreeContext();

  useEffect(() => {
    if (!currentSelectedId || !treeRef.current) return;
    if (document.activeElement && document.activeElement !== document.body) return;

    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const selected = treeRef.current?.querySelector(
        `[data-id="${currentSelectedId}"]`,
      ) as HTMLElement | null;
      selected?.focus();
    });
  }, []);

  return null;
}

// Used as a React key on the tree container so it remounts when components are
// added or removed. Google Translate does not re-translate text that React swaps
// into an already-translated container; remounting creates fresh DOM nodes.
function countComponentNodes(component: Component | null | undefined): number {
  if (!component) return 0;
  let count = 1;
  if (component.children) {
    for (const child of component.children) {
      count += countComponentNodes(child as Component);
    }
  }
  if ("accessory" in component && component.accessory) {
    count += countComponentNodes(component.accessory as Component);
  }
  return count;
}

const SIDE_PANEL_WIDTH = {
  base: "350px",
  "2xl": "500px",
};
const CENTER_PANEL_WIDTH = {
  base: "100vw",
  [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: `calc(min(100vw - ${350 * 2}px, 100%))`,
  "2xl": `calc(min(100vw - ${500 * 2}px, 100%))`,
};

const MessageBuilderContent: React.FC = () => {
  const { resetMessage } = useMessageBuilderContext();
  const { watch, handleSubmit, formState, setValue } = useFormContext<MessageBuilderFormState>();
  const { setCurrentSelectedId } = useNavigableTreeContext();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [isProblemsCollapsed, setIsProblemsCollapsed] = useState(false);
  const messageComponent = watch("messageComponent");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isProblemsDialogOpen,
    onOpen: onProblemsDialogOpen,
    onClose: onProblemsDialogClose,
  } = useDisclosure();
  const {
    isOpen: isTemplatesOpen,
    onOpen: onOpenTemplates,
    onClose: onCloseTemplates,
  } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const templatesButtonRef = useRef<HTMLButtonElement>(null);
  const desktopTreeRef = useRef<HTMLDivElement>(null);
  const mobileTreeRef = useRef<HTMLDivElement>(null);
  const [scrollToComponentId, setScrollToComponentId] = useState<string | null>(null);
  const { feedId, connectionId } = useParams<RouteParams>();
  const { mutateAsync: updateConnection, status: updateStatus } =
    useUpdateDiscordChannelConnection();
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();
  const { userFeed, connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { resetTour, resetTrigger } = useMessageBuilderTour();
  const isDesktop = useIsMessageBuilderDesktop();

  // Template gallery state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>(undefined);

  // Fetch articles for template gallery (only when modal open)
  const { data: galleryArticlesData, status: galleryArticlesStatus } = useUserFeedArticles({
    feedId,
    data: {
      skip: 0,
      limit: 10,
      selectProperties: ["*"],
      formatOptions: {
        dateFormat: userFeed?.formatOptions?.dateFormat,
        dateTimezone: userFeed?.formatOptions?.dateTimezone,
        disableImageLinkPreviews: false,
        formatTables: false,
        ignoreNewLines: false,
        stripImages: false,
      },
    },
    disabled: !isTemplatesOpen,
  });

  const galleryArticles = galleryArticlesData?.result?.articles || [];
  const feedFields = useTemplateFeedFields(galleryArticles as Array<Record<string, unknown>>);

  // Set initial selected article when articles load
  useEffect(() => {
    if (galleryArticles.length > 0 && !selectedArticleId) {
      setSelectedArticleId(galleryArticles[0].id);
    }
  }, [galleryArticles, selectedArticleId]);

  // Reset template selection when modal closes
  const handleCloseTemplatesModal = () => {
    setSelectedTemplateId(undefined);
    onCloseTemplates();
  };

  // Detect fields from articles for template creation
  const detectedFields = useMemo(() => {
    return detectFields(galleryArticles);
  }, [galleryArticles]);

  // Apply template to form state
  const handleApplyTemplate = (selectedId: string) => {
    const template = getTemplateById(selectedId) || DEFAULT_TEMPLATE;
    const newMessageComponent = template.createMessageComponent(detectedFields);

    setValue("messageComponent", newMessageComponent, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });

    // Select the root component so the user sees something selected
    setCurrentSelectedId(newMessageComponent.id);

    handleCloseTemplatesModal();
  };

  // Header hooks
  const { data: discordBotData, status: botStatus, error: botError } = useDiscordBot();
  const { data: discordUserMe } = useDiscordUserMe();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    errors: problems,
    allProblems,
    componentIdsWithErrors,
    componentIdsWithWarnings,
    setResolvedMessages,
  } = useMessageBuilderProblems(formState.errors.messageComponent, messageComponent);

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
      if (updateStatus === "loading" || !feedId || !connectionId || !data.messageComponent) {
        return;
      }

      try {
        const connectionDetails = convertMessageBuilderStateToConnectionUpdate(
          data.messageComponent,
        );

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
    },
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
                    <Button
                      ref={templatesButtonRef}
                      variant="outline"
                      colorScheme="gray"
                      size="sm"
                      onClick={onOpenTemplates}
                      leftIcon={<HiTemplate />}
                      data-tour-target="templates-button"
                    >
                      Templates
                    </Button>
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
                <PageAlertContextOutlet containerProps={{ zIndex: 0 }} />
              </Stack>
              {/* Main Content */}
              <Flex flex={1} bg="gray.900" position="relative">
                {/* Left Panel - Component Tree */}
                {isDesktop && (
                  <Box
                    minWidth={SIDE_PANEL_WIDTH}
                    maxWidth={SIDE_PANEL_WIDTH}
                    width={SIDE_PANEL_WIDTH}
                  >
                    <Box
                      bg="gray.800"
                      borderRight="1px"
                      borderColor="gray.600"
                      height="100%"
                      width="100%"
                      overflowY="auto"
                      overflowX="hidden"
                      data-tour-target="components-section"
                    >
                      <VStack align="stretch" spacing={0} minWidth={200} height="100%">
                        <ComponentTreeToolbar />
                        {messageComponent && (
                          <div
                            ref={desktopTreeRef}
                            key={countComponentNodes(messageComponent)}
                            role="tree"
                            aria-label="Message Components"
                          >
                            <TreeFocusRestorer treeRef={desktopTreeRef} />
                            <NavigableTreeItem
                              isRootItem
                              id={messageComponent.id}
                              ariaLabel="Message Root"
                            >
                              <ComponentTreeItem
                                component={messageComponent}
                                scrollToComponentId={scrollToComponentId}
                                componentIdsWithErrors={componentIdsWithErrors}
                                componentIdsWithWarnings={componentIdsWithWarnings}
                              />
                            </NavigableTreeItem>
                          </div>
                        )}
                      </VStack>
                    </Box>
                  </Box>
                )}
                {/* Middle Panel - Properties */}
                {isDesktop && (
                  <Box minWidth={SIDE_PANEL_WIDTH} maxWidth={SIDE_PANEL_WIDTH}>
                    <Box
                      bg="gray.800"
                      borderRight="1px"
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
                )}
                {/* Right Panel - Discord Preview and Problems */}
                <Flex flex={1} direction="column" bg="gray.800" maxW={CENTER_PANEL_WIDTH}>
                  <Box
                    flex={isProblemsCollapsed ? 1 : "none"}
                    overflow="hidden"
                    data-tour-target="discord-preview"
                    p={4}
                    display="flex"
                    flexDirection="column"
                  >
                    <Box srOnly>
                      <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                        Discord Message Preview
                      </Text>
                    </Box>
                    <Box flex={1} overflow="hidden">
                      <DiscordMessagePreview
                        maxHeight={isProblemsCollapsed ? "none" : undefined}
                        onResolvedMessages={setResolvedMessages}
                      />
                    </Box>
                  </Box>
                  {isDesktop && (
                    <Box borderTop="1px" borderColor="gray.600" data-tour-target="problems-section">
                      <Box
                        as="button"
                        width="100%"
                        p={4}
                        borderBottom="1px"
                        borderColor="gray.600"
                        bg="transparent"
                        cursor="pointer"
                        textAlign="left"
                        onClick={() => setIsProblemsCollapsed(!isProblemsCollapsed)}
                        aria-expanded={!isProblemsCollapsed}
                        aria-controls="problems-content"
                        _hover={{ bg: "gray.700" }}
                        _focus={{ outline: "2px solid", outlineColor: "blue.400" }}
                        transition="background-color 0.2s"
                      >
                        <HStack spacing={2} align="center" justify="space-between">
                          <HStack spacing={2} align="center">
                            <Text fontSize="lg" fontWeight="bold" color="white" as="h2">
                              Problems
                            </Text>
                            <Text color="gray.400" aria-label={`${allProblems.length} found`}>
                              ({allProblems.length})
                            </Text>
                          </HStack>
                          <Icon
                            as={isProblemsCollapsed ? FaChevronUp : FaChevronDown}
                            color="gray.400"
                            aria-hidden
                          />
                        </HStack>
                      </Box>
                      {!isProblemsCollapsed && (
                        <Box id="problems-content" role="region" aria-labelledby="problems-heading">
                          <ProblemsSection
                            problems={allProblems}
                            onClickComponentPath={handlePathClick}
                          />
                        </Box>
                      )}
                    </Box>
                  )}
                  {/* Problems Section - Mobile Tabs */}
                  {!isDesktop && (
                    <Box borderTop="1px" borderColor="gray.600">
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
                              {allProblems.length > 0 && (
                                <WarningIcon
                                  color={problems.length > 0 ? "red.400" : "orange.400"}
                                  aria-hidden
                                />
                              )}
                              <Text>Problems ({allProblems.length})</Text>
                            </HStack>
                          </Tab>
                        </TabList>
                        <TabPanels>
                          <TabPanel p={0}>
                            <ComponentTreeToolbar />
                            {messageComponent && (
                              <div
                                ref={mobileTreeRef}
                                key={countComponentNodes(messageComponent)}
                                role="tree"
                                aria-label="Message Components"
                              >
                                <TreeFocusRestorer treeRef={mobileTreeRef} />
                                <NavigableTreeItem
                                  isRootItem
                                  id={messageComponent.id}
                                  ariaLabel="Message Components Root"
                                >
                                  <ComponentTreeItem
                                    component={messageComponent}
                                    scrollToComponentId={scrollToComponentId}
                                    componentIdsWithErrors={componentIdsWithErrors}
                                    componentIdsWithWarnings={componentIdsWithWarnings}
                                  />
                                </NavigableTreeItem>
                              </div>
                            )}
                          </TabPanel>
                          <TabPanel p={0}>
                            <ProblemsSection
                              problems={allProblems}
                              onClickComponentPath={handlePathClick}
                            />
                          </TabPanel>
                        </TabPanels>
                      </Tabs>
                    </Box>
                  )}
                </Flex>
              </Flex>
            </Flex>
            {/* Discard Confirmation Modal */}
            <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
              <AlertDialogOverlay>
                <AlertDialogContent>
                  <AlertDialogHeader>Discard Changes</AlertDialogHeader>
                  <AlertDialogBody>
                    Are you sure you want to discard all changes? This action cannot be undone and
                    all your changes will be lost.
                  </AlertDialogBody>
                  <AlertDialogFooter>
                    <Button ref={cancelRef} onClick={onClose} variant="outline">
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
            <MessageBuilderTour resetTrigger={resetTrigger} />
            {/* Template Gallery Modal */}
            <TemplateGalleryModal
              mode="picker"
              isOpen={isTemplatesOpen}
              onClose={handleCloseTemplatesModal}
              templates={TEMPLATES}
              selectedTemplateId={selectedTemplateId}
              onTemplateSelect={setSelectedTemplateId}
              feedFields={feedFields}
              detectedFields={detectedFields}
              articles={galleryArticles}
              selectedArticleId={selectedArticleId}
              onArticleChange={setSelectedArticleId}
              isLoadingArticles={galleryArticlesStatus === "loading"}
              feedId={feedId!}
              connectionId={connectionId}
              userFeed={userFeed}
              connection={connection}
              modalTitle="Browse Templates"
              showComparisonPreview
              currentMessageComponent={messageComponent}
              primaryActionLabel="Use this template"
              onPrimaryAction={handleApplyTemplate}
              secondaryActionLabel="Cancel"
              onSecondaryAction={handleCloseTemplatesModal}
              finalFocusRef={templatesButtonRef}
            />
          </Box>
        );
      }}
    </NavigableTreeContext.Consumer>
  );
};

export const MessageBuilder: React.FC = () => {
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
            <MessageBuilderProvider>
              <MessageBuilderContent />
            </MessageBuilderProvider>
          </PageAlertProvider>
        </NavigableTreeProvider>
      </UserFeedConnectionProvider>
    </UserFeedProvider>
  );
};
