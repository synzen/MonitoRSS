import React, { useState, useEffect, useRef, useMemo, useContext } from "react";
import {
  Box,
  Flex,
  VStack,
  Text,
  HStack,
  Button,
  useDisclosure,
  Tabs,
  Stack,
  Heading,
  BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbCurrentLink,
  chakra,
  Icon,
} from "@chakra-ui/react";
import {
  FaTriangleExclamation,
  FaGear,
  FaCircleInfo,
  FaChevronDown,
  FaChevronUp,
  FaRightFromBracket,
} from "react-icons/fa6";
import { HiTemplate } from "react-icons/hi";
import { useParams, Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useMessageBuilderStateContext } from "./state";
import { DiscordMessagePreview } from "./DiscordMessagePreview";
import { ComponentPropertiesPanel } from "./ComponentPropertiesPanel";
import { ComponentTreeItem } from "./ComponentTreeItem";
import { ComponentTreeToolbar } from "./ComponentTreeToolbar";
import { NavigableTreeItem } from "./components/NavigableTree";
import {
  NavigableTreeContext,
  NavigableTreeProvider,
  useNavigableTreeContext,
} from "./contexts/NavigableTreeContext";
import { MessageBuilderProvider, useMessageBuilderContext } from "./MessageBuilderContext";
import { ProblemsSection } from "./ProblemsSection";
import { ProblemsDialog } from "./ProblemsDialog";
import useMessageBuilderProblems from "./hooks/useMessageBuilderProblems";
import RouteParams from "@/types/RouteParams";
import { Loading } from "@/components";
import {
  SearchFeedsModal,
  UserFeedProvider,
  UserFeedConnectionProvider,
  useUserFeedConnectionContext,
  useUserFeedArticles,
  useFeedScope,
} from "@/features/feed";
import { LogoutButton } from "@/features/auth";
import { useDiscordBot, useDiscordUserMe } from "@/features/discordUser";
import { FeedConnectionType, FeedDiscordChannelConnection } from "@/types";
import {
  useUpdateDiscordChannelConnection,
  getConnectionWebhookChannelId,
  getConnectionWebhookThreadId,
} from "@/features/feedConnections";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "@/contexts/PageAlertContext";
import { useScopeCrumbLabel } from "@/contexts/ScopeLabelContext";
import convertMessageBuilderStateToConnectionUpdate from "./utils/convertMessageBuilderStateToConnectionUpdate";
import { pages } from "@/constants";
import {
  BlockableFeature,
  PricingDialogContext,
  useIsFeatureAllowed,
} from "@/features/subscriptionProducts";
import { UserFeedTabSearchParam } from "@/constants/userFeedTabSearchParam";
import { MessageBuilderTour } from "./components/MessageBuilderTour";
import { useMessageBuilderTour } from "@/hooks";
import { MESSAGE_BUILDER_MOBILE_BREAKPOINT } from "./constants/MessageBuilderMobileBreakpoint";
import { TemplateGalleryModal } from "../templates/components/TemplateGalleryModal";
import { TEMPLATES, getTemplateById, DEFAULT_TEMPLATE } from "../templates/constants";
import { detectFields } from "../templates/utils";
import { useTemplateFeedFields } from "../templates/hooks";
import type { Component } from "./types";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";

// When the tree container remounts (key change for Google Translate compatibility),
// DOM focus is lost to <body>. This component restores focus to the currently
// selected tree item so keyboard users aren't stranded.
const TreeFocusRestorer = ({ treeRef }: { treeRef: React.RefObject<HTMLDivElement> }) => {
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
};

// Pre-mounts one ComponentPropertiesPanel per component id (for Google Translate
// compatibility - nodes must exist in the DOM on initial render). When a panel
// is not the currently selected one, React.memo short-circuits its re-render so
// keystrokes on another panel do not walk the tree and re-render N hidden panels.
// Inactive panels keep their last DOM (which Google Translate has translated);
// when they become active again, they re-render with fresh form state.
const PreRenderedPanelSlot = React.memo<{ id: string; isActive: boolean }>(
  ({ id }) => <ComponentPropertiesPanel selectedComponentId={id} />,
  (prev, next) => {
    // Only re-render when the panel becomes active or changes its id.
    // When inactive (was and is), skip - keeps DOM stable for Google Translate.
    if (prev.id !== next.id) return false;
    if (prev.isActive !== next.isActive) return false;
    if (next.isActive) return false;

    return true;
  },
);
PreRenderedPanelSlot.displayName = "PreRenderedPanelSlot";

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

