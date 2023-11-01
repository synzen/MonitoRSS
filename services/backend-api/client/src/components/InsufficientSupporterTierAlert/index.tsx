import { Alert, AlertDescription, AlertTitle, Button, Link, Stack } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { SupporterTier } from "../../constants";

interface Props {
  tier: SupporterTier;
}

export const InsufficientSupporterTier = ({ tier }: Props) => {
  return (
    <Alert rounded="lg" py={4} status="warning">
      <Stack spacing={3}>
        <AlertTitle>
          While you can use this feature, you must be a supporter at a sufficient tier ({tier}) to
          have this feature applied during delivery.
        </AlertTitle>
        <AlertDescription>
          <Button
            as={Link}
            href="https://www.patreon.com/monitorss"
            rel="noopener noreferrer"
            target="_blank"
            rightIcon={<ExternalLinkIcon />}
          >
            Become a supporter
          </Button>
        </AlertDescription>
      </Stack>
    </Alert>
  );
};
