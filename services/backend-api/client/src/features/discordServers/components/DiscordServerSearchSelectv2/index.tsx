import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Flex, Spinner } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
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
  } = useDiscordServerSettings({
    serverId: value,
  });
  const { data: discordBot } = useDiscordBot();

  const loading = status === "loading";

  const [showLoadingAlert, setShowLoadingAlert] = useState(false);

  useEffect(() => {
    if (!isFetchingServerSettings) {
      setShowLoadingAlert(false);

      return;
    }

    // Delay to avoid layout shift flash when the check resolves quickly
    const timer = setTimeout(() => setShowLoadingAlert(true), 1000);

    return () => clearTimeout(timer);
  }, [isFetchingServerSettings]);

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
      <div
        aria-live="polite"
        aria-busy={isFetchingServerSettings}
        hidden={!alertOnArticleEligibility}
      >
        {showLoadingAlert && (
          <Alert status="info" mt={2}>
            <Spinner size="sm" mr={2} />
            Verifying bot access...
          </Alert>
        )}
        <Box mt={2} hidden={getServerError?.statusCode !== 404}>
          <InlineErrorAlert
            title={`${discordBot?.result.username} is not currently in this server`}
            description={
              <Flex flexDirection="column">
                <span>Articles are unable to be sent to this server until the bot is invited.</span>
                <Button
                  as="a"
                  href={discordBot?.result.inviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  mt="2"
                  tabIndex={0}
                  rightIcon={<ExternalLinkIcon />}
                >
                  {`Invite ${discordBot?.result.username} to this server`}
                </Button>
              </Flex>
            }
          />
        </Box>
      </div>
    </Flex>
  );
};
