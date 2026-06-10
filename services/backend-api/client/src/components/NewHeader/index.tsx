import { Box, Button, Flex, HStack, Text, chakra } from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { FaGear, FaCircleInfo } from "react-icons/fa6";

import { pages } from "../../constants";
import { Loading } from "../Loading";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";

interface Props {
  invertBackground?: boolean;
  bot?: { avatar?: string | null; username: string } | null;
  isBotLoading?: boolean;
  botError?: { message: string } | null;
  user?: { iconUrl?: string; username?: string; id?: string };
  /** Logo target. Containers pass the current scope's feeds so "home" never switches scope. */
  logoHref?: string;
  workspaceSlot?: React.ReactNode;
  searchSlot?: React.ReactNode;
  accountMenuSlot?: React.ReactNode;
  logoutSlot?: React.ReactNode;
}

export const NewHeader = ({
  invertBackground,
  bot,
  isBotLoading,
  botError,
  user,
  logoHref,
  workspaceSlot,
  searchSlot,
  accountMenuSlot,
  logoutSlot,
}: Props) => {
  const navigate = useNavigate();

  return (
    <chakra.header width="full" borderBottom="solid 1px" borderColor="border">
      <Box
        width="100%"
        background={invertBackground ? "bg.subtle" : "none"}
        display="flex"
        justifyContent="center"
      >
        <Flex
          width="100%"
          justifyContent="space-between"
          maxWidth="1400px"
          paddingX={{ base: 4, lg: 12 }}
        >
          <HStack gap={8}>
            {/* Logo and scope switcher read as one path (brand / scope), so they share
                a tight cluster; the slash renders only when a scope slot exists, keeping
                the zero-workspace header unchanged. */}
            {/* minW=0 (not overflow=hidden, which would clip the chip's focus ring)
                lets the logo's own ellipsis engage when space is tight. */}
            <HStack gap={2} minW={0}>
              <Flex alignItems="center" overflow="hidden">
                {bot && (
                  <Link to={logoHref ?? pages.userFeeds()} aria-label="MonitoRSS Home">
                    <Flex alignItems="center" paddingBottom="1" overflow="hidden">
                      <Avatar
                        src={bot.avatar || undefined}
                        size="sm"
                        name={bot.username}
                        marginRight="2"
                        backgroundColor="transparent"
                      />
                      <chakra.span
                        fontSize="xl"
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        fontWeight="bold"
                        title="MonitoRSS"
                      >
                        MonitoRSS
                      </chakra.span>
                    </Flex>
                  </Link>
                )}
                {isBotLoading && (
                  <Box>
                    <Loading />
                  </Box>
                )}
                {botError && <Alert status="error" title={botError.message} />}
              </Flex>
              {workspaceSlot && (
                <>
                  <chakra.span aria-hidden="true" color="fg.muted" fontSize="lg" userSelect="none">
                    /
                  </chakra.span>
                  {workspaceSlot}
                </>
              )}
            </HStack>
            <HStack>{searchSlot}</HStack>
          </HStack>
          <Flex alignItems="center" paddingY="4">
            <MenuRoot positioning={{ placement: "bottom-end" }}>
              <MenuTrigger asChild>
                <Button size="sm" variant="ghost" aria-label="Account settings">
                  <Avatar
                    src={user?.iconUrl}
                    size="sm"
                    name={user?.username}
                    backgroundColor="bg.emphasized"
                    title={user?.username}
                    aria-hidden
                  />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <Box overflow="hidden" paddingX={2} title={user?.username}>
                  <Text
                    overflow="hidden"
                    maxWidth={300}
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {user?.username}
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    Discord ID: {user?.id}
                  </Text>
                </Box>
                <MenuSeparator />
                <MenuItem value="account-settings" onClick={() => navigate(pages.userSettings())}>
                  <FaGear />
                  Account Settings
                </MenuItem>
                <MenuItem
                  value="discord-support"
                  alignItems="center"
                  onClick={() => {
                    window.open("https://discord.gg/pudv7Rx", "_blank");
                  }}
                >
                  <FaCircleInfo />
                  Discord Support Server
                </MenuItem>
                {accountMenuSlot}
                {logoutSlot}
              </MenuContent>
            </MenuRoot>
          </Flex>
        </Flex>
      </Box>
    </chakra.header>
  );
};
