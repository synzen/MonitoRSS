import { Alert, AlertDescription, AlertTitle, Button, Link, Stack } from "@chakra-ui/react";
import { SupporterTier } from "../../constants";

interface Props {
  tier: SupporterTier;
}

export const InsufficientSupporterTier = ({ tier }: Props) => {
  return (
    <Alert rounded="lg" py={4}>
      <Stack spacing={3}>
        <AlertTitle>You must be a supporter at a sufficient tier ({tier}) to use this.</AlertTitle>
        <AlertDescription>
          <Button
            as={Link}
            colorScheme="purple"
            href="https://www.patreon.com/monitorss"
            rel="noopener noreferrer"
            target="_blank"
          >
            Become a supporter
          </Button>
        </AlertDescription>
      </Stack>
    </Alert>
  );
};
