import { Alert, Box, Button, Stack, Text } from "@chakra-ui/react";
import { useContext } from "react";
import { FaUpRightFromSquare } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { ProductKey, SupporterTier } from "@/constants";
import { BlockableFeature } from "@/features/subscriptionProducts";
import { PricingDialogContext } from "../../contexts/PricingDialogContext";
import { useUserMe } from "@/features/discordUser";
import { useIsFeatureAllowed } from "../../hooks/useIsFeatureAllowed";

interface Props {
  onClick?: () => void;
  alternateText?: string;
  feature: BlockableFeature;
  supporterTier: SupporterTier;
}

const tierByProductKey = {
  [ProductKey.Free]: null,
  [ProductKey.Tier1]: {
    patreon: SupporterTier.T3,
    regular: SupporterTier.T1,
  },
  [ProductKey.Tier2]: {
    patreon: SupporterTier.T4,
    regular: SupporterTier.T2,
  },
  [ProductKey.Tier3]: {
    patreon: SupporterTier.T6,
    regular: SupporterTier.T3,
  },
  [ProductKey.Tier3Feed]: null, // Additional feed product, not a main tier
};

const supporterTiersOrdered = [
  SupporterTier.T1,
  SupporterTier.T2,
  SupporterTier.T3,
  SupporterTier.T4,
  SupporterTier.T6,
];

export const SubscriberBlockText = ({ alternateText, onClick, feature, supporterTier }: Props) => {
  const { onOpen } = useContext(PricingDialogContext);
  const { data: userMeData } = useUserMe();
  const { allowed, loaded } = useIsFeatureAllowed({
    feature,
  });

  const onClickBecomeSupporter = () => {
    if (onClick) {
      onClick?.();
    }

    onOpen();
  };

  if (!loaded) {
    return null;
  }

  if (allowed) {
    return null;
  }

  let showTier = supporterTier;

  const isOnPatreon = userMeData?.result.isOnPatreon;

  if (supporterTier === SupporterTier.Any) {
    showTier = SupporterTier.T1;
  } else if (isOnPatreon && supporterTier === SupporterTier.T1) {
    showTier = SupporterTier.T3;
  } else if (isOnPatreon && supporterTier === SupporterTier.T2) {
    showTier = SupporterTier.T4;
  } else if (isOnPatreon && supporterTier === SupporterTier.T3) {
    showTier = SupporterTier.T6;
  }

  let buttonText = "Become a supporter";

  if (userMeData) {
    const currentTier = tierByProductKey[userMeData.result.subscription.product.key];

    if (currentTier) {
      const currentTierIndex = supporterTiersOrdered.indexOf(
        isOnPatreon ? currentTier.patreon : currentTier.regular,
      );
      const requiredTierIndex = supporterTiersOrdered.indexOf(showTier);

      if (currentTierIndex < requiredTierIndex) {
        buttonText = "Upgrade to access";
      }
    }
  }

  return (
    <Stack>
      <Alert.Root status="warning" role={undefined}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            <Box>
              <Text>
                {alternateText ||
                  `Upgrade to a paid plan to deliver articles with your own custom name and avatar — so your feed looks like a natural part of your server.`}
              </Text>
              {userMeData?.result.enableBilling && (
                <PrimaryActionButton mt={4} onClick={onClickBecomeSupporter}>
                  {buttonText}
                </PrimaryActionButton>
              )}
              {/* Raw Button (not PrimaryActionButton) below: asChild merges into the <a>, but
                  PrimaryActionButton wraps children via SafeLoadingButton's Loader + click guard,
                  which doesn't compose with asChild. Keep the explicit solid+brand pair here. */}
              {!userMeData?.result.enableBilling && (
                <Button asChild variant="solid" colorPalette="brand" mt={4}>
                  <a
                    href="https://www.patreon.com/monitorss"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Become a supporter
                    <FaUpRightFromSquare />
                  </a>
                </Button>
              )}
            </Box>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    </Stack>
  );
};
