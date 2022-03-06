import {
  Avatar,
  Box, Button, Divider, Flex, Menu, MenuButton, MenuDivider, MenuItem, MenuList, Stack, Tag, Text,
} from '@chakra-ui/react';
import {
  Navigate, useLocation, useNavigate, useParams,
} from 'react-router-dom';
import { ArrowLeftIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useTranslation } from 'react-i18next';
import { SidebarDiscordServerLinks, useDiscordServers } from '@/features/discordServers';
import { Loading } from '..';
import { SidebarFeedLinks } from '@/features/feed';
import { useDiscordUserMe } from '@/features/discordUser';

interface Props {
  requireFeed?: boolean;
}

export const PageContent: React.FC<Props> = ({ requireFeed, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { feedId, serverId } = useParams();
  const {
    status,
    error,
  } = useDiscordServers();
  const {
    data: userMe,
  } = useDiscordUserMe();
  const { t } = useTranslation();

  const onPathChanged = (path: string) => {
    navigate(path, {
      replace: true,
    });
  };

  if (status === 'loading') {
    return (
      <Box
        width="100vw"
        height="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Loading />
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <div>
        Error while getting servers
        {' '}
        {error?.message}
      </div>
    );
  }

  if (!serverId) {
    return <Navigate to="/servers" />;
  }

  if (!feedId && requireFeed) {
    return <Navigate to={`/servers/${serverId}/feeds`} />;
  }

  return (
    <Flex flexGrow={1} height="100vh">
      <Flex
        as="nav"
        height="100%"
        direction="column"
        maxW="18rem"
        width="full"
        paddingBottom="4"
        borderRightWidth="1px"
      >
        {/* <Flex
          height={16}
          background="blue.500"
          marginBottom="4"
          // justifyContent="center"
          alignItems="center"
          padding="8"
        >
          <Heading size="md" color="white.500">Monito.RSS</Heading>
        </Flex> */}
        {/* <Flex
          boxShadow="2xl"
          bg="gray.700"
          borderRadius="lg"
          marginX="4"
          marginTop="4"
          marginBottom="12"
        > */}
        <Stack
          paddingX="8"
          marginTop="8"
          display="flex"
          justifyContent="center"
          alignItems="center"
          spacing="4"
        >
          <Stack
            width="100%"
            justifyContent="center"
            alignItems="center"
            spacing="4"
          >
            <Avatar
              name={userMe?.username}
              src={userMe?.iconUrl}
              size="xl"
            />
            <Menu>
              <MenuButton
                as={Button}
                width="100%"
                rightIcon={<ChevronDownIcon />}
                variant="ghost"
                marginTop="4"
                marginBottom="4"
                aria-label="User menu"
              >
                <Text textOverflow="ellipsis" overflow="hidden">
                  {userMe?.username}
                </Text>
              </MenuButton>
              <MenuList py="2" px="2" shadow="lg">
                <MenuItem rounded="md">
                  {t('components.sidebar.userDropdown.settings')}
                </MenuItem>
                <MenuDivider />
                <MenuItem rounded="md">
                  {t('components.sidebar.userDropdown.logout')}
                </MenuItem>
              </MenuList>
            </Menu>
          </Stack>
          {userMe && userMe.supporter && (
          <Tag
            marginTop="4"
            colorScheme="purple"
            size="lg"
          >
            <ArrowLeftIcon
              fontSize="xs"
              transform="rotate(90deg)"
              marginRight="2"
            />
            <Text>
              {t('components.sidebar.supporterUserTag')}
            </Text>
          </Tag>
          )}
          {userMe && !userMe.supporter && (
          <Tag
            marginTop="4"
            size="lg"
          >
            {t('components.sidebar.regularUserTag')}
          </Tag>
          )}
        </Stack>
        <Divider marginY="8" />
        {/* </Flex> */}
        <Stack spacing="12">
          <Stack px="3" spacing="6">
            <Stack spacing="3">
              {!feedId && (
                <SidebarDiscordServerLinks
                  currentPath={location.pathname}
                  onChangePath={onPathChanged}
                  serverId={serverId}
                />
              )}
              {feedId && (
                <SidebarFeedLinks
                  currentPath={location.pathname}
                  feedId={feedId}
                  serverId={serverId}
                  onChangePath={onPathChanged}
                />
              )}
            </Stack>
          </Stack>
        </Stack>
      </Flex>
      <Flex
        width="100%"
        justifyContent="center"
        overflow="auto"
      >
        <Box width="100%">
          {children}
        </Box>
      </Flex>
    </Flex>
  );
};
