import { Alert, Box, Stack, Text } from "@chakra-ui/react";
import { RedditLoginButton, useUserMe } from "../../../discordUser";

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

  const hasRedditConnected =
    data?.result.externalAccounts?.find((e) => e.type === "reddit")?.status === "ACTIVE";

  if (hasRedditConnected) {
    return null;
  }

  return (
    <Stack>
      <Alert.Root status="success">
        <Alert.Content>
          <Alert.Title>Connect your Reddit account</Alert.Title>
          <Alert.Description>
            <Stack gap={4}>
              <Text>
                Reddit has stringent rate limits by default. With your account connected, you will
                have access to higher quotas for Reddit feeds that may allow requests to go through.
              </Text>
              <Stack>
                <Box>
                  <RedditLoginButton size="md" colorPalette="green" onConnected={onCorrected} />
                </Box>
                <Text color="fg.muted" fontSize="sm">
                  A window will pop up prompting for authorization.
                </Text>
              </Stack>
            </Stack>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    </Stack>
  );
};
