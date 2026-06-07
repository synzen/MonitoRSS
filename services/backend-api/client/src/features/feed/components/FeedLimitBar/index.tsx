import { useContext } from "react";
import { HStack, Text, Button, VisuallyHidden, Icon } from "@chakra-ui/react";
import { FaTriangleExclamation } from "react-icons/fa6";
import { useUserFeeds } from "../../hooks";
import { useFeedScope } from "../../contexts/FeedScopeContext";
import { useDiscordUserMe } from "../../../discordUser";
import { PricingDialogContext } from "@/features/subscriptionProducts";

interface FeedLimitBarProps {
  showOnlyWhenConstrained?: boolean;
}

export const FeedLimitBar = ({ showOnlyWhenConstrained = false }: FeedLimitBarProps) => {
  // In workspace scope the count is the workspace's (the scoped useUserFeeds) and the
  // limit comes from the workspace; in personal scope it's the user's. The upsell
  // (personal Paddle) is hidden in workspace scope — no workspace plan exists yet.
  const scope = useFeedScope();
  const isWorkspaceScope = !!scope.workspaceId;
  const { data: userFeedsData } = useUserFeeds({ limit: 1, offset: 0 });
  const { data: discordUserMe } = useDiscordUserMe();
  const { onOpen } = useContext(PricingDialogContext);

  const currentCount = userFeedsData?.total;
  const maxCount = isWorkspaceScope ? scope.maxFeeds : discordUserMe?.maxUserFeeds;

  if (currentCount === undefined || maxCount === undefined) {
    return null;
  }

  const remaining = maxCount - currentCount;
  const isAtLimit = remaining <= 0;
  const nearLimitThreshold = Math.min(3, Math.floor(maxCount * 0.2));
  const isNearLimit = !isAtLimit && remaining <= nearLimitThreshold;

  if (showOnlyWhenConstrained && !isAtLimit && !isNearLimit) {
    return null;
  }

  const increaseLimitsButton = isWorkspaceScope ? null : (
    <Button variant="outline" size="sm" onClick={onOpen}>
      Increase Limits
    </Button>
  );

  if (isAtLimit) {
    return (
      <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
        <HStack role="status">
          <Icon as={FaTriangleExclamation} color="text.error" aria-hidden="true" />
          <Text color="text.error" fontWeight="semibold">
            Feed limit reached ({currentCount}/{maxCount})
          </Text>
        </HStack>
        {!isWorkspaceScope && (
          <Button size="sm" onClick={onOpen}>
            Increase Limits
          </Button>
        )}
      </HStack>
    );
  }

  if (isNearLimit) {
    return (
      <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
        <HStack role="status">
          <Icon as={FaTriangleExclamation} color="text.warning" aria-hidden="true" />
          <Text color="text.warning" fontWeight="semibold">
            <VisuallyHidden>Warning:</VisuallyHidden>
            Feed Limit: {currentCount}/{maxCount} · {remaining} remaining
          </Text>
        </HStack>
        {increaseLimitsButton}
      </HStack>
    );
  }

  return (
    <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
      <Text role="status" fontWeight="semibold">
        Feed Limit: {currentCount}/{maxCount}
      </Text>
      {increaseLimitsButton}
    </HStack>
  );
};
