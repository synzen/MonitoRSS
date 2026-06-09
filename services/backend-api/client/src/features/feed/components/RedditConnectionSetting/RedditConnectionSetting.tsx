import { Badge, HStack, Stack, Text } from "@chakra-ui/react";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { RedditLoginButton, useUserMe } from "@/features/discordUser";
import { useRemoveRedditLogin } from "../../hooks/useRemoveRedditLogin";

interface Props {
  onRemoveSuccess?: () => void;
  onRemoveError?: (message: string) => void;
}

export const RedditConnectionSetting = ({
  onRemoveSuccess,
  onRemoveError,
}: Props) => {
  const { data } = useUserMe();
  const { mutateAsync: removeRedditLogin, status: removeRedditLoginStatus } =
    useRemoveRedditLogin();

  const redditAccount = data?.result.externalAccounts?.find(
    (a) => a.type === "reddit",
  );
  const isActive = redditAccount?.status === "ACTIVE";
  const isRevoked = !!redditAccount && !isActive;

  const onClickRemoveRedditLogin = async () => {
    try {
      await removeRedditLogin();
      onRemoveSuccess?.();
    } catch (err) {
      onRemoveError?.((err as Error).message);
    }
  };

  return (
    <HStack
      justifyContent="space-between"
      borderStyle="solid"
      alignItems="flex-start"
      borderWidth={1}
      borderColor="border"
      rounded="l3"
      p={4}
      gap={4}
      flexWrap="wrap"
    >
      <Stack flex="1" minW="260px">
        <Stack gap={1}>
          <HStack alignItems="center" gap={2}>
            <Text fontWeight={600}>Reddit</Text>
            {isActive && <Badge colorPalette="green">Connected</Badge>}
            {isRevoked && <Badge colorPalette="red">Disconnected</Badge>}
            {!redditAccount && <Badge>Not Connected</Badge>}
          </HStack>
          <Text color="fg.muted" fontSize="sm">
            {isRevoked
              ? "Your Reddit connection is no longer active. Reconnect your account so Reddit feeds keep using your higher rate limit quotas."
              : "Allows MonitoRSS to use rate limits specific to your Reddit account, which has much higher rate limit quotas than the global rate limits. All Reddit feeds will automatically use your Reddit account if connected."}
          </Text>
        </Stack>
      </Stack>
      <HStack flexShrink={0}>
        <RedditLoginButton />
        {redditAccount && (
          <SafeLoadingButton
            colorPalette="red"
            variant="ghost"
            size="sm"
            loading={removeRedditLoginStatus === "loading"}
            onClick={() => {
              onClickRemoveRedditLogin();
            }}
          >
            <span>Disconnect</span>
          </SafeLoadingButton>
        )}
      </HStack>
    </HStack>
  );
};
