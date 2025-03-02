import { Box, FormErrorMessage, FormHelperText } from "@chakra-ui/react";
import { FiHash, FiMessageCircle } from "react-icons/fi";
import { BsMegaphoneFill } from "react-icons/bs";
import { ThemedSelect } from "@/components";
import { useDiscordServerChannels } from "../../hooks";
import { GetDiscordChannelType } from "../../constants";

interface Props {
  serverId?: string;
  onChange: (channelId: string, channelName: string) => void;
  onBlur: () => void;
  value?: string;
  isDisabled?: boolean;
  inputId?: string;
  isInvalid: boolean;
  ariaLabelledBy: string;
  types?: GetDiscordChannelType[];
}

const iconsByChannelType: Record<GetDiscordChannelType, React.ReactNode> = {
  text: <FiHash />,
  forum: <FiMessageCircle />,
  announcement: <BsMegaphoneFill />,
};

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
      icon: channel.type ? iconsByChannelType[channel.type] : iconsByChannelType.text,
    })) || [];

  return (
    <Box>
      <ThemedSelect
        loading={isFetching}
        isDisabled={isDisabled || isFetching || !!error}
        options={options}
        onChange={(val, optionData) => onChange(val, optionData.name)}
        onBlur={onBlur}
        value={value}
        isInvalid={isInvalid}
        selectProps={{
          inputId,
          "aria-labelledby": ariaLabelledBy,
        }}
        placeholder={!serverId ? "Must select a Discord server first" : "Select a channel"}
      />
      {(!serverId || !error) && (
        <FormHelperText>Only channels that the bot can view will appear.</FormHelperText>
      )}
      {serverId && error && <FormErrorMessage>{error?.message}</FormErrorMessage>}
    </Box>
  );
};
