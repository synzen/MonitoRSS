import { Alert, AlertDescription, Box, Button, Stack, Text } from "@chakra-ui/react";
import { useContext } from "react";
import { SupporterTier } from "../../constants";
import { PricingDialogContext } from "../../contexts";

interface Props {
  tier: SupporterTier;
  onClick?: () => void;
  alternateText?: string;
}

export const SubscriberBlockText = ({ tier, alternateText, onClick }: Props) => {
  const { onOpen } = useContext(PricingDialogContext);

  const onClickBecomeSupporter = () => {
    if (onClick) {
      onClick?.();
    }

    onOpen();
  };

  return (
    <Stack>
      <Alert rounded="md" colorScheme="purple">
        <AlertDescription>
          <Box>
            <Text>
              {alternateText ||
                `You must be a supporter at a sufficient tier (${tier}) to access this. Consider
              supporting MonitoRSS's free services and open-source development!`}
            </Text>
            <Button mt={4} onClick={onClickBecomeSupporter} colorScheme="purple">
              Become a supporter
            </Button>
          </Box>
        </AlertDescription>
      </Alert>
    </Stack>
  );
};
