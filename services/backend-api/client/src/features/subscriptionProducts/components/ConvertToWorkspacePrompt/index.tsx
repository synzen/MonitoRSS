import { useState } from "react";
import { Box, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { FaUsers } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { CloseButton } from "@/components/ui/close-button";
import { ProductKey } from "@/constants";
import { useUserMe } from "@/features/discordUser";
import {
  CreateWorkspaceDialog,
  useIsWorkspacesEnabled,
  useWorkspaces,
} from "@/features/workspaces";

// The personal plans whose subscription can fund a workspace. Mirrors the
// backend's WORKSPACE_BASE_TIER_KEYS / resolvePersonalConvertibility (Tier 2/3);
// the client can't import across the package boundary, so the gate is duplicated
// here for display only. The backend re-validates at convert time.
const CONVERTIBLE_PERSONAL_PLANS = new Set<ProductKey>([ProductKey.Tier2, ProductKey.Tier3]);

// New user-facing copy, no em dashes (project convention).
const PROMPT_HEADING = "Your personal plan can become a workspace.";
const PROMPT_BODY =
  "Same feeds, same price, plus the ability to invite a team. Create a workspace, then move your plan onto it.";

const DISMISSED_STORAGE_KEY = "convertToWorkspacePromptDismissed";

// Surfaces the personal-to-workspace conversion offer to an eligible subscriber.
// Converting needs a workspace to move the plan onto, so the CTA opens the
// existing create-workspace flow; the workspace's own billing page then hosts
// the actual convert step (the existing ConvertPersonalPlanDialog). The card
// variant is dismissible (persisted); the dialog banner variant always shows
// while eligible.
export const ConvertToWorkspacePrompt = ({ variant }: { variant: "banner" | "card" }) => {
  const { data: userMe } = useUserMe();
  const { enabled: workspacesEnabled } = useIsWorkspacesEnabled();
  const { workspaces } = useWorkspaces({ enabled: workspacesEnabled });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_STORAGE_KEY) === "true",
  );

  const productKey = userMe?.result.subscription.product.key as ProductKey | undefined;
  const hasConvertiblePlan = !!productKey && CONVERTIBLE_PERSONAL_PLANS.has(productKey);
  // This prompt's whole job is to get a convertible solo subscriber INTO a
  // workspace they can move the plan onto, via the create flow. If they already
  // own a workspace, that flow is the wrong door: they should convert from that
  // workspace's billing page (which hosts the real convert action), not spin up
  // a second one. So suppress once they own any workspace.
  const ownsAWorkspace = !!workspaces?.some((w) => w.role === "owner");
  const eligible = hasConvertiblePlan && !ownsAWorkspace;

  if (!workspacesEnabled || !eligible || (variant === "card" && dismissed)) {
    return null;
  }

  const onDismiss = () => {
    localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
    setDismissed(true);
  };

  return (
    <>
      <CreateWorkspaceDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <Flex
        width={variant === "banner" ? "100%" : undefined}
        maxW={variant === "banner" ? "1100px" : undefined}
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border.emphasized"
        borderRadius="md"
        padding={4}
        gap={4}
        direction={{ base: "column", md: "row" }}
        alignItems={{ base: "stretch", md: "center" }}
        justifyContent="space-between"
      >
        <HStack gap={3} alignItems="flex-start">
          <Icon color="text.link" mt={1} aria-hidden>
            <FaUsers />
          </Icon>
          <Stack gap={1}>
            <Text fontWeight="medium">{PROMPT_HEADING}</Text>
            <Text fontSize="sm" color="fg.muted">
              {PROMPT_BODY}
            </Text>
          </Stack>
        </HStack>
        <HStack gap={2} flexShrink={0}>
          <PrimaryActionButton onClick={() => setIsCreateOpen(true)}>
            Create a workspace
          </PrimaryActionButton>
          {variant === "card" && (
            <Box>
              <CloseButton aria-label="Dismiss" size="sm" variant="ghost" onClick={onDismiss} />
            </Box>
          )}
        </HStack>
      </Flex>
    </>
  );
};
