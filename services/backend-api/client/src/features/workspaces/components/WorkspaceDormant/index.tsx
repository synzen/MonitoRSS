import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Button,
  Heading,
  HStack,
  Link as ChakraLink,
  Spinner,
  Stack,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { pages } from "@/constants";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { useCurrentWorkspace } from "../../contexts/CurrentWorkspaceContext";
import { useWorkspace, useWorkspaceActivationPolling } from "../../hooks";
import { useJustConvertedWorkspace } from "../../contexts";
import { ConvertPersonalPlanDialog } from "../WorkspaceBilling/ConvertPersonalPlanDialog";

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

// The shared reassurance footer for an owner: an exit back to their free
// personal feeds, identical across the convert and plain-activate branches.
const OwnerExitToPersonalFeeds = () => (
  <Text fontSize="sm" color="fg.muted" maxW="40rem">
    Not ready? Your personal feeds stay free.{" "}
    <ChakraLink asChild color="text.link" textDecoration="underline">
      <RouterLink to={pages.userFeeds()}>Go to your personal feeds</RouterLink>
    </ChakraLink>
  </Text>
);

// The owner's activation actions. The default is the plain "Activate workspace"
// route to billing; when the owner has a convertible personal plan we surface
// the cheaper move-my-plan path here at the moment of intent, with billing
// demoted to a secondary link. The convert dialog and its post-convert
// "confirming" state are hosted inline so the owner never leaves the feeds page.
const OwnerActivationActions = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const currentWorkspace = useCurrentWorkspace();
  const { workspace, refetch } = useWorkspace({ workspaceSlug });
  const conversion = workspace?.conversion ?? null;
  const subscription = workspace?.subscription ?? null;
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const { markConverted } = useJustConvertedWorkspace();

  const { awaitingActivation, beginActivation, billingAnnouncement } =
    useWorkspaceActivationPolling({
      workspaceId: currentWorkspace?.id,
      subscription,
      refetch,
    });

  if (awaitingActivation && !subscription) {
    return (
      <Stack alignItems="center" gap={3}>
        <VisuallyHidden role="status">{billingAnnouncement}</VisuallyHidden>
        <HStack>
          <Spinner size="sm" />
          <Text>Confirming your subscription…</Text>
        </HStack>
      </Stack>
    );
  }

  if (conversion?.eligible) {
    return (
      <>
        <VisuallyHidden role="status">{billingAnnouncement}</VisuallyHidden>
        <Text color="fg.muted" maxW="40rem">
          You&apos;re already paying for a personal plan. Move it here and bring your feeds, instead
          of paying for two plans.
        </Text>
        <Stack alignItems="center" gap={2}>
          <PrimaryActionButton
            size="lg"
            aria-haspopup="dialog"
            onClick={() => setIsConvertOpen(true)}
          >
            Move my personal plan here
          </PrimaryActionButton>
          <ChakraLink asChild fontSize="sm" color="text.link" textDecoration="underline">
            <RouterLink to={pages.workspaceBilling(workspaceSlug)}>
              or choose a workspace plan instead
            </RouterLink>
          </ChakraLink>
        </Stack>
        <OwnerExitToPersonalFeeds />
        <ConvertPersonalPlanDialog
          open={isConvertOpen}
          onClose={() => setIsConvertOpen(false)}
          onConverted={() => {
            markConverted();
            beginActivation("Confirming your subscription…");
          }}
          workspaceSlug={workspaceSlug}
          feedLimit={conversion.feedLimit ?? 0}
        />
      </>
    );
  }

  return (
    <>
      <Text color="fg.muted" maxW="40rem">
        Your workspace is set up. Members, invitations, and settings all work. Subscribe to a
        workspace plan to enable feeds.
      </Text>
      <Button asChild size="lg" colorPalette="brand">
        <RouterLink to={pages.workspaceBilling(workspaceSlug)}>Activate workspace</RouterLink>
      </Button>
      <OwnerExitToPersonalFeeds />
    </>
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
        <OwnerActivationActions workspaceSlug={workspaceSlug} />
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
