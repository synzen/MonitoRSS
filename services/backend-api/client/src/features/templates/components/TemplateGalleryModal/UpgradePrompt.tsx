import React from "react";
import { CheckIcon, LockIcon } from "@chakra-ui/icons";
import {
  VStack,
  Box,
  Button,
  Skeleton,
  Text,
  HStack,
  Link as ChakraLink,
  Switch,
  Badge,
} from "@chakra-ui/react";
import {
  PRICE_IDS,
  ProductKey,
  PRODUCT_NAMES,
  ProductFeature,
  TIER_CONFIGS,
} from "../../../../constants";

export interface UpgradePromptProps {
  upgradeHeadingRef: React.RefObject<HTMLParagraphElement>;
  billingInterval: "month" | "year";
  onBillingIntervalChange: (interval: "month" | "year") => void;
  isPriceLoading: boolean;
  tier1Prices: { month?: string; year?: string };
  isPaddleLoaded?: boolean;
  onCheckout: (priceId: string) => void;
  onBackToEditor: () => void;
}

export const UpgradePrompt = ({
  upgradeHeadingRef,
  billingInterval,
  onBillingIntervalChange,
  isPriceLoading,
  tier1Prices,
  isPaddleLoaded,
  onCheckout,
  onBackToEditor,
}: UpgradePromptProps) => {
  return (
    <Box
      role="region"
      aria-label="Upgrade to save custom branding"
      p={8}
      textAlign="center"
      maxW="480px"
      mx="auto"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minH={{ lg: "400px" }}
    >
      <LockIcon boxSize={8} color="blue.300" mb={4} />
      <Text
        as="h3"
        ref={upgradeHeadingRef}
        tabIndex={-1}
        fontSize="lg"
        fontWeight="semibold"
        mb={2}
      >
        Custom branding is included on all paid plans
      </Text>
      <Text color="whiteAlpha.700" mb={5}>
        Deliver articles with your own name and avatar.
      </Text>
      <VStack as="ul" spacing={2} mb={6} alignItems="flex-start" listStyleType="none">
        {TIER_CONFIGS.find((t) => t.productId === ProductKey.Tier1)
          ?.features.filter(
            (f) =>
              f.name === ProductFeature.Webhooks ||
              f.name === ProductFeature.Feeds ||
              f.name === ProductFeature.RefreshRate
          )
          .map((feature) => (
            <HStack as="li" key={feature.name} spacing={2}>
              <CheckIcon boxSize={3} color="green.400" />
              <Text fontSize="sm" color="whiteAlpha.900">
                {feature.description}
              </Text>
            </HStack>
          ))}
      </VStack>

      <Box
        w="100%"
        bg="whiteAlpha.50"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="lg"
        p={5}
        mb={6}
        role="group"
        aria-label="Pricing options"
      >
        <HStack justifyContent="center" spacing={3} mb={2}>
          <Text fontSize="sm" fontWeight="semibold">
            Monthly
          </Text>
          <Switch
            size="md"
            colorScheme="green"
            isChecked={billingInterval === "year"}
            onChange={(e) => onBillingIntervalChange(e.target.checked ? "year" : "month")}
            aria-label="Switch to yearly pricing"
          />
          <Text fontSize="sm" fontWeight="semibold">
            Yearly
          </Text>
        </HStack>
        <Badge colorScheme="green" borderRadius="md" px={2} mb={4}>
          Save 15% with yearly
        </Badge>
        <Box aria-live="polite" aria-atomic="true">
          {isPriceLoading ? (
            <Skeleton height="36px" width="160px" mx="auto" borderRadius="md" />
          ) : (
            <Text fontSize="3xl" fontWeight="bold">
              {tier1Prices[billingInterval] || "—"}
              <Text as="span" fontSize="lg" fontWeight="normal" color="whiteAlpha.700">
                /{billingInterval === "month" ? "month" : "year"}
              </Text>
            </Text>
          )}
        </Box>
      </Box>

      <Button
        colorScheme="blue"
        size="lg"
        mb={3}
        isDisabled={!isPaddleLoaded || isPriceLoading}
        onClick={() => {
          const priceId = PRICE_IDS[ProductKey.Tier1][billingInterval];
          onCheckout(priceId);
        }}
      >
        Get {PRODUCT_NAMES[ProductKey.Tier1]}
      </Button>
      <Box mb={4}>
        <ChakraLink fontSize="sm" color="whiteAlpha.700" onClick={onBackToEditor} cursor="pointer">
          Back to editor
        </ChakraLink>
      </Box>
      <Text fontSize="xs" color="whiteAlpha.700">
        By proceeding to payment, you agree to our{" "}
        <ChakraLink
          href="https://monitorss.xyz/terms"
          target="_blank"
          rel="noopener noreferrer"
          color="blue.300"
        >
          terms
        </ChakraLink>{" "}
        and{" "}
        <ChakraLink
          href="https://monitorss.xyz/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          color="blue.300"
        >
          privacy policy
        </ChakraLink>
        . Payments handled by Paddle.com.
      </Text>
    </Box>
  );
};
