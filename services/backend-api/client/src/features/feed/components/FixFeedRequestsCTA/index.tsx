import { Alert, AlertDescription, AlertTitle, Box, Stack, Text } from "@chakra-ui/react";
import { RedditLoginButton } from "../../../../components/RedditLoginButton/RedditLoginButton";
import { useUserMe } from "../../../discordUser";

interface Props {
  url: string;
  onCorrected?: () => void;
}

export const FixFeedRequestsCTA = ({ url, onCorrected }: Props) => {
  const { data } = useUserMe();
  const isReddit = /^http(s?):\/\/(www.)?(\w+\.)?reddit\.com\/r\//i.test(url);

  if (!isReddit) {
    return null;
  }

  const hasRedditConnected = data?.result.externalAccounts?.find((e) => e.type === "reddit");

  if (hasRedditConnected) {
    return null;
  }

  return (
    <Stack>
      <Alert status="success">
        <Box>
          <AlertTitle>Connect your Reddit account</AlertTitle>
          <AlertDescription>
            <Stack gap={4}>
              <Text>
                Reddit has stringent rate limits by default. With your account connected, you will
                have access to higher quotas for Reddit feeds that may allow requests to go through.
              </Text>
              <Stack>
                <Box>
                  <RedditLoginButton size="md" colorScheme="green" onConnected={onCorrected} />
                </Box>
                <Text color="whiteAlpha.700" fontSize="sm">
                  A window will pop up prompting for authorization.
                </Text>
              </Stack>
            </Stack>
          </AlertDescription>
        </Box>
      </Alert>
    </Stack>
  );
};
