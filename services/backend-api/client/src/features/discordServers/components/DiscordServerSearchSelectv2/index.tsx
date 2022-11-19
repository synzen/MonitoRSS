import { ThemedSelect } from '@/components';
import { useDiscordServers } from '@/features/discordServers';

interface Props {
  onChange: (serverId: string) => void;
  value: string
}

export const DiscordServerSearchSelectv2: React.FC<Props> = ({
  onChange,
  value,
}) => {
  const { status, data } = useDiscordServers();

  const loading = status === 'loading';

  const onChangedValue = (newServerId: string) => {
    onChange(newServerId);
  };

  return (
    <ThemedSelect
      onChange={onChangedValue}
      loading={loading}
      value={value}
      options={data?.results.map((server) => ({
        value: server.id,
        label: server.name,
        icon: server.iconUrl,
      })) || []}
    />
  );
};
