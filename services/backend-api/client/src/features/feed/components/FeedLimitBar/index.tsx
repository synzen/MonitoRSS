import { useContext } from "react";
import {
  HStack,
  Text,
  Button,
  VisuallyHidden,
  Icon,
  Stack,
} from "@chakra-ui/react";
import { FaTriangleExclamation } from "react-icons/fa6";
import { useUserFeeds } from "../../hooks";
import { useFeedScope } from "../../contexts/FeedScopeContext";
import { useDiscordUserMe, useUserMe } from "../../../discordUser";
import { PricingDialogContext } from "@/features/subscriptionProducts";

interface FeedLimitBarProps {
  showOnlyWhenConstrained?: boolean;
}

export const FeedLimitBar = ({
  showOnlyWhenConstrained = false,
}: FeedLimitBarProps) => {
  // In workspace scope the count is the workspace's (the scoped useUserFeeds) and the
  // limit comes from the workspace; in personal scope it's the user's. The upsell
  // (personal Paddle) is hidden in workspace scope — no workspace plan exists yet.
  const scope = useFeedScope();
  const isWorkspaceScope = !!scope.workspaceId;
  const { data: userFeedsData } = useUserFeeds({ limit: 1, offset: 0 });
  const { data: discordUserMe } = useDiscordUserMe();
  const { data: userMeData } = useUserMe();
  const { onOpen } = useContext(PricingDialogContext);

  const currentCount = userFeedsData?.total;
  const maxCount = isWorkspaceScope
    ? scope.maxFeeds
    : discordUserMe?.maxUserFeeds;
  const premiumCount = userFeedsData?.premiumFeedCount ?? 0;
  const maxPremiumCount = userFeedsData?.premiumFeedLimit;
  const isPremiumFeedLimitVisible =
    userMeData?.result.capabilities?.premiumFeeds === true;

  if (
    currentCount === undefined ||
    maxCount === undefined ||
    premiumCount === undefined ||
    maxPremiumCount === undefined
  ) {
    return null;
  }

  const remaining = maxCount - currentCount;
  const isAtLimit = remaining <= 0;
  const nearLimitThreshold = Math.min(3, Math.floor(maxCount * 0.2));
  const isNearLimit = !isAtLimit && remaining <= nearLimitThreshold;
  const premiumRemaining = maxPremiumCount - premiumCount;
  const isAtPremiumLimit = premiumRemaining <= 0;
  const premiumNearLimitThreshold = Math.min(
    3,
    Math.floor(maxPremiumCount * 0.2),
  );
  const isNearPremiumLimit =
    !isAtPremiumLimit && premiumRemaining <= premiumNearLimitThreshold;

  if (
    showOnlyWhenConstrained &&
    !isAtLimit &&
    !isNearLimit &&
    (!isPremiumFeedLimitVisible || (!isAtPremiumLimit && !isNearPremiumLimit))
  ) {
    return null;
  }

  const increaseLimitsButton = isWorkspaceScope ? null : (
    <Button variant="outline" size="sm" onClick={() => onOpen()}>
      Increase Limits
    </Button>
  );

  if (isAtLimit) {
    return (
      <Stack gap={1}>
        <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
          <HStack role="status">
            <Icon
              as={FaTriangleExclamation}
              color="text.error"
              aria-hidden="true"
            />
            <Text color="text.error" fontWeight="semibold">
              Feed limit reached ({currentCount}/{maxCount})
            </Text>
          </HStack>
          {!isWorkspaceScope && (
            <Button size="sm" onClick={() => onOpen("workspace")}>
              Increase Limits
            </Button>
          )}
        </HStack>
        {isPremiumFeedLimitVisible && (
          <PremiumLimit
            currentCount={premiumCount}
            maxCount={maxPremiumCount}
            isAtLimit={isAtPremiumLimit}
            isNearLimit={isNearPremiumLimit}
          />
        )}
      </Stack>
    );
  }

  if (isNearLimit) {
    return (
      <Stack gap={1}>
        <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
          <HStack role="status">
            <Icon
              as={FaTriangleExclamation}
              color="text.warning"
              aria-hidden="true"
            />
            <Text color="text.warning" fontWeight="semibold">
              <VisuallyHidden>Warning:</VisuallyHidden>
              Feed Limit: {currentCount}/{maxCount} · {remaining} remaining
            </Text>
          </HStack>
          {increaseLimitsButton}
        </HStack>
        {isPremiumFeedLimitVisible && (
          <PremiumLimit
            currentCount={premiumCount}
            maxCount={maxPremiumCount}
            isAtLimit={isAtPremiumLimit}
            isNearLimit={isNearPremiumLimit}
          />
        )}
      </Stack>
    );
  }

  return (
    <Stack gap={1}>
      <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Text role="status" fontWeight="semibold">
          Feed Limit: {currentCount}/{maxCount}
        </Text>
        {increaseLimitsButton}
      </HStack>
      {isPremiumFeedLimitVisible && (
        <PremiumLimit
          currentCount={premiumCount}
          maxCount={maxPremiumCount}
          isAtLimit={isAtPremiumLimit}
          isNearLimit={isNearPremiumLimit}
        />
      )}
    </Stack>
  );
};

const PremiumLimit = ({
  currentCount,
  maxCount,
  isAtLimit,
  isNearLimit,
}: {
  currentCount: number;
  maxCount: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
}) => {
  const remaining = maxCount - currentCount;

  return (
    <HStack role="status" flexWrap="wrap" gap={1}>
      {isAtLimit && (
        <Icon
          as={FaTriangleExclamation}
          color="text.error"
          aria-hidden="true"
        />
      )}
      {isNearLimit && (
        <Icon
          as={FaTriangleExclamation}
          color="text.warning"
          aria-hidden="true"
        />
      )}
      <Text
        color={
          isAtLimit ? "text.error" : isNearLimit ? "text.warning" : undefined
        }
        fontWeight="semibold"
      >
        <VisuallyHidden>
          {isAtLimit ? "Premium feed limit reached: " : ""}
        </VisuallyHidden>
        Premium Feed Limit: {currentCount}/{maxCount}
        {isNearLimit && ` · ${remaining} remaining`}
      </Text>
    </HStack>
  );
};
