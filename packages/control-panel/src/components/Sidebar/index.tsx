import {
  Flex, Stack,
} from '@chakra-ui/react';
import { DiscordServer } from '../../types/DiscordServer';
import ThemedSelect from '../ThemedSelect';
import ManageFeedLinks from './ManageFeedLinks';
import ManageServerLinks from './ManageServerLinks';

interface Props {
  currentPath: string;
  currentServerId: string
  currentFeedId?: string
  onChangePath: (path: string) => void
  servers: DiscordServer[]
}

const Sidebar: React.FC<Props> = ({
  currentPath,
  currentServerId,
  currentFeedId,
  onChangePath,
}) => (
  <Flex
    as="nav"
    height="100%"
    direction="column"
    justify="space-between"
    maxW="18rem"
    width="full"
    paddingY="4"
    borderRightWidth="1px"
  >
    <Stack spacing="12">
      <Stack px="3">
        <ThemedSelect />
        {/* <Flex px="3" py="4" minH="12" align="center">
          <Text fontWeight="bold" fontSize="sm" lineHeight="1.25rem">
            Monito.RSS
          </Text>
        </Flex> */}
      </Stack>
      <Stack px="3" spacing="6">
        <Stack spacing="3">
          {!currentFeedId && (
            <ManageServerLinks
              currentPath={currentPath}
              onChangePath={onChangePath}
              serverId={currentServerId}
            />
          )}
          {currentFeedId && (
            <ManageFeedLinks
              currentPath={currentPath}
              feedId={currentFeedId}
              serverId={currentServerId}
              onChangePath={onChangePath}
            />
          )}
        </Stack>
      </Stack>
    </Stack>
  </Flex>
);

export default Sidebar;
