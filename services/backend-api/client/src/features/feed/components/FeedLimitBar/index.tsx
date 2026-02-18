import { useContext } from "react";
import { Box, HStack, Text, Button, VisuallyHidden } from "@chakra-ui/react";
import { MinusIcon, WarningIcon } from "@chakra-ui/icons";
import { useUserFeeds } from "../../hooks";
import { useDiscordUserMe } from "../../../discordUser";
import { PricingDialogContext } from "../../../../contexts";

export const FeedLimitBar = () => {
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
  const isNearLimit = !isAtLimit && remaining <= 3;

  if (isAtLimit) {
    return (
      <Box>
        <HStack role="status">
          <MinusIcon color="red.300" boxSize={3} aria-hidden="true" />
          <Text color="red.300" fontWeight="semibold">
            Feed Limit: {currentCount}/{maxCount}
          </Text>
        </HStack>
        <Box bg="yellow.900" p={3} borderRadius="md" mt={2} role="alert">
          <HStack alignItems="flex-start" spacing={2}>
            <WarningIcon color="yellow.400" aria-hidden="true" mt={0.5} />
            <Text fontSize="sm">
              You&apos;ve reached your feed limit. Upgrade your plan to add more feeds.
            </Text>
          </HStack>
          <Button size="sm" mt={2} onClick={onOpen}>
            Increase Limits
          </Button>
        </Box>
      </Box>
    );
  }

  if (isNearLimit) {
    return (
      <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
        <HStack>
          <WarningIcon color="yellow.400" aria-hidden="true" />
          <Text color="yellow.400" fontWeight="semibold" role="status">
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
      <Text role="status">
        Feed Limit: {currentCount}/{maxCount}
      </Text>
      <Button variant="outline" size="sm" onClick={onOpen}>
        Increase Limits
      </Button>
    </HStack>
  );
};
