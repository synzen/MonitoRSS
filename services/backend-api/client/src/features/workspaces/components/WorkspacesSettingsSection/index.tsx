import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Link as ChakraLink,
  Separator,
  Skeleton,
  Stack,
  Text,
  useDisclosure,
  VisuallyHidden,
} from "@chakra-ui/react";
import { FaGear, FaPlus } from "react-icons/fa6";
import { Link as RouterLink } from "react-router-dom";
import { pages } from "@/constants";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useIsWorkspacesEnabled, useWorkspaces } from "../../hooks";
import { CreateWorkspaceDialog } from "../CreateWorkspaceDialog";
import { PendingInvitationsList } from "../PendingInvitationsList";

const LIVE_STATUS_TEXT: Record<string, string> = {
  loading: "Loading your teams",
  success: "Teams loaded",
};

/**
 * "Your workspaces" section for the Account Settings page. Renders only when the
 * workspaces feature is enabled. It is an overview + entry point, not a management
 * surface — per-workspace management lives on `/workspaces/:workspaceSlug/settings`. No "leave"
 * action is shown: no leave endpoint exists yet, and dead/disabled UI that
 * implies an action works is avoided.
 */
export const WorkspacesSettingsSection = () => {
  const { enabled } = useIsWorkspacesEnabled();
  const { workspaces, status, error, refetch } = useWorkspaces({ enabled });
  const createDisclosure = useDisclosure();

  if (!enabled) {
    return null;
  }

  return (
    <>
      <Separator />
      <Stack gap={6}>
        <Flex justifyContent="space-between" alignItems="center" gap={4} flexWrap="wrap">
          <Heading as="h2" size="md">
            Your teams
          </Heading>
          <PrimaryActionButton size="sm" onClick={createDisclosure.onOpen}>
            <FaPlus />
            Create team
          </PrimaryActionButton>
        </Flex>
        <Text color="fg.muted" fontSize="sm">
          Teams let you collaborate on feeds with others. Open a team to work in it, or change its
          settings.
        </Text>
        <VisuallyHidden aria-live="polite">{LIVE_STATUS_TEXT[status] ?? ""}</VisuallyHidden>
        {status === "loading" && (
          <Stack gap={3} aria-busy="true">
            <Skeleton height="60px" borderRadius="md" />
            <Skeleton height="60px" borderRadius="md" />
          </Stack>
        )}
        {status === "error" && (
          <Box>
            <InlineErrorAlert title="Failed to load your teams" description={error?.message} />
            <Button size="sm" mt={3} onClick={() => refetch()}>
              Try again
            </Button>
          </Box>
        )}
        {status === "success" && workspaces?.length === 0 && (
          <Text color="fg.muted">You&apos;re not in any teams yet. Create one to get started.</Text>
        )}
        {status === "success" && !!workspaces?.length && (
          <Stack as="ul" listStyleType="none" gap={3}>
            {workspaces.map((workspace) => (
              <HStack
                as="li"
                key={workspace.id}
                justifyContent="space-between"
                alignItems="center"
                borderWidth={1}
                borderColor="border.emphasized"
                rounded="md"
                p={4}
                gap={4}
                flexWrap="wrap"
              >
                <HStack gap={3} alignItems="center">
                  <Text fontWeight={600}>{workspace.name}</Text>
                  <Badge
                    colorPalette={workspace.role === "owner" ? "purple" : "gray"}
                    textTransform="capitalize"
                  >
                    {workspace.role}
                  </Badge>
                </HStack>
                <HStack gap={2}>
                  <Button asChild size="sm" variant="outline">
                    <RouterLink to={pages.userFeeds({ workspaceSlug: workspace.slug })}>
                      Open
                    </RouterLink>
                  </Button>
                  <ChakraLink
                    asChild
                    display="inline-flex"
                    alignItems="center"
                    gap={1}
                    color="text.link"
                  >
                    <RouterLink
                      to={pages.workspaceSettings(workspace.slug)}
                      aria-label={`${workspace.name} settings`}
                    >
                      <FaGear /> Settings
                    </RouterLink>
                  </ChakraLink>
                </HStack>
              </HStack>
            ))}
          </Stack>
        )}
        <PendingInvitationsList enabled={enabled} />
      </Stack>
      <CreateWorkspaceDialog isOpen={createDisclosure.open} onClose={createDisclosure.onClose} />
    </>
  );
};
