import { Alert, Box, Stack, Text } from "@chakra-ui/react";
import { RedditLoginButton, useUserMe } from "../../../discordUser";

type Variant = "rate-limited" | "required";

interface Props {
  url: string;
  variant?: Variant;
  onCorrected?: () => void;
}

const REDDIT_URL_REGEX = /^http(s?):\/\/(www.)?(\w+\.)?reddit\.com\//i;

export const FixFeedRequestsCTA = ({
  url,
  variant = "rate-limited",
  onCorrected,
}: Props) => {
  const { data } = useUserMe();
  const isReddit = REDDIT_URL_REGEX.test(url);

  if (!isReddit) {
    return null;
  }

  const hasRedditConnected =
    data?.result.externalAccounts?.find((e) => e.type === "reddit")?.status ===
    "ACTIVE";

  // For the rate-limited variant, an active connection means there's nothing to
  // prompt for - the request failed for another reason.
  if (variant === "rate-limited" && hasRedditConnected) {
    return null;
  }

  // The mandatory gate only fires server-side when the account is not active, so
  // an active connection here means the gate is stale; nothing to prompt.
  if (variant === "required" && hasRedditConnected) {
    return null;
  }

  // A reddit account record exists but is no longer active (revoked/expired).
  const needsReconnect =
    !!data?.result.externalAccounts?.find((e) => e.type === "reddit") &&
    !hasRedditConnected;

  const title =
    variant === "required"
      ? "Connect your Reddit account to continue"
      : "Connect your Reddit account";

  const description =
    variant === "required"
      ? "Reddit heavily rate-limits unauthenticated requests, so Reddit feeds need a connected account to fetch reliably. Connect your account to add this feed."
      : "Reddit heavily rate-limits unauthenticated requests. Connecting your account gives Reddit feeds the higher quota they need to fetch reliably.";

  return (
    <Stack>
      <Alert.Root status={variant === "required" ? "info" : "success"}>
        <Alert.Content>
          <Alert.Title>
            {needsReconnect ? "Reconnect your Reddit account" : title}
          </Alert.Title>
          <Alert.Description>
            <Stack gap={4}>
              <Text>
                {needsReconnect
                  ? "Your Reddit connection is no longer active. Reconnect your account to add this feed."
                  : description}
              </Text>
              <Stack>
                <Box>
                  <RedditLoginButton
                    size="md"
                    emphasis={variant === "required" ? "primary" : undefined}
                    colorPalette={variant === "required" ? undefined : "green"}
                    onConnected={onCorrected}
                  />
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
