import { Alert, AlertDescription, AlertIcon, Box, Button, Stack, Text } from "@chakra-ui/react";
import { useContext } from "react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { BlockableFeature, ProductKey, SupporterTier } from "../../constants";
import { PricingDialogContext } from "../../contexts";
import { useUserMe } from "../../features/discordUser";
import { useIsFeatureAllowed } from "../../hooks";

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
        isOnPatreon ? currentTier.patreon : currentTier.regular
      );
      const requiredTierIndex = supporterTiersOrdered.indexOf(showTier);

      if (currentTierIndex < requiredTierIndex) {
        buttonText = "Upgrade to access";
      }
    }
  }

  return (
    <Stack>
      <Alert rounded="md" status="warning" role={undefined}>
        <AlertIcon />
        <AlertDescription>
          <Box>
            <Text>
              {alternateText ||
                `You must be a supporter at a sufficient tier (${showTier}) to access this. Consider
              supporting MonitoRSS's free services and open-source development!`}
            </Text>
            {userMeData?.result.enableBilling && (
              <Button mt={4} onClick={onClickBecomeSupporter}>
                {buttonText}
              </Button>
            )}
            {!userMeData?.result.enableBilling && (
              <Button
                as="a"
                mt={4}
                href="https://www.patreon.com/monitorss"
                target="_blank"
                rel="noreferrer noopener"
                rightIcon={<ExternalLinkIcon />}
              >
                Become a supporter
              </Button>
            )}
          </Box>
        </AlertDescription>
      </Alert>
    </Stack>
  );
};
