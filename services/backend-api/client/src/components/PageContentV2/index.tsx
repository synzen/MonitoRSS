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
  children?: React.ReactNode;
}

export const PageContentV2 = ({ requireFeed, children }: Props) => {
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
      overflowX="auto"
    >
      <Flex
        width="100%"
        justifyContent="space-between"
        background="gray.900"
        // overflowX="auto"
      >
        <Flex alignItems="center" paddingLeft={{ base: '4', lg: '8' }} paddingY="4">
          <Heading fontWeight={500} paddingRight="8">MonitoRSS</Heading>
          <DiscordServerSearchSelect
            onClick={(selectedServerId) => navigate(`/v2/servers/${selectedServerId}/feeds`)}
          />
        </Flex>
        <Flex alignItems="center" paddingRight={{ base: '4', lg: '8' }} paddingY="4">
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
      <Flex width="100%" justifyContent="center">
        {children}
      </Flex>
    </Flex>
  );
};
