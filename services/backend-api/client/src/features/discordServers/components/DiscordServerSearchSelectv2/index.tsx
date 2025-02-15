import React, { useEffect } from "react";
import { Alert, AlertIcon, Box, Button, Flex } from "@chakra-ui/react";
import { InlineErrorAlert, ThemedSelect } from "@/components";
import { useDiscordServers, useDiscordServerSettings } from "@/features/discordServers";
import { useDiscordBot } from "../../../discordUser";

interface Props {
  onChange: (serverId: string) => void;
  value: string;
  inputRef?: React.ComponentProps<typeof ThemedSelect>["inputRef"];
  isDisabled?: boolean;
  inputId?: string;
  ariaLabelledBy: string;
  alertOnArticleEligibility?: boolean;
  placeholder?: string;
  isInvalid: boolean;
}

export const DiscordServerSearchSelectv2: React.FC<Props> = ({
  onChange,
  value,
  inputRef,
  isDisabled,
  inputId,
  ariaLabelledBy,
  alertOnArticleEligibility,
  placeholder,
  isInvalid,
}) => {
  const { status, data } = useDiscordServers();
  const {
    error: getServerError,
    isFetching: isFetchingServerSettings,
    refetch: refetchServerSettings,
    data: discordServerSettings,
  } = useDiscordServerSettings({
    serverId: value,
  });
  const { data: discordBot } = useDiscordBot();

  const loading = status === "loading";

  const onChangedValue = (newServerId: string) => {
    onChange(newServerId);
  };

  // Bot may be invited when window is out-of-focus
  useEffect(() => {
    function onFocus() {
      if (isFetchingServerSettings || !getServerError) {
        return;
      }

      refetchServerSettings();
    }

    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [refetchServerSettings, isFetchingServerSettings, getServerError]);

  return (
    <Flex flexDirection="column">
      <ThemedSelect
        onChange={onChangedValue}
        loading={loading}
        value={value}
        isInvalid={isInvalid}
        placeholder={placeholder}
        inputRef={inputRef}
        isDisabled={isDisabled}
        options={
          data?.results.map((server) => ({
            value: server.id,
            label: server.name,
            icon: server.iconUrl,
            data: server,
          })) || []
        }
        selectProps={{
          "aria-labelledby": ariaLabelledBy,
          inputId,
        }}
      />
      {alertOnArticleEligibility && (
        <div aria-live="polite" aria-busy={isFetchingServerSettings}>
          {isFetchingServerSettings && (
            <Alert status="info" mt={2}>
              Checking server eligibility...
            </Alert>
          )}
          {discordServerSettings && (
            <Alert status="success" mt={2}>
              <AlertIcon />
              Selected Discord server is eligible for articles to be sent
            </Alert>
          )}
          {getServerError?.statusCode === 404 && (
            <Box mt={2}>
              <InlineErrorAlert
                title={`${discordBot?.result.username} is not currently in this server`}
                description={
                  <Flex flexDirection="column">
                    <span>
                      Articles are unable to be sent to this server until the bot is invited.
                    </span>
                    <Button
                      as="a"
                      href={discordBot?.result.inviteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      mt="2"
                      tabIndex={0}
                    >
                      Invite {discordBot?.result.username} to this server
                    </Button>
                  </Flex>
                }
              />
            </Box>
          )}
        </div>
      )}
    </Flex>
  );
};
