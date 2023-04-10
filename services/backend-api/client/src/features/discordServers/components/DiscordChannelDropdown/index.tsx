import { Alert, AlertDescription, AlertTitle, Box, Stack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { ThemedSelect } from "@/components";
import { useDiscordServerChannels } from "../../hooks";

interface Props {
  serverId?: string;
  onChange: (channelId: string, channelName: string) => void;
  onBlur: () => void;
  value?: string;
  isDisabled?: boolean;
}

export const DiscordChannelDropdown: React.FC<Props> = ({
  serverId,
  onChange,
  onBlur,
  value,
  isDisabled,
}) => {
  const { data, error, status } = useDiscordServerChannels({ serverId });
  const { t } = useTranslation();

  const loading = status === "loading";

  const options =
    data?.results.map((channel) => ({
      label: `${channel.category ? `[${channel.category.name}] ` : ""}${channel.name}`,
      value: channel.id,
      data: channel,
    })) || [];

  return (
    <Stack>
      <ThemedSelect
        loading={loading}
        isDisabled={isDisabled || loading || !!error}
        options={options}
        onChange={(val, optionData) => onChange(val, optionData.name)}
        onBlur={onBlur}
        value={value}
      />
      {serverId && error && (
        <Alert status="error">
          <Box>
            <AlertTitle>
              {t("features.feed.components.addDiscordChannelConnectionDialog.failedToGetChannels")}
            </AlertTitle>
            <AlertDescription>{error?.message}</AlertDescription>
          </Box>
        </Alert>
      )}
    </Stack>
  );
};
