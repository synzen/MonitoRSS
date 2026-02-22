import { useContext } from "react";
import { HStack, Text, Button, VisuallyHidden } from "@chakra-ui/react";
import { WarningIcon } from "@chakra-ui/icons";
import { useUserFeeds } from "../../hooks";
import { useDiscordUserMe } from "../../../discordUser";
import { PricingDialogContext } from "../../../../contexts";

interface FeedLimitBarProps {
  showOnlyWhenConstrained?: boolean;
}

export const FeedLimitBar = ({ showOnlyWhenConstrained = false }: FeedLimitBarProps) => {
  const { data: userFeedsData } = useUserFeeds({ limit: 1, offset: 0 });
  const { data: discordUserMe } = useDiscordUserMe();
  const { onOpen } = useContext(PricingDialogContext);

  const currentCount = userFeedsData?.total;
  const maxCount = discordUserMe?.maxUserFeeds;

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

  if (isAtLimit) {
    return (
      <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
        <HStack>
          <WarningIcon color="red.300" aria-hidden="true" />
          <Text color="red.300" fontWeight="semibold">
            Feed limit reached ({currentCount}/{maxCount})
          </Text>
        </HStack>
        <Button size="sm" onClick={onOpen}>
          Increase Limits
        </Button>
      </HStack>
    );
  }

  if (isNearLimit) {
    return (
      <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
        <HStack>
          <WarningIcon color="yellow.400" aria-hidden="true" />
          <Text color="yellow.400" fontWeight="semibold">
            <VisuallyHidden>Warning:</VisuallyHidden>
            Feed Limit: {currentCount}/{maxCount} · {remaining} remaining
          </Text>
        </HStack>
        <Button variant="outline" size="sm" onClick={onOpen}>
          Increase Limits
        </Button>
      </HStack>
    );
  }

  return (
    <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
      <Text fontWeight="semibold">
        Feed Limit: {currentCount}/{maxCount}
      </Text>
      <Button variant="outline" size="sm" onClick={onOpen}>
        Increase Limits
      </Button>
    </HStack>
  );
};
