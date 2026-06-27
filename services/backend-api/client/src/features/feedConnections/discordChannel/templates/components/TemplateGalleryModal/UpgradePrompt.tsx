import React from "react";
import { FaCheck, FaLock } from "react-icons/fa6";
import {
  VStack,
  Box,
  Button,
  Skeleton,
  Text,
  HStack,
  Link as ChakraLink,
  Badge,
  Icon,
} from "@chakra-ui/react";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/Panel";
import {
  PRICE_IDS,
  ProductKey,
  getPlanDisplayName,
  ProductFeature,
  TIER_CONFIGS,
} from "@/constants";

export interface UpgradePromptProps {
  upgradeHeadingRef: React.RefObject<HTMLParagraphElement>;
  billingInterval: "month" | "year";
  onBillingIntervalChange: (interval: "month" | "year") => void;
  isPriceLoading: boolean;
  tier1Prices: { month?: string; year?: string };
  isPaddleLoaded?: boolean;
  onCheckout: (priceId: string) => void;
  onBackToEditor: () => void;
  onSaveWithoutBranding: () => void;
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
  onSaveWithoutBranding,
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
      <Icon as={FaLock} boxSize={8} color="text.link" mb={4} />
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
      <Text color="fg.muted" mb={5}>
        Deliver articles with your own name and avatar.
      </Text>
      <VStack as="ul" gap={2} mb={6} alignItems="flex-start" listStyleType="none">
        {TIER_CONFIGS.find((t) => t.productId === ProductKey.Tier1)
          ?.features.filter(
            (f) =>
              f.name === ProductFeature.Webhooks ||
              f.name === ProductFeature.Feeds ||
              f.name === ProductFeature.RefreshRate,
          )
          .map((feature) => (
            <HStack as="li" key={feature.name} gap={2}>
              <Icon as={FaCheck} boxSize={3} color="text.success" />
              <Text fontSize="sm" color="fg">
                {feature.description}
              </Text>
            </HStack>
          ))}
      </VStack>
      <Panel w="100%" borderRadius="lg" p={5} mb={6} role="group" aria-label="Pricing options">
        <HStack justifyContent="center" gap={3} mb={2}>
          <Text fontSize="sm" fontWeight="semibold">
            Monthly
          </Text>
          <Switch
            size="md"
            colorPalette="green"
            checked={billingInterval === "year"}
            onCheckedChange={(details) =>
              onBillingIntervalChange(details.checked ? "year" : "month")
            }
            aria-label="Switch to yearly pricing"
          />
          <Text fontSize="sm" fontWeight="semibold">
            Yearly
          </Text>
        </HStack>
        <Badge colorPalette="green" borderRadius="l3" px={2} mb={4}>
          Save 15% with yearly
        </Badge>
        <Box aria-live="polite" aria-atomic="true">
          {isPriceLoading ? (
            <Skeleton height="36px" width="160px" mx="auto" borderRadius="l3" />
          ) : (
            <Text fontSize="3xl" fontWeight="bold">
              {tier1Prices[billingInterval] || "—"}
              <Text as="span" fontSize="lg" fontWeight="normal" color="fg.muted">
                /{billingInterval === "month" ? "month" : "year"}
              </Text>
            </Text>
          )}
        </Box>
      </Panel>
      <PrimaryActionButton
        size="lg"
        mb={3}
        disabled={!isPaddleLoaded || isPriceLoading}
        onClick={() => {
          const priceId = PRICE_IDS[ProductKey.Tier1][billingInterval];
          onCheckout(priceId);
        }}
      >
        Get {getPlanDisplayName(ProductKey.Tier1)}
      </PrimaryActionButton>
      <Button variant="outline" size="sm" mb={2} onClick={onSaveWithoutBranding}>
        Save without branding
      </Button>
      <Box mb={4}>
        <ChakraLink fontSize="sm" color="fg.muted" onClick={onBackToEditor} cursor="pointer">
          Back to editor
        </ChakraLink>
      </Box>
      <Text fontSize="xs" color="fg.muted">
        By proceeding to payment, you agree to our{" "}
        <ChakraLink
          href="https://monitorss.xyz/terms"
          target="_blank"
          rel="noopener noreferrer"
          color="text.link"
        >
          terms
        </ChakraLink>{" "}
        and{" "}
        <ChakraLink
          href="https://monitorss.xyz/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          color="text.link"
        >
          privacy policy
        </ChakraLink>
        . Payments handled by Paddle.com.
      </Text>
    </Box>
  );
};
