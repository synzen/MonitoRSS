import { Box, Field } from "@chakra-ui/react";
import { ThemedSelect } from "@/components";
import { getChannelIcon } from "@/features/feedConnections";
import { useDiscordServerChannels } from "../../hooks";
import { GetDiscordChannelType } from "../../constants";

interface Props {
  serverId?: string;
  onChange: (channelId: string, channelName: string, channelType?: string | null) => void;
  onBlur: () => void;
  value?: string;
  isDisabled?: boolean;
  inputId?: string;
  isInvalid: boolean;
  ariaLabelledBy: string;
  types?: GetDiscordChannelType[];
}

export const DiscordChannelDropdown: React.FC<Props> = ({
  serverId,
  onChange,
  onBlur,
  value,
  isDisabled,
  inputId,
  isInvalid,
  ariaLabelledBy,
  types,
}) => {
  const { data, error, isFetching } = useDiscordServerChannels({ serverId, types });

  const options =
    data?.results.map((channel) => ({
      label: `${channel.category ? `[${channel.category.name}] ` : ""}${channel.name}`,
      value: channel.id,
      data: channel,
      icon: getChannelIcon(channel.type),
    })) || [];

  return (
    <Box w="100%">
      <ThemedSelect
        loading={isFetching}
        isDisabled={isDisabled || !!error}
        options={options}
        onChange={(val, optionData) => onChange(val, optionData.name, optionData.type)}
        onBlur={onBlur}
        value={value}
        isInvalid={isInvalid}
        selectProps={{
          inputId,
          "aria-labelledby": ariaLabelledBy,
          openMenuOnClick: !isFetching,
          openMenuOnFocus: !isFetching,
        }}
        placeholder={!serverId ? "Must select a Discord server first" : "Select a channel"}
      />
      {(!serverId || !error) && (
        <Field.HelperText>Only channels that the bot can view will appear.</Field.HelperText>
      )}
      {serverId && error && <Field.ErrorText>{error?.message}</Field.ErrorText>}
    </Box>
  );
};
