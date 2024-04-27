import { Alert, AlertDescription, Box, Button, Stack, Text } from "@chakra-ui/react";
import { useContext } from "react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { BlockableFeature, SupporterTier } from "../../constants";
import { PricingDialogContext } from "../../contexts";
import { useUserMe } from "../../features/discordUser";
import { useIsFeatureAllowed } from "../../hooks";

interface Props {
  onClick?: () => void;
  alternateText?: string;
  feature: BlockableFeature;
  supporterTier: SupporterTier;
}

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
  } else if (!isOnPatreon && supporterTier === SupporterTier.T3) {
    showTier = SupporterTier.T6;
  }

  return (
    <Stack>
      <Alert rounded="md" colorScheme="purple">
        <AlertDescription>
          <Box>
            <Text>
              {alternateText ||
                `You must be a supporter at a sufficient tier (${showTier}) to access this. Consider
              supporting MonitoRSS's free services and open-source development!`}
            </Text>
            {userMeData?.result.enableBilling && (
              <Button mt={4} onClick={onClickBecomeSupporter} colorScheme="purple">
                Become a supporter
              </Button>
            )}
            {!userMeData?.result.enableBilling && (
              <Button
                as="a"
                mt={4}
                colorScheme="purple"
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
