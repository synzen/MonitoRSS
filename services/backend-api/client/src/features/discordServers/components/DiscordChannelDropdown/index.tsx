import { ThemedSelect } from "@/components";
import { useDiscordServerChannels } from "../../hooks";

interface Props {
  serverId?: string;
  onChange: (value: string) => void;
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

  const loading = status === "loading";

  const options =
    data?.results.map((channel) => ({
      label: `${channel.category ? `[${channel.category.name}] ` : ""}${channel.name}`,
      value: channel.id,
    })) || [];

  return (
    <ThemedSelect
      loading={loading}
      isDisabled={isDisabled || loading || !!error}
      options={options}
      onChange={onChange}
      onBlur={onBlur}
      value={value}
    />
  );
};
