import { Link as RouterLink } from "react-router-dom";
import { Alert, Button, Heading, Link as ChakraLink, Stack, Text } from "@chakra-ui/react";
import { pages } from "@/constants";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { useCurrentWorkspace } from "../../contexts/CurrentWorkspaceContext";

// A workspace is dormant when billing is enabled on this instance but the
// workspace has no active subscription. Self-hosted instances with billing off
// never show any dormant UI. `isConfigured` reflects the billing master switch
// (supporters enabled and Paddle configured), not merely a Paddle client token.
const useWorkspaceDormancy = () => {
  const { isConfigured } = usePaddleContext();
  const workspace = useCurrentWorkspace();

  return {
    isDormant: !!(isConfigured && workspace && !workspace.subscription),
    isOwner: workspace?.myRole === "owner",
    workspaceSlug: workspace?.slug,
  };
};

/**
 * Persistent banner shown across all workspace pages while the workspace is
 * dormant; disappears once a subscription is active.
 */
export const WorkspaceDormantBanner = () => {
  const { isDormant, isOwner, workspaceSlug } = useWorkspaceDormancy();

  if (!isDormant || !workspaceSlug) {
    return null;
  }

  return (
    <Alert.Root status="warning" role="status" borderRadius={0}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>This workspace is not subscribed</Alert.Title>
        <Alert.Description>
          {isOwner
            ? "Feeds are disabled until the workspace is activated."
            : "Feeds are disabled until the workspace owner activates a subscription."}{" "}
          Your personal feeds are not affected.{" "}
          <ChakraLink asChild color="text.link" textDecoration="underline">
            <RouterLink to={pages.userFeeds()}>Go to your personal feeds</RouterLink>
          </ChakraLink>
        </Alert.Description>
      </Alert.Content>
      {isOwner && (
        /* Solid (not outline): the recipe-pinned neutral palette inverts to a light pill in
           dark mode, which reads as the banner's CTA — an outline's gray edge competes with
           the alert's own status-colored border on the tinted fill. */
        <Button asChild size="sm" alignSelf="center" variant="solid">
          <RouterLink to={pages.workspaceBilling(workspaceSlug)}>Activate workspace</RouterLink>
        </Button>
      )}
    </Alert.Root>
  );
};

/**
 * The pay-at-blocked-intent surface: a dormant workspace's feeds page shows
 * this instead of the add-feed experience.
 */
export const WorkspaceActivationEmptyState = () => {
  const { isOwner, workspaceSlug } = useWorkspaceDormancy();

  if (!workspaceSlug) {
    return null;
  }

  return (
    <Stack alignItems="center" textAlign="center" gap={4} paddingY={16} paddingX={4}>
      <Heading as="h2" size="lg">
        Activate your workspace to start adding feeds
      </Heading>
      {isOwner ? (
        <>
          <Text color="fg.muted" maxW="40rem">
            Your workspace is set up. Members, invitations, and settings all work. Subscribe to a
            workspace plan to enable feeds.
          </Text>
          <Button asChild size="lg" colorPalette="brand">
            <RouterLink to={pages.workspaceBilling(workspaceSlug)}>Activate workspace</RouterLink>
          </Button>
          <Text fontSize="sm" color="fg.muted" maxW="40rem">
            Not ready? Your personal feeds stay free.{" "}
            <ChakraLink asChild color="text.link" textDecoration="underline">
              <RouterLink to={pages.userFeeds()}>Go to your personal feeds</RouterLink>
            </ChakraLink>
          </Text>
        </>
      ) : (
        <>
          <Text color="fg.muted" maxW="40rem">
            Feeds are disabled because this workspace has no active subscription. Ask the workspace
            owner to activate it from the workspace&apos;s Billing page.
          </Text>
          <Text fontSize="sm" color="fg.muted" maxW="40rem">
            Your personal feeds are not affected.{" "}
            <ChakraLink asChild color="text.link" textDecoration="underline">
              <RouterLink to={pages.userFeeds()}>Go to your personal feeds</RouterLink>
            </ChakraLink>
          </Text>
        </>
      )}
    </Stack>
  );
};
