import { ThemedSelect } from "@/components";
import { useDiscordServerChannels } from "../../hooks";

interface Props {
  serverId?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  value?: string;
}

export const DiscordChannelDropdown: React.FC<Props> = ({ serverId, onChange, onBlur, value }) => {
  const { data, error, status } = useDiscordServerChannels({ serverId });

  const loading = status === "loading";

  return (
    <ThemedSelect
      loading={loading}
      isDisabled={loading || !!error}
      options={
        data?.results.map((channel) => ({
          label: channel.name,
          value: channel.id,
        })) || []
      }
      onChange={onChange}
      onBlur={onBlur}
      value={value}
    />
  );
};