function collectComponentIds(component: Component | null | undefined): string[] {
  if (!component) return [];
  const ids: string[] = [component.id];

  if (component.children) {
    for (const child of component.children) {
      ids.push(...collectComponentIds(child as Component));
    }
  }

  if ("accessory" in component && component.accessory) {
    ids.push(...collectComponentIds(component.accessory as Component));
  }

  return ids;
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
  const { messageComponent, messageComponentRef, dispatch, errors, isDirty, validate } =
    useMessageBuilderStateContext();
  const { setCurrentSelectedId } = useNavigableTreeContext();
  const [selectedTabValue, setSelectedTabValue] = useState("components");
  const [isProblemsCollapsed, setIsProblemsCollapsed] = useState(false);
  const allComponentIds = useMemo(() => collectComponentIds(messageComponent), [messageComponent]);

  const { open: isOpen, onOpen, onClose } = useDisclosure();
  const {
    open: isProblemsDialogOpen,
    onOpen: onProblemsDialogOpen,
    onClose: onProblemsDialogClose,
  } = useDisclosure();
  const {
    open: isTemplatesOpen,
    onOpen: onOpenTemplates,
    onClose: onCloseTemplates,
  } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const templatesButtonRef = useRef<HTMLButtonElement>(null);
  const desktopTreeRef = useRef<HTMLDivElement>(null);
  const mobileTreeRef = useRef<HTMLDivElement>(null);
  const [scrollToComponentId, setScrollToComponentId] = useState<string | null>(null);
  const { feedId, connectionId } = useParams<RouteParams>();
  const { workspaceSlug } = useFeedScope();
  const scope = workspaceSlug ? { workspaceSlug } : undefined;
  const scopeCrumbLabel = useScopeCrumbLabel();
  const { mutateAsync: updateConnection, status: updateStatus } =
    useUpdateDiscordChannelConnection();
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();
  const { userFeed, connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const { resetTour, resetTrigger } = useMessageBuilderTour();

  // Branding state
  const existingWebhookName = connection.details.webhook?.name || "";
  const existingWebhookIconUrl = connection.details.webhook?.iconUrl || "";
  const [brandingDisplayName, setBrandingDisplayName] = useState(existingWebhookName);
  const [brandingAvatarUrl, setBrandingAvatarUrl] = useState(existingWebhookIconUrl);
  const skipBrandingRef = useRef(false);
  const { allowed: webhooksAllowed } = useIsFeatureAllowed({
    feature: BlockableFeature.DiscordWebhooks,
  });
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const brandingChanged =
    brandingDisplayName !== existingWebhookName || brandingAvatarUrl !== existingWebhookIconUrl;
  const hasBrandingValues = !webhooksAllowed && !!brandingDisplayName.trim();
  const hasAnyChanges = isDirty || brandingChanged;

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

  const handleApplyTemplate = (selectedId: string) => {
    const template = getTemplateById(selectedId) || DEFAULT_TEMPLATE;
    const newMessageComponent = template.createMessageComponent(detectedFields);

    dispatch({ type: "SET_MESSAGE_COMPONENT", messageComponent: newMessageComponent });
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
  } = useMessageBuilderProblems(errors.messageComponent, messageComponent);

  // If the user attempts to close the tab with unsaved changes, ask for confirmation
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasAnyChanges) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasAnyChanges]);

  const handleSave = async () => {
    const currentMessageComponent = messageComponentRef.current;

    if (updateStatus === "loading" || !feedId || !connectionId || !currentMessageComponent) {
      return;
    }

    const isValid = await validate();

    if (!isValid) {
      onProblemsDialogOpen();

      return;
    }

    try {
      const connectionDetails =
        convertMessageBuilderStateToConnectionUpdate(currentMessageComponent);

      const shouldSkipBranding = skipBrandingRef.current;
      skipBrandingRef.current = false;

      const channelId = getConnectionWebhookChannelId(connection);

      if (webhooksAllowed && !shouldSkipBranding && brandingChanged && channelId) {
        const hasWebhookBrandingInput = !!brandingDisplayName.trim() || !!brandingAvatarUrl.trim();

        if (hasWebhookBrandingInput) {
          connectionDetails.applicationWebhook = {
            name: brandingDisplayName || undefined,
            iconUrl: brandingAvatarUrl || undefined,
            channelId,
            threadId: getConnectionWebhookThreadId(connection),
          };
        } else {
          connectionDetails.channelId = channelId;
        }
      }

      await updateConnection({
        feedId,
        connectionId,
        details: connectionDetails,
      });

      if (!webhooksAllowed) {
        setBrandingDisplayName(existingWebhookName);
        setBrandingAvatarUrl(existingWebhookIconUrl);
      }

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
  };

  const handleDiscard = () => {
    if (!hasAnyChanges) {
      return;
    }

    onOpen();
  };

  const confirmDiscard = () => {
    resetMessage();
    setBrandingDisplayName(existingWebhookName);
    setBrandingAvatarUrl(existingWebhookIconUrl);
    onClose();
  };

  const handlePathClick = (componentId: string) => {
    setSelectedTabValue("components");

    setScrollToComponentId(componentId);
    setTimeout(() => {
      setScrollToComponentId(null);
    }, 2000);
  };

  return (
    <NavigableTreeContext.Consumer>
      {({ currentSelectedId }) => {
        return (
          <Box position="relative" height="100%" bg="bg">
            <Flex direction="column" height="100%">
              {/* Header */}
              <Box bg="bg" borderBottomWidth="1px" borderColor="border" width="full">
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
                              color="fg"
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
                      {botError && <Alert status="error" title={botError.message} />}
                    </Flex>
                    <Box display={{ base: "none", sm: "block" }}>
                      <SearchFeedsModal />
                    </Box>
                  </HStack>
                  <Flex alignItems="center">
                    <MenuRoot positioning={{ placement: "bottom-end" }}>
                      <MenuTrigger asChild>
                        <Button size="sm" variant="ghost" aria-label="Account settings" padding={0}>
                          <Avatar
                            src={discordUserMe?.iconUrl}
                            size="sm"
                            name={discordUserMe?.username}
                            backgroundColor="transparent"
                            title={discordUserMe?.username}
                            aria-hidden
                          />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <Box overflow="hidden" paddingX={2} title={discordUserMe?.username}>
                          <Text
                            overflow="hidden"
                            maxWidth={300}
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                          >
                            {discordUserMe?.username}
                          </Text>
                          <Text fontSize="sm" color="fg.muted">
                            Discord ID: {discordUserMe?.id}
                          </Text>
                        </Box>
                        <MenuSeparator />
                        <MenuItem
                          value="account-settings"
                          onClick={() => navigate(pages.userSettings())}
                        >
                          <Icon>
                            <FaGear />
                          </Icon>
                          Account Settings
                        </MenuItem>
                        <MenuItem
                          value="discord-support"
                          onClick={() => {
                            window.open("https://discord.gg/pudv7Rx", "_blank");
                          }}
                        >
                          <Icon>
                            <FaCircleInfo />
                          </Icon>
                          Discord Support Server
                        </MenuItem>
                        <LogoutButton
                          trigger={
                            <MenuItem value="logout">
                              <FaRightFromBracket />
                              {t("components.pageContentV2.logout")}
                            </MenuItem>
                          }
                        />
                      </MenuContent>
                    </MenuRoot>
                  </Flex>
                </Flex>
              </Box>
              {/* Navigation */}
              <Box bg="bg" px={4} py={3}>
                <BreadcrumbRoot>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <RouterLink to={pages.userFeeds(scope)} color="text.link">
                          {scopeCrumbLabel}
                        </RouterLink>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <RouterLink to={pages.userFeed(userFeed.id, { scope })} color="text.link">
                          {userFeed.title}
                        </RouterLink>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <RouterLink
                          to={pages.userFeed(userFeed.id, {
                            tab: UserFeedTabSearchParam.Connections,
                            scope,
                          })}
                          color="text.link"
                        >
                          Connections
                        </RouterLink>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <RouterLink
                          to={pages.userFeedConnection({
                            feedId: userFeed.id,
                            connectionType: FeedConnectionType.DiscordChannel,
                            connectionId: connection.id,
                            scope,
                          })}
                          color="text.link"
                        >
                          {connection.name}
                        </RouterLink>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbCurrentLink>Message Builder</BreadcrumbCurrentLink>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </BreadcrumbRoot>
              </Box>
              {/* Top Bar */}
              <Stack bg="bg" borderBottomWidth="1px" borderColor="border" px={4} pb={3}>
                <HStack justify="space-between" align="center" flexWrap="wrap">
                  <HStack>
                    <Text fontSize="lg" fontWeight="bold" color="fg" as="h1" tabIndex={-1}>
                      Message Builder
                    </Text>
                  </HStack>
                  <HStack gap={3} flexWrap="wrap">
                    <Button
                      display={{ base: "none", [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: "inline-flex" }}
                      variant="outline"
                      size="sm"
                      onClick={resetTour}
                    >
                      <Icon>
                        <FaCircleInfo />
                      </Icon>
                      Take Tour
                    </Button>
                    <Button
                      ref={templatesButtonRef}
                      variant="outline"
                      size="sm"
                      onClick={onOpenTemplates}
                      data-tour-target="templates-button"
                    >
                      <HiTemplate />
                      Templates
                    </Button>
                    <HStack gap={3} data-tour-target="save-discard-buttons">
                      <DestructiveActionButton
                        size="sm"
                        onClick={handleDiscard}
                        aria-disabled={!hasAnyChanges}
                      >
                        Discard Changes
                      </DestructiveActionButton>
                      {hasBrandingValues ? (
                        <>
                          <Button
                            variant="outline"
                            colorPalette="brand"
                            size="sm"
                            onClick={() => {
                              skipBrandingRef.current = true;
                              handleSave();
                            }}
                            aria-disabled={updateStatus === "loading" || !hasAnyChanges}
                          >
                            {updateStatus === "loading" ? "Saving..." : "Save without branding"}
                          </Button>
                          <PrimaryActionButton size="sm" onClick={() => onOpenPricingDialog()}>
                            Upgrade to save with branding
                          </PrimaryActionButton>
                        </>
                      ) : (
                        <PrimaryActionButton
                          size="sm"
                          onClick={handleSave}
                          aria-disabled={updateStatus === "loading" || !hasAnyChanges}
                        >
                          {updateStatus === "loading" ? "Saving Changes..." : "Save Changes"}
                        </PrimaryActionButton>
                      )}
                    </HStack>
                  </HStack>
                </HStack>
                <PageAlertContextOutlet containerProps={{ zIndex: 0 }} />
              </Stack>
              {/* Main Content */}
              <Flex flex={1} bg="bg" position="relative">
                {/* Left Panel - Component Tree */}
                <Box
                  display={{ base: "none", [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: "block" }}
                  minWidth={SIDE_PANEL_WIDTH}
                  maxWidth={SIDE_PANEL_WIDTH}
                  width={SIDE_PANEL_WIDTH}
                >
                  <Box
                    bg="bg"
                    borderRightWidth="1px"
                    borderColor="border"
                    height="100%"
                    width="100%"
                    overflowY="auto"
                    overflowX="hidden"
                    data-tour-target="components-section"
                  >
                    <VStack align="stretch" gap={0} minWidth={200} height="100%">
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
                {/* Middle Panel - Properties
                    All component property panels are pre-rendered with the hidden
                    attribute so Google Translate can process their text on initial
                    page load. Switching the selected component just toggles hidden
                    instead of creating/destroying DOM nodes. Without this, Google
                    Translate's MutationObserver inconsistently fails to re-translate
                    new nodes that React inserts when switching between components. */}
                <Box
                  display={{ base: "none", [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: "block" }}
                  minWidth={SIDE_PANEL_WIDTH}
                  maxWidth={SIDE_PANEL_WIDTH}
                >
                  <Box
                    bg="bg"
                    borderRightWidth="1px"
                    borderColor="border"
                    height="100%"
                    width="100%"
                    overflowY="auto"
                    data-tour-target="properties-panel"
                  >
                    {allComponentIds.map((id) => (
                      <div key={id} hidden={id !== currentSelectedId}>
                        <PreRenderedPanelSlot id={id} isActive={id === currentSelectedId} />
                      </div>
                    ))}
                  </Box>
                </Box>
                {/* Right Panel - Discord Preview and Problems */}
                <Flex flex={1} direction="column" bg="bg" maxW={CENTER_PANEL_WIDTH}>
                  <Box
                    flex={isProblemsCollapsed ? 1 : "none"}
                    overflow="hidden"
                    data-tour-target="discord-preview"
                    p={4}
                    display="flex"
                    flexDirection="column"
                  >
                    <Box srOnly>
                      <Text fontSize="lg" fontWeight="bold" color="fg" as="h2">
                        Discord Message Preview
                      </Text>
                    </Box>
                    <Box flex={1} overflow="hidden">
                      <DiscordMessagePreview
                        maxHeight={isProblemsCollapsed ? "none" : undefined}
                        onResolvedMessages={setResolvedMessages}
                        brandingDisplayName={brandingDisplayName}
                        brandingAvatarUrl={brandingAvatarUrl}
                        onBrandingDisplayNameChange={setBrandingDisplayName}
                        onBrandingAvatarUrlChange={setBrandingAvatarUrl}
                        webhooksAllowed={webhooksAllowed}
                        brandingChanged={brandingChanged}
                      />
                    </Box>
                  </Box>
                  <Box
                    display={{ base: "none", [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: "block" }}
                    borderTopWidth="1px"
                    borderColor="border"
                    data-tour-target="problems-section"
                  >
                    <Box
                      as="button"
                      width="100%"
                      p={4}
                      borderBottomWidth="1px"
                      borderColor="border"
                      bg="transparent"
                      cursor="pointer"
                      textAlign="left"
                      onClick={() => setIsProblemsCollapsed(!isProblemsCollapsed)}
                      aria-expanded={!isProblemsCollapsed}
                      aria-controls="problems-content"
                      _hover={{ bg: "bg.emphasized" }}
                      _focusVisible={{
                        outlineWidth: "2px",
                        outlineStyle: "solid",
                        outlineColor: "brand.focusRing",
                      }}
                      transition="background-color 0.2s"
                    >
                      <HStack gap={2} align="center" justify="space-between">
                        <HStack gap={2} align="center">
                          <Text fontSize="lg" fontWeight="bold" color="fg" as="h2">
                            Problems
                          </Text>
                          <Text color="fg.muted" aria-label={`${allProblems.length} found`}>
                            ({allProblems.length})
                          </Text>
                        </HStack>
                        <Icon color="fg.muted" aria-hidden>
                          {isProblemsCollapsed ? <FaChevronUp /> : <FaChevronDown />}
                        </Icon>
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
                  {/* Problems Section - Mobile Tabs */}
                  <Box
                    display={{ base: "block", [MESSAGE_BUILDER_MOBILE_BREAKPOINT]: "none" }}
                    borderTopWidth="1px"
                    borderColor="border"
                  >
                    <Tabs.Root
                      colorPalette="brand"
                      variant="line"
                      value={selectedTabValue}
                      onValueChange={(e) => setSelectedTabValue(e.value)}
                    >
                      <Tabs.List borderBottomWidth="1px" borderColor="border" bg="bg">
                        <Tabs.Trigger
                          value="components"
                          color="fg.muted"
                          _selected={{ color: "fg", borderColor: "brand.solid" }}
                        >
                          Message Components ({messageComponent?.children?.length || 0})
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="problems"
                          color="fg.muted"
                          _selected={{ color: "fg", borderColor: "brand.solid" }}
                        >
                          <HStack>
                            {allProblems.length > 0 && (
                              <Icon
                                color={problems.length > 0 ? "text.error" : "text.warning"}
                                aria-hidden
                              >
                                <FaTriangleExclamation />
                              </Icon>
                            )}
                            <Text>Problems ({allProblems.length})</Text>
                          </HStack>
                        </Tabs.Trigger>
                      </Tabs.List>
                      <Tabs.Content value="components" p={0}>
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
                      </Tabs.Content>
                      <Tabs.Content value="problems" p={0}>
                        <ProblemsSection
                          problems={allProblems}
                          onClickComponentPath={handlePathClick}
                        />
                      </Tabs.Content>
                    </Tabs.Root>
                  </Box>
                </Flex>
              </Flex>
            </Flex>
            {/* Discard Confirmation Modal */}
            <DialogRoot
              role="alertdialog"
              open={isOpen}
              onOpenChange={(e) => {
                if (!e.open) onClose();
              }}
              initialFocusEl={() => cancelRef.current}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Discard Changes</DialogTitle>
                </DialogHeader>
                <DialogBody>
                  Are you sure you want to discard all changes? This action cannot be undone and all
                  your changes will be lost.
                </DialogBody>
                <DialogFooter>
                  <Button ref={cancelRef} onClick={onClose} variant="outline">
                    Cancel
                  </Button>
                  <Button variant="solid" colorPalette="red" onClick={confirmDiscard} ml={3}>
                    Discard Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </DialogRoot>
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
              connectionId={connectionId!}
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
        <Stack alignItems="center" justifyContent="center" height="100%" gap="2rem">
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
