import {
  Avatar,
  Flex,
  Heading,
} from '@chakra-ui/react';
import {
  Navigate, useNavigate, useParams,
} from 'react-router-dom';
import {
  DiscordServerSearchSelect,
} from '../../features/discordServers/components/DiscordServerSearchSelect';
import { useDiscordBot } from '../../features/discordUser';

interface Props {
  requireFeed?: boolean;
}

export const PageContentV2: React.FC<Props> = ({ requireFeed, children }) => {
  const { feedId, serverId } = useParams();
  const navigate = useNavigate();
  const {
    data: discordBotData,
  } = useDiscordBot();

  if (!serverId) {
    return <Navigate to="/v2/servers" />;
  }

  if (!feedId && requireFeed) {
    return <Navigate to={`/v2/servers/${serverId}/feeds`} />;
  }

  return (
    <Flex
      flexGrow={1}
      height="100%"
      alignItems="center"
      flexDir="column"
    >
      <Flex
        width="100%"
        justifyContent="space-between"
        paddingX="12"
        paddingY="4"
        background="gray.700"
      >
        <Flex alignItems="center">
          <Heading fontWeight={500} paddingRight="8">MonitoRSS</Heading>
          <DiscordServerSearchSelect
            onClick={(selectedServerId) => navigate(`/v2/servers/${selectedServerId}/feeds`)}
          />
        </Flex>
        <Flex alignItems="center">
          <Avatar
            src={discordBotData?.result.avatar || undefined}
            size="sm"
            name={discordBotData?.result.username}
            marginRight="2"
            backgroundColor="transparent"
            title={discordBotData?.result.username}
          />
        </Flex>
      </Flex>
      <Flex
        width="100%"
        maxWidth="1200px"
      >
        {children}
      </Flex>
    </Flex>
  );
};
