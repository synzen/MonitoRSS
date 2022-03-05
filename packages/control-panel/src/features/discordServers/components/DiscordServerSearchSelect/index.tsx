import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemedSelect } from '@/components';
import { useDiscordServers } from '@/features/discordServers';

interface Props {

}

export const DiscordServerSearchSelect: React.FC<Props> = () => {
  const navigate = useNavigate();
  const { serverId } = useParams();
  const { pathname } = useLocation();

  const { status, data } = useDiscordServers();

  const loading = status === 'idle' || status === 'loading';

  const onChangedValue = (newServerId: string) => {
    if (!serverId) {
      return;
    }

    navigate(pathname.replace(serverId, newServerId));
  };

  return (
    <ThemedSelect
      onChange={onChangedValue}
      loading={loading}
      value={serverId}
      options={data?.results.map((server) => ({
        value: server.id,
        label: server.name,
        icon: server.iconUrl,
      })) || []}
    />
  );
};
