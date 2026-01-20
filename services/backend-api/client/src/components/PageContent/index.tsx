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
  Alert,
} from "@chakra-ui/react";
import { HamburgerIcon } from "@chakra-ui/icons";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { SidebarDiscordServerLinks } from "@/features/discordServers";
import { useDiscordBot, useDiscordUserMe, UserStatusTag } from "@/features/discordUser";
import { DiscordUserDropdown } from "@/features/discordUser/components/DiscordUserDropdown";
import { LogoutButton } from "@/features/auth";
import { Loading } from "../Loading";

interface Props {
  requireFeed?: boolean;
  children?: React.ReactNode;
}

export const PageContent = ({ requireFeed, children }: Props) => {
  const staticSidebarShown = useBreakpointValue<boolean>({ base: false, xl: true });
  const navigate = useNavigate();
  const location = useLocation();
  const { feedId, serverId } = useParams();
  const [sidebarToggledOpen, setSidebarToggledOpen] = useState(false);
  const { data: userMe } = useDiscordUserMe();
  const {
    data: discordBotData,
    error: discordBotError,
    status: discordBotStatus,
  } = useDiscordBot();

  const onPathChanged = (path: string) => {
    navigate(path, {
      replace: true,
    });

    if (!staticSidebarShown) {
      setSidebarToggledOpen(false);
    }
  };

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
        // height="75px"
        width="full"
        background={staticSidebarShown ? "gray.700" : "gray.800"}
        paddingX="4"
        paddingY="2"
      >
        {discordBotData && !discordBotError && (
          <>
            <Flex alignItems="center" paddingBottom="1">
              <Avatar
                src={discordBotData.result.avatar || undefined}
                size="xs"
                name={discordBotData.result.username}
                marginRight="2"
                backgroundColor="transparent"
              />
              <Heading
                fontSize="xl"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
                title={discordBotData.result.username}
              >
                {discordBotData.result.username}
              </Heading>
            </Flex>
            <Text display="block">Control Panel</Text>
          </>
        )}
        {discordBotError && <Alert status="error">{discordBotError.message}</Alert>}
        {discordBotStatus === "loading" && (
          <Box>
            <Loading />
          </Box>
        )}
      </Flex>
      <Stack paddingX="6" marginTop="6" display="flex" alignItems="flex-start" spacing="2">
        <Stack width="100%" alignItems="flex-start" spacing="4">
          <Avatar name={userMe?.username} src={userMe?.iconUrl} size="lg" />
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
      </Stack>
      <Divider />
      <LogoutButton />
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
            variant="outline"
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
      <Flex width="100%" justifyContent="center" overflow="auto">
        <Box width="100%">{children}</Box>
      </Flex>
    </Flex>
  );
};
