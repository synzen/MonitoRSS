import {
  Avatar,
  Box,
  Divider,
  Flex,
  Heading,
  Stack,
  Text,
  useBreakpointValue,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  HStack,
} from '@chakra-ui/react';
import { HamburgerIcon } from '@chakra-ui/icons';
import {
  Navigate, useLocation, useNavigate, useParams,
} from 'react-router-dom';
import { useState } from 'react';
import { SidebarDiscordServerLinks, useDiscordServers } from '@/features/discordServers';
import { Loading } from '..';
import { SidebarFeedLinks } from '@/features/feed';
import { useDiscordUserMe, UserStatusTag } from '@/features/discordUser';
import { DiscordUserDropdown } from '@/features/discordUser/components/DiscordUserDropdown';

interface Props {
  requireFeed?: boolean;
}

export const PageContent: React.FC<Props> = ({ requireFeed, children }) => {
  const staticSidebarShown = useBreakpointValue<boolean>({ base: false, xl: true });
  const navigate = useNavigate();
  const location = useLocation();
  const { feedId, serverId } = useParams();
  const [sidebarToggledOpen, setSidebarToggledOpen] = useState(false);
  const {
    status,
    error,
  } = useDiscordServers();
  const {
    data: userMe,
  } = useDiscordUserMe();

  const onPathChanged = (path: string) => {
    navigate(path, {
      replace: true,
    });

    if (!staticSidebarShown) {
      setSidebarToggledOpen(false);
    }
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

  const sidebarContent = (
    <>
      <Flex
        justifyContent="center"
        flexDir="column"
        height="75px"
        width="full"
        background={staticSidebarShown ? 'gray.700' : 'gray.800'}
        padding="4"
      >
        <Heading fontSize="3xl">Monito.RSS</Heading>
        <Text display="block">Control Panel</Text>
      </Flex>
      <Stack
        paddingX="6"
        marginTop="8"
        display="flex"
        alignItems="flex-start"
        spacing="4"
      >
        <Stack
          width="100%"
          alignItems="flex-start"
          spacing="4"
        >
          <Avatar
            name={userMe?.username}
            src={userMe?.iconUrl}
            size="xl"
          />
          <DiscordUserDropdown />
        </Stack>
        <UserStatusTag />
      </Stack>
      <Divider marginY="8" />
      <Stack px="6" spacing="9">
        <SidebarDiscordServerLinks
          currentPath={location.pathname}
          onChangePath={onPathChanged}
          serverId={serverId}
        />
        <SidebarFeedLinks
          currentPath={location.pathname}
          feedId={feedId}
          serverId={serverId}
          onChangePath={onPathChanged}
        />
      </Stack>
    </>
  );

  if (!staticSidebarShown) {
    return (
      <Box>
        <Drawer
          size="md"
          isOpen={sidebarToggledOpen}
          onClose={() => {
            setSidebarToggledOpen(false);
          }}
          placement="left"
        >
          <DrawerOverlay />
          <DrawerContent overflow="auto">
            <DrawerCloseButton />
            {sidebarContent}
          </DrawerContent>
        </Drawer>
        <HStack
          spacing={4}
          height="60px"
          background="gray.700"
          width="100%"
          paddingX="4"
          display="flex"
          alignItems="center"
        >
          <IconButton
            onClick={() => setSidebarToggledOpen(true)}
            variant="ghost"
            icon={<HamburgerIcon fontSize="xl" />}
            aria-label="Open menu"
          />
          <Heading>Monito.RSS</Heading>
        </HStack>
        {children}

      </Box>
    );
  }

  return (
    <Flex
      flexGrow={1}
      height="100%"
      // overflow="auto"
    >
      <Flex
        overflow="auto"
        as="nav"
        direction="column"
        maxW="325px"
        height="100%"
        width="full"
        paddingBottom="4"
        borderRightWidth="1px"
      >
        {sidebarContent}
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
