import { useNavigate, useParams } from "react-router-dom";
import { ThemedSelect } from "@/components";
import { useDiscordServers } from "@/features/discordServers";

interface Props {
  onClick?: (serverId: string) => void;
}

export const DiscordServerSearchSelect: React.FC<Props> = ({ onClick }) => {
  const navigate = useNavigate();
  const { serverId } = useParams();

  const { status, data } = useDiscordServers();

  const loading = status === "loading";

  const onChangedValue = (newServerId: string) => {
    if (onClick) {
      onClick(newServerId);
    } else {
      navigate(`/servers/${newServerId}/feeds`);
    }
  };

  return (
    <ThemedSelect
      isInvalid={false}
      onChange={onChangedValue}
      loading={loading}
      value={serverId}
      options={
        data?.results.map((server) => ({
          value: server.id,
          label: server.name,
          icon: server.iconUrl,
          data: server,
        })) || []
      }
    />
  );
};
